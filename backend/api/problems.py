"""
奥赛习题集 — MathNet problem-bank API, backed by a prebuilt SQLite DB.

The DB (``backend/data/problems.db``) is a read-only build artifact produced by
``backend/scripts/build_problems.py``. All listing / filtering / search /
pagination happens server-side via indexed SQL + an FTS5 (trigram) full-text
index, so there is none of the legacy in-memory linear scan.

Endpoints (all under ``/api/problems``):
  * ``GET /facets``            — every filter's options (+ counts).
  * ``GET /``                  — filtered, searched, sorted, paginated list.
  * ``GET /random``            — one full problem honoring the active filters.
  * ``GET /daily``             — deterministic problem-of-the-day.
  * ``GET /stats``             — dashboard aggregates.
  * ``GET /<id>``              — one full problem (statement + all solutions).

Trigram FTS only matches substrings of length >= 3; shorter queries (typically
2-char CJK like 数论 / 几何) fall back to LIKE over the denormalized search text.
"""
import functools
import os
import re
import sqlite3

from datetime import date

from flask import Blueprint, g, jsonify, request

from api import DATA_DIR

bp = Blueprint('problems', __name__, url_prefix='/api/problems')

_DB_PATH = os.path.join(DATA_DIR, 'problems.db')

_DIFF_ORDER = {'easy': 1, 'medium': 2, 'hard': 3, 'elite': 4}


# --------------------------------------------------------------------------- #
# Connection (read-only, one per request context).
# --------------------------------------------------------------------------- #
def _db():
    """Return a read-only connection, or None if the DB has not been built."""
    if not os.path.exists(_DB_PATH):
        return None
    conn = getattr(g, '_problems_db', None)
    if conn is None:
        uri = f'file:{_DB_PATH}?mode=ro'
        conn = sqlite3.connect(uri, uri=True, check_same_thread=False)
        conn.row_factory = sqlite3.Row
        g._problems_db = conn
    return conn


@bp.teardown_request
def _close_db(_exc):
    conn = getattr(g, '_problems_db', None)
    if conn is not None:
        conn.close()


def _unavailable():
    return jsonify({'error': '题库未构建，请运行 build_problems.py'}), 503


# --------------------------------------------------------------------------- #
# Filter / search WHERE-clause builder (shared by list / random / count).
# --------------------------------------------------------------------------- #
_FTS_STRIP = re.compile(r'["()*]')


def _where(args, skip=()):
    """Build (sql_fragment, params, fts_match) from query args.

    ``skip`` is a set of filter names to ignore (e.g. drop ``competition`` when
    aggregating the competition index so the list reflects every competition).
    """
    clauses, params = [], []

    config = args.get('config') or args.get('country')
    if config:
        clauses.append('p.config = ?')
        params.append(config)

    competition = args.get('competition')
    if competition and 'competition' not in skip:
        clauses.append('p.competition = ?')
        params.append(competition)

    year = args.get('year')
    if year == 'unknown':
        clauses.append('p.year IS NULL')
    elif year:
        try:
            params.append(int(year))
            clauses.append('p.year = ?')
        except (TypeError, ValueError):
            pass

    difficulty = args.get('difficulty')
    if difficulty:
        clauses.append('p.difficulty = ?')
        params.append(difficulty)

    ptype = args.get('problem_type')
    if ptype:
        clauses.append('p.problem_type = ?')
        params.append(ptype)

    if args.get('has_solution') == '1':
        clauses.append('p.has_solution = 1')
    if args.get('has_images') == '1':
        clauses.append('p.has_images = 1')

    # Category levels: a single category row must match every provided level.
    cat_cols = [('level1', 'l1_zh'), ('level2', 'l2_zh'),
                ('level3', 'l3'), ('level4', 'l4')]
    cat_clauses, cat_params = [], []
    for arg_name, col in cat_cols:
        v = args.get(arg_name)
        if v:
            cat_clauses.append(f'pc.{col} = ?')
            cat_params.append(v)
    if cat_clauses:
        clauses.append(
            'EXISTS (SELECT 1 FROM problem_categories pc '
            'WHERE pc.problem_id = p.id AND ' + ' AND '.join(cat_clauses) + ')')
        params.extend(cat_params)

    # Full-text / substring search.
    fts_match = None
    q = (args.get('q') or '').strip()
    if len(q) >= 3:
        cleaned = _FTS_STRIP.sub(' ', q).strip()
        if cleaned:
            fts_match = '"' + cleaned.replace('"', '') + '"'
            clauses.append(
                'p.rowid IN (SELECT rowid FROM problems_fts '
                'WHERE problems_fts MATCH ?)')
            params.append(fts_match)
    elif q:
        like = f'%{q}%'
        clauses.append('(p.problem_md LIKE ? OR p.competition LIKE ? '
                       'OR p.search_categories LIKE ? OR p.search_solutions LIKE ?)')
        params.extend([like, like, like, like])

    where = (' WHERE ' + ' AND '.join(clauses)) if clauses else ''
    return where, params, fts_match


_SORTS = {
    'year_desc': 'p.year IS NULL, p.year DESC, p.id',
    'year_asc': 'p.year IS NULL, p.year ASC, p.id',
    'difficulty_asc': 'p.difficulty_score IS NULL, p.difficulty_score ASC, p.id',
    'difficulty_desc': 'p.difficulty_score IS NULL, p.difficulty_score DESC, p.id',
    'id': 'p.id',
}


# --------------------------------------------------------------------------- #
# Row projection helpers.
# --------------------------------------------------------------------------- #
import json


def _light(row):
    d = dict(row)
    return {
        'id': d['id'],
        'country_zh': d['country_zh'],
        'config': d['config'],
        'competition': d['competition'],
        'year': d['year'],
        'year_source': d['year_source'],
        'problem_number': d['problem_number'],
        'categories': json.loads(d.get('categories_json') or '[]'),
        'difficulty': d['difficulty'],
        'difficulty_zh': d['difficulty_zh'],
        'difficulty_score': d['difficulty_score'],
        'problem_type': d['problem_type'],
        'problem_type_zh': d['problem_type_zh'],
        'has_solution': d['has_solution'],
        'has_images': d['has_images'],
        'problem_md': d['problem_md'],
    }


def _full(conn, row):
    item = _light(row)
    d = dict(row)
    sols = conn.execute(
        'SELECT solution_md FROM solutions WHERE problem_id = ? ORDER BY idx',
        (d['id'],)).fetchall()
    item.update({
        'final_answer': d['final_answer'],
        'language': d['language'],
        'num_images': d['num_images'],
        'rationale_zh': d['rationale_zh'],
        'solutions': [s['solution_md'] for s in sols],
    })
    return item


# --------------------------------------------------------------------------- #
# Endpoints.
# --------------------------------------------------------------------------- #
@functools.lru_cache(maxsize=1)
def _facets_payload():
    conn = sqlite3.connect(f'file:{_DB_PATH}?mode=ro', uri=True,
                           check_same_thread=False)
    conn.row_factory = sqlite3.Row
    try:
        def rows(sql):
            return [dict(r) for r in conn.execute(sql).fetchall()]

        total = conn.execute('SELECT COUNT(*) n FROM problems').fetchone()['n']
        countries = [
            {'value': r['config'], 'label': r['country_zh'], 'count': r['n']}
            for r in rows("SELECT config, country_zh, COUNT(*) n FROM problems "
                          "GROUP BY config ORDER BY n DESC")]
        competitions = [
            {'value': r['competition'], 'config': r['config'], 'count': r['n']}
            for r in rows("SELECT competition, config, COUNT(*) n FROM problems "
                          "WHERE competition <> '' GROUP BY competition, config "
                          "ORDER BY n DESC")]
        years = [r['year'] for r in rows(
            "SELECT DISTINCT year FROM problems WHERE year IS NOT NULL "
            "ORDER BY year DESC")]
        year_unknown = conn.execute(
            "SELECT COUNT(*) n FROM problems WHERE year IS NULL").fetchone()['n']
        level1 = [{'value': r['l1_zh'], 'count': r['n']} for r in rows(
            "SELECT l1_zh, COUNT(DISTINCT problem_id) n FROM problem_categories "
            "WHERE l1_zh IS NOT NULL GROUP BY l1_zh ORDER BY n DESC")]
        level2 = [{'value': r['l2_zh'], 'l1': r['l1_zh'], 'count': r['n']}
                  for r in rows(
            "SELECT l2_zh, l1_zh, COUNT(DISTINCT problem_id) n FROM problem_categories "
            "WHERE l2_zh IS NOT NULL GROUP BY l2_zh, l1_zh ORDER BY n DESC")]
        level3 = [{'value': r['l3'], 'l1': r['l1_zh'], 'l2': r['l2_zh'], 'count': r['n']}
                  for r in rows(
            "SELECT l3, l1_zh, l2_zh, COUNT(DISTINCT problem_id) n FROM problem_categories "
            "WHERE l3 IS NOT NULL GROUP BY l3, l1_zh, l2_zh ORDER BY n DESC")]
        level4 = [{'value': r['l4'], 'l1': r['l1_zh'], 'l2': r['l2_zh'], 'count': r['n']}
                  for r in rows(
            "SELECT l4, l1_zh, l2_zh, COUNT(DISTINCT problem_id) n FROM problem_categories "
            "WHERE l4 IS NOT NULL GROUP BY l4, l1_zh, l2_zh ORDER BY n DESC")]
        difficulties = [
            {'value': r['difficulty'], 'label': r['difficulty_zh'], 'count': r['n']}
            for r in rows("SELECT difficulty, difficulty_zh, COUNT(*) n FROM problems "
                          "WHERE difficulty IS NOT NULL GROUP BY difficulty")]
        difficulties.sort(key=lambda d: _DIFF_ORDER.get(d['value'], 9))
        problem_types = [
            {'value': r['problem_type'], 'label': r['problem_type_zh'], 'count': r['n']}
            for r in rows("SELECT problem_type, problem_type_zh, COUNT(*) n FROM problems "
                          "WHERE problem_type IS NOT NULL GROUP BY problem_type "
                          "ORDER BY n DESC")]
        return {
            'total': total, 'countries': countries, 'competitions': competitions,
            'years': years, 'yearUnknown': year_unknown,
            'level1': level1, 'level2': level2, 'level3': level3, 'level4': level4,
            'difficulties': difficulties, 'problemTypes': problem_types,
        }
    finally:
        conn.close()


@bp.route('/facets')
def facets():
    if not os.path.exists(_DB_PATH):
        return _unavailable()
    resp = jsonify(_facets_payload())
    # Revalidate every load: facets change when the DB is rebuilt (e.g. after
    # difficulty enrichment). A long max-age would serve a stale shape/counts.
    resp.headers['Cache-Control'] = 'no-cache'
    return resp


@bp.route('')
@bp.route('/')
def list_problems():
    conn = _db()
    if conn is None:
        return _unavailable()
    args = request.args
    where, params, fts_match = _where(args)

    try:
        page = max(1, int(args.get('page', 1)))
    except (TypeError, ValueError):
        page = 1
    try:
        page_size = min(max(1, int(args.get('pageSize', 20))), 100)
    except (TypeError, ValueError):
        page_size = 20

    total = conn.execute(
        f'SELECT COUNT(*) n FROM problems p{where}', params).fetchone()['n']
    pages = (total + page_size - 1) // page_size if total else 0

    sort = args.get('sort') or ('relevance' if fts_match else 'id')
    if sort == 'relevance' and fts_match:
        order = ('(SELECT bm25(problems_fts, 4.0, 1.0, 0.5, 8.0, 2.0) '
                 'FROM problems_fts WHERE problems_fts.rowid = p.rowid '
                 'AND problems_fts MATCH ?), p.id')
        order_params = [fts_match]
    else:
        order = _SORTS.get(sort, _SORTS['id'])
        order_params = []

    offset = (page - 1) * page_size
    rows = conn.execute(
        f'SELECT * FROM problems p{where} ORDER BY {order} LIMIT ? OFFSET ?',
        params + order_params + [page_size, offset]).fetchall()

    return jsonify({
        'items': [_light(r) for r in rows],
        'total': total, 'page': page, 'pages': pages, 'pageSize': page_size,
    })


@bp.route('/competitions')
def competitions():
    """Competition-grouped index honoring the active filters (except competition).

    Returns geo groups: [{config, country_zh, count, competitions:[{competition,
    count, year_min, year_max, years_known, easy, medium, hard, elite}]}].
    The "browse by competition" view's data source.
    """
    conn = _db()
    if conn is None:
        return _unavailable()
    where, params, _ = _where(request.args, skip={'competition'})
    rows = conn.execute(
        f"""SELECT config, country_zh, competition,
                   COUNT(*) n,
                   MIN(year) ymin, MAX(year) ymax,
                   SUM(year IS NOT NULL) yk,
                   SUM(difficulty='easy') easy, SUM(difficulty='medium') medium,
                   SUM(difficulty='hard') hard, SUM(difficulty='elite') elite
            FROM problems p{where}
            GROUP BY config, competition""",
        params).fetchall()

    groups = {}
    for r in rows:
        g = groups.setdefault(r['config'], {
            'config': r['config'], 'country_zh': r['country_zh'],
            'count': 0, 'competitions': [],
        })
        g['count'] += r['n']
        g['competitions'].append({
            'competition': r['competition'], 'count': r['n'],
            'year_min': r['ymin'], 'year_max': r['ymax'], 'years_known': r['yk'],
            'easy': r['easy'], 'medium': r['medium'],
            'hard': r['hard'], 'elite': r['elite'],
        })

    out = sorted(groups.values(), key=lambda g: -g['count'])
    for g in out:
        # most-populous competitions first within each geo
        g['competitions'].sort(key=lambda c: -c['count'])
    return jsonify({'groups': out, 'total': sum(g['count'] for g in out)})


@bp.route('/random')
def random_problem():
    conn = _db()
    if conn is None:
        return _unavailable()
    where, params, _ = _where(request.args)
    row = conn.execute(
        f'SELECT * FROM problems p{where} ORDER BY RANDOM() LIMIT 1',
        params).fetchone()
    if row is None:
        return jsonify({'error': 'No matching problem'}), 404
    return jsonify(_full(conn, row))


@bp.route('/daily')
def daily_problem():
    conn = _db()
    if conn is None:
        return _unavailable()
    d = request.args.get('date') or date.today().isoformat()
    # Deterministic per-day pick among solved, non-elite problems.
    seed = sum(ord(c) for c in d) * 2654435761 % (2 ** 32)
    pool = conn.execute(
        "SELECT COUNT(*) n FROM problems WHERE has_solution = 1").fetchone()['n']
    if not pool:
        return jsonify({'error': 'empty'}), 404
    idx = seed % pool
    row = conn.execute(
        "SELECT * FROM problems WHERE has_solution = 1 "
        "ORDER BY id LIMIT 1 OFFSET ?", (idx,)).fetchone()
    out = _full(conn, row)
    out['date'] = d
    return jsonify(out)


@bp.route('/stats')
def stats():
    conn = _db()
    if conn is None:
        return _unavailable()

    def rows(sql):
        return [dict(r) for r in conn.execute(sql).fetchall()]

    return jsonify({
        'total': conn.execute('SELECT COUNT(*) n FROM problems').fetchone()['n'],
        'byCountry': rows("SELECT country_zh label, COUNT(*) count FROM problems "
                          "GROUP BY config ORDER BY count DESC"),
        'byTopic': rows("SELECT l1_zh label, COUNT(DISTINCT problem_id) count "
                        "FROM problem_categories WHERE l1_zh IS NOT NULL "
                        "GROUP BY l1_zh ORDER BY count DESC"),
        'byDifficulty': rows("SELECT difficulty_zh label, COUNT(*) count FROM problems "
                             "WHERE difficulty IS NOT NULL GROUP BY difficulty"),
        'byType': rows("SELECT problem_type_zh label, COUNT(*) count FROM problems "
                       "GROUP BY problem_type ORDER BY count DESC"),
        'withSolution': conn.execute(
            "SELECT COUNT(*) n FROM problems WHERE has_solution = 1").fetchone()['n'],
        'withImages': conn.execute(
            "SELECT COUNT(*) n FROM problems WHERE has_images = 1").fetchone()['n'],
        'yearKnown': conn.execute(
            "SELECT COUNT(*) n FROM problems WHERE year IS NOT NULL").fetchone()['n'],
    })


@bp.route('/<path:problem_id>')
def get_problem(problem_id):
    conn = _db()
    if conn is None:
        return _unavailable()
    row = conn.execute(
        'SELECT * FROM problems p WHERE id = ?', (problem_id,)).fetchone()
    if row is None:
        return jsonify({'error': 'Problem not found'}), 404
    return jsonify(_full(conn, row))

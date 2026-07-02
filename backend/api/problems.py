"""
奥赛习题集 — problem-bank API v2, backed by the prebuilt SQLite DB (schema v2).

The DB (``backend/data/problems.db``) is a read-only build artifact produced by
``backend/scripts/build_problems.py``: all 18 MathNet configs (~11.4k problems)
with canonical competition normalization (``competitions`` table), Chinese
translations (``problem_zh``/``solution_zh``, incrementally filled), build-time
plain-text previews, and a weighted-interleave ``browse_rank`` default order so
no mega-competition (HMMT) floods the first pages.

Endpoints (all under ``/api/problems``):
  * ``GET  /registry``            regions -> competitions browse tree (+counts)
  * ``GET  /facets``              filter options (+counts) for the search page
  * ``GET  /competitions/<key>``  one competition's year x round matrix
  * ``GET  /``                    filtered/searched/sorted/paginated light rows
  * ``GET  /ids``                 ordered id list for practice sessions (<=500)
  * ``GET  /random``              seeded deterministic shuffle -> id list
  * ``GET  /daily``               deterministic problem-of-the-day (non-elite)
  * ``GET  /stats``               dashboard aggregates
  * ``POST /batch``               light rows for an id list (favorites)
  * ``GET  /<id>``                full problem (statement + solutions, EN+ZH)
  * ``GET  /<id>/context``        prev/next within the caller's filter set

Trigram FTS matches substrings of length >= 3 (works for CJK); shorter queries
fall back to LIKE over statement-level text. Solution bodies are not in the
FTS index — ``qscope=all`` opts into a slower LIKE scan over solutions.
"""
import functools
import json
import os
import random as _random
import re
import sqlite3

from datetime import date

from flask import Blueprint, g, jsonify, request

from api import DATA_DIR

bp = Blueprint('problems', __name__, url_prefix='/api/problems')

_DB_PATH = os.path.join(DATA_DIR, 'problems.db')

_DIFF_ORDER = {'easy': 1, 'medium': 2, 'hard': 3, 'elite': 4}

# bm25 column weights: problem_md, problem_zh, comp_text, cat_text
_BM25 = 'bm25(problems_fts, 4.0, 8.0, 6.0, 2.0)'


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
# Competition registry cache (DB is immutable per deployment).
# --------------------------------------------------------------------------- #
@functools.lru_cache(maxsize=1)
def _comps():
    """{comp_key: {name_zh, name_en, short, region, region_zh, tier,
                   sort_rank, rounds: [..], round_zh: {round_key: zh}}}"""
    conn = sqlite3.connect(f'file:{_DB_PATH}?mode=ro', uri=True,
                           check_same_thread=False)
    conn.row_factory = sqlite3.Row
    try:
        out = {}
        for r in conn.execute('SELECT * FROM competitions'):
            d = dict(r)
            rounds = json.loads(d.pop('rounds_json') or '[]')
            d['rounds'] = rounds
            d['round_zh'] = {x['round_key']: x['zh'] for x in rounds}
            out[d['comp_key']] = d
        return out
    finally:
        conn.close()


# --------------------------------------------------------------------------- #
# Filter / search WHERE-clause builder (shared by list/ids/random/context).
# --------------------------------------------------------------------------- #
_FTS_STRIP = re.compile(r'["()*]')


def _where(args, skip=()):
    """Build (sql_fragment, params, fts_match, q) from query args."""
    clauses, params = [], []

    def eq(arg, col, cast=None):
        v = args.get(arg)
        if v and arg not in skip:
            if cast:
                try:
                    v = cast(v)
                except (TypeError, ValueError):
                    return
            clauses.append(f'{col} = ?')
            params.append(v)

    eq('comp', 'p.comp_key')
    eq('round', 'p.round_key')
    eq('config', 'p.config')
    eq('difficulty', 'p.difficulty')
    eq('problem_type', 'p.problem_type')

    region = args.get('region')
    if region and 'region' not in skip:
        clauses.append(
            'p.comp_key IN (SELECT comp_key FROM competitions WHERE region = ?)')
        params.append(region)

    tier_max = args.get('tier_max')
    if tier_max:
        try:
            clauses.append('p.tier <= ?')
            params.append(int(tier_max))
        except (TypeError, ValueError):
            params and params.pop()

    year = args.get('year')
    if year == 'unknown':
        clauses.append('p.year IS NULL')
    elif year:
        try:
            params.append(int(year))
            clauses.append('p.year = ?')
        except (TypeError, ValueError):
            pass
    for arg, op in (('year_from', '>='), ('year_to', '<=')):
        v = args.get(arg)
        if v:
            try:
                params.append(int(v))
                clauses.append(f'p.year {op} ?')
            except (TypeError, ValueError):
                pass

    if args.get('has_solution') == '1':
        clauses.append('p.has_solution = 1')
    if args.get('has_images') == '1':
        clauses.append('p.has_images = 1')
    if args.get('translated') == '1':
        clauses.append('p.problem_zh IS NOT NULL')

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
    if q and 'q' not in skip:
        sol_scan = args.get('qscope') == 'all'
        like = f'%{q}%'
        if len(q) >= 3:
            cleaned = _FTS_STRIP.sub(' ', q).strip()
            if cleaned:
                fts_match = '"' + cleaned.replace('"', '') + '"'
                fts_clause = ('p.rowid IN (SELECT rowid FROM problems_fts '
                              'WHERE problems_fts MATCH ?)')
                if sol_scan:
                    clauses.append(
                        f'({fts_clause} OR EXISTS (SELECT 1 FROM solutions s '
                        'WHERE s.problem_id = p.id AND (s.solution_md LIKE ? '
                        'OR s.solution_zh LIKE ?)))')
                    params.extend([fts_match, like, like])
                else:
                    clauses.append(fts_clause)
                    params.append(fts_match)
        else:
            base = ('p.problem_md LIKE ? OR p.problem_zh LIKE ? '
                    'OR p.competition_raw LIKE ? OR p.categories_json LIKE ?')
            base_params = [like, like, like, like]
            if sol_scan:
                base += (' OR EXISTS (SELECT 1 FROM solutions s WHERE '
                         's.problem_id = p.id AND (s.solution_md LIKE ? '
                         'OR s.solution_zh LIKE ?))')
                base_params += [like, like]
            clauses.append(f'({base})')
            params.extend(base_params)

    where = (' WHERE ' + ' AND '.join(clauses)) if clauses else ''
    return where, params, fts_match, q


_SORTS = {
    'default': 'p.browse_rank',
    'year_desc': 'p.year IS NULL, p.year DESC, p.browse_rank',
    'year_asc': 'p.year IS NULL, p.year ASC, p.browse_rank',
    'difficulty_asc': 'p.difficulty_score IS NULL, p.difficulty_score ASC, p.browse_rank',
    'difficulty_desc': 'p.difficulty_score IS NULL, p.difficulty_score DESC, p.browse_rank',
    'id': 'p.id',
}


def _order_clause(args, fts_match):
    """Return (order_sql, order_params). Relevance only makes sense with FTS."""
    sort = args.get('sort') or ('relevance' if fts_match else 'default')
    if sort == 'relevance' and fts_match:
        return (f'(SELECT {_BM25} FROM problems_fts '
                'WHERE problems_fts.rowid = p.rowid AND problems_fts MATCH ?), '
                'p.browse_rank', [fts_match])
    return _SORTS.get(sort, _SORTS['default']), []


# --------------------------------------------------------------------------- #
# Row projection helpers.
# --------------------------------------------------------------------------- #
def _light(row, q=None):
    d = dict(row)
    comp = _comps().get(d['comp_key'], {})
    out = {
        'id': d['id'],
        'comp_key': d['comp_key'],
        'comp_zh': comp.get('name_zh', d['comp_key']),
        'comp_short': comp.get('short'),
        'round_key': d['round_key'],
        'round_zh': comp.get('round_zh', {}).get(d['round_key']),
        'region': comp.get('region'),
        'tier': d['tier'],
        'country_zh': d['country_zh'],
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
        'num_solutions': d['num_solutions'],
        'has_images': d['has_images'],
        'has_zh': 1 if d['problem_zh'] else 0,
        'translated': d['translated'],
        'preview_en': d['preview_en'],
        'preview_zh': d['preview_zh'],
    }
    if q:
        out['snippet'], out['hit_lang'] = _snippet(d, q)
    return out


def _snippet(d, q, radius=60):
    """Naive highlight window around the first case-insensitive hit."""
    for lang, text in (('zh', d.get('problem_zh')), ('en', d.get('problem_md'))):
        if not text:
            continue
        idx = text.lower().find(q.lower())
        if idx >= 0:
            start = max(0, idx - radius)
            end = min(len(text), idx + len(q) + radius)
            frag = re.sub(r'\s+', ' ', text[start:end]).strip()
            return (('…' if start > 0 else '') + frag
                    + ('…' if end < len(text) else '')), lang
    return None, None


def _headline(d):
    comp = _comps().get(d['comp_key'], {})
    bits = [comp.get('short') or comp.get('name_zh', d['comp_key'])]
    if d['year']:
        bits.append(str(d['year']))
    rz = comp.get('round_zh', {}).get(d['round_key'])
    if rz:
        bits.append(rz)
    if d['problem_number']:
        bits.append(f'第{d["problem_number"]}题')
    return ' · '.join(bits)


def _full(conn, row):
    item = _light(row)
    d = dict(row)
    sols = conn.execute(
        'SELECT solution_md, solution_zh FROM solutions '
        'WHERE problem_id = ? ORDER BY idx', (d['id'],)).fetchall()
    item.update({
        'problem_md': d['problem_md'],
        'problem_zh': d['problem_zh'],
        'final_answer': d['final_answer'],
        'language': d['language'],
        'num_images': d['num_images'],
        'rationale_zh': d['rationale_zh'],
        'competition_raw': d['competition_raw'],
        'solutions': [{'md': s['solution_md'], 'zh': s['solution_zh']}
                      for s in sols],
    })
    return item


# --------------------------------------------------------------------------- #
# Browse tree + filter facets.
# --------------------------------------------------------------------------- #
@functools.lru_cache(maxsize=1)
def _registry_payload():
    conn = sqlite3.connect(f'file:{_DB_PATH}?mode=ro', uri=True,
                           check_same_thread=False)
    conn.row_factory = sqlite3.Row
    try:
        total = conn.execute('SELECT COUNT(*) n FROM problems').fetchone()['n']
        tr = conn.execute(
            'SELECT SUM(problem_zh IS NOT NULL) p, SUM(translated) t '
            'FROM problems').fetchone()
        stats = {}
        for r in conn.execute(
                """SELECT comp_key, COUNT(*) n, MIN(year) ymin, MAX(year) ymax,
                          SUM(year IS NOT NULL) yk,
                          COUNT(DISTINCT year) editions,
                          SUM(difficulty='easy') easy,
                          SUM(difficulty='medium') medium,
                          SUM(difficulty='hard') hard,
                          SUM(difficulty='elite') elite
                   FROM problems GROUP BY comp_key"""):
            stats[r['comp_key']] = dict(r)
        rstats = {}
        for r in conn.execute(
                """SELECT round_key, comp_key, COUNT(*) n FROM problems
                   WHERE round_key IS NOT NULL GROUP BY comp_key, round_key"""):
            rstats[(r['comp_key'], r['round_key'])] = r['n']

        region_meta = {
            'china': ('中国', 1), 'intl': ('国际赛事', 2), 'na': ('北美', 3),
            'asia': ('亚洲', 4), 'europe': ('欧洲', 5),
        }
        regions = {}
        for ck, comp in _comps().items():
            st = stats.get(ck)
            if not st:
                continue
            zh, order = region_meta.get(comp['region'],
                                        (comp['region_zh'], 9))
            reg = regions.setdefault(comp['region'], {
                'key': comp['region'], 'zh': zh, 'order': order,
                'count': 0, 'competitions': [],
            })
            reg['count'] += st['n']
            reg['competitions'].append({
                'comp_key': ck,
                'name_zh': comp['name_zh'],
                'name_en': comp['name_en'],
                'short': comp['short'],
                'tier': comp['tier'],
                'sort_rank': comp['sort_rank'],
                'count': st['n'],
                'editions': st['editions'],
                'year_min': st['ymin'],
                'year_max': st['ymax'],
                'years_known': st['yk'],
                'diff': {k: st[k] or 0
                         for k in ('easy', 'medium', 'hard', 'elite')},
                'rounds': [
                    {'round_key': x['round_key'], 'zh': x['zh'],
                     'count': rstats.get((ck, x['round_key']), 0)}
                    for x in comp['rounds']],
            })
        out_regions = sorted(regions.values(), key=lambda r: r['order'])
        for reg in out_regions:
            reg['competitions'].sort(
                key=lambda c: (c['tier'], c['sort_rank'], -c['count']))
        return {
            'total': total,
            'translated': {'problems': tr['p'] or 0, 'full': tr['t'] or 0},
            'regions': out_regions,
        }
    finally:
        conn.close()


@bp.route('/registry')
def registry():
    if not os.path.exists(_DB_PATH):
        return _unavailable()
    resp = jsonify(_registry_payload())
    resp.headers['Cache-Control'] = 'no-cache'
    return resp


@functools.lru_cache(maxsize=1)
def _facets_payload():
    conn = sqlite3.connect(f'file:{_DB_PATH}?mode=ro', uri=True,
                           check_same_thread=False)
    conn.row_factory = sqlite3.Row
    try:
        def rows(sql):
            return [dict(r) for r in conn.execute(sql).fetchall()]

        total = conn.execute('SELECT COUNT(*) n FROM problems').fetchone()['n']
        comps = _comps()
        competitions = [
            {'comp_key': r['comp_key'],
             'name_zh': comps.get(r['comp_key'], {}).get('name_zh', r['comp_key']),
             'region': comps.get(r['comp_key'], {}).get('region'),
             'tier': comps.get(r['comp_key'], {}).get('tier'),
             'count': r['n']}
            for r in rows('SELECT comp_key, COUNT(*) n FROM problems '
                          'GROUP BY comp_key ORDER BY n DESC')]
        years = [r['year'] for r in rows(
            'SELECT DISTINCT year FROM problems WHERE year IS NOT NULL '
            'ORDER BY year DESC')]
        year_unknown = conn.execute(
            'SELECT COUNT(*) n FROM problems WHERE year IS NULL').fetchone()['n']
        level1 = [{'value': r['l1_zh'], 'count': r['n']} for r in rows(
            'SELECT l1_zh, COUNT(DISTINCT problem_id) n FROM problem_categories '
            'WHERE l1_zh IS NOT NULL GROUP BY l1_zh ORDER BY n DESC')]
        level2 = [{'value': r['l2_zh'], 'l1': r['l1_zh'], 'count': r['n']}
                  for r in rows(
            'SELECT l2_zh, l1_zh, COUNT(DISTINCT problem_id) n '
            'FROM problem_categories WHERE l2_zh IS NOT NULL '
            'GROUP BY l2_zh, l1_zh ORDER BY n DESC')]
        level3 = [{'value': r['l3'], 'l1': r['l1_zh'], 'l2': r['l2_zh'],
                   'count': r['n']} for r in rows(
            'SELECT l3, l1_zh, l2_zh, COUNT(DISTINCT problem_id) n '
            'FROM problem_categories WHERE l3 IS NOT NULL '
            'GROUP BY l3, l1_zh, l2_zh ORDER BY n DESC')]
        level4 = [{'value': r['l4'], 'l1': r['l1_zh'], 'l2': r['l2_zh'],
                   'count': r['n']} for r in rows(
            'SELECT l4, l1_zh, l2_zh, COUNT(DISTINCT problem_id) n '
            'FROM problem_categories WHERE l4 IS NOT NULL '
            'GROUP BY l4, l1_zh, l2_zh ORDER BY n DESC')]
        difficulties = [
            {'value': r['difficulty'], 'label': r['difficulty_zh'], 'count': r['n']}
            for r in rows('SELECT difficulty, difficulty_zh, COUNT(*) n '
                          'FROM problems WHERE difficulty IS NOT NULL '
                          'GROUP BY difficulty')]
        difficulties.sort(key=lambda d: _DIFF_ORDER.get(d['value'], 9))
        problem_types = [
            {'value': r['problem_type'], 'label': r['problem_type_zh'],
             'count': r['n']}
            for r in rows('SELECT problem_type, problem_type_zh, COUNT(*) n '
                          'FROM problems WHERE problem_type IS NOT NULL '
                          'GROUP BY problem_type ORDER BY n DESC')]
        regions = [
            {'value': r['region'], 'label': r['region_zh'], 'count': r['n']}
            for r in rows(
                'SELECT c.region region, c.region_zh region_zh, COUNT(*) n '
                'FROM problems p JOIN competitions c ON c.comp_key = p.comp_key '
                'GROUP BY c.region ORDER BY n DESC')]
        return {
            'total': total, 'regions': regions, 'competitions': competitions,
            'years': years, 'yearUnknown': year_unknown,
            'level1': level1, 'level2': level2, 'level3': level3,
            'level4': level4, 'difficulties': difficulties,
            'problemTypes': problem_types,
        }
    finally:
        conn.close()


@bp.route('/facets')
def facets():
    if not os.path.exists(_DB_PATH):
        return _unavailable()
    resp = jsonify(_facets_payload())
    resp.headers['Cache-Control'] = 'no-cache'
    return resp


@bp.route('/competitions/<comp_key>')
def competition_matrix(comp_key):
    """One competition's year x round matrix (browse level three)."""
    conn = _db()
    if conn is None:
        return _unavailable()
    comp = _comps().get(comp_key)
    if comp is None:
        return jsonify({'error': 'Competition not found'}), 404
    rows = conn.execute(
        """SELECT year, round_key, COUNT(*) n FROM problems
           WHERE comp_key = ? GROUP BY year, round_key
           ORDER BY year IS NULL, year DESC""", (comp_key,)).fetchall()
    by_year = {}
    unknown = 0
    for r in rows:
        if r['year'] is None:
            unknown += r['n']
            continue
        y = by_year.setdefault(r['year'], {'year': r['year'], 'count': 0,
                                           'rounds': []})
        y['count'] += r['n']
        if r['round_key']:
            y['rounds'].append({'round_key': r['round_key'],
                                'zh': comp['round_zh'].get(r['round_key'],
                                                           r['round_key']),
                                'count': r['n']})
    total = conn.execute('SELECT COUNT(*) n FROM problems WHERE comp_key = ?',
                         (comp_key,)).fetchone()['n']
    return jsonify({
        'comp': {
            'comp_key': comp_key, 'name_zh': comp['name_zh'],
            'name_en': comp['name_en'], 'short': comp['short'],
            'region': comp['region'], 'region_zh': comp['region_zh'],
            'tier': comp['tier'], 'rounds': comp['rounds'], 'count': total,
        },
        'by_year': sorted(by_year.values(), key=lambda y: -y['year']),
        'unknown_year_count': unknown,
    })


# --------------------------------------------------------------------------- #
# List / ids / random / batch.
# --------------------------------------------------------------------------- #
@bp.route('')
@bp.route('/')
def list_problems():
    conn = _db()
    if conn is None:
        return _unavailable()
    args = request.args
    where, params, fts_match, q = _where(args)

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

    order, order_params = _order_clause(args, fts_match)
    offset = (page - 1) * page_size
    rows = conn.execute(
        f'SELECT * FROM problems p{where} ORDER BY {order} LIMIT ? OFFSET ?',
        params + order_params + [page_size, offset]).fetchall()

    return jsonify({
        'items': [_light(r, q=q or None) for r in rows],
        'total': total, 'page': page, 'pages': pages, 'pageSize': page_size,
    })


@bp.route('/ids')
def id_list():
    """Ordered id list for practice sessions."""
    conn = _db()
    if conn is None:
        return _unavailable()
    args = request.args
    where, params, fts_match, _q = _where(args)
    try:
        limit = min(max(1, int(args.get('limit', 500))), 500)
    except (TypeError, ValueError):
        limit = 500
    total = conn.execute(
        f'SELECT COUNT(*) n FROM problems p{where}', params).fetchone()['n']
    order, order_params = _order_clause(args, fts_match)
    rows = conn.execute(
        f'SELECT p.id FROM problems p{where} ORDER BY {order} LIMIT ?',
        params + order_params + [limit]).fetchall()
    return jsonify({'ids': [r['id'] for r in rows], 'total': total})


@bp.route('/random')
def random_ids():
    """Deterministic seeded shuffle: same seed + same filters => same order.

    Returns {seed, ids, total}. The client hydrates via /batch or /<id>.
    """
    conn = _db()
    if conn is None:
        return _unavailable()
    args = request.args
    where, params, _fts, _q = _where(args)
    try:
        seed = int(args.get('seed', 0))
    except (TypeError, ValueError):
        seed = 0
    try:
        count = min(max(1, int(args.get('count', 1))), 500)
    except (TypeError, ValueError):
        count = 1
    rows = conn.execute(
        f'SELECT p.id FROM problems p{where} ORDER BY p.id', params).fetchall()
    ids = [r['id'] for r in rows]
    if not ids:
        return jsonify({'error': 'No matching problem'}), 404
    _random.Random(seed).shuffle(ids)
    return jsonify({'seed': seed, 'ids': ids[:count], 'total': len(ids)})


@bp.route('/batch', methods=['POST'])
def batch():
    """Light rows for an explicit id list (favorites / review sets).

    Preserves input order; unknown ids are reported in `missing`.
    """
    conn = _db()
    if conn is None:
        return _unavailable()
    body = request.get_json(silent=True) or {}
    ids = body.get('ids')
    if not isinstance(ids, list) or not ids:
        return jsonify({'error': 'ids: non-empty list required'}), 400
    ids = [str(i) for i in ids[:200]]
    marks = ','.join('?' * len(ids))
    rows = conn.execute(
        f'SELECT * FROM problems p WHERE id IN ({marks})', ids).fetchall()
    by_id = {r['id']: r for r in rows}
    items = [_light(by_id[i]) for i in ids if i in by_id]
    missing = [i for i in ids if i not in by_id]
    return jsonify({'items': items, 'missing': missing})


# --------------------------------------------------------------------------- #
# Daily / stats.
# --------------------------------------------------------------------------- #
_DAILY_POOL = ("has_solution = 1 AND difficulty IS NOT NULL "
               "AND difficulty <> 'elite' AND tier <= 3")


@bp.route('/daily')
def daily_problem():
    conn = _db()
    if conn is None:
        return _unavailable()
    d = request.args.get('date') or date.today().isoformat()
    # Deterministic per-day pick among solved, non-elite, tier<=3 problems.
    seed = sum(ord(c) for c in d) * 2654435761 % (2 ** 32)
    pool = conn.execute(
        f'SELECT COUNT(*) n FROM problems WHERE {_DAILY_POOL}').fetchone()['n']
    if not pool:
        return jsonify({'error': 'empty'}), 404
    idx = seed % pool
    row = conn.execute(
        f'SELECT * FROM problems WHERE {_DAILY_POOL} '
        'ORDER BY id LIMIT 1 OFFSET ?', (idx,)).fetchone()
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

    total = conn.execute('SELECT COUNT(*) n FROM problems').fetchone()['n']
    translated = conn.execute(
        'SELECT COUNT(*) n FROM problems WHERE problem_zh IS NOT NULL'
    ).fetchone()['n']
    return jsonify({
        'total': total,
        'byRegion': rows(
            'SELECT c.region_zh label, COUNT(*) count FROM problems p '
            'JOIN competitions c ON c.comp_key = p.comp_key '
            'GROUP BY c.region ORDER BY count DESC'),
        'byTier': rows('SELECT tier label, COUNT(*) count FROM problems '
                       'GROUP BY tier ORDER BY tier'),
        'byComp': rows(
            'SELECT c.name_zh label, COUNT(*) count FROM problems p '
            'JOIN competitions c ON c.comp_key = p.comp_key '
            'GROUP BY p.comp_key ORDER BY count DESC LIMIT 12'),
        'byTopic': rows(
            'SELECT l1_zh label, COUNT(DISTINCT problem_id) count '
            'FROM problem_categories WHERE l1_zh IS NOT NULL '
            'GROUP BY l1_zh ORDER BY count DESC'),
        'byDifficulty': rows(
            'SELECT difficulty_zh label, COUNT(*) count FROM problems '
            'WHERE difficulty IS NOT NULL GROUP BY difficulty'),
        'byType': rows(
            'SELECT problem_type_zh label, COUNT(*) count FROM problems '
            'GROUP BY problem_type ORDER BY count DESC'),
        'withSolution': conn.execute(
            'SELECT COUNT(*) n FROM problems WHERE has_solution = 1'
        ).fetchone()['n'],
        'withImages': conn.execute(
            'SELECT COUNT(*) n FROM problems WHERE has_images = 1'
        ).fetchone()['n'],
        'yearKnown': conn.execute(
            'SELECT COUNT(*) n FROM problems WHERE year IS NOT NULL'
        ).fetchone()['n'],
        'translatedPct': round(100 * translated / total, 1) if total else 0,
    })


# --------------------------------------------------------------------------- #
# Detail + context (prev/next within the caller's filter set).
# --------------------------------------------------------------------------- #
@bp.route('/<problem_id>/context')
def context(problem_id):
    conn = _db()
    if conn is None:
        return _unavailable()
    args = request.args
    where, params, fts_match, _q = _where(args)
    order, order_params = _order_clause(args, fts_match)

    sql = (f'WITH ordered AS (SELECT p.id, ROW_NUMBER() OVER '
           f'(ORDER BY {order}) rn FROM problems p{where}) ')
    row = conn.execute(sql + 'SELECT rn FROM ordered WHERE id = ?',
                       params + order_params + [problem_id]).fetchone()
    if row is None:
        return jsonify({'index': None, 'total': None,
                        'prev': None, 'next': None})
    rn = row['rn']
    total = conn.execute(
        f'SELECT COUNT(*) n FROM problems p{where}', params).fetchone()['n']
    neighbors = conn.execute(
        sql + 'SELECT o.rn, p.* FROM ordered o JOIN problems p ON p.id = o.id '
        'WHERE o.rn IN (?, ?)',
        params + order_params + [rn - 1, rn + 1]).fetchall()
    prev = nxt = None
    for r in neighbors:
        d = dict(r)
        item = {'id': d['id'], 'headline': _headline(d)}
        if d['rn'] == rn - 1:
            prev = item
        elif d['rn'] == rn + 1:
            nxt = item
    return jsonify({'index': rn, 'total': total, 'prev': prev, 'next': nxt})


@bp.route('/<problem_id>')
def get_problem(problem_id):
    conn = _db()
    if conn is None:
        return _unavailable()
    row = conn.execute(
        'SELECT * FROM problems p WHERE id = ?', (problem_id,)).fetchone()
    if row is None:
        return jsonify({'error': 'Problem not found'}), 404
    return jsonify(_full(conn, row))

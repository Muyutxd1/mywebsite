"""
Problem-set blueprint — MathNet Olympiad problem browser (performance-critical).

Data lives under ``data/problems``:
  * ``_index.json`` — {total, competitions[], entries:[{id,title,competition,
    competition_zh,year,difficulty,difficulty_zh,topics[],language}]} (~2.4MB).
  * 18 sibling ``<Competition>.json`` files — each a JSON array of full problems
    that additionally carry ``problem_md`` / ``solution_md`` (up to ~8MB each).

Heavy work is done ONCE, lazily, then memoized:
  * the flat list of index entries;
  * a precomputed lowercased search haystack per entry;
  * an id -> competition-filename map (a problem's ``competition`` field is the
    file stem, exactly as the legacy ``_find_problem`` scan implies — e.g.
    ``IMO`` -> ``IMO.json``, ``United_States`` -> ``United_States.json``);
  * a per-file cache so an 8MB competition array is parsed at most once and an
    id -> full-problem dict cache for O(1) lookups.

We NEVER ship the whole index to the client: listing is server-side filtered,
searched and paginated. Field shapes are preserved verbatim from the legacy
``_legacy/routes/problems.py`` responses.
"""
import functools
import json
import os
import random

from flask import Blueprint, jsonify, request

from api import DATA_DIR

bp = Blueprint('problems', __name__, url_prefix='/api/problems')

_PROBLEMS_DIR = os.path.join(DATA_DIR, 'problems')

# Topic values that are noise and must never surface in the facet dropdown.
_DROP_TOPICS = {'未分类', ''}


# --------------------------------------------------------------------------- #
# Index loading + precomputation (done once, memoized).
# --------------------------------------------------------------------------- #
@functools.lru_cache(maxsize=1)
def _index():
    """Load ``_index.json`` once and precompute search/lookup structures.

    Returns a dict with:
      * ``meta``      — top-level {total, competitions} from the file.
      * ``entries``   — the raw list of lightweight index entries.
      * ``haystacks`` — list (parallel to ``entries``) of lowercased search
        strings: title + competition + competition_zh + topics, space-joined.
      * ``id_to_file`` — id -> ``<competition>.json`` filename.
    """
    path = os.path.join(_PROBLEMS_DIR, '_index.json')
    if not os.path.exists(path):
        return {'meta': {'total': 0, 'competitions': []}, 'entries': [],
                'haystacks': [], 'id_to_file': {}}

    with open(path, encoding='utf-8') as f:
        data = json.load(f)

    entries = data.get('entries', [])
    haystacks = []
    id_to_file = {}
    for e in entries:
        parts = [e.get('title', ''), e.get('competition', ''),
                 e.get('competition_zh', '')]
        parts.extend(e.get('topics', []) or [])
        haystacks.append(' '.join(p for p in parts if p).lower())

        comp = e.get('competition', '')
        eid = e.get('id', '')
        if eid and comp:
            id_to_file[eid] = comp + '.json'

    return {
        'meta': {
            'total': data.get('total', len(entries)),
            'competitions': data.get('competitions', []),
        },
        'entries': entries,
        'haystacks': haystacks,
        'id_to_file': id_to_file,
    }


@functools.lru_cache(maxsize=None)
def _load_competition(filename):
    """Parse one ``<Competition>.json`` array, memoized per filename.

    The big (up to 8MB) competition files are read at most once each. Returns a
    list of full-problem dicts; an empty list if the file is missing/corrupt.
    """
    # Guard against path traversal: only sibling JSON files are loadable.
    if not filename.endswith('.json') or '/' in filename or '\\' in filename:
        return []
    path = os.path.join(_PROBLEMS_DIR, filename)
    if not os.path.exists(path):
        return []
    try:
        with open(path, encoding='utf-8') as f:
            return json.load(f)
    except (json.JSONDecodeError, OSError):
        return []


@functools.lru_cache(maxsize=None)
def _problem_index_for(filename):
    """id -> full-problem dict for one competition file (memoized)."""
    return {p.get('id', ''): p for p in _load_competition(filename)}


def _find_problem(problem_id):
    """Return the full problem dict for ``problem_id`` or None.

    Uses the id -> file map so only the single relevant competition file is
    parsed (then cached), instead of the legacy linear scan of all 18 files.
    """
    idx = _index()
    filename = idx['id_to_file'].get(problem_id)
    if not filename:
        return None
    return _problem_index_for(filename).get(problem_id)


def _full_problem_payload(p):
    """Project a full problem into the legacy response shape (verbatim fields)."""
    return {
        'id': p.get('id', ''),
        'title': p.get('title', ''),
        'competition': p.get('competition', ''),
        'competition_zh': p.get('competition_zh', ''),
        'year': p.get('year', 0),
        'difficulty': p.get('difficulty', 'medium'),
        'difficulty_zh': p.get('difficulty_zh', '中'),
        'topics': p.get('topics', []),
        'language': p.get('language', 'en'),
        'problem_md': p.get('problem_md', ''),
        'solution_md': p.get('solution_md', ''),
    }


# --------------------------------------------------------------------------- #
# Filtering helpers.
# --------------------------------------------------------------------------- #
def _matching_positions(competition, topic, year, q):
    """Yield indices of entries matching the active filters + substring search.

    Mirrors the legacy client-side filter: exact competition, exact topic
    membership (``topics.includes(topic)``), exact year, and a lowercased
    substring search of ``q`` over the precomputed haystack.
    """
    idx = _index()
    entries = idx['entries']
    haystacks = idx['haystacks']
    q = (q or '').strip().lower()

    year_int = None
    if year:
        try:
            year_int = int(year)
        except (TypeError, ValueError):
            year_int = None

    for i, e in enumerate(entries):
        if competition and e.get('competition') != competition:
            continue
        if topic and topic not in (e.get('topics') or []):
            continue
        if year_int is not None and e.get('year') != year_int:
            continue
        if q and q not in haystacks[i]:
            continue
        yield i


# --------------------------------------------------------------------------- #
# Endpoints.
# --------------------------------------------------------------------------- #
@bp.route('/facets')
def facets():
    """Dropdown facets: {total, competitions:[{value,label}], topics[], years[]}.

    * ``competitions`` — ordered by descending entry count (legacy ordering),
      each {value: raw competition key, label: competition_zh or de-underscored}.
    * ``topics`` — sorted, with '未分类'/empty dropped and duplicates merged.
    * ``years`` — distinct positive years, descending.
    """
    idx = _index()
    entries = idx['entries']

    comp_counts = {}
    comp_label = {}
    topics = set()
    years = set()
    for e in entries:
        comp = e.get('competition')
        if comp:
            comp_counts[comp] = comp_counts.get(comp, 0) + 1
            if comp not in comp_label:
                comp_label[comp] = e.get('competition_zh') or comp.replace('_', ' ')
        for t in (e.get('topics') or []):
            if t not in _DROP_TOPICS:
                topics.add(t)
        yr = e.get('year', 0)
        if yr:
            years.add(yr)

    competitions = [
        {'value': c, 'label': comp_label[c]}
        for c in sorted(comp_counts, key=lambda c: -comp_counts[c])
    ]

    resp = jsonify({
        'total': idx['meta'].get('total', len(entries)),
        'competitions': competitions,
        'topics': sorted(topics),
        'years': sorted(years, reverse=True),
    })
    resp.headers['Cache-Control'] = 'public, max-age=86400'
    return resp


@bp.route('')
@bp.route('/')
def list_problems():
    """Filtered + searched + paginated listing of lightweight index entries.

    Query params: competition, topic, year, q, page (1-based), pageSize.
    Returns {items, total, page, pages, pageSize}; never the whole index.
    """
    args = request.args
    competition = args.get('competition', '')
    topic = args.get('topic', '')
    year = args.get('year', '')
    q = args.get('q', '')

    try:
        page = max(1, int(args.get('page', 1)))
    except (TypeError, ValueError):
        page = 1
    try:
        page_size = int(args.get('pageSize', 20))
    except (TypeError, ValueError):
        page_size = 20
    page_size = max(1, min(page_size, 100))

    entries = _index()['entries']
    positions = list(_matching_positions(competition, topic, year, q))

    total = len(positions)
    pages = (total + page_size - 1) // page_size if total else 0
    start = (page - 1) * page_size
    items = [entries[i] for i in positions[start:start + page_size]]

    return jsonify({
        'items': items,
        'total': total,
        'page': page,
        'pages': pages,
        'pageSize': page_size,
    })


@bp.route('/random')
def random_problem():
    """Return one full problem honoring the active filters, or 404 if none."""
    args = request.args
    positions = list(_matching_positions(
        args.get('competition', ''),
        args.get('topic', ''),
        args.get('year', ''),
        args.get('q', ''),
    ))
    if not positions:
        return jsonify({'error': 'No matching problem'}), 404

    entries = _index()['entries']
    chosen = random.choice(positions)
    problem_id = entries[chosen].get('id', '')
    p = _find_problem(problem_id)
    if p is None:
        return jsonify({'error': 'Problem not found'}), 404
    return jsonify(_full_problem_payload(p))


@bp.route('/<path:problem_id>')
def get_problem(problem_id):
    """Return the FULL problem (problem_md, solution_md, + index fields); 404."""
    p = _find_problem(problem_id)
    if p is None:
        return jsonify({'error': 'Problem not found'}), 404
    return jsonify(_full_problem_payload(p))

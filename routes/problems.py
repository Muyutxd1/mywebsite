"""
Problem set blueprint — MathNet Olympiad problem browser.
"""
import json
import os

from flask import Blueprint, render_template, jsonify, request

problems_bp = Blueprint('problems', __name__)
DATA_DIR = os.path.join(os.path.dirname(__file__), '..', 'static', 'data', 'problems')

# Lazy-loaded cache
_index_cache = None
_problem_cache = {}


def _load_index():
    global _index_cache
    if _index_cache is not None:
        return _index_cache
    index_path = os.path.join(DATA_DIR, '_index.json')
    if not os.path.exists(index_path):
        _index_cache = {"total": 0, "entries": []}
        return _index_cache
    with open(index_path, 'r', encoding='utf-8') as f:
        _index_cache = json.load(f)
    return _index_cache


def _find_problem(problem_id):
    """Find a single problem by ID across all competition files."""
    if problem_id in _problem_cache:
        return _problem_cache[problem_id]

    # Try each competition file
    for fname in os.listdir(DATA_DIR):
        if fname.startswith('_') or not fname.endswith('.json'):
            continue
        fpath = os.path.join(DATA_DIR, fname)
        try:
            with open(fpath, 'r', encoding='utf-8') as f:
                problems = json.load(f)
        except (json.JSONDecodeError, IOError):
            continue

        for p in problems:
            pid = p.get('id', '')
            if pid == problem_id:
                _problem_cache[problem_id] = p
                return p
    return None


@problems_bp.route('/')
def index():
    return render_template('problems.html')


@problems_bp.route('/api/index')
def api_index():
    """Return the lightweight index (metadata only) plus filter options."""
    data = _load_index()
    entries = data.get('entries', [])

    # Extract unique filter values
    competitions = sorted(set(
        e.get('competition', '') for e in entries if e.get('competition')
    ), key=lambda c: -sum(1 for e in entries if e.get('competition') == c))

    years = sorted(set(
        e.get('year', 0) for e in entries if e.get('year', 0) > 0
    ), reverse=True)

    all_topics = set()
    for e in entries:
        for t in e.get('topics', []):
            if t and t != '未分类':
                all_topics.add(t)
    topics = sorted(all_topics)

    return jsonify({
        'total': data.get('total', len(entries)),
        'competitions': competitions,
        'years': years,
        'topics': topics,
        'entries': entries,
    })


@problems_bp.route('/api/problem/<path:problem_id>')
def api_problem(problem_id):
    """Return full problem data (with solution) for a single problem."""
    p = _find_problem(problem_id)
    if p is None:
        return jsonify({'error': 'Problem not found'}), 404

    return jsonify({
        'id': p.get('id', ''),
        'title': p.get('title', ''),
        'competition': p.get('competition', ''),
        'year': p.get('year', 0),
        'difficulty': p.get('difficulty', 'medium'),
        'difficulty_zh': p.get('difficulty_zh', '中'),
        'topics': p.get('topics', []),
        'language': p.get('language', 'en'),
        'problem_md': p.get('problem_md', ''),
        'solution_md': p.get('solution_md', ''),
    })

"""
Knowledge base blueprint — combinatorics & number theory reference data.

Serves the JSON knowledge bases (title/description/chapters) from data/,
injecting a server-side subtitle string mirrored from the legacy templates.
"""
import json
import os
import functools

from flask import Blueprint, jsonify

from api import DATA_DIR

bp = Blueprint('knowledge', __name__, url_prefix='/api/knowledge')

# Subtitles copied verbatim from _legacy/routes/knowledge.py
SUBTITLES = {
    'combinatorics': '初等组合与竞赛组合定理总目录 · 100 条核心知识点',
    'number_theory': '268 条定理与方法 · 覆盖高中数竞数论全部内容',
}

# Frontend route uses a hyphen (/knowledge/number-theory); map it to the key.
ALIASES = {
    'number-theory': 'number_theory',
}


@functools.lru_cache(maxsize=None)
def _load_kb(kb):
    """Load and cache a knowledge-base JSON file by key."""
    path = os.path.join(DATA_DIR, kb + '.json')
    if not os.path.exists(path):
        return None
    with open(path, encoding='utf-8') as f:
        return json.load(f)


@bp.route('/<kb>')
def get_knowledge(kb):
    """Return a knowledge base: {kb, title, subtitle, description, chapters}."""
    kb = ALIASES.get(kb, kb)
    if kb not in SUBTITLES:
        return jsonify({'error': '未找到'}), 404

    data = _load_kb(kb)
    if data is None:
        return jsonify({'error': '未找到'}), 404

    payload = {
        'kb': kb,
        'title': data.get('title'),
        'subtitle': SUBTITLES[kb],
        'description': data.get('description'),
        'chapters': data.get('chapters', []),
    }
    resp = jsonify(payload)
    resp.headers['Cache-Control'] = 'public, max-age=86400'
    return resp

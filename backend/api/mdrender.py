"""Markdown share persistence API.

Stores raw markdown snippets as JSON files under ``data/shares/`` and serves
them back by id. File schema (kept compatible with the legacy implementation)::

    {"content": str, "created_at": isoformat str, "id": "<8 hex>"}
"""
import os
import re
import json
import secrets
from datetime import datetime

from flask import Blueprint, request, jsonify

from api import DATA_DIR

bp = Blueprint('mdrender', __name__, url_prefix='/api/mdrender')

SHARES_DIR = os.path.join(DATA_DIR, 'shares')

# Share ids are exactly 8 lowercase hex chars (secrets.token_hex(4)).
# Validate against this BEFORE any filesystem access to prevent path traversal.
_ID_RE = re.compile(r'^[0-9a-f]{8}$')


@bp.route('/share', methods=['POST'])
def create_share():
    """Persist raw markdown and return its share id / public url."""
    data = request.get_json(silent=True) or {}
    content = (data.get('content') or '').strip()
    if not content:
        return jsonify({'error': '内容为空'}), 400

    os.makedirs(SHARES_DIR, exist_ok=True)

    # Generate a fresh id, retrying on the (extremely unlikely) collision.
    share_id = secrets.token_hex(4)
    while os.path.exists(os.path.join(SHARES_DIR, f'{share_id}.json')):
        share_id = secrets.token_hex(4)

    created_at = datetime.now().isoformat()
    share_data = {'content': content, 'created_at': created_at, 'id': share_id}

    with open(os.path.join(SHARES_DIR, f'{share_id}.json'), 'w', encoding='utf-8') as f:
        json.dump(share_data, f, ensure_ascii=False)

    return jsonify({
        'share_id': share_id,
        'url': f'/share/{share_id}',
        'created_at': created_at,
    }), 201


@bp.route('/share/<share_id>', methods=['GET'])
def get_share(share_id):
    """Return a stored markdown share, or 404 if missing/invalid."""
    if not _ID_RE.match(share_id):
        return jsonify({'error': '分享不存在或已过期'}), 404

    share_file = os.path.join(SHARES_DIR, f'{share_id}.json')
    if not os.path.exists(share_file):
        return jsonify({'error': '分享不存在或已过期'}), 404

    with open(share_file, 'r', encoding='utf-8') as f:
        share_data = json.load(f)

    return jsonify({
        'id': share_data.get('id', share_id),
        'content': share_data.get('content', ''),
        'created_at': share_data.get('created_at', ''),
    })

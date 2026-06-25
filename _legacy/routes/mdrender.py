"""
Markdown + LaTeX live editor blueprint.
"""
import os
import json
import secrets
from datetime import datetime

from flask import Blueprint, render_template, request, jsonify

mdrender_bp = Blueprint('mdrender', __name__)
SHARES_DIR = os.path.join(os.path.dirname(__file__), '..', 'data', 'shares')


@mdrender_bp.route('/')
def index():
    return render_template('mdrender.html')


@mdrender_bp.route('/api/share', methods=['POST'])
def api_share():
    data = request.get_json(silent=True) or {}
    content = data.get('content', '').strip()
    if not content:
        return jsonify({'error': '内容为空'})

    share_id = secrets.token_hex(4)
    os.makedirs(SHARES_DIR, exist_ok=True)

    share_data = {
        'content': content,
        'created_at': datetime.now().isoformat(),
        'id': share_id,
    }

    with open(os.path.join(SHARES_DIR, f'{share_id}.json'), 'w', encoding='utf-8') as f:
        json.dump(share_data, f, ensure_ascii=False)

    return jsonify({'share_id': share_id, 'url': f'/mdrender/share/{share_id}'})


@mdrender_bp.route('/share/<share_id>')
def view_share(share_id):
    share_file = os.path.join(SHARES_DIR, f'{share_id}.json')
    if not os.path.exists(share_file):
        return render_template('mdrender_share.html', content='', error='分享不存在或已过期')

    with open(share_file, 'r', encoding='utf-8') as f:
        share_data = json.load(f)

    return render_template('mdrender_share.html',
                           content=share_data['content'],
                           share_id=share_id,
                           created_at=share_data.get('created_at', ''))

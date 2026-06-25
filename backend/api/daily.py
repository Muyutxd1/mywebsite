"""
Daily-quote blueprint — serves the 251-quote dataset (data/quotes.json).

Mirrors the legacy inline JS in _legacy/templates/daily.html:
  * the deterministic date-hash that picks "today's" quote, and
  * the source/author -> tag inference regex.
The dataset is static, so responses carry a long Cache-Control header and the
file is loaded once and memoized at module import.
"""
import datetime
import functools
import json
import os
import re

from flask import Blueprint, jsonify, request

from api import DATA_DIR

bp = Blueprint('daily', __name__, url_prefix='/api/daily')

# Tag-inference regexes, ported verbatim from _legacy/templates/daily.html.
_RE_TANGSONG = re.compile(r'李白|杜甫|苏轼|王维|李商隐|白居易|辛弃疾|李清照')
_RE_MODERN = re.compile(r'木心|徐志摩|三毛|海子|顾城|北岛|村上春树')
_RE_MOVIE = re.compile(r'《.*》.*电影|台词')
_RE_PHILO = re.compile(r'尼采|泰戈尔|毛姆|梵高')


def _infer_tag(quote):
    """Replicate the legacy tag inference from source/author fields."""
    author = quote.get('author') or ''
    source = quote.get('source') or ''
    if author and _RE_TANGSONG.search(author):
        return '唐诗宋词'
    if author and _RE_MODERN.search(author):
        return '现代文学'
    if source and _RE_MOVIE.search(source):
        return '电影台词'
    if author and _RE_PHILO.search(author):
        return '哲理名言'
    return '文艺语录'


@functools.lru_cache(maxsize=1)
def _load_quotes():
    """Load, normalize and memoize the quote list with stable ids + tags."""
    path = os.path.join(DATA_DIR, 'quotes.json')
    with open(path, encoding='utf-8') as f:
        raw = json.load(f)

    quotes = []
    for i, q in enumerate(raw):
        item = {'id': i, 'text': q.get('text', '')}
        # Keep optional fields only when present (handle missing gracefully).
        if q.get('source'):
            item['source'] = q['source']
        if q.get('author'):
            item['author'] = q['author']
        item['tag'] = _infer_tag(q)
        quotes.append(item)
    return quotes


def _hash_str(s):
    """Port of the legacy JS hashStr: 32-bit rolling hash, returns abs value.

    JS: h=0; for each char h=((h<<5)-h)+charCode; h|=0;  return Math.abs(h)
    The ``h |= 0`` coerces to a signed 32-bit int each iteration.
    """
    h = 0
    for ch in s:
        h = ((h << 5) - h) + ord(ch)
        # Coerce to signed 32-bit int (mimic JS `h |= 0`).
        h &= 0xFFFFFFFF
        if h >= 0x80000000:
            h -= 0x100000000
    return abs(h)


def _date_key(d):
    """Legacy dateKey: 'YYYY-M-D' with NON-zero-padded 1-based month/day."""
    return f'{d.year}-{d.month}-{d.day}'


@bp.route('/quotes')
def get_quotes():
    """Return the full quote list: {quotes:[{id,text,source?,author?,tag}], total}."""
    quotes = _load_quotes()
    resp = jsonify({'quotes': quotes, 'total': len(quotes)})
    resp.headers['Cache-Control'] = 'public, max-age=86400'
    return resp


@bp.route('/today')
def get_today():
    """Return today's deterministic quote: {date, index, quote, total}.

    Uses the same date-hash as the legacy JS so the pick is identical. An
    optional ?date=YYYY-MM-DD query param overrides the server date.
    """
    quotes = _load_quotes()
    total = len(quotes)

    date_param = request.args.get('date')
    if date_param:
        try:
            d = datetime.date.fromisoformat(date_param)
        except ValueError:
            return jsonify({'error': 'date 格式应为 YYYY-MM-DD'}), 400
    else:
        d = datetime.date.today()

    if total == 0:
        return jsonify({'error': '无数据'}), 404

    index = _hash_str(_date_key(d)) % total
    return jsonify({
        'date': d.isoformat(),
        'index': index,
        'quote': quotes[index],
        'total': total,
    })

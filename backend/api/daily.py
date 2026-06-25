"""
Daily-quote blueprint — serves the curated quote library (data/quotes.json).

Each record carries an explicit ``category`` (歌词/诗词/电影/文学/哲思/语录);
there is no more regex tag-inference. The dataset is static, so it is loaded
once (memoized) and ``/quotes`` carries a long Cache-Control header.
"""
import datetime
import functools
import json
import os

from flask import Blueprint, jsonify, request

from api import DATA_DIR

bp = Blueprint("daily", __name__, url_prefix="/api/daily")

DEFAULT_CATEGORY = "语录"


@functools.lru_cache(maxsize=1)
def _load():
    """Load + normalize the quote list with stable ids and a category."""
    with open(os.path.join(DATA_DIR, "quotes.json"), encoding="utf-8") as f:
        raw = json.load(f)
    out = []
    for i, q in enumerate(raw):
        item = {"id": i, "text": q.get("text", "")}
        if q.get("source"):
            item["source"] = q["source"]
        if q.get("author"):
            item["author"] = q["author"]
        item["category"] = q.get("category") or DEFAULT_CATEGORY
        out.append(item)
    return out


def _daily_index(quotes, date):
    """Deterministic 'quote of the day' — non-zero-padded 1-based dateKey +
    32-bit JS-style rolling hash (kept stable for day-to-day continuity)."""
    key = f"{date.year}-{date.month}-{date.day}"
    h = 0
    for ch in key:
        h = ((h << 5) - h) + ord(ch)
        h &= 0xFFFFFFFF
    if h & 0x80000000:
        h -= 0x100000000
    return abs(h) % len(quotes)


@bp.get("/quotes")
def quotes():
    qs = _load()
    resp = jsonify({"quotes": qs, "total": len(qs)})
    resp.headers["Cache-Control"] = "public, max-age=3600"
    return resp


@bp.get("/today")
def today():
    qs = _load()
    ds = request.args.get("date")
    try:
        d = datetime.date.fromisoformat(ds) if ds else datetime.date.today()
    except ValueError:
        d = datetime.date.today()
    idx = _daily_index(qs, d)
    return jsonify({"date": d.isoformat(), "index": idx, "quote": qs[idx], "total": len(qs)})

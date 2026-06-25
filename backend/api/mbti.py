"""MBTI 性格测试 API.

Serves the question bank and the 16-type interpretation data from
``data/mbti.json``, plus the option labels / emoji / dimension display
labels / type names that were previously hard-coded in the frontend
(``_legacy/static/js/ui-mbti.js``) so the client can be fully data-driven.

The on-disk ``mbti.json`` is corrupted: Chinese curly quotes (“ ”) were
used in place of JSON array commas, collapsing ``strengths`` / ``weaknesses``
/ ``famous`` into a single joined string, and ``careers`` is a single
``、``-joined string. :func:`_normalize_types` repairs these into proper
string arrays at module load without losing any Chinese text.
"""
import json
import os
import re

from flask import Blueprint, jsonify

from api import DATA_DIR

bp = Blueprint("mbti", __name__, url_prefix="/api/mbti")

# ── Frontend display data, lifted verbatim from _legacy/static/js/ui-mbti.js ──

# 5-point Likert scale options (value 0-4) + their emoji.
OPTIONS = [
    {"value": 0, "label": "非常不同意"},
    {"value": 1, "label": "不同意"},
    {"value": 2, "label": "中立"},
    {"value": 3, "label": "同意"},
    {"value": 4, "label": "非常同意"},
]
OPTION_EMOJI = ["😤", "😐", "🤔", "😊", "😍"]

# Four MBTI dimensions. ``max`` is 48 (12 questions × 4 points each).
DIMENSIONS = [
    {"key": "EI", "left": "E", "right": "I", "max": 48,
     "leftLabel": "外向 E", "rightLabel": "内向 I"},
    {"key": "SN", "left": "S", "right": "N", "max": 48,
     "leftLabel": "实感 S", "rightLabel": "直觉 N"},
    {"key": "TF", "left": "T", "right": "F", "max": 48,
     "leftLabel": "理性 T", "rightLabel": "感性 F"},
    {"key": "JP", "left": "J", "right": "P", "max": 48,
     "leftLabel": "判断 J", "rightLabel": "感知 P"},
]

TYPE_NAMES = {
    "INTJ": "建筑师", "INTP": "逻辑学家", "ENTJ": "指挥官", "ENTP": "辩论家",
    "INFJ": "提倡者", "INFP": "调停者", "ENFJ": "主人公", "ENFP": "竞选者",
    "ISTJ": "物流师", "ISFJ": "守护者", "ESTJ": "总经理", "ESFJ": "执政官",
    "ISTP": "鉴赏家", "ISFP": "探险家", "ESTP": "企业家", "ESFP": "表演者",
}

TYPE_EMOJI = {
    "INTJ": "🏛️", "INTP": "🔬", "ENTJ": "👑", "ENTP": "💡",
    "INFJ": "🌿", "INFP": "🦋", "ENFJ": "🌟", "ENFP": "🎨",
    "ISTJ": "⚙️", "ISFJ": "🛡️", "ESTJ": "📋", "ESFJ": "🤗",
    "ISTP": "🔧", "ISFP": "🌸", "ESTP": "🔥", "ESFP": "🎭",
}

# ── Data load + repair ───────────────────────────────────────────────────────

# Fields whose values should be string arrays but arrive collapsed/joined.
_ARRAY_FIELDS = ("strengths", "weaknesses", "careers", "famous")

# Separators used by the corruption: curly quotes (U+201C/U+201D), ASCII comma,
# and the ideographic comma 、 (U+3001, used to join ``careers``). A run of any
# of these — optionally surrounded by whitespace — delimits two items.
_SPLIT_RE = re.compile(r"[“”、,]+")


def _split_items(value):
    """Repair one corrupted field into a clean list of Chinese strings.

    ``value`` may be a list (possibly a single collapsed element) or a plain
    string. Items are split on curly quotes / commas / ``、`` and stripped;
    empties are dropped so no Chinese text is lost.
    """
    parts = value if isinstance(value, list) else [value]
    items = []
    for part in parts:
        for piece in _SPLIT_RE.split(str(part)):
            piece = piece.strip()
            if piece:
                items.append(piece)
    return items


def _normalize_types(types):
    """Return a deep-ish copy of ``types`` with array fields repaired."""
    fixed = {}
    for code, info in types.items():
        entry = dict(info)
        for field in _ARRAY_FIELDS:
            if field in entry:
                entry[field] = _split_items(entry[field])
        fixed[code] = entry
    return fixed


def _load():
    """Load + repair mbti.json once, caching the result on the function."""
    cached = getattr(_load, "_cache", None)
    if cached is None:
        path = os.path.join(DATA_DIR, "mbti.json")
        with open(path, encoding="utf-8") as fh:
            raw = json.load(fh)
        cached = {
            "questions": raw.get("questions", []),
            "types": _normalize_types(raw.get("types", {})),
        }
        _load._cache = cached
    return cached


# ── Endpoints ────────────────────────────────────────────────────────────────


@bp.get("/questions")
def questions():
    """Return the 48-question bank plus options + dimension metadata."""
    data = _load()
    return jsonify({
        "options": OPTIONS,
        "optionEmoji": OPTION_EMOJI,
        "dimensions": DIMENSIONS,
        "questions": data["questions"],
    })


@bp.get("/types")
def types():
    """Return the 16-type interpretation data (repaired) + name/emoji maps."""
    data = _load()
    return jsonify({
        "types": data["types"],
        "typeNames": TYPE_NAMES,
        "typeEmoji": TYPE_EMOJI,
    })

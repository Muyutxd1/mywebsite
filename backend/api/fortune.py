"""Fortunetelling JSON API — 六大玄学体系.

Each endpoint wraps an existing calculator under ``calculators/`` verbatim and
jsonify-s its result dict. The Flask app sets ``ensure_ascii=False`` globally,
so the CJK interpretation strings (with their 【title】 ReadingRenderer markers)
stay human-readable on the wire.

Endpoints (all POST):
    /api/fortune/meihua     梅花易数
    /api/fortune/bazi       八字
    /api/fortune/ziwei      紫微斗数
    /api/fortune/yijing     易经铜钱起卦
    /api/fortune/tarot      塔罗牌
    /api/fortune/astrology  占星
"""
from flask import Blueprint, request, jsonify

from calculators.meihua import MeihuaCalculator
from calculators.bazi import BaziCalculator
from calculators.ziwei import ZiweiCalculator
from calculators.yijing import YijingCalculator
from calculators.tarot import TarotCalculator
from calculators.astrology import AstrologyCalculator
from core.yixue import hexagram_from_lines, changed_lines

bp = Blueprint('fortune', __name__, url_prefix='/api/fortune')


def _body():
    """Return the request JSON body as a dict, never None."""
    return request.get_json(silent=True) or {}


@bp.route('/meihua', methods=['POST'])
def meihua():
    """梅花易数. body {n1,n2,n3}; all null/missing → calculator uses today."""
    data = _body()
    result = MeihuaCalculator().calculate(
        data.get('n1'), data.get('n2'), data.get('n3')
    )
    return jsonify(result)


@bp.route('/bazi', methods=['POST'])
def bazi():
    """八字. body {year,month,day,hour=0,minute=0}."""
    data = _body()
    result = BaziCalculator().calculate(
        data.get('year'), data.get('month'), data.get('day'),
        data.get('hour', 0), data.get('minute', 0)
    )
    return jsonify(result)


@bp.route('/ziwei', methods=['POST'])
def ziwei():
    """紫微斗数. body {year,month,day,hour=0,minute=0,gender}."""
    data = _body()
    result = ZiweiCalculator().calculate(
        data.get('year'), data.get('month'), data.get('day'),
        data.get('hour', 0), data.get('minute', 0),
        data.get('gender', 'male')
    )
    return jsonify(result)


def _augment_yijing(result):
    """Add ben_gua / bian_gua / moving_positions to a cast() result.

    The calculator's ``cast()`` returns per-line ``tosses`` (value 7/9 = 阳,
    6/8 = 阴; bottom→top) plus the interpretation string, but it does NOT
    expose proper hexagram dicts (its internal trigram tables are buggy). Here
    we rebuild the real lines from the tosses and run them through the verified
    ``core.yixue`` engine so the hexagram UI gets correct ben_gua/bian_gua.

    The calculator's ``interpretation`` string is left untouched — it is the
    frontend ReadingRenderer contract.
    """
    tosses = result.get('tosses', [])

    # Original lines bottom→top: 1=阳 (value 7/9), 0=阴 (value 6/8).
    lines = [1 if t.get('value') in (7, 9) else 0 for t in tosses]
    # Moving (changing) positions: old yang (9) and old yin (6).
    moving = sorted(t.get('position') for t in tosses if t.get('value') in (6, 9))

    if len(lines) == 6:
        ben_gua = hexagram_from_lines(lines)
        if moving:
            bian_gua = hexagram_from_lines(changed_lines(lines, moving))
        else:
            bian_gua = None
    else:
        ben_gua = None
        bian_gua = None

    result['ben_gua'] = ben_gua
    result['bian_gua'] = bian_gua
    result['moving_positions'] = moving
    return result


@bp.route('/yijing', methods=['POST'])
def yijing():
    """易经铜钱起卦. body {manual_lines:[int x6]|null}.

    Normalizes the calculator output with correct ben_gua/bian_gua/
    moving_positions derived via the core.yixue engine (the calculator's own
    trigram lookup is unreliable).
    """
    data = _body()
    result = YijingCalculator().cast(manual_lines=data.get('manual_lines'))
    return jsonify(_augment_yijing(result))


@bp.route('/tarot', methods=['POST'])
def tarot():
    """塔罗牌. body {spread:'single'|'three'|'celtic_cross'}."""
    data = _body()
    result = TarotCalculator().draw(data.get('spread', 'three'))
    return jsonify(result)


@bp.route('/astrology', methods=['POST'])
def astrology():
    """占星. body {year,month,day,hour=0,minute=0,lat=39.9,lng=116.4,tz=8}."""
    data = _body()
    result = AstrologyCalculator().calculate(
        data.get('year'), data.get('month'), data.get('day'),
        data.get('hour', 0), data.get('minute', 0),
        data.get('lat', 39.9), data.get('lng', 116.4),
        tz_offset=data.get('tz', 8)
    )
    return jsonify(result)

"""
Routes: Fortunetelling web app + API endpoints.
GET  /fortune      → HTML page
POST /fortune/api/meihua     → 梅花易数
POST /fortune/api/bazi       → 八字
POST /fortune/api/ziwei      → 紫微斗数
POST /fortune/api/yijing     → 易经
POST /fortune/api/tarot      → 塔罗牌
POST /fortune/api/astrology  → 占星
"""
from flask import Blueprint, render_template, request, jsonify

fortune_bp = Blueprint('fortune', __name__)


@fortune_bp.route('/', strict_slashes=False)
def fortune_page():
    return render_template('fortune.html')


# ── API Endpoints ──────────────────────────────

@fortune_bp.route('/api/meihua', methods=['POST'])
def api_meihua():
    data = request.get_json(silent=True) or {}
    from calculators.meihua import MeihuaCalculator
    result = MeihuaCalculator().calculate(
        data.get('n1'), data.get('n2'), data.get('n3')
    )
    return jsonify(result)


@fortune_bp.route('/api/bazi', methods=['POST'])
def api_bazi():
    data = request.get_json(silent=True) or {}
    from calculators.bazi import BaziCalculator
    result = BaziCalculator().calculate(
        data.get('year'), data.get('month'), data.get('day'),
        data.get('hour', 0), data.get('minute', 0)
    )
    return jsonify(result)


@fortune_bp.route('/api/ziwei', methods=['POST'])
def api_ziwei():
    data = request.get_json(silent=True) or {}
    from calculators.ziwei import ZiweiCalculator
    result = ZiweiCalculator().calculate(
        data.get('year'), data.get('month'), data.get('day'),
        data.get('hour', 0), data.get('minute', 0),
        data.get('gender', 'male')
    )
    return jsonify(result)


@fortune_bp.route('/api/yijing', methods=['POST'])
def api_yijing():
    data = request.get_json(silent=True) or {}
    from calculators.yijing import YijingCalculator
    manual = data.get('manual_lines')
    result = YijingCalculator().cast(manual_lines=manual)
    return jsonify(result)


@fortune_bp.route('/api/tarot', methods=['POST'])
def api_tarot():
    data = request.get_json(silent=True) or {}
    from calculators.tarot import TarotCalculator
    result = TarotCalculator().draw(data.get('spread', 'three'))
    return jsonify(result)


@fortune_bp.route('/api/astrology', methods=['POST'])
def api_astrology():
    data = request.get_json(silent=True) or {}
    from calculators.astrology import AstrologyCalculator
    result = AstrologyCalculator().calculate(
        data.get('year'), data.get('month'), data.get('day'),
        data.get('hour', 0), data.get('minute', 0),
        data.get('lat', 39.9), data.get('lng', 116.4),
        data.get('tz', 8)
    )
    return jsonify(result)

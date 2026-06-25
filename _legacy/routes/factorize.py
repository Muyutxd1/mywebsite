"""Routes: Polynomial Factorization."""
from flask import Blueprint, render_template, request, jsonify

factorize_bp = Blueprint('factorize', __name__)


@factorize_bp.route('/', strict_slashes=False)
def factorize_page():
    return render_template('factorize.html')


@factorize_bp.route('/api/factor', methods=['POST'])
def api_factor():
    data = request.get_json(silent=True) or {}
    expr = data.get('expression', '').strip()
    if not expr:
        return jsonify({'error': '请输入表达式'})
    from calculators.factorize import factorize
    result = factorize(expr)
    return jsonify(result)

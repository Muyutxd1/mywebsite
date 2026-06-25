"""JSON API blueprint: polynomial factorization.

Thin wrapper over ``calculators.factorize.factorize``. The heavy sympy work
lives there and is reused verbatim. This module only handles request parsing,
input-size capping, and a thread-based timeout (sympy.factor has no native
timeout and Windows has no ``signal.alarm``).
"""
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FutureTimeout

from flask import Blueprint, request, jsonify

from calculators.factorize import factorize

bp = Blueprint('factorize', __name__, url_prefix='/api/factorize')

# Shared executor so we don't spin up a new pool per request.
_EXECUTOR = ThreadPoolExecutor(max_workers=4)

_MAX_LEN = 500
_TIMEOUT_SECONDS = 5


@bp.route('', methods=['POST'])
def api_factorize():
    """Factor a polynomial expression and return the engine dict verbatim.

    Response keys (snake_case, unchanged): input, factored, factored_unicode,
    steps, is_constant, error. The frontend only inspects ``error``, so all
    guard responses are HTTP 200 with an ``error`` message.
    """
    data = request.get_json(silent=True) or {}
    expr = (data.get('expression') or '').strip()

    if not expr:
        return jsonify({'error': '请输入表达式'})
    if len(expr) > _MAX_LEN:
        return jsonify({'error': '表达式过长'})

    future = _EXECUTOR.submit(factorize, expr)
    try:
        result = future.result(timeout=_TIMEOUT_SECONDS)
    except FutureTimeout:
        future.cancel()
        return jsonify({'error': '计算超时，请简化表达式'})

    return jsonify(result)

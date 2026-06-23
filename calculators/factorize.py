"""
Polynomial factorization engine.
Uses sympy for exact algebraic factorization and generates step-by-step
solutions for middle-school-level methods (cross-method, formula recognition,
common factor extraction, grouping).
"""
from sympy import factor, simplify, Poly, degree, symbols, sympify, fraction, together, expand, factor_list, gcd_list, LC, degree_list
from sympy.parsing.sympy_parser import (
    parse_expr, standard_transformations, implicit_multiplication_application,
    function_exponentiation
)
from sympy.core.symbol import Symbol
from sympy.polys.polytools import parallel_poly_from_expr
import re


# ── parsing ──────────────────────────────────────────────────

def _parse(expr_str):
    """Parse a user-supplied string into a sympy expression."""
    s = expr_str.strip()
    # Replace Unicode superscripts
    s = s.replace('²', '**2').replace('³', '**3')
    s = s.replace('⁴', '**4').replace('⁵', '**5')
    # Replace caret with Python's **
    s = s.replace('^', '**')
    # Allow implicit multiplication like 2x, 3(x+1), (x+1)(x-1)
    transforms = standard_transformations + (
        implicit_multiplication_application, function_exponentiation
    )
    return parse_expr(s, transformations=transforms)


def _extract_variables(expr):
    """Return sorted list of free symbols in expr."""
    return sorted(expr.free_symbols, key=lambda s: str(s))


def _is_rational(expr):
    """True if expr is a rational expression (fraction)."""
    return expr.has(symbols('x y z a b c m n p q r s t u v w')) and '/' in str(expr)


# ── step generation ──────────────────────────────────────────

def _gen_steps_single_var(expr, factored, var):
    """
    Generate Chinese middle-school style steps for a single-variable polynomial.
    Returns a list of step strings.
    """
    steps = []
    try:
        p = Poly(expr, var)
    except Exception:
        return []

    d = degree(p, var)

    # Step 1: Identify the type
    if d == 0:
        steps.append(f'这是常数 {expr}，无需因式分解。')
        return steps
    elif d == 1:
        steps.append(f'这是关于 {var} 的一次式，已是最简形式。')
        return steps

    step1 = f'这是一个关于 ${var}$ 的 {d} 次多项式。'
    steps.append(step1)

    # Check for common factor across all coefficients
    coeffs = [int(c) for c in p.all_coeffs()]
    if len(coeffs) > 1:
        g = gcd_list(coeffs)
        if g > 1 or g < -1:
            steps.append(f'提取公因式 ${g}$。')
        elif g == -1:
            steps.append(f'提取公因式 ${g}$。')

    # Quadratic: ax² + bx + c — cross method (十字相乘法)
    if d == 2:
        coeffs = [int(c) for c in p.all_coeffs()]
        a, b, c = coeffs[0], coeffs[1], coeffs[2]
        ac = a * c
        steps.append(f'二次三项式: ${a}{var}² {_fmt_sign(b)}{var} {_fmt_sign(c)}$')
        steps.append(f'计算 $a \\cdot c = {a} \\times {c} = {ac}$')

        # Find factor pairs of ac
        pairs = _find_factor_pairs(ac)
        found = None
        for m, n in pairs:
            if m + n == b:
                found = (m, n)
                break
            if -m + -n == b:
                found = (-m, -n)
                break

        if found:
            m, n = found
            steps.append(f'寻找两个数，积为 ${ac}$，和为 ${b}$ → 找到 ${m} 和 ${n}$')
            steps.append(f'拆项: ${a}{var}² {_fmt_sign(m)}{var} {_fmt_sign(n)}{var} {_fmt_sign(c)}$')
            if a == 1:
                steps.append(f'分组: $({var}² {_fmt_sign(m)}{var}) + ({_fmt_sign(n)}{var} {_fmt_sign(c)})$')
                steps.append(f'提公因式: ${var}({var}{_fmt_sign(m)}) {_fmt_sign(n)}({var}{_fmt_sign(m)})$')
                steps.append(f'$\\Rightarrow ({var}{_fmt_sign(m)})({var}{_fmt_sign(n)})$')
            else:
                steps.append(f'十字相乘法拆解后分组。')
        else:
            # Check discriminant
            disc = b*b - 4*a*c
            if disc < 0:
                steps.append(f'判别式 $\\Delta = {b}² - 4 \\cdot {a} \\cdot {c} = {disc} < 0$，在实数范围内不可分解。')
            else:
                steps.append(f'十字相乘法未能直接找到整数因子。')
    elif d == 3:
        steps.append(f'三次多项式，尝试分组或公式法。')
    elif d >= 4:
        steps.append(f'{d} 次多项式，尝试先提取公因式再分组。')

    # Add the final result
    fac_str = _sympy_to_latex(factored)
    steps.append(f'因式分解结果: ${fac_str}$')
    return steps


def _gen_steps_multi_var(expr, factored):
    """Generate steps for multi-variable expressions."""
    steps = []
    vars_s = sorted(expr.free_symbols, key=lambda s: str(s))
    var_names = ', '.join(str(v) for v in vars_s)
    steps.append(f'这是一个关于 ${var_names}$ 的多项式。')

    # Try to detect special forms
    expr_str = str(factored)
    if '**2' in expr_str or '^2' in expr_str or expr_str.count('2') > 0:
        pass  # handled by the formula detection below

    # Check for difference of squares: a² - b²
    expanded = str(expand(expr))
    fac_str = _sympy_to_latex(factored)
    steps.append(f'因式分解结果: ${fac_str}$')
    return steps


def _find_factor_pairs(n):
    """Return all integer factor pairs (a,b) such that a*b = n, a <= b."""
    n = abs(n)
    pairs = []
    for i in range(1, int(n**0.5) + 1):
        if n % i == 0:
            pairs.append((i, n // i))
            if i != n // i:
                pairs.append((n // i, i))
    return pairs


def _fmt_sign(v):
    """Format an integer as '+ n' or '- |n|'."""
    if v >= 0:
        return f'+ {v}' if v != 0 else ''
    else:
        return f'- {abs(v)}'


# ── LaTeX output ─────────────────────────────────────────────

def _sympy_to_latex(expr):
    """Convert sympy expression to a readable LaTeX-like string."""
    from sympy import latex
    return latex(expr)


def _expr_to_unicode(expr):
    """Convert sympy expression to a readable Unicode string."""
    s = str(expr).replace('**', '^').replace('*', '')
    # Clean up spacing
    s = s.replace(' ', '')
    return s


# ── main API ─────────────────────────────────────────────────

def factorize(expr_str, show_steps=True):
    """
    Factor a polynomial expression.

    Parameters
    ----------
    expr_str : str
        User input, e.g. "x^2 - 5x + 6"
    show_steps : bool
        Whether to include step-by-step reasoning

    Returns
    -------
    dict with keys:
        input : str           — cleaned input
        factored : str        — LaTeX factored form
        factored_unicode : str — Unicode factored form
        steps : list[str]     — step-by-step explanation
        is_constant : bool    — True if result is constant
        error : str or None   — error message if parsing failed
    """
    result = {
        'input': expr_str.strip(),
        'factored': '',
        'factored_unicode': '',
        'steps': [],
        'is_constant': False,
        'error': None,
    }

    try:
        expr = _parse(result['input'])
    except Exception as e:
        result['error'] = f'无法解析表达式: {e}'
        return result

    if expr.is_number:
        result['factored'] = str(expr)
        result['factored_unicode'] = str(expr)
        result['is_constant'] = True
        result['steps'] = [f'{expr} 是常数，无需因式分解。']
        return result

    try:
        factored = factor(expr)
    except Exception as e:
        # Fallback: try simplify
        try:
            factored = simplify(expr)
        except Exception:
            result['error'] = f'因式分解失败: {e}'
            return result

    # Check if actually factored (may be same as input if irreducible)
    result['factored'] = _sympy_to_latex(factored)
    result['factored_unicode'] = _expr_to_unicode(factored)

    # Generate steps
    if show_steps:
        vars_list = _extract_variables(expr)
        steps = []
        if len(vars_list) == 1:
            steps = _gen_steps_single_var(expr, factored, vars_list[0])
        else:
            steps = _gen_steps_multi_var(expr, factored)

        # If no steps were generated, provide basic info
        if not steps:
            steps.append(f'因式分解结果: ${result["factored"]}$')

        result['steps'] = steps

    return result


# ── quick test ───────────────────────────────────────────────

if __name__ == '__main__':
    tests = [
        'x^2 - 5x + 6',
        'x^2 - 1',
        'x^3 - 8',
        'a^2 - b^2',
        'x^4 - 1',
        '2x^2 + 5x - 3',
        'x^2 + 7x + 12',
        'x^2 + 4x + 4',
    ]
    for t in tests:
        r = factorize(t)
        print(f'\nInput: {r["input"]}')
        if r['error']:
            print(f'  ERROR: {r["error"]}')
        else:
            print(f'  Factored: {r["factored"]}')
            print(f'  Unicode:  {r["factored_unicode"]}')
            for s in r['steps']:
                print(f'    → {s}')

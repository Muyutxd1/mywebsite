"""Routes: MBTI Personality Test."""
from flask import Blueprint, render_template

mbti_bp = Blueprint('mbti', __name__)


@mbti_bp.route('/', strict_slashes=False)
def mbti_page():
    return render_template('mbti.html')

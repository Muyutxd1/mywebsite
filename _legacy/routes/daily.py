"""Routes: Daily Quote."""
from flask import Blueprint, render_template

daily_bp = Blueprint('daily', __name__)


@daily_bp.route('/', strict_slashes=False)
def daily_page():
    return render_template('daily.html')

"""Routes: Chess web app."""
from flask import Blueprint, render_template

chess_bp = Blueprint('chess', __name__)


@chess_bp.route('/', strict_slashes=False)
def chess_page():
    return render_template('chess.html')

"""Routes: Polyomino Puzzle Studio — interactive tiling tool for math competitions."""
from flask import Blueprint, render_template

polyomino_bp = Blueprint('polyomino', __name__)


@polyomino_bp.route('/', strict_slashes=False)
def polyomino_page():
    return render_template('polyomino.html')

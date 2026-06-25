"""Routes: 3D Polycube Puzzle Studio — interactive 3D tiling tool."""
from flask import Blueprint, render_template

polycube_bp = Blueprint('polycube', __name__)


@polycube_bp.route('/', strict_slashes=False)
def polycube_page():
    return render_template('polycube.html')

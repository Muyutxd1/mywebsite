"""Routes: Affine Transformation Visualizer."""
from flask import Blueprint, render_template

affine_bp = Blueprint('affine', __name__)


@affine_bp.route('/', strict_slashes=False)
def affine_page():
    return render_template('affine.html')

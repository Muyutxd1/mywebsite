"""Routes: Inversion Workbench."""
from flask import Blueprint, render_template

inversion_bp = Blueprint('inversion', __name__)


@inversion_bp.route('/', strict_slashes=False)
def inversion_page():
    return render_template('inversion.html')

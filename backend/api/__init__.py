"""JSON API blueprints. Shared paths live here.

Each module in this package defines a Flask ``bp`` blueprint whose url_prefix
starts with ``/api``. The Flask app (``app.py``) imports and registers them.
"""
import os

# backend/ — parent of this api/ package.
BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BACKEND_DIR, "data")

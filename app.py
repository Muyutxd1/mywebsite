"""Root entrypoint shim.

After the repo was restructured into backend/ + frontend/, the real Flask app
lives in ``backend/app.py``. This shim keeps the *default* deploy commands
working — e.g. ``gunicorn app:app`` run from the repo root — by loading the
backend app with ``backend/`` on ``sys.path`` (so its ``from api... / from
calculators...`` imports resolve, and its data / static_spa paths stay correct).

It loads ``backend/app.py`` under a unique module name to avoid colliding with
this root ``app`` module.
"""
import importlib.util
import os
import sys

_BACKEND = os.path.join(os.path.dirname(os.path.abspath(__file__)), "backend")
if _BACKEND not in sys.path:
    sys.path.insert(0, _BACKEND)

_spec = importlib.util.spec_from_file_location(
    "muyu_backend_app", os.path.join(_BACKEND, "app.py")
)
_module = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_module)

# The WSGI callable Gunicorn looks for: `gunicorn app:app`.
app = _module.app

if __name__ == "__main__":
    app.run(debug=True, port=5000)

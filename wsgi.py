"""Root WSGI shim so `gunicorn wsgi:app` (run from the repo root) also works.

Delegates to the root app.py shim, which loads the real app from backend/.
"""
from app import app  # noqa: F401  (root app.py shim)

if __name__ == "__main__":
    app.run()

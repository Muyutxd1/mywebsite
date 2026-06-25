"""Gunicorn entry point:  gunicorn -w 4 wsgi:app"""
from app import app

if __name__ == "__main__":
    app.run()

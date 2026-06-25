"""
muyutxd1.com — Flask JSON API + SPA host.

This app exposes only /api/* endpoints (no Jinja HTML). In production it also
serves the pre-built Vite SPA from ./static_spa with a catch-all so React Router
deep links resolve client-side. In development the Vite dev server (port 5173)
serves the frontend and proxies /api/* to this app on port 5000.
"""
import os

from flask import Flask, abort, send_from_directory

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
SPA_DIR = os.path.join(BASE_DIR, "static_spa")


def create_app():
    app = Flask(__name__, static_folder=None)
    # Keep CJK readable in JSON responses.
    app.json.ensure_ascii = False

    # --- JSON API blueprints (each defines `bp` with its own /api/... prefix) ---
    from api.fortune import bp as fortune_bp
    from api.factorize import bp as factorize_bp
    from api.mbti import bp as mbti_bp
    from api.daily import bp as daily_bp
    from api.knowledge import bp as knowledge_bp
    from api.mdrender import bp as mdrender_bp
    from api.problems import bp as problems_bp

    for bp in (
        fortune_bp,
        factorize_bp,
        mbti_bp,
        daily_bp,
        knowledge_bp,
        mdrender_bp,
        problems_bp,
    ):
        app.register_blueprint(bp)

    @app.get("/api/health")
    def health():
        return {"status": "ok"}

    # --- SPA host (prod) -------------------------------------------------------
    @app.route("/", defaults={"path": ""})
    @app.route("/<path:path>")
    def spa(path):
        # Never let the catch-all swallow API routes.
        if path.startswith("api/"):
            abort(404)
        candidate = os.path.join(SPA_DIR, path)
        if path and os.path.isfile(candidate):
            return send_from_directory(SPA_DIR, path)
        index = os.path.join(SPA_DIR, "index.html")
        if os.path.isfile(index):
            return send_from_directory(SPA_DIR, "index.html")
        return (
            "<h1>SPA not built</h1>"
            "<p>Run <code>npm run build</code> in <code>frontend/</code> "
            "(output goes to <code>backend/static_spa</code>), "
            "or use the Vite dev server for development.</p>",
            200,
        )

    return app


app = create_app()

if __name__ == "__main__":
    app.run(debug=True, port=5000)

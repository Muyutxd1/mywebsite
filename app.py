"""
muyutxd1.com — Personal Website
Flask application with Fortunetelling, Chess, and project showcase.
"""
from flask import Flask


def create_app():
    app = Flask(__name__)
    app.config['SECRET_KEY'] = 'muyu-site-2026'

    # Register routes
    from routes.main import main_bp
    from routes.fortune import fortune_bp
    from routes.chess import chess_bp
    from routes.mbti import mbti_bp
    from routes.daily import daily_bp
    from routes.polyomino import polyomino_bp
    from routes.polycube import polycube_bp
    from routes.factorize import factorize_bp
    from routes.affine import affine_bp
    from routes.inversion import inversion_bp
    from routes.mdrender import mdrender_bp
    from routes.knowledge import knowledge_bp

    app.register_blueprint(main_bp)
    app.register_blueprint(fortune_bp, url_prefix='/fortune')
    app.register_blueprint(chess_bp, url_prefix='/chess')
    app.register_blueprint(mbti_bp, url_prefix='/mbti')
    app.register_blueprint(daily_bp, url_prefix='/daily')
    app.register_blueprint(polyomino_bp, url_prefix='/polyomino')
    app.register_blueprint(polycube_bp, url_prefix='/polycube')
    app.register_blueprint(factorize_bp, url_prefix='/factorize')
    app.register_blueprint(affine_bp, url_prefix='/affine')
    app.register_blueprint(inversion_bp, url_prefix='/inversion')
    app.register_blueprint(mdrender_bp, url_prefix='/mdrender')
    app.register_blueprint(knowledge_bp, url_prefix='/knowledge')

    return app


app = create_app()

if __name__ == '__main__':
    app.run(debug=True, port=5000)

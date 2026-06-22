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

    app.register_blueprint(main_bp)
    app.register_blueprint(fortune_bp, url_prefix='/fortune')
    app.register_blueprint(chess_bp, url_prefix='/chess')

    return app


app = create_app()

if __name__ == '__main__':
    app.run(debug=True, port=5000)

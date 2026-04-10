import os
from flask import Flask, jsonify
from flask_cors import CORS

# Import the init_app function from the file you just wrote
from .db_control.db import init_app
from .config import Config

def create_app(config=Config):
    # create flask app with __name__ which is "app"
    app = Flask(__name__)
    app.config.from_object(config)

    # supports_credentials=True -> allows session cookies
    CORS(app, resources={r"/api/*": {
        "origins": ["http://localhost:3000"], 
        "supports_credentials": True
    }})

    # init app
    init_app(app=app)

    # register all blueprints
    from .routes.auth import auth_bp
    from .routes.communities import communities_bp
    from .routes.posts import posts_bp
    
    app.register_blueprint(auth_bp, url_prefix="/api/auth")
    app.register_blueprint(communities_bp, url_prefix="/api/communities")
    app.register_blueprint(posts_bp, url_prefix="/api/posts")

    #  Health Check Route
    @app.route("/api/health")
    def health():
        return jsonify({"status": "ok", "message": "ForumDB API is running"}), 200

    return app
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
    app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'supersecretkey')
    app.config['MAX_CONTENT_LENGTH'] = 100 * 1024 * 1024 

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
    from .routes.media import media_bp
    from .routes.users import users_bp
    
    app.register_blueprint(auth_bp, url_prefix="/api/auth")
    app.register_blueprint(communities_bp, url_prefix="/api/communities")
    app.register_blueprint(posts_bp, url_prefix="/api/posts")
    app.register_blueprint(media_bp, url_prefix="/api/media")
    app.register_blueprint(users_bp, url_prefix="/api/users")

    #  Health Check Route
    @app.route("/api/health")
    def health():
        return jsonify({"status": "ok", "message": "ForumDB API is running"}), 200
    
    # Serve uploaded files statically
    @app.route('/uploads/<filename>')
    def uploaded_file(filename):
        from flask import send_from_directory
        return send_from_directory('/app/uploads', filename)

    return app

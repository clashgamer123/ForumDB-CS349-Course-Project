import os

## load the environment variables into python vars
class Config:
    DATABASE_URL = os.environ.get("DATABASE_URL", "postgresql://forumdb:forumdb_pass@localhost:5432/forumdb")
    DEBUG        = os.environ.get("FLASK_DEBUG", "0") == "1"
    ENV          = os.environ.get("FLASK_ENV", "development")
    SECRET_KEY   = os.environ.get("SECRET_KEY", "some_secret_key")

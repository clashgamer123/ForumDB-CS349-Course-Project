import psycopg2
import psycopg2.extras
from flask import g, current_app

def get_db():
    # return the db connection in the current request scope after storing in g
    # create one if no connection exists
    if "db" not in g:
        g.db = psycopg2.connect(
            current_app.config["DATABASE_URL"],
            cursor_factory=psycopg2.extras.RealDictCursor,
        ) 
        g.db.autocommit = False
    return g.db

def close_db(e=None):
    db = g.pop("db", None)
    if db is not None:
        db.close()


def init_app(app):
    app.teardown_appcontext(close_db)

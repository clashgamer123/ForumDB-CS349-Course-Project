import psycopg2
import psycopg2.extras
from flask import g, current_app

SCHEMA_READY = False


def ensure_schema(db):
    global SCHEMA_READY
    if SCHEMA_READY:
        return

    cur = db.cursor()
    try:
        cur.execute("""
            ALTER TABLE users
                ADD COLUMN IF NOT EXISTS profile_pic_url TEXT,
                ADD COLUMN IF NOT EXISTS is_private BOOLEAN DEFAULT FALSE,
                ADD COLUMN IF NOT EXISTS display_name VARCHAR(255),
                ADD COLUMN IF NOT EXISTS location VARCHAR(255);

            ALTER TABLE communities
                ADD COLUMN IF NOT EXISTS is_private BOOLEAN DEFAULT FALSE;

            CREATE TABLE IF NOT EXISTS user_follows (
                follower_id INTEGER NOT NULL,
                following_id INTEGER NOT NULL,
                status VARCHAR(20) NOT NULL DEFAULT 'accepted',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (follower_id, following_id),
                FOREIGN KEY (follower_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (following_id) REFERENCES users(id) ON DELETE CASCADE,
                CHECK (follower_id <> following_id),
                CHECK (status IN ('pending', 'accepted'))
            );

            CREATE TABLE IF NOT EXISTS user_community_visits (
                user_id INTEGER NOT NULL,
                community_id INTEGER NOT NULL,
                visit_count INTEGER DEFAULT 1 CHECK (visit_count >= 0),
                last_visited_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (user_id, community_id),
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (community_id) REFERENCES communities(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS messages (
                id SERIAL PRIMARY KEY,
                sender_id INTEGER NOT NULL,
                recipient_id INTEGER NOT NULL,
                content TEXT,
                media_url TEXT,
                media_type VARCHAR(50),
                share_type VARCHAR(20),
                share_id INTEGER,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (recipient_id) REFERENCES users(id) ON DELETE CASCADE,
                CHECK (sender_id <> recipient_id),
                CHECK (share_type IS NULL OR share_type IN ('community', 'post'))
            );

            CREATE INDEX IF NOT EXISTS idx_user_follows_following_status
                ON user_follows(following_id, status);
            CREATE INDEX IF NOT EXISTS idx_user_follows_follower_status
                ON user_follows(follower_id, status);
            CREATE INDEX IF NOT EXISTS idx_user_community_visits_user_last
                ON user_community_visits(user_id, last_visited_at DESC);
            CREATE INDEX IF NOT EXISTS idx_messages_sender_recipient_created
                ON messages(sender_id, recipient_id, created_at DESC);
            CREATE INDEX IF NOT EXISTS idx_messages_recipient_sender_created
                ON messages(recipient_id, sender_id, created_at DESC);

            UPDATE messages
            SET share_type = NULL, share_id = NULL
            WHERE share_type = 'comment';

            ALTER TABLE messages
                DROP CONSTRAINT IF EXISTS messages_share_type_check;
            ALTER TABLE messages
                ADD CONSTRAINT messages_share_type_check
                CHECK (share_type IS NULL OR share_type IN ('community', 'post'));
        """)
        db.commit()
        SCHEMA_READY = True
    except Exception:
        db.rollback()
        raise
    finally:
        cur.close()


def get_db():
    # return the db connection in the current request scope after storing in g
    # create one if no connection exists
    if "db" not in g:
        g.db = psycopg2.connect(
            current_app.config["DATABASE_URL"],
            cursor_factory=psycopg2.extras.RealDictCursor,
        ) 
        g.db.autocommit = False
        ensure_schema(g.db)
    return g.db

def close_db(e=None):
    db = g.pop("db", None)
    if db is not None:
        db.close()


def init_app(app):
    app.teardown_appcontext(close_db)

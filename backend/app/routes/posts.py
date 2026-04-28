from flask import Blueprint, request, jsonify, session
from ..db_control.db import get_db

posts_bp = Blueprint('posts', __name__)


def is_community_member(cur, community_id, user_id):
    cur.execute("""
        SELECT 1
        FROM community_members
        WHERE community_id = %s AND user_id = %s
    """, (community_id, user_id))
    return cur.fetchone() is not None


def fetch_post_media(cur, post_id):
    cur.execute("""
        SELECT id, media_type, media_url, caption, position
        FROM post_media
        WHERE post_id = %s
        ORDER BY position ASC
    """, (post_id,))
    return cur.fetchall()


def fetch_vote_stats(cur, table_name, target_column, target_id, current_user_id=None):
    cur.execute(f"""
        SELECT
            COALESCE(SUM(CASE WHEN vote_value = 1 THEN 1 ELSE 0 END), 0) AS upvote_count,
            COALESCE(SUM(CASE WHEN vote_value = -1 THEN 1 ELSE 0 END), 0) AS downvote_count,
            COALESCE(SUM(vote_value), 0) AS score,
            COALESCE(MAX(CASE WHEN user_id = %s THEN vote_value END), 0) AS user_vote
        FROM {table_name}
        WHERE {target_column} = %s
    """, (current_user_id, target_id))
    return cur.fetchone()


def enrich_post(cur, post, current_user_id=None):
    if not post:
        return None

    vote_data = fetch_vote_stats(cur, 'post_votes', 'post_id', post['id'], current_user_id)

    cur.execute("""
        SELECT COUNT(*) AS comment_count
        FROM comments
        WHERE post_id = %s
    """, (post['id'],))
    comment_data = cur.fetchone()

    post['score'] = vote_data['score'] if vote_data else 0
    post['user_vote'] = vote_data['user_vote'] if vote_data else 0
    post['upvote_count'] = vote_data['upvote_count'] if vote_data else 0
    post['downvote_count'] = vote_data['downvote_count'] if vote_data else 0
    post['comment_count'] = comment_data['comment_count'] if comment_data else 0
    post['media'] = fetch_post_media(cur, post['id'])
    return post


def build_comment_tree(flat_comments):
    comments_by_id = {}
    roots = []

    for comment in flat_comments:
        comment['replies'] = []
        comments_by_id[comment['id']] = comment

    for comment in flat_comments:
        parent_id = comment['parent_comment_id']
        if parent_id and parent_id in comments_by_id:
            comments_by_id[parent_id]['replies'].append(comment)
        else:
            roots.append(comment)

    return roots


def fetch_comments_for_post(cur, post_id, current_user_id=None):
    cur.execute("""
        WITH RECURSIVE vote_summary AS (
            SELECT
                comment_id,
                SUM(CASE WHEN vote_value = 1 THEN 1 ELSE 0 END) AS upvote_count,
                SUM(CASE WHEN vote_value = -1 THEN 1 ELSE 0 END) AS downvote_count,
                SUM(vote_value) AS score,
                MAX(CASE WHEN user_id = %s THEN vote_value END) AS user_vote
            FROM comment_votes
            GROUP BY comment_id
        ),
        comment_tree AS (
            SELECT
                c.id,
                c.post_id,
                c.author_id,
                c.parent_comment_id,
                c.content,
                c.created_at,
                u.username AS author_name,
                COALESCE(vs.upvote_count, 0) AS upvote_count,
                COALESCE(vs.downvote_count, 0) AS downvote_count,
                COALESCE(vs.score, 0) AS score,
                COALESCE(vs.user_vote, 0) AS user_vote,
                0 AS depth,
                LPAD(c.id::text, 10, '0') AS path
            FROM comments c
            JOIN users u ON u.id = c.author_id
            LEFT JOIN vote_summary vs ON vs.comment_id = c.id
            WHERE c.post_id = %s AND c.parent_comment_id IS NULL

            UNION ALL

            SELECT
                c.id,
                c.post_id,
                c.author_id,
                c.parent_comment_id,
                c.content,
                c.created_at,
                u.username AS author_name,
                COALESCE(vs.upvote_count, 0) AS upvote_count,
                COALESCE(vs.downvote_count, 0) AS downvote_count,
                COALESCE(vs.score, 0) AS score,
                COALESCE(vs.user_vote, 0) AS user_vote,
                ct.depth + 1 AS depth,
                ct.path || '.' || LPAD(c.id::text, 10, '0') AS path
            FROM comments c
            JOIN comment_tree ct ON c.parent_comment_id = ct.id
            JOIN users u ON u.id = c.author_id
            LEFT JOIN vote_summary vs ON vs.comment_id = c.id
        )
        SELECT
            id,
            post_id,
            author_id,
            parent_comment_id,
            content,
            created_at,
            author_name,
            upvote_count,
            downvote_count,
            score,
            user_vote,
            depth
        FROM comment_tree
        ORDER BY path
    """, (current_user_id, post_id))

    return build_comment_tree(cur.fetchall())


def apply_vote(cur, table_name, target_column, target_id, user_id, vote_value):
    cur.execute(
        f"SELECT vote_value FROM {table_name} WHERE {target_column} = %s AND user_id = %s",
        (target_id, user_id),
    )
    existing_vote = cur.fetchone()

    if existing_vote and existing_vote['vote_value'] == vote_value:
        cur.execute(
            f"DELETE FROM {table_name} WHERE {target_column} = %s AND user_id = %s",
            (target_id, user_id),
        )
        current_vote = 0
    elif existing_vote:
        cur.execute(
            f"UPDATE {table_name} SET vote_value = %s, created_at = CURRENT_TIMESTAMP WHERE {target_column} = %s AND user_id = %s",
            (vote_value, target_id, user_id),
        )
        current_vote = vote_value
    else:
        cur.execute(
            f"INSERT INTO {table_name} ({target_column}, user_id, vote_value) VALUES (%s, %s, %s)",
            (target_id, user_id, vote_value),
        )
        current_vote = vote_value

    stats = fetch_vote_stats(cur, table_name, target_column, target_id, user_id)
    stats['user_vote'] = current_vote
    return stats


@posts_bp.route('/', methods=['POST'])
def create_post():
    if 'user_id' not in session:
        return jsonify({"error": "Unauthorized"}), 401

    data = request.json
    db = get_db()
    cur = db.cursor()

    try:
        if not is_community_member(cur, data['community_id'], session['user_id']):
            return jsonify({"error": "Join this community before posting"}), 403

        cur.execute("""
            INSERT INTO posts (title, content, author_id, community_id)
            VALUES (%s, %s, %s, %s)
            RETURNING id, title, created_at
        """, (data['title'], data['content'], session['user_id'], data['community_id']))
        new_post = cur.fetchone()
        post_id = new_post['id']

        media_items = data.get('media_items', [])
        for idx, media in enumerate(media_items):
            cur.execute("""
                INSERT INTO post_media (post_id, media_type, media_url, position, caption)
                VALUES (%s, %s, %s, %s, %s)
            """, (post_id, media['media_type'], media['media_url'], idx, media.get('caption', '')))

        db.commit()
        return jsonify(new_post), 201
    except Exception as e:
        db.rollback()
        return jsonify({"error": f"Failed to create post: {str(e)}"}), 400
    finally:
        cur.close()


@posts_bp.route('/feed', methods=['GET'])
def get_home_feed():
    if 'user_id' not in session:
        return jsonify({"error": "Unauthorized"}), 401

    db = get_db()
    cur = db.cursor()

    try:
        cur.execute("""
            SELECT p.id, p.title, p.content, p.created_at,
                   u.username AS author_name, c.name AS community_name
            FROM posts p
            JOIN users u ON p.author_id = u.id
            JOIN communities c ON p.community_id = c.id
            JOIN community_members cm ON c.id = cm.community_id
            WHERE cm.user_id = %s
            ORDER BY p.created_at DESC
            LIMIT 50
        """, (session['user_id'],))
        feed = cur.fetchall()

        for post in feed:
            enrich_post(cur, post, session.get('user_id'))

        return jsonify(feed), 200
    finally:
        cur.close()


@posts_bp.route('/community/<int:community_id>', methods=['GET'])
def get_community_posts(community_id):
    if 'user_id' not in session:
        return jsonify({"error": "Unauthorized"}), 401

    db = get_db()
    cur = db.cursor()

    try:
        if not is_community_member(cur, community_id, session['user_id']):
            return jsonify({"error": "Join this community to view posts"}), 403

        cur.execute("""
            SELECT p.id, p.title, p.content, p.created_at, u.username AS author_name
            FROM posts p
            JOIN users u ON p.author_id = u.id
            WHERE p.community_id = %s
            ORDER BY p.created_at DESC
        """, (community_id,))
        posts = cur.fetchall()

        for post in posts:
            enrich_post(cur, post, session.get('user_id'))

        return jsonify(posts), 200
    finally:
        cur.close()


@posts_bp.route('/<int:post_id>', methods=['GET'])
def get_single_post(post_id):
    db = get_db()
    cur = db.cursor()

    try:
        cur.execute("""
            SELECT p.*, u.username AS author_name, c.name AS community_name, c.display_name AS community_display_name
            FROM posts p
            JOIN users u ON p.author_id = u.id
            JOIN communities c ON p.community_id = c.id
            WHERE p.id = %s
        """, (post_id,))
        post = cur.fetchone()

        if not post:
            return jsonify({"error": "Post not found"}), 404

        enrich_post(cur, post, session.get('user_id'))
        return jsonify(post), 200
    finally:
        cur.close()


@posts_bp.route('/<int:post_id>/comments', methods=['GET'])
def get_post_comments(post_id):
    db = get_db()
    cur = db.cursor()

    try:
        comments = fetch_comments_for_post(cur, post_id, session.get('user_id'))
        return jsonify(comments), 200
    finally:
        cur.close()


@posts_bp.route('/<int:post_id>/comments', methods=['POST'])
def create_comment(post_id):
    if 'user_id' not in session:
        return jsonify({"error": "Unauthorized"}), 401

    data = request.json or {}
    content = data.get('content', '').strip()
    parent_comment_id = data.get('parent_comment_id')

    if not content:
        return jsonify({"error": "Comment content is required"}), 400

    db = get_db()
    cur = db.cursor()

    try:
        cur.execute("SELECT id FROM posts WHERE id = %s", (post_id,))
        if not cur.fetchone():
            return jsonify({"error": "Post not found"}), 404

        if parent_comment_id is not None:
            cur.execute("""
                SELECT id
                FROM comments
                WHERE id = %s AND post_id = %s
            """, (parent_comment_id, post_id))
            if not cur.fetchone():
                return jsonify({"error": "Invalid parent comment"}), 400

        cur.execute("""
            INSERT INTO comments (post_id, author_id, parent_comment_id, content)
            VALUES (%s, %s, %s, %s)
            RETURNING id, post_id, parent_comment_id, content, created_at
        """, (post_id, session['user_id'], parent_comment_id, content))
        new_comment = cur.fetchone()

        db.commit()
        return jsonify(new_comment), 201
    except Exception as e:
        db.rollback()
        return jsonify({"error": f"Failed to create comment: {str(e)}"}), 400
    finally:
        cur.close()


@posts_bp.route('/<int:post_id>/vote', methods=['POST'])
def vote_on_post(post_id):
    if 'user_id' not in session:
        return jsonify({"error": "Unauthorized"}), 401

    data = request.json or {}
    vote_value = data.get('vote_value')

    if vote_value not in (-1, 1):
        return jsonify({"error": "vote_value must be 1 or -1"}), 400

    db = get_db()
    cur = db.cursor()

    try:
        cur.execute("SELECT id FROM posts WHERE id = %s", (post_id,))
        if not cur.fetchone():
            return jsonify({"error": "Post not found"}), 404

        result = apply_vote(cur, 'post_votes', 'post_id', post_id, session['user_id'], vote_value)
        db.commit()
        return jsonify(result), 200
    except Exception as e:
        db.rollback()
        return jsonify({"error": f"Failed to vote on post: {str(e)}"}), 400
    finally:
        cur.close()


@posts_bp.route('/comments/<int:comment_id>/vote', methods=['POST'])
def vote_on_comment(comment_id):
    if 'user_id' not in session:
        return jsonify({"error": "Unauthorized"}), 401

    data = request.json or {}
    vote_value = data.get('vote_value')

    if vote_value not in (-1, 1):
        return jsonify({"error": "vote_value must be 1 or -1"}), 400

    db = get_db()
    cur = db.cursor()

    try:
        cur.execute("SELECT id FROM comments WHERE id = %s", (comment_id,))
        if not cur.fetchone():
            return jsonify({"error": "Comment not found"}), 404

        result = apply_vote(cur, 'comment_votes', 'comment_id', comment_id, session['user_id'], vote_value)
        db.commit()
        return jsonify(result), 200
    except Exception as e:
        db.rollback()
        return jsonify({"error": f"Failed to vote on comment: {str(e)}"}), 400
    finally:
        cur.close()

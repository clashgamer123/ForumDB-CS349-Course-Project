from flask import Blueprint, jsonify, request, session
from ..db_control.db import get_db
from .posts import fetch_posts_listing

users_bp = Blueprint('users', __name__)

DEFAULT_PROFILE_PIC = "/default-profile.svg"


def can_view_user(cur, viewer_id, target_user):
    if not target_user:
        return False
    if viewer_id == target_user["id"]:
        return True
    if not target_user.get("is_private"):
        return True

    cur.execute("""
        SELECT 1
        FROM user_follows
        WHERE follower_id = %s AND following_id = %s AND status = 'accepted'
    """, (viewer_id, target_user["id"]))
    return cur.fetchone() is not None


def add_follow_meta(cur, user, viewer_id):
    user["profile_pic_url"] = user.get("profile_pic_url") or DEFAULT_PROFILE_PIC
    user["is_self"] = viewer_id == user["id"]

    cur.execute("""
        SELECT status
        FROM user_follows
        WHERE follower_id = %s AND following_id = %s
    """, (viewer_id, user["id"]))
    relation = cur.fetchone()
    user["follow_status"] = relation["status"] if relation else "none"

    cur.execute("""
        SELECT
            COUNT(*) FILTER (WHERE following_id = %s AND status = 'accepted') AS followers_count,
            COUNT(*) FILTER (WHERE follower_id = %s AND status = 'accepted') AS following_count
        FROM user_follows
    """, (user["id"], user["id"]))
    counts = cur.fetchone() or {}
    user["followers_count"] = counts.get("followers_count", 0)
    user["following_count"] = counts.get("following_count", 0)
    return user


def fetch_user_comments(cur, user_id):
    cur.execute("""
        WITH vote_totals AS (
            SELECT
                comment_id,
                COUNT(*) FILTER (WHERE vote_value = 1) AS upvote_count,
                COUNT(*) FILTER (WHERE vote_value = -1) AS downvote_count,
                COALESCE(SUM(vote_value), 0) AS score
            FROM comment_votes
            GROUP BY comment_id
        ),
        current_user_votes AS (
            SELECT comment_id, vote_value
            FROM comment_votes
            WHERE user_id = %s
        )
        SELECT
            c.id,
            c.post_id,
            c.parent_comment_id,
            c.content,
            c.created_at,
            p.title AS post_title,
            p.community_id,
            comm.name AS community_name,
            COALESCE(vt.upvote_count, 0) AS upvote_count,
            COALESCE(vt.downvote_count, 0) AS downvote_count,
            COALESCE(vt.score, 0) AS score,
            COALESCE(cuv.vote_value, 0) AS user_vote
        FROM comments c
        JOIN posts p ON p.id = c.post_id
        JOIN communities comm ON comm.id = p.community_id
        LEFT JOIN vote_totals vt ON vt.comment_id = c.id
        LEFT JOIN current_user_votes cuv ON cuv.comment_id = c.id
        WHERE c.author_id = %s
        ORDER BY c.created_at DESC
        LIMIT 100
    """, (user_id, user_id))
    return cur.fetchall()


@users_bp.route('/me', methods=['GET'])
def get_my_profile():
    if 'user_id' not in session:
        return jsonify({"error": "Unauthorized"}), 401

    db = get_db()
    cur = db.cursor()
    user_id = session['user_id']

    try:
        cur.execute("""
            SELECT
                u.id,
                u.username,
                u.bio,
                u.profile_pic_url,
                u.is_private,
                u.display_name,
                u.location,
                u.created_at,
                COALESCE((
                    SELECT SUM(pv.vote_value)
                    FROM posts p
                    LEFT JOIN post_votes pv ON pv.post_id = p.id
                    WHERE p.author_id = u.id
                ), 0) AS post_karma,
                COALESCE((
                    SELECT SUM(cv.vote_value)
                    FROM comments c
                    LEFT JOIN comment_votes cv ON cv.comment_id = c.id
                    WHERE c.author_id = u.id
                ), 0) AS comment_karma,
                COALESCE((
                    SELECT COUNT(*)
                    FROM posts p
                    WHERE p.author_id = u.id
                ), 0) AS post_count,
                COALESCE((
                    SELECT COUNT(*)
                    FROM comments c
                    WHERE c.author_id = u.id
                ), 0) AS comment_count,
                COALESCE((
                    SELECT COUNT(*)
                    FROM community_members cm
                    WHERE cm.user_id = u.id
                ), 0) AS joined_communities_count
            FROM users u
            WHERE u.id = %s
        """, (user_id,))
        profile = cur.fetchone()

        if not profile:
            return jsonify({"error": "User not found"}), 404

        posts = fetch_posts_listing(
            cur,
            user_id,
            sort_mode="new",
            author_id=user_id,
            limit=100,
        )
        comments = fetch_user_comments(cur, user_id)

        profile["total_karma"] = profile["post_karma"] + profile["comment_karma"]
        add_follow_meta(cur, profile, user_id)

        cur.execute("""
            SELECT
                uf.follower_id,
                u.username,
                u.profile_pic_url,
                uf.created_at
            FROM user_follows uf
            JOIN users u ON u.id = uf.follower_id
            WHERE uf.following_id = %s AND uf.status = 'pending'
            ORDER BY uf.created_at DESC
        """, (user_id,))
        follow_requests = cur.fetchall()
        for follow_request in follow_requests:
            follow_request["profile_pic_url"] = follow_request.get("profile_pic_url") or DEFAULT_PROFILE_PIC

        return jsonify({
            "user": profile,
            "posts": posts,
            "comments": comments,
            "follow_requests": follow_requests,
        }), 200
    finally:
        cur.close()


@users_bp.route('/me', methods=['PATCH'])
def update_my_profile():
    if 'user_id' not in session:
        return jsonify({"error": "Unauthorized"}), 401

    data = request.json or {}
    db = get_db()
    cur = db.cursor()

    try:
        cur.execute("""
            UPDATE users
            SET
                bio = %s,
                profile_pic_url = %s,
                is_private = %s,
                display_name = %s,
                location = %s
            WHERE id = %s
            RETURNING id, username, bio, profile_pic_url, is_private, display_name, location, created_at
        """, (
            data.get("bio", ""),
            data.get("profile_pic_url") or None,
            bool(data.get("is_private", False)),
            data.get("display_name") or None,
            data.get("location") or None,
            session['user_id'],
        ))
        user = cur.fetchone()
        db.commit()
        add_follow_meta(cur, user, session['user_id'])
        return jsonify(user), 200
    except Exception as e:
        db.rollback()
        return jsonify({"error": f"Failed to update profile: {str(e)}"}), 400
    finally:
        cur.close()


@users_bp.route('/<username>', methods=['GET'])
def get_public_profile(username):
    if 'user_id' not in session:
        return jsonify({"error": "Unauthorized"}), 401

    db = get_db()
    cur = db.cursor()

    try:
        cur.execute("""
            SELECT
                u.id,
                u.username,
                u.bio,
                u.profile_pic_url,
                u.is_private,
                u.display_name,
                u.location,
                u.created_at,
                COALESCE((
                    SELECT SUM(pv.vote_value)
                    FROM posts p
                    LEFT JOIN post_votes pv ON pv.post_id = p.id
                    WHERE p.author_id = u.id
                ), 0) AS post_karma,
                COALESCE((
                    SELECT SUM(cv.vote_value)
                    FROM comments c
                    LEFT JOIN comment_votes cv ON cv.comment_id = c.id
                    WHERE c.author_id = u.id
                ), 0) AS comment_karma,
                COALESCE((SELECT COUNT(*) FROM posts p WHERE p.author_id = u.id), 0) AS post_count,
                COALESCE((SELECT COUNT(*) FROM comments c WHERE c.author_id = u.id), 0) AS comment_count,
                COALESCE((SELECT COUNT(*) FROM community_members cm WHERE cm.user_id = u.id), 0) AS joined_communities_count
            FROM users u
            WHERE u.username = %s
        """, (username,))
        profile = cur.fetchone()

        if not profile:
            return jsonify({"error": "User not found"}), 404

        add_follow_meta(cur, profile, session['user_id'])
        can_view = can_view_user(cur, session['user_id'], profile)
        profile["can_view"] = can_view
        profile["total_karma"] = profile["post_karma"] + profile["comment_karma"]

        posts = []
        comments = []
        if can_view:
            posts = fetch_posts_listing(
                cur,
                session['user_id'],
                sort_mode="new",
                author_id=profile["id"],
                limit=100,
            )
            comments = fetch_user_comments(cur, profile["id"])

        return jsonify({
            "user": profile,
            "posts": posts,
            "comments": comments,
        }), 200
    finally:
        cur.close()


@users_bp.route('/search', methods=['GET'])
def search_users():
    if 'user_id' not in session:
        return jsonify({"error": "Unauthorized"}), 401

    query = (request.args.get("q", "") or "").strip()
    if not query:
        return jsonify([]), 200

    db = get_db()
    cur = db.cursor()
    like_query = f"%{query}%"
    try:
        cur.execute("""
            SELECT id, username, profile_pic_url, bio, is_private
            FROM users
            WHERE username ILIKE %s AND id <> %s
            ORDER BY username
            LIMIT 12
        """, (like_query, session['user_id']))
        users = cur.fetchall()
        for user in users:
            add_follow_meta(cur, user, session['user_id'])
        return jsonify(users), 200
    finally:
        cur.close()


@users_bp.route('/<int:user_id>/follow', methods=['POST'])
def follow_user(user_id):
    if 'user_id' not in session:
        return jsonify({"error": "Unauthorized"}), 401
    if user_id == session['user_id']:
        return jsonify({"error": "You cannot follow yourself"}), 400

    db = get_db()
    cur = db.cursor()

    try:
        cur.execute("SELECT id, is_private FROM users WHERE id = %s", (user_id,))
        target = cur.fetchone()
        if not target:
            return jsonify({"error": "User not found"}), 404

        status = "pending" if target["is_private"] else "accepted"
        cur.execute("""
            INSERT INTO user_follows (follower_id, following_id, status, updated_at)
            VALUES (%s, %s, %s, CURRENT_TIMESTAMP)
            ON CONFLICT (follower_id, following_id)
            DO UPDATE SET status = EXCLUDED.status, updated_at = CURRENT_TIMESTAMP
            RETURNING status
        """, (session['user_id'], user_id, status))
        relation = cur.fetchone()
        db.commit()
        return jsonify({"status": relation["status"]}), 200
    except Exception as e:
        db.rollback()
        return jsonify({"error": f"Failed to follow user: {str(e)}"}), 400
    finally:
        cur.close()


@users_bp.route('/<int:user_id>/follow', methods=['DELETE'])
def unfollow_user(user_id):
    if 'user_id' not in session:
        return jsonify({"error": "Unauthorized"}), 401

    db = get_db()
    cur = db.cursor()
    try:
        cur.execute("""
            DELETE FROM user_follows
            WHERE follower_id = %s AND following_id = %s
        """, (session['user_id'], user_id))
        db.commit()
        return jsonify({"status": "none"}), 200
    finally:
        cur.close()


@users_bp.route('/follow-requests/<int:follower_id>', methods=['POST'])
def respond_to_follow_request(follower_id):
    if 'user_id' not in session:
        return jsonify({"error": "Unauthorized"}), 401

    data = request.json or {}
    action = data.get("action")
    if action not in ("accept", "reject"):
        return jsonify({"error": "action must be accept or reject"}), 400

    db = get_db()
    cur = db.cursor()
    try:
        if action == "accept":
            cur.execute("""
                UPDATE user_follows
                SET status = 'accepted', updated_at = CURRENT_TIMESTAMP
                WHERE follower_id = %s AND following_id = %s AND status = 'pending'
                RETURNING status
            """, (follower_id, session['user_id']))
            updated = cur.fetchone()
            if not updated:
                return jsonify({"error": "Follow request not found"}), 404
            db.commit()
            return jsonify({"status": "accepted"}), 200

        cur.execute("""
            DELETE FROM user_follows
            WHERE follower_id = %s AND following_id = %s AND status = 'pending'
        """, (follower_id, session['user_id']))
        db.commit()
        return jsonify({"status": "rejected"}), 200
    except Exception as e:
        db.rollback()
        return jsonify({"error": f"Failed to update follow request: {str(e)}"}), 400
    finally:
        cur.close()

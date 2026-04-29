from flask import Blueprint, jsonify, session
from ..db_control.db import get_db
from .posts import fetch_posts_listing

users_bp = Blueprint('users', __name__)


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

        return jsonify({
            "user": profile,
            "posts": posts,
            "comments": comments,
        }), 200
    finally:
        cur.close()

from flask import Blueprint, jsonify, request, session
from ..db_control.db import get_db

messages_bp = Blueprint('messages', __name__)


def can_message_user(cur, sender_id, recipient_id):
    cur.execute("""
        SELECT 1
        FROM user_follows
        WHERE follower_id = %s AND following_id = %s AND status = 'accepted'
    """, (sender_id, recipient_id))
    return cur.fetchone() is not None


@messages_bp.route('/threads', methods=['GET'])
def get_threads():
    if 'user_id' not in session:
        return jsonify({"error": "Unauthorized"}), 401

    db = get_db()
    cur = db.cursor()
    user_id = session['user_id']

    try:
        cur.execute("""
            WITH thread_messages AS (
                SELECT
                    CASE WHEN sender_id = %s THEN recipient_id ELSE sender_id END AS other_user_id,
                    MAX(created_at) AS last_message_at
                FROM messages
                WHERE sender_id = %s OR recipient_id = %s
                GROUP BY other_user_id
            )
            SELECT
                tm.other_user_id,
                tm.last_message_at,
                u.username,
                COALESCE(u.profile_pic_url, '/default-profile.svg') AS profile_pic_url,
                m.content AS last_content,
                m.media_type AS last_media_type,
                m.share_type AS last_share_type
            FROM thread_messages tm
            JOIN users u ON u.id = tm.other_user_id
            JOIN LATERAL (
                SELECT content, media_type, share_type
                FROM messages
                WHERE (
                    sender_id = %s AND recipient_id = tm.other_user_id
                ) OR (
                    sender_id = tm.other_user_id AND recipient_id = %s
                )
                ORDER BY created_at DESC
                LIMIT 1
            ) m ON TRUE
            ORDER BY tm.last_message_at DESC
        """, (user_id, user_id, user_id, user_id, user_id))
        return jsonify(cur.fetchall()), 200
    finally:
        cur.close()


@messages_bp.route('/<int:other_user_id>', methods=['GET'])
def get_thread(other_user_id):
    if 'user_id' not in session:
        return jsonify({"error": "Unauthorized"}), 401

    db = get_db()
    cur = db.cursor()
    user_id = session['user_id']

    try:
        cur.execute("""
            SELECT id, username, COALESCE(profile_pic_url, '/default-profile.svg') AS profile_pic_url
            FROM users
            WHERE id = %s
        """, (other_user_id,))
        other_user = cur.fetchone()
        if not other_user:
            return jsonify({"error": "User not found"}), 404

        cur.execute("""
            SELECT *
            FROM messages
            WHERE (sender_id = %s AND recipient_id = %s)
               OR (sender_id = %s AND recipient_id = %s)
            ORDER BY created_at ASC
            LIMIT 200
        """, (user_id, other_user_id, other_user_id, user_id))

        return jsonify({
            "user": other_user,
            "messages": cur.fetchall(),
            "can_message": can_message_user(cur, user_id, other_user_id),
        }), 200
    finally:
        cur.close()


@messages_bp.route('/<int:recipient_id>', methods=['POST'])
def send_message(recipient_id):
    if 'user_id' not in session:
        return jsonify({"error": "Unauthorized"}), 401

    data = request.json or {}
    content = (data.get("content") or "").strip()
    media_url = data.get("media_url") or None
    media_type = data.get("media_type") or None
    share_type = data.get("share_type") or None
    share_id = data.get("share_id")

    if share_type not in (None, "community", "post"):
        return jsonify({"error": "Only posts and communities can be shared"}), 400

    if not content and not media_url and not share_type:
        return jsonify({"error": "Message needs text, media, or a shared item"}), 400

    db = get_db()
    cur = db.cursor()

    try:
        cur.execute("SELECT id FROM users WHERE id = %s", (recipient_id,))
        if not cur.fetchone():
            return jsonify({"error": "Recipient not found"}), 404

        if not can_message_user(cur, session['user_id'], recipient_id):
            return jsonify({"error": "You can message users you follow after they accept"}), 403

        cur.execute("""
            INSERT INTO messages (
                sender_id, recipient_id, content, media_url, media_type, share_type, share_id
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            RETURNING *
        """, (
            session['user_id'],
            recipient_id,
            content,
            media_url,
            media_type,
            share_type,
            share_id,
        ))
        message = cur.fetchone()
        db.commit()
        return jsonify(message), 201
    except Exception as e:
        db.rollback()
        return jsonify({"error": f"Failed to send message: {str(e)}"}), 400
    finally:
        cur.close()

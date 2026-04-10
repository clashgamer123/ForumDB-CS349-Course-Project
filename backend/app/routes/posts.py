from flask import Blueprint, request, jsonify, session
from ..db_control.db import get_db

posts_bp = Blueprint('posts', __name__)

# 1. Create a Post
@posts_bp.route('/', methods=['POST'])
def create_post():
    if 'user_id' not in session:
        return jsonify({"error": "Unauthorized"}), 401
        
    data = request.json
    db = get_db()
    cur = db.cursor()
    
    try:
        cur.execute("""
            INSERT INTO posts (title, content, author_id, community_id)
            VALUES (%s, %s, %s, %s) RETURNING id, title, created_at
        """, (data['title'], data['content'], session['user_id'], data['community_id']))
        new_post = cur.fetchone()
        db.commit()
        return jsonify(new_post), 201
    except Exception as e:
        db.rollback()
        return jsonify({"error": "Failed to create post"}), 400
    finally:
        cur.close()

# 2. Get User's Home Feed (Posts from joined communities)
@posts_bp.route('/feed', methods=['GET'])
def get_home_feed():
    if 'user_id' not in session:
        return jsonify({"error": "Unauthorized"}), 401
        
    db = get_db()
    cur = db.cursor()
    # Join Posts -> Communities -> Community_Members to filter by the user's subscriptions
    # We also join Users to get the author's username
    cur.execute("""
        SELECT p.id, p.title, p.content, p.created_at, 
               u.username as author_name, c.name as community_name
        FROM posts p
        JOIN users u ON p.author_id = u.id
        JOIN communities c ON p.community_id = c.id
        JOIN community_members cm ON c.id = cm.community_id
        WHERE cm.user_id = %s
        ORDER BY p.created_at DESC
        LIMIT 50
    """, (session['user_id'],))
    feed = cur.fetchall()
    cur.close()
    return jsonify(feed), 200

# 3. Get posts for a specific community
@posts_bp.route('/community/<int:community_id>', methods=['GET'])
def get_community_posts(community_id):
    db = get_db()
    cur = db.cursor()
    cur.execute("""
        SELECT p.id, p.title, p.content, p.created_at, u.username as author_name
        FROM posts p
        JOIN users u ON p.author_id = u.id
        WHERE p.community_id = %s
        ORDER BY p.created_at DESC
    """, (community_id,))
    posts = cur.fetchall()
    cur.close()
    return jsonify(posts), 200

# 4. Get a single post by ID
@posts_bp.route('/<int:post_id>', methods=['GET'])
def get_single_post(post_id):
    db = get_db()
    cur = db.cursor()
    cur.execute("""
        SELECT p.*, u.username as author_name, c.name as community_name 
        FROM posts p
        JOIN users u ON p.author_id = u.id
        JOIN communities c ON p.community_id = c.id
        WHERE p.id = %s
    """, (post_id,))
    post = cur.fetchone()
    cur.close()
    
    if post:
        return jsonify(post), 200
    return jsonify({"error": "Post not found"}), 404
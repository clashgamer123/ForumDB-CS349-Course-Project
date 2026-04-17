from flask import Blueprint, request, jsonify, session
from ..db_control.db import get_db

posts_bp = Blueprint('posts', __name__)

# 1. Create a Post (with optional multiple media items)
@posts_bp.route('/', methods=['POST'])
def create_post():
    if 'user_id' not in session:
        return jsonify({"error": "Unauthorized"}), 401
        
    data = request.json
    db = get_db()
    cur = db.cursor()
    
    try:
        # Insert the post
        cur.execute("""
            INSERT INTO posts (title, content, author_id, community_id)
            VALUES (%s, %s, %s, %s) RETURNING id, title, created_at
        """, (data['title'], data['content'], session['user_id'], data['community_id']))
        new_post = cur.fetchone()
        post_id = new_post['id']
        
        # Insert media items if provided
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

# 2. Get User's Home Feed (Posts from joined communities WITH media)
@posts_bp.route('/feed', methods=['GET'])
def get_home_feed():
    if 'user_id' not in session:
        return jsonify({"error": "Unauthorized"}), 401
        
    db = get_db()
    cur = db.cursor()
    
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
    
    # For each post, fetch its media
    for post in feed:
        cur.execute("""
            SELECT id, media_type, media_url, caption, position
            FROM post_media
            WHERE post_id = %s
            ORDER BY position ASC
        """, (post['id'],))
        post['media'] = cur.fetchall()
    
    cur.close()
    return jsonify(feed), 200

# 3. Get posts for a specific community WITH media
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
    
    # For each post, fetch its media
    for post in posts:
        cur.execute("""
            SELECT id, media_type, media_url, caption, position
            FROM post_media
            WHERE post_id = %s
            ORDER BY position ASC
        """, (post['id'],))
        post['media'] = cur.fetchall()
    
    cur.close()
    return jsonify(posts), 200

# 4. Get a single post by ID WITH media
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
    
    if post:
        # Fetch media for this post
        cur.execute("""
            SELECT id, media_type, media_url, caption, position
            FROM post_media
            WHERE post_id = %s
            ORDER BY position ASC
        """, (post_id,))
        post['media'] = cur.fetchall()
        cur.close()
        return jsonify(post), 200
    
    cur.close()
    return jsonify({"error": "Post not found"}), 404
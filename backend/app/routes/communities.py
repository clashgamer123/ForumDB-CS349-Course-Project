from flask import Blueprint, request, jsonify, session
from ..db_control.db import get_db

communities_bp = Blueprint('communities', __name__)


def is_community_member(cur, community_id, user_id):
    cur.execute("""
        SELECT 1
        FROM community_members
        WHERE community_id = %s AND user_id = %s
    """, (community_id, user_id))
    return cur.fetchone() is not None

# 1. Get all communities (for browsing)
@communities_bp.route('/', methods=['GET'])
def get_all_communities():
    db = get_db()
    cur = db.cursor()
    cur.execute("SELECT * FROM communities ORDER BY created_at DESC")
    communities = cur.fetchall()
    cur.close()
    return jsonify(communities), 200

# 2. Get user's joined communities
@communities_bp.route('/my', methods=['GET'])
def get_my_communities():
    if 'user_id' not in session:
        return jsonify({"error": "Unauthorized"}), 401
        
    db = get_db()
    cur = db.cursor()
    # INNER JOIN to get community details only for the ones the user joined
    cur.execute("""
        SELECT c.* FROM communities c
        JOIN community_members cm ON c.id = cm.community_id
        WHERE cm.user_id = %s
    """, (session['user_id'],))
    communities = cur.fetchall()
    cur.close()
    return jsonify(communities), 200

# 2b. Get a single community
@communities_bp.route('/<int:community_id>', methods=['GET'])
def get_single_community(community_id):
    if 'user_id' not in session:
        return jsonify({"error": "Unauthorized"}), 401

    db = get_db()
    cur = db.cursor()

    if not is_community_member(cur, community_id, session['user_id']):
        cur.close()
        return jsonify({"error": "Join this community to open it"}), 403

    cur.execute("""
        SELECT c.*, u.username AS creator_name
        FROM communities c
        JOIN users u ON u.id = c.created_by
        WHERE c.id = %s
    """, (community_id,))
    community = cur.fetchone()
    cur.close()

    if not community:
        return jsonify({"error": "Community not found"}), 404

    return jsonify(community), 200

# 3. Create a new community
@communities_bp.route('/', methods=['POST'])
def create_community():
    if 'user_id' not in session:
        return jsonify({"error": "Unauthorized"}), 401
        
    data = request.json
    db = get_db()
    cur = db.cursor()
    
    try:
        # Create the community
        cur.execute("""
            INSERT INTO communities (name, display_name, description, created_by)
            VALUES (%s, %s, %s, %s) RETURNING id, name, display_name
        """, (data['name'], data['display_name'], data.get('description', ''), session['user_id']))
        new_community = cur.fetchone()
        
        # Automatically make the creator a member
        cur.execute("""
            INSERT INTO community_members (community_id, user_id)
            VALUES (%s, %s)
        """, (new_community['id'], session['user_id']))
        
        db.commit()
        return jsonify(new_community), 201
    except Exception as e:
        db.rollback()
        return jsonify({"error": "Community name might already exist"}), 400
    finally:
        cur.close()

# 4. Join a community
@communities_bp.route('/<int:community_id>/join', methods=['POST'])
def join_community(community_id):
    if 'user_id' not in session:
        return jsonify({"error": "Unauthorized"}), 401
        
    db = get_db()
    cur = db.cursor()
    try:
        cur.execute(
            "INSERT INTO community_members (community_id, user_id) VALUES (%s, %s)",
            (community_id, session['user_id'])
        )
        cur.execute(
            "UPDATE communities SET members_count = members_count + 1 WHERE id = %s",
            (community_id,)
        )
        db.commit()
        return jsonify({"message": "Joined successfully"}), 200
    except Exception as e:
        db.rollback()
        return jsonify({"error": "Already a member or community doesn't exist"}), 400
    finally:
        cur.close()

# 5. Leave a community
@communities_bp.route('/<int:community_id>/leave', methods=['POST'])
def leave_community(community_id):
    if 'user_id' not in session:
        return jsonify({"error": "Unauthorized"}), 401
        
    db = get_db()
    cur = db.cursor()
    try:
        cur.execute(
            "DELETE FROM community_members WHERE community_id = %s AND user_id = %s",
            (community_id, session['user_id'])
        )
        # Only decrement if a row was actually deleted
        if cur.rowcount > 0:
            cur.execute(
                "UPDATE communities SET members_count = members_count - 1 WHERE id = %s",
                (community_id,)
            )
        db.commit()
        return jsonify({"message": "Left successfully"}), 200
    except Exception as e:
        db.rollback()
        return jsonify({"error": "Failed to leave"}), 400
    finally:
        cur.close()

# 6. Search communities (Basic ILIKE search)
@communities_bp.route('/search', methods=['GET'])
def search_communities():
    query = request.args.get('q', '')
    db = get_db()
    cur = db.cursor()
    # ILIKE is case-insensitive in PostgreSQL
    search_term = f"%{query}%"
    cur.execute("""
        SELECT * FROM communities 
        WHERE name ILIKE %s OR display_name ILIKE %s
    """, (search_term, search_term))
    results = cur.fetchall()
    cur.close()
    return jsonify(results), 200

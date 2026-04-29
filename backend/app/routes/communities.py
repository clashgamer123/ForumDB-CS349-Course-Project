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


def record_community_visit(cur, community_id, user_id):
    cur.execute("""
        INSERT INTO user_community_visits (user_id, community_id, visit_count, last_visited_at)
        VALUES (%s, %s, 1, CURRENT_TIMESTAMP)
        ON CONFLICT (user_id, community_id)
        DO UPDATE SET
            visit_count = user_community_visits.visit_count + 1,
            last_visited_at = CURRENT_TIMESTAMP
    """, (user_id, community_id))


def annotate_communities(cur, communities, user_id):
    if not communities or not user_id:
        for community in communities:
            community["is_joined"] = False
            community["visit_count"] = 0
        return communities

    community_ids = [community["id"] for community in communities]
    cur.execute("""
        SELECT
            c.id,
            EXISTS (
                SELECT 1
                FROM community_members cm
                WHERE cm.community_id = c.id AND cm.user_id = %s
            ) AS is_joined,
            COALESCE(ucv.visit_count, 0) AS visit_count
        FROM communities c
        LEFT JOIN user_community_visits ucv
          ON ucv.community_id = c.id AND ucv.user_id = %s
        WHERE c.id = ANY(%s)
    """, (user_id, user_id, community_ids))

    meta_by_id = {row["id"]: row for row in cur.fetchall()}
    for community in communities:
        meta = meta_by_id.get(community["id"], {})
        community["is_joined"] = bool(meta.get("is_joined"))
        community["visit_count"] = meta.get("visit_count", 0)
    return communities


# 1. Get all communities (for browsing)
@communities_bp.route('/', methods=['GET'])
def get_all_communities():
    db = get_db()
    cur = db.cursor()
    cur.execute("SELECT * FROM communities ORDER BY created_at DESC")
    communities = cur.fetchall()
    annotate_communities(cur, communities, session.get('user_id'))
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
        SELECT c.*, TRUE AS is_joined, COALESCE(ucv.visit_count, 0) AS visit_count
        FROM communities c
        JOIN community_members cm ON c.id = cm.community_id
        LEFT JOIN user_community_visits ucv
          ON ucv.community_id = c.id AND ucv.user_id = cm.user_id
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

    cur.execute("""
        SELECT
            c.*,
            u.username AS creator_name,
            EXISTS (
                SELECT 1
                FROM community_members cm
                WHERE cm.community_id = c.id AND cm.user_id = %s
            ) AS is_joined,
            COALESCE(ucv.visit_count, 0) AS visit_count
        FROM communities c
        JOIN users u ON u.id = c.created_by
        LEFT JOIN user_community_visits ucv
          ON ucv.community_id = c.id AND ucv.user_id = %s
        WHERE c.id = %s
    """, (session['user_id'], session['user_id'], community_id))
    community = cur.fetchone()

    if not community:
        cur.close()
        return jsonify({"error": "Community not found"}), 404

    if community['is_private'] and not community['is_joined']:
        cur.close()
        return jsonify({
            "error": "This is a private community. Join it to open posts.",
            "community": community
        }), 403

    record_community_visit(cur, community_id, session['user_id'])
    db.commit()
    community["visit_count"] = (community.get("visit_count") or 0) + 1
    cur.close()

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
            INSERT INTO communities (name, display_name, description, is_private, created_by)
            VALUES (%s, %s, %s, %s, %s) RETURNING id, name, display_name, is_private
        """, (
            data['name'],
            data['display_name'],
            data.get('description', ''),
            bool(data.get('is_private', False)),
            session['user_id']
        ))
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


@communities_bp.route('/<int:community_id>', methods=['PATCH'])
def update_community(community_id):
    if 'user_id' not in session:
        return jsonify({"error": "Unauthorized"}), 401

    data = request.json or {}
    db = get_db()
    cur = db.cursor()

    try:
        cur.execute("SELECT created_by FROM communities WHERE id = %s", (community_id,))
        community = cur.fetchone()
        if not community:
            return jsonify({"error": "Community not found"}), 404
        if community['created_by'] != session['user_id']:
            return jsonify({"error": "Only the creator can update community privacy"}), 403

        cur.execute("""
            UPDATE communities
            SET is_private = %s
            WHERE id = %s
            RETURNING *
        """, (bool(data.get('is_private', False)), community_id))
        updated = cur.fetchone()
        db.commit()
        return jsonify(updated), 200
    except Exception as e:
        db.rollback()
        return jsonify({"error": f"Failed to update community: {str(e)}"}), 400
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

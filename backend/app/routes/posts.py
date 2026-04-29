from flask import Blueprint, request, jsonify, session
from ..db_control.db import get_db

posts_bp = Blueprint('posts', __name__)

VALID_FEED_SORTS = {"hot", "new", "top", "rising", "controversial"}


def is_community_member(cur, community_id, user_id):
    cur.execute("""
        SELECT 1
        FROM community_members
        WHERE community_id = %s AND user_id = %s
    """, (community_id, user_id))
    return cur.fetchone() is not None


def fetch_community_access(cur, community_id, user_id):
    cur.execute("""
        SELECT
            c.id,
            c.is_private,
            EXISTS (
                SELECT 1
                FROM community_members cm
                WHERE cm.community_id = c.id AND cm.user_id = %s
            ) AS is_joined
        FROM communities c
        WHERE c.id = %s
    """, (user_id, community_id))
    return cur.fetchone()


def can_access_community(cur, community_id, user_id):
    community = fetch_community_access(cur, community_id, user_id)
    if not community:
        return None
    community["can_access"] = (not community["is_private"]) or community["is_joined"]
    return community


def normalize_sort_mode(sort_mode):
    normalized = (sort_mode or "hot").strip().lower()
    return normalized if normalized in VALID_FEED_SORTS else "hot"


def fetch_post_media(cur, post_id):
    cur.execute("""
        SELECT id, media_type, media_url, caption, position
        FROM post_media
        WHERE post_id = %s
        ORDER BY position ASC
    """, (post_id,))
    return cur.fetchall()


def attach_media_to_posts(cur, posts):
    if not posts:
        return posts

    post_ids = [post["id"] for post in posts]
    cur.execute("""
        SELECT post_id, id, media_type, media_url, caption, position
        FROM post_media
        WHERE post_id = ANY(%s)
        ORDER BY post_id ASC, position ASC
    """, (post_ids,))

    media_by_post = {}
    for row in cur.fetchall():
        media_by_post.setdefault(row["post_id"], []).append({
            "id": row["id"],
            "media_type": row["media_type"],
            "media_url": row["media_url"],
            "caption": row["caption"],
            "position": row["position"],
        })

    for post in posts:
        post["media"] = media_by_post.get(post["id"], [])

    return posts


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


def build_post_order_clause(sort_mode, has_search=False):
    order_clauses = []
    if has_search:
        order_clauses.append("search_rank DESC")

    sort_orders = {
        "new": """
            p.created_at DESC
        """,
        "top": """
            COALESCE(vt.score, 0) DESC,
            COALESCE(ct.comment_count, 0) DESC,
            p.created_at DESC
        """,
        "rising": """
            (
                (
                    COALESCE(vt.upvote_count, 0) * 1.0
                    + COALESCE(ct.comment_count, 0) * 0.75
                    - COALESCE(vt.downvote_count, 0) * 0.25
                )
                / POWER(
                    GREATEST(EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - p.created_at)) / 3600.0 + 2.0, 2.0),
                    1.35
                )
            ) DESC,
            COALESCE(vt.score, 0) DESC,
            p.created_at DESC
        """,
        "controversial": """
            (
                CASE
                    WHEN COALESCE(vt.upvote_count, 0) = 0 OR COALESCE(vt.downvote_count, 0) = 0 THEN 0
                    ELSE (
                        LEAST(COALESCE(vt.upvote_count, 0), COALESCE(vt.downvote_count, 0))::numeric
                        / GREATEST(COALESCE(vt.upvote_count, 0), COALESCE(vt.downvote_count, 0))
                    ) * (COALESCE(vt.upvote_count, 0) + COALESCE(vt.downvote_count, 0))
                END
            ) DESC,
            COALESCE(vt.score, 0) DESC,
            p.created_at DESC
        """,
        "hot": """
            (
                CASE
                    WHEN COALESCE(vt.score, 0) = 0 THEN 0
                    ELSE SIGN(COALESCE(vt.score, 0)) * LN(GREATEST(ABS(COALESCE(vt.score, 0)), 1) + 1)
                END
                + EXTRACT(EPOCH FROM p.created_at) / 45000.0
            ) DESC,
            COALESCE(ct.comment_count, 0) DESC,
            p.created_at DESC
        """,
    }

    order_clauses.append(sort_orders.get(sort_mode, sort_orders["hot"]).strip())
    return ", ".join(order_clauses)


def fetch_posts_listing(
    cur,
    current_user_id,
    *,
    sort_mode="hot",
    search_query="",
    community_id=None,
    joined_only=False,
    home_scope=False,
    following_authors_only=False,
    author_id=None,
    limit=50,
):
    sort_mode = normalize_sort_mode(sort_mode)
    search_query = (search_query or "").strip()
    like_query = f"%{search_query}%"

    select_params = []
    join_params = []
    where_params = []
    where_clauses = ["TRUE"]

    membership_join = ""
    if joined_only:
        membership_join = """
            JOIN community_members cm
              ON cm.community_id = c.id
             AND cm.user_id = %s
        """
        join_params.append(current_user_id)

    if home_scope:
        where_clauses.append("""
            (
                cm_home.user_id IS NOT NULL
                OR (c.is_private = FALSE AND ucv_home.user_id IS NOT NULL)
            )
        """)

    if community_id is not None:
        where_clauses.append("p.community_id = %s")
        where_params.append(community_id)

    if author_id is not None:
        where_clauses.append("p.author_id = %s")
        where_params.append(author_id)
        where_clauses.append("(c.is_private = FALSE OR cm_home.user_id IS NOT NULL)")

    if following_authors_only:
        where_clauses.append("""
            EXISTS (
                SELECT 1
                FROM user_follows uf
                WHERE uf.follower_id = %s
                  AND uf.following_id = p.author_id
                  AND uf.status = 'accepted'
            )
        """)
        where_params.append(current_user_id)
        where_clauses.append("(c.is_private = FALSE OR cm_home.user_id IS NOT NULL)")

    search_rank_sql = "0::real AS search_rank"
    if search_query:
        search_rank_sql = """
            ts_rank_cd(p.search_vector, websearch_to_tsquery('english', %s)) AS search_rank
        """
        select_params.append(search_query)
        where_clauses.append("""
            (
                p.search_vector @@ websearch_to_tsquery('english', %s)
                OR p.title ILIKE %s
                OR p.content ILIKE %s
            )
        """)
        where_params.extend([search_query, like_query, like_query])

    cur.execute(f"""
        WITH vote_totals AS (
            SELECT
                post_id,
                COUNT(*) FILTER (WHERE vote_value = 1) AS upvote_count,
                COUNT(*) FILTER (WHERE vote_value = -1) AS downvote_count,
                COALESCE(SUM(vote_value), 0) AS score
            FROM post_votes
            GROUP BY post_id
        ),
        comment_totals AS (
            SELECT post_id, COUNT(*) AS comment_count
            FROM comments
            GROUP BY post_id
        ),
        current_user_votes AS (
            SELECT post_id, vote_value
            FROM post_votes
            WHERE user_id = %s
        )
        SELECT
            p.id,
            p.title,
            p.content,
            p.created_at,
            p.community_id,
            p.author_id,
            u.username AS author_name,
            u.profile_pic_url AS author_profile_pic_url,
            c.name AS community_name,
            c.display_name AS community_display_name,
            c.is_private AS community_is_private,
            COALESCE(cm_home.user_id IS NOT NULL, FALSE) AS is_joined,
            COALESCE(ucv_home.visit_count, 0) AS visit_count,
            COALESCE(vt.upvote_count, 0) AS upvote_count,
            COALESCE(vt.downvote_count, 0) AS downvote_count,
            COALESCE(vt.score, 0) AS score,
            COALESCE(uv.vote_value, 0) AS user_vote,
            COALESCE(ct.comment_count, 0) AS comment_count,
            {search_rank_sql}
        FROM posts p
        JOIN users u ON u.id = p.author_id
        JOIN communities c ON c.id = p.community_id
        {membership_join}
        LEFT JOIN community_members cm_home
          ON cm_home.community_id = c.id AND cm_home.user_id = %s
        LEFT JOIN user_community_visits ucv_home
          ON ucv_home.community_id = c.id AND ucv_home.user_id = %s
        LEFT JOIN vote_totals vt ON vt.post_id = p.id
        LEFT JOIN comment_totals ct ON ct.post_id = p.id
        LEFT JOIN current_user_votes uv ON uv.post_id = p.id
        WHERE {" AND ".join(where_clauses)}
        ORDER BY
            CASE
                WHEN {str(bool(home_scope)).upper()} AND ucv_home.user_id IS NOT NULL THEN 1
                ELSE 0
            END DESC,
            {build_post_order_clause(sort_mode, bool(search_query))}
        LIMIT {int(limit)}
    """, [current_user_id] + select_params + join_params + [current_user_id, current_user_id] + where_params)

    posts = cur.fetchall()
    attach_media_to_posts(cur, posts)
    return posts


def search_home_communities(cur, current_user_id, search_query, limit=6):
    search_query = (search_query or "").strip()
    if not search_query:
        return []

    like_query = f"%{search_query}%"
    community_vector = """
        to_tsvector(
            'english',
            coalesce(c.name, '') || ' ' || coalesce(c.display_name, '') || ' ' || coalesce(c.description, '')
        )
    """

    cur.execute(f"""
        SELECT
            c.id,
            c.name,
            c.display_name,
            c.description,
            c.is_private,
            c.members_count,
            c.created_at,
            EXISTS (
                SELECT 1
                FROM community_members cm
                WHERE cm.community_id = c.id AND cm.user_id = %s
            ) AS is_joined,
            ts_rank_cd({community_vector}, websearch_to_tsquery('english', %s)) AS search_rank
        FROM communities c
        WHERE
            {community_vector} @@ websearch_to_tsquery('english', %s)
            OR c.name ILIKE %s
            OR c.display_name ILIKE %s
            OR c.description ILIKE %s
        ORDER BY
            CASE
                WHEN c.name ILIKE %s THEN 3
                WHEN c.display_name ILIKE %s THEN 2
                WHEN c.description ILIKE %s THEN 1
                ELSE 0
            END DESC,
            search_rank DESC,
            c.members_count DESC,
            c.created_at DESC
        LIMIT {int(limit)}
    """, [
        current_user_id,
        search_query,
        search_query,
        like_query,
        like_query,
        like_query,
        like_query,
        like_query,
        like_query,
    ])

    return cur.fetchall()


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
        community = can_access_community(cur, data['community_id'], session['user_id'])
        if not community:
            return jsonify({"error": "Community not found"}), 404
        if community['is_private'] and not community['is_joined']:
            return jsonify({"error": "Join this private community before posting"}), 403

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

    sort_mode = normalize_sort_mode(request.args.get("sort"))
    search_query = (request.args.get("q", "") or "").strip()
    feed_filter = (request.args.get("filter", "all") or "all").strip().lower()
    following_only = feed_filter == "following"

    db = get_db()
    cur = db.cursor()

    try:
        posts = fetch_posts_listing(
            cur,
            session['user_id'],
            sort_mode=sort_mode,
            search_query=search_query,
            home_scope=not following_only,
            following_authors_only=following_only,
            limit=50,
        )
        communities = search_home_communities(cur, session['user_id'], search_query)

        return jsonify({
            "sort": sort_mode,
            "query": search_query,
            "filter": "following" if following_only else "all",
            "communities": communities,
            "posts": posts,
        }), 200
    finally:
        cur.close()


@posts_bp.route('/community/<int:community_id>', methods=['GET'])
def get_community_posts(community_id):
    if 'user_id' not in session:
        return jsonify({"error": "Unauthorized"}), 401

    sort_mode = normalize_sort_mode(request.args.get("sort"))
    search_query = (request.args.get("q", "") or "").strip()

    db = get_db()
    cur = db.cursor()

    try:
        community = can_access_community(cur, community_id, session['user_id'])
        if not community:
            return jsonify({"error": "Community not found"}), 404
        if not community["can_access"]:
            return jsonify({"error": "Join this private community to view posts"}), 403

        posts = fetch_posts_listing(
            cur,
            session['user_id'],
            sort_mode=sort_mode,
            search_query=search_query,
            community_id=community_id,
            limit=100,
        )

        return jsonify({
            "sort": sort_mode,
            "query": search_query,
            "posts": posts,
        }), 200
    finally:
        cur.close()


@posts_bp.route('/<int:post_id>', methods=['GET'])
def get_single_post(post_id):
    db = get_db()
    cur = db.cursor()

    try:
        cur.execute("""
            SELECT
                p.*,
                u.username AS author_name,
                u.profile_pic_url AS author_profile_pic_url,
                c.name AS community_name,
                c.display_name AS community_display_name,
                c.is_private AS community_is_private,
                EXISTS (
                    SELECT 1
                    FROM community_members cm
                    WHERE cm.community_id = c.id AND cm.user_id = %s
                ) AS is_joined
            FROM posts p
            JOIN users u ON p.author_id = u.id
            JOIN communities c ON p.community_id = c.id
            WHERE p.id = %s
        """, (session.get('user_id'), post_id))
        post = cur.fetchone()

        if not post:
            return jsonify({"error": "Post not found"}), 404

        if post["community_is_private"] and not post["is_joined"]:
            return jsonify({"error": "Join this private community to view this post"}), 403

        enrich_post(cur, post, session.get('user_id'))
        return jsonify(post), 200
    finally:
        cur.close()


@posts_bp.route('/<int:post_id>/comments', methods=['GET'])
def get_post_comments(post_id):
    db = get_db()
    cur = db.cursor()

    try:
        cur.execute("SELECT community_id FROM posts WHERE id = %s", (post_id,))
        post = cur.fetchone()
        if not post:
            return jsonify({"error": "Post not found"}), 404
        access = can_access_community(cur, post["community_id"], session.get('user_id'))
        if access and not access["can_access"]:
            return jsonify({"error": "Join this private community to view comments"}), 403
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
        cur.execute("SELECT id, community_id FROM posts WHERE id = %s", (post_id,))
        post = cur.fetchone()
        if not post:
            return jsonify({"error": "Post not found"}), 404

        access = can_access_community(cur, post["community_id"], session['user_id'])
        if access and not access["can_access"]:
            return jsonify({"error": "Join this private community to comment"}), 403

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


@posts_bp.route('/<int:post_id>', methods=['DELETE'])
def delete_post(post_id):
    if 'user_id' not in session:
        return jsonify({"error": "Unauthorized"}), 401

    db = get_db()
    cur = db.cursor()

    try:
        cur.execute("""
            DELETE FROM posts
            WHERE id = %s AND author_id = %s
            RETURNING id
        """, (post_id, session['user_id']))
        deleted = cur.fetchone()
        if not deleted:
            db.rollback()
            return jsonify({"error": "Post not found or you cannot delete it"}), 404
        db.commit()
        return jsonify({"message": "Post deleted"}), 200
    except Exception as e:
        db.rollback()
        return jsonify({"error": f"Failed to delete post: {str(e)}"}), 400
    finally:
        cur.close()


@posts_bp.route('/comments/<int:comment_id>', methods=['DELETE'])
def delete_comment(comment_id):
    if 'user_id' not in session:
        return jsonify({"error": "Unauthorized"}), 401

    db = get_db()
    cur = db.cursor()

    try:
        cur.execute("""
            DELETE FROM comments
            WHERE id = %s AND author_id = %s
            RETURNING id
        """, (comment_id, session['user_id']))
        deleted = cur.fetchone()
        if not deleted:
            db.rollback()
            return jsonify({"error": "Comment not found or you cannot delete it"}), 404
        db.commit()
        return jsonify({"message": "Comment deleted"}), 200
    except Exception as e:
        db.rollback()
        return jsonify({"error": f"Failed to delete comment: {str(e)}"}), 400
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

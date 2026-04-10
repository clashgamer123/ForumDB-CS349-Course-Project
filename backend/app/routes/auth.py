from flask import Blueprint, request, jsonify, session
from werkzeug.security import generate_password_hash, check_password_hash
from ..db_control.db import get_db

# Create the Blueprint. All URLs here will start with /auth
auth_bp = Blueprint('auth', __name__)

@auth_bp.route('/signup', methods=['POST'])
def signup():
    data = request.json
    db = get_db()
    cur = db.cursor()
    
    # Never store plain-text passwords!
    hashed_pw = generate_password_hash(data['password'])
    
    try:
        cur.execute(
            """INSERT INTO users (username, email, hash_password) 
               VALUES (%s, %s, %s) RETURNING id, username""",
            (data['username'], data['email'], hashed_pw)
        )
        new_user = cur.fetchone()
        db.commit() # Save to database
        
        # Log them in automatically after signup
        session['user_id'] = new_user['id']
        
        return jsonify({"message": "User created", "user": new_user}), 201
        
    except Exception as e:
        db.rollback() # Undo the transaction if it failed (e.g., duplicate email)
        return jsonify({"error": "Username or Email already exists"}), 400
    finally:
        cur.close()

@auth_bp.route('/login', methods=['POST'])
def login():
    data = request.json
    db = get_db()
    cur = db.cursor()
    
    cur.execute("SELECT * FROM users WHERE username = %s", (data['username'],))
    user = cur.fetchone()
    cur.close()
    
    if user and check_password_hash(user['hash_password'], data['password']):
        session['user_id'] = user['id'] # Set the session cookie
        return jsonify({
            "loggedIn": True, 
            "user": {"id": user['id'], "username": user['username']}
        }), 200
    
    return jsonify({"loggedIn": False, "error": "Invalid credentials"}), 401

@auth_bp.route('/isLoggedIn', methods=['GET'])
def is_logged_in():
    # This is exactly what your React useEffect calls!
    if 'user_id' in session:
        db = get_db()
        cur = db.cursor()
        cur.execute("SELECT id, username FROM users WHERE id = %s", (session['user_id'],))
        user = cur.fetchone()
        cur.close()
        
        if user:
            return jsonify({"loggedIn": True, "user": user}), 200
            
    return jsonify({"loggedIn": False}), 200

@auth_bp.route('/logout', methods=['POST'])
def logout():
    session.pop('user_id', None) # Destroy the session
    return jsonify({"message": "Logged out successfully"}), 200
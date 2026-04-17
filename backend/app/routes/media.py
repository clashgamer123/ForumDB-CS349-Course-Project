from flask import Blueprint, request, jsonify, session
from werkzeug.utils import secure_filename
import os
from ..db_control.db import get_db

media_bp = Blueprint('media', __name__)
# Allowed extensions for media files
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'mp4', 'mov', 'avi'}
UPLOAD_FOLDER = '/app/uploads/'
MAX_FILE_SIZE = 100 * 1024 * 1024  # 50 MB

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def get_mime_type(filename):
    ext = filename.rsplit('.', 1)[1].lower()
    if ext in {'png', 'jpg', 'jpeg', 'gif'}:
        return 'image/' + ext
    elif ext in {'mp4', 'mov', 'avi'}:
        return 'video/' + ext
    return 'application/octet-stream'

@media_bp.route('/upload', methods=['POST'])
def upload_media():
    if 'user_id' not in session:
        return jsonify({"error": "Unauthorized"}), 401
    
    if 'file' not in request.files:
        return jsonify({"error": "No file part"}), 400
    
    file = request.files['file']
    
    if file.filename == '':
        return jsonify({"error": "No selected file"}), 400
    
    if not allowed_file(file.filename):
        return jsonify({"error": "File type not allowed"}), 400
    
    if file.content_length > MAX_FILE_SIZE:
        return jsonify({"error": "File too large"}), 400
    
    try:
    # Ensure uploads directory exists
        os.makedirs(UPLOAD_FOLDER, exist_ok=True)
        
        # Save with secure filename
        filename = secure_filename(f"{session['user_id']}_{file.filename}")
        filepath = os.path.join(UPLOAD_FOLDER, filename)
        file.save(filepath)
        
        media_url = f"/uploads/{filename}"
        mime_type = get_mime_type(file.filename)
        
        return jsonify({
            "media_url": media_url,
            "media_type": mime_type,
            "filename": filename
        }), 201
        print(f"File uploaded successfully: {filepath}")

    except Exception as e:
        return jsonify({"error": f"Upload failed: {str(e)}"}), 500


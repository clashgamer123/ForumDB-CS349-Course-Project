-- DROP TABLE IF EXISTS posts;
-- DROP TABLE IF EXISTS community_members;
-- DROP TABLE IF EXISTS communities;
-- DROP TABLE IF EXISTS users;

CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(255) NOT NULL UNIQUE,
    bio VARCHAR(255),
    email VARCHAR(255) NOT NULL UNIQUE,
    hash_password VARCHAR(255) NOT NULL,
    age INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE communities (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    display_name VARCHAR(255) NOT NULL,
    description TEXT,
    created_by INTEGER NOT NULL,
    members_count INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE community_members (
    community_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    PRIMARY KEY (community_id, user_id),
    FOREIGN KEY (community_id) REFERENCES communities(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE posts (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    author_id INTEGER NOT NULL,
    community_id INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (community_id) REFERENCES communities(id) ON DELETE CASCADE
);

CREATE TABLE post_media (
    id SERIAL PRIMARY KEY,
    post_id INTEGER NOT NULL,
    media_type VARCHAR(50) NOT NULL,  -- image/jpeg, image/png, video/mp4, etc.
    media_url TEXT NOT NULL,
    position INTEGER DEFAULT 0,  -- Order of media in the post
    caption TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE
);

CREATE INDEX idx_post_media_post_id ON post_media(post_id);
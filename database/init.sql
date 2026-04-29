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
    members_count INTEGER DEFAULT 1 CHECK (members_count >= 0),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
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
    search_vector tsvector GENERATED ALWAYS AS (
        to_tsvector('english', coalesce(title, '') || ' ' || coalesce(content, ''))
    ) STORED,
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
    FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
    UNIQUE (post_id, position)
);

CREATE TABLE comments (
    id SERIAL PRIMARY KEY,
    post_id INTEGER NOT NULL,
    author_id INTEGER NOT NULL,
    parent_comment_id INTEGER,
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
    FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (parent_comment_id) REFERENCES comments(id) ON DELETE CASCADE
);

CREATE TABLE post_votes (
    post_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    vote_value SMALLINT NOT NULL CHECK (vote_value IN (-1, 1)),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (post_id, user_id),
    FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE comment_votes (
    comment_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    vote_value SMALLINT NOT NULL CHECK (vote_value IN (-1, 1)),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (comment_id, user_id),
    FOREIGN KEY (comment_id) REFERENCES comments(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_community_members_user_id ON community_members(user_id);
CREATE INDEX idx_posts_author_id ON posts(author_id);
CREATE INDEX idx_posts_community_id_created_at ON posts(community_id, created_at DESC);
CREATE INDEX idx_posts_search_vector ON posts USING GIN(search_vector);
CREATE INDEX idx_communities_search_vector ON communities USING GIN (
    to_tsvector('english', coalesce(name, '') || ' ' || coalesce(display_name, '') || ' ' || coalesce(description, ''))
);
CREATE INDEX idx_post_media_post_id ON post_media(post_id);
CREATE INDEX idx_comments_post_id_created_at ON comments(post_id, created_at ASC);
CREATE INDEX idx_comments_parent_comment_id ON comments(parent_comment_id);
CREATE INDEX idx_comments_author_id ON comments(author_id);
CREATE INDEX idx_post_votes_user_id ON post_votes(user_id);
CREATE INDEX idx_comment_votes_user_id ON comment_votes(user_id);

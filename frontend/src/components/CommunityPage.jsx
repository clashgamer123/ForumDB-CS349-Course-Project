import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import "../styles/CommunityPage.css";

function CommentBadge({ count }) {
  return (
    <span className="post-stat-badge comments">
      <svg viewBox="0 0 20 20" aria-hidden="true" className="post-stat-icon">
        <path
          d="M4 4.5h12a1.5 1.5 0 0 1 1.5 1.5v7A1.5 1.5 0 0 1 16 14.5H9l-3.8 2.9c-.43.33-1.05.02-1.05-.52V14.5H4A1.5 1.5 0 0 1 2.5 13V6A1.5 1.5 0 0 1 4 4.5Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
      </svg>
      <span>{count}</span>
    </span>
  );
}

function MediaCarousel({ media }) {
  const [currentIndex, setCurrentIndex] = useState(0);

  const next = () => {
    setCurrentIndex((prev) => (prev + 1) % media.length);
  };

  const prev = () => {
    setCurrentIndex((prev) =>
      prev === 0 ? media.length - 1 : prev - 1
    );
  };

  const current = media[currentIndex];

  return (
    <div className="carousel">
      {/* Image / Video */}
      <div className="carousel-media">
        {current.media_type.startsWith("image") ? (
          <img src={`http://localhost:5000${current.media_url}`} />
        ) : (
          <video controls>
            <source src={`http://localhost:5000${current.media_url}`} />
          </video>
        )}
      </div>

      {/* Left Arrow */}
      {media.length > 1 && (
        <button className="carousel-btn left" onClick={prev}>
          ‹
        </button>
      )}

      {/* Right Arrow */}
      {media.length > 1 && (
        <button className="carousel-btn right" onClick={next}>
          ›
        </button>
      )}

      {/* Counter */}
      <div className="carousel-counter">
        {currentIndex + 1}/{media.length}
      </div>
    </div>
  );
}
export default function CommunityPage() {
  const { id } = useParams();
  const [community, setCommunity] = useState(null);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);

  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");
  const [mediaItems, setMediaItems] = useState([]);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    fetchCommunityPage();
  }, [id]);

  const handleVote = async (postId, voteValue) => {
    try {
      const res = await fetch(`http://localhost:5000/api/posts/${postId}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ vote_value: voteValue })
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to vote on post");
      }

      setPosts((prev) =>
        prev.map((post) =>
          post.id === postId ? { ...post, ...data } : post
        )
      );
    } catch (err) {
      setError(err.message || "Failed to vote on post");
    }
  };

  const fetchCommunityPage = async () => {
    setLoading(true);
    try {
      const [communityRes, postsRes] = await Promise.all([
        fetch(`http://localhost:5000/api/communities/${id}`, { credentials: "include" }),
        fetch(`http://localhost:5000/api/posts/community/${id}`, { credentials: "include" })
      ]);

      const communityData = await communityRes.json();
      const postsData = await postsRes.json();

      if (!communityRes.ok) {
        throw new Error(communityData.error || "Failed to load community");
      }

      if (!postsRes.ok) {
        throw new Error(postsData.error || "Failed to load posts");
      }

      setCommunity(communityData);
      setPosts(Array.isArray(postsData) ? postsData : []);
      setError("");
    } catch (err) {
      console.error("Failed to fetch community page", err);
      setError(err.message || "Unable to load community right now.");
      setCommunity(null);
      setPosts([]);
      setShowCreateForm(false);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    setUploading(true);
    const newMediaItems = [];

    for (const file of files) {
      try {
        const formData = new FormData();
        formData.append("file", file);

        const res = await fetch("http://localhost:5000/api/media/upload", {
          method: "POST",
          credentials: "include",
          body: formData
        });

        if (res.ok) {
          const data = await res.json();
          newMediaItems.push({
            media_url: data.media_url,
            media_type: data.media_type,
            caption: ""
          });
        }
      } catch (err) {
        console.error("Failed to upload file", err);
      }
    }

    setMediaItems([...mediaItems, ...newMediaItems]);
    setUploading(false);
  };

  const handleRemoveMedia = (index) => {
    setMediaItems(mediaItems.filter((_, i) => i !== index));
  };

  const handleCreatePost = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch("http://localhost:5000/api/posts/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          title: newTitle,
          content: newContent,
          community_id: id,
          media_items: mediaItems
        })
      });

      if (res.ok) {
        setNewTitle("");
        setNewContent("");
        setMediaItems([]);
        setShowCreateForm(false);
        fetchCommunityPage();
      } else {
        const data = await res.json();
        setError(data.error || "Failed to create post");
      }
    } catch (err) {
      console.error("Failed to post", err);
      setError("Failed to create post");
    }
  };

  if (loading) return <div className="community-page-loading">Loading...</div>;

  if (error && !community) {
    return (
      <div className="community-page">
        <div className="posts-empty">{error}</div>
      </div>
    );
  }

  return (
    <div className="community-page">
      <div className="community-banner">
        <div className="community-banner-row">
          <div>
            <p className="community-handle">c/{community?.name || id}</p>
            <h1>{community?.display_name || `Community #${id}`}</h1>
            {community?.description && (
              <p className="community-description">{community.description}</p>
            )}
          </div>
          <button
            type="button"
            className={`community-create-toggle ${showCreateForm ? "cancel" : ""}`}
            onClick={() => setShowCreateForm((prev) => !prev)}
          >
            {showCreateForm ? "Close" : "Create Post"}
          </button>
        </div>
      </div>

      {showCreateForm && (
        <div className="create-post-panel">
          <h3>Create a Post</h3>
          <form onSubmit={handleCreatePost} className="create-post-form">
            <input
              type="text"
              placeholder="Post Title"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              required
            />
            <textarea
              placeholder="What's on your mind?"
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
              required
              rows="4"
            />

            <div className="media-upload-section">
              <label htmlFor="media-input" className="media-upload-label">
                Add Images or Videos
              </label>
              <input
                id="media-input"
                type="file"
                multiple
                accept="image/png,image/jpeg,image/gif,video/mp4,video/webm"
                onChange={handleFileUpload}
                disabled={uploading}
                className="media-input"
              />
              {uploading && <p className="uploading-text">Uploading...</p>}
            </div>

            {mediaItems.length > 0 && (
              <MediaCarousel media={mediaItems} />
            )}

            <button type="submit" className="create-post-submit-btn">
              Submit Post
            </button>
          </form>
        </div>
      )}

      <div className="posts-section">
        <div className="posts-section-header">
          <h2>Posts</h2>
          <span className="posts-count">{posts.length}</span>
        </div>
        {error ? (
          <p className="posts-empty">{error}</p>
        ) : posts.length === 0 ? (
          <p className="posts-empty">No posts here yet. Be the first!</p>
        ) : (
          <div className="posts-list">
            {posts.map((post) => (
              <div key={post.id} className="post-card">
                <p className="post-author">
                  Posted by <strong>u/{post.author_name}</strong>
                </p>
                <Link to={`/posts/${post.id}`} className="post-title-link">
                  <h3 className="post-title">{post.title}</h3>
                </Link>
                <p className="post-content">{post.content}</p>
                <div className="post-card-footer">
                  <div className="post-stats">
                    <button
                      type="button"
                      className={`post-stat-button upvotes ${post.user_vote === 1 ? "active" : ""}`}
                      onClick={() => handleVote(post.id, 1)}
                      aria-label="Upvote post"
                    >
                      ▲ <span>{post.upvote_count}</span>
                    </button>
                    <button
                      type="button"
                      className={`post-stat-button downvotes ${post.user_vote === -1 ? "active" : ""}`}
                      onClick={() => handleVote(post.id, -1)}
                      aria-label="Downvote post"
                    >
                      ▼ <span>{-post.downvote_count}</span>
                    </button>
                    <CommentBadge count={post.comment_count} />
                  </div>
                  <Link to={`/posts/${post.id}`} className="post-discussion-link">
                    Open
                  </Link>
                </div>

                {/* Media Rendering */}
                {post.media && post.media.length > 0 && (
                  <MediaCarousel media={post.media} />
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

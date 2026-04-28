import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import "../styles/HomeFeed.css";

function CommentBadge({ count }) {
  return (
    <span className="feed-stat-badge comments">
      <svg viewBox="0 0 20 20" aria-hidden="true" className="feed-stat-icon">
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
export default function HomeFeed() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchFeed = async () => {
      try {
        const res = await fetch("http://localhost:5000/api/posts/feed", {
          credentials: "include"
        });

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || "Failed to load feed");
        }

        setPosts(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error("Failed to fetch feed", err);
        setError(err.message || "Unable to load your feed right now.");
        setPosts([]);
      } finally {
        setLoading(false);
      }
    };

    fetchFeed();
  }, []);

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

  if (loading) return <div className="feed-loading">Loading your feed...</div>;

  return (
    <div className="feed-container">
      <h1>Your Personalized Feed</h1>
      {error && <p className="feed-empty">{error}</p>}
      {!error && posts.length === 0 ? (
        <p className="feed-empty">Your feed is empty! Go join some communities.</p>
      ) : posts.length > 0 ? (
        <div className="feed-list">
          {posts.map(post => (
            <div key={post.id} className="feed-post-card">
              <div className="feed-post-meta">
                <span className="community">c/{post.community_name}</span>
                <span className="separator">•</span>
                <span>Posted by u/{post.author_name}</span>
              </div>
              <Link to={`/posts/${post.id}`} className="feed-post-link">
                <h3 className="feed-post-title">{post.title}</h3>
              </Link>
              <p className="feed-post-content">{post.content}</p>
              <div className="feed-post-footer">
                <div className="feed-post-stats">
                  <button
                    type="button"
                    className={`feed-stat-button upvotes ${post.user_vote === 1 ? "active" : ""}`}
                    onClick={() => handleVote(post.id, 1)}
                    aria-label="Upvote post"
                  >
                    ▲ <span>{post.upvote_count}</span>
                  </button>
                  <button
                    type="button"
                    className={`feed-stat-button downvotes ${post.user_vote === -1 ? "active" : ""}`}
                    onClick={() => handleVote(post.id, -1)}
                    aria-label="Downvote post"
                  >
                    ▼ <span>{-post.downvote_count}</span>
                  </button>
                  <CommentBadge count={post.comment_count} />
                </div>
                <Link to={`/posts/${post.id}`} className="feed-post-discussion-link">
                  Open
                </Link>
              </div>

              {/* Media Rendering for Feed */}
              {post.media && post.media.length > 0 && (
                <MediaCarousel media={post.media} />
              )}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

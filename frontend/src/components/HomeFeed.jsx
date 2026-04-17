import { useEffect, useState } from "react";
import "../styles/HomeFeed.css";
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

  useEffect(() => {
    fetch("http://localhost:5000/api/posts/feed", { credentials: "include" })
      .then(res => res.json())
      .then(data => {
        setPosts(data);
        setLoading(false);
      });
  }, []);

  if (loading) return <div className="feed-loading">Loading your feed...</div>;
  const baseurl = "http://localhost:5000";
  return (
    <div className="feed-container">
      <h1>Your Personalized Feed</h1>
      {posts.length === 0 ? (
        <p className="feed-empty">Your feed is empty! Go join some communities.</p>
      ) : (
        <div className="feed-list">
          {posts.map(post => (
            <div key={post.id} className="feed-post-card">
              <div className="feed-post-meta">
                <span className="community">c/{post.community_name}</span>
                <span className="separator">•</span>
                <span>Posted by u/{post.author_name}</span>
              </div>
              <h3 className="feed-post-title">{post.title}</h3>
              <p className="feed-post-content">{post.content}</p>

              {/* Media Rendering for Feed */}
              {post.media && post.media.length > 0 && (
                <MediaCarousel media={post.media} />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
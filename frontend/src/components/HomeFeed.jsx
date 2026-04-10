import { useEffect, useState } from "react";
import "../styles/HomeFeed.css";

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
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
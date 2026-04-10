import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import "../styles/CommunityPage.css";

export default function CommunityPage() {
  const { id } = useParams();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);

  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");

  useEffect(() => {
    fetchPosts();
  }, [id]);

  const fetchPosts = async () => {
    try {
      const res = await fetch(`http://localhost:5000/api/posts/community/${id}`);
      const data = await res.json();
      setPosts(data);
    } catch (err) {
      console.error("Failed to fetch posts", err);
    }
    setLoading(false);
  };

  const handleCreatePost = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch("http://localhost:5000/api/posts/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ title: newTitle, content: newContent, community_id: id })
      });

      if (res.ok) {
        setNewTitle("");
        setNewContent("");
        fetchPosts();
      }
    } catch (err) {
      console.error("Failed to post", err);
    }
  };

  if (loading) return <div className="community-page-loading">Loading...</div>;

  return (
    <div className="community-page">
      <div className="community-banner">
        <h1>Community #{id}</h1>
      </div>

      <div className="create-post-panel">
        <h3>Create a Post</h3>
        <form onSubmit={handleCreatePost} className="create-post-form">
          <input
            type="text" placeholder="Post Title" value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)} required
          />
          <textarea
            placeholder="What's on your mind?" value={newContent}
            onChange={(e) => setNewContent(e.target.value)} required
            rows="4"
          />
          <button type="submit" className="create-post-submit-btn">Submit Post</button>
        </form>
      </div>

      <div className="posts-section">
        <h2>Posts</h2>
        {posts.length === 0 ? (
          <p className="posts-empty">No posts here yet. Be the first!</p>
        ) : (
          <div className="posts-list">
            {posts.map(post => (
              <div key={post.id} className="post-card">
                <p className="post-author">Posted by <strong>u/{post.author_name}</strong></p>
                <h3 className="post-title">{post.title}</h3>
                <p className="post-content">{post.content}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
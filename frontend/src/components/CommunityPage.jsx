import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import "../styles/CommunityPage.css";
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
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);

  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");
  const [mediaItems, setMediaItems] = useState([]);
  const [uploading, setUploading] = useState(false);

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
        fetchPosts();
      }
    } catch (err) {
      console.error("Failed to post", err);
    }
  };

  if (loading) return <div className="community-page-loading">Loading...</div>;
  const baseurl = "http://localhost:5000";
  return (
    <div className="community-page">
      <div className="community-banner">
        <h1>Community #{id}</h1>
      </div>

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

          {/* Media Upload Section */}
          <div className="media-upload-section">
            <label htmlFor="media-input" className="media-upload-label">
              📸 Add Images or Videos
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

          {/* Media Preview */}
          {mediaItems.length > 0 && (
            <MediaCarousel media={mediaItems} />
          )}

          <button type="submit" className="create-post-submit-btn">
            Submit Post
          </button>
        </form>
      </div>

      <div className="posts-section">
        <h2>Posts</h2>
        {posts.length === 0 ? (
          <p className="posts-empty">No posts here yet. Be the first!</p>
        ) : (
          <div className="posts-list">
            {posts.map((post) => (
              <div key={post.id} className="post-card">
                <p className="post-author">
                  Posted by <strong>u/{post.author_name}</strong>
                </p>
                <h3 className="post-title">{post.title}</h3>
                <p className="post-content">{post.content}</p>

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
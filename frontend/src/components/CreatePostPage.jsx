import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import MediaViewer from "./MediaViewer";
import "../styles/CreatePostPage.css";

export default function CreatePostPage({ presetCommunityId = "" }) {
  const navigate = useNavigate();
  const [communities, setCommunities] = useState([]);
  const [communityId, setCommunityId] = useState(presetCommunityId);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [mediaItems, setMediaItems] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadCommunities = async () => {
      const res = await fetch("http://localhost:5000/api/communities/", {
        credentials: "include"
      });
      const data = await res.json();
      setCommunities(Array.isArray(data) ? data : []);
      if (!presetCommunityId && Array.isArray(data) && data.length > 0) {
        const firstOpen = data.find((community) => !community.is_private || community.is_joined) || data[0];
        setCommunityId(String(firstOpen.id));
      }
    };

    loadCommunities();
  }, [presetCommunityId]);

  const selectedCommunity = communities.find((community) => String(community.id) === String(communityId));
  const canPost = selectedCommunity && (!selectedCommunity.is_private || selectedCommunity.is_joined);

  const handleFileUpload = async (event) => {
    const files = Array.from(event.target.files);
    if (!files.length) return;

    setUploading(true);
    setError("");

    for (const file of files) {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("http://localhost:5000/api/media/upload", {
        method: "POST",
        credentials: "include",
        body: formData
      });
      const data = await res.json();
      if (res.ok) {
        setMediaItems((prev) => [...prev, {
          media_url: data.media_url,
          media_type: data.media_type,
          caption: ""
        }]);
      } else {
        setError(data.error || "One upload failed");
      }
    }

    setUploading(false);
    event.target.value = "";
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");

    if (!canPost) {
      setError("Join this private community before posting.");
      return;
    }

    const res = await fetch("http://localhost:5000/api/posts/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        title,
        content,
        community_id: Number(communityId),
        media_items: mediaItems
      })
    });
    const data = await res.json();

    if (!res.ok) {
      setError(data.error || "Failed to create post");
      return;
    }

    navigate(`/posts/${data.id}`);
  };

  return (
    <div className="create-post-page">
      <section className="create-post-shell">
        <div className="create-post-header">
          <p>Create</p>
          <h1>New post</h1>
        </div>

        {error && <p className="create-post-error">{error}</p>}

        <form onSubmit={handleSubmit} className="create-post-wide-form">
          <label>
            Community
            <select value={communityId} onChange={(event) => setCommunityId(event.target.value)} required>
              {communities.map((community) => (
                <option key={community.id} value={community.id}>
                  c/{community.name} - {community.is_private ? "Private" : "Public"}
                </option>
              ))}
            </select>
          </label>

          {selectedCommunity?.is_private && !selectedCommunity?.is_joined && (
            <p className="create-post-note">This community is private. Join it before posting.</p>
          )}

          <label>
            Title
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Post title"
              required
            />
          </label>

          <label>
            Images or videos
            <input
              type="file"
              multiple
              accept="image/png,image/jpeg,image/gif,video/mp4,video/webm,video/quicktime"
              onChange={handleFileUpload}
              disabled={uploading}
            />
          </label>

          {uploading && <p className="create-post-note">Uploading...</p>}
          <MediaViewer media={mediaItems} />

          <label>
            Context
            <textarea
              value={content}
              onChange={(event) => setContent(event.target.value)}
              placeholder="Write the context after your media"
              rows="6"
              required
            />
          </label>

          <button type="submit" disabled={!canPost || uploading}>
            Post
          </button>
        </form>
      </section>
    </div>
  );
}

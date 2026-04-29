import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import MediaViewer from "./MediaViewer";
import ShareBox from "./ShareBox";
import "../styles/CommunityPage.css";

const SORT_OPTIONS = [
  { value: "hot", label: "Hot" },
  { value: "rising", label: "Rising" },
  { value: "controversial", label: "Controversial" },
  { value: "top", label: "Top" },
  { value: "new", label: "New" }
];

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

function SortTabs({ activeSort, onChange }) {
  return (
    <div className="community-sort-bar">
      {SORT_OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          className={`community-sort-pill ${activeSort === option.value ? "active" : ""}`}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export default function CommunityPage() {
  const { id } = useParams();
  const [community, setCommunity] = useState(null);
  const [posts, setPosts] = useState([]);
  const [sortMode, setSortMode] = useState("hot");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);

  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");
  const [mediaItems, setMediaItems] = useState([]);
  const [uploading, setUploading] = useState(false);

  const fetchCommunityPage = async (activeSort = sortMode, activeQuery = searchQuery) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ sort: activeSort });
      const trimmedQuery = activeQuery.trim();
      if (trimmedQuery) {
        params.set("q", trimmedQuery);
      }

      const [communityRes, postsRes] = await Promise.all([
        fetch(`http://localhost:5000/api/communities/${id}`, { credentials: "include" }),
        fetch(`http://localhost:5000/api/posts/community/${id}?${params.toString()}`, { credentials: "include" })
      ]);

      const communityData = await communityRes.json();
      const postsData = await postsRes.json();

      if (!communityRes.ok) {
        if (communityData.community) {
          setCommunity(communityData.community);
        }
        throw new Error(communityData.error || "Failed to load community");
      }

      if (!postsRes.ok) {
        throw new Error(postsData.error || "Failed to load posts");
      }

      setCommunity(communityData);
      setPosts(Array.isArray(postsData.posts) ? postsData.posts : []);
      setError("");
    } catch (err) {
      console.error("Failed to fetch community page", err);
      setError(err.message || "Unable to load community right now.");
      setCommunity((prev) => prev);
      setPosts([]);
      setShowCreateForm(false);
    } finally {
      setLoading(false);
    }
  };

  const handleJoinCommunity = async () => {
    try {
      const res = await fetch(`http://localhost:5000/api/communities/${id}/join`, {
        method: "POST",
        credentials: "include"
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to join community");
      await fetchCommunityPage(sortMode, searchQuery);
    } catch (err) {
      setError(err.message || "Failed to join community");
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchCommunityPage(sortMode, searchQuery);
    }, 250);

    return () => clearTimeout(timer);
  }, [id, sortMode, searchQuery]);

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

      setPosts((prev) => prev.map((post) => (
        post.id === postId ? { ...post, ...data } : post
      )));
    } catch (err) {
      setError(err.message || "Failed to vote on post");
    }
  };

  const handleFileUpload = async (event) => {
    const files = Array.from(event.target.files);
    if (files.length === 0) return;

    setUploading(true);
    const uploadedMedia = [];

    for (const file of files) {
      try {
        const formData = new FormData();
        formData.append("file", file);

        const res = await fetch("http://localhost:5000/api/media/upload", {
          method: "POST",
          credentials: "include",
          body: formData
        });

        if (!res.ok) {
          continue;
        }

        const data = await res.json();
        uploadedMedia.push({
          media_url: data.media_url,
          media_type: data.media_type,
          caption: ""
        });
      } catch (err) {
        console.error("Failed to upload file", err);
      }
    }

    setMediaItems((prev) => [...prev, ...uploadedMedia]);
    setUploading(false);
  };

  const handleCreatePost = async (event) => {
    event.preventDefault();
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
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to create post");
      }

      setNewTitle("");
      setNewContent("");
      setMediaItems([]);
      setShowCreateForm(false);
      await fetchCommunityPage(sortMode, searchQuery);
    } catch (err) {
      setError(err.message || "Failed to create post");
    }
  };

  const trimmedQuery = searchQuery.trim();
  const activeSortLabel = SORT_OPTIONS.find((option) => option.value === sortMode)?.label || "Hot";

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
            <p className="community-privacy">
              {community?.is_private ? "Private community" : "Public community"}
              {community?.is_joined ? " | Joined" : " | Not joined"}
            </p>
            {community?.description && (
              <p className="community-description">{community.description}</p>
            )}
          </div>
          <div className="community-actions">
            {!community?.is_joined && (
              <button type="button" className="community-create-toggle secondary" onClick={handleJoinCommunity}>
                Join
              </button>
            )}
            {(!community?.is_private || community?.is_joined) && (
              <button
                type="button"
                className={`community-create-toggle ${showCreateForm ? "cancel" : ""}`}
                onClick={() => setShowCreateForm((prev) => !prev)}
              >
                {showCreateForm ? "Close" : "Create Post"}
              </button>
            )}
            {community && <ShareBox shareType="community" shareId={community.id} buttonLabel="Share" />}
          </div>
        </div>
      </div>

      {showCreateForm && (
        <div className="create-post-panel">
          <h3>Create a Post</h3>
          <form onSubmit={handleCreatePost} className="create-post-form">
            <input
              type="text"
              placeholder="Post title"
              value={newTitle}
              onChange={(event) => setNewTitle(event.target.value)}
              required
            />

            <div className="media-upload-section">
              <label htmlFor="media-input" className="media-upload-label">
                Add images or videos
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

            {mediaItems.length > 0 && <MediaViewer media={mediaItems} />}

            <textarea
              placeholder="Write the context after your media"
              value={newContent}
              onChange={(event) => setNewContent(event.target.value)}
              required
              rows="4"
            />

            <button type="submit" className="create-post-submit-btn">
              Submit Post
            </button>
          </form>
        </div>
      )}

      <div className="posts-section">
        <div className="posts-tools">
          <div className="posts-section-header">
            <div>
              <h2>{trimmedQuery ? `Search results for "${trimmedQuery}"` : "Posts"}</h2>
              <p className="posts-section-note">{activeSortLabel} ranking inside this community</p>
            </div>
            <span className="posts-count">{posts.length}</span>
          </div>

          <div className="community-search-row">
            <label className="community-search-shell">
              <span>Search posts</span>
              <input
                type="search"
                placeholder="Search titles and content in this community"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
              />
            </label>
          </div>

          <SortTabs activeSort={sortMode} onChange={setSortMode} />
        </div>

        {error ? (
          <p className="posts-empty">{error}</p>
        ) : posts.length === 0 ? (
          <p className="posts-empty">
            {trimmedQuery ? "No posts matched your search in this community." : "No posts here yet. Be the first!"}
          </p>
        ) : (
          <div className="posts-list">
            {posts.map((post) => (
              <article key={post.id} className="post-card">
                <div className="post-meta-row">
                  <p className="post-author">
                    Posted by <Link to={`/u/${post.author_name}`}>u/{post.author_name}</Link>
                  </p>
                  <span className={`post-rank-tag ${sortMode}`}>{activeSortLabel}</span>
                </div>
                <Link to={`/posts/${post.id}`} className="post-title-link">
                  <h3 className="post-title">{post.title}</h3>
                </Link>
                {post.media && post.media.length > 0 && (
                  <MediaViewer media={post.media} compact />
                )}

                <div className="post-card-footer">
                  <div className="post-stats">
                    <button
                      type="button"
                      className={`post-stat-button upvotes ${post.user_vote === 1 ? "active" : ""}`}
                      onClick={() => handleVote(post.id, 1)}
                      aria-label="Upvote post"
                    >
                      ^ <span>{post.upvote_count}</span>
                    </button>
                    <button
                      type="button"
                      className={`post-stat-button downvotes ${post.user_vote === -1 ? "active" : ""}`}
                      onClick={() => handleVote(post.id, -1)}
                      aria-label="Downvote post"
                    >
                      v <span>{post.downvote_count}</span>
                    </button>
                    <CommentBadge count={post.comment_count} />
                  </div>
                  <Link to={`/posts/${post.id}`} className="post-discussion-link">
                    Open
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

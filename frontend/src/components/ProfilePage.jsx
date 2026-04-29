import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { mediaSrc } from "./MediaViewer";
import "../styles/ProfilePage.css";

function StatCard({ label, value, accent = "" }) {
  return (
    <div className={`profile-stat-card ${accent}`}>
      <span className="profile-stat-label">{label}</span>
      <strong className="profile-stat-value">{value}</strong>
    </div>
  );
}

function EmptyState({ text }) {
  return <p className="profile-empty">{text}</p>;
}

export default function ProfilePage({ user }) {
  const { username } = useParams();
  const [profile, setProfile] = useState(null);
  const [posts, setPosts] = useState([]);
  const [comments, setComments] = useState([]);
  const [followRequests, setFollowRequests] = useState([]);
  const [activeTab, setActiveTab] = useState("overview");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    bio: "",
    display_name: "",
    location: "",
    profile_pic_url: "",
    is_private: false
  });

  const isOwnProfile = !username || username === user?.username;

  const loadProfile = async () => {
    setLoading(true);
    try {
      const endpoint = isOwnProfile
        ? "http://localhost:5000/api/users/me"
        : `http://localhost:5000/api/users/${username}`;
      const res = await fetch(endpoint, {
        credentials: "include"
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to load profile");
      }

      setProfile(data.user || null);
      setPosts(Array.isArray(data.posts) ? data.posts : []);
      setComments(Array.isArray(data.comments) ? data.comments : []);
      setFollowRequests(Array.isArray(data.follow_requests) ? data.follow_requests : []);
      if (data.user) {
        setEditForm({
          bio: data.user.bio || "",
          display_name: data.user.display_name || "",
          location: data.user.location || "",
          profile_pic_url: data.user.profile_pic_url === "/default-profile.svg" ? "" : (data.user.profile_pic_url || ""),
          is_private: Boolean(data.user.is_private)
        });
      }
      setError("");
    } catch (err) {
      console.error("Failed to load profile", err);
      setError(err.message || "Unable to load your profile.");
      setProfile(null);
      setPosts([]);
      setComments([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProfile();
  }, [username]);

  const updateProfile = async (event) => {
    event.preventDefault();
    const res = await fetch("http://localhost:5000/api/users/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(editForm)
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Failed to update profile");
      return;
    }
    setEditing(false);
    await loadProfile();
  };

  const uploadProfilePic = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch("http://localhost:5000/api/media/upload", {
      method: "POST",
      credentials: "include",
      body: formData
    });
    const data = await res.json();
    if (res.ok) {
      setEditForm((prev) => ({ ...prev, profile_pic_url: data.media_url }));
    } else {
      setError(data.error || "Failed to upload profile picture");
    }
  };

  const followAction = async () => {
    const method = profile.follow_status === "none" ? "POST" : "DELETE";
    const res = await fetch(`http://localhost:5000/api/users/${profile.id}/follow`, {
      method,
      credentials: "include"
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Failed to update follow");
      return;
    }
    await loadProfile();
  };

  const respondToFollow = async (followerId, action) => {
    const res = await fetch(`http://localhost:5000/api/users/follow-requests/${followerId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ action })
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Failed to update follow request");
      return;
    }
    await loadProfile();
  };

  if (loading) return <div className="profile-loading">Loading profile...</div>;
  if (error && !profile) return <div className="profile-error">{error}</div>;
  if (!profile) return <div className="profile-error">Profile not found.</div>;

  const overviewPosts = posts.slice(0, 3);
  const overviewComments = comments.slice(0, 3);

  return (
    <div className="profile-page">
      <section className="profile-hero">
        <div className="profile-hero-row">
          <img className="profile-avatar" src={mediaSrc(profile.profile_pic_url)} alt="" />
          <div>
            <p className="profile-handle">u/{profile.username}</p>
            <h1>{profile.display_name || profile.username}</h1>
            <p className="profile-meta">
              Joined {new Date(profile.created_at).toLocaleDateString()} and follows {profile.joined_communities_count || profile.following_count || 0} communities/users
            </p>
          </div>
        </div>
        <p className="profile-meta">
          {profile.is_private ? "Private profile" : "Public profile"} | {profile.followers_count || 0} followers | {profile.following_count || 0} following
        </p>
        {profile.location && <p className="profile-meta">{profile.location}</p>}
        {profile.bio && <p className="profile-bio">{profile.bio}</p>}
        <div className="profile-actions">
          {isOwnProfile ? (
            <button type="button" onClick={() => setEditing((prev) => !prev)}>
              {editing ? "Close editor" : "Edit profile"}
            </button>
          ) : (
            <>
              <button type="button" onClick={followAction}>
                {profile.follow_status === "none"
                  ? (profile.is_private ? "Request Follow" : "Follow")
                  : profile.follow_status === "pending"
                    ? "Cancel Request"
                    : "Unfollow"}
              </button>
              {profile.follow_status === "accepted" && (
                <Link to={`/messages/${profile.id}`}>Message</Link>
              )}
            </>
          )}
        </div>
      </section>

      {editing && (
        <form className="profile-edit-panel" onSubmit={updateProfile}>
          <label>
            Display name
            <input value={editForm.display_name} onChange={(e) => setEditForm({ ...editForm, display_name: e.target.value })} />
          </label>
          <label>
            Bio
            <textarea rows="3" value={editForm.bio} onChange={(e) => setEditForm({ ...editForm, bio: e.target.value })} />
          </label>
          <label>
            Location
            <input value={editForm.location} onChange={(e) => setEditForm({ ...editForm, location: e.target.value })} />
          </label>
          <label>
            Profile picture
            <input type="file" accept="image/png,image/jpeg,image/gif" onChange={uploadProfilePic} />
          </label>
          <label className="profile-check">
            <input
              type="checkbox"
              checked={editForm.is_private}
              onChange={(e) => setEditForm({ ...editForm, is_private: e.target.checked })}
            />
            Private profile
          </label>
          <button type="submit">Save profile</button>
        </form>
      )}

      {isOwnProfile && followRequests.length > 0 && (
        <section className="profile-panel follow-requests">
          <div className="profile-panel-header">
            <h2>Follow requests</h2>
            <span>{followRequests.length}</span>
          </div>
          {followRequests.map((request) => (
            <div key={request.follower_id} className="follow-request-row">
              <img src={mediaSrc(request.profile_pic_url)} alt="" />
              <span>u/{request.username}</span>
              <button type="button" onClick={() => respondToFollow(request.follower_id, "accept")}>Accept</button>
              <button type="button" onClick={() => respondToFollow(request.follower_id, "reject")}>Reject</button>
            </div>
          ))}
        </section>
      )}

      {profile.can_view === false && (
        <section className="profile-panel">
          <EmptyState text="This profile is private. Follow the user and wait for acceptance to see posts and comments." />
        </section>
      )}

      {profile.can_view !== false && <section className="profile-stats-grid">
        <StatCard label="Total Karma" value={profile.total_karma} accent="accent" />
        <StatCard label="Post Karma" value={profile.post_karma} />
        <StatCard label="Comment Karma" value={profile.comment_karma} />
        <StatCard label="Posts" value={profile.post_count} />
        <StatCard label="Comments" value={profile.comment_count} />
        <StatCard label="Communities" value={profile.joined_communities_count} />
      </section>}

      {profile.can_view !== false && <section className="profile-tabs">
        <button
          type="button"
          className={`profile-tab ${activeTab === "overview" ? "active" : ""}`}
          onClick={() => setActiveTab("overview")}
        >
          Overview
        </button>
        <button
          type="button"
          className={`profile-tab ${activeTab === "posts" ? "active" : ""}`}
          onClick={() => setActiveTab("posts")}
        >
          Posts
        </button>
        <button
          type="button"
          className={`profile-tab ${activeTab === "comments" ? "active" : ""}`}
          onClick={() => setActiveTab("comments")}
        >
          Comments
        </button>
      </section>}

      {error && <p className="profile-error-inline">{error}</p>}

      {profile.can_view !== false && activeTab === "overview" && (
        <div className="profile-overview-grid">
          <section className="profile-panel">
            <div className="profile-panel-header">
              <h2>Recent posts</h2>
              <span>{posts.length}</span>
            </div>
            {overviewPosts.length === 0 ? (
              <EmptyState text="No posts yet." />
            ) : (
              <div className="profile-card-list">
                {overviewPosts.map((post) => (
                  <article key={post.id} className="profile-post-card">
                    <p className="profile-card-meta">c/{post.community_name}</p>
                    <Link to={`/posts/${post.id}`} className="profile-post-link">
                      <h3>{post.title}</h3>
                    </Link>
                    <p className="profile-card-body">{post.content}</p>
                    <div className="profile-card-stats">
                      <span>{post.score} score</span>
                      <span>{post.comment_count} comments</span>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="profile-panel">
            <div className="profile-panel-header">
              <h2>Recent comments</h2>
              <span>{comments.length}</span>
            </div>
            {overviewComments.length === 0 ? (
              <EmptyState text="No comments yet." />
            ) : (
              <div className="profile-card-list">
                {overviewComments.map((comment) => (
                  <article key={comment.id} className="profile-comment-card">
                    <p className="profile-card-meta">
                      On <Link to={`/posts/${comment.post_id}`}>{comment.post_title}</Link>
                    </p>
                    <p className="profile-card-body">{comment.content}</p>
                    <div className="profile-card-stats">
                      <span>c/{comment.community_name}</span>
                      <span>{comment.score} score</span>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {profile.can_view !== false && activeTab === "posts" && (
        <section className="profile-panel">
          <div className="profile-panel-header">
            <h2>All posts</h2>
            <span>{posts.length}</span>
          </div>
          {posts.length === 0 ? (
            <EmptyState text="You have not posted anything yet." />
          ) : (
            <div className="profile-card-list">
              {posts.map((post) => (
                <article key={post.id} className="profile-post-card">
                  <div className="profile-card-topline">
                    <span className="profile-card-meta">c/{post.community_name}</span>
                    <span className="profile-card-date">{new Date(post.created_at).toLocaleString()}</span>
                  </div>
                  <Link to={`/posts/${post.id}`} className="profile-post-link">
                    <h3>{post.title}</h3>
                  </Link>
                  <p className="profile-card-body">{post.content}</p>
                  <div className="profile-card-stats">
                    <span>{post.upvote_count} upvotes</span>
                    <span>{post.downvote_count} downvotes</span>
                    <span>{post.comment_count} comments</span>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      )}

      {profile.can_view !== false && activeTab === "comments" && (
        <section className="profile-panel">
          <div className="profile-panel-header">
            <h2>All comments</h2>
            <span>{comments.length}</span>
          </div>
          {comments.length === 0 ? (
            <EmptyState text="You have not commented yet." />
          ) : (
            <div className="profile-card-list">
              {comments.map((comment) => (
                <article key={comment.id} className="profile-comment-card">
                  <div className="profile-card-topline">
                    <p className="profile-card-meta">
                      On <Link to={`/posts/${comment.post_id}`}>{comment.post_title}</Link>
                    </p>
                    <span className="profile-card-date">{new Date(comment.created_at).toLocaleString()}</span>
                  </div>
                  <p className="profile-card-body">{comment.content}</p>
                  <div className="profile-card-stats">
                    <span>c/{comment.community_name}</span>
                    <span>{comment.upvote_count} upvotes</span>
                    <span>{comment.downvote_count} downvotes</span>
                    <span>{comment.score} score</span>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}

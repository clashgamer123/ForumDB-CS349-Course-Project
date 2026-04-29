import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
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

export default function ProfilePage() {
  const [profile, setProfile] = useState(null);
  const [posts, setPosts] = useState([]);
  const [comments, setComments] = useState([]);
  const [activeTab, setActiveTab] = useState("overview");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadProfile = async () => {
      setLoading(true);
      try {
        const res = await fetch("http://localhost:5000/api/users/me", {
          credentials: "include"
        });
        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || "Failed to load profile");
        }

        setProfile(data.user || null);
        setPosts(Array.isArray(data.posts) ? data.posts : []);
        setComments(Array.isArray(data.comments) ? data.comments : []);
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

    loadProfile();
  }, []);

  if (loading) return <div className="profile-loading">Loading profile...</div>;
  if (error && !profile) return <div className="profile-error">{error}</div>;
  if (!profile) return <div className="profile-error">Profile not found.</div>;

  const overviewPosts = posts.slice(0, 3);
  const overviewComments = comments.slice(0, 3);

  return (
    <div className="profile-page">
      <section className="profile-hero">
        <p className="profile-handle">u/{profile.username}</p>
        <h1>{profile.username}</h1>
        <p className="profile-meta">
          Joined {new Date(profile.created_at).toLocaleDateString()} and follows {profile.joined_communities_count} communities
        </p>
        {profile.bio && <p className="profile-bio">{profile.bio}</p>}
      </section>

      <section className="profile-stats-grid">
        <StatCard label="Total Karma" value={profile.total_karma} accent="accent" />
        <StatCard label="Post Karma" value={profile.post_karma} />
        <StatCard label="Comment Karma" value={profile.comment_karma} />
        <StatCard label="Posts" value={profile.post_count} />
        <StatCard label="Comments" value={profile.comment_count} />
        <StatCard label="Communities" value={profile.joined_communities_count} />
      </section>

      <section className="profile-tabs">
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
      </section>

      {error && <p className="profile-error-inline">{error}</p>}

      {activeTab === "overview" && (
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

      {activeTab === "posts" && (
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

      {activeTab === "comments" && (
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

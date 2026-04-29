import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import "../styles/HomeFeed.css";

const SORT_OPTIONS = [
  { value: "hot", label: "Hot" },
  { value: "rising", label: "Rising" },
  { value: "controversial", label: "Controversial" },
  { value: "top", label: "Top" },
  { value: "new", label: "New" }
];

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

  useEffect(() => {
    setCurrentIndex(0);
  }, [media]);

  const next = () => {
    setCurrentIndex((prev) => (prev + 1) % media.length);
  };

  const prev = () => {
    setCurrentIndex((prev) => (prev === 0 ? media.length - 1 : prev - 1));
  };

  const current = media[currentIndex];

  return (
    <div className="carousel">
      <div className="carousel-media">
        {current.media_type.startsWith("image") ? (
          <img src={`http://localhost:5000${current.media_url}`} alt="" />
        ) : (
          <video controls>
            <source src={`http://localhost:5000${current.media_url}`} />
          </video>
        )}
      </div>

      {media.length > 1 && (
        <button type="button" className="carousel-btn left" onClick={prev} aria-label="Previous media">
          {"<"}
        </button>
      )}

      {media.length > 1 && (
        <button type="button" className="carousel-btn right" onClick={next} aria-label="Next media">
          {">"}
        </button>
      )}

      <div className="carousel-counter">
        {currentIndex + 1}/{media.length}
      </div>
    </div>
  );
}

function SortTabs({ activeSort, onChange }) {
  return (
    <div className="feed-sort-bar">
      {SORT_OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          className={`feed-sort-pill ${activeSort === option.value ? "active" : ""}`}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function CommunitySearchCard({ community, onJoin, joiningCommunityId }) {
  return (
    <article className="community-search-card">
      <div className="community-search-copy">
        <p className="community-search-handle">c/{community.name}</p>
        <h3>{community.display_name}</h3>
        <p className="community-search-description">
          {community.description || "No description yet."}
        </p>
      </div>
      <div className="community-search-footer">
        <span className="community-search-members">
          {community.members_count} members
        </span>
        {community.is_joined ? (
          <Link to={`/c/${community.id}`} className="community-search-open">
            Open
          </Link>
        ) : (
          <button
            type="button"
            className="community-search-join"
            onClick={() => onJoin(community.id)}
            disabled={joiningCommunityId === community.id}
          >
            {joiningCommunityId === community.id ? "Joining..." : "Join"}
          </button>
        )}
      </div>
    </article>
  );
}

export default function HomeFeed() {
  const [posts, setPosts] = useState([]);
  const [communities, setCommunities] = useState([]);
  const [sortMode, setSortMode] = useState("hot");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [joiningCommunityId, setJoiningCommunityId] = useState(null);

  const loadFeed = async (activeSort = sortMode, activeQuery = searchQuery) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ sort: activeSort });
      const trimmedQuery = activeQuery.trim();
      if (trimmedQuery) {
        params.set("q", trimmedQuery);
      }

      const res = await fetch(`http://localhost:5000/api/posts/feed?${params.toString()}`, {
        credentials: "include"
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to load feed");
      }

      setPosts(Array.isArray(data.posts) ? data.posts : []);
      setCommunities(Array.isArray(data.communities) ? data.communities : []);
      setError("");
    } catch (err) {
      console.error("Failed to fetch feed", err);
      setError(err.message || "Unable to load your feed right now.");
      setPosts([]);
      setCommunities([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      loadFeed(sortMode, searchQuery);
    }, 250);

    return () => clearTimeout(timer);
  }, [sortMode, searchQuery]);

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

  const handleJoinCommunity = async (communityId) => {
    setJoiningCommunityId(communityId);
    try {
      const res = await fetch(`http://localhost:5000/api/communities/${communityId}/join`, {
        method: "POST",
        credentials: "include"
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to join community");
      }

      await loadFeed(sortMode, searchQuery);
    } catch (err) {
      setError(err.message || "Failed to join community");
    } finally {
      setJoiningCommunityId(null);
    }
  };

  const trimmedQuery = searchQuery.trim();
  const isSearching = trimmedQuery.length > 0;
  const activeSortLabel = SORT_OPTIONS.find((option) => option.value === sortMode)?.label || "Hot";

  if (loading) return <div className="feed-loading">Loading your feed...</div>;

  return (
    <div className="feed-container">
      <div className="feed-header">
        <div>
          <p className="feed-kicker">{isSearching ? "Search" : "Home feed"}</p>
          <h1>{isSearching ? `Results for "${trimmedQuery}"` : "Your personalized feed"}</h1>
          <p className="feed-subtitle">
            {isSearching
              ? "Matching communities appear first, followed by posts from communities you have already joined."
              : "Browse ranked posts from the communities you follow."}
          </p>
        </div>

        <label className="feed-search-shell">
          <span>Search</span>
          <input
            type="search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search posts and communities"
          />
        </label>
      </div>

      <SortTabs activeSort={sortMode} onChange={setSortMode} />

      {error && <p className="feed-empty">{error}</p>}

      {!error && isSearching && (
        <section className="feed-section">
          <div className="feed-section-header">
            <h2>Communities</h2>
            <span className="feed-section-count">{communities.length}</span>
          </div>

          {communities.length === 0 ? (
            <p className="feed-empty feed-empty-compact">No communities matched that search.</p>
          ) : (
            <div className="community-search-grid">
              {communities.map((community) => (
                <CommunitySearchCard
                  key={community.id}
                  community={community}
                  onJoin={handleJoinCommunity}
                  joiningCommunityId={joiningCommunityId}
                />
              ))}
            </div>
          )}
        </section>
      )}

      {!error && (
        <section className="feed-section">
          <div className="feed-section-header">
            <div>
              <h2>{isSearching ? "Posts from joined communities" : "Posts"}</h2>
              <p className="feed-section-note">{activeSortLabel} ranking</p>
            </div>
            <span className="feed-section-count">{posts.length}</span>
          </div>

          {posts.length === 0 ? (
            <p className="feed-empty">
              {isSearching
                ? "No joined-community posts matched your search yet."
                : "Your feed is empty. Join a few communities to get started."}
            </p>
          ) : (
            <div className="feed-list">
              {posts.map((post) => (
                <article key={post.id} className="feed-post-card">
                  <div className="feed-post-meta">
                    <span className="community">c/{post.community_name}</span>
                    <span className="separator">|</span>
                    <span>Posted by u/{post.author_name}</span>
                    <span className={`feed-rank-tag ${sortMode}`}>{activeSortLabel}</span>
                  </div>
                  <Link to={`/posts/${post.id}`} className="feed-post-link">
                    <h3 className="feed-post-title">{post.title}</h3>
                  </Link>
                  <p className="feed-post-content">{post.content}</p>

                  {post.media && post.media.length > 0 && (
                    <MediaCarousel media={post.media} />
                  )}

                  <div className="feed-post-footer">
                    <div className="feed-post-stats">
                      <button
                        type="button"
                        className={`feed-stat-button upvotes ${post.user_vote === 1 ? "active" : ""}`}
                        onClick={() => handleVote(post.id, 1)}
                        aria-label="Upvote post"
                      >
                        ^ <span>{post.upvote_count}</span>
                      </button>
                      <button
                        type="button"
                        className={`feed-stat-button downvotes ${post.user_vote === -1 ? "active" : ""}`}
                        onClick={() => handleVote(post.id, -1)}
                        aria-label="Downvote post"
                      >
                        v <span>{post.downvote_count}</span>
                      </button>
                      <CommentBadge count={post.comment_count} />
                    </div>
                    <Link to={`/posts/${post.id}`} className="feed-post-discussion-link">
                      Open
                    </Link>
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

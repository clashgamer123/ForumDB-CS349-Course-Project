import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import "../styles/PostPage.css";

function MediaCarousel({ media }) {
  const [currentIndex, setCurrentIndex] = useState(0);

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
          <img src={`http://localhost:5000${current.media_url}`} />
        ) : (
          <video controls>
            <source src={`http://localhost:5000${current.media_url}`} />
          </video>
        )}
      </div>

      {media.length > 1 && (
        <button className="carousel-btn left" onClick={prev}>
          ‹
        </button>
      )}

      {media.length > 1 && (
        <button className="carousel-btn right" onClick={next}>
          ›
        </button>
      )}

      <div className="carousel-counter">
        {currentIndex + 1}/{media.length}
      </div>
    </div>
  );
}

function CommentBadge({ count }) {
  return (
    <span className="comment-badge">
      <svg viewBox="0 0 20 20" aria-hidden="true" className="comment-badge-icon">
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

function VoteControls({ upvoteCount, downvoteCount, userVote, onVote }) {
  return (
    <div className="vote-controls">
      <button
        type="button"
        className={`vote-btn upvote ${userVote === 1 ? "active" : ""}`}
        onClick={() => onVote(1)}
        aria-label="Upvote"
      >
        ▲
        <span className="vote-count">{upvoteCount}</span>
      </button>
      <button
        type="button"
        className={`vote-btn downvote ${userVote === -1 ? "active" : ""}`}
        onClick={() => onVote(-1)}
        aria-label="Downvote"
      >
        ▼
        <span className="vote-count">{-downvoteCount}</span>
      </button>
    </div>
  );
}

function updateCommentVoteTree(comments, commentId, voteData) {
  return comments.map((comment) => {
    if (comment.id === commentId) {
      return { ...comment, ...voteData };
    }

    return {
      ...comment,
      replies: updateCommentVoteTree(comment.replies, commentId, voteData)
    };
  });
}

function CommentItem({
  comment,
  onVote,
  onSubmitReply,
  replyingTo,
  setReplyingTo,
  replyContent,
  setReplyContent,
  isSubmittingReply
}) {
  const isReplying = replyingTo === comment.id;

  return (
    <div className="comment-item">
      <div className="comment-body">
        <div className="comment-meta">
          <span>u/{comment.author_name}</span>
          <span className="separator">•</span>
          <span>{new Date(comment.created_at).toLocaleString()}</span>
        </div>
        <p className="comment-content">{comment.content}</p>
        <div className="comment-actions">
          <VoteControls
            upvoteCount={comment.upvote_count}
            downvoteCount={comment.downvote_count}
            userVote={comment.user_vote}
            onVote={(voteValue) => onVote(comment.id, voteValue)}
          />
          <button
            type="button"
            className="reply-toggle-btn"
            onClick={() => {
              setReplyingTo(isReplying ? null : comment.id);
              setReplyContent("");
            }}
          >
            {isReplying ? "Cancel" : "Reply"}
          </button>
        </div>

        {isReplying && (
          <form
            className="reply-form"
            onSubmit={(e) => {
              e.preventDefault();
              onSubmitReply(comment.id);
            }}
          >
            <textarea
              value={replyContent}
              onChange={(e) => setReplyContent(e.target.value)}
              placeholder="Write a reply..."
              rows="3"
              required
            />
            <button type="submit" className="comment-submit-btn" disabled={isSubmittingReply}>
              {isSubmittingReply ? "Posting..." : "Post Reply"}
            </button>
          </form>
        )}
      </div>

      {comment.replies.length > 0 && (
        <div className="comment-replies">
          {comment.replies.map((reply) => (
            <CommentItem
              key={reply.id}
              comment={reply}
              onVote={onVote}
              onSubmitReply={onSubmitReply}
              replyingTo={replyingTo}
              setReplyingTo={setReplyingTo}
              replyContent={replyContent}
              setReplyContent={setReplyContent}
              isSubmittingReply={isSubmittingReply}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function PostPage() {
  const { id } = useParams();
  const [post, setPost] = useState(null);
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [newComment, setNewComment] = useState("");
  const [replyingTo, setReplyingTo] = useState(null);
  const [replyContent, setReplyContent] = useState("");
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [showCommentComposer, setShowCommentComposer] = useState(false);

  useEffect(() => {
    loadPostPage();
  }, [id]);

  const loadPostPage = async () => {
    setLoading(true);
    try {
      const postRes = await fetch(`http://localhost:5000/api/posts/${id}`, {
        credentials: "include"
      });
      const postData = await postRes.json();
      if (!postRes.ok) {
        throw new Error(postData.error || "Failed to load post");
      }

      const commentsRes = await fetch(`http://localhost:5000/api/posts/${id}/comments`, {
        credentials: "include"
      });
      const commentsData = await commentsRes.json();
      if (!commentsRes.ok) {
        throw new Error(commentsData.error || "Failed to load comments");
      }

      setPost(postData);
      setComments(Array.isArray(commentsData) ? commentsData : []);
      setError("");
    } catch (err) {
      console.error("Failed to load post page", err);
      setError(err.message || "Unable to load post.");
      setPost(null);
      setComments([]);
    } finally {
      setLoading(false);
    }
  };

  const refreshComments = async () => {
    const res = await fetch(`http://localhost:5000/api/posts/${id}/comments`, {
      credentials: "include"
    });
    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || "Failed to load comments");
    }

    setComments(Array.isArray(data) ? data : []);
  };

  const refreshPost = async () => {
    const res = await fetch(`http://localhost:5000/api/posts/${id}`, {
      credentials: "include"
    });
    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || "Failed to load post");
    }

    setPost(data);
  };

  const handlePostVote = async (voteValue) => {
    try {
      const res = await fetch(`http://localhost:5000/api/posts/${id}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ vote_value: voteValue })
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to vote on post");
      }

      setPost((prev) => (prev ? { ...prev, ...data } : prev));
    } catch (err) {
      setError(err.message || "Failed to vote on post");
    }
  };

  const handleCommentVote = async (commentId, voteValue) => {
    try {
      const res = await fetch(`http://localhost:5000/api/posts/comments/${commentId}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ vote_value: voteValue })
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to vote on comment");
      }

      setComments((prev) => updateCommentVoteTree(prev, commentId, data));
    } catch (err) {
      setError(err.message || "Failed to vote on comment");
    }
  };

  const handleCreateComment = async (parentCommentId = null) => {
    const content = parentCommentId ? replyContent.trim() : newComment.trim();
    if (!content) {
      return;
    }

    setIsSubmittingComment(true);
    try {
      const res = await fetch(`http://localhost:5000/api/posts/${id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          content,
          parent_comment_id: parentCommentId
        })
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to create comment");
      }

      if (parentCommentId) {
        setReplyContent("");
        setReplyingTo(null);
      } else {
        setNewComment("");
        setShowCommentComposer(false);
      }

      await Promise.all([refreshComments(), refreshPost()]);
      setError("");
    } catch (err) {
      setError(err.message || "Failed to create comment");
    } finally {
      setIsSubmittingComment(false);
    }
  };

  if (loading) return <div className="post-page-loading">Loading post...</div>;

  if (error && !post) {
    return <div className="post-page-error">{error}</div>;
  }

  if (!post) {
    return <div className="post-page-error">Post not found.</div>;
  }

  return (
    <div className="post-page">
      <div className="post-panel">
        <div className="post-meta-row">
          <Link to={`/c/${post.community_id}`} className="post-community-link">
            c/{post.community_name}
          </Link>
          <span className="separator">•</span>
          <span>Posted by u/{post.author_name}</span>
        </div>
        <h1 className="post-page-title">{post.title}</h1>
        <p className="post-page-content">{post.content}</p>

        {post.media && post.media.length > 0 && (
          <MediaCarousel media={post.media} />
        )}

        <div className="post-footer">
          <VoteControls
            upvoteCount={post.upvote_count}
            downvoteCount={post.downvote_count}
            userVote={post.user_vote}
            onVote={handlePostVote}
          />
          <CommentBadge count={post.comment_count} />
        </div>
      </div>

      <div className="comments-panel">
        <div className="comments-header">
          <h2>Comments</h2>
          <CommentBadge count={post.comment_count} />
        </div>
        {error && <p className="post-page-inline-error">{error}</p>}

        {showCommentComposer ? (
          <form
            className="comment-form"
            onSubmit={(e) => {
              e.preventDefault();
              handleCreateComment();
            }}
          >
            <textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Write a comment..."
              rows="4"
              required
            />
            <div className="comment-form-actions">
              <button
                type="button"
                className="comment-cancel-btn"
                onClick={() => {
                  setShowCommentComposer(false);
                  setNewComment("");
                }}
              >
                Cancel
              </button>
              <button type="submit" className="comment-submit-btn" disabled={isSubmittingComment}>
                {isSubmittingComment ? "Posting..." : "Comment"}
              </button>
            </div>
          </form>
        ) : (
          <button
            type="button"
            className="comment-composer-trigger"
            onClick={() => setShowCommentComposer(true)}
          >
            Join the conversation
          </button>
        )}

        {comments.length === 0 ? (
          <p className="comments-empty">No comments yet. Start the discussion.</p>
        ) : (
          <div className="comments-list">
            {comments.map((comment) => (
              <CommentItem
                key={comment.id}
                comment={comment}
                onVote={handleCommentVote}
                onSubmitReply={handleCreateComment}
                replyingTo={replyingTo}
                setReplyingTo={setReplyingTo}
                replyContent={replyContent}
                setReplyContent={setReplyContent}
                isSubmittingReply={isSubmittingComment}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

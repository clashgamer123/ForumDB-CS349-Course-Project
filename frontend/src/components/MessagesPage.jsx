import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { mediaSrc } from "./MediaViewer";
import "../styles/MessagesPage.css";

function ShareLink({ message }) {
  if (!message.share_type || !message.share_id) return null;
  const href = message.share_type === "community"
    ? `/c/${message.share_id}`
    : `/posts/${message.share_id}`;

  return (
    <Link to={href} className="message-share">
      Shared {message.share_type} #{message.share_id}
    </Link>
  );
}

export default function MessagesPage() {
  const { userId } = useParams();
  const [threads, setThreads] = useState([]);
  const [activeUserId, setActiveUserId] = useState(userId || "");
  const [activeUser, setActiveUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [content, setContent] = useState("");
  const [media, setMedia] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [error, setError] = useState("");

  const loadThreads = async () => {
    const res = await fetch("http://localhost:5000/api/messages/threads", {
      credentials: "include"
    });
    const data = await res.json();
    setThreads(Array.isArray(data) ? data : []);
  };

  const loadThread = async (id) => {
    if (!id) return;
    const res = await fetch(`http://localhost:5000/api/messages/${id}`, {
      credentials: "include"
    });
    const data = await res.json();
    if (res.ok) {
      setActiveUser(data.user);
      setMessages(Array.isArray(data.messages) ? data.messages : []);
      setError(data.can_message ? "" : "You can send messages after this user accepts your follow.");
    } else {
      setError(data.error || "Failed to load messages");
    }
  };

  useEffect(() => {
    loadThreads();
  }, []);

  useEffect(() => {
    if (userId) setActiveUserId(userId);
  }, [userId]);

  useEffect(() => {
    loadThread(activeUserId);
  }, [activeUserId]);

  useEffect(() => {
    const timer = setTimeout(async () => {
      const q = searchQuery.trim();
      if (!q) {
        setSearchResults([]);
        return;
      }
      const res = await fetch(`http://localhost:5000/api/users/search?q=${encodeURIComponent(q)}`, {
        credentials: "include"
      });
      const data = await res.json();
      setSearchResults(Array.isArray(data) ? data : []);
    }, 250);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleUpload = async (event) => {
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
      setMedia({ media_url: data.media_url, media_type: data.media_type });
    } else {
      setError(data.error || "Upload failed");
    }
    event.target.value = "";
  };

  const sendMessage = async (event) => {
    event.preventDefault();
    if (!activeUserId) return;
    const res = await fetch(`http://localhost:5000/api/messages/${activeUserId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        content,
        media_url: media?.media_url,
        media_type: media?.media_type
      })
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Failed to send message");
      return;
    }
    setContent("");
    setMedia(null);
    await Promise.all([loadThread(activeUserId), loadThreads()]);
  };

  return (
    <div className="messages-page">
      <aside className="messages-sidebar">
        <h1>Messages</h1>
        <input
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder="Find users to message"
        />
        {searchResults.length > 0 && (
          <div className="message-search-results">
            {searchResults.map((user) => (
              <button
                key={user.id}
                type="button"
                onClick={() => {
                  setActiveUserId(String(user.id));
                  setSearchQuery("");
                  setSearchResults([]);
                }}
              >
                <img src={mediaSrc(user.profile_pic_url)} alt="" />
                <span>u/{user.username}</span>
                <small>{user.follow_status}</small>
              </button>
            ))}
          </div>
        )}

        <div className="thread-list">
          {threads.length === 0 ? (
            <p>No conversations yet.</p>
          ) : threads.map((thread) => (
            <button
              key={thread.other_user_id}
              type="button"
              className={String(thread.other_user_id) === String(activeUserId) ? "active" : ""}
              onClick={() => setActiveUserId(String(thread.other_user_id))}
            >
              <img src={mediaSrc(thread.profile_pic_url)} alt="" />
              <span>u/{thread.username}</span>
            </button>
          ))}
        </div>
      </aside>

      <section className="message-thread">
        {activeUser ? (
          <>
            <div className="message-thread-header">
              <img src={mediaSrc(activeUser.profile_pic_url)} alt="" />
              <h2>u/{activeUser.username}</h2>
            </div>

            {error && <p className="messages-error">{error}</p>}

            <div className="message-list">
              {messages.map((message) => (
                <article
                  key={message.id}
                  className={`message-bubble ${String(message.sender_id) === String(activeUserId) ? "incoming" : "outgoing"}`}
                >
                  {message.content && <p>{message.content}</p>}
                  {message.media_url && (
                    message.media_type?.startsWith("image") ? (
                      <img src={mediaSrc(message.media_url)} alt="" />
                    ) : (
                      <video controls src={mediaSrc(message.media_url)} />
                    )
                  )}
                  <ShareLink message={message} />
                </article>
              ))}
            </div>

            <form className="message-compose" onSubmit={sendMessage}>
              <textarea
                value={content}
                onChange={(event) => setContent(event.target.value)}
                placeholder="Write a message"
                rows="2"
              />
              {media && <span className="message-media-chip">{media.media_type}</span>}
              <input
                type="file"
                accept="image/png,image/jpeg,image/gif,video/mp4,video/webm,video/quicktime"
                onChange={handleUpload}
              />
              <button type="submit">Send</button>
            </form>
          </>
        ) : (
          <p className="messages-empty">Pick a conversation or search for a user you follow.</p>
        )}
      </section>
    </div>
  );
}

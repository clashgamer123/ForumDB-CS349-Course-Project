import { useEffect, useState } from "react";

export default function ShareBox({ shareType, shareId, buttonLabel = "Share" }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [users, setUsers] = useState([]);
  const [status, setStatus] = useState("");

  useEffect(() => {
    if (!open || !query.trim()) {
      setUsers([]);
      return;
    }
    const timer = setTimeout(async () => {
      const res = await fetch(`http://localhost:5000/api/users/search?q=${encodeURIComponent(query.trim())}`, {
        credentials: "include"
      });
      const data = await res.json();
      setUsers(Array.isArray(data) ? data : []);
    }, 250);
    return () => clearTimeout(timer);
  }, [open, query]);

  const sendShare = async (userId) => {
    const res = await fetch(`http://localhost:5000/api/messages/${userId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ share_type: shareType, share_id: shareId })
    });
    const data = await res.json();
    setStatus(res.ok ? "Shared" : (data.error || "Could not share"));
  };

  return (
    <div className="share-box">
      <button type="button" className="reply-toggle-btn" onClick={() => setOpen((prev) => !prev)}>
        {buttonLabel}
      </button>
      {open && (
        <div className="share-popover">
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search followed users" />
          {users.map((user) => (
            <button key={user.id} type="button" onClick={() => sendShare(user.id)}>
              u/{user.username} ({user.follow_status})
            </button>
          ))}
          {status && <small>{status}</small>}
        </div>
      )}
    </div>
  );
}

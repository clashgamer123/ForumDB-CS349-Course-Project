import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import "../styles/Communities.css";

export default function Communities() {
  const [allCommunities, setAllCommunities] = useState([]);
  const [myCommunities, setMyCommunities] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDisplayName, setNewDisplayName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [createError, setCreateError] = useState("");

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const allRes = await fetch("http://localhost:5000/api/communities/");
      const allData = await allRes.json();
      setAllCommunities(allData);

      const myRes = await fetch("http://localhost:5000/api/communities/my", { credentials: "include" });
      const myData = await myRes.json();
      setMyCommunities(myData);
    } catch (err) {
      console.error("Error fetching communities", err);
    }
    setLoading(false);
  };

  const handleJoinLeave = async (communityId, isJoining) => {
    const action = isJoining ? "join" : "leave";
    await fetch(`http://localhost:5000/api/communities/${communityId}/${action}`, {
      method: "POST",
      credentials: "include"
    });
    fetchData();
  };

  const handleCreateCommunity = async (e) => {
    e.preventDefault();
    setCreateError("");

    try {
      const res = await fetch("http://localhost:5000/api/communities/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: newName.replace(/\s+/g, '_'),
          display_name: newDisplayName,
          description: newDescription
        })
      });

      const data = await res.json();

      if (res.ok) {
        setNewName("");
        setNewDisplayName("");
        setNewDescription("");
        setShowCreateForm(false);
        fetchData();
      } else {
        setCreateError(data.error || "Failed to create community");
      }
    } catch (err) {
      setCreateError("Server error");
    }
  };

  const myCommunityIds = myCommunities.map(c => c.id);

  const filteredCommunities = allCommunities.filter(c =>
    !myCommunityIds.includes(c.id) && (
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.display_name.toLowerCase().includes(searchQuery.toLowerCase())
    )
  );

  if (loading) return <div className="communities-empty">Loading communities...</div>;

  return (
    <div className="communities-container">
      <div className="communities-header">
        <h1>Communities</h1>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className={`create-community-btn ${showCreateForm ? "cancel" : ""}`}
        >
          {showCreateForm ? "Cancel" : "+ Create Community"}
        </button>
      </div>

      {showCreateForm && (
        <div className="create-form-panel">
          <h3>Start a New Community</h3>
          {createError && <p className="create-form-error">{createError}</p>}
          <form onSubmit={handleCreateCommunity} className="create-form">
            <div className="form-field">
              <label>Community Handle (c/name)</label>
              <input
                type="text" required value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. DBIS_Students (No spaces)"
              />
            </div>
            <div className="form-field">
              <label>Display Name</label>
              <input
                type="text" required value={newDisplayName}
                onChange={(e) => setNewDisplayName(e.target.value)}
                placeholder="e.g. Database Systems Course 2024"
              />
            </div>
            <div className="form-field">
              <label>Description</label>
              <textarea
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="What is this community about?"
                rows="3"
              />
            </div>
            <button type="submit" className="form-submit-btn">
              Create c/{newName ? newName.replace(/\s+/g, '_') : "..."}
            </button>
          </form>
        </div>
      )}

      <input
        type="text"
        placeholder="Search communities..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        className="communities-search"
      />

      <div className="communities-columns">
        {/* Left: Joined */}
        <div className="communities-column">
          <h2>Your Subscriptions</h2>
          {myCommunities.length === 0 ? (
            <p className="communities-empty">You haven't joined any yet.</p>
          ) : (
            <ul className="communities-list">
              {myCommunities.map(c => (
                <li key={c.id} className="community-card">
                  <Link to={`/c/${c.id}`} className="community-card-link">c/{c.name}</Link>
                  <p className="community-card-display">{c.display_name}</p>
                  <p className="community-card-desc">{c.description}</p>
                  <button onClick={() => handleJoinLeave(c.id, false)} className="leave-btn">Leave</button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Right: Discover */}
        <div className="communities-column">
          <h2>Discover</h2>
          {filteredCommunities.length === 0 ? (
            <p className="communities-empty">
              {searchQuery ? "No matching communities found." : "No new communities to discover right now."}
            </p>
          ) : (
            <ul className="communities-list">
              {filteredCommunities.map(c => (
                <li key={c.id} className="community-card">
                  <span className="community-card-link locked">c/{c.name}</span>
                  <p className="community-card-display">{c.display_name}</p>
                  <p className="community-card-desc">{c.description}</p>
                  <div className="community-card-footer">
                    <span className="community-card-members">{c.members_count} members</span>
                    <button onClick={() => handleJoinLeave(c.id, true)} className="join-btn">Join</button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

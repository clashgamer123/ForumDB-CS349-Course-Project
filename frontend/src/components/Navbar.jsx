import { Link } from "react-router-dom";
import "../styles/Navbar.css";

export default function Navbar({ user, setUser }) {
  const handleLogout = async () => {
    await fetch("http://localhost:5000/api/auth/logout", {
      method: "POST",
      credentials: "include"
    });
    setUser(null);
  };

  return (
    <nav className="navbar">
      <div className="navbar-left">
        <h2 className="navbar-brand">ForumDB</h2>
        {user && (
          <>
            <Link to="/" className="navbar-link">Home Feed</Link>
            <Link to="/communities" className="navbar-link">Communities</Link>
          </>
        )}
      </div>

      {user && (
        <div className="navbar-right">
          <span className="navbar-username">u/{user.username}</span>
          <button onClick={handleLogout} className="navbar-logout-btn">Logout</button>
        </div>
      )}
    </nav>
  );
}
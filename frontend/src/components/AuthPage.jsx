import { useState } from "react";
import "../styles/AuthPage.css";

export default function AuthPage({ onLogin }) {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    const endpoint = isLogin ? "/api/auth/login" : "/api/auth/signup";
    const bodyData = isLogin ? { username, password } : { username, email, password };

    try {
      const res = await fetch(`http://localhost:5000${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(bodyData)
      });

      const data = await res.json();

      if (res.ok) {
        onLogin(data.user);
      } else {
        setError(data.error || "Authentication failed");
      }
    } catch (err) {
      setError("Server error. Is the backend running?");
    }
  };

  return (
    <div className="auth-wrapper">
      <div className="auth-card">
        <h2>{isLogin ? "Login to ForumDB" : "Create an Account"}</h2>
        {error && <p className="auth-error">{error}</p>}

        <form onSubmit={handleSubmit} className="auth-form">
          <input
            type="text" placeholder="Username" value={username}
            onChange={(e) => setUsername(e.target.value)} required
          />
          {!isLogin && (
            <input
              type="email" placeholder="Email" value={email}
              onChange={(e) => setEmail(e.target.value)} required
            />
          )}
          <input
            type="password" placeholder="Password" value={password}
            onChange={(e) => setPassword(e.target.value)} required
          />
          <button type="submit" className="auth-submit-btn">
            {isLogin ? "Login" : "Sign Up"}
          </button>
        </form>

        <p className="auth-toggle">
          {isLogin ? (
            <>Don't have an account?{" "}<span onClick={() => setIsLogin(false)}>Sign up</span></>
          ) : (
            <>Already have an account?{" "}<span onClick={() => setIsLogin(true)}>Login</span></>
          )}
        </p>
      </div>
    </div>
  );
}
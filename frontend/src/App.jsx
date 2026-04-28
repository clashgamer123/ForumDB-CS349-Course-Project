import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useState, useEffect } from "react";
import Navbar from "./components/Navbar";
import AuthPage from "./components/AuthPage";
import HomeFeed from "./components/HomeFeed";
import Communities from "./components/Communities";
import CommunityPage from "./components/CommunityPage";
import PostPage from "./components/PostPage";

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Check login status on first load
  useEffect(() => {
    fetch("http://localhost:5000/api/auth/isLoggedIn", {
      credentials: "include" // CRITICAL for sessions
    })
      .then(res => res.json())
      .then(data => {
        if (data.loggedIn) setUser(data.user);
        setLoading(false);
      })
      .catch(err => {
        console.error("Auth check failed", err);
        setLoading(false);
      });
  }, []);

  if (loading) return <div style={{ padding: "2rem" }}>Loading ForumDB...</div>;

  return (
    <BrowserRouter>
      {/* Navbar shows on every page */}
      <Navbar user={user} setUser={setUser} /> 
      
      <main style={{ width: "100%", padding: "2rem", boxSizing: "border-box" }}>
        <Routes>
          <Route 
            path="/login" 
            element={user ? <Navigate to="/" /> : <AuthPage onLogin={setUser} />} 
          />
          <Route 
            path="/" 
            element={user ? <HomeFeed /> : <Navigate to="/login" />} 
          />
          <Route 
            path="/c/:id" 
            element={user ? <CommunityPage /> : <Navigate to="/login" />} 
          />
          <Route
            path="/posts/:id"
            element={user ? <PostPage /> : <Navigate to="/login" />}
          />
          <Route 
            path="/communities" 
            element={user ? <Communities /> : <Navigate to="/login" />} 
          />
        </Routes>
      </main>
    </BrowserRouter>
  );
}

export default App;

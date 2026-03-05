import { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "./firebase";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Register from "./pages/Register";
import Certificate from "./pages/Certificate";

export default function App() {
  const [user, setUser] = useState(undefined);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUser(u || null));
    return unsub;
  }, []);

  if (user === undefined) return <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: "#0a0a0a", color: "#c9a84c", fontFamily: "serif", fontSize: "1.2rem" }}>Loading…</div>;

  return (
    <BrowserRouter basename={process.env.PUBLIC_URL}>
      <Routes>
        <Route path="/" element={user ? <Navigate to="/dashboard" /> : <Login />} />
        <Route path="/dashboard" element={user ? <Dashboard /> : <Navigate to="/" />} />
        <Route path="/register" element={user ? <Register /> : <Navigate to="/" />} />
        <Route path="/register/:id" element={user ? <Register /> : <Navigate to="/" />} />
        <Route path="/certificate/:id" element={user ? <Certificate /> : <Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  );
}

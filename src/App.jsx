import { useState, useEffect } from "react";
import { HashRouter, Routes, Route, Navigate } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "./firebase";
import { logAudit } from "./utils/audit";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Register from "./pages/Register";
import Certificate from "./pages/Certificate";
import Users from "./pages/Users";
import AuditLog from "./pages/AuditLog";

export default function App() {
  const [user, setUser] = useState(undefined);
  const [userRole, setUserRole] = useState(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (u) {
        // Fetch role from Firestore users collection
        try {
          const snap = await getDoc(doc(db, "users", u.uid));
          const role = snap.exists() ? (snap.data().role || "view") : "view";
          setUserRole(role);
          logAudit("LOGIN", { email: u.email });
        } catch {
          setUserRole("view");
        }
        setUser(u);
      } else {
        setUser(null);
        setUserRole(null);
      }
    });
    return unsub;
  }, []);

  if (user === undefined) return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:"100vh", background:"#0a0a0a", color:"#c9a84c", fontFamily:"serif", fontSize:"1.2rem" }}>
      Loading…
    </div>
  );

  const authed = (el) => user ? el : <Navigate to="/" />;

  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={user ? <Navigate to="/dashboard" /> : <Login />} />
        <Route path="/dashboard" element={authed(<Dashboard userRole={userRole} />)} />
        <Route path="/register" element={authed(<Register userRole={userRole} />)} />
        <Route path="/register/:id" element={authed(<Register userRole={userRole} />)} />
        <Route path="/certificate/:id" element={authed(<Certificate userRole={userRole} />)} />
        <Route path="/users" element={authed(<Users userRole={userRole} />)} />
        <Route path="/audit" element={authed(<AuditLog userRole={userRole} />)} />
      </Routes>
    </HashRouter>
  );
}

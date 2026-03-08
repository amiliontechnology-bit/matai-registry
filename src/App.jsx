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
import Import from "./pages/Import";
import Export from "./pages/Export";
import Notifications from "./pages/Notifications";
import DataManage from "./pages/DataManage";
import Reports from "./pages/Reports";

export default function App() {
  const [user, setUser] = useState(undefined);
  const [userRole, setUserRole] = useState(null);
  const [installPrompt, setInstallPrompt] = useState(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);

  // PWA install prompt — disabled until domain is finalised
  // useEffect(() => {
  //   const handler = (e) => {
  //     e.preventDefault();
  //     setInstallPrompt(e);
  //     if (!window.matchMedia("(display-mode: standalone)").matches) {
  //       setShowInstallBanner(true);
  //     }
  //   };
  //   window.addEventListener("beforeinstallprompt", handler);
  //   return () => window.removeEventListener("beforeinstallprompt", handler);
  // }, []);

  const handleInstall = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === "accepted") setShowInstallBanner(false);
    setInstallPrompt(null);
  };

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (u) {
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
      {/* PWA Install Banner */}
      {showInstallBanner && (
        <div style={{
          position: "fixed", bottom: "1rem", left: "50%", transform: "translateX(-50%)",
          background: "#0d2818", border: "1px solid rgba(74,222,128,0.3)",
          borderRadius: "8px", padding: "0.85rem 1.25rem",
          display: "flex", alignItems: "center", gap: "1rem",
          boxShadow: "0 4px 20px rgba(0,0,0,0.4)", zIndex: 9999,
          maxWidth: "calc(100vw - 2rem)", boxSizing: "border-box"
        }}>
          <img src={process.env.PUBLIC_URL + "/icon-72x72.png"} alt="" style={{ width: 36, height: 36, borderRadius: 6 }} />
          <div>
            <p style={{ fontFamily: "'Cinzel',serif", fontSize: "0.72rem", color: "#4ade80", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "2px" }}>Install App</p>
            <p style={{ fontSize: "0.78rem", color: "rgba(255,255,255,0.65)", margin: 0 }}>Add Matai Registry to your home screen</p>
          </div>
          <div style={{ display: "flex", gap: "0.5rem", marginLeft: "auto", flexShrink: 0 }}>
            <button onClick={() => setShowInstallBanner(false)}
              style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.2)", color: "rgba(255,255,255,0.5)", padding: "0.4rem 0.8rem", borderRadius: "4px", cursor: "pointer", fontFamily: "'Cinzel',serif", fontSize: "0.65rem", letterSpacing: "0.08em" }}>
              Later
            </button>
            <button onClick={handleInstall}
              style={{ background: "linear-gradient(135deg,#14482a,#2d9b57)", border: "none", color: "#fff", padding: "0.4rem 0.9rem", borderRadius: "4px", cursor: "pointer", fontFamily: "'Cinzel',serif", fontSize: "0.65rem", letterSpacing: "0.08em", textTransform: "uppercase" }}>
              Install
            </button>
          </div>
        </div>
      )}
      <Routes>
        <Route path="/" element={user ? <Navigate to="/dashboard" /> : <Login />} />
        <Route path="/dashboard" element={authed(<Dashboard userRole={userRole} />)} />
        <Route path="/register" element={authed(<Register userRole={userRole} />)} />
        <Route path="/register/:id" element={authed(<Register userRole={userRole} />)} />
        <Route path="/certificate/:id" element={authed(<Certificate userRole={userRole} />)} />
        <Route path="/users" element={authed(<Users userRole={userRole} />)} />
        <Route path="/audit" element={authed(<AuditLog userRole={userRole} />)} />
        <Route path="/import" element={authed(<Import userRole={userRole} />)} />
        <Route path="/export" element={authed(<Export userRole={userRole} />)} />
        <Route path="/reports" element={authed(<Reports userRole={userRole} />)} />
        <Route path="/notifications" element={authed(<Notifications userRole={userRole} />)} />
        <Route path="/data-manage" element={authed(<DataManage userRole={userRole} />)} />
      </Routes>
    </HashRouter>
  );
}

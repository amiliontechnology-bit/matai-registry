import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { signOut } from "firebase/auth";
import { auth } from "../firebase";
import { getPermissions } from "../utils/roles";
import { logAudit } from "../utils/audit";

export default function Sidebar({ userRole, userEmail }) {
  const loc   = useLocation();
  const perms = getPermissions(userRole);
  const [open, setOpen] = useState(false);

  const handleLogout = async () => {
    await logAudit("LOGOUT");
    signOut(auth);
  };

  const navItem = (to, icon, label) => {
    const active = loc.pathname === to || loc.pathname.startsWith(to + "/");
    return (
      <Link to={to} className={`nav-item${active ? " active" : ""}`} onClick={() => setOpen(false)}>
        <span style={{ fontSize:"14px", minWidth:"18px", textAlign:"center" }}>{icon}</span>
        <span>{label}</span>
      </Link>
    );
  };

  return (
    <>
      {/* ── Mobile hamburger bar ── */}
      <div className="mobile-topbar no-print">
        <button className="hamburger" onClick={() => setOpen(o => !o)} aria-label="Menu">
          <span /><span /><span />
        </button>
        <img src={process.env.PUBLIC_URL + "/mjca_logo.jpeg"} alt="MJCA"
          style={{ height:"36px", objectFit:"contain", borderRadius:"3px" }} />
        <span style={{ fontFamily:"'Cinzel Decorative',serif", fontSize:"0.75rem", color:"#4ade80" }}>
          Matai Registry
        </span>
      </div>

      {/* ── Overlay backdrop ── */}
      {open && <div className="sidebar-backdrop" onClick={() => setOpen(false)} />}

      <aside className={`sidebar${open ? " sidebar-open" : ""}`}>

        {/* ── Logo ── */}
        <div className="sidebar-logo">
          <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:"0.5rem", marginBottom:"0.5rem" }}>
            <img src={process.env.PUBLIC_URL + "/mjca_logo.jpeg"} alt="MJCA"
              style={{ width:"110px", height:"auto", objectFit:"contain", borderRadius:"4px" }} />
            <p style={{ fontFamily:"'Cinzel',serif", fontSize:"0.55rem", color:"rgba(255,255,255,0.3)",
              letterSpacing:"0.08em", textTransform:"uppercase", textAlign:"center" }}>
              Resitalaina o Matai
            </p>
          </div>
        </div>

        {/* ── User ── */}
        <div className="sidebar-user">
          <p style={{ fontSize:"0.6rem", color:"rgba(255,255,255,0.35)", fontFamily:"'Cinzel',serif",
            letterSpacing:"0.08em", textTransform:"uppercase", marginBottom:"4px" }}>
            Logged in as
          </p>
          <p style={{ fontSize:"0.72rem", color:"rgba(255,255,255,0.8)", wordBreak:"break-all",
            lineHeight:1.4, marginBottom:"6px" }}>
            {userEmail}
          </p>
          <span className="role-badge">{perms.label || userRole || "view"}</span>
        </div>

        {/* ── Nav ── */}
        <nav className="sidebar-nav">
          {navItem("/dashboard",      "⊞",  "Dashboard")}
          {perms.canAdd    && navItem("/register",       "＋",  "New Matai Entry")}
          {perms.canAdd    && navItem("/import",          "↑",   "Import")}
          {perms.canExport && navItem("/export",          "📊",  "Export")}
          {perms.canViewReports && navItem("/reports",   "📋",  "Reports")}
          {perms.canViewNotifications && navItem("/notifications","🔔",  "Notifications")}
          {perms.canViewUsers && navItem("/users",        "👤",  "Users")}
          {perms.canViewAudit && navItem("/audit",        "📋",  "Audit Log")}
          {perms.canDataManage && navItem("/data-manage",  "🗄️",  "Data Manage")}
        </nav>

        {/* ── Sign out ── */}
        <div className="sidebar-footer">
          <button onClick={handleLogout} style={{
            width:"100%", background:"rgba(255,255,255,0.05)",
            border:"1px solid rgba(255,255,255,0.15)", color:"rgba(255,255,255,0.55)",
            padding:"0.6rem", cursor:"pointer", fontFamily:"'Cinzel',serif",
            fontSize:"0.7rem", letterSpacing:"0.1em", textTransform:"uppercase",
            borderRadius:"4px", transition:"all 0.2s"
          }}>
            Sign Out
          </button>
        </div>
      </aside>
    </>
  );
}

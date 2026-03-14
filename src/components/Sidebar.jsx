import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { signOut } from "firebase/auth";
import { collection, onSnapshot } from "firebase/firestore";
import { auth, db } from "../firebase";
import { getPermissions } from "../utils/roles";
import { logAudit } from "../utils/audit";

export default function Sidebar({ userRole, userEmail }) {
  const loc   = useLocation();
  const perms = getPermissions(userRole);
  const [open, setOpen] = useState(false);
  const [notifCount, setNotifCount] = useState(0);

  // Live notification count — overdue + ready to register + incomplete DOB + active objections
  useEffect(() => {
    if (!perms.canViewNotifications) return;
    const unsub = onSnapshot(collection(db, "registrations"), (snap) => {
      const recs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      const today = new Date(); today.setHours(0,0,0,0);

      const calcReg = (proc) => {
        if (!proc || !/^\d{4}-\d{2}-\d{2}$/.test(proc)) return null;
        const p = new Date(proc + "T00:00:00");
        const t = new Date(p.getFullYear(), p.getMonth() + 4, 1);
        const last = new Date(t.getFullYear(), t.getMonth() + 1, 0).getDate();
        const reg = new Date(t.getFullYear(), t.getMonth(), Math.min(29, last));
        return reg <= today ? reg : null;
      };

      const ready     = recs.filter(r => !r.dateRegistration && r.objection !== "yes" && r.status !== "completed" && r.status !== "void" && r.dateSavaliPublished && calcReg(r.dateSavaliPublished)).length;
      const incomplete = recs.filter(r => !r.dateBirth || r.dateBirth.trim() === "").length;
      const objections = recs.filter(r => r.objection === "yes").length;
      const dupMap = new Map();
      recs.forEach(r => {
        const k = (r.certItumalo && r.certLaupepa && r.certRegBook) ? `${r.certItumalo}/${r.certLaupepa}/${r.certRegBook}` : r.mataiCertNumber || "";
        if (k) dupMap.set(k, (dupMap.get(k)||0)+1);
      });
      const dups = [...dupMap.values()].filter(v => v > 1).length;
      setNotifCount(ready + incomplete + objections + dups);
    });
    return () => unsub();
  }, [perms.canViewNotifications]);

  const handleLogout = async () => {
    await logAudit("LOGOUT");
    signOut(auth);
  };

  const navItem = (to, icon, label, badge = 0) => {
    const active = loc.pathname === to || loc.pathname.startsWith(to + "/");
    return (
      <Link to={to} className={`nav-item${active ? " active" : ""}`} onClick={() => setOpen(false)}>
        <span style={{ fontSize:"14px", minWidth:"18px", textAlign:"center" }}>{icon}</span>
        <span style={{ flex:1 }}>{label}</span>
        {badge > 0 && (
          <span style={{
            background:"#c0392b", color:"#fff", fontSize:"0.55rem", fontWeight:700,
            padding:"1px 5px", borderRadius:"10px", minWidth:"16px", textAlign:"center",
            lineHeight:"16px", fontFamily:"Arial,sans-serif", letterSpacing:0
          }}>{badge > 99 ? "99+" : badge}</span>
        )}
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
        <img src={"/mjca_logo.jpeg"} alt="MJCA"
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
            <img src={"/mjca_logo.jpeg"} alt="MJCA"
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
          {navItem("/dashboard", "⊞", "Dashboard")}

          {/* ── Records group ── */}
          <div style={{ margin:"0.6rem 0 0.2rem", padding:"0 0.5rem" }}>
            <p style={{ fontFamily:"'Cinzel',serif", fontSize:"0.5rem", letterSpacing:"0.18em", color:"rgba(255,255,255,0.25)",
              textTransform:"uppercase", marginBottom:"0.35rem", paddingLeft:"0.25rem" }}>Records</p>
            {navItem("/registry",           "📜", "Registry")}
            {navItem("/registry-progress",  "✏", "Registry in Progress")}
            {navItem("/pepa-samasama",       "📂", "Pepa Samasama")}
          </div>

          {perms.canAdd    && navItem("/register",       "＋",  "New Matai Entry")}
          {perms.canAdd    && navItem("/import",          "↑",   "Import")}
          {perms.canExport && navItem("/export",          "📊",  "Export")}
          {perms.canViewReports && navItem("/reports",   "📋",  "Reports")}
          {perms.canViewNotifications && navItem("/notifications", "🔔", "Notifications", notifCount)}
          {perms.canViewUsers && navItem("/users",        "👤",  "Users")}
          {perms.canViewAudit && navItem("/audit",        "📋",  "Audit Log")}
          {perms.canDataManage && navItem("/data-manage",  "🗄️",  "Data Manage")}
          {import.meta.env.VITE_ENV !== "development" && navItem("/mfa-setup", "🔐", "MFA Setup")}
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

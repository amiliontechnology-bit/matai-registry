import { Link, useLocation } from "react-router-dom";
import { signOut } from "firebase/auth";
import { auth } from "../firebase";
import { getPermissions } from "../utils/roles";
import { logAudit } from "../utils/audit";

export default function Sidebar({ userRole, userEmail }) {
  const loc = useLocation();
  const perms = getPermissions(userRole);

  const handleLogout = async () => {
    await logAudit("LOGOUT");
    signOut(auth);
  };

  const navItem = (to, icon, label) => {
    const active = loc.pathname === to || loc.pathname.startsWith(to + "/");
    return (
      <Link to={to} className={`nav-item${active ? " active" : ""}`}>
        <span style={{ fontSize:"13px" }}>{icon}</span>
        <span>{label}</span>
      </Link>
    );
  };

  return (
    <aside className="sidebar">
      {/* Logo */}
      <div className="sidebar-logo">
        <div style={{ display:"flex", alignItems:"center", gap:"0.5rem", marginBottom:"0.35rem" }}>
          <div style={{ width:"32px", height:"32px", minWidth:"32px", borderRadius:"50%", border:"1px solid #c9a84c", overflow:"hidden" }}>
            <img src={process.env.PUBLIC_URL + "/mjca_logo.jpeg"} alt="MJCA"
              style={{ width:"100%", height:"100%", objectFit:"cover" }} />
          </div>
          <div>
            <p style={{ fontFamily:"'Cinzel Decorative',serif", fontSize:"0.58rem", color:"#c9a84c", lineHeight:1.3 }}>Matai</p>
            <p style={{ fontFamily:"'Cinzel Decorative',serif", fontSize:"0.58rem", color:"#c9a84c", lineHeight:1.3 }}>Registry</p>
          </div>
        </div>
        <p style={{ fontFamily:"'Cinzel',serif", fontSize:"0.5rem", color:"rgba(201,168,76,0.35)", letterSpacing:"0.06em", textTransform:"uppercase" }}>
          Resitalaina o Matai
        </p>
      </div>

      {/* User */}
      <div className="sidebar-user">
        <p style={{ fontSize:"0.55rem", color:"rgba(245,237,224,0.35)", fontFamily:"'Cinzel',serif", letterSpacing:"0.06em", textTransform:"uppercase", marginBottom:"3px" }}>
          Logged in as
        </p>
        <p style={{ fontSize:"0.62rem", color:"rgba(245,237,224,0.65)", wordBreak:"break-all", lineHeight:1.4, marginBottom:"4px" }}>
          {userEmail}
        </p>
        <span className="role-badge">{userRole || "view"}</span>
      </div>

      {/* Nav */}
      <nav className="sidebar-nav">
        {navItem("/dashboard", "⬡", "Dashboard")}
        {perms.canAdd && navItem("/register", "+", "New Title")}
        {perms.canAdd && navItem("/import", "📥", "Import")}
        {navItem("/export", "📤", "Export")}
        {perms.canViewUsers && navItem("/users", "👤", "Users")}
        {perms.canViewAudit && navItem("/audit", "📋", "Audit Log")}
      </nav>

      {/* Sign out */}
      <div className="sidebar-footer">
        <button onClick={handleLogout} style={{
          width:"100%", background:"transparent", border:"1px solid rgba(201,168,76,0.25)",
          color:"rgba(245,237,224,0.45)", padding:"0.5rem", cursor:"pointer",
          fontFamily:"'Cinzel',serif", fontSize:"0.62rem", letterSpacing:"0.08em",
          textTransform:"uppercase", borderRadius:"2px"
        }}>
          Sign Out
        </button>
      </div>
    </aside>
  );
}

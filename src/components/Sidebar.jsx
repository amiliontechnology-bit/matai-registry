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
      <Link to={to} style={{ textDecoration:"none", display:"block", width:"100%" }}>
        <div style={{
          display:"flex", flexDirection:"row", alignItems:"center", gap:"0.5rem",
          padding:"0.65rem 0.8rem", marginBottom:"2px",
          background: active ? "rgba(201,168,76,0.15)" : "transparent",
          borderLeft: active ? "3px solid #c9a84c" : "3px solid transparent",
          color: active ? "#c9a84c" : "rgba(245,237,224,0.55)",
          fontFamily:"'Cinzel',serif", fontSize:"0.68rem", letterSpacing:"0.08em",
          textTransform:"uppercase", cursor:"pointer", transition:"all 0.2s",
          boxSizing:"border-box"
        }}>
          <span style={{ fontSize:"12px", flexShrink:0 }}>{icon}</span>
          <span style={{ flexShrink:0 }}>{label}</span>
        </div>
      </Link>
    );
  };

  return (
    <aside style={{
      width:"185px",
      minWidth:"185px",
      maxWidth:"185px",
      height:"100vh",
      position:"sticky",
      top:0,
      background:"rgba(5,5,5,0.98)",
      borderRight:"1px solid rgba(201,168,76,0.2)",
      display:"flex",
      flexDirection:"column",
      flexShrink:0,
      overflowY:"auto",
      boxSizing:"border-box",
      zIndex:50
    }}>
      {/* Logo */}
      <div style={{ padding:"1rem 0.8rem", borderBottom:"1px solid rgba(201,168,76,0.15)", flexShrink:0 }}>
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

      {/* User info */}
      <div style={{ padding:"0.65rem 0.8rem", borderBottom:"1px solid rgba(201,168,76,0.1)", flexShrink:0 }}>
        <p style={{ fontSize:"0.55rem", color:"rgba(245,237,224,0.35)", fontFamily:"'Cinzel',serif", letterSpacing:"0.06em", textTransform:"uppercase", marginBottom:"3px" }}>
          Logged in as
        </p>
        <p style={{ fontSize:"0.62rem", color:"rgba(245,237,224,0.65)", wordBreak:"break-all", lineHeight:1.4, marginBottom:"4px" }}>
          {userEmail}
        </p>
        <span style={{
          display:"inline-block",
          background:"rgba(201,168,76,0.12)", border:"1px solid rgba(201,168,76,0.3)",
          color:"#c9a84c", padding:"1px 6px", borderRadius:"2px",
          fontFamily:"'Cinzel',serif", fontSize:"0.55rem", letterSpacing:"0.06em", textTransform:"uppercase"
        }}>
          {userRole || "view"}
        </span>
      </div>

      {/* Nav */}
      <nav style={{ flex:1, paddingTop:"0.5rem", paddingBottom:"0.5rem", display:"flex", flexDirection:"column" }}>
        {navItem("/dashboard", "⬡", "Dashboard")}
        {perms.canAdd && navItem("/register", "+", "New Title")}
        {perms.canViewUsers && navItem("/users", "👤", "Users")}
        {perms.canViewAudit && navItem("/audit", "📋", "Audit Log")}
      </nav>

      {/* Sign out */}
      <div style={{ padding:"0.65rem 0.6rem", borderTop:"1px solid rgba(201,168,76,0.15)", flexShrink:0 }}>
        <button onClick={handleLogout} style={{
          width:"100%", background:"transparent", border:"1px solid rgba(201,168,76,0.25)",
          color:"rgba(245,237,224,0.45)", padding:"0.5rem", cursor:"pointer",
          fontFamily:"'Cinzel',serif", fontSize:"0.62rem", letterSpacing:"0.08em",
          textTransform:"uppercase", borderRadius:"2px", boxSizing:"border-box"
        }}>
          Sign Out
        </button>
      </div>
    </aside>
  );
}

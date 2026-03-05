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
      <Link to={to} style={{ textDecoration:"none", display:"block" }}>
        <div style={{
          display:"flex", alignItems:"center", gap:"0.6rem",
          padding:"0.65rem 0.8rem", borderRadius:"3px", marginBottom:"2px",
          background: active ? "rgba(201,168,76,0.15)" : "transparent",
          borderLeft: active ? "2px solid #c9a84c" : "2px solid transparent",
          color: active ? "#c9a84c" : "rgba(245,237,224,0.55)",
          fontFamily:"'Cinzel',serif", fontSize:"0.68rem", letterSpacing:"0.08em",
          textTransform:"uppercase", cursor:"pointer", transition:"all 0.2s",
        }}>
          <span style={{ fontSize:"12px", flexShrink:0 }}>{icon}</span>
          <span>{label}</span>
        </div>
      </Link>
    );
  };

  return (
    <div style={{
      width:"180px", minWidth:"180px", maxWidth:"180px",
      background:"rgba(5,5,5,0.98)",
      borderRight:"1px solid rgba(201,168,76,0.2)",
      display:"flex", flexDirection:"column",
      position:"sticky", top:0, height:"100vh",
      overflowY:"auto", flexShrink:0, zIndex:100
    }}>
      {/* Logo */}
      <div style={{ padding:"1rem 0.8rem", borderBottom:"1px solid rgba(201,168,76,0.15)" }}>
        <div style={{ display:"flex", alignItems:"center", gap:"0.5rem", marginBottom:"0.35rem" }}>
          <div style={{ width:"32px", height:"32px", borderRadius:"50%", border:"1px solid #c9a84c", overflow:"hidden", flexShrink:0 }}>
            <img src={process.env.PUBLIC_URL + "/mjca_logo.jpeg"} alt="MJCA"
              style={{ width:"100%", height:"100%", objectFit:"cover" }} />
          </div>
          <div>
            <p style={{ fontFamily:"'Cinzel Decorative',serif", fontSize:"0.58rem", color:"#c9a84c", lineHeight:1.3 }}>Matai</p>
            <p style={{ fontFamily:"'Cinzel Decorative',serif", fontSize:"0.58rem", color:"#c9a84c", lineHeight:1.3 }}>Registry</p>
          </div>
        </div>
        <p style={{ fontFamily:"'Cinzel',serif", fontSize:"0.52rem", color:"rgba(201,168,76,0.35)", letterSpacing:"0.06em", textTransform:"uppercase" }}>
          Resitalaina o Matai
        </p>
      </div>

      {/* User info */}
      <div style={{ padding:"0.65rem 0.8rem", borderBottom:"1px solid rgba(201,168,76,0.1)" }}>
        <p style={{ fontSize:"0.58rem", color:"rgba(245,237,224,0.35)", fontFamily:"'Cinzel',serif", letterSpacing:"0.06em", textTransform:"uppercase", marginBottom:"3px" }}>
          Logged in as
        </p>
        <p style={{ fontSize:"0.65rem", color:"rgba(245,237,224,0.65)", wordBreak:"break-all", lineHeight:1.4, marginBottom:"4px" }}>
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

      {/* Nav items */}
      <nav style={{ flex:1, padding:"0.6rem 0.4rem" }}>
        {navItem("/dashboard", "⬡", "Dashboard")}
        {perms.canAdd && navItem("/register", "+", "New Title")}
        {perms.canViewUsers && navItem("/users", "👤", "Users")}
        {perms.canViewAudit && navItem("/audit", "📋", "Audit Log")}
      </nav>

      {/* Sign out */}
      <div style={{ padding:"0.65rem 0.6rem", borderTop:"1px solid rgba(201,168,76,0.15)" }}>
        <button onClick={handleLogout} style={{
          width:"100%", background:"transparent", border:"1px solid rgba(201,168,76,0.25)",
          color:"rgba(245,237,224,0.45)", padding:"0.5rem", cursor:"pointer",
          fontFamily:"'Cinzel',serif", fontSize:"0.62rem", letterSpacing:"0.08em",
          textTransform:"uppercase", borderRadius:"2px"
        }}>
          Sign Out
        </button>
      </div>
    </div>
  );
}

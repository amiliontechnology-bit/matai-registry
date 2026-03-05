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
          display:"flex", alignItems:"center", gap:"0.65rem",
          padding:"0.7rem 1rem", borderRadius:"3px", marginBottom:"2px",
          background: active ? "rgba(201,168,76,0.15)" : "transparent",
          borderLeft: active ? "2px solid #c9a84c" : "2px solid transparent",
          color: active ? "#c9a84c" : "rgba(245,237,224,0.55)",
          fontFamily:"'Cinzel',serif", fontSize:"0.7rem", letterSpacing:"0.1em",
          textTransform:"uppercase", cursor:"pointer", transition:"all 0.2s",
          whiteSpace:"nowrap"
        }}>
          <span style={{ fontSize:"13px", flexShrink:0 }}>{icon}</span>
          {label}
        </div>
      </Link>
    );
  };

  return (
    <div style={{
      width:"200px", minWidth:"200px", background:"rgba(5,5,5,0.98)",
      borderRight:"1px solid rgba(201,168,76,0.2)",
      display:"flex", flexDirection:"column", flexShrink:0,
      position:"sticky", top:0, height:"100vh", overflowY:"auto",
      zIndex:100
    }}>
      {/* Logo */}
      <div style={{ padding:"1.2rem 1rem", borderBottom:"1px solid rgba(201,168,76,0.15)", flexShrink:0 }}>
        <div style={{ display:"flex", alignItems:"center", gap:"0.6rem", marginBottom:"0.4rem" }}>
          <div style={{ width:"34px", height:"34px", borderRadius:"50%", border:"1px solid #c9a84c", overflow:"hidden", flexShrink:0, background:"rgba(201,168,76,0.1)" }}>
            <img src={process.env.PUBLIC_URL + "/mjca_logo.jpeg"} alt="MJCA"
              style={{ width:"100%", height:"100%", objectFit:"cover", filter:"sepia(20%)" }} />
          </div>
          <div style={{ minWidth:0 }}>
            <p style={{ fontFamily:"'Cinzel Decorative',serif", fontSize:"0.62rem", color:"#c9a84c", lineHeight:1.3 }}>Matai</p>
            <p style={{ fontFamily:"'Cinzel Decorative',serif", fontSize:"0.62rem", color:"#c9a84c", lineHeight:1.3 }}>Registry</p>
          </div>
        </div>
        <p style={{ fontFamily:"'Cinzel',serif", fontSize:"0.55rem", color:"rgba(201,168,76,0.35)", letterSpacing:"0.08em", textTransform:"uppercase" }}>
          Resitalaina o Matai
        </p>
      </div>

      {/* User info */}
      <div style={{ padding:"0.7rem 1rem", borderBottom:"1px solid rgba(201,168,76,0.1)", flexShrink:0 }}>
        <p style={{ fontSize:"0.62rem", color:"rgba(245,237,224,0.35)", fontFamily:"'Cinzel',serif", letterSpacing:"0.08em", textTransform:"uppercase", marginBottom:"3px" }}>
          Logged in as
        </p>
        <p style={{ fontSize:"0.68rem", color:"rgba(245,237,224,0.65)", wordBreak:"break-all", lineHeight:1.4, marginBottom:"5px" }}>
          {userEmail}
        </p>
        <span style={{
          display:"inline-block",
          background:"rgba(201,168,76,0.12)", border:"1px solid rgba(201,168,76,0.3)",
          color:"#c9a84c", padding:"1px 7px", borderRadius:"2px",
          fontFamily:"'Cinzel',serif", fontSize:"0.58rem", letterSpacing:"0.08em", textTransform:"uppercase"
        }}>
          {userRole || "view"}
        </span>
      </div>

      {/* Nav */}
      <nav style={{ flex:1, padding:"0.75rem 0.4rem", overflowY:"auto" }}>
        {navItem("/dashboard", "⬡", "Dashboard")}
        {perms.canAdd && navItem("/register", "+", "Register Title")}
        {perms.canViewUsers && navItem("/users", "👤", "Users")}
        {perms.canViewAudit && navItem("/audit", "📋", "Audit Log")}
      </nav>

      {/* Logout */}
      <div style={{ padding:"0.75rem", borderTop:"1px solid rgba(201,168,76,0.15)", flexShrink:0 }}>
        <button onClick={handleLogout} style={{
          width:"100%", background:"transparent", border:"1px solid rgba(201,168,76,0.25)",
          color:"rgba(245,237,224,0.5)", padding:"0.55rem", cursor:"pointer",
          fontFamily:"'Cinzel',serif", fontSize:"0.65rem", letterSpacing:"0.1em",
          textTransform:"uppercase", borderRadius:"2px", transition:"all 0.2s"
        }}>
          Sign Out
        </button>
      </div>
    </div>
  );
}

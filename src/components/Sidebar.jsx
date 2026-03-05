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
      <Link to={to} style={{ textDecoration:"none" }}>
        <div style={{
          display:"flex", alignItems:"center", gap:"0.75rem",
          padding:"0.75rem 1.2rem", borderRadius:"3px", marginBottom:"2px",
          background: active ? "rgba(201,168,76,0.15)" : "transparent",
          borderLeft: active ? "2px solid #c9a84c" : "2px solid transparent",
          color: active ? "#c9a84c" : "rgba(245,237,224,0.6)",
          fontFamily:"'Cinzel',serif", fontSize:"0.72rem", letterSpacing:"0.12em",
          textTransform:"uppercase", cursor:"pointer",
          transition:"all 0.2s"
        }}>
          <span style={{ fontSize:"14px" }}>{icon}</span>
          {label}
        </div>
      </Link>
    );
  };

  return (
    <div style={{
      width:"220px", minHeight:"100vh", background:"rgba(5,5,5,0.98)",
      borderRight:"1px solid rgba(201,168,76,0.2)",
      display:"flex", flexDirection:"column", flexShrink:0,
      position:"sticky", top:0, height:"100vh"
    }}>
      {/* Logo */}
      <div style={{ padding:"1.5rem 1.2rem", borderBottom:"1px solid rgba(201,168,76,0.15)" }}>
        <div style={{ display:"flex", alignItems:"center", gap:"0.75rem", marginBottom:"0.5rem" }}>
          <div style={{ width:"36px", height:"36px", borderRadius:"50%", border:"1px solid #c9a84c", overflow:"hidden", flexShrink:0 }}>
            <img src={process.env.PUBLIC_URL + "/mjca_logo.jpeg"} alt="MJCA"
              style={{ width:"100%", height:"100%", objectFit:"cover", filter:"sepia(20%)" }} />
          </div>
          <div>
            <p style={{ fontFamily:"'Cinzel Decorative',serif", fontSize:"0.65rem", color:"#c9a84c", lineHeight:1.2 }}>Matai</p>
            <p style={{ fontFamily:"'Cinzel Decorative',serif", fontSize:"0.65rem", color:"#c9a84c", lineHeight:1.2 }}>Registry</p>
          </div>
        </div>
        <p style={{ fontFamily:"'Cinzel',serif", fontSize:"0.58rem", color:"rgba(201,168,76,0.4)", letterSpacing:"0.1em", textTransform:"uppercase" }}>
          Resitalaina o Matai
        </p>
      </div>

      {/* Role badge */}
      <div style={{ padding:"0.75rem 1.2rem", borderBottom:"1px solid rgba(201,168,76,0.1)" }}>
        <p style={{ fontSize:"0.7rem", color:"rgba(245,237,224,0.4)", fontFamily:"'Cinzel',serif", letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:"3px" }}>Logged in as</p>
        <p style={{ fontSize:"0.72rem", color:"rgba(245,237,224,0.7)", wordBreak:"break-all" }}>{userEmail}</p>
        <span style={{
          display:"inline-block", marginTop:"4px",
          background:"rgba(201,168,76,0.12)", border:"1px solid rgba(201,168,76,0.3)",
          color:"#c9a84c", padding:"1px 8px", borderRadius:"2px",
          fontFamily:"'Cinzel',serif", fontSize:"0.6rem", letterSpacing:"0.1em", textTransform:"uppercase"
        }}>
          {userRole || "view"}
        </span>
      </div>

      {/* Nav */}
      <nav style={{ flex:1, padding:"1rem 0.5rem", overflowY:"auto" }}>
        {navItem("/dashboard", "⬡", "Dashboard")}
        {perms.canAdd && navItem("/register", "＋", "Register Title")}
        {perms.canViewUsers && navItem("/users", "👤", "Users")}
        {perms.canViewAudit && navItem("/audit", "📋", "Audit Log")}
      </nav>

      {/* Logout */}
      <div style={{ padding:"1rem 0.75rem", borderTop:"1px solid rgba(201,168,76,0.15)" }}>
        <button onClick={handleLogout} style={{
          width:"100%", background:"transparent", border:"1px solid rgba(201,168,76,0.3)",
          color:"rgba(245,237,224,0.6)", padding:"0.6rem", cursor:"pointer",
          fontFamily:"'Cinzel',serif", fontSize:"0.68rem", letterSpacing:"0.12em",
          textTransform:"uppercase", borderRadius:"2px", transition:"all 0.2s"
        }}>
          Sign Out
        </button>
      </div>
    </div>
  );
}

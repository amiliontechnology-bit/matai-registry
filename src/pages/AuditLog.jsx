import { useState, useEffect } from "react";
import { collection, getDocs, orderBy, query, limit } from "firebase/firestore";
import { auth, db } from "../firebase";
import { getPermissions } from "../utils/roles";
import Sidebar from "../components/Sidebar";
import { Navigate } from "react-router-dom";

const ACTION_COLORS = {
  LOGIN: "#a0c4f5", LOGOUT: "#a0c4f5",
  CREATE: "#a0f5a0", UPDATE: "#c9a84c",
  DELETE: "#f5a0a0", DELETE_USER: "#f5a0a0",
  PRINT: "#e8c96a", CREATE_USER: "#a0f5a0",
  UPDATE_ROLE: "#c9a84c"
};

const ACTION_ICONS = {
  LOGIN:"🔑", LOGOUT:"🚪", CREATE:"＋", UPDATE:"✎",
  DELETE:"✕", PRINT:"🖨", CREATE_USER:"👤", DELETE_USER:"✕", UPDATE_ROLE:"🔄"
};

export default function AuditLog({ userRole }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterAction, setFilterAction] = useState("All");
  const [filterUser, setFilterUser] = useState("");
  const perms = getPermissions(userRole);
  const currentUser = auth.currentUser;

  if (!perms.canViewAudit) return <Navigate to="/dashboard" />;

  useEffect(() => {
    (async () => {
      try {
        const q = query(collection(db, "auditLog"), orderBy("timestamp", "desc"), limit(200));
        const snap = await getDocs(q);
        setLogs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (err) { console.error(err); }
      finally { setLoading(false); }
    })();
  }, []);

  const actions = ["All", ...new Set(logs.map(l => l.action))].sort();

  const filtered = logs.filter(l => {
    const matchAction = filterAction === "All" || l.action === filterAction;
    const matchUser = !filterUser || l.userEmail?.toLowerCase().includes(filterUser.toLowerCase());
    return matchAction && matchUser;
  });

  const formatTime = (ts) => {
    if (!ts?.toDate) return "—";
    return ts.toDate().toLocaleString("en-NZ", { day:"numeric", month:"short", year:"numeric", hour:"2-digit", minute:"2-digit" });
  };

  return (
    <div style={{ display:"flex", minHeight:"100vh", background:"#0a0a0a", color:"#f5ede0" }}>
      <div className="pattern-bg" style={{ position:"fixed" }} />
      <Sidebar userRole={userRole} userEmail={currentUser?.email} />
      <main style={{ flex:1, padding:"2.5rem", position:"relative", zIndex:1 }}>

        <div style={{ marginBottom:"2rem" }}>
          <p style={{ fontFamily:"'Cinzel',serif", fontSize:"0.7rem", letterSpacing:"0.25em", color:"rgba(201,168,76,0.6)", textTransform:"uppercase", marginBottom:"0.4rem" }}>Administration</p>
          <h1 style={{ fontFamily:"'Cinzel Decorative',serif", fontSize:"1.8rem", color:"#f5ede0" }}>Audit Log</h1>
          <p style={{ color:"rgba(245,237,224,0.4)", fontStyle:"italic", marginTop:"0.3rem", fontSize:"0.88rem" }}>
            Showing last 200 entries
          </p>
        </div>

        {/* Filters */}
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"1rem", marginBottom:"1.5rem" }}>
          <div className="form-group">
            <label>Filter by User</label>
            <input type="text" placeholder="Search by email…" value={filterUser} onChange={e => setFilterUser(e.target.value)} />
          </div>
          <div className="form-group">
            <label>Filter by Action</label>
            <select value={filterAction} onChange={e => setFilterAction(e.target.value)}>
              {actions.map(a => <option key={a}>{a}</option>)}
            </select>
          </div>
        </div>

        <p style={{ fontFamily:"'Cinzel',serif", fontSize:"0.68rem", color:"rgba(201,168,76,0.5)", letterSpacing:"0.1em", marginBottom:"1rem" }}>
          {filtered.length} entries
        </p>

        {loading ? (
          <div style={{ textAlign:"center", padding:"3rem", color:"rgba(201,168,76,0.5)", fontStyle:"italic" }}>Loading audit log…</div>
        ) : (
          <div style={{ background:"rgba(255,255,255,0.02)", border:"1px solid rgba(201,168,76,0.15)", borderRadius:"4px", overflowX:"auto" }}>
            <table style={{ width:"100%", borderCollapse:"collapse" }}>
              <thead>
                <tr style={{ borderBottom:"1px solid rgba(201,168,76,0.2)", background:"rgba(201,168,76,0.05)" }}>
                  {["Timestamp","User","Action","Details"].map(h => (
                    <th key={h} style={{ textAlign:"left", padding:"0.85rem 1rem", fontFamily:"'Cinzel',serif", fontSize:"0.62rem", letterSpacing:"0.15em", textTransform:"uppercase", color:"rgba(201,168,76,0.7)", whiteSpace:"nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(log => (
                  <tr key={log.id} style={{ borderBottom:"1px solid rgba(201,168,76,0.07)" }}>
                    <td style={{ padding:"0.8rem 1rem", fontSize:"0.8rem", opacity:0.6, whiteSpace:"nowrap" }}>
                      {formatTime(log.timestamp)}
                    </td>
                    <td style={{ padding:"0.8rem 1rem", fontSize:"0.82rem", opacity:0.8 }}>
                      {log.userEmail}
                    </td>
                    <td style={{ padding:"0.8rem 1rem" }}>
                      <span style={{
                        display:"inline-flex", alignItems:"center", gap:"4px",
                        background:`${ACTION_COLORS[log.action] || "#c9a84c"}18`,
                        border:`1px solid ${ACTION_COLORS[log.action] || "#c9a84c"}40`,
                        color: ACTION_COLORS[log.action] || "#c9a84c",
                        padding:"2px 8px", borderRadius:"2px",
                        fontFamily:"'Cinzel',serif", fontSize:"0.65rem", letterSpacing:"0.1em",
                        whiteSpace:"nowrap"
                      }}>
                        {ACTION_ICONS[log.action] || "•"} {log.action}
                      </span>
                    </td>
                    <td style={{ padding:"0.8rem 1rem", fontSize:"0.82rem", opacity:0.7 }}>
                      {log.details ? Object.entries(log.details).map(([k,v]) => `${k}: ${v}`).join(" | ") : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}

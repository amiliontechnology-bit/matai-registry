import { useState, useEffect } from "react";
import { collection, getDocs, orderBy, query, limit } from "firebase/firestore";
import { auth, db } from "../firebase";
import { getPermissions } from "../utils/roles";
import Sidebar from "../components/Sidebar";
import { Navigate } from "react-router-dom";

const ACTION_COLORS = {
  LOGIN: "#a0c4f5", LOGOUT: "#a0c4f5",
  CREATE: "#a0f5a0", UPDATE: "#1e6b3c",
  DELETE: "#f5a0a0", DELETE_USER: "#f5a0a0",
  PRINT: "#2d9b57", CREATE_USER: "#a0f5a0",
  UPDATE_ROLE: "#1e6b3c"
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
    const d = ts.toDate();
    const date = `${String(d.getDate()).padStart(2,"0")}/${String(d.getMonth()+1).padStart(2,"0")}/${d.getFullYear()}`;
    const time = `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
    return `${date} ${time}`;
  };

  return (
    <div className="app-layout">
      <div className="pattern-bg" />
      <Sidebar userRole={userRole} userEmail={currentUser?.email} />
      <div className="sidebar-content">

        <div style={{ marginBottom:"2rem" }}>
          <p style={{ fontFamily:"'Cinzel',serif", fontSize:"0.7rem", letterSpacing:"0.25em", color:"#1e6b3c", textTransform:"uppercase", marginBottom:"0.4rem" }}>Administration</p>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-end" }}>
            <h1 style={{ fontFamily:"'Cinzel Decorative',serif", fontSize:"1.8rem", color:"#1a1a1a" }}>Audit Log</h1>
            <button onClick={() => window.print()} style={{ background:"linear-gradient(135deg,#14482a,#1e6b3c,#2d9b57)", color:"#fff", border:"none", padding:"0.6rem 1.4rem", fontFamily:"'Cinzel',serif", fontSize:"0.75rem", fontWeight:"700", letterSpacing:"0.12em", textTransform:"uppercase", borderRadius:"2px", cursor:"pointer" }}>
              🖨 Print / PDF
            </button>
          </div>
          <p style={{ color:"rgba(26,26,26,0.45)", fontStyle:"italic", marginTop:"0.3rem", fontSize:"0.88rem" }}>
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

        <p style={{ fontFamily:"'Cinzel',serif", fontSize:"0.68rem", color:"#1e6b3c", letterSpacing:"0.1em", marginBottom:"1rem" }}>
          {filtered.length} entries
        </p>

        {loading ? (
          <div style={{ textAlign:"center", padding:"3rem", color:"#1e6b3c", fontStyle:"italic" }}>Loading audit log…</div>
        ) : (
          <div style={{ background:"#ffffff", border:"1px solid rgba(45,122,79,0.18)", borderRadius:"4px", overflowX:"auto" }}>
            <table style={{ width:"100%", borderCollapse:"collapse" }}>
              <thead>
                <tr style={{ borderBottom:"1px solid rgba(45,122,79,0.25)", background:"rgba(30,107,60,0.06)" }}>
                  {["Timestamp","User","Action","Details"].map(h => (
                    <th key={h} style={{ textAlign:"left", padding:"0.85rem 1rem", fontFamily:"'Cinzel',serif", fontSize:"0.62rem", letterSpacing:"0.15em", textTransform:"uppercase", color:"rgba(30,107,60,0.75)", whiteSpace:"nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(log => (
                  <tr key={log.id} style={{ borderBottom:"1px solid rgba(30,107,60,0.1)" }}>
                    <td style={{ padding:"0.8rem 1rem", fontSize:"0.8rem", opacity:0.6, whiteSpace:"nowrap" }}>
                      {formatTime(log.timestamp)}
                    </td>
                    <td style={{ padding:"0.8rem 1rem", fontSize:"0.82rem", opacity:0.8 }}>
                      {log.userEmail}
                    </td>
                    <td style={{ padding:"0.8rem 1rem" }}>
                      <span style={{
                        display:"inline-flex", alignItems:"center", gap:"4px",
                        background:`${ACTION_COLORS[log.action] || "#1e6b3c"}18`,
                        border:`1px solid ${ACTION_COLORS[log.action] || "#1e6b3c"}40`,
                        color: ACTION_COLORS[log.action] || "#1e6b3c",
                        padding:"2px 8px", borderRadius:"2px",
                        fontFamily:"'Cinzel',serif", fontSize:"0.65rem", letterSpacing:"0.1em",
                        whiteSpace:"nowrap"
                      }}>
                        {ACTION_ICONS[log.action] || "•"} {log.action}
                      </span>
                    </td>
                    <td style={{ padding:"0.8rem 1rem", fontSize:"0.82rem" }}>
                      {log.details?.changes ? (
                        <div>
                          <span style={{ color:"rgba(30,107,60,0.7)", fontSize:"0.75rem" }}>
                            {log.details.fieldsChanged} field{log.details.fieldsChanged !== 1 ? "s" : ""} changed
                          </span>
                          <div style={{ marginTop:"4px" }}>
                            {log.details.changes.split(" | ").map((ch, i) => (
                              <div key={i} style={{ fontSize:"0.75rem", color:"rgba(26,26,26,0.65)", lineHeight:1.6, borderLeft:"2px solid rgba(30,107,60,0.3)", paddingLeft:"6px", marginBottom:"2px" }}>
                                {ch}
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : log.details ? (
                        <span style={{ opacity:0.65 }}>
                          {Object.entries(log.details).filter(([k]) => k !== "userId").map(([k,v]) => `${k}: ${v}`).join(" | ")}
                        </span>
                      ) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    <style>{`
        @media print {
          .no-print { display: none !important; }
          .sidebar { display: none !important; }
          .sidebar-content { margin-left: 0 !important; }
          body { background: white !important; color: #1a1a1a !important; }
          @page { size: A4 landscape; margin: 1cm; }
        }
      `}</style>
    </div>
  );
}

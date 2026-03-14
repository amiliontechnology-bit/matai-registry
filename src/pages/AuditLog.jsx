import { useState, useEffect } from "react";
import { collection, getDocs, deleteDoc, doc, orderBy, query, limit } from "firebase/firestore";
import { cacheGet, cacheSet, cacheClear } from "../utils/cache";
import { auth, db } from "../firebase";
import { getPermissions } from "../utils/roles";
import { logAudit } from "../utils/audit";
import Sidebar from "../components/Sidebar";
import { Navigate } from "react-router-dom";

const ACTION_COLORS = {
  LOGIN: "#a0c4f5", LOGOUT: "#a0c4f5",
  CREATE: "#a0f5a0", UPDATE: "#1e6b3c",
  DELETE: "#f5a0a0", DELETE_USER: "#f5a0a0",
  PRINT: "#2d9b57", CREATE_USER: "#a0f5a0",
  UPDATE_ROLE: "#1e6b3c", IMPORT: "#7c3aed",
  REPORT_PDF: "#155c31", CONFIRM_REGISTRATION: "#155c31",
  DUPLICATE_WARNING: "#c0392b"
};

const ACTION_ICONS = {
  LOGIN:"🔑", LOGOUT:"🚪", CREATE:"＋", UPDATE:"✎",
  DELETE:"✕", PRINT:"🖨", CREATE_USER:"👤", DELETE_USER:"✕", UPDATE_ROLE:"🔄",
  IMPORT:"📥", REPORT_PDF:"📄", CONFIRM_REGISTRATION:"✓", DUPLICATE_WARNING:"⚠"
};

export default function AuditLog({ userRole }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterAction, setFilterAction] = useState("All");
  const [filterUser, setFilterUser] = useState("");
  const [confirmClear, setConfirmClear] = useState(false);
  const [clearing, setClearing] = useState(false);
  const perms = getPermissions(userRole);
  const currentUser = auth.currentUser;

  if (userRole === null) return null;
  if (!perms.canViewAudit) return <Navigate to="/dashboard" />;

  const loadLogs = async () => {
    try {
      const q = query(collection(db, "auditLog"), orderBy("timestamp", "desc"), limit(200));
      const snap = await getDocs(q);
      setLogs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const handleClearAuditLog = async () => {
    setClearing(true);
    try {
      const snap = await getDocs(collection(db, "auditLog"));
      for (const d of snap.docs) await deleteDoc(doc(db, "auditLog", d.id));
      cacheClear("auditLog");
      await logAudit("CLEAR_AUDIT_LOG", { clearedBy: currentUser?.email, count: snap.docs.length });
      setLogs([]);
      setConfirmClear(false);
    } catch (err) { console.error(err); }
    finally { setClearing(false); }
  };

  useEffect(() => { loadLogs(); }, []);

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
            <div style={{ display:"flex", gap:"0.75rem" }}>
              <button onClick={() => setConfirmClear(true)}
                style={{ background:"transparent", color:"#991b1b", border:"1px solid rgba(153,27,27,0.4)", padding:"0.6rem 1.2rem", fontFamily:"'Cinzel',serif", fontSize:"0.72rem", fontWeight:"700", letterSpacing:"0.1em", textTransform:"uppercase", borderRadius:"2px", cursor:"pointer" }}>
                🗑 Clear Log
              </button>
              <button onClick={() => window.print()} style={{ background:"linear-gradient(135deg,#14482a,#1e6b3c,#2d9b57)", color:"#fff", border:"none", padding:"0.6rem 1.4rem", fontFamily:"'Cinzel',serif", fontSize:"0.75rem", fontWeight:"700", letterSpacing:"0.12em", textTransform:"uppercase", borderRadius:"2px", cursor:"pointer" }}>
                🖨 Print / PDF
              </button>
            </div>
          </div>

          {confirmClear && (
            <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.5)", zIndex:1000, display:"flex", alignItems:"center", justifyContent:"center" }}>
              <div style={{ background:"#fff", borderRadius:"6px", padding:"2rem", maxWidth:"420px", width:"90%", boxShadow:"0 20px 60px rgba(0,0,0,0.3)" }}>
                <p style={{ fontFamily:"'Cinzel',serif", fontSize:"0.78rem", color:"#991b1b", marginBottom:"0.5rem", letterSpacing:"0.1em", textTransform:"uppercase" }}>⚠ Confirm Clear Audit Log</p>
                <p style={{ fontSize:"0.9rem", color:"#374151", marginBottom:"1.5rem", lineHeight:1.6 }}>
                  This will permanently delete all <strong>{logs.length}</strong> audit log entries. This action cannot be undone.
                </p>
                <div style={{ display:"flex", gap:"0.75rem", justifyContent:"flex-end" }}>
                  <button onClick={() => setConfirmClear(false)} style={{ padding:"0.5rem 1.2rem", fontFamily:"'Cinzel',serif", fontSize:"0.72rem", background:"transparent", border:"1px solid #e5e7eb", color:"#6b7280", borderRadius:"3px", cursor:"pointer" }}>
                    Cancel
                  </button>
                  <button onClick={handleClearAuditLog} disabled={clearing}
                    style={{ padding:"0.5rem 1.2rem", fontFamily:"'Cinzel',serif", fontSize:"0.72rem", background:"#991b1b", color:"#fff", border:"none", borderRadius:"3px", cursor:clearing?"not-allowed":"pointer", opacity:clearing?0.7:1 }}>
                    {clearing ? "Clearing…" : "Clear All Entries"}
                  </button>
                </div>
              </div>
            </div>
          )}
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
            <table style={{ width:"100%", borderCollapse:"collapse", minWidth:"640px" }}>
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
                      {(() => {
                        const d = log.details;
                        if (!d) return <span style={{ opacity:0.4 }}>—</span>;
                        const action = log.action;
                        // ── UPDATE: show record name + field-by-field changes ──
                        if (action === "UPDATE" || action === "CONFIRM_REGISTRATION") {
                          const title = d.mataiTitle || d.recordId || "record";
                          return (
                            <div>
                              <span style={{ fontWeight:600, color:"#1a5c35", fontSize:"0.82rem" }}>
                                {action === "CONFIRM_REGISTRATION" ? `Confirmed registration of ${title}` : `Edited record: ${title}`}
                              </span>
                              {d.dateRegistration && <div style={{ fontSize:"0.75rem", color:"#155c31", marginTop:"2px" }}>Registered: {d.dateRegistration}</div>}
                              {d.changes && (
                                <div style={{ marginTop:"4px" }}>
                                  <span style={{ fontSize:"0.72rem", color:"rgba(30,107,60,0.6)" }}>{d.fieldsChanged} field{d.fieldsChanged !== 1 ? "s" : ""} changed:</span>
                                  {d.changes.split(" | ").map((ch, i) => (
                                    <div key={i} style={{ fontSize:"0.75rem", color:"rgba(26,26,26,0.65)", lineHeight:1.6, borderLeft:"2px solid rgba(30,107,60,0.3)", paddingLeft:"6px", marginTop:"2px" }}>
                                      {ch}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        }
                        // ── CREATE: new record ──
                        if (action === "CREATE") {
                          return (
                            <div>
                              <span style={{ fontWeight:600, color:"#1a5c35" }}>New entry: {d.mataiTitle || "—"}</span>
                              <div style={{ fontSize:"0.75rem", color:"rgba(26,26,26,0.55)", marginTop:"2px" }}>
                                {[d.holderName, d.village, d.district].filter(Boolean).join(" · ")}
                              </div>
                            </div>
                          );
                        }
                        // ── IMPORT: file name + count ──
                        if (action === "IMPORT") {
                          return (
                            <div>
                              <span style={{ fontWeight:600, color:"#1a5c35" }}>
                                {d.count} record{d.count !== 1 ? "s" : ""} imported
                              </span>
                              {d.file && <div style={{ fontSize:"0.75rem", color:"rgba(26,26,26,0.55)", marginTop:"2px" }}>File: {d.file}</div>}
                              {d.skipped > 0 && <div style={{ fontSize:"0.75rem", color:"#c0392b", marginTop:"2px" }}>{d.skipped} row{d.skipped !== 1 ? "s" : ""} skipped</div>}
                            </div>
                          );
                        }
                        // ── DELETE ──
                        if (action === "DELETE") {
                          return <span style={{ color:"#c0392b", fontWeight:600 }}>Deleted: {d.mataiTitle || d.recordId || "record"}</span>;
                        }
                        // ── PRINT ──
                        if (action === "PRINT") {
                          return <span>Certificate printed: <strong>{d.mataiTitle || "—"}</strong></span>;
                        }
                        // ── REPORT_PDF ──
                        if (action === "REPORT_PDF") {
                          const typeLabels = { monthly_full:"Monthly Full Report", monthly_ready:"Ready to Register", monthly_proc:"Savali Published Date Report", monthly_obj:"Objections Report", monthly_new:"New Matai Titles", full_ready:"Full Ready Report", full_obj:"Full Objections", full_proc:"Full Savali Published Date Report", registered_month:`Registered — ${d.month||""}`, registered_all:"All Registered", filtered:"Filtered Report", proclamation:"Savali Alerts", ready:"Ready to Register", new_matai:"New Matai Titles", objections:"Objections Report" };
                          return <span>PDF generated: <strong>{typeLabels[d.type] || d.type}</strong>{d.count !== undefined ? ` (${d.count} records)` : ""}</span>;
                        }
                        // ── DUPLICATE_WARNING ──
                        if (action === "DUPLICATE_WARNING") {
                          return <span style={{ color:"#c0392b", fontWeight:600 }}>⚠ Duplicate cert no. detected: <strong>{d.certNumber}</strong> — {d.mataiTitle}</span>;
                        }
                        // ── LOGIN/LOGOUT ──
                        if (action === "LOGIN" || action === "LOGOUT") {
                          return <span style={{ opacity:0.6 }}>{action === "LOGIN" ? "Signed in" : "Signed out"}</span>;
                        }
                        // ── Fallback ──
                        return (
                          <span style={{ opacity:0.65, fontSize:"0.78rem" }}>
                            {Object.entries(d).filter(([k]) => !["userId","recordId"].includes(k)).map(([k,v]) => `${k}: ${v}`).join(" · ")}
                          </span>
                        );
                      })()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

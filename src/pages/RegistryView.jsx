import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { collection, onSnapshot } from "firebase/firestore";
import { auth, db } from "../firebase";
import { getPermissions } from "../utils/roles";
import { logAudit } from "../utils/audit";
import Sidebar from "../components/Sidebar";
import { cacheSet } from "../utils/cache";

const fmtDate = (str) => {
  if (!str) return "—";
  const parts = String(str).split("T")[0].split("-");
  if (parts.length === 3 && parts[0].length === 4)
    return `${parts[2].padStart(2,"0")}-${parts[1].padStart(2,"0")}-${parts[0]}`;
  const d = new Date(str);
  if (isNaN(d)) return "—";
  return `${String(d.getDate()).padStart(2,"0")}/${String(d.getMonth()+1).padStart(2,"0")}/${d.getFullYear()}`;
};

function effectiveRegDate(r) {
  if (r.dateRegistration) return r.dateRegistration;
  if (r.objection === "yes" || !r.dateSavaliPublished) return null;
  const p = new Date(r.dateSavaliPublished + "T00:00:00");
  const target = new Date(p.getFullYear(), p.getMonth() + 4, 1);
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  const reg = new Date(target.getFullYear(), target.getMonth(), Math.min(29, lastDay));
  const today = new Date(); today.setHours(0,0,0,0);
  return reg <= today
    ? `${reg.getFullYear()}-${String(reg.getMonth()+1).padStart(2,"0")}-${String(reg.getDate()).padStart(2,"0")}`
    : null;
}

function getStatusCat(r) {
  if (r.status === "void" || r.objection === "petition_won") return "void";
  if (r.status === "pepa_samasama") return "pepa_samasama";
  // Treat as completed if reg date is set and in the past — catches records saved before the fix
  if (r.dateRegistration && new Date(r.dateRegistration + "T00:00:00") <= new Date()) return "completed";
  if (r.status === "completed") return "completed";
  return "in_progress";
}

const PAGE_SIZE = 30;

const VIEW_CONFIG = {
  completed: {
    title: "Registry",
    subtitle: "Finalised and registered Matai titles",
    accent: "#1a5c35",
    empty: "No completed registrations yet.",
  },
  in_progress: {
    title: "Registry in Progress",
    subtitle: "Records currently being worked on",
    accent: "#b45309",
    empty: "No records in progress.",
  },
  pepa_samasama: {
    title: "Pepa Samasama",
    subtitle: "Legacy and historically incomplete records — editable in place",
    accent: "#6b7280",
    empty: "No Pepa Samasama records.",
  },
};

export default function RegistryView({ userRole, statusFilter }) {
  const perms = getPermissions(userRole);
  const [records, setRecords]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState("");
  const [filterDistrict, setFilterDistrict] = useState("All");
  const [filterType, setFilterType]         = useState("All");
  const [filterVillage, setFilterVillage]   = useState("All");
  const [filterGender, setFilterGender]     = useState("All");
  const [page, setPage] = useState(1);

  const cfg = VIEW_CONFIG[statusFilter] || VIEW_CONFIG.in_progress;

  useEffect(() => {
    setLoading(true);
    const unsub = onSnapshot(collection(db, "registrations"), (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      data.sort((a,b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
      cacheSet("registrations", data);
      setRecords(data);
      setLoading(false);
    }, (err) => { console.error(err); setLoading(false); });
    return () => unsub();
  }, []);

  if (userRole === null) return null;

  const allDistricts = [...new Set(records.map(r => r.district).filter(Boolean))].sort();
  const allVillages  = [...new Set(records.map(r => r.village).filter(Boolean))].sort();
  const allTypes     = [...new Set(records.map(r => r.mataiType).filter(Boolean))].sort();

  const lower = search.toLowerCase();
  const filtered = records.filter(r => {
    if (getStatusCat(r) !== statusFilter) return false;
    const matchSearch = !search ||
      r.mataiTitle?.toLowerCase().includes(lower) ||
      r.holderName?.toLowerCase().includes(lower) ||
      r.village?.toLowerCase().includes(lower) ||
      r.district?.toLowerCase().includes(lower) ||
      r.mataiCertNumber?.toLowerCase().includes(lower);
    const matchDistrict = filterDistrict === "All" || r.district === filterDistrict;
    const matchType     = filterType === "All" || r.mataiType === filterType;
    const matchVillage  = filterVillage === "All" || r.village === filterVillage;
    const matchGender   = filterGender === "All" || r.gender === filterGender;
    return matchSearch && matchDistrict && matchType && matchVillage && matchGender;
  });

  const hasFilters = search || filterDistrict !== "All" || filterType !== "All" || filterVillage !== "All" || filterGender !== "All";
  const clear = () => { setSearch(""); setFilterDistrict("All"); setFilterType("All"); setFilterVillage("All"); setFilterGender("All"); setPage(1); };

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const safePage   = Math.min(page, Math.max(1, totalPages));
  const pageRecords = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  return (
    <div className="app-layout">
      <div className="pattern-bg" />
      <Sidebar userRole={userRole} userEmail={auth.currentUser?.email} />
      <div className="sidebar-content">

        {/* ── Header ── */}
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:"1.25rem", flexWrap:"wrap", gap:"0.75rem" }}>
          <div>
            <h1 style={{ fontFamily:"'Cinzel Decorative',serif", fontSize:"1.35rem", color:"#1a5c35", fontWeight:400, marginBottom:"3px" }}>
              {cfg.title}
            </h1>
            <p style={{ fontSize:"0.8rem", color:"rgba(26,26,26,0.45)", fontStyle:"italic" }}>{cfg.subtitle}</p>
          </div>
          <div style={{ display:"flex", gap:"0.5rem", alignItems:"center" }}>
            <span style={{ fontFamily:"'Cinzel',serif", fontSize:"0.62rem", letterSpacing:"0.1em", color:cfg.accent,
              background:`${cfg.accent}12`, border:`1px solid ${cfg.accent}30`, padding:"4px 10px", borderRadius:"3px" }}>
              {filtered.length} Record{filtered.length !== 1 ? "s" : ""}
            </span>
            {perms.canAdd && (
              <Link to="/register">
                <button style={{ padding:"0.4rem 0.9rem", fontFamily:"'Cinzel',serif", fontSize:"0.65rem", letterSpacing:"0.08em",
                  textTransform:"uppercase", background:"#1a5c35", border:"none", color:"#fff", borderRadius:"3px", cursor:"pointer" }}>
                  ＋ New
                </button>
              </Link>
            )}
          </div>
        </div>

        {/* ── Filters ── */}
        <div style={{ background:"#fff", border:"1px solid #e5e7eb", borderRadius:"6px", padding:"0.85rem 1rem", marginBottom:"1rem", boxShadow:"0 1px 3px rgba(0,0,0,0.05)" }}>
          <div style={{ display:"flex", flexWrap:"wrap", gap:"0.6rem", alignItems:"flex-end" }}>
            <div className="form-group" style={{ margin:0, flex:"1 1 160px" }}>
              <label>Search</label>
              <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
                placeholder="Title, name, village…" style={{ fontSize:"0.83rem" }} />
            </div>
            {[
              { label:"District", val:filterDistrict, set:setFilterDistrict, opts:allDistricts },
              { label:"Village",  val:filterVillage,  set:setFilterVillage,  opts:allVillages },
              { label:"Type",     val:filterType,     set:setFilterType,     opts:allTypes },
            ].map(f => (
              <div key={f.label} className="form-group" style={{ margin:0 }}>
                <label>{f.label}</label>
                <select value={f.val} onChange={e => { f.set(e.target.value); setPage(1); }}>
                  <option value="All">All</option>
                  {f.opts.map(o => <option key={o}>{o}</option>)}
                </select>
              </div>
            ))}
            <div className="form-group" style={{ margin:0 }}>
              <label>Gender</label>
              <select value={filterGender} onChange={e => { setFilterGender(e.target.value); setPage(1); }}>
                <option value="All">All</option>
                <option value="M">Male</option>
                <option value="F">Female</option>
              </select>
            </div>
            {hasFilters && (
              <button onClick={clear} style={{ background:"transparent", border:"1px solid rgba(139,26,26,0.3)", color:"#8b1a1a",
                padding:"0.45rem 0.8rem", fontFamily:"'Cinzel',serif", fontSize:"0.62rem", letterSpacing:"0.08em",
                textTransform:"uppercase", borderRadius:"4px", cursor:"pointer", whiteSpace:"nowrap", height:"36px" }}>
                ✕ Clear
              </button>
            )}
          </div>
        </div>

        {/* ── Count ── */}
        <p style={{ fontFamily:"'Cinzel',serif", fontSize:"0.65rem", color:"#6b7280", letterSpacing:"0.1em", marginBottom:"0.75rem" }}>
          Showing <strong style={{ color:"#155c31" }}>
            {filtered.length === 0 ? 0 : `${(safePage-1)*PAGE_SIZE+1}–${Math.min(safePage*PAGE_SIZE, filtered.length)}`}
          </strong> of <strong>{filtered.length}</strong> records
        </p>

        {/* ── Table ── */}
        <div style={{ background:"#fff", border:"1px solid #d1d5db", borderRadius:"6px", boxShadow:"0 1px 3px rgba(0,0,0,0.08)", overflow:"hidden" }}>
          {loading ? (
            <div style={{ textAlign:"center", padding:"4rem", color:"#6b7280", fontStyle:"italic" }}>Loading…</div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign:"center", padding:"4rem" }}>
              <p style={{ color:"#9ca3af", fontStyle:"italic" }}>
                {records.filter(r => getStatusCat(r) === statusFilter).length === 0 ? cfg.empty : "No records match your search."}
              </p>
            </div>
          ) : (
            <div style={{ overflowX:"auto" }}>
              <table className="data-table">
                <thead>
                  <tr>
                    {["Cert No.", "Matai Title", "Holder", "Type", "Nu'u", "Itūmālō", "Reg. Date", "Status", "Actions"].map(h => (
                      <th key={h}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pageRecords.map(r => (
                    <tr key={r.id}>
                      <td style={{ fontFamily:"'Cinzel',serif", fontSize:"0.72rem", color:"#6b7280", whiteSpace:"nowrap" }}>
                        {r.certItumalo && r.certLaupepa && r.certRegBook
                          ? `${r.certItumalo}/${r.certLaupepa}/${r.certRegBook}`
                          : r.mataiCertNumber || r.refNumber || "—"}
                      </td>
                      <td style={{ fontFamily:"'Cinzel',serif", color:"#155c31", fontWeight:700, fontSize:"0.88rem", whiteSpace:"nowrap" }}>
                        {r.mataiTitle}
                      </td>
                      <td style={{ color:"#111827", fontWeight:500, fontSize:"0.83rem" }}>{r.holderName}</td>
                      <td><span className="type-badge" style={{ fontSize:"0.62rem", padding:"1px 7px" }}>{r.mataiType || "—"}</span></td>
                      <td style={{ color:"#374151", fontSize:"0.83rem" }}>{r.village || "—"}</td>
                      <td style={{ color:"#374151", fontSize:"0.78rem", whiteSpace:"nowrap" }}>{r.district || "—"}</td>
                      <td style={{ color:"#6b7280", fontSize:"0.78rem", whiteSpace:"nowrap" }}>
                        {(() => {
                          const d = effectiveRegDate(r);
                          return d
                            ? <span style={{ color: r.dateRegistration ? "#374151" : "#b45309",
                                fontStyle: r.dateRegistration ? "normal" : "italic",
                                background: r.dateRegistration ? "none" : "#fef3c7",
                                padding: r.dateRegistration ? "0" : "1px 4px", borderRadius:"3px" }}>
                                {fmtDate(d)}{!r.dateRegistration && " ⚠"}
                              </span>
                            : <span style={{ color:"#9ca3af" }}>—</span>;
                        })()}
                      </td>
                      <td>
                        <span style={{
                                          fontFamily:"'Cinzel',serif", fontSize:"0.58rem", letterSpacing:"0.1em",
                                          textTransform:"uppercase", padding:"2px 7px", borderRadius:"3px",
                                          ...(r.status==="completed"     ? {background:"#dcfce7",color:"#15803d",border:"1px solid #86efac"} :
                                              r.status==="pepa_samasama" ? {background:"#f3f4f6",color:"#374151",border:"1px solid #d1d5db"} :
                                              r.status==="void"          ? {background:"#fee2e2",color:"#991b1b",border:"1px solid #fca5a5"} :
                                                                           {background:"#fef3c7",color:"#92400e",border:"1px solid #fcd34d"})
                                        }}>
                                          {getStatusCat(r)==="completed"?"Completed":getStatusCat(r)==="pepa_samasama"?"Pepa Samasama":getStatusCat(r)==="void"?"Void":"In Progress"}
                                        </span>
                      </td>
                      <td>
                        <div style={{ display:"flex", gap:"0.2rem" }}>
                          {(() => {
                            const regPassed = r.dateRegistration && new Date(r.dateRegistration + "T00:00:00") <= new Date();
                            return perms.canPrint && (regPassed || r.incompleteConfirmed) ? (
                              <Link to={`/certificate/${r.id}`}>
                                <button className="btn-ghost" style={{ padding:"3px 6px", fontSize:"0.9rem" }} title="View Certificate"
                                  onClick={() => logAudit("PRINT", { mataiTitle: r.mataiTitle, recordId: r.id })}>
                                  🏅
                                </button>
                              </Link>
                            ) : perms.canPrint ? (
                              <button className="btn-ghost" style={{ padding:"3px 6px", opacity:0.35, cursor:"not-allowed" }} disabled>🏅</button>
                            ) : null;
                          })()}
                          {perms.canEdit ? (
                            <Link to={`/register/${r.id}`} state={{ recordIds: filtered.map(x => x.id) }}>
                              <button className="btn-ghost" style={{ padding:"3px 6px" }} title="Edit">✎</button>
                            </Link>
                          ) : (
                            <Link to={`/register/${r.id}`} state={{ recordIds: filtered.map(x => x.id) }}>
                              <button className="btn-ghost" style={{ padding:"3px 6px" }} title="View">👁</button>
                            </Link>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ── Pagination ── */}
        {totalPages > 1 && (
          <div style={{ display:"flex", justifyContent:"center", gap:"0.5rem", marginTop:"1.25rem", flexWrap:"wrap" }}>
            <button onClick={() => setPage(p => Math.max(1, p-1))} disabled={safePage === 1}
              style={{ padding:"0.35rem 0.8rem", fontFamily:"'Cinzel',serif", fontSize:"0.65rem", background:"transparent",
                border:"1px solid rgba(26,92,53,0.3)", color:"#1a5c35", borderRadius:"3px", cursor:"pointer",
                opacity: safePage === 1 ? 0.4 : 1 }}>← Prev</button>
            <span style={{ fontFamily:"'Cinzel',serif", fontSize:"0.7rem", color:"#6b7280", padding:"0.35rem 0.5rem" }}>
              {safePage} / {totalPages}
            </span>
            <button onClick={() => setPage(p => Math.min(totalPages, p+1))} disabled={safePage === totalPages}
              style={{ padding:"0.35rem 0.8rem", fontFamily:"'Cinzel',serif", fontSize:"0.65rem", background:"transparent",
                border:"1px solid rgba(26,92,53,0.3)", color:"#1a5c35", borderRadius:"3px", cursor:"pointer",
                opacity: safePage === totalPages ? 0.4 : 1 }}>Next →</button>
          </div>
        )}

      </div>
    </div>
  );
}

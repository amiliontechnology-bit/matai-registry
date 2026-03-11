import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { collection, getDocs, deleteDoc, doc, onSnapshot } from "firebase/firestore";
import { auth, db } from "../firebase";
import { getPermissions } from "../utils/roles";
import { logAudit } from "../utils/audit";
import Sidebar from "../components/Sidebar";
import { cacheGet, cacheSet, cacheClear } from "../utils/cache";
import { seedTestData } from "../utils/seedData";

const fmtDate = (str) => {
  if (!str) return "—";
  // Parse YYYY-MM-DD directly to avoid timezone shifting
  const parts = String(str).split("T")[0].split("-");
  if (parts.length === 3 && parts[0].length === 4) {
    return `${parts[2].padStart(2,"0")}-${parts[1].padStart(2,"0")}-${parts[0]}`;
  }
  // Fallback for any other format
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
  return reg <= today ? `${reg.getFullYear()}-${String(reg.getMonth()+1).padStart(2,"0")}-${String(reg.getDate()).padStart(2,"0")}` : null;
}

export default function Dashboard({ userRole }) {
  const navigate = useNavigate();
  const [records, setRecords]       = useState([]);
  const [loading, setLoading]       = useState(true);
  const [search, setSearch]         = useState("");
  const [filterDistrict, setFilterDistrict] = useState("All");
  const [filterType, setFilterType] = useState("All");
  const [filterVillage, setFilterVillage] = useState("All");
  const [filterGender, setFilterGender] = useState("All");
  const [filterStatus, setFilterStatus] = useState("All");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [deleting, setDeleting]     = useState(null);
  const [seeding, setSeeding] = useState(false);
  const [seedMsg, setSeedMsg] = useState("");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 25;
  const perms = getPermissions(userRole);
  const user  = auth.currentUser;

  useEffect(() => {
    setLoading(true);
    const unsub = onSnapshot(collection(db, "registrations"), (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
      cacheSet("registrations", list);
      setRecords(list);
      setLoading(false);
    }, (err) => {
      console.error("Dashboard listener error:", err);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const handleDelete = async (id, title) => {
    if (!window.confirm("Remove this registration permanently?")) return;
    setDeleting(id);
    await deleteDoc(doc(db, "registrations", id));
    await logAudit("DELETE", { mataiTitle: title, recordId: id });
    cacheClear("registrations");
    // onSnapshot will auto-update records list
    setDeleting(null);
  };


  const districts = ["All", ...new Set(records.map(r => r.district).filter(Boolean))].sort();
  const types = ["All", "Ali'i", "Tulafale"];
  const villages = ["All", ...new Set(records.map(r => r.village).filter(Boolean))].sort();
  const genders = ["All", "Male", "Female"];

  const filtered = records.filter(r => {
    const s = search.toLowerCase();
    const matchSearch = !search ||
      r.mataiTitle?.toLowerCase().includes(s) ||
      r.holderName?.toLowerCase().includes(s) ||
      r.village?.toLowerCase().includes(s) ||
      r.district?.toLowerCase().includes(s) ||
      r.mataiCertNumber?.toLowerCase().includes(s);
    const matchDistrict = filterDistrict === "All" || r.district === filterDistrict;
    const matchType = filterType === "All" || r.mataiType === filterType;
    const matchVillage = filterVillage === "All" || r.village === filterVillage;
    const matchGender = filterGender === "All" || r.gender === filterGender;
    const matchStatus = filterStatus === "All" || (filterStatus === "completed" ? r.status === "completed" : r.status !== "completed");
    const matchDateFrom = !filterDateFrom || (r.dateRegistration && r.dateRegistration >= filterDateFrom);
    const matchDateTo = !filterDateTo || (r.dateRegistration && r.dateRegistration <= filterDateTo);
    return matchSearch && matchDistrict && matchType && matchVillage && matchGender && matchStatus && matchDateFrom && matchDateTo;
  });

  const hasActiveFilters = filterDistrict !== "All" || filterType !== "All" || filterVillage !== "All" || filterGender !== "All" || filterStatus !== "All" || filterDateFrom || filterDateTo || search;
  const clearAllFilters = () => { setSearch(""); setFilterDistrict("All"); setFilterType("All"); setFilterVillage("All"); setFilterGender("All"); setFilterStatus("All"); setFilterDateFrom(""); setFilterDateTo(""); setPage(1); };

  // Reset to page 1 when filters change
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const safePage = Math.min(page, Math.max(1, totalPages));
  const pageRecords = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const normalizeType = (t) => (t || "").trim().toLowerCase();
  const totalAli        = records.filter(r => normalizeType(r.mataiType) === "ali'i" || normalizeType(r.mataiType) === "alii").length;
  const totalTulafale   = records.filter(r => normalizeType(r.mataiType) === "tulafale").length;
  const totalRegistered = records.filter(r => r.dateRegistration && new Date(r.dateRegistration + "T00:00:00") <= new Date()).length;
  const totalOther    = records.filter(r => {
    const t = normalizeType(r.mataiType);
    return t && t !== "ali'i" && t !== "alii" && t !== "tulafale" && t !== "faipule";
  }).length;

  // Detect duplicate cert numbers for dashboard warning
  const certMap = new Map();
  records.forEach(r => {
    const composed = [r.certItumalo, r.certLaupepa, r.certRegBook].filter(Boolean).join("/");
    const key = (r.mataiCertNumber || composed || "").trim();
    if (!key) return;
    certMap.set(key, (certMap.get(key) || 0) + 1);
  });
  const duplicateCertCount = [...certMap.values()].filter(v => v > 1).length;
  const incompleteDobCount = records.filter(r => !r.dateBirth || r.dateBirth.trim() === "").length;

  // Ready to Register: Savali period passed, no objection, not yet registered
  function autoRegDateDash(savaliStr) {
    if (!savaliStr) return null;
    const p = new Date(savaliStr + "T00:00:00");
    if (isNaN(p)) return null;
    const t = new Date(p.getFullYear(), p.getMonth() + 4, 1);
    const last = new Date(t.getFullYear(), t.getMonth() + 1, 0).getDate();
    const reg = new Date(t.getFullYear(), t.getMonth(), Math.min(29, last));
    const y = reg.getFullYear(), m = String(reg.getMonth()+1).padStart(2,"0"), d = String(reg.getDate()).padStart(2,"0");
    return `${y}-${m}-${d}`;
  }
  const readyToRegCount = records.filter(r => {
    if (r.objection === "yes") return false;
    if (r.status === "completed") return false;
    if (r.dateRegistration) return false;
    if (!r.dateSavaliPublished) return false;
    const rd = autoRegDateDash(r.dateSavaliPublished);
    return rd && new Date(rd + "T00:00:00") <= new Date();
  }).length;

  const handleSeed = async () => {
    if (!window.confirm("This will clear all existing records and load test data. Continue?")) return;
    setSeeding(true); setSeedMsg("");
    const result = await seedTestData((done, total, title) => setSeedMsg(`Importing ${done}/${total}: ${title}…`));
    cacheClear("registrations");
    if (result.success) {
      setSeedMsg(`✓ ${result.message} Redirecting…`);
    } else {
      setSeedMsg(`✗ ${result.message}`);
    }
    setSeeding(false);
    if (result.success) setTimeout(() => { cacheClear("registrations"); navigate("/dashboard"); window.location.reload(); }, 1500);
  };

  const pgBtn = (disabled, active = false) => ({
    padding:"0.3rem 0.6rem", fontFamily:"'Cinzel',serif", fontSize:"0.68rem",
    background: active ? "#155c31" : disabled ? "#f3f4f6" : "#fff",
    color: active ? "#fff" : disabled ? "#9ca3af" : "#155c31",
    border: `1px solid ${active ? "#155c31" : disabled ? "#e5e7eb" : "rgba(21,92,49,0.3)"}`,
    borderRadius:"3px", cursor: disabled ? "not-allowed" : "pointer", letterSpacing:"0.04em"
  });

  return (
    <div className="app-layout">
      <div className="pattern-bg" />
      <Sidebar userRole={userRole} userEmail={user?.email} />

      <div className="sidebar-content">
        {/* ── Header ── */}
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:"2rem" }}>
          <div>
            <p className="page-eyebrow">Official Record</p>
            <h1 className="page-title">Samoa Matai Title Registry</h1>
          </div>
          <div style={{ display:"flex", gap:"0.75rem", alignItems:"center" }}>

            {perms.canAdd && (
              <Link to="/register">
                <button className="btn-primary">＋ Register Title</button>
              </Link>
            )}
            {process.env.REACT_APP_ENV === "development" && getPermissions(userRole).canDelete && (
              <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:"0.3rem" }}>
                <button onClick={handleSeed} disabled={seeding}
                  style={{ background:"#4a1d96", color:"white", border:"none", padding:"0.5rem 1.1rem", borderRadius:"4px", fontFamily:"'Cinzel',serif", fontSize:"0.72rem", letterSpacing:"0.08em", cursor: seeding ? "not-allowed" : "pointer", opacity: seeding ? 0.6 : 1, whiteSpace:"nowrap" }}>
                  {seeding ? "⏳ Loading…" : "🧪 Seed Test Data"}
                </button>
                {seedMsg && <span style={{ fontSize:"0.72rem", color: seedMsg.startsWith("✓") ? "#1e6b3c" : seedMsg.startsWith("✗") ? "#c0392b" : "#4a1d96", fontStyle:"italic", textAlign:"right" }}>{seedMsg}</span>}
              </div>
            )}
          </div>
        </div>

        {/* ── Stats ── */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:"1rem", marginBottom:"2rem" }}>
          {[
            { label:"Total Entries",    value: records.length,   accent:"#155c31" },
            { label:"Total Registered", value: totalRegistered,  accent:"#1a5c35" },
            { label:"Ali'i",            value: totalAli,         accent:"#1e7a42" },
            { label:"Tulafale",         value: totalTulafale,    accent:"#0d2818" },
          ].map(s => (
            <div key={s.label} className="stat-card">
              <p style={{ fontFamily:"'Cinzel',serif", fontSize:"0.65rem", letterSpacing:"0.18em", color:"#6b7280", textTransform:"uppercase", marginBottom:"0.5rem" }}>{s.label}</p>
              <p style={{ fontFamily:"'Cinzel Decorative',serif", fontSize:"2rem", color: s.accent, lineHeight:1 }}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* ── Duplicate cert number warning ── */}
        {duplicateCertCount > 0 && (
          <Link to="/notifications" state={{ tab:"duplicates" }} style={{ textDecoration:"none" }}>
            <div style={{ background:"#fff5f5", border:"1px solid #fca5a5", borderLeft:"4px solid #c0392b", borderRadius:"4px", padding:"0.75rem 1.25rem", marginBottom:"1rem", display:"flex", justifyContent:"space-between", alignItems:"center", cursor:"pointer" }}
              onMouseEnter={e => e.currentTarget.style.background="#fee2e2"}
              onMouseLeave={e => e.currentTarget.style.background="#fff5f5"}>
              <div style={{ display:"flex", alignItems:"center", gap:"0.75rem" }}>
                <span style={{ fontSize:"1.1rem" }}>⚠️</span>
                <div>
                  <p style={{ fontFamily:"'Cinzel',serif", fontSize:"0.72rem", fontWeight:700, color:"#c0392b", letterSpacing:"0.08em", textTransform:"uppercase" }}>
                    Duplicate Certificate Numbers Detected
                  </p>
                  <p style={{ fontSize:"0.8rem", color:"#7f1d1d", marginTop:"2px" }}>
                    {duplicateCertCount} certificate number{duplicateCertCount !== 1 ? "s are" : " is"} shared across multiple records — review required.
                  </p>
                </div>
              </div>
              <span style={{ fontFamily:"'Cinzel',serif", fontSize:"0.65rem", color:"#c0392b", letterSpacing:"0.1em", textTransform:"uppercase", whiteSpace:"nowrap" }}>
                View in Notifications →
              </span>
            </div>
          </Link>
        )}

        {/* ── Ready to Register banner ── */}
        {readyToRegCount > 0 && (
          <Link to="/notifications" state={{ tab:"monthly", section:"ready" }} style={{ textDecoration:"none" }}>
            <div style={{ background:"#f0faf4", border:"1px solid #a7d7b8", borderLeft:"4px solid #1a5c35", borderRadius:"4px", padding:"0.75rem 1.25rem", marginBottom:"1rem", display:"flex", justifyContent:"space-between", alignItems:"center", cursor:"pointer" }}
              onMouseEnter={e => e.currentTarget.style.background="#dcf5e7"}
              onMouseLeave={e => e.currentTarget.style.background="#f0faf4"}>
              <div style={{ display:"flex", alignItems:"center", gap:"0.75rem" }}>
                <span style={{ fontSize:"1.1rem" }}>✅</span>
                <div>
                  <p style={{ fontFamily:"'Cinzel',serif", fontSize:"0.72rem", fontWeight:700, color:"#1a5c35", letterSpacing:"0.08em", textTransform:"uppercase" }}>
                    Ready to Register
                  </p>
                  <p style={{ fontSize:"0.8rem", color:"#1e3a24", marginTop:"2px" }}>
                    {readyToRegCount} title{readyToRegCount !== 1 ? "s" : ""} {readyToRegCount !== 1 ? "have" : "has"} completed the 4-month Savali period and {readyToRegCount !== 1 ? "are" : "is"} awaiting registration confirmation.
                  </p>
                </div>
              </div>
              <span style={{ fontFamily:"'Cinzel',serif", fontSize:"0.65rem", color:"#1a5c35", letterSpacing:"0.1em", textTransform:"uppercase", whiteSpace:"nowrap" }}>
                Confirm Now →
              </span>
            </div>
          </Link>
        )}

        {/* ── Incomplete records warning (missing date of birth) ── */}
        {incompleteDobCount > 0 && (
          <Link to="/notifications" state={{ tab:"incomplete" }} style={{ textDecoration:"none" }}>
            <div style={{ background:"#faf5ff", border:"1px solid #c4b5fd", borderLeft:"4px solid #7c3aed", borderRadius:"4px", padding:"0.75rem 1.25rem", marginBottom:"1rem", display:"flex", justifyContent:"space-between", alignItems:"center", cursor:"pointer" }}
              onMouseEnter={e => e.currentTarget.style.background="#f3e8ff"}
              onMouseLeave={e => e.currentTarget.style.background="#faf5ff"}>
              <div style={{ display:"flex", alignItems:"center", gap:"0.75rem" }}>
                <span style={{ fontSize:"1.1rem" }}>📋</span>
                <div>
                  <p style={{ fontFamily:"'Cinzel',serif", fontSize:"0.72rem", fontWeight:700, color:"#7c3aed", letterSpacing:"0.08em", textTransform:"uppercase" }}>
                    Incomplete Records — Missing Date of Birth
                  </p>
                  <p style={{ fontSize:"0.8rem", color:"#4c1d95", marginTop:"2px" }}>
                    {incompleteDobCount} record{incompleteDobCount !== 1 ? "s are" : " is"} missing a date of birth — please complete before registration can proceed.
                  </p>
                </div>
              </div>
              <span style={{ fontFamily:"'Cinzel',serif", fontSize:"0.65rem", color:"#7c3aed", letterSpacing:"0.1em", textTransform:"uppercase", whiteSpace:"nowrap" }}>
                View in Notifications →
              </span>
            </div>
          </Link>
        )}

        {/* ── Filter bar ── */}
        <div style={{ background:"#fff", border:"1px solid #d1d5db", borderRadius:"6px", padding:"1rem 1.25rem", marginBottom:"1rem", boxShadow:"0 1px 3px rgba(0,0,0,0.05)" }}>
          <div style={{ display:"grid", gridTemplateColumns:"2fr 1fr 1fr 1fr", gap:"0.75rem", marginBottom:"0.75rem" }}>
            <div className="form-group" style={{ margin:0 }}>
              <label>Search</label>
              <input type="text" placeholder="Title, name, village, cert no…"
                value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <div className="form-group" style={{ margin:0 }}>
              <label>District</label>
              <select value={filterDistrict} onChange={e => setFilterDistrict(e.target.value)}>
                {districts.map(d => <option key={d}>{d}</option>)}
              </select>
            </div>
            <div className="form-group" style={{ margin:0 }}>
              <label>Village</label>
              <select value={filterVillage} onChange={e => setFilterVillage(e.target.value)}>
                {villages.map(v => <option key={v}>{v}</option>)}
              </select>
            </div>
            <div className="form-group" style={{ margin:0 }}>
              <label>Title Type</label>
              <select value={filterType} onChange={e => setFilterType(e.target.value)}>
                {types.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr 1fr auto", gap:"0.75rem", alignItems:"flex-end" }}>
            <div className="form-group" style={{ margin:0 }}>
              <label>Gender</label>
              <select value={filterGender} onChange={e => setFilterGender(e.target.value)}>
                {genders.map(g => <option key={g}>{g}</option>)}
              </select>
            </div>
            <div className="form-group" style={{ margin:0 }}>
              <label>Status</label>
              <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                <option value="All">All</option>
                <option value="completed">Completed (Printed)</option>
                <option value="pending">Pending (Not Printed)</option>
              </select>
            </div>
            <div className="form-group" style={{ margin:0 }}>
              <label>Date Registered From</label>
              <input type="date" value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)} />
            </div>
            <div className="form-group" style={{ margin:0 }}>
              <label>Date Registered To</label>
              <input type="date" value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)} />
            </div>
            {hasActiveFilters && (
              <button onClick={clearAllFilters} style={{ background:"transparent", border:"1px solid rgba(139,26,26,0.3)", color:"#8b1a1a", padding:"0.5rem 0.9rem", fontFamily:"'Cinzel',serif", fontSize:"0.65rem", letterSpacing:"0.08em", textTransform:"uppercase", borderRadius:"4px", cursor:"pointer", whiteSpace:"nowrap", height:"38px" }}>
                ✕ Clear
              </button>
            )}
          </div>
        </div>

        {/* ── Results count ── */}
        <p style={{ fontFamily:"'Cinzel',serif", fontSize:"0.68rem", color:"#6b7280", letterSpacing:"0.1em", marginBottom:"0.85rem" }}>
          Showing <strong style={{ color:"#155c31" }}>{filtered.length === 0 ? 0 : `${(safePage-1)*PAGE_SIZE+1}–${Math.min(safePage*PAGE_SIZE, filtered.length)}`}</strong> of <strong>{records.length}</strong> records
        </p>

        {/* ── Table ── */}
        <div style={{ background:"#fff", border:"1px solid #d1d5db", borderRadius:"6px", boxShadow:"0 1px 3px rgba(0,0,0,0.08)", overflow:"hidden" }}>
          {loading ? (
            <div style={{ textAlign:"center", padding:"5rem", color:"#6b7280", fontStyle:"italic" }}>Loading registry…</div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign:"center", padding:"5rem" }}>
              <p style={{ color:"#9ca3af", fontStyle:"italic" }}>
                {records.length === 0 ? "No titles registered yet." : "No titles match your search."}
              </p>
            </div>
          ) : (
            <div style={{ overflowX:"auto" }}>
              <table className="data-table">
                <thead>
                  <tr>
                    {["Cert No.", "Matai Title", "Suafa Taulealea", "Type", "Nu'u", "Itūmālō", "Aso Resitala", "Actions"].map(h => (
                      <th key={h}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pageRecords.map(r => (
                    <tr key={r.id}>
                      <td style={{ fontFamily:"'Cinzel',serif", fontSize:"0.75rem", color:"#6b7280", whiteSpace:"nowrap" }}>
                        {r.certItumalo && r.certLaupepa && r.certRegBook
                          ? `${r.certItumalo}/${r.certLaupepa}/${r.certRegBook}`
                          : r.mataiCertNumber || r.refNumber || "—"
                        }
                      </td>
                      <td style={{ fontFamily:"'Cinzel',serif", color:"#155c31", fontWeight:700, fontSize:"0.92rem" }}>
                        <div style={{ display:"flex", alignItems:"center", gap:"0.4rem" }}>
                          {r.mataiTitle}
                        </div>
                      </td>
                      <td style={{ color:"#111827", fontWeight:500 }}>{r.holderName}</td>
                      <td>
                        <span className="type-badge">{r.mataiType || "—"}</span>
                      </td>
                      <td style={{ color:"#374151" }}>{r.village || "—"}</td>
                      <td style={{ color:"#374151", fontSize:"0.85rem" }}>{r.district || "—"}</td>
                      <td style={{ color:"#6b7280", fontSize:"0.83rem", whiteSpace:"nowrap" }}>
                        {(() => {
                          const d = effectiveRegDate(r);
                          return d
                            ? <span style={{ color: r.dateRegistration ? "#374151" : "#b45309", fontStyle: r.dateRegistration ? "normal" : "italic", background: r.dateRegistration ? "none" : "#fef3c7", padding: r.dateRegistration ? "0" : "1px 5px", borderRadius:"3px" }}>{fmtDate(d)}{!r.dateRegistration && " ⚠"}</span>
                            : <span style={{ color:"#9ca3af" }}>—</span>;
                        })()}
                      </td>
                      <td>
                        <div style={{ display:"flex", gap:"0.3rem" }}>
                          {(() => {
                            const regPassed = r.dateRegistration && new Date(r.dateRegistration + "T00:00:00") <= new Date();
                            return perms.canPrint && regPassed ? (
                              <Link to={`/certificate/${r.id}`}>
                                <button className="btn-ghost" title="View Certificate"
                                  onClick={() => logAudit("PRINT", { mataiTitle: r.mataiTitle, recordId: r.id })}>
                                  🏅
                                </button>
                              </Link>
                            ) : perms.canPrint ? (
                              <button className="btn-ghost" title="Certificate unavailable — awaiting registration" disabled
                                style={{ opacity:0.35, cursor:"not-allowed" }}>
                                🏅
                              </button>
                            ) : null;
                          })()}
                          {perms.canEdit && (
                            <Link to={`/register/${r.id}`} state={{ recordIds: filtered.map(x => x.id) }}>
                              <button className="btn-ghost" title="Edit">✎</button>
                            </Link>
                          )}
                          {!perms.canEdit && (
                            <Link to={`/register/${r.id}`} state={{ recordIds: filtered.map(x => x.id) }}>
                              <button className="btn-ghost" title="View">👁</button>
                            </Link>
                          )}
                          {perms.canDelete && (
                            <button className="btn-ghost" title="Delete"
                              onClick={() => handleDelete(r.id, r.mataiTitle)}
                              disabled={deleting === r.id}
                              style={{ color:"#991b1b", borderColor:"rgba(153,27,27,0.3)" }}>
                              ✕
                            </button>
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
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginTop:"1rem", padding:"0.5rem 0" }}>
            <p style={{ fontFamily:"'Cinzel',serif", fontSize:"0.65rem", color:"#6b7280", letterSpacing:"0.08em" }}>
              Page {safePage} of {totalPages}
            </p>
            <div style={{ display:"flex", gap:"0.3rem" }}>
              <button onClick={() => setPage(1)} disabled={safePage === 1} style={pgBtn(safePage === 1)}>«</button>
              <button onClick={() => setPage(p => Math.max(1, p-1))} disabled={safePage === 1} style={pgBtn(safePage === 1)}>‹ Prev</button>
              {Array.from({ length: totalPages }, (_, i) => i+1)
                .filter(p => p === 1 || p === totalPages || Math.abs(p - safePage) <= 2)
                .reduce((acc, p, i, arr) => {
                  if (i > 0 && p - arr[i-1] > 1) acc.push("...");
                  acc.push(p);
                  return acc;
                }, [])
                .map((p, i) => p === "..." ? (
                  <span key={`ellipsis-${i}`} style={{ padding:"0.35rem 0.5rem", color:"#9ca3af", fontSize:"0.8rem" }}>…</span>
                ) : (
                  <button key={p} onClick={() => setPage(p)} style={pgBtn(false, p === safePage)}>{p}</button>
                ))
              }
              <button onClick={() => setPage(p => Math.min(totalPages, p+1))} disabled={safePage === totalPages} style={pgBtn(safePage === totalPages)}>Next ›</button>
              <button onClick={() => setPage(totalPages)} disabled={safePage === totalPages} style={pgBtn(safePage === totalPages)}>»</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

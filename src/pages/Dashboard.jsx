import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { collection, getDocs, deleteDoc, doc } from "firebase/firestore";
import { auth, db } from "../firebase";
import { getPermissions } from "../utils/roles";
import { logAudit } from "../utils/audit";
import Sidebar from "../components/Sidebar";
import { cacheClear } from "../utils/cache";
import { seedTestData } from "../utils/seedData";

const fmtDate = (str) => {
  if (!str) return "—";
  // Parse YYYY-MM-DD directly to avoid timezone shifting
  const parts = String(str).split("T")[0].split("-");
  if (parts.length === 3 && parts[0].length === 4) {
    return `${parts[2].padStart(2,"0")}/${parts[1].padStart(2,"0")}/${parts[0]}`;
  }
  // Fallback for any other format
  const d = new Date(str);
  if (isNaN(d)) return "—";
  return `${String(d.getDate()).padStart(2,"0")}/${String(d.getMonth()+1).padStart(2,"0")}/${d.getFullYear()}`;
};

export default function Dashboard({ userRole }) {
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
  const perms = getPermissions(userRole);
  const user  = auth.currentUser;

  const fetchRecords = async () => {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, "registrations"));
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
      setRecords(list);
    } catch (err) {
      console.error("Dashboard fetch error:", err);
      alert("Failed to load records: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchRecords(true); }, []);

  const handleDelete = async (id, title) => {
    if (!window.confirm("Remove this registration permanently?")) return;
    setDeleting(id);
    await deleteDoc(doc(db, "registrations", id));
    await logAudit("DELETE", { mataiTitle: title, recordId: id });
    cacheClear("registrations");
    setRecords(prev => prev.filter(r => r.id !== id));
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
  const clearAllFilters = () => { setSearch(""); setFilterDistrict("All"); setFilterType("All"); setFilterVillage("All"); setFilterGender("All"); setFilterStatus("All"); setFilterDateFrom(""); setFilterDateTo(""); };

  const normalizeType = (t) => (t || "").trim().toLowerCase();
  const totalAli      = records.filter(r => normalizeType(r.mataiType) === "ali'i" || normalizeType(r.mataiType) === "alii").length;
  const totalTulafale = records.filter(r => normalizeType(r.mataiType) === "tulafale").length;
  const totalOther    = records.filter(r => {
    const t = normalizeType(r.mataiType);
    return t && t !== "ali'i" && t !== "alii" && t !== "tulafale" && t !== "faipule";
  }).length;

  const handleSeed = async () => {
    if (!window.confirm("This will clear all existing records and load 15 test records. Continue?")) return;
    setSeeding(true); setSeedMsg("");
    const result = await seedTestData((done, total, title) => setSeedMsg(`Importing ${done}/${total}: ${title}…`));
    cacheClear("registrations");
    if (result.success) {
      setSeedMsg(`✓ ${result.message} Reloading…`);
    } else {
      setSeedMsg(`✗ ${result.message}`);
    }
    setSeeding(false);
    setTimeout(() => window.location.reload(), 1500);
  };

  return (
    <div className="app-layout">
      <div className="pattern-bg" />
      <Sidebar userRole={userRole} userEmail={user?.email} />

      <div className="sidebar-content">
        {/* ── Header ── */}
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:"2rem" }}>
          <div>
            <p className="page-eyebrow">Official Record</p>
            <h1 className="page-title">Title Registry</h1>
          </div>
          <div style={{ display:"flex", gap:"0.75rem", alignItems:"center" }}>

            {perms.canAdd && (
              <Link to="/register">
                <button className="btn-primary">＋ Register Title</button>
                {getPermissions(userRole).canDelete && (
                  <button onClick={handleSeed} disabled={seeding}
                    style={{ background:"#4a1d96", color:"white", border:"none", padding:"0.5rem 1rem", borderRadius:"4px", fontFamily:"'Cinzel',serif", fontSize:"0.72rem", letterSpacing:"0.08em", cursor:"pointer", opacity: seeding ? 0.6 : 1 }}>
                    {seeding ? "Adding…" : "🧪 Add Test Data"}
                  </button>
                )}
                {seedMsg && <span style={{ fontSize:"0.78rem", color:"#4a1d96", fontStyle:"italic" }}>{seedMsg}</span>}
              </Link>
            )}
          </div>
        </div>

        {/* ── Stats ── */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:"1rem", marginBottom:"2rem" }}>
          {[
            { label:"Total Registered", value: records.length,  accent:"#155c31" },
            { label:"Ali'i",            value: totalAli,         accent:"#1e7a42" },
            { label:"Tulafale",         value: totalTulafale,    accent:"#0d2818" },
          ].map(s => (
            <div key={s.label} className="stat-card">
              <p style={{ fontFamily:"'Cinzel',serif", fontSize:"0.65rem", letterSpacing:"0.18em", color:"#6b7280", textTransform:"uppercase", marginBottom:"0.5rem" }}>{s.label}</p>
              <p style={{ fontFamily:"'Cinzel Decorative',serif", fontSize:"2rem", color: s.accent, lineHeight:1 }}>{s.value}</p>
            </div>
          ))}
        </div>

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
          Showing <strong style={{ color:"#155c31" }}>{filtered.length}</strong> of <strong>{records.length}</strong> records
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
                  {filtered.map(r => (
                    <tr key={r.id}>
                      <td style={{ fontFamily:"'Cinzel',serif", fontSize:"0.75rem", color:"#6b7280", whiteSpace:"nowrap" }}>
                        {/* Show combined cert number: Itumalo/Laupepa/RegBook */}
                        {r.certItumalo && r.certLaupepa && r.certRegBook
                          ? `${r.certItumalo}/${r.certLaupepa}/${r.certRegBook}`
                          : r.mataiCertNumber || r.refNumber || "—"
                        }
                      </td>
                      <td style={{ fontFamily:"'Cinzel',serif", color:"#155c31", fontWeight:700, fontSize:"0.92rem" }}>
                        <div style={{ display:"flex", alignItems:"center", gap:"0.4rem" }}>
                          {r.mataiTitle}
                          {r.status === "completed" && (
                            <span title={`Printed ${r.printedAt || ""}`} style={{ fontSize:"0.6rem", background:"#dcfce7", color:"#166534", border:"1px solid #86efac", borderRadius:"2px", padding:"1px 5px", fontFamily:"'Cinzel',serif", letterSpacing:"0.05em", whiteSpace:"nowrap" }}>
                              ✓ PRINTED
                            </span>
                          )}
                        </div>
                      </td>
                      <td style={{ color:"#111827", fontWeight:500 }}>{r.holderName}</td>
                      <td>
                        <span className="type-badge">{r.mataiType || "—"}</span>
                      </td>
                      <td style={{ color:"#374151" }}>{r.village || "—"}</td>
                      <td style={{ color:"#374151", fontSize:"0.85rem" }}>{r.district || "—"}</td>
                      <td style={{ color:"#6b7280", fontSize:"0.83rem", whiteSpace:"nowrap" }}>
                        {fmtDate(r.dateRegistration)}
                      </td>
                      <td>
                        <div style={{ display:"flex", gap:"0.3rem" }}>
                          {perms.canPrint && (
                            <Link to={`/certificate/${r.id}`}>
                              <button className="btn-ghost" title="View Certificate"
                                onClick={() => logAudit("PRINT", { mataiTitle: r.mataiTitle, recordId: r.id })}>
                                🏅
                              </button>
                            </Link>
                          )}
                          {perms.canEdit && (
                            <Link to={`/register/${r.id}`}>
                              <button className="btn-ghost" title="Edit">✎</button>
                            </Link>
                          )}
                          {!perms.canEdit && (
                            <Link to={`/certificate/${r.id}`}>
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
      </div>
    </div>
  );
}

import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { collection, getDocs, deleteDoc, doc, orderBy, query } from "firebase/firestore";
import { auth, db } from "../firebase";
import { getPermissions } from "../utils/roles";
import { logAudit } from "../utils/audit";
import Sidebar from "../components/Sidebar";

const fmtDate = (str) => {
  if (!str) return "—";
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
  const [deleting, setDeleting]     = useState(null);
  const perms = getPermissions(userRole);
  const user  = auth.currentUser;

  const fetchRecords = async () => {
    try {
      const q = query(collection(db, "registrations"), orderBy("createdAt", "desc"));
      const snap = await getDocs(q);
      setRecords(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchRecords(); }, []);

  const handleDelete = async (id, title) => {
    if (!window.confirm("Remove this registration permanently?")) return;
    setDeleting(id);
    await deleteDoc(doc(db, "registrations", id));
    await logAudit("DELETE", { mataiTitle: title, recordId: id });
    setRecords(prev => prev.filter(r => r.id !== id));
    setDeleting(null);
  };

  const districts = ["All", ...new Set(records.map(r => r.district).filter(Boolean))].sort();
  const types = ["All", "Ali'i", "Faipule", "Tulafale"];

  const filtered = records.filter(r => {
    const s = search.toLowerCase();
    const matchSearch = !search ||
      r.mataiTitle?.toLowerCase().includes(s) ||
      r.holderName?.toLowerCase().includes(s) ||
      r.village?.toLowerCase().includes(s);
    const matchDistrict = filterDistrict === "All" || r.district === filterDistrict;
    const matchType = filterType === "All" || r.mataiType === filterType;
    return matchSearch && matchDistrict && matchType;
  });

  const totalAli      = records.filter(r => r.mataiType === "Ali'i").length;
  const totalFaipule  = records.filter(r => r.mataiType === "Faipule").length;
  const totalTulafale = records.filter(r => r.mataiType === "Tulafale").length;

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
          {perms.canAdd && (
            <Link to="/register">
              <button className="btn-primary">＋ Register Title</button>
            </Link>
          )}
        </div>

        {/* ── Stats ── */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:"1rem", marginBottom:"2rem" }}>
          {[
            { label:"Total Registered", value: records.length, accent:"#155c31" },
            { label:"Ali'i",            value: totalAli,        accent:"#1e7a42" },
            { label:"Faipule",          value: totalFaipule,    accent:"#155c31" },
            { label:"Tulafale",         value: totalTulafale,   accent:"#0d2818" },
          ].map(s => (
            <div key={s.label} className="stat-card">
              <p style={{ fontFamily:"'Cinzel',serif", fontSize:"0.65rem", letterSpacing:"0.18em", color:"#6b7280", textTransform:"uppercase", marginBottom:"0.5rem" }}>{s.label}</p>
              <p style={{ fontFamily:"'Cinzel Decorative',serif", fontSize:"2rem", color: s.accent, lineHeight:1 }}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* ── Filter bar ── */}
        <div className="filter-bar" style={{ display:"grid", gridTemplateColumns:"1fr 220px 160px", gap:"1rem", alignItems:"end" }}>
          <div className="form-group">
            <label>Search</label>
            <input type="text" placeholder="Search by title, name or village…"
              value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div className="form-group">
            <label>District (Itūmālō)</label>
            <select value={filterDistrict} onChange={e => setFilterDistrict(e.target.value)}>
              {districts.map(d => <option key={d}>{d}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Type</label>
            <select value={filterType} onChange={e => setFilterType(e.target.value)}>
              {types.map(t => <option key={t}>{t}</option>)}
            </select>
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
                    {["Ref No.", "Matai Title", "Suafa Taulealea", "Type", "Nu'u", "Itūmālō", "Aso Resitala", "Actions"].map(h => (
                      <th key={h}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(r => (
                    <tr key={r.id}>
                      <td style={{ fontFamily:"'Cinzel',serif", fontSize:"0.75rem", color:"#6b7280" }}>
                        {r.refNumber || "—"}
                      </td>
                      <td style={{ fontFamily:"'Cinzel',serif", color:"#155c31", fontWeight:700, fontSize:"0.92rem" }}>
                        {r.mataiTitle}
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

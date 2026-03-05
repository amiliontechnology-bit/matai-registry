import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { collection, getDocs, deleteDoc, doc, orderBy, query } from "firebase/firestore";
import { auth, db } from "../firebase";
import { getPermissions } from "../utils/roles";
import { logAudit } from "../utils/audit";
import Sidebar from "../components/Sidebar";

export default function Dashboard({ userRole }) {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterDistrict, setFilterDistrict] = useState("All");
  const [filterType, setFilterType] = useState("All");
  const [deleting, setDeleting] = useState(null);
  const perms = getPermissions(userRole);
  const user = auth.currentUser;

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

  // Stats
  const totalAli = records.filter(r => r.mataiType === "Ali'i").length;
  const totalFaipule = records.filter(r => r.mataiType === "Faipule").length;
  const totalTulafale = records.filter(r => r.mataiType === "Tulafale").length;

  const statCard = (label, value, color) => (
    <div style={{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(201,168,76,0.2)", borderRadius:"4px", padding:"1.2rem 1.5rem" }}>
      <p style={{ fontFamily:"'Cinzel',serif", fontSize:"0.65rem", letterSpacing:"0.2em", color:"rgba(201,168,76,0.6)", textTransform:"uppercase", marginBottom:"0.4rem" }}>{label}</p>
      <p style={{ fontFamily:"'Cinzel Decorative',serif", fontSize:"1.8rem", color: color || "#c9a84c" }}>{value}</p>
    </div>
  );

  return (
    <div style={{ display:"flex", minHeight:"100vh", background:"#0a0a0a", color:"#f5ede0", overflow:"hidden" }}>
      <div className="pattern-bg" style={{ position:"fixed" }} />
      <Sidebar userRole={userRole} userEmail={user?.email} />

      <main style={{ flex:1, padding:"2rem", overflowX:"auto", overflowY:"auto", position:"relative", zIndex:1, minWidth:0 }}>
        {/* Header */}
        <div style={{ marginBottom:"2rem" }}>
          <p style={{ fontFamily:"'Cinzel',serif", fontSize:"0.7rem", letterSpacing:"0.25em", color:"rgba(201,168,76,0.6)", textTransform:"uppercase", marginBottom:"0.4rem" }}>
            Official Record
          </p>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-end" }}>
            <h1 style={{ fontFamily:"'Cinzel Decorative',serif", fontSize:"1.8rem", color:"#f5ede0" }}>
              Title Registry
            </h1>
            {perms.canAdd && (
              <Link to="/register">
                <button className="btn-primary" style={{ fontSize:"0.78rem" }}>＋ Register Title</button>
              </Link>
            )}
          </div>
        </div>

        {/* Stats */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(150px, 1fr))", gap:"1rem", marginBottom:"2rem" }}>
          {statCard("Total Registered", records.length, "#c9a84c")}
          {statCard("Ali'i", totalAli, "#e8c96a")}
          {statCard("Faipule", totalFaipule, "#c9a84c")}
          {statCard("Tulafale", totalTulafale, "#a07828")}
        </div>

        {/* Filters */}
        <div style={{ display:"grid", gridTemplateColumns:"1fr auto auto", gap:"1rem", marginBottom:"1.5rem", alignItems:"end", flexWrap:"wrap" }}>
          <div className="form-group">
            <label>Search</label>
            <input type="text" placeholder="Search by title, name or village…" value={search} onChange={e => setSearch(e.target.value)} />
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

        {/* Results count */}
        <p style={{ fontFamily:"'Cinzel',serif", fontSize:"0.68rem", color:"rgba(201,168,76,0.5)", letterSpacing:"0.1em", marginBottom:"1rem" }}>
          Showing {filtered.length} of {records.length} records
        </p>

        {/* Table */}
        {loading ? (
          <div style={{ textAlign:"center", padding:"5rem", color:"rgba(201,168,76,0.5)", fontStyle:"italic" }}>Loading registry…</div>
        ) : filtered.length === 0 ? (
          <div style={{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(201,168,76,0.2)", borderRadius:"4px", textAlign:"center", padding:"5rem" }}>
            <p style={{ color:"rgba(245,237,224,0.3)", fontStyle:"italic" }}>
              {records.length === 0 ? "No titles registered yet." : "No titles match your search."}
            </p>
          </div>
        ) : (
          <div style={{ overflowX:"auto", background:"rgba(255,255,255,0.02)", border:"1px solid rgba(201,168,76,0.15)", borderRadius:"4px" }}>
            <table style={{ width:"100%", borderCollapse:"collapse" }}>
              <thead>
                <tr style={{ borderBottom:"1px solid rgba(201,168,76,0.2)", background:"rgba(201,168,76,0.05)" }}>
                  {["Ref No.", "Matai Title", "Suafa Taulealea", "Type", "Nu'u", "Itūmālō", "Aso Resitala", "Actions"].map(h => (
                    <th key={h} style={{ textAlign:"left", padding:"0.85rem 1rem", fontFamily:"'Cinzel',serif", fontSize:"0.62rem", letterSpacing:"0.15em", textTransform:"uppercase", color:"rgba(201,168,76,0.7)", whiteSpace:"nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((r, i) => (
                  <tr key={r.id} style={{ borderBottom:"1px solid rgba(201,168,76,0.08)", transition:"background 0.15s" }}
                    onMouseEnter={e => e.currentTarget.style.background = "rgba(201,168,76,0.04)"}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                    <td style={{ padding:"0.9rem 1rem", fontFamily:"'Cinzel',serif", fontSize:"0.75rem", color:"rgba(201,168,76,0.5)" }}>
                      {r.refNumber || "—"}
                    </td>
                    <td style={{ padding:"0.9rem 1rem", fontFamily:"'Cinzel',serif", color:"#c9a84c", fontSize:"0.9rem", fontWeight:600 }}>
                      {r.mataiTitle}
                    </td>
                    <td style={{ padding:"0.9rem 1rem", fontWeight:500 }}>{r.holderName}</td>
                    <td style={{ padding:"0.9rem 1rem" }}>
                      <span style={{ background:"rgba(201,168,76,0.1)", border:"1px solid rgba(201,168,76,0.25)", color:"#e8c96a", padding:"2px 8px", borderRadius:"2px", fontSize:"0.72rem", fontFamily:"'Cinzel',serif", whiteSpace:"nowrap" }}>
                        {r.mataiType || "—"}
                      </span>
                    </td>
                    <td style={{ padding:"0.9rem 1rem", opacity:0.75, fontSize:"0.88rem" }}>{r.village || "—"}</td>
                    <td style={{ padding:"0.9rem 1rem", opacity:0.75, fontSize:"0.88rem" }}>{r.district || "—"}</td>
                    <td style={{ padding:"0.9rem 1rem", opacity:0.6, fontSize:"0.82rem", whiteSpace:"nowrap" }}>
                      {r.dateRegistration ? new Date(r.dateRegistration).toLocaleDateString("en-NZ", { day:"numeric", month:"short", year:"numeric" }) : "—"}
                    </td>
                    <td style={{ padding:"0.9rem 1rem" }}>
                      <div style={{ display:"flex", gap:"0.4rem" }}>
                        {perms.canPrint && (
                          <Link to={`/certificate/${r.id}`}>
                            <button className="btn-ghost" title="View Certificate" onClick={() => logAudit("PRINT", { mataiTitle: r.mataiTitle, recordId: r.id })}>🏅</button>
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
                          <button className="btn-ghost" title="Delete" onClick={() => handleDelete(r.id, r.mataiTitle)} disabled={deleting === r.id} style={{ color:"#f5a0a0" }}>✕</button>
                        )}
                      </div>
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

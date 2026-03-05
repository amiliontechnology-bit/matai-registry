import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { signOut } from "firebase/auth";
import { collection, getDocs, deleteDoc, doc, orderBy, query } from "firebase/firestore";
import { auth, db } from "../firebase";

const VILLAGE_DISTRICTS = [
  "All Districts", "Aana", "Aiga-i-le-Tai", "Atua", "Faasaleleaga",
  "Gaga'emauga", "Gaga'ifomauga", "Palauli", "Satupa'itea",
  "Tuamasaga", "Va'a-o-Fonoti", "Vaisigano"
];

const MATAI_TYPES = ["Ali'i", "Faipule", "Tulafale"];

export default function Dashboard() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterDistrict, setFilterDistrict] = useState("All Districts");
  const [filterType, setFilterType] = useState("All");
  const [deleting, setDeleting] = useState(null);

  const fetchRecords = async () => {
    try {
      const q = query(collection(db, "registrations"), orderBy("createdAt", "desc"));
      const snap = await getDocs(q);
      setRecords(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchRecords(); }, []);

  const handleDelete = async (id) => {
    if (!window.confirm("Remove this registration permanently?")) return;
    setDeleting(id);
    await deleteDoc(doc(db, "registrations", id));
    setRecords(prev => prev.filter(r => r.id !== id));
    setDeleting(null);
  };

  const filtered = records.filter(r => {
    const matchSearch = !search ||
      r.mataiTitle?.toLowerCase().includes(search.toLowerCase()) ||
      r.holderName?.toLowerCase().includes(search.toLowerCase());
    const matchDistrict = filterDistrict === "All Districts" || r.district === filterDistrict;
    const matchType = filterType === "All" || r.mataiType === filterType;
    return matchSearch && matchDistrict && matchType;
  });

  return (
    <div className="page">
      <div className="pattern-bg" />
      <nav>
        <Link to="/dashboard" className="nav-brand">⬡ Matai Registry</Link>
        <div className="nav-links">
          <Link to="/register" className="nav-link">+ Register Title</Link>
          <button className="btn-logout" onClick={() => signOut(auth)}>Sign Out</button>
        </div>
      </nav>

      <main style={{ flex: 1, padding: "3rem 2.5rem", maxWidth: 1200, margin: "0 auto", width: "100%", position: "relative" }}>
        {/* Header */}
        <div className="fade-in" style={{ marginBottom: "3rem" }}>
          <p style={{ fontFamily: "'Cinzel', serif", fontSize: "0.72rem", letterSpacing: "0.25em", color: "var(--gold)", opacity: 0.7, textTransform: "uppercase", marginBottom: "0.5rem" }}>
            Official Record
          </p>
          <h2 style={{ fontFamily: "'Cinzel Decorative', serif", fontSize: "2rem", color: "var(--cream)", marginBottom: "0.5rem" }}>
            Title Registry
          </h2>
          <p style={{ color: "rgba(245,237,224,0.5)", fontStyle: "italic" }}>
            {records.length} registered Matai title{records.length !== 1 ? "s" : ""}
          </p>
        </div>

        {/* Filters */}
        <div className="fade-in-delay-1" style={{ display: "grid", gridTemplateColumns: "1fr auto auto", gap: "1rem", marginBottom: "2rem", alignItems: "end" }}>
          <div className="form-group">
            <label>Search</label>
            <input
              type="text" placeholder="Search by title or name…"
              value={search} onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label>District</label>
            <select value={filterDistrict} onChange={e => setFilterDistrict(e.target.value)}>
              {VILLAGE_DISTRICTS.map(d => <option key={d}>{d}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Type</label>
            <select value={filterType} onChange={e => setFilterType(e.target.value)}>
              {["All", ...MATAI_TYPES].map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <div style={{ textAlign: "center", padding: "5rem", color: "var(--gold)", fontStyle: "italic", opacity: 0.7 }}>
            Loading registry…
          </div>
        ) : filtered.length === 0 ? (
          <div className="card fade-in" style={{ textAlign: "center", padding: "5rem" }}>
            <p style={{ color: "rgba(245,237,224,0.4)", fontStyle: "italic", marginBottom: "1.5rem" }}>
              {records.length === 0 ? "No titles registered yet." : "No titles match your search."}
            </p>
            {records.length === 0 && (
              <Link to="/register"><button className="btn-primary">Register First Title</button></Link>
            )}
          </div>
        ) : (
          <div className="fade-in-delay-2" style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)" }}>
                  {["Matai Title", "Title Holder", "Type", "Village", "District", "Date Conferred", "Actions"].map(h => (
                    <th key={h} style={{
                      textAlign: "left", padding: "0.75rem 1rem",
                      fontFamily: "'Cinzel', serif", fontSize: "0.68rem",
                      letterSpacing: "0.15em", textTransform: "uppercase",
                      color: "var(--gold)", opacity: 0.8, whiteSpace: "nowrap"
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((r, i) => (
                  <tr key={r.id} style={{
                    borderBottom: "1px solid rgba(201,168,76,0.1)",
                    animation: `fadeIn 0.4s ${i * 0.04}s ease both`
                  }}>
                    <td style={{ padding: "1rem", fontFamily: "'Cinzel', serif", color: "var(--gold)", fontSize: "0.95rem" }}>
                      {r.mataiTitle}
                    </td>
                    <td style={{ padding: "1rem", fontWeight: 500 }}>{r.holderName}</td>
                    <td style={{ padding: "1rem" }}>
                      <span style={{
                        background: "rgba(201,168,76,0.12)", border: "1px solid rgba(201,168,76,0.3)",
                        color: "var(--gold-light)", padding: "0.2rem 0.6rem",
                        borderRadius: "2px", fontSize: "0.78rem", fontFamily: "'Cinzel', serif"
                      }}>{r.mataiType}</span>
                    </td>
                    <td style={{ padding: "1rem", opacity: 0.8 }}>{r.village}</td>
                    <td style={{ padding: "1rem", opacity: 0.8 }}>{r.district}</td>
                    <td style={{ padding: "1rem", opacity: 0.7, fontSize: "0.88rem" }}>
                      {r.dateConferred ? new Date(r.dateConferred).toLocaleDateString("en-NZ", { day: "numeric", month: "long", year: "numeric" }) : "—"}
                    </td>
                    <td style={{ padding: "1rem" }}>
                      <div style={{ display: "flex", gap: "0.5rem" }}>
                        <Link to={`/certificate/${r.id}`}>
                          <button className="btn-ghost" title="Print Certificate">🏅</button>
                        </Link>
                        <Link to={`/register/${r.id}`}>
                          <button className="btn-ghost" title="Edit">✎</button>
                        </Link>
                        <button
                          className="btn-ghost" title="Delete"
                          onClick={() => handleDelete(r.id)}
                          disabled={deleting === r.id}
                          style={{ color: "#f5a0a0" }}
                        >✕</button>
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

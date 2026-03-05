import { useState, useEffect } from "react";
import { collection, getDocs, orderBy, query } from "firebase/firestore";
import { auth, db } from "../firebase";
import { logAudit } from "../utils/audit";
import { getPermissions } from "../utils/roles";
import Sidebar from "../components/Sidebar";

const ALL_FIELDS = [
  { key:"refNumber",        label:"Reference Number" },
  { key:"mataiTitle",       label:"Matai Title" },
  { key:"holderName",       label:"Holder Name" },
  { key:"gender",           label:"Gender" },
  { key:"mataiType",        label:"Title Type" },
  { key:"familyName",       label:"Family Name" },
  { key:"village",          label:"Village" },
  { key:"district",         label:"District" },
  { key:"dateConferred",    label:"Date Conferred" },
  { key:"dateProclamation", label:"Date Proclamation" },
  { key:"dateRegistration", label:"Date Registration" },
  { key:"dateIssued",       label:"Date Issued" },
  { key:"registrarName",    label:"Registrar Name" },
  { key:"notes",            label:"Notes" },
];

export default function Export({ userRole }) {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedFields, setSelectedFields] = useState(["refNumber","mataiTitle","holderName","mataiType","village","district","dateRegistration"]);
  const [filterType, setFilterType] = useState("All");
  const [filterDistrict, setFilterDistrict] = useState("All");
  const [format, setFormat] = useState("csv");
  const perms = getPermissions(userRole);
  const user = auth.currentUser;

  useEffect(() => {
    (async () => {
      try {
        const q = query(collection(db, "registrations"), orderBy("createdAt", "desc"));
        const snap = await getDocs(q);
        setRecords(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (err) { console.error(err); }
      finally { setLoading(false); }
    })();
  }, []);

  const districts = ["All", ...new Set(records.map(r => r.district).filter(Boolean))].sort();
  const types = ["All", "Ali'i", "Faipule", "Tulafale"];

  const filtered = records.filter(r => {
    const matchType = filterType === "All" || r.mataiType === filterType;
    const matchDistrict = filterDistrict === "All" || r.district === filterDistrict;
    return matchType && matchDistrict;
  });

  const toggleField = (key) => {
    setSelectedFields(prev =>
      prev.includes(key) ? prev.filter(f => f !== key) : [...prev, key]
    );
  };

  const exportCSV = () => {
    const headers = selectedFields.map(k => ALL_FIELDS.find(f => f.key === k)?.label || k);
    const rows = filtered.map(r => selectedFields.map(k => {
      const val = r[k] || "";
      return `"${String(val).replace(/"/g, '""')}"`;
    }));
    const csv = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    download("matai-registry-export.csv", "text/csv", csv);
    logAudit("EXPORT", { format:"csv", count: filtered.length });
  };

  const exportPDF = () => {
    const win = window.open("", "_blank");
    const headers = selectedFields.map(k => ALL_FIELDS.find(f => f.key === k)?.label || k);
    const rows = filtered.map(r => selectedFields.map(k => r[k] || "—"));

    win.document.write(`<!DOCTYPE html><html><head>
      <title>Matai Registry Export</title>
      <style>
        body { font-family: Georgia, serif; color: #1a1208; padding: 2rem; }
        h1 { font-size: 1.4rem; text-align: center; margin-bottom: 0.25rem; letter-spacing: 0.05em; }
        .subtitle { text-align: center; font-style: italic; color: #666; font-size: 0.85rem; margin-bottom: 0.25rem; }
        .meta { text-align: center; font-size: 0.78rem; color: #888; margin-bottom: 1.5rem; }
        table { width: 100%; border-collapse: collapse; font-size: 0.82rem; }
        th { background: #8b6914; color: white; padding: 0.5rem 0.75rem; text-align: left; font-size: 0.72rem; letter-spacing: 0.08em; text-transform: uppercase; }
        td { padding: 0.45rem 0.75rem; border-bottom: 1px solid #ddd; }
        tr:nth-child(even) td { background: #fdf8f0; }
        .footer { margin-top: 2rem; text-align: center; font-size: 0.72rem; color: #aaa; border-top: 1px solid #ddd; padding-top: 1rem; }
        @media print { body { padding: 0.5rem; } }
      </style>
    </head><body>
      <h1>MATAGALUEGA O FAAMASINOGA MA LE FAAFOEINA O TULAGA TAU FAAMASINOGA</h1>
      <p class="subtitle">Resitalaina o Matai — Official Registry Export</p>
      <p class="meta">Generated: ${new Date().toLocaleDateString("en-NZ", { day:"numeric", month:"long", year:"numeric" })} &nbsp;|&nbsp; Records: ${filtered.length} &nbsp;|&nbsp; Filter: ${filterType === "All" ? "All Types" : filterType}, ${filterDistrict === "All" ? "All Districts" : filterDistrict}</p>
      <table>
        <thead><tr>${headers.map(h => `<th>${h}</th>`).join("")}</tr></thead>
        <tbody>${rows.map(r => `<tr>${r.map(v => `<td>${v}</td>`).join("")}</tr>`).join("")}</tbody>
      </table>
      <div class="footer">Matai Registry &mdash; Resitalaina o Matai &mdash; Confidential</div>
      <script>window.onload = () => { window.print(); }<\/script>
    </body></html>`);
    win.document.close();
    logAudit("EXPORT", { format:"pdf", count: filtered.length });
  };

  const download = (filename, mime, content) => {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  };

  const labelStyle = { fontFamily:"'Cinzel',serif", fontSize:"0.68rem", letterSpacing:"0.15em", textTransform:"uppercase", color:"rgba(201,168,76,0.7)", marginBottom:"0.75rem", display:"block" };
  const sectionStyle = { background:"rgba(255,255,255,0.02)", border:"1px solid rgba(201,168,76,0.15)", borderRadius:"4px", padding:"1.5rem", marginBottom:"1.5rem" };

  return (
    <div className="app-layout">
      <div className="pattern-bg" />
      <Sidebar userRole={userRole} userEmail={user?.email} />
      <div className="sidebar-content">
        <div style={{ marginBottom:"2rem" }}>
          <p style={{ fontFamily:"'Cinzel',serif", fontSize:"0.7rem", letterSpacing:"0.25em", color:"rgba(201,168,76,0.6)", textTransform:"uppercase", marginBottom:"0.4rem" }}>Data Management</p>
          <h1 style={{ fontFamily:"'Cinzel Decorative',serif", fontSize:"1.8rem", color:"#f5ede0" }}>Export Report</h1>
        </div>

        {loading ? (
          <p style={{ color:"rgba(201,168,76,0.5)", fontStyle:"italic" }}>Loading records…</p>
        ) : (
          <div style={{ display:"grid", gridTemplateColumns:"1fr 320px", gap:"1.5rem", alignItems:"start" }}>

            {/* Left — config */}
            <div>
              {/* Field selection */}
              <div style={sectionStyle}>
                <span style={labelStyle}>◈ Select Columns to Export</span>
                <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(200px,1fr))", gap:"0.5rem" }}>
                  {ALL_FIELDS.map(f => (
                    <label key={f.key} style={{ display:"flex", alignItems:"center", gap:"0.5rem", cursor:"pointer", padding:"0.4rem 0.6rem", borderRadius:"2px", background: selectedFields.includes(f.key) ? "rgba(201,168,76,0.1)" : "transparent", border: selectedFields.includes(f.key) ? "1px solid rgba(201,168,76,0.3)" : "1px solid transparent", transition:"all 0.15s" }}>
                      <input type="checkbox" checked={selectedFields.includes(f.key)} onChange={() => toggleField(f.key)}
                        style={{ accentColor:"#c9a84c", width:"14px", height:"14px" }} />
                      <span style={{ fontSize:"0.82rem", color: selectedFields.includes(f.key) ? "#c9a84c" : "rgba(245,237,224,0.6)" }}>{f.label}</span>
                    </label>
                  ))}
                </div>
                <div style={{ display:"flex", gap:"0.75rem", marginTop:"1rem" }}>
                  <button onClick={() => setSelectedFields(ALL_FIELDS.map(f => f.key))} style={{ background:"transparent", border:"1px solid rgba(201,168,76,0.3)", color:"rgba(201,168,76,0.7)", padding:"0.35rem 0.75rem", fontFamily:"'Cinzel',serif", fontSize:"0.62rem", letterSpacing:"0.1em", textTransform:"uppercase", borderRadius:"2px", cursor:"pointer" }}>
                    Select All
                  </button>
                  <button onClick={() => setSelectedFields([])} style={{ background:"transparent", border:"1px solid rgba(245,237,224,0.15)", color:"rgba(245,237,224,0.4)", padding:"0.35rem 0.75rem", fontFamily:"'Cinzel',serif", fontSize:"0.62rem", letterSpacing:"0.1em", textTransform:"uppercase", borderRadius:"2px", cursor:"pointer" }}>
                    Clear
                  </button>
                </div>
              </div>

              {/* Filters */}
              <div style={sectionStyle}>
                <span style={labelStyle}>◈ Filter Records</span>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"1rem" }}>
                  <div className="form-group">
                    <label>Title Type</label>
                    <select value={filterType} onChange={e => setFilterType(e.target.value)}>
                      {types.map(t => <option key={t}>{t}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>District</label>
                    <select value={filterDistrict} onChange={e => setFilterDistrict(e.target.value)}>
                      {districts.map(d => <option key={d}>{d}</option>)}
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {/* Right — export panel */}
            <div style={{ ...sectionStyle, position:"sticky", top:"2rem" }}>
              <span style={labelStyle}>◈ Export</span>

              <div style={{ background:"rgba(201,168,76,0.05)", border:"1px solid rgba(201,168,76,0.2)", borderRadius:"3px", padding:"1rem", marginBottom:"1.5rem", textAlign:"center" }}>
                <p style={{ fontFamily:"'Cinzel Decorative',serif", fontSize:"2rem", color:"#c9a84c", marginBottom:"0.25rem" }}>{filtered.length}</p>
                <p style={{ fontFamily:"'Cinzel',serif", fontSize:"0.65rem", color:"rgba(201,168,76,0.5)", letterSpacing:"0.15em", textTransform:"uppercase" }}>records to export</p>
                <p style={{ fontFamily:"'Cinzel',serif", fontSize:"0.62rem", color:"rgba(201,168,76,0.4)", marginTop:"0.25rem" }}>{selectedFields.length} columns selected</p>
              </div>

              {/* Format toggle */}
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"0.5rem", marginBottom:"1.5rem" }}>
                {["csv","pdf"].map(f => (
                  <button key={f} onClick={() => setFormat(f)} style={{
                    padding:"0.6rem", fontFamily:"'Cinzel',serif", fontSize:"0.72rem", letterSpacing:"0.1em", textTransform:"uppercase",
                    border: format === f ? "1px solid #c9a84c" : "1px solid rgba(201,168,76,0.25)",
                    background: format === f ? "rgba(201,168,76,0.15)" : "transparent",
                    color: format === f ? "#c9a84c" : "rgba(245,237,224,0.4)",
                    borderRadius:"2px", cursor:"pointer", transition:"all 0.15s"
                  }}>
                    {f === "csv" ? "📊 CSV" : "📄 PDF"}
                  </button>
                ))}
              </div>

              <button
                className="btn-primary"
                style={{ width:"100%", fontSize:"0.78rem" }}
                disabled={selectedFields.length === 0 || filtered.length === 0}
                onClick={format === "csv" ? exportCSV : exportPDF}
              >
                Download {format.toUpperCase()}
              </button>

              {format === "pdf" && (
                <p style={{ fontSize:"0.72rem", color:"rgba(245,237,224,0.35)", marginTop:"0.75rem", textAlign:"center", fontStyle:"italic" }}>
                  PDF opens in a new tab — use browser print dialog
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

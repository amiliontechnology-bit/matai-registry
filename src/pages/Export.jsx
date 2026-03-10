import { useState, useEffect, useRef } from "react";
import { collection, getDocs } from "firebase/firestore";
import { auth, db } from "../firebase";
import { logAudit } from "../utils/audit";
import { getPermissions } from "../utils/roles";
import Sidebar from "../components/Sidebar";
import { cachedFetch, cacheClear } from "../utils/cache";

const ALL_FIELDS = [
  { key:"mataiCertNumber",  label:"Matai Certificate Number" },
  { key:"mataiTitle",       label:"Matai Title" },
  { key:"holderName",       label:"Holder Name" },
  { key:"gender",           label:"Gender" },
  { key:"mataiType",        label:"Title Type" },
  { key:"village",          label:"Village" },
  { key:"district",         label:"District" },
  { key:"nuuMataiAi",       label:"Village of Other Title" },
  { key:"familyTitles",     label:"Other Matai Title" },
  { key:"dateConferred",    label:"Aso o le Saofai" },
  { key:"dateSavaliPublished", label:"Aso Faasalalauga" },
  { key:"dateRegistration", label:"Aso Resitala" },
  { key:"dateIssued",       label:"Date Issued" },
  { key:"dateBirth",        label:"Date of Birth" },
  { key:"nuuFanau",         label:"Village of Birth" },
  { key:"faapogai",         label:"Faapogai" },
  { key:"photoIdType",      label:"ID Type" },
  { key:"photoIdNumber",    label:"ID Number" },
  { key:"objection",        label:"Objection" },
  { key:"objectionDate",    label:"Objection Date" },
  { key:"notes",            label:"Notes" },
];

const fmtDate = (str) => {
  if (!str) return "";
  const parts = String(str).split("T")[0].split("-");
  if (parts.length === 3 && parts[0].length === 4)
    return `${parts[2].padStart(2,"0")}/${parts[1].padStart(2,"0")}/${parts[0]}`;
  const d = new Date(str);
  if (isNaN(d)) return str;
  return `${String(d.getDate()).padStart(2,"0")}/${String(d.getMonth()+1).padStart(2,"0")}/${d.getFullYear()}`;
};

const DATE_KEYS = new Set(["dateConferred","dateSavaliPublished","dateRegistration","dateIssued","dateBirth","objectionDate"]);

const OPERATORS = {
  text:   ["contains","equals","starts with","ends with","is empty","is not empty"],
  date:   ["equals","before","after","between","is empty","is not empty"],
  select: ["equals","not equals","is empty","is not empty"],
};
const FILTER_TYPES = {
  mataiCertNumber:"text", mataiTitle:"text", holderName:"text", gender:"select", mataiType:"select",
  village:"text", district:"select", familyTitles:"text", nuuMataiAi:"text", nuuFanau:"text",
  dateConferred:"date", dateSavaliPublished:"date", dateRegistration:"date", dateIssued:"date",
  dateBirth:"date", objectionDate:"date", faapogai:"text", notes:"text",
  photoIdType:"select", photoIdNumber:"text", objection:"select",
};

function applyFilter(records, filters) {
  return records.filter(r =>
    filters.every(f => {
      if (!f.field) return true;
      const val = (r[f.field] || "").toString().toLowerCase();
      const fval = (f.value || "").toLowerCase();
      switch(f.op) {
        case "contains":     return val.includes(fval);
        case "equals":       return val === fval;
        case "starts with":  return val.startsWith(fval);
        case "ends with":    return val.endsWith(fval);
        case "not equals":   return val !== fval;
        case "is empty":     return !val;
        case "is not empty": return !!val;
        case "before":       return r[f.field] && r[f.field] < f.value;
        case "after":        return r[f.field] && r[f.field] > f.value;
        case "between":      return r[f.field] && r[f.field] >= f.value && r[f.field] <= f.value2;
        default:             return true;
      }
    })
  );
}

export default function Export({ userRole }) {
  const [records, setRecords]       = useState([]);
  const [loading, setLoading]       = useState(true);
  const [selectedFields, setSelectedFields] = useState([
    "mataiCertNumber","mataiTitle","holderName","mataiType","village","district","dateRegistration"
  ]);
  const [filters, setFilters] = useState([{ field:"", op:"contains", value:"", value2:"" }]);
  const [showResults, setShowResults] = useState(false);
  const user = auth.currentUser;
  const tableRef = useRef(null);

  useEffect(() => {
    (async () => {
      try {
        const list = await cachedFetch("registrations", async () => {
          const snap = await getDocs(collection(db, "registrations"));
          const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
          data.sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
          return data;
        });
        setRecords(list);
      } catch (err) { console.error(err); }
      finally { setLoading(false); }
    })();
  }, []);

  const filtered = applyFilter(records, filters);

  const addFilter    = () => setFilters(f => [...f, { field:"", op:"contains", value:"", value2:"" }]);
  const removeFilter = (i) => setFilters(f => f.filter((_,idx) => idx !== i));
  const updateFilter = (i, key, val) => setFilters(f =>
    f.map((row,idx) => idx === i
      ? { ...row, [key]: val, ...(key==="field" ? { op: OPERATORS[FILTER_TYPES[val]||"text"][0], value:"", value2:"" } : {}) }
      : row)
  );
  const toggleField  = (key) => setSelectedFields(prev => prev.includes(key) ? prev.filter(f => f !== key) : [...prev, key]);
  const uniqueVals   = (field) => [...new Set(records.map(r => r[field]).filter(Boolean))].sort();

  const runReport = () => setShowResults(true);

  const exportPDF = () => {
    const win = window.open("", "_blank");
    const emblemUrl = window.location.origin + "/matai-registry/emblem.png";
    const headers = selectedFields.map(k => ALL_FIELDS.find(f => f.key === k)?.label || k);
    const rows = filtered.map(r => selectedFields.map(k => DATE_KEYS.has(k) ? fmtDate(r[k]) : (r[k] || "—")));
    const today = (() => { const d = new Date(); return `${String(d.getDate()).padStart(2,"0")}/${String(d.getMonth()+1).padStart(2,"0")}/${d.getFullYear()}`; })();
    const userName = user?.displayName || user?.email || "Unknown User";
    win.document.write(`<!DOCTYPE html><html><head>
      <title>Matai Registry Report</title>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700&family=EB+Garamond:ital,wght@0,400;1,400&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        body{font-family:'EB Garamond',Georgia,serif;color:#1a1208;padding:1.5rem;background:#fff;}
        .header{display:flex;align-items:center;gap:1.5rem;border-bottom:3px solid #1a5c35;padding-bottom:1rem;margin-bottom:1rem;}
        .logo{width:70px;height:70px;object-fit:contain;}
        .ministry{font-family:'Cinzel',serif;font-size:0.62rem;letter-spacing:0.1em;color:#1a5c35;text-transform:uppercase;margin-bottom:0.2rem;}
        .doc-title{font-family:'Cinzel',serif;font-size:1rem;font-weight:700;color:#1a5c35;letter-spacing:0.12em;text-transform:uppercase;}
        .meta{display:flex;justify-content:space-between;flex-wrap:wrap;gap:0.4rem;font-size:0.72rem;color:#555;margin-bottom:1rem;padding:0.5rem 0.75rem;background:#f5faf7;border:1px solid #c3e6cb;border-radius:3px;}
        .meta span{display:flex;gap:0.3rem;align-items:center;}
        .meta strong{color:#1a5c35;}
        table{width:100%;border-collapse:collapse;font-size:0.76rem;}
        th{background:#1a5c35;color:white;padding:0.5rem 0.6rem;text-align:left;font-family:'Cinzel',serif;font-size:0.58rem;letter-spacing:0.08em;text-transform:uppercase;white-space:nowrap;}
        td{padding:0.42rem 0.6rem;border-bottom:1px solid #e5e7eb;vertical-align:top;}
        tr:nth-child(even) td{background:#f0faf4;}
        .footer{margin-top:1.5rem;display:flex;justify-content:space-between;font-size:0.65rem;color:#999;border-top:1px solid #ddd;padding-top:0.75rem;font-family:'Cinzel',serif;letter-spacing:0.08em;}
        @media print{body{padding:0;}@page{margin:1.5cm;size:A4 landscape;}}
      </style>
    </head><body>
      <div class="header">
        <img src="${emblemUrl}" class="logo" alt="Samoa Emblem" />
        <div>
          <div class="ministry">Matagaluega o Faamasinoga ma le Faafoeina o Tulaga Tau Faamasinoga</div>
          <div style="font-size:0.72rem;color:#5a3e00;font-style:italic;margin-bottom:0.4rem;">Ministry of Justice and Courts Administration</div>
          <div class="doc-title">Resitalaina o Matai — Registry Report</div>
        </div>
      </div>
      <div class="meta">
        <span>📅 Generated: <strong>${today}</strong></span>
        <span>👤 By: <strong>${userName}</strong></span>
        <span>📋 Records: <strong>${filtered.length}</strong></span>
        <span>🔢 Columns: <strong>${selectedFields.length}</strong></span>
      </div>
      <table>
        <thead><tr>${headers.map(h=>`<th>${h}</th>`).join("")}</tr></thead>
        <tbody>${rows.map(r=>`<tr>${r.map(v=>`<td>${v}</td>`).join("")}</tr>`).join("")}</tbody>
      </table>
      <div class="footer">
        <span>MATAI REGISTRY — RESITALAINA O MATAI</span>
        <span>CONFIDENTIAL — ${today}</span>
        <span>Generated by: ${userName}</span>
      </div>
      <script>window.onload=()=>{window.print();}<\/script>
    </body></html>`);
    win.document.close();
    logAudit("REPORT", { format:"pdf", count: filtered.length });
  };

  const sStyle = { background:"#ffffff", border:"1px solid rgba(30,107,60,0.2)", borderRadius:"4px", padding:"1.5rem", marginBottom:"1.5rem", boxShadow:"0 1px 4px rgba(0,0,0,0.05)" };
  const lblStyle = { fontFamily:"'Cinzel',serif", fontSize:"0.68rem", letterSpacing:"0.15em", textTransform:"uppercase", color:"#1e6b3c", marginBottom:"0.75rem", display:"block" };

  return (
    <div className="app-layout">
      <div className="pattern-bg" />
      <Sidebar userRole={userRole} userEmail={user?.email} />
      <div className="sidebar-content">
        <div style={{ marginBottom:"2rem" }}>
          <p style={{ fontFamily:"'Cinzel',serif", fontSize:"0.7rem", letterSpacing:"0.25em", color:"#1e6b3c", textTransform:"uppercase", marginBottom:"0.4rem" }}>Data Management</p>
          <h1 style={{ fontFamily:"'Cinzel Decorative',serif", fontSize:"1.8rem", color:"#1a1a1a" }}>Reports</h1>
        </div>

        {loading ? <p style={{ color:"rgba(30,107,60,0.6)", fontStyle:"italic" }}>Loading records…</p> : (
          <>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 300px", gap:"1.5rem", alignItems:"start" }}>

              {/* Left — filters + columns */}
              <div>
                {/* Filters */}
                <div style={sStyle}>
                  <span style={lblStyle}>◈ Filters</span>
                  {filters.map((f, i) => (
                    <div key={i} style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr auto", gap:"0.5rem", marginBottom:"0.6rem", alignItems:"center" }}>
                      <select value={f.field} onChange={e => updateFilter(i,"field",e.target.value)} style={{ fontSize:"0.82rem", padding:"0.5rem", background:"#fff", border:"1px solid rgba(30,107,60,0.3)", color:"#1a1a1a", borderRadius:"2px" }}>
                        <option value="">— Select Field —</option>
                        {ALL_FIELDS.map(af => <option key={af.key} value={af.key}>{af.label}</option>)}
                      </select>
                      <select value={f.op} onChange={e => updateFilter(i,"op",e.target.value)} disabled={!f.field} style={{ fontSize:"0.82rem", padding:"0.5rem", background:"#fff", border:"1px solid rgba(30,107,60,0.3)", color:"#1a1a1a", borderRadius:"2px" }}>
                        {(OPERATORS[FILTER_TYPES[f.field]||"text"]||[]).map(op => <option key={op}>{op}</option>)}
                      </select>
                      {f.op !== "is empty" && f.op !== "is not empty" ? (
                        FILTER_TYPES[f.field] === "date" ? (
                          <div style={{ display:"flex", gap:"4px" }}>
                            <input type="date" value={f.value} onChange={e => updateFilter(i,"value",e.target.value)} style={{ flex:1, fontSize:"0.78rem", padding:"0.45rem", border:"1px solid rgba(30,107,60,0.3)", borderRadius:"2px" }} />
                            {f.op === "between" && <input type="date" value={f.value2} onChange={e => updateFilter(i,"value2",e.target.value)} style={{ flex:1, fontSize:"0.78rem", padding:"0.45rem", border:"1px solid rgba(30,107,60,0.3)", borderRadius:"2px" }} />}
                          </div>
                        ) : FILTER_TYPES[f.field] === "select" ? (
                          <select value={f.value} onChange={e => updateFilter(i,"value",e.target.value)} style={{ fontSize:"0.82rem", padding:"0.5rem", background:"#fff", border:"1px solid rgba(30,107,60,0.3)", color:"#1a1a1a", borderRadius:"2px" }}>
                            <option value="">— Any —</option>
                            {uniqueVals(f.field).map(v => <option key={v}>{v}</option>)}
                          </select>
                        ) : (
                          <input type="text" value={f.value} onChange={e => updateFilter(i,"value",e.target.value)} placeholder="Value…" style={{ fontSize:"0.82rem", padding:"0.5rem", border:"1px solid rgba(30,107,60,0.3)", borderRadius:"2px" }} />
                        )
                      ) : <div />}
                      <button onClick={() => removeFilter(i)} disabled={filters.length === 1} style={{ background:"transparent", border:"1px solid rgba(139,26,26,0.3)", color:"#8b1a1a", width:"32px", height:"32px", borderRadius:"2px", cursor:"pointer", fontSize:"14px" }}>✕</button>
                    </div>
                  ))}
                  <button onClick={addFilter} style={{ background:"transparent", border:"1px dashed rgba(30,107,60,0.4)", color:"#1e6b3c", padding:"0.4rem 1rem", fontFamily:"'Cinzel',serif", fontSize:"0.65rem", letterSpacing:"0.1em", textTransform:"uppercase", borderRadius:"2px", cursor:"pointer", marginTop:"0.25rem" }}>
                    + Add Filter
                  </button>
                </div>

                {/* Column selection */}
                <div style={sStyle}>
                  <span style={lblStyle}>◈ Columns to Include</span>
                  <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(190px,1fr))", gap:"0.4rem" }}>
                    {ALL_FIELDS.map(f => (
                      <label key={f.key} style={{ display:"flex", alignItems:"center", gap:"0.5rem", cursor:"pointer", padding:"0.4rem 0.6rem", borderRadius:"2px", background: selectedFields.includes(f.key) ? "rgba(30,107,60,0.08)" : "transparent", border: selectedFields.includes(f.key) ? "1px solid rgba(30,107,60,0.25)" : "1px solid transparent" }}>
                        <input type="checkbox" checked={selectedFields.includes(f.key)} onChange={() => toggleField(f.key)} style={{ accentColor:"#1e6b3c" }} />
                        <span style={{ fontSize:"0.82rem", color: selectedFields.includes(f.key) ? "#1e6b3c" : "rgba(26,26,26,0.6)" }}>{f.label}</span>
                      </label>
                    ))}
                  </div>
                  <div style={{ display:"flex", gap:"0.5rem", marginTop:"0.75rem" }}>
                    <button onClick={() => setSelectedFields(ALL_FIELDS.map(f=>f.key))} style={{ background:"transparent", border:"1px solid rgba(30,107,60,0.3)", color:"#1e6b3c", padding:"0.3rem 0.75rem", fontFamily:"'Cinzel',serif", fontSize:"0.62rem", letterSpacing:"0.1em", textTransform:"uppercase", borderRadius:"2px", cursor:"pointer" }}>Select All</button>
                    <button onClick={() => setSelectedFields([])} style={{ background:"transparent", border:"1px solid rgba(26,26,26,0.15)", color:"rgba(26,26,26,0.4)", padding:"0.3rem 0.75rem", fontFamily:"'Cinzel',serif", fontSize:"0.62rem", letterSpacing:"0.1em", textTransform:"uppercase", borderRadius:"2px", cursor:"pointer" }}>Clear</button>
                  </div>
                </div>
              </div>

              {/* Right — run + export panel */}
              <div style={{ ...sStyle, position:"sticky", top:"2rem" }}>
                <span style={lblStyle}>◈ Report</span>
                <div style={{ background:"rgba(30,107,60,0.06)", border:"1px solid rgba(30,107,60,0.2)", borderRadius:"3px", padding:"1rem", marginBottom:"1.5rem", textAlign:"center" }}>
                  <p style={{ fontFamily:"'Cinzel Decorative',serif", fontSize:"2rem", color:"#1e6b3c", marginBottom:"0.25rem" }}>{filtered.length}</p>
                  <p style={{ fontFamily:"'Cinzel',serif", fontSize:"0.65rem", color:"rgba(30,107,60,0.6)", letterSpacing:"0.15em", textTransform:"uppercase" }}>matching records</p>
                  <p style={{ fontFamily:"'Cinzel',serif", fontSize:"0.62rem", color:"rgba(30,107,60,0.5)", marginTop:"0.25rem" }}>{selectedFields.length} columns selected</p>
                </div>
                <div style={{ fontSize:"0.75rem", color:"#555", marginBottom:"1rem", padding:"0.5rem 0.75rem", background:"#f9fafb", borderRadius:"3px", border:"1px solid #e5e7eb" }}>
                  <strong>Generated by:</strong> {user?.displayName || user?.email || "—"}
                </div>
                <button className="btn-primary" style={{ width:"100%", marginBottom:"0.75rem" }}
                  onClick={runReport} disabled={filtered.length === 0}>
                  🔍 Run Report
                </button>
                <button className="btn-primary" style={{ width:"100%", fontSize:"0.78rem", background:"#0f2e1a" }}
                  disabled={selectedFields.length === 0 || filtered.length === 0}
                  onClick={exportPDF}>
                  📄 Export PDF Report
                </button>
                <p style={{ fontSize:"0.72rem", color:"rgba(26,26,26,0.4)", marginTop:"0.75rem", textAlign:"center", fontStyle:"italic" }}>Opens in new tab — use browser print</p>
              </div>
            </div>

            {/* Results table */}
            {showResults && filtered.length > 0 && (
              <div style={sStyle} ref={tableRef}>
                <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:"1rem" }}>
                  <span style={lblStyle}>◈ Results — {filtered.length} record{filtered.length !== 1 ? "s" : ""}</span>
                  <button onClick={() => setShowResults(false)} style={{ background:"transparent", border:"none", color:"#888", cursor:"pointer", fontSize:"1rem" }}>✕ Close</button>
                </div>
                <div style={{ overflowX:"auto" }}>
                  <table style={{ width:"100%", borderCollapse:"collapse", fontSize:"0.82rem" }}>
                    <thead>
                      <tr>
                        {selectedFields.map(k => (
                          <th key={k} style={{ background:"#1a5c35", color:"white", padding:"0.5rem 0.65rem", textAlign:"left", fontFamily:"'Cinzel',serif", fontSize:"0.6rem", letterSpacing:"0.08em", textTransform:"uppercase", whiteSpace:"nowrap" }}>
                            {ALL_FIELDS.find(f => f.key === k)?.label || k}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((r, i) => (
                        <tr key={r.id}>
                          {selectedFields.map(k => (
                            <td key={k} style={{ padding:"0.45rem 0.65rem", borderBottom:"1px solid #e5e7eb", verticalAlign:"top", background: i % 2 === 0 ? "#fff" : "#f0faf4",
                              color: k === "objection" && r[k] === "yes" ? "#8b1a1a" : "#1a1208",
                              fontWeight: k === "objection" && r[k] === "yes" ? 600 : 400 }}>
                              {DATE_KEYS.has(k) ? fmtDate(r[k]) : (r[k] || "—")}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            {showResults && filtered.length === 0 && (
              <div style={{ ...sStyle, textAlign:"center", color:"rgba(26,26,26,0.4)", fontStyle:"italic" }}>
                No records match the current filters.
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

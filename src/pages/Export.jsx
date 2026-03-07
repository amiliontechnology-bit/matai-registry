import { useState, useEffect } from "react";
import { collection, getDocs } from "firebase/firestore";
import { auth, db } from "../firebase";
import { logAudit } from "../utils/audit";
import { getPermissions } from "../utils/roles";
import Sidebar from "../components/Sidebar";
import { cacheGet, cacheSet } from "../utils/cache";

const ALL_FIELDS = [
  { key:"mataiCertNumber",  label:\"Matai Certificate Number\" },
  { key:"mataiTitle",       label:"Matai Title" },
  { key:"holderName",       label:"Holder Name" },
  { key:"gender",           label:"Gender" },
  { key:"mataiType",        label:"Title Type" },
  { key:"village",          label:"Village" },
  { key:"district",         label:"District" },
  { key:"nuuMataiAi",       label:"Village of Other Title" },
  { key:"familyTitles",     label:"Other Matai Title" },
  { key:"dateConferred",    label:"Date Conferred" },
  { key:"dateProclamation", label:"Date Proclamation" },
  { key:"dateRegistration", label:"Date Registration" },
  { key:"dateIssued",       label:"Date Issued" },
  { key:"dateBirth",        label:"Date of Birth" },
  { key:"nuuFanau",         label:"Village of Birth" },
  { key:"faapogai",         label:"Faapogai" },
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

// Filter operators
const OPERATORS = {
  text:   ["contains","equals","starts with","ends with","is empty","is not empty"],
  date:   ["equals","before","after","between","is empty","is not empty"],
  select: ["equals","not equals","is empty","is not empty"],
};

const FILTER_TYPES = {
  mataiCertNumber:"text", mataiTitle:"text", holderName:"text", gender:"select", mataiType:"select",
  village:"text", district:"select", familyTitles:"text", nuuMataiAi:"text", nuuFanau:"text",
  dateConferred:"date", dateProclamation:"date", dateRegistration:"date", dateIssued:"date", dateBirth:"date",
  faapogai:"text", notes:"text"
};

function applyFilter(records, filters) {
  return records.filter(r => {
    return filters.every(f => {
      if (!f.field) return true;
      const val = (r[f.field] || "").toString().toLowerCase();
      const fval = (f.value || "").toLowerCase();
      const fval2 = (f.value2 || "").toLowerCase();
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
    });
  });
}

export default function Export({ userRole }) {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedFields, setSelectedFields] = useState(["mataiCertNumber","mataiTitle","holderName","mataiType","village","district","dateRegistration"]);
  const [filters, setFilters] = useState([{ field:"", op:"contains", value:"", value2:"" }]);
  const [format, setFormat] = useState("csv");
  const user = auth.currentUser;

  useEffect(() => {
    (async () => {
      try {
        const cached = cacheGet("registrations");
        if (cached) { setRecords(cached); setLoading(false); return; }
        const snap = await getDocs(collection(db, "registrations"));
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        list.sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
        cacheSet("registrations", list);
        setRecords(list);
      } catch (err) { console.error(err); }
      finally { setLoading(false); }
    })();
  }, []);

  const filtered = applyFilter(records, filters);

  // Filter row operations
  const addFilter = () => setFilters(f => [...f, { field:"", op:"contains", value:"", value2:"" }]);
  const removeFilter = (i) => setFilters(f => f.filter((_,idx) => idx !== i));
  const updateFilter = (i, key, val) => setFilters(f => f.map((row,idx) => idx === i ? { ...row, [key]: val, ...(key==="field" ? { op: OPERATORS[FILTER_TYPES[val]||"text"][0], value:"", value2:"" } : {}) } : row));

  const toggleField = (key) => setSelectedFields(prev => prev.includes(key) ? prev.filter(f => f !== key) : [...prev, key]);

  // Unique values for select fields
  const uniqueVals = (field) => [...new Set(records.map(r => r[field]).filter(Boolean))].sort();

  const exportCSV = () => {
    const headers = selectedFields.map(k => ALL_FIELDS.find(f => f.key === k)?.label || k);
    const rows = filtered.map(r => selectedFields.map(k => {
      const val = FILTER_TYPES[k] === "date" ? fmtDate(r[k]) : (r[k] || "");
      return `"${String(val).replace(/"/g,'""')}"`;
    }));
    const csv = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob([csv], { type:"text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `matai-registry-export-${fmtDate(new Date().toISOString().split("T")[0])}.csv`;
    a.click();
    logAudit("EXPORT", { format:"csv", count: filtered.length });
  };

  const exportPDF = () => {
    const win = window.open("", "_blank");
    const logoUrl = window.location.origin + "/matai-registry/mjca_logo.jpeg";
    const headers = selectedFields.map(k => ALL_FIELDS.find(f => f.key === k)?.label || k);
    const rows = filtered.map(r => selectedFields.map(k => FILTER_TYPES[k] === "date" ? fmtDate(r[k]) : (r[k] || "—")));
    const today = (() => { const d = new Date(); return `${String(d.getDate()).padStart(2,"0")}/${String(d.getMonth()+1).padStart(2,"0")}/${d.getFullYear()}`; })();
    win.document.write(`<!DOCTYPE html><html><head>
      <title>Matai Registry Export</title>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700&family=EB+Garamond:ital,wght@0,400;1,400&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        body{font-family:'EB Garamond',Georgia,serif;color:#1a1208;padding:1.5rem;background:#fff;}
        .header{display:flex;align-items:center;justify-content:center;gap:1.5rem;border-bottom:3px double #1a5c35;padding-bottom:1rem;margin-bottom:1rem;}
        .logo{width:80px;height:80px;object-fit:contain;}
        .title-block{text-align:center;}
        .ministry{font-family:'Cinzel',serif;font-size:0.65rem;letter-spacing:0.1em;color:#1a5c35;text-transform:uppercase;margin-bottom:0.2rem;}
        .subtitle{font-size:0.75rem;color:#666;font-style:italic;margin-bottom:0.3rem;}
        .doc-title{font-family:'Cinzel',serif;font-size:1.1rem;font-weight:700;color:#1a5c35;letter-spacing:0.12em;}
        .meta{display:flex;justify-content:space-between;font-size:0.72rem;color:#888;margin-bottom:1.25rem;padding:0 0.25rem;}
        table{width:100%;border-collapse:collapse;font-size:0.78rem;}
        th{background:#1a5c35;color:white;padding:0.5rem 0.65rem;text-align:left;font-family:'Cinzel',serif;font-size:0.62rem;letter-spacing:0.08em;text-transform:uppercase;}
        td{padding:0.45rem 0.65rem;border-bottom:1px solid #ddd;vertical-align:top;}
        tr:nth-child(even) td{background:#f0faf4;}
        .footer{margin-top:1.5rem;text-align:center;font-size:0.68rem;color:#aaa;border-top:1px solid #ddd;padding-top:0.75rem;font-family:'Cinzel',serif;letter-spacing:0.1em;}
        @media print{body{padding:0.5rem;}@page{margin:1.5cm;}}
      </style>
    </head><body>
      <div class="header">
        <img src="${logoUrl}" class="logo" alt="MJCA Logo" />
        <div class="title-block">
          <div class="ministry">MATAGALUEGA O FAAMASINOGA MA LE FAAFOEINA O TULAGA TAU FAAMASINOGA</div>
          <div class="subtitle">Ministry of Justice and Courts Administration</div>
          <div class="doc-title">RESITALAINA O MATAI — Official Registry Export</div>
        </div>
      </div>
      <div class="meta">
        <span>Generated: ${today}</span>
        <span>Total Records: ${filtered.length}</span>
        <span>Columns: ${selectedFields.length}</span>
      </div>
      <table>
        <thead><tr>${headers.map(h=>`<th>${h}</th>`).join("")}</tr></thead>
        <tbody>${rows.map(r=>`<tr>${r.map(v=>`<td>${v}</td>`).join("")}</tr>`).join("")}</tbody>
      </table>
      <div class="footer">Matai Registry &mdash; Resitalaina o Matai &mdash; Confidential Document</div>
      <script>window.onload=()=>{window.print();}<\/script>
    </body></html>`);
    win.document.close();
    logAudit("EXPORT", { format:"pdf", count: filtered.length });
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
          <h1 style={{ fontFamily:"'Cinzel Decorative',serif", fontSize:"1.8rem", color:"#1a1a1a" }}>Export Report</h1>
        </div>

        {loading ? <p style={{ color:"rgba(30,107,60,0.6)", fontStyle:"italic" }}>Loading records…</p> : (
          <div style={{ display:"grid", gridTemplateColumns:"1fr 300px", gap:"1.5rem", alignItems:"start" }}>

            {/* Left */}
            <div>
              {/* Column selection */}
              <div style={sStyle}>
                <span style={lblStyle}>◈ Columns to Export</span>
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

              {/* Filters */}
              <div style={sStyle}>
                <span style={lblStyle}>◈ Filters</span>
                {filters.map((f, i) => (
                  <div key={i} style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr auto", gap:"0.5rem", marginBottom:"0.6rem", alignItems:"center" }}>
                    {/* Field */}
                    <select value={f.field} onChange={e => updateFilter(i,"field",e.target.value)} style={{ fontSize:"0.82rem", padding:"0.5rem", background:"#fff", border:"1px solid rgba(30,107,60,0.3)", color:"#1a1a1a", borderRadius:"2px" }}>
                      <option value="">— Select Field —</option>
                      {ALL_FIELDS.map(af => <option key={af.key} value={af.key}>{af.label}</option>)}
                    </select>
                    {/* Operator */}
                    <select value={f.op} onChange={e => updateFilter(i,"op",e.target.value)} disabled={!f.field} style={{ fontSize:"0.82rem", padding:"0.5rem", background:"#fff", border:"1px solid rgba(30,107,60,0.3)", color:"#1a1a1a", borderRadius:"2px" }}>
                      {(OPERATORS[FILTER_TYPES[f.field]||"text"]||[]).map(op => <option key={op}>{op}</option>)}
                    </select>
                    {/* Value */}
                    {f.op !== "is empty" && f.op !== "is not empty" ? (
                      FILTER_TYPES[f.field] === "date" ? (
                        <div style={{ display:"flex", gap:"4px" }}>
                          <input type="date" value={f.value} onChange={e => updateFilter(i,"value",e.target.value)} style={{ flex:1, fontSize:"0.78rem", padding:"0.45rem", border:"1px solid rgba(30,107,60,0.3)", borderRadius:"2px", color:"#1a1a1a" }} />
                          {f.op === "between" && <input type="date" value={f.value2} onChange={e => updateFilter(i,"value2",e.target.value)} style={{ flex:1, fontSize:"0.78rem", padding:"0.45rem", border:"1px solid rgba(30,107,60,0.3)", borderRadius:"2px", color:"#1a1a1a" }} />}
                        </div>
                      ) : FILTER_TYPES[f.field] === "select" ? (
                        <select value={f.value} onChange={e => updateFilter(i,"value",e.target.value)} style={{ fontSize:"0.82rem", padding:"0.5rem", background:"#fff", border:"1px solid rgba(30,107,60,0.3)", color:"#1a1a1a", borderRadius:"2px" }}>
                          <option value="">— Any —</option>
                          {uniqueVals(f.field).map(v => <option key={v}>{v}</option>)}
                        </select>
                      ) : (
                        <input type="text" value={f.value} onChange={e => updateFilter(i,"value",e.target.value)} placeholder="Value…" style={{ fontSize:"0.82rem", padding:"0.5rem", border:"1px solid rgba(30,107,60,0.3)", borderRadius:"2px", color:"#1a1a1a" }} />
                      )
                    ) : <div />}
                    {/* Remove */}
                    <button onClick={() => removeFilter(i)} disabled={filters.length === 1} style={{ background:"transparent", border:"1px solid rgba(139,26,26,0.3)", color:"#8b1a1a", width:"32px", height:"32px", borderRadius:"2px", cursor:"pointer", fontSize:"14px" }}>✕</button>
                  </div>
                ))}
                <button onClick={addFilter} style={{ background:"transparent", border:"1px dashed rgba(30,107,60,0.4)", color:"#1e6b3c", padding:"0.4rem 1rem", fontFamily:"'Cinzel',serif", fontSize:"0.65rem", letterSpacing:"0.1em", textTransform:"uppercase", borderRadius:"2px", cursor:"pointer", marginTop:"0.25rem" }}>
                  + Add Filter
                </button>
              </div>
            </div>

            {/* Right — export panel */}
            <div style={{ ...sStyle, position:"sticky", top:"2rem" }}>
              <span style={lblStyle}>◈ Export</span>
              <div style={{ background:"rgba(30,107,60,0.06)", border:"1px solid rgba(30,107,60,0.2)", borderRadius:"3px", padding:"1rem", marginBottom:"1.5rem", textAlign:"center" }}>
                <p style={{ fontFamily:"'Cinzel Decorative',serif", fontSize:"2rem", color:"#1e6b3c", marginBottom:"0.25rem" }}>{filtered.length}</p>
                <p style={{ fontFamily:"'Cinzel',serif", fontSize:"0.65rem", color:"rgba(30,107,60,0.6)", letterSpacing:"0.15em", textTransform:"uppercase" }}>records to export</p>
                <p style={{ fontFamily:"'Cinzel',serif", fontSize:"0.62rem", color:"rgba(30,107,60,0.5)", marginTop:"0.25rem" }}>{selectedFields.length} columns</p>
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"0.5rem", marginBottom:"1.5rem" }}>
                {["csv","pdf"].map(f => (
                  <button key={f} onClick={() => setFormat(f)} style={{ padding:"0.6rem", fontFamily:"'Cinzel',serif", fontSize:"0.72rem", letterSpacing:"0.1em", textTransform:"uppercase", border: format===f ? "1px solid #1e6b3c" : "1px solid rgba(30,107,60,0.2)", background: format===f ? "rgba(30,107,60,0.1)" : "transparent", color: format===f ? "#1e6b3c" : "rgba(26,26,26,0.4)", borderRadius:"2px", cursor:"pointer" }}>
                    {f==="csv" ? "📊 CSV" : "📄 PDF"}
                  </button>
                ))}
              </div>
              <button className="btn-primary" style={{ width:"100%", fontSize:"0.78rem" }} disabled={selectedFields.length===0||filtered.length===0} onClick={format==="csv"?exportCSV:exportPDF}>
                Download {format.toUpperCase()}
              </button>
              {format==="pdf" && <p style={{ fontSize:"0.72rem", color:"rgba(26,26,26,0.4)", marginTop:"0.75rem", textAlign:"center", fontStyle:"italic" }}>Opens in new tab — use browser print</p>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

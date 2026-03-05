import { useState } from "react";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../firebase";
import { logAudit } from "../utils/audit";
import { getPermissions } from "../utils/roles";
import Sidebar from "../components/Sidebar";
import { Navigate } from "react-router-dom";

function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map(h => h.trim().replace(/^"|"$/g, ""));
  return lines.slice(1).map(line => {
    const values = [];
    let cur = "", inQuote = false;
    for (let ch of line) {
      if (ch === '"') inQuote = !inQuote;
      else if (ch === "," && !inQuote) { values.push(cur.trim()); cur = ""; }
      else cur += ch;
    }
    values.push(cur.trim());
    const obj = {};
    headers.forEach((h, i) => obj[h] = values[i] || "");
    return obj;
  });
}

// Map Excel/CSV columns (including Samoan column headers from the registry book)
function mapRow(row) {
  const g = (keys) => {
    for (const k of keys) {
      const found = Object.keys(row).find(rk =>
        rk.toLowerCase().replace(/[\s_\n\r]/g, "") === k.toLowerCase().replace(/[\s_\n\r]/g, "")
      );
      if (found && row[found] !== undefined && row[found] !== "") return String(row[found]).trim();
    }
    return "";
  };

  // Handle date values from Excel (serial numbers or strings)
  const parseDate = (val) => {
    if (!val) return "";
    // Excel serial date
    if (typeof val === "number" && val > 1000) {
      const d = new Date(Math.round((val - 25569) * 86400 * 1000));
      return d.toISOString().split("T")[0];
    }
    const str = String(val).trim();
    if (!str) return "";
    // dd/mm/yyyy
    const dmy = str.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/);
    if (dmy) return `${dmy[3]}-${dmy[2].padStart(2,"0")}-${dmy[1].padStart(2,"0")}`;
    // yyyy-mm-dd passthrough
    if (/^\d{4}-\d{2}-\d{2}/.test(str)) return str.slice(0,10);
    return str;
  };

  // Combine day + year columns from the registry book format
  const dayOfSaofai   = g(["asoosaofai","Asoosaofai","Asoolesaofai"]);
  const yearOfSaofai  = g(["tausagaosaofai","Tausagaosaofai","tausagaoleSaofai"]);
  const dayOfProclaim = g(["asoofaasalalauga","Asoofaasalalauga","Asoolefaasalalauga","asoolefaasalalau"]);
  const dayOfReg      = g(["asonaresitalaai","Asonaresitalaai","asonaresitalaai","Asonaresitala"]);
  const yearOfReg     = g(["tausagaoleresitala","Tausagaoleresitala","tausagaolefaasalalauga"]);

  // Build date strings when both day and year are present
  const buildDate = (day, year) => {
    if (!day && !year) return "";
    if (year && String(year).trim() && day && String(day).trim()) {
      return `${String(year).trim()}-01-01`; // approximate — year only
    }
    return parseDate(day || year);
  };

  return {
    mataiTitle:       g(["suafamatai","SuafaMatai","mataititle","mataiTitle","title"]),
    holderName:       g(["IgoaTaulealea","igoataulealea","holdername","holderName","name","suafataulealea"]),
    gender:           g(["TaneTamaitai","tanetamaitai","gender","itulagi"]),
    mataiType:        g(["ItuaigaSuafa","ituaigasuafa","mataitype","mataiType","type","ituaigaosuafa"]),
    familyName:       g(["familyname","familyName","aiga"]),
    village:          g(["NuuePatinoiailesuafaMatai","nuuepatinoiailesuafamatai","NuuePatinoiailesuafa","village","nuu","nu'u","NuuoloomataiNuuoloomatai"]),
    district:         g(["district","itumaalo","itumalo"]),
    dateConferred:    buildDate(dayOfSaofai, yearOfSaofai) || parseDate(g(["dateconferred","dateConferred","asoosaofai"])),
    dateProclamation: parseDate(dayOfProclaim) || parseDate(g(["dateproclamation","dateProclamation"])),
    dateRegistration: buildDate(dayOfReg, yearOfReg) || parseDate(g(["dateregistration","dateRegistration"])),
    dateIssued:       parseDate(g(["dateissued","dateIssued","issued"])),
    mataiCertNumber:  g(["NumeraoleLaupepa","numeraolelaupepa","RegistryBookNumbers","registrybooknumbers","mataiCertNumber","refnumber","refNumber"]),
    faapogai:         g(["Faapogai","faapogai"]),
    notes:            g(["IsiFaamatalaga","isifaamatalaga","notes","faamatalaga","remarks","isiFaamatalaga"]),
  };
}

const PREVIEW_COLS = [
  { key:"mataiTitle",      label:"Matai Title" },
  { key:"holderName",      label:"Holder Name" },
  { key:"gender",          label:"Gender" },
  { key:"mataiType",       label:"Type" },
  { key:"village",         label:"Nu'u" },
  { key:"district",        label:"District" },
  { key:"dateConferred",   label:"Conferral" },
  { key:"dateRegistration",label:"Registration" },
  { key:"mataiCertNumber", label:"Cert No." },
];

export default function Import({ userRole }) {
  const [file, setFile]         = useState(null);
  const [preview, setPreview]   = useState([]);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [done, setDone]         = useState(0);
  const [errors, setErrors]     = useState([]);
  const [step, setStep]         = useState("upload");
  const perms = getPermissions(userRole);
  const user  = auth.currentUser;

  if (!perms.canAdd) return <Navigate to="/dashboard" />;

  const processRows = (rows) => {
    const mapped = rows.map(mapRow);
    setPreview(mapped);
    setStep("preview");
  };

  const handleFile = async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    setFile(f); setErrors([]);
    const ext = f.name.split(".").pop().toLowerCase();
    if (ext === "csv") {
      const text = await f.text();
      processRows(parseCSV(text));
    } else if (ext === "xlsx" || ext === "xls") {
      const script = document.createElement("script");
      script.src = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
      script.onload = async () => {
        const buf = await f.arrayBuffer();
        const wb  = window.XLSX.read(buf, { type:"array" });
        const ws  = wb.Sheets[wb.SheetNames[0]];
        const rows = window.XLSX.utils.sheet_to_json(ws, { defval:"", raw:true });
        processRows(rows);
      };
      if (!window.XLSX) document.head.appendChild(script);
      else {
        const buf  = await f.arrayBuffer();
        const wb   = window.XLSX.read(buf, { type:"array" });
        const ws   = wb.Sheets[wb.SheetNames[0]];
        const rows = window.XLSX.utils.sheet_to_json(ws, { defval:"", raw:true });
        processRows(rows);
      }
    } else {
      setErrors(["Unsupported file type. Please upload .csv, .xlsx or .xls"]);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f) handleFile({ target: { files: [f] } });
  };

  const handleImport = async () => {
    setImporting(true); setProgress(0); setDone(0);
    const errs = [];
    let count = 0;
    const valid = preview.filter(r => r.mataiTitle);
    for (let i = 0; i < valid.length; i++) {
      try {
        await addDoc(collection(db, "registrations"), { ...valid[i], createdAt: serverTimestamp() });
        count++;
      } catch (err) {
        errs.push(`Row ${i+1} (${valid[i].mataiTitle}): ${err.message}`);
      }
      setProgress(Math.round(((i+1) / valid.length) * 100));
    }
    await logAudit("IMPORT", { count, file: file?.name, skipped: preview.length - valid.length });
    setDone(count); setErrors(errs); setImporting(false); setStep("done");
  };

  const reset = () => {
    setFile(null); setPreview([]); setProgress(0);
    setDone(0); setErrors([]); setStep("upload");
  };

  const validCount   = preview.filter(r => r.mataiTitle).length;
  const skippedCount = preview.length - validCount;

  return (
    <div className="app-layout">
      <div className="pattern-bg" />
      <Sidebar userRole={userRole} userEmail={user?.email} />
      <div className="sidebar-content">

        {/* Header */}
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:"2rem" }}>
          <div>
            <p className="page-eyebrow">Data Management</p>
            <h1 className="page-title">Import Records</h1>
          </div>
          {step !== "upload" && (
            <button className="btn-secondary" onClick={reset}>← Start Over</button>
          )}
        </div>

        {errors.length > 0 && errors.slice(0,3).map((e,i) => (
          <div key={i} className="alert alert-error" style={{ marginBottom:"0.5rem" }}>{e}</div>
        ))}

        {/* ── STEP: UPLOAD ── */}
        {step === "upload" && (
          <div style={{ display:"grid", gridTemplateColumns:"1fr 320px", gap:"1.5rem", alignItems:"start" }}>

            {/* Drop zone */}
            <div
              onDragOver={e => e.preventDefault()}
              onDrop={handleDrop}
              style={{ background:"#fff", border:"2px dashed #a7c9b2", borderRadius:"8px", padding:"4rem 2rem", textAlign:"center", cursor:"pointer", transition:"border-color 0.2s, background 0.2s" }}
              onMouseEnter={e => e.currentTarget.style.borderColor="#155c31"}
              onMouseLeave={e => e.currentTarget.style.borderColor="#a7c9b2"}
            >
              <div style={{ fontSize:"3rem", marginBottom:"1rem" }}>📂</div>
              <p style={{ fontFamily:"'Cinzel',serif", fontSize:"0.82rem", color:"#155c31", letterSpacing:"0.15em", textTransform:"uppercase", marginBottom:"0.5rem" }}>
                Drag & Drop File Here
              </p>
              <p style={{ color:"#6b7280", fontSize:"0.85rem", marginBottom:"2rem" }}>
                Supports .csv, .xlsx, .xls
              </p>
              <input type="file" accept=".csv,.xlsx,.xls" onChange={handleFile}
                style={{ display:"none" }} id="file-input" />
              <label htmlFor="file-input">
                <span className="btn-primary" style={{ cursor:"pointer", padding:"0.75rem 2.5rem", fontSize:"0.78rem" }}>
                  Choose File
                </span>
              </label>
            </div>

            {/* Column mapping guide */}
            <div className="card">
              <h3 className="section-head">◈ Column Mapping</h3>
              <p style={{ fontSize:"0.82rem", color:"#6b7280", marginBottom:"1.25rem", lineHeight:1.6 }}>
                The importer recognises both English and Samoan column headers from the registry book format.
              </p>
              <div style={{ display:"flex", flexDirection:"column", gap:"0.6rem" }}>
                {[
                  ["Suafa Matai",          "mataiTitle",       true],
                  ["Igoa Taulealea",        "holderName",       false],
                  ["Tane/Tamaitai",         "gender",           false],
                  ["Ituaiga Suafa",         "mataiType",        false],
                  ["Nu'u e Patino iai",     "village",          false],
                  ["Aso o le Saofai",       "dateConferred",    false],
                  ["Aso o le Faasalalauga", "dateProclamation", false],
                  ["Aso na Resitala ai",    "dateRegistration", false],
                  ["Numera ole Laupepa",    "mataiCertNumber",  false],
                  ["Faapogai",              "faapogai",         false],
                  ["Isi Faamatalaga",       "notes",            false],
                ].map(([samoan, field, required]) => (
                  <div key={field} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"0.35rem 0", borderBottom:"1px solid #f3f4f6" }}>
                    <span style={{ fontSize:"0.8rem", color:"#374151" }}>{samoan}{required && <span style={{ color:"#991b1b", marginLeft:"2px" }}>*</span>}</span>
                    <code style={{ background:"#e8f5ed", color:"#155c31", padding:"1px 7px", borderRadius:"3px", fontSize:"0.68rem", fontFamily:"monospace" }}>{field}</code>
                  </div>
                ))}
              </div>
              <p style={{ fontSize:"0.72rem", color:"#991b1b", marginTop:"0.75rem", fontStyle:"italic" }}>* Required — rows missing this will be skipped</p>
            </div>
          </div>
        )}

        {/* ── STEP: PREVIEW ── */}
        {step === "preview" && !importing && (
          <div>
            {/* Summary bar */}
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr auto", gap:"1rem", marginBottom:"1.5rem", alignItems:"center" }}>
              <div className="stat-card">
                <p style={{ fontFamily:"'Cinzel',serif", fontSize:"0.62rem", color:"#6b7280", letterSpacing:"0.15em", textTransform:"uppercase", marginBottom:"0.3rem" }}>Total Rows</p>
                <p style={{ fontFamily:"'Cinzel Decorative',serif", fontSize:"1.8rem", color:"#155c31" }}>{preview.length}</p>
              </div>
              <div className="stat-card">
                <p style={{ fontFamily:"'Cinzel',serif", fontSize:"0.62rem", color:"#6b7280", letterSpacing:"0.15em", textTransform:"uppercase", marginBottom:"0.3rem" }}>Will Import</p>
                <p style={{ fontFamily:"'Cinzel Decorative',serif", fontSize:"1.8rem", color:"#155c31" }}>{validCount}</p>
              </div>
              <div className="stat-card">
                <p style={{ fontFamily:"'Cinzel',serif", fontSize:"0.62rem", color:"#6b7280", letterSpacing:"0.15em", textTransform:"uppercase", marginBottom:"0.3rem" }}>Will Skip</p>
                <p style={{ fontFamily:"'Cinzel Decorative',serif", fontSize:"1.8rem", color: skippedCount > 0 ? "#991b1b" : "#6b7280" }}>{skippedCount}</p>
              </div>
              <div style={{ display:"flex", flexDirection:"column", gap:"0.5rem" }}>
                <button onClick={handleImport} className="btn-primary" style={{ fontSize:"0.78rem", whiteSpace:"nowrap" }}>
                  ↑ Import {validCount} Records
                </button>
                <button onClick={reset} className="btn-secondary" style={{ fontSize:"0.75rem" }}>Cancel</button>
              </div>
            </div>

            <p style={{ fontFamily:"'Cinzel',serif", fontSize:"0.68rem", color:"#6b7280", letterSpacing:"0.1em", marginBottom:"0.75rem" }}>
              File: <strong style={{ color:"#155c31" }}>{file?.name}</strong>
              {skippedCount > 0 && <span style={{ color:"#991b1b", marginLeft:"1rem" }}>⚠ {skippedCount} rows highlighted in red are missing Matai Title and will be skipped</span>}
            </p>

            {/* Preview table */}
            <div style={{ background:"#fff", border:"1px solid #d1d5db", borderRadius:"6px", overflow:"hidden", boxShadow:"0 1px 3px rgba(0,0,0,0.08)" }}>
              <div style={{ overflowX:"auto", maxHeight:"480px", overflowY:"auto" }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th style={{ background:"#155c31", color:"rgba(255,255,255,0.9)", padding:"0.75rem 0.8rem", fontFamily:"'Cinzel',serif", fontSize:"0.6rem", letterSpacing:"0.12em" }}>#</th>
                      {PREVIEW_COLS.map(c => (
                        <th key={c.key} style={{ background:"#155c31", color:"rgba(255,255,255,0.9)", padding:"0.75rem 0.8rem", fontFamily:"'Cinzel',serif", fontSize:"0.6rem", letterSpacing:"0.12em", textAlign:"left", whiteSpace:"nowrap" }}>{c.label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((row, i) => (
                      <tr key={i} style={{ background: !row.mataiTitle ? "#fef2f2" : i % 2 === 0 ? "#fff" : "#fafafa", borderBottom:"1px solid #e5e7eb" }}>
                        <td style={{ padding:"0.7rem 0.8rem", color:"#9ca3af", fontSize:"0.8rem" }}>{i+1}</td>
                        {PREVIEW_COLS.map(col => (
                          <td key={col.key} style={{ padding:"0.7rem 0.8rem", fontSize:"0.85rem", maxWidth:"160px", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap",
                            color: col.key === "mataiTitle" ? "#155c31" : !row.mataiTitle ? "#991b1b" : "#374151",
                            fontWeight: col.key === "mataiTitle" ? "700" : "normal" }}>
                            {row[col.key] || <span style={{ color:"#d1d5db" }}>—</span>}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ── STEP: IMPORTING PROGRESS ── */}
        {importing && (
          <div className="card" style={{ textAlign:"center", padding:"3rem" }}>
            <p style={{ fontFamily:"'Cinzel',serif", fontSize:"0.82rem", color:"#155c31", letterSpacing:"0.2em", textTransform:"uppercase", marginBottom:"1.5rem" }}>
              Importing Records…
            </p>
            <div style={{ background:"#e8f5ed", borderRadius:"4px", height:"10px", overflow:"hidden", marginBottom:"1rem", maxWidth:"400px", margin:"0 auto 1rem" }}>
              <div style={{ background:"#155c31", height:"100%", width:`${progress}%`, transition:"width 0.3s", borderRadius:"4px" }} />
            </div>
            <p style={{ fontFamily:"'Cinzel Decorative',serif", fontSize:"2rem", color:"#155c31" }}>{progress}%</p>
          </div>
        )}

        {/* ── STEP: DONE ── */}
        {step === "done" && !importing && (
          <div>
            <div className="card" style={{ textAlign:"center", padding:"3rem", marginBottom:"1.5rem", borderColor:"#a7c9b2" }}>
              <div style={{ fontSize:"3rem", marginBottom:"1rem" }}>✅</div>
              <p style={{ fontFamily:"'Cinzel Decorative',serif", fontSize:"2rem", color:"#155c31", marginBottom:"0.5rem" }}>{done}</p>
              <p style={{ fontFamily:"'Cinzel',serif", fontSize:"0.78rem", color:"#155c31", letterSpacing:"0.2em", textTransform:"uppercase" }}>
                Records Imported Successfully
              </p>
              {skippedCount > 0 && (
                <p style={{ marginTop:"0.75rem", fontSize:"0.85rem", color:"#991b1b" }}>
                  {skippedCount} rows were skipped (missing Matai Title)
                </p>
              )}
            </div>
            {errors.length > 0 && (
              <div className="card" style={{ marginBottom:"1.5rem", borderColor:"#fca5a5" }}>
                <h3 className="section-head" style={{ color:"#991b1b" }}>◈ {errors.length} Errors</h3>
                {errors.map((e,i) => (
                  <div key={i} className="alert alert-error" style={{ marginBottom:"0.4rem", fontSize:"0.82rem" }}>{e}</div>
                ))}
              </div>
            )}
            <div style={{ display:"flex", gap:"1rem" }}>
              <button onClick={reset} className="btn-primary" style={{ fontSize:"0.78rem" }}>Import Another File</button>
              <a href="#/dashboard"><button className="btn-secondary" style={{ fontSize:"0.78rem" }}>View Registry</button></a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

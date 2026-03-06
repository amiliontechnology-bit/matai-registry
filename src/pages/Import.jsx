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

// Normalise a key: lowercase, strip whitespace/newlines/special chars
const norm = (s) => String(s || "").toLowerCase().replace(/[\s\n\r_\-\/\.'']/g, "");

// Map a row from the Excel/CSV to Firestore fields
// Supports exact Samoan column headers from the Vaimauga registry book
function mapRow(row) {
  // Build a normalised lookup map once
  const lookup = {};
  for (const k of Object.keys(row)) {
    lookup[norm(k)] = row[k];
  }
  const g = (...keys) => {
    for (const k of keys) {
      const v = lookup[norm(k)];
      if (v !== undefined && v !== null && String(v).trim() !== "") return String(v).trim();
    }
    return "";
  };

  const parseDate = (val) => {
    if (!val) return "";
    if (typeof val === "number" && val > 1000) {
      // Excel serial date
      const d = new Date(Math.round((val - 25569) * 86400 * 1000));
      return d.toISOString().split("T")[0];
    }
    const s = String(val).trim();
    const dmy = s.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/);
    if (dmy) return `${dmy[3]}-${dmy[2].padStart(2,"0")}-${dmy[1].padStart(2,"0")}`;
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
    // Year only
    if (/^\d{4}$/.test(s)) return `${s}-01-01`;
    return s;
  };

  // For columns that are split across day + year columns in the registry book
  const makeDate = (dayVal, yearVal) => {
    const d = String(dayVal || "").trim();
    const y = String(yearVal || "").trim();
    if (!d && !y) return "";
    if (y && /^\d{4}$/.test(y)) return parseDate(y); // year only → first of year
    return parseDate(d || y);
  };

  return {
    // col 3: Suafa Matai → mataiTitle
    mataiTitle:       g("Suafa Matai", "suafamatai", "mataiTitle", "title"),

    // col 5: Igoa Taulealea → holderName
    holderName:       g("Igoa Taulealea", "igoataulealea", "holderName", "holder name", "name"),

    // col 6: Tane/Tamaitai → gender
    gender:           g("Tane/Tamaitai", "tanetamaitai", "gender"),

    // col 7: Ituaiga Suafa → mataiType
    mataiType:        g("Ituaiga Suafa", "ituaigasuafa", "mataiType", "type"),

    // col 4: Nuu e Patino iai le Suafa Matai → village
    village:          g("Nuu e Patino iai le \nSuafa Matai", "NuuePatinoiailesuafaMatai", "NuuePatinoiailesuafa", "village", "nuu"),

    // No district column in this file — leave blank
    district:         g("district", "itumaalo", "itumalo"),

    // col 8+9: Aso o le Saofai + Tausaga o le Saofai → dateConferred
    dateConferred:    makeDate(
                        g("Aso o le Saofai", "asoolesaofai"),
                        g("Tausaga o le Saofai", "tausagaolesaofai")
                      ),

    // col 10: Aso o le Faasalalauga → dateProclamation
    dateProclamation: parseDate(g("Aso o le \nFaasalalauga", "Aso o le Faasalalauga", "asoolefaasalalauga", "dateProclamation")),

    // col 11+12: Aso na Resitala ai + Tausaga o le Resitala → dateRegistration
    dateRegistration: makeDate(
                        g("Aso na \nResitala ai", "Aso na Resitala ai", "asonaresitalaai"),
                        g("Tausaga o  le Resitala", "Tausaga o le Resitala", "tausagaoleresitala")
                      ),

    dateIssued:       parseDate(g("dateIssued", "date issued")),

    // col 1: Numera ole Laupepa → mataiCertNumber
    mataiCertNumber:  g("Numera ole Laupepa", "numeraolelaupepa", "mataiCertNumber"),

    // col 2: Registry Book Numbers → refNumber (secondary)
    refNumber:        g("Registry Book Numbers", "registrybooknumbers", "refNumber"),

    // col 15: Faapogai → faapogai
    faapogai:         g("Faapogai", "faapogai"),

    // col 18: Isi Faamatalaga → notes
    notes:            g("Isi Faamatalaga", "isifaamatalaga", "notes", "faamatalaga"),

    // col 16: Isi Suafa Matai → familyName (other title = family reference)
    familyName:       g("Isi Suafa Matai", "isisuafamatai", "familyName"),
  };
}

// Columns shown in the preview table
const PREVIEW_COLS = [
  { key:"mataiTitle",       label:"Suafa Matai",     required: true },
  { key:"holderName",       label:"Igoa Taulealea",  required: false },
  { key:"gender",           label:"Tane/Tamaitai",   required: false },
  { key:"mataiType",        label:"Ituaiga Suafa",   required: false },
  { key:"village",          label:"Nu'u",            required: false },
  { key:"dateConferred",    label:"Aso Saofai",      required: false },
  { key:"dateRegistration", label:"Aso Resitala",    required: false },
  { key:"mataiCertNumber",  label:"Numera",          required: false },
  { key:"faapogai",         label:"Faapogai",        required: false },
];

export default function Import({ userRole }) {
  const [file, setFile]         = useState(null);
  const [preview, setPreview]   = useState([]);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [done, setDone]         = useState(0);
  const [errors, setErrors]     = useState([]);
  const [step, setStep]         = useState("upload");
  const [dragOver, setDragOver] = useState(false);
  const perms = getPermissions(userRole);
  const user  = auth.currentUser;

  if (!perms.canAdd) return <Navigate to="/dashboard" />;

  const processRows = (rows) => {
    const mapped = rows.map(mapRow);
    setPreview(mapped);
    setStep("preview");
  };

  const handleFile = async (f) => {
    if (!f) return;
    setFile(f); setErrors([]);
    const ext = f.name.split(".").pop().toLowerCase();

    if (ext === "csv") {
      const text = await f.text();
      processRows(parseCSV(text));
    } else if (ext === "xlsx" || ext === "xls") {
      const loadAndProcess = async () => {
        const buf  = await f.arrayBuffer();
        const wb   = window.XLSX.read(buf, { type:"array", cellDates: false });
        const ws   = wb.Sheets[wb.SheetNames[0]];
        const rows = window.XLSX.utils.sheet_to_json(ws, { defval:"", raw: true });
        processRows(rows);
      };
      if (window.XLSX) {
        loadAndProcess();
      } else {
        const script = document.createElement("script");
        script.src = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
        script.onload = loadAndProcess;
        document.head.appendChild(script);
      }
    } else {
      setErrors(["Unsupported file type. Please upload .csv, .xlsx or .xls"]);
    }
  };

  const handleInputChange = (e) => handleFile(e.target.files[0]);

  const handleDrop = (e) => {
    e.preventDefault(); setDragOver(false);
    handleFile(e.dataTransfer.files[0]);
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

  // ── Shared styles using the same variables as the rest of the app ──
  const thStyle = {
    background: "#155c31", color: "rgba(255,255,255,0.92)",
    padding: "0.75rem 1rem", fontFamily: "'Cinzel',serif",
    fontSize: "0.62rem", letterSpacing: "0.15em",
    textTransform: "uppercase", textAlign: "left", whiteSpace: "nowrap",
  };

  return (
    <div className="app-layout">
      <div className="pattern-bg" />
      <Sidebar userRole={userRole} userEmail={user?.email} />
      <div className="sidebar-content">

        {/* ── Header ── */}
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:"2rem" }}>
          <div>
            <p className="page-eyebrow">Data Management</p>
            <h1 className="page-title">Import Records</h1>
          </div>
          {step !== "upload" && (
            <button className="btn-secondary" onClick={reset}>← Start Over</button>
          )}
        </div>

        {/* ── UPLOAD STEP ── */}
        {step === "upload" && (
          <div style={{ display:"grid", gridTemplateColumns:"1fr 340px", gap:"1.5rem", alignItems:"start" }}>

            {/* Drop zone */}
            <div
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              style={{
                background: dragOver ? "#e8f5ed" : "#fff",
                border: `2px dashed ${dragOver ? "#155c31" : "#a7c9b2"}`,
                borderRadius: "8px", padding: "4rem 2rem", textAlign: "center",
                transition: "all 0.2s", cursor: "pointer",
              }}
            >
              <div style={{ fontSize:"3rem", marginBottom:"1.25rem" }}>📂</div>
              <p style={{ fontFamily:"'Cinzel',serif", fontSize:"0.85rem", color:"#155c31", letterSpacing:"0.15em", textTransform:"uppercase", marginBottom:"0.5rem" }}>
                Drag & Drop File Here
              </p>
              <p style={{ color:"#6b7280", fontSize:"0.88rem", marginBottom:"2rem" }}>
                Supports .csv, .xlsx, .xls
              </p>
              <input type="file" accept=".csv,.xlsx,.xls" onChange={handleInputChange}
                style={{ display:"none" }} id="file-input" />
              <label htmlFor="file-input">
                <span className="btn-primary" style={{ cursor:"pointer", padding:"0.75rem 2.5rem", fontSize:"0.8rem" }}>
                  Choose File
                </span>
              </label>
              {errors.map((e,i) => (
                <div key={i} className="alert alert-error" style={{ marginTop:"1rem", textAlign:"left" }}>{e}</div>
              ))}
            </div>

            {/* Column guide */}
            <div className="card">
              <h3 className="section-head">◈ Column Mapping</h3>
              <p style={{ fontSize:"0.83rem", color:"#374151", marginBottom:"1.25rem", lineHeight:1.6 }}>
                The importer maps these Excel columns to the registry fields:
              </p>
              <div style={{ display:"flex", flexDirection:"column", gap:"0" }}>
                {[
                  ["Suafa Matai",              "Matai Title",         true],
                  ["Igoa Taulealea",            "Holder Name",         false],
                  ["Tane/Tamaitai",             "Gender",              false],
                  ["Ituaiga Suafa",             "Title Type",          false],
                  ["Nuu e Patino iai…",         "Village",             false],
                  ["Aso o le Saofai",           "Date of Conferral",   false],
                  ["Aso o le Faasalalauga",     "Date Proclamation",   false],
                  ["Aso na Resitala ai",        "Date Registration",   false],
                  ["Numera ole Laupepa",        "Cert Number",         false],
                  ["Faapogai",                  "Faapogai",            false],
                  ["Isi Faamatalaga",           "Notes",               false],
                ].map(([excel, field, req]) => (
                  <div key={field} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"0.45rem 0", borderBottom:"1px solid #f3f4f6" }}>
                    <span style={{ fontSize:"0.8rem", color:"#111827", fontWeight: req ? "600" : "normal" }}>
                      {excel}{req && <span style={{ color:"#991b1b", marginLeft:"2px" }}>*</span>}
                    </span>
                    <span style={{ fontSize:"0.75rem", color:"#6b7280", fontStyle:"italic" }}>{field}</span>
                  </div>
                ))}
              </div>
              <p style={{ fontSize:"0.72rem", color:"#991b1b", marginTop:"0.75rem" }}>* Required — rows missing this will be skipped</p>
            </div>
          </div>
        )}

        {/* ── PREVIEW STEP ── */}
        {step === "preview" && !importing && (
          <div>
            {/* Stats bar */}
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

            <p style={{ fontFamily:"'Cinzel',serif", fontSize:"0.68rem", color:"#374151", letterSpacing:"0.1em", marginBottom:"0.85rem" }}>
              File: <strong style={{ color:"#155c31" }}>{file?.name}</strong>
              {skippedCount > 0 && <span style={{ color:"#991b1b", marginLeft:"1rem" }}>⚠ {skippedCount} rows missing Matai Title will be skipped</span>}
            </p>

            {/* Preview table */}
            <div style={{ background:"#fff", border:"1px solid #d1d5db", borderRadius:"6px", overflow:"hidden", boxShadow:"0 1px 3px rgba(0,0,0,0.08)" }}>
              <div style={{ overflowX:"auto", maxHeight:"500px", overflowY:"auto" }}>
                <table style={{ width:"100%", borderCollapse:"collapse" }}>
                  <thead style={{ position:"sticky", top:0, zIndex:1 }}>
                    <tr>
                      <th style={{ ...thStyle, width:"40px" }}>#</th>
                      {PREVIEW_COLS.map(col => <th key={col.key} style={thStyle}>{col.label}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((row, i) => (
                      <tr key={i} style={{ background: !row.mataiTitle ? "#fef2f2" : i % 2 === 0 ? "#fff" : "#fafafa", borderBottom:"1px solid #e5e7eb" }}>
                        <td style={{ padding:"0.7rem 1rem", color:"#9ca3af", fontSize:"0.8rem" }}>{i+1}</td>
                        {PREVIEW_COLS.map(col => (
                          <td key={col.key} style={{
                            padding:"0.7rem 1rem", fontSize:"0.87rem",
                            maxWidth:"150px", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap",
                            color: col.key === "mataiTitle" ? "#155c31" : !row.mataiTitle ? "#991b1b" : "#111827",
                            fontWeight: col.key === "mataiTitle" ? "700" : "normal",
                          }}>
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

        {/* ── PROGRESS ── */}
        {importing && (
          <div className="card" style={{ textAlign:"center", padding:"3rem" }}>
            <p style={{ fontFamily:"'Cinzel',serif", fontSize:"0.82rem", color:"#155c31", letterSpacing:"0.2em", textTransform:"uppercase", marginBottom:"1.5rem" }}>
              Importing Records…
            </p>
            <div style={{ background:"#e8f5ed", borderRadius:"4px", height:"10px", overflow:"hidden", maxWidth:"400px", margin:"0 auto 1rem" }}>
              <div style={{ background:"#155c31", height:"100%", width:`${progress}%`, transition:"width 0.3s", borderRadius:"4px" }} />
            </div>
            <p style={{ fontFamily:"'Cinzel Decorative',serif", fontSize:"2rem", color:"#155c31" }}>{progress}%</p>
          </div>
        )}

        {/* ── DONE ── */}
        {step === "done" && !importing && (
          <div>
            <div className="card" style={{ textAlign:"center", padding:"3rem", marginBottom:"1.5rem", borderColor:"#a7c9b2" }}>
              <div style={{ fontSize:"3rem", marginBottom:"1rem" }}>✅</div>
              <p style={{ fontFamily:"'Cinzel Decorative',serif", fontSize:"2.5rem", color:"#155c31", marginBottom:"0.25rem" }}>{done}</p>
              <p style={{ fontFamily:"'Cinzel',serif", fontSize:"0.78rem", color:"#155c31", letterSpacing:"0.2em", textTransform:"uppercase" }}>
                Records Imported Successfully
              </p>
              {skippedCount > 0 && (
                <p style={{ marginTop:"0.75rem", fontSize:"0.88rem", color:"#991b1b" }}>
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
              <a href="#/dashboard"><button className="btn-secondary" style={{ fontSize:"0.78rem" }}>← View Registry</button></a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

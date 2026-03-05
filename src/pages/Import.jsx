import { useState } from "react";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../firebase";
import { logAudit } from "../utils/audit";
import { getPermissions } from "../utils/roles";
import Sidebar from "../components/Sidebar";
import { Navigate } from "react-router-dom";

// Parse CSV text into array of objects
function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map(h => h.trim().replace(/^"|"$/g, ""));
  return lines.slice(1).map(line => {
    // Handle quoted commas
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

// Map CSV/Excel row to Firestore fields
function mapRow(row) {
  // Support multiple possible column name formats
  const g = (keys) => {
    for (const k of keys) {
      const found = Object.keys(row).find(rk => rk.toLowerCase().replace(/[\s_]/g,"") === k.toLowerCase().replace(/[\s_]/g,""));
      if (found && row[found]) return row[found];
    }
    return "";
  };
  return {
    mataiTitle:       g(["mataititle","suafamatai","title","matai_title"]),
    holderName:       g(["holdername","suafataulealea","untitledname","name","holder_name"]),
    gender:           g(["gender","itulagi"]),
    mataiType:        g(["mataitype","titletype","type","matai_type"]),
    familyName:       g(["familyname","aiga","family","family_name"]),
    village:          g(["village","nuu","nu'u"]),
    district:         g(["district","itumaalo","itumalo"]),
    dateConferred:    g(["dateconferred","asoosaofai","conferred","date_conferred"]),
    dateProclamation: g(["dateproclamation","asofaasalalau","proclamation","date_proclamation"]),
    dateRegistration: g(["dateregistration","registration","date_registration"]),
    dateIssued:       g(["dateissued","issued","date_issued"]),
    refNumber:        g(["refnumber","referencenumber","ref","ref_number"]),
    registrarName:    g(["registrarname","registrar","registrar_name"]),
    notes:            g(["notes","faamatalaga","remarks"]),
  };
}

export default function Import({ userRole }) {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState([]);
  const [headers, setHeaders] = useState([]);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [done, setDone] = useState(0);
  const [errors, setErrors] = useState([]);
  const [step, setStep] = useState("upload"); // upload | preview | done
  const perms = getPermissions(userRole);
  const user = auth.currentUser;

  if (!perms.canAdd) return <Navigate to="/dashboard" />;

  const handleFile = async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    setFile(f);
    setErrors([]);

    const ext = f.name.split(".").pop().toLowerCase();
    if (ext === "csv") {
      const text = await f.text();
      const rows = parseCSV(text);
      const mapped = rows.map(mapRow);
      setHeaders(rows.length > 0 ? Object.keys(rows[0]) : []);
      setPreview(mapped);
      setStep("preview");
    } else if (ext === "xlsx" || ext === "xls") {
      // Use SheetJS via CDN
      const script = document.createElement("script");
      script.src = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
      script.onload = async () => {
        const buf = await f.arrayBuffer();
        const wb = window.XLSX.read(buf, { type:"array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = window.XLSX.utils.sheet_to_json(ws, { defval:"" });
        const mapped = rows.map(mapRow);
        setHeaders(rows.length > 0 ? Object.keys(rows[0]) : []);
        setPreview(mapped);
        setStep("preview");
      };
      document.head.appendChild(script);
    } else {
      setErrors(["Unsupported file type. Please upload a .csv, .xlsx or .xls file."]);
    }
  };

  const handleImport = async () => {
    setImporting(true);
    setProgress(0);
    setDone(0);
    const errs = [];
    let count = 0;

    for (let i = 0; i < preview.length; i++) {
      const row = preview[i];
      if (!row.mataiTitle) { errs.push(`Row ${i+1}: Missing Matai Title — skipped.`); continue; }
      try {
        await addDoc(collection(db, "registrations"), { ...row, createdAt: serverTimestamp() });
        count++;
      } catch (err) {
        errs.push(`Row ${i+1}: ${err.message}`);
      }
      setProgress(Math.round(((i+1) / preview.length) * 100));
    }

    await logAudit("IMPORT", { count, file: file?.name });
    setDone(count);
    setErrors(errs);
    setImporting(false);
    setStep("done");
  };

  const reset = () => {
    setFile(null); setPreview([]); setHeaders([]);
    setProgress(0); setDone(0); setErrors([]);
    setStep("upload");
  };

  const th = { padding:"0.7rem 0.8rem", fontFamily:"'Cinzel',serif", fontSize:"0.6rem", letterSpacing:"0.12em", textTransform:"uppercase", color:"rgba(201,168,76,0.7)", textAlign:"left", whiteSpace:"nowrap" };
  const td = { padding:"0.7rem 0.8rem", fontSize:"0.82rem", borderBottom:"1px solid rgba(201,168,76,0.07)", maxWidth:"160px", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" };

  return (
    <div className="app-layout">
      <div className="pattern-bg" />
      <Sidebar userRole={userRole} userEmail={user?.email} />
      <div className="sidebar-content">
        <div style={{ marginBottom:"2rem" }}>
          <p style={{ fontFamily:"'Cinzel',serif", fontSize:"0.7rem", letterSpacing:"0.25em", color:"rgba(201,168,76,0.6)", textTransform:"uppercase", marginBottom:"0.4rem" }}>Data Management</p>
          <h1 style={{ fontFamily:"'Cinzel Decorative',serif", fontSize:"1.8rem", color:"#f5ede0" }}>Import Records</h1>
        </div>

        {/* Step: Upload */}
        {step === "upload" && (
          <div>
            <div style={{ background:"rgba(255,255,255,0.03)", border:"2px dashed rgba(201,168,76,0.3)", borderRadius:"4px", padding:"3rem", textAlign:"center", marginBottom:"2rem" }}>
              <p style={{ fontSize:"2rem", marginBottom:"1rem" }}>📂</p>
              <p style={{ fontFamily:"'Cinzel',serif", fontSize:"0.8rem", color:"rgba(201,168,76,0.8)", letterSpacing:"0.15em", textTransform:"uppercase", marginBottom:"0.5rem" }}>
                Upload CSV or Excel File
              </p>
              <p style={{ color:"rgba(245,237,224,0.4)", fontSize:"0.85rem", marginBottom:"1.5rem" }}>
                Supports .csv, .xlsx, .xls
              </p>
              <input type="file" accept=".csv,.xlsx,.xls" onChange={handleFile} style={{ display:"none" }} id="file-input" />
              <label htmlFor="file-input">
                <span className="btn-primary" style={{ cursor:"pointer", padding:"0.75rem 2rem", fontSize:"0.78rem" }}>
                  Choose File
                </span>
              </label>
            </div>

            {errors.length > 0 && errors.map((e,i) => (
              <div key={i} className="alert alert-error" style={{ marginBottom:"0.5rem" }}>{e}</div>
            ))}

            {/* CSV Format Guide */}
            <div style={{ background:"rgba(255,255,255,0.02)", border:"1px solid rgba(201,168,76,0.15)", borderRadius:"4px", padding:"1.5rem" }}>
              <p style={{ fontFamily:"'Cinzel',serif", fontSize:"0.68rem", letterSpacing:"0.15em", color:"rgba(201,168,76,0.6)", textTransform:"uppercase", marginBottom:"1rem" }}>◈ Expected Column Names</p>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(200px,1fr))", gap:"0.5rem" }}>
                {[
                  ["mataiTitle","Matai Title (required)"],
                  ["holderName","Holder Name"],
                  ["gender","Gender"],
                  ["mataiType","Title Type"],
                  ["familyName","Family Name"],
                  ["village","Village"],
                  ["district","District"],
                  ["dateConferred","Date Conferred"],
                  ["dateProclamation","Date Proclamation"],
                  ["dateRegistration","Date Registration"],
                  ["dateIssued","Date Issued"],
                  ["refNumber","Reference Number"],
                  ["registrarName","Registrar Name"],
                  ["notes","Notes"],
                ].map(([field, label]) => (
                  <div key={field} style={{ display:"flex", gap:"0.5rem", alignItems:"center" }}>
                    <code style={{ background:"rgba(201,168,76,0.1)", color:"#c9a84c", padding:"1px 6px", borderRadius:"2px", fontSize:"0.72rem" }}>{field}</code>
                    <span style={{ fontSize:"0.78rem", opacity:0.6 }}>{label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Step: Preview */}
        {step === "preview" && (
          <div>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"1rem" }}>
              <p style={{ fontFamily:"'Cinzel',serif", fontSize:"0.72rem", color:"rgba(201,168,76,0.6)", letterSpacing:"0.15em", textTransform:"uppercase" }}>
                Preview — {preview.length} rows from <span style={{ color:"#c9a84c" }}>{file?.name}</span>
              </p>
              <div style={{ display:"flex", gap:"0.75rem" }}>
                <button onClick={reset} style={{ background:"transparent", border:"1px solid rgba(201,168,76,0.3)", color:"rgba(245,237,224,0.5)", padding:"0.5rem 1rem", fontFamily:"'Cinzel',serif", fontSize:"0.68rem", letterSpacing:"0.1em", textTransform:"uppercase", borderRadius:"2px", cursor:"pointer" }}>
                  Cancel
                </button>
                <button onClick={handleImport} className="btn-primary" style={{ fontSize:"0.78rem" }}>
                  Import {preview.length} Records
                </button>
              </div>
            </div>

            <div style={{ overflowX:"auto", background:"rgba(255,255,255,0.02)", border:"1px solid rgba(201,168,76,0.15)", borderRadius:"4px", maxHeight:"500px", overflowY:"auto" }}>
              <table style={{ width:"100%", borderCollapse:"collapse" }}>
                <thead style={{ position:"sticky", top:0, background:"#111" }}>
                  <tr style={{ borderBottom:"1px solid rgba(201,168,76,0.2)", background:"rgba(201,168,76,0.05)" }}>
                    <th style={th}>#</th>
                    {["mataiTitle","holderName","gender","mataiType","village","district","dateRegistration","refNumber"].map(h => (
                      <th key={h} style={th}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.map((row, i) => (
                    <tr key={i} style={{ background: !row.mataiTitle ? "rgba(139,26,26,0.1)" : "transparent" }}>
                      <td style={{ ...td, opacity:0.4 }}>{i+1}</td>
                      {["mataiTitle","holderName","gender","mataiType","village","district","dateRegistration","refNumber"].map(h => (
                        <td key={h} style={{ ...td, color: h === "mataiTitle" ? "#c9a84c" : "inherit" }}>
                          {row[h] || <span style={{ opacity:0.3 }}>—</span>}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p style={{ fontSize:"0.78rem", color:"rgba(245,237,224,0.4)", marginTop:"0.75rem", fontStyle:"italic" }}>
              Rows highlighted in red are missing a Matai Title and will be skipped.
            </p>
          </div>
        )}

        {/* Step: Importing progress */}
        {importing && (
          <div style={{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(201,168,76,0.2)", borderRadius:"4px", padding:"2rem", textAlign:"center" }}>
            <p style={{ fontFamily:"'Cinzel',serif", fontSize:"0.78rem", color:"#c9a84c", letterSpacing:"0.15em", textTransform:"uppercase", marginBottom:"1rem" }}>Importing…</p>
            <div style={{ background:"rgba(255,255,255,0.05)", borderRadius:"2px", height:"8px", overflow:"hidden", marginBottom:"0.75rem" }}>
              <div style={{ background:"linear-gradient(90deg,#8b6914,#c9a84c)", height:"100%", width:`${progress}%`, transition:"width 0.2s" }} />
            </div>
            <p style={{ color:"rgba(245,237,224,0.5)", fontSize:"0.85rem" }}>{progress}%</p>
          </div>
        )}

        {/* Step: Done */}
        {step === "done" && !importing && (
          <div>
            <div style={{ background:"rgba(26,74,74,0.15)", border:"1px solid rgba(26,74,74,0.4)", borderRadius:"4px", padding:"2rem", textAlign:"center", marginBottom:"1.5rem" }}>
              <p style={{ fontSize:"2rem", marginBottom:"0.75rem" }}>✅</p>
              <p style={{ fontFamily:"'Cinzel',serif", fontSize:"0.9rem", color:"#7dd3c8", letterSpacing:"0.15em", textTransform:"uppercase" }}>
                {done} records imported successfully
              </p>
            </div>
            {errors.length > 0 && (
              <div style={{ marginBottom:"1.5rem" }}>
                <p style={{ fontFamily:"'Cinzel',serif", fontSize:"0.68rem", color:"rgba(245,100,100,0.8)", letterSpacing:"0.15em", textTransform:"uppercase", marginBottom:"0.5rem" }}>
                  {errors.length} rows skipped
                </p>
                {errors.map((e,i) => <div key={i} className="alert alert-error" style={{ marginBottom:"0.4rem", fontSize:"0.82rem" }}>{e}</div>)}
              </div>
            )}
            <button onClick={reset} className="btn-primary" style={{ fontSize:"0.78rem" }}>Import Another File</button>
          </div>
        )}
      </div>
    </div>
  );
}

import { useState, useEffect } from "react";
import { collection, getDocs } from "firebase/firestore";
import { auth, db } from "../firebase";
import { getPermissions } from "../utils/roles";
import { logAudit } from "../utils/audit";
import { cacheClear } from "../utils/cache";
import Sidebar from "../components/Sidebar";
import { Navigate } from "react-router-dom";

// ── Helpers ────────────────────────────────────────────────
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

const fmtDate = (str) => {
  if (!str) return "—";
  const parts = String(str).split("T")[0].split("-");
  if (parts.length === 3 && parts[0].length === 4)
    return `${parts[2].padStart(2,"0")}/${parts[1].padStart(2,"0")}/${parts[0]}`;
  const d = new Date(str);
  if (isNaN(d)) return str;
  return `${String(d.getDate()).padStart(2,"0")}/${String(d.getMonth()+1).padStart(2,"0")}/${d.getFullYear()}`;
};

function autoRegDate(proc) {
  if (!proc) return null;
  const p = new Date(proc + "T00:00:00");
  const target = new Date(p.getFullYear(), p.getMonth() + 4, 1);
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  const day = Math.min(29, lastDay);
  const reg = new Date(target.getFullYear(), target.getMonth(), day);
  return `${reg.getFullYear()}-${String(reg.getMonth()+1).padStart(2,"0")}-${String(reg.getDate()).padStart(2,"0")}`;
}

function effectiveRegDate(r) {
  if (r.dateRegistration) return r.dateRegistration;
  if (r.objection === "yes") return null;
  if (!r.dateProclamation) return null;
  const d = autoRegDate(r.dateProclamation);
  if (!d) return null;
  const reg = new Date(d + "T00:00:00");
  const today = new Date(); today.setHours(0,0,0,0);
  return reg <= today ? d : null;
}

function openPDF(title, html) {
  const win = window.open("", "_blank");
  win.document.write(html);
  win.document.close();
}

function reportHeader(title, subtitle, count, generatedBy) {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"/>
  <title>${title}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700&family=EB+Garamond:ital,wght@0,400;1,400&display=swap');
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:'EB Garamond',Georgia,serif;padding:1.5rem;color:#1a1208;background:#fff}
    .hdr{border-bottom:3px solid #1a5c35;padding-bottom:1rem;margin-bottom:1rem;display:flex;align-items:center;gap:1.2rem}
    .hdr img{width:65px;height:65px;object-fit:contain}
    .ministry{font-family:'Cinzel',serif;font-size:0.6rem;letter-spacing:0.12em;color:#1a5c35;text-transform:uppercase;margin-bottom:3px}
    .doc-title{font-family:'Cinzel',serif;font-size:1rem;font-weight:700;color:#1a5c35;letter-spacing:0.1em;text-transform:uppercase}
    .meta{display:flex;justify-content:space-between;font-size:0.75rem;color:#555;padding:0.4rem 0;border-bottom:1px solid #eee;margin-bottom:1.2rem}
    table{width:100%;border-collapse:collapse;font-size:0.8rem}
    th{background:#1a5c35;color:#fff;padding:0.45rem 0.65rem;text-align:left;font-family:'Cinzel',serif;font-size:0.6rem;letter-spacing:0.08em;text-transform:uppercase}
    td{padding:0.4rem 0.65rem;border-bottom:1px solid #ddd;vertical-align:top}
    tr:nth-child(even) td{background:#f5faf7}
    .footer{margin-top:1.2rem;text-align:center;font-size:0.65rem;color:#aaa;border-top:1px solid #eee;padding-top:0.6rem;font-family:'Cinzel',serif;letter-spacing:0.08em}
    @media print{@page{margin:1.2cm}body{padding:0}}
  </style></head><body>
  <div class="hdr">
    <img src="${window.location.origin}/matai-registry/emblem.png" alt="Emblem"/>
    <div>
      <div class="ministry">Matagaluega o Faamasinoga ma le Faafoeina o Tulaga Tau Faamasinoga</div>
      <div class="doc-title">${title}</div>
      <div style="font-size:0.78rem;color:#555;font-style:italic;margin-top:3px">${subtitle}</div>
    </div>
  </div>
  <div class="meta">
    <span>Generated: ${fmtDate(new Date().toISOString().split("T")[0])}</span>
    <span>By: ${generatedBy}</span>
    <span>Records: ${count}</span>
  </div>`;
}

// ── Component ──────────────────────────────────────────────
export default function Reports({ userRole }) {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("monthly");
  const [monthFilter, setMonthFilter] = useState(() => {
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,"0")}`;
  });
  const perms = getPermissions(userRole);
  const user  = auth.currentUser;

  if (!perms.canPrint) return <Navigate to="/dashboard" />;

  useEffect(() => {
    (async () => {
      try {
        cacheClear("registrations");
        const snap = await getDocs(collection(db, "registrations"));
        const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        data.sort((a,b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
        setRecords(data);
      } catch(err) { console.error(err); }
      finally { setLoading(false); }
    })();
  }, []);

  const genBy = user?.displayName || user?.email || "Admin";
  const now = new Date();
  const monthLabel = `${MONTHS[now.getMonth()]} ${now.getFullYear()}`;

  // ── Data cuts ──────────────────────────────────────────
  const registeredAll = records.filter(r => r.dateRegistration || r.status === "completed")
    .sort((a,b) => (b.dateRegistration||"").localeCompare(a.dateRegistration||""));

  const [filterYear, filterMonth] = monthFilter.split("-").map(Number);
  const registeredMonth = registeredAll.filter(r => {
    const d = r.dateRegistration;
    if (!d) return false;
    const parts = d.split("-");
    return parseInt(parts[0]) === filterYear && parseInt(parts[1]) === filterMonth;
  });

  const readyToRegister = records.filter(r => {
    if (r.objection === "yes" || r.status === "completed" || r.dateRegistration) return false;
    if (!r.dateProclamation) return false;
    return effectiveRegDate(r) !== null;
  });

  const newMataiRecords = records.filter(r => !r.dateProclamation && !r.dateRegistration && r.objection !== "yes");
  const objectionRecords = records.filter(r => r.objection === "yes");
  const alertRecords = records.filter(r => {
    if (r.objection === "yes" || r.dateRegistration || !r.dateProclamation) return false;
    if (effectiveRegDate(r)) return false;
    const days = Math.ceil((new Date(r.dateProclamation) - new Date()) / (1000*60*60*24));
    return days <= 120;
  });

  // ── PDF Generators ─────────────────────────────────────
  const printRegisteredMonth = () => {
    const label = `${MONTHS[filterMonth-1]} ${filterYear}`;
    const rows = registeredMonth.map((r,i) => `<tr>
      <td>${i+1}</td><td><strong>${r.mataiTitle||"—"}</strong></td>
      <td>${r.holderName||"—"}</td><td>${r.mataiType||"—"}</td>
      <td>${r.village||"—"}</td><td>${r.district||"—"}</td>
      <td>${fmtDate(r.dateProclamation)}</td>
      <td style="color:#1a5c35;font-weight:600">${fmtDate(r.dateRegistration)}</td>
    </tr>`).join("");
    const html = reportHeader(
      `Registered Matai — ${label}`,
      `All matai titles registered in ${label}`,
      registeredMonth.length, genBy)
      + `<table><thead><tr><th>#</th><th>Matai Title</th><th>Holder</th><th>Type</th><th>Village</th><th>District</th><th>Proclaimed</th><th>Registered</th></tr></thead><tbody>${rows}</tbody></table>
      <div class="footer">Samoa Matai Title Registry — Resitalaina o Matai — Confidential</div>
      <script>window.onload=()=>window.print();<\/script></body></html>`;
    openPDF("Registered Matai", html);
    logAudit("REPORT_PDF", { type:"registered_month", month: label });
  };

  const printRegisteredAll = () => {
    const rows = registeredAll.map((r,i) => `<tr>
      <td>${i+1}</td><td><strong>${r.mataiTitle||"—"}</strong></td>
      <td>${r.holderName||"—"}</td><td>${r.mataiType||"—"}</td>
      <td>${r.village||"—"}</td><td>${r.district||"—"}</td>
      <td>${fmtDate(r.dateProclamation)}</td>
      <td style="color:#1a5c35;font-weight:600">${fmtDate(r.dateRegistration)}</td>
    </tr>`).join("");
    const html = reportHeader(
      "All Registered Matai Titles",
      "Complete list of all registered matai titles",
      registeredAll.length, genBy)
      + `<table><thead><tr><th>#</th><th>Matai Title</th><th>Holder</th><th>Type</th><th>Village</th><th>District</th><th>Proclaimed</th><th>Registered</th></tr></thead><tbody>${rows}</tbody></table>
      <div class="footer">Samoa Matai Title Registry — Resitalaina o Matai — Confidential</div>
      <script>window.onload=()=>window.print();<\/script></body></html>`;
    openPDF("All Registered Matai", html);
    logAudit("REPORT_PDF", { type:"registered_all", count: registeredAll.length });
  };

  const printMonthlyFull = () => {
    const fmtSec = (title, color, headers, rows) => rows.length === 0 ? "" :
      `<h2 style="font-family:'Cinzel',serif;color:${color};font-size:0.9rem;margin:1.5rem 0 0.4rem;border-bottom:2px solid ${color};padding-bottom:4px;text-transform:uppercase;letter-spacing:0.1em">${title} (${rows.length})</h2>
      <table style="width:100%;border-collapse:collapse;font-size:0.78rem;margin-bottom:0.5rem">
        <thead><tr>${headers.map(h=>`<th style="background:${color};color:#fff;padding:5px 8px;text-align:left;font-family:'Cinzel',serif;font-size:0.6rem;letter-spacing:0.06em;text-transform:uppercase">${h}</th>`).join("")}</tr></thead>
        <tbody>${rows}</tbody>
      </table>`;

    const mkRow = (r,i,cols) => `<tr style="background:${i%2?"#f9f9f9":"#fff"}">${cols.map(c=>`<td style="padding:4px 8px;border-bottom:1px solid #eee">${c}</td>`).join("")}</tr>`;

    const newRows    = newMataiRecords.map((r,i)  => mkRow(r,i,[i+1,`<strong>${r.mataiTitle||"—"}</strong>`,r.holderName||"—",r.village||"—",r.district||"—",fmtDate(r.dateConferred)]));
    const readyRows  = readyToRegister.map((r,i)  => mkRow(r,i,[i+1,`<strong>${r.mataiTitle||"—"}</strong>`,r.holderName||"—",r.village||"—",r.district||"—",fmtDate(r.dateProclamation),`<span style="color:#1a5c35;font-weight:600">${fmtDate(effectiveRegDate(r))}</span>`]));
    const regRows    = registeredAll.map((r,i)    => mkRow(r,i,[i+1,`<strong>${r.mataiTitle||"—"}</strong>`,r.holderName||"—",r.village||"—",r.district||"—",fmtDate(r.dateProclamation),`<span style="color:#1a5c35;font-weight:600">${fmtDate(r.dateRegistration)}</span>`]));
    const objRows    = objectionRecords.map((r,i) => mkRow(r,i,[i+1,`<strong>${r.mataiTitle||"—"}</strong>`,r.holderName||"—",r.village||"—",r.district||"—",fmtDate(r.dateProclamation),`<span style="color:#8b1a1a">${fmtDate(r.objectionDate)}</span>`]));

    const html = reportHeader(
      `Monthly Report — ${monthLabel}`,
      `Summary of all matai title activity for ${monthLabel}`,
      records.length, genBy)
      + `<div style="display:flex;gap:1rem;margin-bottom:1.5rem;flex-wrap:wrap">
        ${[["Total Records",records.length,"#1a5c35"],["Registered",registeredAll.length,"#155c31"],["New Titles",newMataiRecords.length,"#7c3aed"],["Ready",readyToRegister.length,"#1e6b3c"],["Objections",objectionRecords.length,"#8b1a1a"]].map(([l,n,c])=>
        `<div style="border:1px solid ${c}30;border-radius:4px;padding:0.5rem 1rem;text-align:center;min-width:80px">
          <div style="font-size:1.6rem;font-weight:bold;color:${c}">${n}</div>
          <div style="font-size:0.6rem;text-transform:uppercase;color:${c};letter-spacing:0.05em;font-family:'Cinzel',serif">${l}</div>
        </div>`).join("")}
      </div>`
      + fmtSec("New Matai Titles","#7c3aed",["#","Title","Holder","Village","District","Conferred"],newRows)
      + fmtSec("Ready to Register","#1e6b3c",["#","Title","Holder","Village","District","Proclaimed","Reg. Date"],readyRows)
      + fmtSec("Registered Titles","#155c31",["#","Title","Holder","Village","District","Proclaimed","Registered"],regRows)
      + fmtSec("Active Objections","#8b1a1a",["#","Title","Holder","Village","District","Proclaimed","Objection Date"],objRows)
      + `<div class="footer">Samoa Matai Title Registry — Resitalaina o Matai — Confidential — ${monthLabel}</div>
      <script>window.onload=()=>window.print();<\/script></body></html>`;
    openPDF("Monthly Report", html);
    logAudit("REPORT_PDF", { type:"monthly_full", month: monthLabel });
  };

  const printProclamation = () => {
    const rows = alertRecords.map((r,i) => `<tr>
      <td>${i+1}</td><td><strong>${r.mataiTitle||"—"}</strong></td>
      <td>${r.holderName||"—"}</td><td>${r.village||"—"}</td><td>${r.district||"—"}</td>
      <td>${fmtDate(r.dateProclamation)}</td>
      <td style="color:#1a5c35">${fmtDate(autoRegDate(r.dateProclamation))}</td>
    </tr>`).join("");
    const html = reportHeader("Proclamation Alerts","Records within alert window — not yet registered",alertRecords.length,genBy)
      + `<table><thead><tr><th>#</th><th>Matai Title</th><th>Holder</th><th>Village</th><th>District</th><th>Proclaimed</th><th>Auto Reg. Date</th></tr></thead><tbody>${rows}</tbody></table>
      <div class="footer">Samoa Matai Title Registry — Resitalaina o Matai — Confidential</div>
      <script>window.onload=()=>window.print();<\/script></body></html>`;
    openPDF("Proclamation Alerts", html);
    logAudit("REPORT_PDF", { type:"proclamation", count: alertRecords.length });
  };

  const printReady = () => {
    const rows = readyToRegister.map((r,i) => `<tr>
      <td>${i+1}</td><td><strong>${r.mataiTitle||"—"}</strong></td>
      <td>${r.holderName||"—"}</td><td>${r.village||"—"}</td><td>${r.district||"—"}</td>
      <td>${fmtDate(r.dateProclamation)}</td>
      <td style="color:#1a5c35;font-weight:600">${fmtDate(effectiveRegDate(r))}</td>
    </tr>`).join("");
    const html = reportHeader(`Ready to Register — ${monthLabel}`,"4-month proclamation complete, no objection",readyToRegister.length,genBy)
      + `<table><thead><tr><th>#</th><th>Matai Title</th><th>Holder</th><th>Village</th><th>District</th><th>Proclaimed</th><th>Reg. Date</th></tr></thead><tbody>${rows}</tbody></table>
      <div class="footer">Samoa Matai Title Registry — Resitalaina o Matai — Confidential</div>
      <script>window.onload=()=>window.print();<\/script></body></html>`;
    openPDF("Ready to Register", html);
    logAudit("REPORT_PDF", { type:"ready", count: readyToRegister.length });
  };

  const printNewMatai = () => {
    const rows = newMataiRecords.map((r,i) => `<tr>
      <td>${i+1}</td><td><strong>${r.mataiTitle||"—"}</strong></td>
      <td>${r.holderName||"—"}</td><td>${r.mataiType||"—"}</td>
      <td>${r.village||"—"}</td><td>${r.district||"—"}</td>
      <td>${fmtDate(r.dateConferred)}</td>
    </tr>`).join("");
    const html = reportHeader("New Matai Titles","Entered but not yet proclaimed",newMataiRecords.length,genBy)
      + `<table><thead><tr><th>#</th><th>Matai Title</th><th>Holder</th><th>Type</th><th>Village</th><th>District</th><th>Date Conferred</th></tr></thead><tbody>${rows}</tbody></table>
      <div class="footer">Samoa Matai Title Registry — Resitalaina o Matai — Confidential</div>
      <script>window.onload=()=>window.print();<\/script></body></html>`;
    openPDF("New Matai Titles", html);
    logAudit("REPORT_PDF", { type:"new_matai", count: newMataiRecords.length });
  };

  const printObjections = () => {
    const rows = objectionRecords.map((r,i) => `<tr>
      <td>${i+1}</td><td><strong>${r.mataiTitle||"—"}</strong></td>
      <td>${r.holderName||"—"}</td><td>${r.village||"—"}</td><td>${r.district||"—"}</td>
      <td>${fmtDate(r.dateProclamation)}</td>
      <td style="color:#8b1a1a;font-weight:600">${fmtDate(r.objectionDate)}</td>
    </tr>`).join("");
    const html = reportHeader("Objections Report","Titles with active objections filed",objectionRecords.length,genBy)
      + `<table><thead><tr><th>#</th><th>Matai Title</th><th>Holder</th><th>Village</th><th>District</th><th>Proclaimed</th><th>Objection Date</th></tr></thead><tbody>${rows}</tbody></table>
      <div class="footer">Samoa Matai Title Registry — Resitalaina o Matai — Confidential</div>
      <script>window.onload=()=>window.print();<\/script></body></html>`;
    openPDF("Objections Report", html);
    logAudit("REPORT_PDF", { type:"objections", count: objectionRecords.length });
  };

  // ── Styles ─────────────────────────────────────────────
  const sStyle = { background:"#fff", border:"1px solid rgba(30,107,60,0.2)", borderRadius:"4px", padding:"1.5rem", marginBottom:"1rem", boxShadow:"0 1px 4px rgba(0,0,0,0.05)" };

  const TabBtn = ({ id, label, count, color="#1e6b3c" }) => (
    <button onClick={() => setActiveTab(id)} style={{
      padding:"0.55rem 1.1rem", fontFamily:"'Cinzel',serif", fontSize:"0.7rem",
      letterSpacing:"0.1em", textTransform:"uppercase", cursor:"pointer", borderRadius:"3px",
      border: activeTab===id ? `1px solid ${color}` : "1px solid rgba(30,107,60,0.2)",
      background: activeTab===id ? `${color}15` : "transparent",
      color: activeTab===id ? color : "rgba(26,26,26,0.5)",
      display:"flex", alignItems:"center", gap:"6px"
    }}>
      {label}
      {count !== undefined && <span style={{ background: activeTab===id ? color : "#e5e7eb", color: activeTab===id ? "#fff" : "#6b7280", borderRadius:"20px", padding:"1px 7px", fontSize:"0.62rem" }}>{count}</span>}
    </button>
  );

  const ReportCard = ({ title, desc, onClick, count, color="#1a5c35", disabled }) => (
    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"1rem 1.1rem", background:"#fafafa", border:"1px solid rgba(30,107,60,0.12)", borderRadius:"4px", marginBottom:"0.6rem" }}>
      <div>
        <p style={{ fontFamily:"'Cinzel',serif", fontSize:"0.8rem", color, fontWeight:600 }}>{title}</p>
        <p style={{ fontSize:"0.73rem", color:"rgba(26,26,26,0.5)", marginTop:"2px" }}>{desc}</p>
      </div>
      <button onClick={onClick} disabled={disabled || count === 0}
        style={{ fontSize:"0.68rem", padding:"0.4rem 1rem", fontFamily:"'Cinzel',serif", letterSpacing:"0.08em", textTransform:"uppercase",
          background: (disabled||count===0) ? "#f3f4f6" : `${color}15`,
          border:`1px solid ${(disabled||count===0) ? "#e5e7eb" : color}`,
          color:(disabled||count===0) ? "#9ca3af" : color,
          borderRadius:"3px", cursor:(disabled||count===0) ? "not-allowed" : "pointer", whiteSpace:"nowrap" }}>
        📄 Print ({count ?? "—"})
      </button>
    </div>
  );

  return (
    <div className="app-layout">
      <div className="pattern-bg" />
      <Sidebar userRole={userRole} userEmail={user?.email} />
      <div className="sidebar-content">

        <div style={{ marginBottom:"1.5rem" }}>
          <p className="page-eyebrow">Samoa Matai Title Registry</p>
          <h1 className="page-title">Reports</h1>
        </div>

        {/* Tabs */}
        <div style={{ display:"flex", gap:"0.5rem", marginBottom:"1.5rem", flexWrap:"wrap" }}>
          <TabBtn id="monthly"      label="Monthly Reports" />
          <TabBtn id="registered"   label="Registered Matai" count={registeredAll.length} color="#155c31" />
          <TabBtn id="other"        label="Other Reports" />
        </div>

        {/* ── Monthly Reports tab ── */}
        {activeTab === "monthly" && (
          <div style={{ display:"grid", gridTemplateColumns:"1fr 280px", gap:"1.5rem", alignItems:"start" }}>
            <div>
              <div style={sStyle}>
                <p style={{ fontFamily:"'Cinzel',serif", fontSize:"0.65rem", letterSpacing:"0.15em", color:"#1e6b3c", textTransform:"uppercase", marginBottom:"1rem" }}>◈ Monthly Summary Reports</p>
                <ReportCard title="Full Monthly Report" desc={`All activity for ${monthLabel} — new titles, ready, registered, objections`} onClick={printMonthlyFull} count={records.length} />
                <ReportCard title="Registered This Month" desc={`All matai titles registered in ${monthLabel}`} onClick={printRegisteredMonth} count={registeredMonth.length} />
                <ReportCard title="Ready to Register" desc="4-month proclamation complete, no objection — pending confirmation" onClick={printReady} count={readyToRegister.length} />
                <ReportCard title="New Matai Titles" desc="Entered but not yet proclaimed" onClick={printNewMatai} count={newMataiRecords.length} color="#7c3aed" />
                <ReportCard title="Proclamation Alerts" desc="Records within 120-day alert window" onClick={printProclamation} count={alertRecords.length} />
                <ReportCard title="Objections Report" desc="Titles with active objections filed" onClick={printObjections} count={objectionRecords.length} color="#8b1a1a" />
              </div>
            </div>
            {/* Summary */}
            <div style={{ ...sStyle, position:"sticky", top:"2rem" }}>
              <p style={{ fontFamily:"'Cinzel',serif", fontSize:"0.65rem", letterSpacing:"0.15em", color:"#1e6b3c", textTransform:"uppercase", marginBottom:"1rem" }}>◈ Current Month Summary</p>
              <p style={{ fontFamily:"'Cinzel',serif", fontSize:"0.72rem", color:"#1e6b3c", marginBottom:"1rem" }}>{monthLabel}</p>
              {[
                ["Total Records", records.length, "#1a5c35"],
                ["Registered", registeredAll.length, "#155c31"],
                ["Ready to Register", readyToRegister.length, "#1e6b3c"],
                ["New Titles", newMataiRecords.length, "#7c3aed"],
                ["Proclamation Alerts", alertRecords.length, "#c0392b"],
                ["Objections", objectionRecords.length, "#8b1a1a"],
              ].map(([label, count, col]) => (
                <div key={label} style={{ display:"flex", justifyContent:"space-between", padding:"0.45rem 0", borderBottom:"1px solid rgba(30,107,60,0.08)" }}>
                  <span style={{ fontSize:"0.78rem", color:"rgba(26,26,26,0.65)" }}>{label}</span>
                  <span style={{ fontFamily:"'Cinzel Decorative',serif", fontSize:"1rem", color:col, fontWeight:700 }}>{count}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Registered Matai tab ── */}
        {activeTab === "registered" && (
          <div style={{ display:"grid", gridTemplateColumns:"1fr 280px", gap:"1.5rem", alignItems:"start" }}>
            <div>
              <div style={sStyle}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"1rem" }}>
                  <p style={{ fontFamily:"'Cinzel',serif", fontSize:"0.65rem", letterSpacing:"0.15em", color:"#155c31", textTransform:"uppercase" }}>◈ {registeredAll.length} Registered Matai Titles</p>
                  <div style={{ display:"flex", gap:"0.5rem", alignItems:"center" }}>
                    <input type="month" value={monthFilter} onChange={e => setMonthFilter(e.target.value)}
                      style={{ fontSize:"0.78rem", padding:"0.3rem 0.6rem", border:"1px solid rgba(30,107,60,0.3)", borderRadius:"3px", color:"#1a5c35", fontFamily:"'Cinzel',serif" }} />
                    <button onClick={printRegisteredMonth} disabled={registeredMonth.length === 0}
                      style={{ fontSize:"0.68rem", padding:"0.35rem 0.8rem", fontFamily:"'Cinzel',serif", letterSpacing:"0.08em", textTransform:"uppercase", background: registeredMonth.length === 0 ? "#f3f4f6" : "#155c3115", border:`1px solid ${registeredMonth.length === 0 ? "#e5e7eb" : "#155c31"}`, color: registeredMonth.length === 0 ? "#9ca3af" : "#155c31", borderRadius:"3px", cursor: registeredMonth.length === 0 ? "not-allowed" : "pointer" }}>
                      📄 Month PDF ({registeredMonth.length})
                    </button>
                    <button onClick={printRegisteredAll}
                      style={{ fontSize:"0.68rem", padding:"0.35rem 0.8rem", fontFamily:"'Cinzel',serif", letterSpacing:"0.08em", textTransform:"uppercase", background:"#155c3115", border:"1px solid #155c31", color:"#155c31", borderRadius:"3px", cursor:"pointer" }}>
                      📄 All ({registeredAll.length})
                    </button>
                  </div>
                </div>
                {loading ? <p style={{ fontStyle:"italic", color:"#9ca3af" }}>Loading…</p>
                : registeredAll.length === 0
                  ? <p style={{ textAlign:"center", padding:"2rem", color:"rgba(26,26,26,0.35)", fontStyle:"italic" }}>No registered records yet.</p>
                  : <table style={{ width:"100%", borderCollapse:"collapse", fontSize:"0.82rem" }}>
                    <thead>
                      <tr style={{ background:"#155c31" }}>
                        {["Matai Title","Holder","Type","Village","District","Proclaimed","Registered"].map(h => (
                          <th key={h} style={{ padding:"0.5rem 0.75rem", color:"#fff", fontFamily:"'Cinzel',serif", fontSize:"0.6rem", letterSpacing:"0.08em", textTransform:"uppercase", textAlign:"left", whiteSpace:"nowrap" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {registeredAll.map((r,i) => (
                        <tr key={r.id} style={{ background: i%2===0 ? "#fff" : "#f5faf7" }}>
                          <td style={{ padding:"0.45rem 0.75rem", fontFamily:"'Cinzel',serif", fontWeight:700, color:"#155c31" }}>{r.mataiTitle}</td>
                          <td style={{ padding:"0.45rem 0.75rem" }}>{r.holderName}</td>
                          <td style={{ padding:"0.45rem 0.75rem" }}><span className="type-badge">{r.mataiType||"—"}</span></td>
                          <td style={{ padding:"0.45rem 0.75rem" }}>{r.village||"—"}</td>
                          <td style={{ padding:"0.45rem 0.75rem", fontSize:"0.78rem" }}>{r.district||"—"}</td>
                          <td style={{ padding:"0.45rem 0.75rem", fontSize:"0.78rem" }}>{fmtDate(r.dateProclamation)}</td>
                          <td style={{ padding:"0.45rem 0.75rem", color:"#155c31", fontWeight:600 }}>{fmtDate(r.dateRegistration)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                }
              </div>
            </div>
            <div style={{ ...sStyle, position:"sticky", top:"2rem" }}>
              <p style={{ fontFamily:"'Cinzel',serif", fontSize:"0.65rem", letterSpacing:"0.15em", color:"#155c31", textTransform:"uppercase", marginBottom:"1rem" }}>◈ Registration Summary</p>
              {[["Total Registered", registeredAll.length],["Registered This Month", registeredMonth.length]].map(([l,n]) => (
                <div key={l} style={{ display:"flex", justifyContent:"space-between", padding:"0.5rem 0", borderBottom:"1px solid rgba(30,107,60,0.08)" }}>
                  <span style={{ fontSize:"0.78rem", color:"rgba(26,26,26,0.65)" }}>{l}</span>
                  <span style={{ fontFamily:"'Cinzel Decorative',serif", fontSize:"1.1rem", color:"#155c31", fontWeight:700 }}>{n}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Other Reports tab ── */}
        {activeTab === "other" && (
          <div style={sStyle}>
            <p style={{ fontFamily:"'Cinzel',serif", fontSize:"0.65rem", letterSpacing:"0.15em", color:"#1e6b3c", textTransform:"uppercase", marginBottom:"1rem" }}>◈ Other Reports</p>
            <ReportCard title="Proclamation Alerts" desc="Records with proclamation date within 120 days, not yet registered" onClick={printProclamation} count={alertRecords.length} />
            <ReportCard title="Ready to Register" desc="Proclamation period complete, awaiting confirmation" onClick={printReady} count={readyToRegister.length} />
            <ReportCard title="New Matai Titles" desc="Titles entered but not yet proclaimed" onClick={printNewMatai} count={newMataiRecords.length} color="#7c3aed" />
            <ReportCard title="Objections Report" desc="Titles with active objections filed" onClick={printObjections} count={objectionRecords.length} color="#8b1a1a" />
          </div>
        )}

      </div>
    </div>
  );
}

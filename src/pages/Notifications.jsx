import { useState, useEffect } from "react";
import { collection, getDocs } from "firebase/firestore";
import { auth, db } from "../firebase";
import { getPermissions } from "../utils/roles";
import { logAudit } from "../utils/audit";
import { cacheClear } from "../utils/cache";
import Sidebar from "../components/Sidebar";
import { Navigate, Link } from "react-router-dom";
import { cachedFetch } from "../utils/cache";

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

const daysUntil = (str) => {
  if (!str) return null;
  return Math.ceil((new Date(str) - new Date()) / (1000*60*60*24));
};

// Auto registration date: 29th of 4th month after proclamation
// Exception: if that month is February in a leap year → 28th
function autoRegDate(proclamationStr) {
  if (!proclamationStr) return null;
  const d = new Date(proclamationStr);
  d.setMonth(d.getMonth() + 4);
  const yr = d.getFullYear(), mo = d.getMonth();
  const isLeap = (yr%4===0 && yr%100!==0) || yr%400===0;
  d.setDate((mo === 1 && isLeap) ? 28 : 29);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

function isMonthlyRunDay() {
  const now = new Date();
  const yr = now.getFullYear(), mo = now.getMonth(), day = now.getDate();
  const isLeap = (yr%4===0 && yr%100!==0) || yr%400===0;
  return (mo === 1 && isLeap) ? day === 28 : day === 29;
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

export default function Notifications({ userRole }) {
  const [records, setRecords]           = useState([]);
  const [loading, setLoading]           = useState(true);
  const [filterWindow, setFilterWindow] = useState(120);
  const [activeTab, setActiveTab]       = useState("proclamation");
  const perms = getPermissions(userRole);
  const user  = auth.currentUser;

  if (!perms.canViewAudit) return <Navigate to="/dashboard" />;

  useEffect(() => {
    (async () => {
      try {
        cacheClear("registrations"); // always fresh on page load
        const snap = await getDocs(collection(db, "registrations"));
        const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        data.sort((a,b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
        setRecords(data);
      } catch(err) { console.error(err); }
      finally { setLoading(false); }
    })();
  }, []);

  const genBy = user?.displayName || user?.email || "Admin";

  // ── Data cuts ──────────────────────────────────────────

  // Proclamation alerts: has proclamation date, no registration date yet, no objection
  const alertRecords = records.filter(r => {
    if (r.objection === "yes") return false;
    if (r.dateRegistration) return false;          // already registered — remove from alerts
    if (!r.dateProclamation) return false;
    const days = daysUntil(r.dateProclamation);
    return days !== null && days <= filterWindow;
  }).sort((a,b) => (daysUntil(a.dateProclamation)||0) - (daysUntil(b.dateProclamation)||0));

  // Objection records
  const objectionRecords = records.filter(r => r.objection === "yes");

  // Monthly — New Matai titles: entered but NO proclamation date yet (brand new entries)
  const newMataiRecords = records.filter(r => !r.dateProclamation && !r.dateRegistration && r.objection !== "yes");

  // Monthly — Ready to register: 4 months past proclamation, no objection, no registration date
  const readyToRegister = records.filter(r => {
    if (r.objection === "yes") return false;
    if (r.dateRegistration) return false;
    if (!r.dateProclamation) return false;
    return daysUntil(r.dateProclamation) < -120;
  });

  // ── Urgency helpers ────────────────────────────────────
  const urgencyColor = (days) => {
    if (days === null) return "rgba(26,26,26,0.4)";
    if (days < -120)  return "#8b1a1a";
    if (days < 0)     return "#c0392b";
    if (days <= 30)   return "#c0392b";
    if (days <= 60)   return "#d68910";
    return "#1e6b3c";
  };
  const urgencyLabel = (days) => {
    if (days === null) return "—";
    if (days < -120)  return `${Math.abs(days)}d OVERDUE`;
    if (days < 0)     return `${Math.abs(days)}d past`;
    if (days === 0)   return "TODAY";
    return `${days}d remaining`;
  };

  // ── PDF generators ─────────────────────────────────────

  const printProclamationReport = () => {
    const genBy2 = genBy;
    const rows = alertRecords.map((r,i) => {
      const days = daysUntil(r.dateProclamation);
      const col = days < 0 ? "#8b1a1a" : days <= 30 ? "#c0392b" : "#1e6b3c";
      const regDate = autoRegDate(r.dateProclamation);
      return `<tr>
        <td>${i+1}</td>
        <td><strong>${r.mataiTitle||"—"}</strong></td>
        <td>${r.holderName||"—"}</td>
        <td>${r.village||"—"}</td>
        <td>${r.district||"—"}</td>
        <td>${fmtDate(r.dateProclamation)}</td>
        <td style="color:${col};font-weight:600">${urgencyLabel(days)}</td>
        <td>${fmtDate(regDate)}</td>
      </tr>`;
    }).join("");
    const html = reportHeader("Proclamation Alerts Report","Records within alert window — not yet registered",alertRecords.length,genBy2)
      + `<table><thead><tr><th>#</th><th>Matai Title</th><th>Holder</th><th>Village</th><th>District</th><th>Proclaimed</th><th>Status</th><th>Auto Reg. Date</th></tr></thead><tbody>${rows}</tbody></table>
      <div class="footer">Matai Registry — Resitalaina o Matai — Confidential</div>
      <script>window.onload=()=>window.print();<\/script></body></html>`;
    openPDF("Proclamation Alerts", html);
    logAudit("REPORT_PDF", { type:"proclamation", count: alertRecords.length });
  };

  const printObjectionReport = () => {
    const now = new Date();
    const monthLabel = `${MONTHS[now.getMonth()]} ${now.getFullYear()}`;
    const rows = objectionRecords.map((r,i) => `<tr>
      <td>${i+1}</td>
      <td><strong>${r.mataiTitle||"—"}</strong></td>
      <td>${r.holderName||"—"}</td>
      <td>${r.village||"—"}</td>
      <td>${r.district||"—"}</td>
      <td>${fmtDate(r.dateProclamation)}</td>
      <td style="color:#8b1a1a;font-weight:600">${fmtDate(r.objectionDate)}</td>
      <td style="color:#8b1a1a">Court proceedings required</td>
    </tr>`).join("");
    const html = reportHeader(
        `Objection Received and Noted — ${monthLabel}`,
        "Titles with objection recorded — cannot be registered until resolved through court",
        objectionRecords.length, genBy)
      + `<table><thead><tr><th>#</th><th>Matai Title</th><th>Holder</th><th>Village</th><th>District</th><th>Proclaimed</th><th>Objection Date</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table>
      <div class="footer">Matai Registry — Resitalaina o Matai — Confidential</div>
      <script>window.onload=()=>window.print();<\/script></body></html>`;
    openPDF("Objection Report", html);
    logAudit("REPORT_PDF", { type:"objection", count: objectionRecords.length });
  };

  const printNewMataiReport = () => {
    const now = new Date();
    const monthLabel = `${MONTHS[now.getMonth()]} ${now.getFullYear()}`;
    const rows = newMataiRecords.map((r,i) => `<tr>
      <td>${i+1}</td>
      <td><strong>${r.mataiTitle||"—"}</strong></td>
      <td>${r.holderName||"—"}</td>
      <td>${r.village||"—"}</td>
      <td>${r.district||"—"}</td>
      <td>${r.mataiType||"—"}</td>
      <td>${fmtDate(r.dateConferred)}</td>
      <td>${fmtDate(r.createdAt?.toDate ? r.createdAt.toDate().toISOString().split("T")[0] : null)}</td>
    </tr>`).join("");
    const html = reportHeader(
        `New Matai Titles — ${monthLabel}`,
        "Newly entered titles awaiting proclamation period",
        newMataiRecords.length, genBy)
      + `<table><thead><tr><th>#</th><th>Matai Title</th><th>Holder</th><th>Village</th><th>District</th><th>Type</th><th>Date Conferred</th><th>Date Entered</th></tr></thead><tbody>${rows}</tbody></table>
      <div class="footer">Matai Registry — Resitalaina o Matai — Confidential</div>
      <script>window.onload=()=>window.print();<\/script></body></html>`;
    openPDF("New Matai Titles Report", html);
    logAudit("REPORT_PDF", { type:"new_matai", count: newMataiRecords.length });
  };

  const printReadyReport = () => {
    const now = new Date();
    const monthLabel = `${MONTHS[now.getMonth()]} ${now.getFullYear()}`;
    const rows = readyToRegister.map((r,i) => {
      const regDate = autoRegDate(r.dateProclamation);
      return `<tr>
        <td>${i+1}</td>
        <td><strong>${r.mataiTitle||"—"}</strong></td>
        <td>${r.holderName||"—"}</td>
        <td>${r.village||"—"}</td>
        <td>${r.district||"—"}</td>
        <td>${fmtDate(r.dateProclamation)}</td>
        <td style="color:#1a5c35;font-weight:600">${fmtDate(regDate)}</td>
      </tr>`;
    }).join("");
    const html = reportHeader(
        `Monthly Registration Report — ${monthLabel}`,
        "Proclamation period complete, no objection — ready to register",
        readyToRegister.length, genBy)
      + `<table><thead><tr><th>#</th><th>Matai Title</th><th>Holder</th><th>Village</th><th>District</th><th>Proclaimed</th><th>Registration Date</th></tr></thead><tbody>${rows}</tbody></table>
      <div class="footer">Matai Registry — Resitalaina o Matai — Confidential</div>
      <script>window.onload=()=>window.print();<\/script></body></html>`;
    openPDF("Monthly Registration Report", html);
    logAudit("REPORT_PDF", { type:"monthly_ready", count: readyToRegister.length });
  };

  // ── Styles ─────────────────────────────────────────────
  const sStyle = { background:"#fff", border:"1px solid rgba(30,107,60,0.2)", borderRadius:"4px", padding:"1.5rem", marginBottom:"1.5rem", boxShadow:"0 1px 4px rgba(0,0,0,0.05)" };

  const TabBtn = ({ tab, label, count, color="#1e6b3c" }) => (
    <button onClick={() => setActiveTab(tab)} style={{
      padding:"0.55rem 1.1rem", fontFamily:"'Cinzel',serif", fontSize:"0.7rem",
      letterSpacing:"0.1em", textTransform:"uppercase", cursor:"pointer", borderRadius:"3px",
      border: activeTab===tab ? `1px solid ${color}` : "1px solid rgba(30,107,60,0.2)",
      background: activeTab===tab ? `${color}15` : "transparent",
      color: activeTab===tab ? color : "rgba(26,26,26,0.5)",
      display:"flex", alignItems:"center", gap:"6px"
    }}>
      {label}
      <span style={{ background: activeTab===tab ? color : "#e5e7eb", color: activeTab===tab ? "#fff" : "#6b7280", borderRadius:"20px", padding:"1px 7px", fontSize:"0.62rem" }}>
        {count}
      </span>
    </button>
  );

  const PdfBtn = ({ onClick, label, count, disabled, color="#1a5c35" }) => (
    <button onClick={onClick} disabled={disabled || count === 0}
      style={{ fontSize:"0.72rem", padding:"0.45rem 1rem", fontFamily:"'Cinzel',serif", letterSpacing:"0.08em", textTransform:"uppercase", background: (disabled||count===0) ? "#f3f4f6" : `${color}15`, border:`1px solid ${(disabled||count===0) ? "#e5e7eb" : color}`, color:(disabled||count===0) ? "#9ca3af" : color, borderRadius:"3px", cursor:(disabled||count===0) ? "not-allowed" : "pointer" }}>
      📄 {label} ({count})
    </button>
  );

  const RecordRow = ({ r }) => {
    const days = daysUntil(r.dateProclamation);
    const col  = urgencyColor(days);
    return (
      <Link to={`/register/${r.id}`} style={{ textDecoration:"none", display:"block" }}>
        <div style={{ background:"#fafafa", border:`1px solid ${col}30`, borderLeft:`4px solid ${col}`, borderRadius:"3px", padding:"0.85rem 1.1rem", cursor:"pointer", marginBottom:"0.6rem" }}
          onMouseEnter={e => e.currentTarget.style.background="#f0faf4"}
          onMouseLeave={e => e.currentTarget.style.background="#fafafa"}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"4px" }}>
            <div>
              <span style={{ fontFamily:"'Cinzel',serif", fontSize:"0.92rem", fontWeight:"700", color:"#1e6b3c" }}>{r.mataiTitle||"—"}</span>
              <span style={{ fontSize:"0.82rem", color:"rgba(26,26,26,0.6)", marginLeft:"8px" }}>{r.holderName}</span>
            </div>
            <span style={{ fontFamily:"'Cinzel',serif", fontSize:"0.65rem", fontWeight:"700", color:col, background:`${col}15`, padding:"2px 8px", borderRadius:"2px" }}>
              {urgencyLabel(days)}
            </span>
          </div>
          <div style={{ display:"flex", gap:"1.2rem", flexWrap:"wrap", fontSize:"0.77rem", color:"rgba(26,26,26,0.55)" }}>
            <span>📍 {r.village}, {r.district}</span>
            <span>🗓 Proclaimed: <strong style={{ color:col }}>{fmtDate(r.dateProclamation)}</strong></span>
            <span>📋 Auto reg: {fmtDate(autoRegDate(r.dateProclamation))}</span>
          </div>
        </div>
      </Link>
    );
  };

  return (
    <div className="app-layout">
      <div className="pattern-bg" />
      <Sidebar userRole={userRole} userEmail={user?.email} />
      <div className="sidebar-content">

        <div style={{ marginBottom:"1.5rem" }}>
          <p className="page-eyebrow">Automated Alerts</p>
          <h1 className="page-title">Notifications</h1>
        </div>

        {/* Monthly run day banner */}
        {isMonthlyRunDay() && readyToRegister.length > 0 && (
          <div style={{ background:"#f0faf4", border:"1px solid #1e6b3c", borderLeft:"4px solid #1e6b3c", borderRadius:"4px", padding:"1rem 1.25rem", marginBottom:"1.5rem" }}>
            <p style={{ fontFamily:"'Cinzel',serif", fontSize:"0.7rem", letterSpacing:"0.12em", color:"#1e6b3c", textTransform:"uppercase", marginBottom:"4px" }}>📅 Monthly Report Day</p>
            <p style={{ fontSize:"0.88rem", color:"#1a5c35" }}>Today is the monthly registration date. <strong>{readyToRegister.length} records</strong> are ready to register.</p>
          </div>
        )}

        <div style={{ display:"grid", gridTemplateColumns:"1fr 300px", gap:"1.5rem", alignItems:"start" }}>

          {/* ── Left ── */}
          <div>
            {/* Tabs */}
            <div style={{ display:"flex", gap:"0.5rem", marginBottom:"1.25rem", flexWrap:"wrap" }}>
              <TabBtn tab="proclamation" label="Proclamation Alerts" count={alertRecords.length} />
              <TabBtn tab="objection"    label="Objections"          count={objectionRecords.length} color="#8b1a1a" />
              <TabBtn tab="monthly"      label="Monthly Reports"     count={readyToRegister.length + newMataiRecords.length} />
            </div>

            {/* ── Proclamation tab ── */}
            {activeTab === "proclamation" && (<>
              <div style={sStyle}>
                <p style={{ fontFamily:"'Cinzel',serif", fontSize:"0.65rem", letterSpacing:"0.15em", color:"#1e6b3c", textTransform:"uppercase", marginBottom:"0.6rem" }}>◈ Alert Window</p>
                <div style={{ display:"flex", gap:"0.5rem", flexWrap:"wrap", marginBottom:"0.75rem" }}>
                  {[30,60,90,120,180,365].map(d => (
                    <button key={d} onClick={() => setFilterWindow(d)} style={{
                      padding:"0.35rem 0.8rem", fontFamily:"'Cinzel',serif", fontSize:"0.65rem", letterSpacing:"0.08em", textTransform:"uppercase", cursor:"pointer", borderRadius:"2px",
                      border: filterWindow===d ? "1px solid #1e6b3c" : "1px solid rgba(30,107,60,0.2)",
                      background: filterWindow===d ? "rgba(30,107,60,0.1)" : "transparent",
                      color: filterWindow===d ? "#1e6b3c" : "rgba(26,26,26,0.5)"
                    }}>{d===365 ? "1 year" : `${d} days`}</button>
                  ))}
                </div>
                <p style={{ fontSize:"0.78rem", color:"rgba(26,26,26,0.45)" }}>
                  Records with proclamation date within {filterWindow} days and <strong>no registration date yet</strong>. Once registered, records are removed from this list.
                </p>
              </div>
              <div style={sStyle}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"1rem" }}>
                  <p style={{ fontFamily:"'Cinzel',serif", fontSize:"0.65rem", letterSpacing:"0.15em", color:"#1e6b3c", textTransform:"uppercase" }}>
                    ◈ {alertRecords.length} Record{alertRecords.length!==1?"s":""} Requiring Attention
                  </p>
                  <PdfBtn onClick={printProclamationReport} label="PDF Report" count={alertRecords.length} />
                </div>
                {loading ? <p style={{ fontStyle:"italic", color:"#9ca3af" }}>Loading…</p>
                : alertRecords.length === 0
                  ? <div style={{ textAlign:"center", padding:"2.5rem", color:"rgba(26,26,26,0.35)", fontStyle:"italic" }}>✅ No records within {filterWindow} days.</div>
                  : alertRecords.map(r => <RecordRow key={r.id} r={r} />)
                }
              </div>
            </>)}

            {/* ── Objection tab ── */}
            {activeTab === "objection" && (
              <div style={sStyle}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"0.5rem" }}>
                  <p style={{ fontFamily:"'Cinzel',serif", fontSize:"0.65rem", letterSpacing:"0.15em", color:"#8b1a1a", textTransform:"uppercase" }}>
                    ◈ {objectionRecords.length} Objection{objectionRecords.length!==1?"s":""} Recorded
                  </p>
                  <PdfBtn onClick={printObjectionReport} label="PDF Report" count={objectionRecords.length} color="#8b1a1a" />
                </div>
                <p style={{ fontSize:"0.78rem", color:"rgba(26,26,26,0.45)", marginBottom:"1.25rem" }}>
                  These titles have an objection. They cannot be registered until resolved through court.
                </p>
                {loading ? <p style={{ fontStyle:"italic", color:"#9ca3af" }}>Loading…</p>
                : objectionRecords.length === 0
                  ? <div style={{ textAlign:"center", padding:"2.5rem", color:"rgba(26,26,26,0.35)", fontStyle:"italic" }}>✅ No objections recorded.</div>
                  : objectionRecords.map(r => (
                    <Link key={r.id} to={`/register/${r.id}`} style={{ textDecoration:"none", display:"block" }}>
                      <div style={{ background:"#fdf8f8", border:"1px solid #e8b4b430", borderLeft:"4px solid #8b1a1a", borderRadius:"3px", padding:"0.85rem 1.1rem", cursor:"pointer", marginBottom:"0.6rem" }}
                        onMouseEnter={e => e.currentTarget.style.background="#fdf0f0"}
                        onMouseLeave={e => e.currentTarget.style.background="#fdf8f8"}>
                        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"4px" }}>
                          <div>
                            <span style={{ fontFamily:"'Cinzel',serif", fontSize:"0.92rem", fontWeight:"700", color:"#8b1a1a" }}>{r.mataiTitle||"—"}</span>
                            <span style={{ fontSize:"0.82rem", color:"rgba(26,26,26,0.6)", marginLeft:"8px" }}>{r.holderName}</span>
                          </div>
                          <span style={{ fontFamily:"'Cinzel',serif", fontSize:"0.65rem", fontWeight:"700", color:"#8b1a1a", background:"#8b1a1a15", padding:"2px 8px", borderRadius:"2px" }}>⚠ OBJECTION</span>
                        </div>
                        <div style={{ display:"flex", gap:"1.2rem", flexWrap:"wrap", fontSize:"0.77rem", color:"rgba(26,26,26,0.55)" }}>
                          <span>📍 {r.village}, {r.district}</span>
                          <span>🗓 Proclaimed: {fmtDate(r.dateProclamation)}</span>
                          <span style={{ color:"#8b1a1a" }}>📋 Objection: {fmtDate(r.objectionDate)}</span>
                        </div>
                      </div>
                    </Link>
                  ))
                }
              </div>
            )}

            {/* ── Monthly reports tab ── */}
            {activeTab === "monthly" && (<>

              {/* New Matai titles */}
              <div style={sStyle}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"0.5rem" }}>
                  <div>
                    <p style={{ fontFamily:"'Cinzel',serif", fontSize:"0.65rem", letterSpacing:"0.15em", color:"#1e6b3c", textTransform:"uppercase" }}>
                      ◈ New Matai Titles — {newMataiRecords.length} Record{newMataiRecords.length!==1?"s":""}
                    </p>
                    <p style={{ fontSize:"0.78rem", color:"rgba(26,26,26,0.45)", marginTop:"4px" }}>
                      Entered but not yet proclaimed — awaiting 4-month proclamation period
                    </p>
                  </div>
                  <PdfBtn onClick={printNewMataiReport} label="PDF Report" count={newMataiRecords.length} />
                </div>
                {loading ? <p style={{ fontStyle:"italic", color:"#9ca3af" }}>Loading…</p>
                : newMataiRecords.length === 0
                  ? <div style={{ textAlign:"center", padding:"2rem", color:"rgba(26,26,26,0.35)", fontStyle:"italic" }}>No new titles this month.</div>
                  : newMataiRecords.map(r => (
                    <Link key={r.id} to={`/register/${r.id}`} style={{ textDecoration:"none", display:"block" }}>
                      <div style={{ background:"#f5f3ff", border:"1px solid #c4b5fd50", borderLeft:"4px solid #7c3aed", borderRadius:"3px", padding:"0.85rem 1.1rem", cursor:"pointer", marginBottom:"0.6rem" }}
                        onMouseEnter={e => e.currentTarget.style.background="#ede9fe"}
                        onMouseLeave={e => e.currentTarget.style.background="#f5f3ff"}>
                        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                          <div>
                            <span style={{ fontFamily:"'Cinzel',serif", fontSize:"0.92rem", fontWeight:"700", color:"#5b21b6" }}>{r.mataiTitle||"—"}</span>
                            <span style={{ fontSize:"0.82rem", color:"rgba(26,26,26,0.6)", marginLeft:"8px" }}>{r.holderName}</span>
                          </div>
                          <span style={{ fontFamily:"'Cinzel',serif", fontSize:"0.65rem", color:"#7c3aed", background:"#7c3aed15", padding:"2px 8px", borderRadius:"2px" }}>NEW</span>
                        </div>
                        <div style={{ display:"flex", gap:"1.2rem", flexWrap:"wrap", fontSize:"0.77rem", color:"rgba(26,26,26,0.55)", marginTop:"4px" }}>
                          <span>📍 {r.village}, {r.district}</span>
                          <span>🗓 Conferred: {fmtDate(r.dateConferred)}</span>
                        </div>
                      </div>
                    </Link>
                  ))
                }
              </div>

              {/* Ready to register */}
              <div style={sStyle}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"0.5rem" }}>
                  <div>
                    <p style={{ fontFamily:"'Cinzel',serif", fontSize:"0.65rem", letterSpacing:"0.15em", color:"#1e6b3c", textTransform:"uppercase" }}>
                      ◈ Ready to Register — {readyToRegister.length} Record{readyToRegister.length!==1?"s":""}
                    </p>
                    <p style={{ fontSize:"0.78rem", color:"rgba(26,26,26,0.45)", marginTop:"4px" }}>
                      4-month proclamation complete, no objection — registration date auto-set
                    </p>
                  </div>
                  <PdfBtn onClick={printReadyReport} label="PDF Report" count={readyToRegister.length} />
                </div>
                {loading ? <p style={{ fontStyle:"italic", color:"#9ca3af" }}>Loading…</p>
                : readyToRegister.length === 0
                  ? <div style={{ textAlign:"center", padding:"2rem", color:"rgba(26,26,26,0.35)", fontStyle:"italic" }}>No records ready this month.</div>
                  : readyToRegister.map(r => (
                    <Link key={r.id} to={`/register/${r.id}`} style={{ textDecoration:"none", display:"block" }}>
                      <div style={{ background:"#f0faf4", border:"1px solid #a7d7b850", borderLeft:"4px solid #1e6b3c", borderRadius:"3px", padding:"0.85rem 1.1rem", cursor:"pointer", marginBottom:"0.6rem" }}
                        onMouseEnter={e => e.currentTarget.style.background="#e8f5ee"}
                        onMouseLeave={e => e.currentTarget.style.background="#f0faf4"}>
                        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                          <div>
                            <span style={{ fontFamily:"'Cinzel',serif", fontSize:"0.92rem", fontWeight:"700", color:"#1e6b3c" }}>{r.mataiTitle||"—"}</span>
                            <span style={{ fontSize:"0.82rem", color:"rgba(26,26,26,0.6)", marginLeft:"8px" }}>{r.holderName}</span>
                          </div>
                          <span style={{ fontFamily:"'Cinzel',serif", fontSize:"0.65rem", color:"#1e6b3c", background:"#1e6b3c15", padding:"2px 8px", borderRadius:"2px" }}>✅ READY</span>
                        </div>
                        <div style={{ display:"flex", gap:"1.2rem", flexWrap:"wrap", fontSize:"0.77rem", color:"rgba(26,26,26,0.55)", marginTop:"4px" }}>
                          <span>📍 {r.village}, {r.district}</span>
                          <span>🗓 Proclaimed: {fmtDate(r.dateProclamation)}</span>
                          <span style={{ color:"#1a5c35" }}>📋 Reg. date: {fmtDate(autoRegDate(r.dateProclamation))}</span>
                        </div>
                      </div>
                    </Link>
                  ))
                }
              </div>
            </>)}
          </div>

          {/* ── Right: Summary panel ── */}
          <div style={{ ...sStyle, position:"sticky", top:"2rem" }}>
            <p style={{ fontFamily:"'Cinzel',serif", fontSize:"0.65rem", letterSpacing:"0.15em", color:"#1e6b3c", textTransform:"uppercase", marginBottom:"1rem" }}>◈ Summary</p>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"0.5rem", marginBottom:"1.25rem" }}>
              {[
                ["Alerts",      alertRecords.length,      "#c0392b"],
                ["Objections",  objectionRecords.length,  "#8b1a1a"],
                ["New Titles",  newMataiRecords.length,   "#7c3aed"],
                ["Ready",       readyToRegister.length,   "#1e6b3c"],
              ].map(([label, count, col]) => (
                <div key={label} style={{ background:`${col}08`, border:`1px solid ${col}30`, borderRadius:"3px", padding:"0.6rem 0.75rem", textAlign:"center" }}>
                  <p style={{ fontFamily:"'Cinzel Decorative',serif", fontSize:"1.4rem", color:col }}>{count}</p>
                  <p style={{ fontFamily:"'Cinzel',serif", fontSize:"0.58rem", color:col, letterSpacing:"0.08em", textTransform:"uppercase" }}>{label}</p>
                </div>
              ))}
            </div>

            <p style={{ fontFamily:"'Cinzel',serif", fontSize:"0.62rem", letterSpacing:"0.1em", color:"#1e6b3c", textTransform:"uppercase", marginBottom:"0.75rem" }}>Generate PDF Reports</p>
            <div style={{ display:"flex", flexDirection:"column", gap:"0.5rem" }}>
              <PdfBtn onClick={printProclamationReport} label="Proclamation Alerts"  count={alertRecords.length} />
              <PdfBtn onClick={printObjectionReport}    label="Objections Report"    count={objectionRecords.length} color="#8b1a1a" />
              <PdfBtn onClick={printNewMataiReport}     label="New Matai Titles"     count={newMataiRecords.length} color="#7c3aed" />
              <PdfBtn onClick={printReadyReport}        label="Ready to Register"    count={readyToRegister.length} />
            </div>

            <div style={{ marginTop:"1rem", padding:"0.75rem", background:"#f9fafb", borderRadius:"3px", fontSize:"0.75rem", color:"rgba(26,26,26,0.5)", lineHeight:1.5 }}>
              📧 Email sending coming soon
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

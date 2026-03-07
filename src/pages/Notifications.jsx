import { useState, useEffect } from "react";
import { collection, getDocs } from "firebase/firestore";
import { auth, db } from "../firebase";
import { getPermissions } from "../utils/roles";
import { logAudit } from "../utils/audit";
import Sidebar from "../components/Sidebar";
import { Navigate, Link } from "react-router-dom";
import { cachedFetch, cacheClear } from "../utils/cache";
import { sendEmail, isEmailJSConfigured } from "../utils/email";

const fmtDate = (str) => {
  if (!str) return "—";
  const d = new Date(str);
  if (isNaN(d)) return str;
  return `${String(d.getDate()).padStart(2,"0")}/${String(d.getMonth()+1).padStart(2,"0")}/${d.getFullYear()}`;
};

const daysUntil = (str) => {
  if (!str) return null;
  const diff = new Date(str) - new Date();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
};

// Returns true if today is the monthly report run date (29th, or 28th on leap year Feb)
function isMonthlyRunDay() {
  const now = new Date();
  const day = now.getDate();
  const month = now.getMonth(); // 0-indexed, Jan=0
  const year = now.getFullYear();
  const isLeapYear = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  // February on a leap year: run on 28th
  if (month === 1 && isLeapYear) return day === 28;
  return day === 29;
}

function buildEmailBody(records, type = "proclamation") {
  const lines = [
    "MATAI REGISTRY — " + (type === "objection" ? "OBJECTION REPORT" : "PROCLAMATION REMINDER"),
    "Resitalaina o Matai — Automated Notification",
    "",
    `Generated: ${fmtDate(new Date().toISOString().split("T")[0])}`,
    `Records: ${records.length}`,
    "",
    "─".repeat(60),
    "",
  ];
  records.forEach((r, i) => {
    lines.push(`${i+1}. ${r.mataiTitle || "—"} — ${r.holderName || "—"}`);
    lines.push(`   Village: ${r.village || "—"}, District: ${r.district || "—"}`);
    if (type === "objection") {
      lines.push(`   Objection Date: ${fmtDate(r.objectionDate)}`);
      lines.push(`   Status: CANNOT BE REGISTERED — Requires Court Proceedings`);
    } else {
      const days = daysUntil(r.dateProclamation);
      lines.push(`   Proclamation: ${fmtDate(r.dateProclamation)} (${days < 0 ? `${Math.abs(days)}d overdue` : `${days}d remaining`})`);
    }
    lines.push("");
  });
  lines.push("─".repeat(60));
  lines.push("https://amiliontechnology-bit.github.io/matai-registry");
  return lines.join("\n");
}

export default function Notifications({ userRole }) {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [recipientEmail, setRecipientEmail] = useState("");
  const [sending, setSending]       = useState(false);
  const [sendResult, setSendResult] = useState(null); // {ok, msg}
  const [filterWindow, setFilterWindow] = useState(120);
  const [activeTab, setActiveTab] = useState("proclamation"); // proclamation | objection | monthly
  const perms = getPermissions(userRole);
  const user = auth.currentUser;

  if (!perms.canViewAudit) return <Navigate to="/dashboard" />;

  useEffect(() => {
    (async () => {
      try {
        const cached = cacheGet("registrations");
        if (cached) { setRecords(cached); setLoading(false); return; }
        const snap = await getDocs(collection(db, "registrations"));
        const all = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        all.sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
        cacheSet("registrations", all);
        setRecords(all);
      } catch (err) { console.error(err); }
      finally { setLoading(false); }
    })();
  }, []);

  const isOverdue = (r) => {
    if (!r.dateProclamation) return false;
    if (r.status === "completed") return false;
    if (r.objection === "yes") return false; // objection records handled separately
    return daysUntil(r.dateProclamation) < -120;
  };

  // Proclamation alert records (no objection)
  const alertRecords = records.filter(r => {
    if (r.objection === "yes") return false;
    if (!r.dateProclamation) return false;
    const days = daysUntil(r.dateProclamation);
    if (days === null) return false;
    if (isOverdue(r)) return true;
    return days <= filterWindow;
  });

  const sorted = [...alertRecords].sort((a, b) => {
    return (daysUntil(a.dateProclamation) || 0) - (daysUntil(b.dateProclamation) || 0);
  });

  // Objection records
  const objectionRecords = records.filter(r => r.objection === "yes");

  // Monthly report: records ready to register (no objection, proclamation >= 4 months ago, not yet registered)
  const monthlyReady = records.filter(r => {
    if (r.objection === "yes") return false;
    if (r.status === "completed") return false;
    if (!r.dateProclamation) return false;
    return daysUntil(r.dateProclamation) < -120;
  });

  const handleSendEmail = async (reportRecords, type) => {
    if (!recipientEmail.trim()) return;
    setSending(true);
    setSendResult(null);
    const subjectText = type === "objection"
      ? `Matai Registry — ${reportRecords.length} Objection Record${reportRecords.length !== 1 ? "s" : ""}`
      : `Matai Registry — ${reportRecords.length} Proclamation Alert${reportRecords.length !== 1 ? "s" : ""}`;
    const body = buildEmailBody(reportRecords, type);
    try {
      if (isEmailJSConfigured()) {
        await sendEmail({
          toEmail:  recipientEmail,
          subject:  subjectText,
          message:  body,
          fromName: "Matai Registry — " + (user?.displayName || user?.email || "Admin"),
        });
        logAudit("NOTIFICATION_SENT", { recipientEmail, count: reportRecords.length, type });
        setSendResult({ ok: true, msg: `✓ Email sent to ${recipientEmail}` });
      } else {
        // Fallback: open mailto with report
        const subject = encodeURIComponent(subjectText);
        const encoded = encodeURIComponent(body);
        window.location.href = `mailto:${recipientEmail}?subject=${subject}&body=${encoded}`;
        logAudit("NOTIFICATION_SENT", { recipientEmail, count: reportRecords.length, type, via: "mailto" });
        setSendResult({ ok: true, msg: "✓ Email client opened with report." });
      }
    } catch (err) {
      setSendResult({ ok: false, msg: "✗ Failed to send: " + (err?.text || err?.message || "Unknown error") });
    } finally {
      setSending(false);
      setTimeout(() => setSendResult(null), 6000);
    }
  };

  const urgencyColor = (days, r) => {
    if (days === null) return "rgba(26,26,26,0.4)";
    if (isOverdue(r)) return "#8b1a1a";
    if (days < 0)     return "#c0392b";
    if (days <= 30)   return "#c0392b";
    if (days <= 60)   return "#d68910";
    return "#1e6b3c";
  };

  const urgencyLabel = (days, r) => {
    if (days === null) return "—";
    if (isOverdue(r)) return `${Math.abs(days)}d OVERDUE`;
    if (days < 0)     return `${Math.abs(days)}d past`;
    if (days === 0)   return "TODAY";
    return `${days} days`;
  };

  const sStyle = { background:"#ffffff", border:"1px solid rgba(30,107,60,0.2)", borderRadius:"4px", padding:"1.5rem", marginBottom:"1.5rem", boxShadow:"0 1px 4px rgba(0,0,0,0.05)" };
  const tabBtn = (tab, label, count, color="#1e6b3c") => (
    <button onClick={() => setActiveTab(tab)} style={{
      padding:"0.55rem 1.1rem", fontFamily:"'Cinzel',serif", fontSize:"0.7rem",
      letterSpacing:"0.1em", textTransform:"uppercase", cursor:"pointer", borderRadius:"3px",
      border: activeTab===tab ? `1px solid ${color}` : "1px solid rgba(30,107,60,0.2)",
      background: activeTab===tab ? `${color}15` : "transparent",
      color: activeTab===tab ? color : "rgba(26,26,26,0.5)",
      display:"flex", alignItems:"center", gap:"0.4rem"
    }}>
      {label}
      <span style={{ background: activeTab===tab ? color : "#e5e7eb", color: activeTab===tab ? "#fff" : "#6b7280", borderRadius:"20px", padding:"1px 7px", fontSize:"0.65rem" }}>
        {count}
      </span>
    </button>
  );

  const RecordRow = ({ r }) => {
    const days = daysUntil(r.dateProclamation);
    const col = urgencyColor(days, r);
    return (
      <Link to={`/certificate/${r.id}`} style={{ textDecoration:"none", display:"block" }}>
        <div style={{ background:"#fafafa", border:`1px solid ${col}30`, borderLeft:`4px solid ${col}`, borderRadius:"3px", padding:"0.9rem 1.1rem", cursor:"pointer", transition:"background 0.15s", marginBottom:"0.75rem" }}
          onMouseEnter={e => e.currentTarget.style.background="#f0faf4"}
          onMouseLeave={e => e.currentTarget.style.background="#fafafa"}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:"0.4rem" }}>
            <div>
              <span style={{ fontFamily:"'Cinzel',serif", fontSize:"0.95rem", fontWeight:"700", color:"#1e6b3c" }}>{r.mataiTitle || "—"}</span>
              <span style={{ fontSize:"0.82rem", color:"rgba(26,26,26,0.6)", marginLeft:"0.5rem" }}>{r.holderName}</span>
            </div>
            <div style={{ display:"flex", alignItems:"center", gap:"0.5rem" }}>
              <span style={{ fontFamily:"'Cinzel',serif", fontSize:"0.68rem", fontWeight:"700", color:col, letterSpacing:"0.06em", background:`${col}15`, padding:"2px 8px", borderRadius:"2px", whiteSpace:"nowrap" }}>
                {urgencyLabel(days, r)}
              </span>
              <span style={{ fontSize:"0.7rem", color:"#1e6b3c", fontFamily:"'Cinzel',serif" }}>→ View</span>
            </div>
          </div>
          <div style={{ display:"flex", gap:"1.5rem", flexWrap:"wrap" }}>
            <span style={{ fontSize:"0.78rem", color:"rgba(26,26,26,0.55)" }}>📍 {r.village}, {r.district}</span>
            <span style={{ fontSize:"0.78rem", color:"rgba(26,26,26,0.55)" }}>🗓 Proclamation: <strong style={{ color:col }}>{fmtDate(r.dateProclamation)}</strong></span>
            {r.mataiCertNumber && <span style={{ fontSize:"0.78rem", color:"rgba(26,26,26,0.45)" }}>Cert: {r.mataiCertNumber}</span>}
          </div>
        </div>
      </Link>
    );
  };

  const ObjectionRow = ({ r }) => (
    <Link to={`/register/${r.id}`} style={{ textDecoration:"none", display:"block" }}>
      <div style={{ background:"#fdf8f8", border:"1px solid #e8b4b430", borderLeft:"4px solid #8b1a1a", borderRadius:"3px", padding:"0.9rem 1.1rem", cursor:"pointer", marginBottom:"0.75rem" }}
        onMouseEnter={e => e.currentTarget.style.background="#fdf0f0"}
        onMouseLeave={e => e.currentTarget.style.background="#fdf8f8"}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:"0.4rem" }}>
          <div>
            <span style={{ fontFamily:"'Cinzel',serif", fontSize:"0.95rem", fontWeight:"700", color:"#8b1a1a" }}>{r.mataiTitle || "—"}</span>
            <span style={{ fontSize:"0.82rem", color:"rgba(26,26,26,0.6)", marginLeft:"0.5rem" }}>{r.holderName}</span>
          </div>
          <span style={{ fontFamily:"'Cinzel',serif", fontSize:"0.68rem", fontWeight:"700", color:"#8b1a1a", background:"#8b1a1a15", padding:"2px 8px", borderRadius:"2px" }}>
            ⚠ OBJECTION
          </span>
        </div>
        <div style={{ display:"flex", gap:"1.5rem", flexWrap:"wrap" }}>
          <span style={{ fontSize:"0.78rem", color:"rgba(26,26,26,0.55)" }}>📍 {r.village}, {r.district}</span>
          <span style={{ fontSize:"0.78rem", color:"rgba(26,26,26,0.55)" }}>🗓 Proclaimed: {fmtDate(r.dateProclamation)}</span>
          <span style={{ fontSize:"0.78rem", color:"#8b1a1a" }}>📋 Objection recorded: {fmtDate(r.objectionDate)}</span>
        </div>
        <div style={{ marginTop:"0.5rem", fontSize:"0.78rem", color:"#8b1a1a", fontStyle:"italic" }}>
          Cannot be registered — must proceed through court
        </div>
      </div>
    </Link>
  );

  return (
    <div className="app-layout">
      <div className="pattern-bg" />
      <Sidebar userRole={userRole} userEmail={user?.email} />
      <div className="sidebar-content">
        <div style={{ marginBottom:"2rem" }}>
          <p style={{ fontFamily:"'Cinzel',serif", fontSize:"0.7rem", letterSpacing:"0.25em", color:"#1e6b3c", textTransform:"uppercase", marginBottom:"0.4rem" }}>
            Automated Alerts
          </p>
          <h1 style={{ fontFamily:"'Cinzel Decorative',serif", fontSize:"1.8rem", color:"#1a1a1a" }}>
            Notifications
          </h1>
        </div>

        {/* Monthly run day banner */}
        {isMonthlyRunDay() && monthlyReady.length > 0 && (
          <div style={{ background:"#f0faf4", border:"1px solid #1e6b3c", borderLeft:"4px solid #1e6b3c", borderRadius:"4px", padding:"1rem 1.25rem", marginBottom:"1.5rem" }}>
            <p style={{ fontFamily:"'Cinzel',serif", fontSize:"0.72rem", letterSpacing:"0.15em", color:"#1e6b3c", textTransform:"uppercase", marginBottom:"0.4rem" }}>
              📅 Monthly Report Day
            </p>
            <p style={{ fontSize:"0.88rem", color:"#1a5c35" }}>
              Today is the monthly registration report date. <strong>{monthlyReady.length} records</strong> are ready to register (proclamation period complete, no objection). View them in the <strong>Monthly Report</strong> tab.
            </p>
          </div>
        )}

        <div style={{ display:"grid", gridTemplateColumns:"1fr 340px", gap:"1.5rem", alignItems:"start" }}>
          <div>
            {/* Tabs */}
            <div style={{ display:"flex", gap:"0.5rem", marginBottom:"1.25rem", flexWrap:"wrap" }}>
              {tabBtn("proclamation", "Proclamation Alerts", sorted.length)}
              {tabBtn("objection",    "Objections",          objectionRecords.length, "#8b1a1a")}
              {tabBtn("monthly",      "Monthly Report",       monthlyReady.length, "#1a5c35")}
            </div>

            {/* ── Proclamation tab ── */}
            {activeTab === "proclamation" && (<>
              <div style={sStyle}>
                <p style={{ fontFamily:"'Cinzel',serif", fontSize:"0.68rem", letterSpacing:"0.15em", color:"#1e6b3c", textTransform:"uppercase", marginBottom:"0.75rem" }}>◈ Alert Window</p>
                <div style={{ display:"flex", gap:"0.5rem", flexWrap:"wrap" }}>
                  {[30,60,90,120,180,365].map(d => (
                    <button key={d} onClick={() => setFilterWindow(d)} style={{
                      padding:"0.4rem 0.9rem", fontFamily:"'Cinzel',serif", fontSize:"0.68rem",
                      letterSpacing:"0.08em", textTransform:"uppercase", cursor:"pointer", borderRadius:"2px",
                      border: filterWindow===d ? "1px solid #1e6b3c" : "1px solid rgba(30,107,60,0.2)",
                      background: filterWindow===d ? "rgba(30,107,60,0.1)" : "transparent",
                      color: filterWindow===d ? "#1e6b3c" : "rgba(26,26,26,0.5)"
                    }}>
                      {d === 365 ? "1 year" : `${d} days`}
                    </button>
                  ))}
                </div>
              </div>
              <div style={sStyle}>
                <p style={{ fontFamily:"'Cinzel',serif", fontSize:"0.68rem", letterSpacing:"0.15em", color:"#1e6b3c", textTransform:"uppercase", marginBottom:"1rem" }}>
                  ◈ {sorted.length} Record{sorted.length !== 1 ? "s" : ""} Requiring Attention
                </p>
                {loading ? <p style={{ color:"rgba(30,107,60,0.6)", fontStyle:"italic" }}>Loading…</p>
                : sorted.length === 0
                  ? <div style={{ textAlign:"center", padding:"3rem", color:"rgba(26,26,26,0.4)", fontStyle:"italic" }}>✅ No records within {filterWindow} days.</div>
                  : sorted.map(r => <RecordRow key={r.id} r={r} />)
                }
              </div>
            </>)}

            {/* ── Objection tab ── */}
            {activeTab === "objection" && (
              <div style={sStyle}>
                <p style={{ fontFamily:"'Cinzel',serif", fontSize:"0.68rem", letterSpacing:"0.15em", color:"#8b1a1a", textTransform:"uppercase", marginBottom:"0.5rem" }}>
                  ◈ {objectionRecords.length} Objection{objectionRecords.length !== 1 ? "s" : ""} Recorded
                </p>
                <p style={{ fontSize:"0.8rem", color:"rgba(26,26,26,0.5)", marginBottom:"1.25rem" }}>
                  These titles have an objection recorded. They cannot be registered and must go through court proceedings.
                </p>
                {loading ? <p style={{ color:"rgba(30,107,60,0.6)", fontStyle:"italic" }}>Loading…</p>
                : objectionRecords.length === 0
                  ? <div style={{ textAlign:"center", padding:"3rem", color:"rgba(26,26,26,0.4)", fontStyle:"italic" }}>✅ No objections recorded.</div>
                  : objectionRecords.map(r => <ObjectionRow key={r.id} r={r} />)
                }
              </div>
            )}

            {/* ── Monthly report tab ── */}
            {activeTab === "monthly" && (
              <div style={sStyle}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"0.75rem" }}>
                  <p style={{ fontFamily:"'Cinzel',serif", fontSize:"0.68rem", letterSpacing:"0.15em", color:"#1e6b3c", textTransform:"uppercase" }}>
                    ◈ Ready to Register — {monthlyReady.length} Record{monthlyReady.length !== 1 ? "s" : ""}
                  </p>
                  {monthlyReady.length > 0 && (
                    <button className="btn-primary" style={{ fontSize:"0.72rem", padding:"0.4rem 1rem" }}
                      onClick={() => {
                        const win = window.open("", "_blank");
                        const today = fmtDate(new Date().toISOString().split("T")[0]);
                        const genBy = user?.displayName || user?.email || "Unknown";
                        win.document.write(`<!DOCTYPE html><html><head>
                          <title>Monthly Matai Report</title>
                          <style>
                            body{font-family:Georgia,serif;padding:2rem;color:#1a1208;}
                            h1{font-size:1.2rem;color:#1a5c35;text-transform:uppercase;letter-spacing:0.1em;}
                            .meta{font-size:0.8rem;color:#666;margin-bottom:1.5rem;}
                            table{width:100%;border-collapse:collapse;font-size:0.82rem;}
                            th{background:#1a5c35;color:#fff;padding:0.5rem 0.75rem;text-align:left;}
                            td{padding:0.45rem 0.75rem;border-bottom:1px solid #ddd;}
                            tr:nth-child(even) td{background:#f0faf4;}
                            @media print{@page{margin:1.5cm;}}
                          </style>
                        </head><body>
                          <h1>Monthly Registration Report</h1>
                          <div class="meta">Generated: ${today} &nbsp;|&nbsp; By: ${genBy} &nbsp;|&nbsp; Records: ${monthlyReady.length}</div>
                          <table>
                            <thead><tr><th>#</th><th>Matai Title</th><th>Holder</th><th>Village</th><th>District</th><th>Proclaimed</th><th>Reg. Date</th></tr></thead>
                            <tbody>
                              ${monthlyReady.map((r,i) => `<tr><td>${i+1}</td><td><strong>${r.mataiTitle||"—"}</strong></td><td>${r.holderName||"—"}</td><td>${r.village||"—"}</td><td>${r.district||"—"}</td><td>${fmtDate(r.dateProclamation)}</td><td>${fmtDate(r.dateRegistration)||"—"}</td></tr>`).join("")}
                            </tbody>
                          </table>
                          <script>window.onload=()=>{window.print();}<\/script>
                        </body></html>`);
                        win.document.close();
                        logAudit("MONTHLY_REPORT", { count: monthlyReady.length, generatedBy: genBy });
                      }}
                    >
                      📄 Print Monthly Report
                    </button>
                  )}
                </div>
                <p style={{ fontSize:"0.8rem", color:"rgba(26,26,26,0.5)", marginBottom:"1.25rem" }}>
                  Records where proclamation period (4 months) has passed with no objection — ready for registration. Monthly reports run on the <strong>29th of each month</strong> (28th in a leap year February).
                </p>
                {loading ? <p style={{ color:"rgba(30,107,60,0.6)", fontStyle:"italic" }}>Loading…</p>
                : monthlyReady.length === 0
                  ? <div style={{ textAlign:"center", padding:"3rem", color:"rgba(26,26,26,0.4)", fontStyle:"italic" }}>✅ No records ready for this month's report.</div>
                  : monthlyReady.map(r => (
                    <Link key={r.id} to={`/register/${r.id}`} style={{ textDecoration:"none", display:"block" }}>
                      <div style={{ background:"#f0faf4", border:"1px solid #a7d7b8", borderLeft:"4px solid #1e6b3c", borderRadius:"3px", padding:"0.9rem 1.1rem", cursor:"pointer", marginBottom:"0.75rem" }}
                        onMouseEnter={e => e.currentTarget.style.background="#e8f5ee"}
                        onMouseLeave={e => e.currentTarget.style.background="#f0faf4"}>
                        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                          <div>
                            <span style={{ fontFamily:"'Cinzel',serif", fontSize:"0.95rem", fontWeight:"700", color:"#1e6b3c" }}>{r.mataiTitle || "—"}</span>
                            <span style={{ fontSize:"0.82rem", color:"rgba(26,26,26,0.6)", marginLeft:"0.5rem" }}>{r.holderName}</span>
                          </div>
                          <span style={{ fontFamily:"'Cinzel',serif", fontSize:"0.68rem", color:"#1e6b3c" }}>✅ READY → Edit</span>
                        </div>
                        <div style={{ display:"flex", gap:"1.5rem", flexWrap:"wrap", marginTop:"0.4rem" }}>
                          <span style={{ fontSize:"0.78rem", color:"rgba(26,26,26,0.55)" }}>📍 {r.village}, {r.district}</span>
                          <span style={{ fontSize:"0.78rem", color:"rgba(26,26,26,0.55)" }}>🗓 Proclaimed: {fmtDate(r.dateProclamation)}</span>
                          <span style={{ fontSize:"0.78rem", color:"#1a5c35" }}>📋 Reg. date: {fmtDate(r.dateRegistration) || "—"}</span>
                        </div>
                      </div>
                    </Link>
                  ))
                }
              </div>
            )}
          </div>

          {/* Right panel — stats + email */}
          <div style={{ ...sStyle, position:"sticky", top:"2rem" }}>
            <p style={{ fontFamily:"'Cinzel',serif", fontSize:"0.68rem", letterSpacing:"0.15em", color:"#1e6b3c", textTransform:"uppercase", marginBottom:"1rem" }}>
              ◈ Summary
            </p>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"0.5rem", marginBottom:"1.25rem" }}>
              {[
                ["Overdue",      sorted.filter(r => isOverdue(r)).length, "#8b1a1a"],
                ["Objections",   objectionRecords.length,                  "#8b1a1a"],
                ["≤ 30 days",    sorted.filter(r => { const d = daysUntil(r.dateProclamation); return d !== null && d >= 0 && d <= 30; }).length, "#c0392b"],
                ["Ready",        monthlyReady.length,                      "#1e6b3c"],
              ].map(([label, count, col]) => (
                <div key={label} style={{ background:`${col}08`, border:`1px solid ${col}30`, borderRadius:"3px", padding:"0.6rem 0.75rem", textAlign:"center" }}>
                  <p style={{ fontFamily:"'Cinzel Decorative',serif", fontSize:"1.4rem", color:col }}>{count}</p>
                  <p style={{ fontFamily:"'Cinzel',serif", fontSize:"0.58rem", color:col, letterSpacing:"0.08em", textTransform:"uppercase" }}>{label}</p>
                </div>
              ))}
            </div>

            <p style={{ fontFamily:"'Cinzel',serif", fontSize:"0.65rem", letterSpacing:"0.12em", color:"#1e6b3c", textTransform:"uppercase", marginBottom:"0.5rem" }}>
              Send Email Report
            </p>
            <div className="form-group" style={{ marginBottom:"0.75rem" }}>
              <label>Recipient Email</label>
              <input type="email" value={recipientEmail} onChange={e => setRecipientEmail(e.target.value)}
                placeholder="recipient@example.com" />
            </div>
            {!isEmailJSConfigured() && (
              <div style={{ background:"#fffbf0", border:"1px solid #d68910", borderRadius:"3px", padding:"0.65rem 0.75rem", marginBottom:"0.75rem", fontSize:"0.75rem", color:"#5a3e00" }}>
                ⚠ EmailJS not configured — emails will open your default mail client.{" "}
                <a href="https://www.emailjs.com" target="_blank" rel="noreferrer" style={{ color:"#1e6b3c" }}>Set up EmailJS</a>
              </div>
            )}

            <button
              className="btn-primary"
              style={{ width:"100%", fontSize:"0.75rem", marginBottom:"0.6rem", opacity: sending ? 0.7 : 1 }}
              disabled={!recipientEmail.trim() || sorted.length === 0 || sending}
              onClick={() => handleSendEmail(sorted, "proclamation")}>
              {sending ? "Sending…" : `📧 Email Proclamation Report (${sorted.length})`}
            </button>

            <button
              style={{ width:"100%", fontSize:"0.75rem", padding:"0.55rem", fontFamily:"'Cinzel',serif", letterSpacing:"0.08em", textTransform:"uppercase", background: sending ? "#8b1a1a08" : "#8b1a1a10", border:"1px solid #8b1a1a30", color:"#8b1a1a", borderRadius:"3px", cursor: sending || objectionRecords.length === 0 || !recipientEmail.trim() ? "not-allowed" : "pointer", opacity: sending ? 0.7 : 1 }}
              disabled={!recipientEmail.trim() || objectionRecords.length === 0 || sending}
              onClick={() => handleSendEmail(objectionRecords, "objection")}>
              {sending ? "Sending…" : `⚠ Email Objections Report (${objectionRecords.length})`}
            </button>

            {sendResult && (
              <div style={{ marginTop:"0.6rem", padding:"0.6rem 0.75rem", borderRadius:"3px", fontSize:"0.8rem", background: sendResult.ok ? "#f0faf4" : "#fdf0f0", border: `1px solid ${sendResult.ok ? "#a7d7b8" : "#e8b4b4"}`, color: sendResult.ok ? "#1a5c35" : "#8b1a1a" }}>
                {sendResult.msg}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

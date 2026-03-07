import { useState, useEffect } from "react";
import { collection, getDocs } from "firebase/firestore";
import { auth, db } from "../firebase";
import { getPermissions } from "../utils/roles";
import { logAudit } from "../utils/audit";
import Sidebar from "../components/Sidebar";
import { Navigate, Link } from "react-router-dom";
import { cacheGet, cacheSet } from "../utils/cache";

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

// Build the email body as plain text
function buildEmailBody(records) {
  const lines = [
    "MATAI REGISTRY — PROCLAMATION REMINDER",
    "Resitalaina o Matai — Automated Notification",
    "",
    `Generated: ${fmtDate(new Date().toISOString().split("T")[0])}`,
    `Records requiring attention: ${records.length}`,
    "",
    "The following Matai titles have a Proclamation date (Aso Faasalalau le Savali)",
    "that is within 4 months. Please ensure records are registered and up to date.",
    "",
    "─".repeat(60),
    "",
  ];
  records.forEach((r, i) => {
    const days = daysUntil(r.dateProclamation);
    lines.push(`${i+1}. ${r.mataiTitle || "—"}`);
    lines.push(`   Holder: ${r.holderName || "—"}`);
    lines.push(`   Village: ${r.village || "—"}, District: ${r.district || "—"}`);
    lines.push(`   Ref No: ${r.refNumber || "—"}`);
    lines.push(`   Aso Faasalalau le Savali: ${fmtDate(r.dateProclamation)} (${days !== null ? (days < 0 ? `${Math.abs(days)} days overdue` : `${days} days remaining`) : "—"})`);
    lines.push(`   Date Registered: ${fmtDate(r.dateRegistration)}`);
    lines.push("");
  });
  lines.push("─".repeat(60));
  lines.push("");
  lines.push("Please log in to the Matai Registry to update records:");
  lines.push("https://amiliontechnology-bit.github.io/matai-registry");
  lines.push("");
  lines.push("This is an automated notification from the Matai Registry System.");
  lines.push("Matagaluega o Faamasinoga ma le Faafoeina o Tulaga Tau Faamasinoga");
  return lines.join("\n");
}

export default function Notifications({ userRole }) {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [recipientEmail, setRecipientEmail] = useState("");
  const [customMessage, setCustomMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [filterWindow, setFilterWindow] = useState(120); // days
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

  // Filter records where dateProclamation is within the window (past or future within range)
  const alertRecords = records.filter(r => {
    if (!r.dateProclamation) return false;
    const days = daysUntil(r.dateProclamation);
    return days !== null && days <= filterWindow;
  });

  // Sort: overdue first, then soonest
  const sorted = [...alertRecords].sort((a, b) => {
    const da = daysUntil(a.dateProclamation) || 0;
    const db_ = daysUntil(b.dateProclamation) || 0;
    return da - db_;
  });

  const handleSendEmail = () => {
    if (!recipientEmail.trim()) return;
    const subject = encodeURIComponent(`Matai Registry — ${sorted.length} Records Require Attention`);
    const body = encodeURIComponent(
      (customMessage ? customMessage + "\n\n" : "") + buildEmailBody(sorted)
    );
    // Opens default email client with pre-filled content
    window.location.href = `mailto:${recipientEmail}?subject=${subject}&body=${body}`;
    logAudit("NOTIFICATION_SENT", { recipientEmail, count: sorted.length });
    setSent(true);
    setTimeout(() => setSent(false), 4000);
  };

  const urgencyColor = (days) => {
    if (days === null) return "rgba(26,26,26,0.4)";
    if (days < 0)   return "#8b1a1a";   // overdue
    if (days <= 30) return "#c0392b";   // critical
    if (days <= 60) return "#d68910";   // warning
    return "#1e6b3c";                   // ok
  };

  const urgencyLabel = (days) => {
    if (days === null) return "—";
    if (days < 0)   return `${Math.abs(days)}d OVERDUE`;
    if (days === 0) return "TODAY";
    return `${days} days`;
  };

  const sStyle = { background:"#ffffff", border:"1px solid rgba(30,107,60,0.2)", borderRadius:"4px", padding:"1.5rem", marginBottom:"1.5rem", boxShadow:"0 1px 4px rgba(0,0,0,0.05)" };

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
            Proclamation Notifications
          </h1>
        </div>

        <div style={{ display:"grid", gridTemplateColumns:"1fr 340px", gap:"1.5rem", alignItems:"start" }}>

          {/* Left — records list */}
          <div>
            {/* Filter window selector */}
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
              <p style={{ fontSize:"0.8rem", color:"rgba(26,26,26,0.5)", marginTop:"0.6rem" }}>
                Showing records where <strong>Aso Faasalalau le Savali</strong> is within {filterWindow} days (including overdue).
              </p>
            </div>

            {/* Records */}
            <div style={sStyle}>
              <p style={{ fontFamily:"'Cinzel',serif", fontSize:"0.68rem", letterSpacing:"0.15em", color:"#1e6b3c", textTransform:"uppercase", marginBottom:"1rem" }}>
                ◈ {sorted.length} Record{sorted.length !== 1 ? "s" : ""} Requiring Attention
              </p>

              {loading ? (
                <p style={{ color:"rgba(30,107,60,0.6)", fontStyle:"italic" }}>Loading…</p>
              ) : sorted.length === 0 ? (
                <div style={{ textAlign:"center", padding:"3rem", color:"rgba(26,26,26,0.4)", fontStyle:"italic" }}>
                  ✅ No records with proclamation dates within {filterWindow} days.
                </div>
              ) : (
                <div style={{ display:"flex", flexDirection:"column", gap:"0.75rem" }}>
                  {sorted.map(r => {
                    const days = daysUntil(r.dateProclamation);
                    const col = urgencyColor(days);
                    return (
                      <Link key={r.id} to={`/certificate/${r.id}`} style={{ textDecoration:"none", display:"block" }}>
                        <div style={{ background:"#fafafa", border:`1px solid ${col}30`, borderLeft:`4px solid ${col}`, borderRadius:"3px", padding:"0.9rem 1.1rem", cursor:"pointer", transition:"background 0.15s" }}
                          onMouseEnter={e => e.currentTarget.style.background="#f0faf4"}
                          onMouseLeave={e => e.currentTarget.style.background="#fafafa"}>
                          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:"0.4rem" }}>
                            <div>
                              <span style={{ fontFamily:"'Cinzel',serif", fontSize:"0.95rem", fontWeight:"700", color:"#1e6b3c" }}>{r.mataiTitle || "—"}</span>
                              <span style={{ fontSize:"0.82rem", color:"rgba(26,26,26,0.6)", marginLeft:"0.5rem" }}>{r.holderName}</span>
                            </div>
                            <div style={{ display:"flex", alignItems:"center", gap:"0.5rem" }}>
                              <span style={{ fontFamily:"'Cinzel',serif", fontSize:"0.68rem", fontWeight:"700", color:col, letterSpacing:"0.06em", background:`${col}15`, padding:"2px 8px", borderRadius:"2px", whiteSpace:"nowrap" }}>
                                {urgencyLabel(days)}
                              </span>
                              <span style={{ fontSize:"0.7rem", color:"#1e6b3c", fontFamily:"'Cinzel',serif" }}>→ View</span>
                            </div>
                          </div>
                          <div style={{ display:"flex", gap:"1.5rem", flexWrap:"wrap" }}>
                            <span style={{ fontSize:"0.78rem", color:"rgba(26,26,26,0.55)" }}>📍 {r.village}, {r.district}</span>
                            <span style={{ fontSize:"0.78rem", color:"rgba(26,26,26,0.55)" }}>🗓 Proclamation: <strong style={{ color:col }}>{fmtDate(r.dateProclamation)}</strong></span>
                            {r.mataiCertNumber && <span style={{ fontSize:"0.78rem", color:"rgba(26,26,26,0.45)" }}>Cert: {r.mataiCertNumber}</span>}
                            {r.printedAt && <span style={{ fontSize:"0.78rem", color:"#1e6b3c" }}>✓ Printed {fmtDate(r.printedAt)}</span>}
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Right — send notification */}
          <div style={{ ...sStyle, position:"sticky", top:"2rem" }}>
            <p style={{ fontFamily:"'Cinzel',serif", fontSize:"0.68rem", letterSpacing:"0.15em", color:"#1e6b3c", textTransform:"uppercase", marginBottom:"1rem" }}>
              ◈ Send Notification Email
            </p>

            {/* Stats */}
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"0.5rem", marginBottom:"1.25rem" }}>
              {[
                ["Overdue", sorted.filter(r => (daysUntil(r.dateProclamation)||0) < 0).length, "#8b1a1a"],
                ["≤ 30 days", sorted.filter(r => { const d = daysUntil(r.dateProclamation); return d !== null && d >= 0 && d <= 30; }).length, "#c0392b"],
                ["≤ 60 days", sorted.filter(r => { const d = daysUntil(r.dateProclamation); return d !== null && d > 30 && d <= 60; }).length, "#d68910"],
                ["≤ 120 days", sorted.filter(r => { const d = daysUntil(r.dateProclamation); return d !== null && d > 60; }).length, "#1e6b3c"],
              ].map(([label, count, col]) => (
                <div key={label} style={{ background:`${col}08`, border:`1px solid ${col}30`, borderRadius:"3px", padding:"0.6rem 0.75rem", textAlign:"center" }}>
                  <p style={{ fontFamily:"'Cinzel Decorative',serif", fontSize:"1.4rem", color:col }}>{count}</p>
                  <p style={{ fontFamily:"'Cinzel',serif", fontSize:"0.58rem", color:`${col}`, letterSpacing:"0.08em", textTransform:"uppercase" }}>{label}</p>
                </div>
              ))}
            </div>

            <div className="form-group" style={{ marginBottom:"1rem" }}>
              <label>Recipient Email</label>
              <input type="email" value={recipientEmail} onChange={e => setRecipientEmail(e.target.value)}
                placeholder="recipient@example.com" />
            </div>

            <div className="form-group" style={{ marginBottom:"1.25rem" }}>
              <label>Additional Message (optional)</label>
              <textarea rows={3} value={customMessage} onChange={e => setCustomMessage(e.target.value)}
                placeholder="Add a personal note to include at the top of the email…"
                style={{ resize:"vertical", background:"#fff", border:"1px solid rgba(30,107,60,0.3)", color:"#1a1a1a", padding:"0.75rem", fontSize:"0.9rem", borderRadius:"2px", width:"100%" }} />
            </div>

            <button
              className="btn-primary"
              style={{ width:"100%", fontSize:"0.78rem", marginBottom:"0.75rem" }}
              disabled={!recipientEmail.trim() || sorted.length === 0}
              onClick={handleSendEmail}
            >
              📧 Open Email with Report
            </button>

            {sent && (
              <div className="alert alert-success" style={{ fontSize:"0.82rem" }}>
                ✓ Email client opened with report attached.
              </div>
            )}

            <p style={{ fontSize:"0.72rem", color:"rgba(26,26,26,0.4)", marginTop:"0.5rem", fontStyle:"italic", lineHeight:1.5 }}>
              Opens your default email client (Outlook, Gmail, etc.) pre-filled with the report. The recipient will receive a full list of records requiring attention.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

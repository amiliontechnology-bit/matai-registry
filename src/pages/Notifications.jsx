import { useState, useEffect } from "react";
import { collection, getDocs, doc, updateDoc, deleteDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../firebase";
import { getPermissions } from "../utils/roles";
import { logAudit } from "../utils/audit";
import { Link, Navigate, useLocation } from "react-router-dom";
import { cacheClear, cacheGet, cacheSet, cachedFetch } from "../utils/cache";
import Sidebar from "../components/Sidebar";

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
  const p = new Date(proclamationStr + "T00:00:00");
  const target = new Date(p.getFullYear(), p.getMonth() + 4, 1);
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  const day = Math.min(29, lastDay);
  const reg = new Date(target.getFullYear(), target.getMonth(), day);
  return `${reg.getFullYear()}-${String(reg.getMonth()+1).padStart(2,"0")}-${String(reg.getDate()).padStart(2,"0")}`;
}

function regDateIfPassed(proclamationStr) {
  const d = autoRegDate(proclamationStr);
  if (!d) return null;
  const reg = new Date(d + "T00:00:00");
  const today = new Date(); today.setHours(0,0,0,0);
  return reg <= today ? d : null;
}

// Effective registration date: use stored value or auto-calculate if period passed
function effectiveRegDate(r) {
  if (r.dateRegistration) return r.dateRegistration;
  if (r.objection === "yes") return null;
  return regDateIfPassed(r.dateProclamation);
}

function isMonthlyRunDay() {
  const now = new Date();
  const yr = now.getFullYear(), mo = now.getMonth(), day = now.getDate();
  const isLeap = (yr%4===0 && yr%100!==0) || yr%400===0;
  return (mo === 1 && isLeap) ? day === 28 : day === 29;
}

function openPDF(title, html) {
  const blob = new Blob([html], { type: "text/html" });
  const url  = URL.createObjectURL(blob);
  const win  = window.open(url, "_blank");
  if (win) win.addEventListener("load", () => URL.revokeObjectURL(url), { once: true });
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
    <img src="${window.location.origin}/mjca_logo.jpeg" alt="Emblem"/>
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
  const location = useLocation();
  const [records, setRecords]           = useState([]);
  const [loading, setLoading]           = useState(true);
  const [filterWindow, setFilterWindow] = useState(120);
  const [confirming, setConfirming] = useState(null);
  const [activeTab, setActiveTab]       = useState(location.state?.tab || "proclamation");
  const [alertPage, setAlertPage]       = useState(1);
  const [objPage, setObjPage]           = useState(1);
  const [readyPage, setReadyPage]       = useState(1);
  const N_PAGE = 20;
  const perms = getPermissions(userRole);
  const user  = auth.currentUser;

  if (userRole === null) return null;
  if (!perms.canViewNotifications) return <Navigate to="/dashboard" />;

  useEffect(() => {
    (async () => {
      try {
        const cached = cacheGet("registrations");
        if (cached) { setRecords(cached); setLoading(false); return; }
        const snap = await getDocs(collection(db, "registrations"));
        const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        data.sort((a,b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
        cacheSet("registrations", data);
        setRecords(data);
      } catch(err) { console.error(err); }
      finally { setLoading(false); }
    })();
  }, []);

  const genBy = user?.displayName || user?.email || "Admin";

  const confirmRegistration = async (r) => {
    const regDate = effectiveRegDate(r);
    if (!regDate) return;
    if (!window.confirm(`Confirm registration of ${r.mataiTitle} on ${fmtDate(regDate)}?`)) return;
    setConfirming(r.id);
    try {
      await updateDoc(doc(db, "registrations", r.id), {
        dateRegistration: regDate,
        status: "completed",
        updatedAt: serverTimestamp(),
        confirmedBy: genBy,
        confirmedAt: serverTimestamp(),
      });
      await logAudit("CONFIRM_REGISTRATION", { mataiTitle: r.mataiTitle, dateRegistration: regDate, recordId: r.id });
      cacheClear("registrations");
      // Remove from local records
      setRecords(prev => prev.map(rec => rec.id === r.id
        ? { ...rec, dateRegistration: regDate, status: "completed" }
        : rec
      ));
    } catch(err) {
      alert("Failed to confirm: " + err.message);
    } finally {
      setConfirming(null);
    }
  };

  // ── Data cuts ──────────────────────────────────────────

  // Proclamation alerts: records within the filter window OR overdue (past reg date, not yet confirmed)
  // daysUntilReg = days from today until auto reg date (positive = still in period, negative = overdue/past)
  const daysUntilReg = (r) => {
    const rd = autoRegDate(r.dateProclamation);
    if (!rd) return null;
    return Math.ceil((new Date(rd + "T00:00:00") - new Date()) / (1000*60*60*24));
  };
  const alertRecords = records.filter(r => {
    if (r.objection === "yes") return false;
    if (r.dateRegistration) return false;
    if (!r.dateProclamation) return false;
    // Include overdue records (period passed, not yet confirmed) — they show as red "Xd OVERDUE"
    // They also appear in Ready to Register for confirmation
    const days = daysUntilReg(r);
    return days !== null && days <= filterWindow;
  }).sort((a,b) => (daysUntilReg(a)||0) - (daysUntilReg(b)||0));

  // Objection records
  const objectionRecords = records.filter(r => r.objection === "yes");

  // Duplicate cert number records — check mataiCertNumber OR compose from parts
  const certNumberMap = new Map();
  const duplicateGroups = [];
  records.forEach(r => {
    // Use stored combined field, or build it from the 3 parts
    const composed = [r.certItumalo, r.certLaupepa, r.certRegBook].filter(Boolean).join("/");
    const key = (r.mataiCertNumber || composed || "").trim();
    if (!key) return;
    if (!certNumberMap.has(key)) certNumberMap.set(key, []);
    certNumberMap.get(key).push(r);
  });
  certNumberMap.forEach((group, certNum) => {
    if (group.length > 1) duplicateGroups.push({ certNum, records: group });
  });

  // Monthly — New Matai titles: entered but NO proclamation date yet (brand new entries)
  const newMataiRecords = records.filter(r => !r.dateProclamation && !r.dateRegistration && r.objection !== "yes");

  // Monthly — Ready to register: 4 months past proclamation, no objection, not yet registered
  const readyToRegister = records.filter(r => {
    if (r.objection === "yes") return false;
    if (r.status === "completed") return false;
    if (r.dateRegistration) return false;
    if (!r.dateProclamation) return false;
    return !!effectiveRegDate(r);           // reg date has passed — period complete
  });

  // Monthly registered — completed this calendar month (stored or auto-calculated)
  const now_m = new Date();
  const completedThisMonth = records.filter(r => {
    const regDate = r.dateRegistration || effectiveRegDate(r);
    if (!regDate) return false;
    const parts = regDate.split("-");
    if (parts.length < 2) return false;
    return parseInt(parts[0]) === now_m.getFullYear() && parseInt(parts[1]) === (now_m.getMonth()+1);
  });

  // Already registered — status completed or has dateRegistration
  const registeredRecords = records.filter(r =>
    r.status === "completed" || r.dateRegistration
  ).sort((a,b) => {
    const da = a.dateRegistration || ""; const db2 = b.dateRegistration || "";
    return db2.localeCompare(da);
  });

  // Paged slices
  const alertTotalPages = Math.ceil(alertRecords.length / N_PAGE);
  const alertPageSafe   = Math.min(alertPage, Math.max(1, alertTotalPages));
  const alertPaged      = alertRecords.slice((alertPageSafe-1)*N_PAGE, alertPageSafe*N_PAGE);

  const objTotalPages   = Math.ceil(objectionRecords.length / N_PAGE);
  const objPageSafe     = Math.min(objPage, Math.max(1, objTotalPages));
  const objPaged        = objectionRecords.slice((objPageSafe-1)*N_PAGE, objPageSafe*N_PAGE);

  const readyTotalPages = Math.ceil(readyToRegister.length / N_PAGE);
  const readyPageSafe   = Math.min(readyPage, Math.max(1, readyTotalPages));
  const readyPaged      = readyToRegister.slice((readyPageSafe-1)*N_PAGE, readyPageSafe*N_PAGE);

  const Pager = ({ page, totalPages, setPage }) => {
    if (totalPages <= 1) return null;
    return (
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginTop:"0.75rem", paddingTop:"0.75rem", borderTop:"1px solid rgba(30,107,60,0.15)" }}>
        <span style={{ fontFamily:"'Cinzel',serif", fontSize:"0.62rem", color:"#6b7280", letterSpacing:"0.08em" }}>Page {page} of {totalPages}</span>
        <div style={{ display:"flex", gap:"0.25rem" }}>
          {[
            { label:"«", action:() => setPage(1), disabled: page===1 },
            { label:"‹", action:() => setPage(p => Math.max(1,p-1)), disabled: page===1 },
            { label:"›", action:() => setPage(p => Math.min(totalPages,p+1)), disabled: page===totalPages },
            { label:"»", action:() => setPage(totalPages), disabled: page===totalPages },
          ].map(({ label, action, disabled }) => (
            <button key={label} onClick={action} disabled={disabled} style={{ padding:"0.25rem 0.55rem", fontFamily:"'Cinzel',serif", fontSize:"0.7rem", background: disabled?"#f3f4f6":"#fff", color: disabled?"#9ca3af":"#1e6b3c", border:`1px solid ${disabled?"#e5e7eb":"rgba(30,107,60,0.3)"}`, borderRadius:"3px", cursor: disabled?"not-allowed":"pointer" }}>{label}</button>
          ))}
        </div>
      </div>
    );
  };

  // ── Urgency helpers ────────────────────────────────────
  // days = days until REGISTRATION DATE (positive = still in proclamation period, negative = overdue/past)
  const urgencyColor = (days) => {
    if (days === null) return "rgba(26,26,26,0.4)";
    if (days < 0)     return "#c0392b";   // overdue — reg date passed, not yet confirmed
    if (days <= 30)   return "#d68910";   // < 30 days to reg — approaching
    return "#1e6b3c";                     // still in proclamation period — ok
  };
  const urgencyBg = (days) => {
    if (days === null) return "#fafafa";
    if (days < 0)     return "#fff5f5";   // overdue — light red bg
    if (days <= 30)   return "#fffbeb";   // approaching — light yellow bg
    return "#f0faf4";                     // in period — light green bg
  };
  const urgencyLabel = (days) => {
    if (days === null) return "—";
    if (days < 0)     return `${Math.abs(days)}d OVERDUE`;
    if (days === 0)   return "REG TODAY";
    if (days <= 30)   return `${days}d to reg`;
    return `${days}d remaining`;
  };

  // ── PDF generators ─────────────────────────────────────

  const printProclamationReport = () => {
    const genBy2 = genBy;
    const rows = alertRecords.map((r,i) => {
      const days = daysUntilReg(r);
      const col = days < 0 ? "#8b1a1a" : days <= 30 ? "#c0392b" : "#1e6b3c";
      const regDate = effectiveRegDate(r) || autoRegDate(r.dateProclamation);
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
    const filterDesc = filterWindow >= 365 ? "All active proclamations — not yet registered"
      : `Records with registration date within ${filterWindow} days — not yet registered`;
    const html = reportHeader(`Proclamation Alerts Report${filterWindow < 365 ? ` — Within ${filterWindow} Days` : ""}`, filterDesc, alertRecords.length, genBy2)
      + `<table><thead><tr><th>#</th><th>Matai Title</th><th>Holder</th><th>Village</th><th>District</th><th>Proclaimed</th><th>Urgency</th><th>Auto Reg. Date</th></tr></thead><tbody>${rows}</tbody></table>
      <div class="footer">Samoa Matai Title Registry — Resitalaina o Matai — Confidential</div>
      </body></html>`;
    openPDF("Proclamation Alerts Report", html);
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
        "Objections Report — All Records",
        "All titles with objection recorded — cannot be registered until resolved through court",
        objectionRecords.length, genBy)
      + `<table><thead><tr><th>#</th><th>Matai Title</th><th>Holder</th><th>Village</th><th>District</th><th>Proclaimed</th><th>Objection Date</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table>
      <div class="footer">Samoa Matai Title Registry — Resitalaina o Matai — Confidential</div>
      </body></html>`;
    openPDF("Objections Report", html);
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
        "New Matai Titles — All Records",
        "All titles entered and awaiting proclamation period",
        newMataiRecords.length, genBy)
      + `<table><thead><tr><th>#</th><th>Matai Title</th><th>Holder</th><th>Village</th><th>District</th><th>Type</th><th>Date Conferred</th><th>Date Entered</th></tr></thead><tbody>${rows}</tbody></table>
      <div class="footer">Samoa Matai Title Registry — Resitalaina o Matai — Confidential</div>
      </body></html>`;
    openPDF("New Matai Titles — All Records", html);
    logAudit("REPORT_PDF", { type:"new_matai", count: newMataiRecords.length });
  };

  const printReadyReport = () => {
    const now = new Date();
    const monthLabel = `${MONTHS[now.getMonth()]} ${now.getFullYear()}`;
    const rows = readyToRegister.map((r,i) => {
      const regDate = effectiveRegDate(r) || autoRegDate(r.dateProclamation);
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
        "Ready to Register — All Records",
        "All titles where proclamation period is complete — awaiting registration confirmation",
        readyToRegister.length, genBy)
      + `<table><thead><tr><th>#</th><th>Matai Title</th><th>Holder</th><th>Village</th><th>District</th><th>Proclaimed</th><th>Registration Date</th></tr></thead><tbody>${rows}</tbody></table>
      <div class="footer">Samoa Matai Title Registry — Resitalaina o Matai — Confidential</div>
      </body></html>`;
    openPDF("Ready to Register — All Records", html);
    logAudit("REPORT_PDF", { type:"ready_all", count: readyToRegister.length });
  };

  const printMonthlyFullReport = () => {
    const now = new Date();
    const MONTHS_L = ["January","February","March","April","May","June","July","August","September","October","November","December"];
    const monthLabel = `${MONTHS_L[now.getMonth()]} ${now.getFullYear()}`;
    const fmtSection = (title, color, headers, rows) =>
      rows.length === 0 ? "" :
      `<h2 style="font-family:Georgia,serif;color:${color};font-size:1rem;margin:1.5rem 0 0.4rem;border-bottom:2px solid ${color};padding-bottom:4px">${title} (${rows.length})</h2>
      <table style="width:100%;border-collapse:collapse;font-size:0.78rem;margin-bottom:0.5rem">
        <thead><tr>${headers.map(h=>`<th style="background:${color};color:#fff;padding:5px 8px;text-align:left">${h}</th>`).join("")}</tr></thead>
        <tbody>${rows}</tbody>
      </table>`;

    const newRows = newMataiRecords.map((r,i)=>`<tr style="background:${i%2?"#f9f9f9":"#fff"}">
      <td style="padding:4px 8px;border-bottom:1px solid #eee">${i+1}</td>
      <td style="padding:4px 8px;border-bottom:1px solid #eee"><strong>${r.mataiTitle||"—"}</strong></td>
      <td style="padding:4px 8px;border-bottom:1px solid #eee">${r.holderName||"—"}</td>
      <td style="padding:4px 8px;border-bottom:1px solid #eee">${r.village||"—"}</td>
      <td style="padding:4px 8px;border-bottom:1px solid #eee">${r.district||"—"}</td>
      <td style="padding:4px 8px;border-bottom:1px solid #eee">${fmtDate(r.dateConferred)}</td>
    </tr>`).join("");

    const readyRows = readyToRegister.map((r,i)=>`<tr style="background:${i%2?"#f9f9f9":"#fff"}">
      <td style="padding:4px 8px;border-bottom:1px solid #eee">${i+1}</td>
      <td style="padding:4px 8px;border-bottom:1px solid #eee"><strong>${r.mataiTitle||"—"}</strong></td>
      <td style="padding:4px 8px;border-bottom:1px solid #eee">${r.holderName||"—"}</td>
      <td style="padding:4px 8px;border-bottom:1px solid #eee">${r.village||"—"}</td>
      <td style="padding:4px 8px;border-bottom:1px solid #eee">${r.district||"—"}</td>
      <td style="padding:4px 8px;border-bottom:1px solid #eee">${fmtDate(r.dateProclamation)}</td>
      <td style="padding:4px 8px;border-bottom:1px solid #eee;color:#1a5c35;font-weight:600">${fmtDate(autoRegDate(r.dateProclamation))}</td>
    </tr>`).join("");

    const completedRows = registeredRecords.map((r,i)=>`<tr style="background:${i%2?"#f9f9f9":"#fff"}">
      <td style="padding:4px 8px;border-bottom:1px solid #eee">${i+1}</td>
      <td style="padding:4px 8px;border-bottom:1px solid #eee"><strong>${r.mataiTitle||"—"}</strong></td>
      <td style="padding:4px 8px;border-bottom:1px solid #eee">${r.holderName||"—"}</td>
      <td style="padding:4px 8px;border-bottom:1px solid #eee">${r.village||"—"}</td>
      <td style="padding:4px 8px;border-bottom:1px solid #eee">${r.district||"—"}</td>
      <td style="padding:4px 8px;border-bottom:1px solid #eee">${fmtDate(r.dateProclamation)}</td>
      <td style="padding:4px 8px;border-bottom:1px solid #eee;color:#1a5c35;font-weight:600">${fmtDate(r.dateRegistration)}</td>
    </tr>`).join("");

    const objRows = objectionRecords.map((r,i)=>`<tr style="background:${i%2?"#f9f9f9":"#fff"}">
      <td style="padding:4px 8px;border-bottom:1px solid #eee">${i+1}</td>
      <td style="padding:4px 8px;border-bottom:1px solid #eee"><strong>${r.mataiTitle||"—"}</strong></td>
      <td style="padding:4px 8px;border-bottom:1px solid #eee">${r.holderName||"—"}</td>
      <td style="padding:4px 8px;border-bottom:1px solid #eee">${r.village||"—"}</td>
      <td style="padding:4px 8px;border-bottom:1px solid #eee">${r.district||"—"}</td>
      <td style="padding:4px 8px;border-bottom:1px solid #eee">${fmtDate(r.dateProclamation)}</td>
      <td style="padding:4px 8px;border-bottom:1px solid #eee;color:#8b1a1a">${fmtDate(r.objectionDate)}</td>
    </tr>`).join("");

    const totalRecords = records.length;
    const totalCompleted = records.filter(r=>r.status==="completed"||r.dateRegistration).length;

    const html = reportHeader(
      `Monthly Report — ${monthLabel}`,
      `Summary of all matai title activity for ${monthLabel}`,
      totalRecords, genBy)
      + `<div style="display:flex;gap:1rem;margin-bottom:1.5rem;flex-wrap:wrap">
        ${[
          ["Total Records", totalRecords, "#1a5c35"],
          ["Registered",   totalCompleted, "#155c31"],
          ["New Titles",   newMataiRecords.length, "#7c3aed"],
          ["Ready",        readyToRegister.length, "#1e6b3c"],
          ["Objections",   objectionRecords.length, "#8b1a1a"],
        ].map(([l,n,c])=>
          `<div style="border:1px solid ${c}30;border-radius:4px;padding:0.5rem 1rem;text-align:center;min-width:80px">
            <div style="font-size:1.6rem;font-weight:bold;color:${c}">${n}</div>
            <div style="font-size:0.6rem;text-transform:uppercase;color:${c};letter-spacing:0.05em;font-family:'Cinzel',serif">${l}</div>
          </div>`
        ).join("")}
      </div>
      ${fmtSection("New Matai Titles (Not Yet Proclaimed)","#7c3aed",["#","Title","Holder","Village","District","Date Conferred"],newRows)}
      ${fmtSection("Ready to Register","#1a5c35",["#","Title","Holder","Village","District","Proclaimed","Reg. Date"],readyRows)}
      ${fmtSection("Registered Titles","#155c31",["#","Title","Holder","Village","District","Proclaimed","Registered"],completedRows)}
      ${fmtSection("Active Objections","#8b1a1a",["#","Title","Holder","Village","District","Proclaimed","Objection Date"],objRows)}
      <div class="footer">Samoa Matai Title Registry — Resitalaina o Matai — Confidential — ${monthLabel}</div>
      </body></html>`;
    openPDF("Monthly Report", html);
    logAudit("REPORT_PDF", { type:"monthly_full", month: monthLabel });
  };

  // ── Styles ─────────────────────────────────────────────
  const printDuplicatesReport = () => {
    if (duplicateGroups.length === 0) return;
    const rows = duplicateGroups.flatMap(({ certNum, records: grp }) =>
      grp.map((r, i) => {
        const composed = r.mataiCertNumber || [r.certItumalo, r.certLaupepa, r.certRegBook].filter(Boolean).join("/");
        const isFirst = i === 0;
        return `<tr style="background:${i%2===0?"#fff5f5":"#fff"}">
          <td style="color:#c0392b;font-weight:600">${isFirst ? `<strong>${composed}</strong>` : ""}</td>
          <td><strong>${r.mataiTitle||"—"}</strong></td>
          <td>${r.holderName||"—"}</td>
          <td>${r.village||"—"}</td>
          <td>${r.district||"—"}</td>
          <td>${r.mataiType||"—"}</td>
          <td style="color:#c0392b">${isFirst ? `⚠ ${grp.length} records share this number` : "↑ same cert number"}</td>
        </tr>`;
      })
    ).join("");
    const html = reportHeader(
        "Duplicate Certificate Numbers Report",
        `${duplicateGroups.length} cert number${duplicateGroups.length!==1?"s":""} shared across multiple records — please review and correct`,
        duplicateGroups.reduce((n, g) => n + g.records.length, 0), genBy)
      + `<table><thead><tr>
          <th style="background:#c0392b;color:#fff;padding:5px 8px;text-align:left;font-family:serif;font-size:0.7rem">#  Cert No.</th>
          <th style="background:#c0392b;color:#fff;padding:5px 8px;text-align:left;font-family:serif;font-size:0.7rem">Matai Title</th>
          <th style="background:#c0392b;color:#fff;padding:5px 8px;text-align:left;font-family:serif;font-size:0.7rem">Holder</th>
          <th style="background:#c0392b;color:#fff;padding:5px 8px;text-align:left;font-family:serif;font-size:0.7rem">Village</th>
          <th style="background:#c0392b;color:#fff;padding:5px 8px;text-align:left;font-family:serif;font-size:0.7rem">District</th>
          <th style="background:#c0392b;color:#fff;padding:5px 8px;text-align:left;font-family:serif;font-size:0.7rem">Type</th>
          <th style="background:#c0392b;color:#fff;padding:5px 8px;text-align:left;font-family:serif;font-size:0.7rem">Note</th>
        </tr></thead><tbody>${rows}</tbody></table>
      <div class="footer">Samoa Matai Title Registry — Resitalaina o Matai — Confidential</div>
      </body></html>`;
    openPDF("Duplicate Certificate Numbers Report", html);
    logAudit("REPORT_PDF", { type:"duplicates", count: duplicateGroups.reduce((n,g)=>n+g.records.length,0) });
  };


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
    const days = daysUntilReg(r);
    const col  = urgencyColor(days);
    const bg   = urgencyBg(days);
    return (
      <Link to={`/register/${r.id}`} style={{ textDecoration:"none", display:"block" }}>
        <div style={{ background:bg, border:`1px solid ${col}40`, borderLeft:`4px solid ${col}`, borderRadius:"3px", padding:"0.85rem 1.1rem", cursor:"pointer", marginBottom:"0.6rem" }}
          onMouseEnter={e => { e.currentTarget.style.filter="brightness(0.97)"; }}
          onMouseLeave={e => { e.currentTarget.style.filter="none"; }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"4px" }}>
            <div>
              <span style={{ fontFamily:"'Cinzel',serif", fontSize:"0.92rem", fontWeight:"700", color:"#1e2a1e" }}>{r.mataiTitle||"—"}</span>
              <span style={{ fontSize:"0.82rem", color:"rgba(26,26,26,0.6)", marginLeft:"8px" }}>{r.holderName}</span>
            </div>
            <span style={{ fontFamily:"'Cinzel',serif", fontSize:"0.65rem", fontWeight:"700", color:col, background:`${col}18`, padding:"3px 10px", borderRadius:"2px", border:`1px solid ${col}30` }}>
              {urgencyLabel(days)}
            </span>
          </div>
          <div style={{ display:"flex", gap:"1.2rem", flexWrap:"wrap", fontSize:"0.77rem", color:"rgba(26,26,26,0.55)" }}>
            <span>📍 {r.village}, {r.district}</span>
            <span>🗓 Proclaimed: <strong style={{ color:"rgba(26,26,26,0.7)" }}>{fmtDate(r.dateProclamation)}</strong></span>
            <span>📋 Reg. date: <strong style={{color:col}}>{fmtDate(effectiveRegDate(r) || autoRegDate(r.dateProclamation))}</strong></span>
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
              <TabBtn tab="monthly"      label="Monthly Notifications" count={readyToRegister.length + newMataiRecords.length} />
              <TabBtn tab="objection"    label="Objections"          count={objectionRecords.length} color="#8b1a1a" />
              {duplicateGroups.length > 0 && (
                <TabBtn tab="duplicates" label="⚠ Duplicates" count={duplicateGroups.length} color="#c0392b" />
              )}
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
                  Records whose <strong>registration date falls within {filterWindow} days</strong> from today (4 months after proclamation). Overdue records appear in Ready to Register.
                </p>
              </div>
              <div style={sStyle}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"1rem" }}>
                  <p style={{ fontFamily:"'Cinzel',serif", fontSize:"0.65rem", letterSpacing:"0.15em", color:"#c0392b", textTransform:"uppercase" }}>
                    ◈ {alertRecords.length} Record{alertRecords.length!==1?"s":""} Requiring Attention
                  </p>
                  {perms.canPrint && <PdfBtn onClick={printProclamationReport} label="PDF Report" count={alertRecords.length} color="#c0392b" />}
                </div>
                {loading ? <p style={{ fontStyle:"italic", color:"#9ca3af" }}>Loading…</p>
                : alertRecords.length === 0
                  ? <div style={{ textAlign:"center", padding:"2.5rem", color:"rgba(26,26,26,0.35)", fontStyle:"italic" }}>✅ No records within {filterWindow} days.</div>
                  : <>{alertPaged.map(r => <RecordRow key={r.id} r={r} />)}
                    <Pager page={alertPageSafe} totalPages={alertTotalPages} setPage={setAlertPage} /></>
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
                  {perms.canPrint && <PdfBtn onClick={printObjectionReport} label="PDF Report" count={objectionRecords.length} color="#8b1a1a" />}
                </div>
                <p style={{ fontSize:"0.78rem", color:"rgba(26,26,26,0.45)", marginBottom:"1.25rem" }}>
                  These titles have an objection. They cannot be registered until resolved through court.
                </p>
                {loading ? <p style={{ fontStyle:"italic", color:"#9ca3af" }}>Loading…</p>
                : objectionRecords.length === 0
                  ? <div style={{ textAlign:"center", padding:"2.5rem", color:"rgba(26,26,26,0.35)", fontStyle:"italic" }}>✅ No objections recorded.</div>
                  : <>{objPaged.map(r => (
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
                  ))}
                  <Pager page={objPageSafe} totalPages={objTotalPages} setPage={setObjPage} /></>
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

              {/* Ready to register — confirm button */}
              <div style={sStyle}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"0.5rem" }}>
                  <div>
                    <p style={{ fontFamily:"'Cinzel',serif", fontSize:"0.65rem", letterSpacing:"0.15em", color:"#1e6b3c", textTransform:"uppercase" }}>
                      ◈ Ready to Register — {readyToRegister.length} Record{readyToRegister.length!==1?"s":""}
                    </p>
                    <p style={{ fontSize:"0.78rem", color:"rgba(26,26,26,0.45)", marginTop:"4px" }}>
                      4-month proclamation complete, no objection — click Confirm to register
                    </p>
                  </div>

                </div>
                {loading ? <p style={{ fontStyle:"italic", color:"#9ca3af" }}>Loading…</p>
                : readyToRegister.length === 0
                  ? <div style={{ textAlign:"center", padding:"2rem", color:"rgba(26,26,26,0.35)", fontStyle:"italic" }}>✅ No records pending registration.</div>
                  : <>{readyPaged.map(r => {
                    const regDate = effectiveRegDate(r);
                    const isConfirming = confirming === r.id;
                    return (
                      <div key={r.id} style={{ background:"#f0faf4", border:"1px solid #a7d7b850", borderLeft:"4px solid #1e6b3c", borderRadius:"3px", padding:"0.85rem 1.1rem", marginBottom:"0.6rem" }}>
                        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                          <div>
                            <span style={{ fontFamily:"'Cinzel',serif", fontSize:"0.92rem", fontWeight:"700", color:"#1e6b3c" }}>{r.mataiTitle||"—"}</span>
                            <span style={{ fontSize:"0.82rem", color:"rgba(26,26,26,0.6)", marginLeft:"8px" }}>{r.holderName}</span>
                          </div>
                          <div style={{ display:"flex", gap:"0.5rem", alignItems:"center" }}>
                            <Link to={`/register/${r.id}`} style={{ textDecoration:"none" }}>
                              <button style={{ fontSize:"0.68rem", padding:"0.35rem 0.7rem", fontFamily:"'Cinzel',serif", letterSpacing:"0.06em", textTransform:"uppercase", background:"transparent", border:"1px solid rgba(30,107,60,0.3)", color:"#1e6b3c", borderRadius:"3px", cursor:"pointer" }}>
                                View
                              </button>
                            </Link>
                            {perms.canEdit && (
                              <button
                                onClick={() => confirmRegistration(r)}
                                disabled={isConfirming}
                                style={{ fontSize:"0.68rem", padding:"0.35rem 0.9rem", fontFamily:"'Cinzel',serif", letterSpacing:"0.06em", textTransform:"uppercase", background: isConfirming ? "#f3f4f6" : "#1e6b3c", border:"1px solid #1e6b3c", color: isConfirming ? "#9ca3af" : "#fff", borderRadius:"3px", cursor: isConfirming ? "not-allowed" : "pointer", fontWeight:600 }}>
                                {isConfirming ? "Saving…" : "✓ Confirm"}
                              </button>
                            )}
                          </div>
                        </div>
                        <div style={{ display:"flex", gap:"1.2rem", flexWrap:"wrap", fontSize:"0.77rem", color:"rgba(26,26,26,0.55)", marginTop:"6px" }}>
                          <span>📍 {r.village}, {r.district}</span>
                          <span>🗓 Proclaimed: {fmtDate(r.dateProclamation)}</span>
                          <span style={{ color:"#1a5c35", fontWeight:600 }}>📋 Reg. date: {fmtDate(regDate)}</span>
                        </div>
                      </div>
                    );
                  })}
                  <Pager page={readyPageSafe} totalPages={readyTotalPages} setPage={setReadyPage} /></>
                }
              </div>

            </>)}

            {/* ── Duplicates tab ── */}
            {activeTab === "duplicates" && (
              <div style={sStyle}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"0.5rem" }}>
                  <p style={{ fontFamily:"'Cinzel',serif", fontSize:"0.65rem", letterSpacing:"0.15em", color:"#c0392b", textTransform:"uppercase" }}>
                    ◈ ⚠ Duplicate Certificate Numbers — {duplicateGroups.length} Group{duplicateGroups.length!==1?"s":""}
                  </p>
                  {perms.canPrint && (
                    <button onClick={printDuplicatesReport}
                      style={{ fontSize:"0.68rem", padding:"0.35rem 0.9rem", fontFamily:"'Cinzel',serif", letterSpacing:"0.08em", textTransform:"uppercase", background:"#c0392b15", border:"1px solid #c0392b", color:"#c0392b", borderRadius:"3px", cursor:"pointer" }}>
                      📄 PDF Report ({duplicateGroups.reduce((n,g)=>n+g.records.length,0)})
                    </button>
                  )}
                </div>
                <p style={{ fontSize:"0.78rem", color:"rgba(26,26,26,0.5)", marginBottom:"1.2rem" }}>
                  These records share the same certificate number. Please review and correct — only one should be kept or they should have unique cert numbers.
                </p>
                {duplicateGroups.map(({ certNum, records: grp }) => (
                  <div key={certNum} style={{ background:"#fff5f5", border:"1px solid #fca5a5", borderLeft:"4px solid #c0392b", borderRadius:"4px", padding:"1rem 1.1rem", marginBottom:"1rem" }}>
                    <p style={{ fontFamily:"'Cinzel',serif", fontSize:"0.72rem", color:"#c0392b", fontWeight:700, marginBottom:"0.6rem" }}>
                      ⚠ Cert No. {certNum} — {grp.length} records share this number
                    </p>
                    {grp.map(r => (
                      <Link key={r.id} to={`/register/${r.id}`}
                        state={{ recordIds: grp.map(x => x.id), backTo: "/notifications", backTab: "duplicates", dupCertNum: certNum }}
                        style={{ textDecoration:"none", display:"block", marginBottom:"0.4rem" }}>
                        <div style={{ background:"#fff", border:"1px solid rgba(192,57,43,0.2)", borderRadius:"3px", padding:"0.6rem 0.85rem", display:"flex", justifyContent:"space-between", alignItems:"center" }}
                          onMouseEnter={e => e.currentTarget.style.background="#fef2f2"}
                          onMouseLeave={e => e.currentTarget.style.background="#fff"}>
                          <div>
                            <span style={{ fontFamily:"'Cinzel',serif", fontSize:"0.88rem", fontWeight:700, color:"#c0392b" }}>{r.mataiTitle||"—"}</span>
                            <span style={{ fontSize:"0.8rem", color:"rgba(26,26,26,0.6)", marginLeft:"8px" }}>{r.holderName}</span>
                          </div>
                          <div style={{ display:"flex", gap:"1rem", fontSize:"0.75rem", color:"rgba(26,26,26,0.5)" }}>
                            <span>📍 {r.village}, {r.district}</span>
                            <span style={{ color:"#c0392b", fontSize:"0.65rem", fontFamily:"'Cinzel',serif", border:"1px solid #fca5a5", padding:"1px 6px", borderRadius:"2px" }}>✎ EDIT</span>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                ))}
              </div>
            )}
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
                ["Registered",  registeredRecords.length, "#155c31"],
              ].map(([label, count, col]) => (
                <div key={label} style={{ background:`${col}08`, border:`1px solid ${col}30`, borderRadius:"3px", padding:"0.6rem 0.75rem", textAlign:"center" }}>
                  <p style={{ fontFamily:"'Cinzel Decorative',serif", fontSize:"1.4rem", color:col }}>{count}</p>
                  <p style={{ fontFamily:"'Cinzel',serif", fontSize:"0.58rem", color:col, letterSpacing:"0.08em", textTransform:"uppercase" }}>{label}</p>
                </div>
              ))}
            </div>

            {perms.canPrint && (<>
            <p style={{ fontFamily:"'Cinzel',serif", fontSize:"0.62rem", letterSpacing:"0.1em", color:"#1e6b3c", textTransform:"uppercase", marginBottom:"0.75rem" }}>◈ Generate PDF Reports</p>
            <div style={{ display:"flex", flexDirection:"column", gap:"0.4rem" }}>
              {[
                { label:"New Matai Titles",    count: newMataiRecords.length,   color:"#5b21b6", bg:"#f5f3ff", border:"#c4b5fd", icon:"🆕", onClick: printNewMataiReport },
                { label:"Proclamation Alerts", count: alertRecords.length,      color:"#1e6b3c", bg:"#f0faf4", border:"#a7d7b8", icon:"📋", onClick: printProclamationReport },
                { label:"Ready to Register",   count: readyToRegister.length,   color:"#1e6b3c", bg:"#f0faf4", border:"#a7d7b8", icon:"✅", onClick: printReadyReport },
                { label:"Objections Report",   count: objectionRecords.length,  color:"#8b1a1a", bg:"#fff5f5", border:"#fca5a5", icon:"⚠️", onClick: printObjectionReport },
                ...(duplicateGroups.length > 0 ? [{ label:"Duplicate Cert Nos.", count: duplicateGroups.reduce((n,g)=>n+g.records.length,0), color:"#c0392b", bg:"#fff5f5", border:"#fca5a5", icon:"🔁", onClick: printDuplicatesReport }] : []),
              ].map(({ label, count, color, bg, border, icon, onClick }) => (
                <button key={label} onClick={onClick}
                  style={{ display:"flex", alignItems:"center", justifyContent:"space-between", width:"100%", background:bg, border:`1px solid ${border}`, borderRadius:"4px", padding:"0.55rem 0.85rem", cursor:"pointer", textAlign:"left" }}
                  onMouseEnter={e => e.currentTarget.style.filter="brightness(0.96)"}
                  onMouseLeave={e => e.currentTarget.style.filter="none"}>
                  <span style={{ display:"flex", alignItems:"center", gap:"0.5rem" }}>
                    <span style={{ fontSize:"0.85rem" }}>{icon}</span>
                    <span style={{ fontFamily:"'Cinzel',serif", fontSize:"0.67rem", letterSpacing:"0.07em", textTransform:"uppercase", color }}>{label}</span>
                  </span>
                  <span style={{ fontFamily:"'Cinzel',serif", fontSize:"0.65rem", color, background:`${color}15`, border:`1px solid ${border}`, borderRadius:"2px", padding:"1px 7px", minWidth:"24px", textAlign:"center" }}>{count}</span>
                </button>
              ))}
            </div>
            </>)}

            <div style={{ marginTop:"1rem", padding:"0.75rem", background:"#f9fafb", borderRadius:"3px", fontSize:"0.75rem", color:"rgba(26,26,26,0.5)", lineHeight:1.5 }}>
              📧 Email sending coming soon
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

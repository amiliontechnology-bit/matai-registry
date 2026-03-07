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
  const reg = new Date(target.getFullYear(), target.getMonth(), Math.min(29, lastDay));
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

function inRange(dateStr, from, to) {
  if (!dateStr) return false;
  const d = dateStr.split("T")[0];
  if (from && d < from) return false;
  if (to   && d > to)   return false;
  return true;
}

function openPDF(title, html) {
  const win = window.open("", "_blank");
  win.document.write(html);
  win.document.close();
}

function reportHeader(title, subtitle, count, generatedBy, dateRange) {
  const rangeStr = dateRange ? ` &nbsp;·&nbsp; Period: ${dateRange}` : "";
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
    .meta{display:flex;justify-content:space-between;font-size:0.75rem;color:#555;padding:0.4rem 0;border-bottom:1px solid #eee;margin-bottom:1.2rem;flex-wrap:wrap;gap:4px}
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
    <span>Generated: ${fmtDate(new Date().toISOString().split("T")[0])}${rangeStr}</span>
    <span>By: ${generatedBy}</span>
    <span>Records: ${count}</span>
  </div>`;
}

// ── Component ──────────────────────────────────────────────
export default function Reports({ userRole }) {
  const [records, setRecords]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [activeTab, setActiveTab] = useState("monthly");

  // Filter state for "Other Reports" tab
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo,   setFilterTo]   = useState("");
  const [filterType, setFilterType] = useState("all");

  // Monthly tab state
  const [monthFilter, setMonthFilter] = useState(() => {
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,"0")}`;
  });

  const perms = getPermissions(userRole);
  const user  = auth.currentUser;

  if (userRole === null) return null; // wait for role to load
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
  const now   = new Date();
  const monthLabel = `${MONTHS[now.getMonth()]} ${now.getFullYear()}`;
  const [filterYear, filterMonth] = monthFilter.split("-").map(Number);

  // ── Base data cuts (ALL records, no date filter) ──────────
  const registeredAll    = records.filter(r => r.dateRegistration || r.status === "completed")
    .sort((a,b) => (b.dateRegistration||"").localeCompare(a.dateRegistration||""));

  const registeredMonth  = registeredAll.filter(r => {
    const d = r.dateRegistration; if (!d) return false;
    const p = d.split("-");
    return parseInt(p[0]) === filterYear && parseInt(p[1]) === filterMonth;
  });

  const readyToRegister  = records.filter(r => {
    if (r.objection === "yes" || r.status === "completed" || r.dateRegistration) return false;
    return !!effectiveRegDate(r);
  });

  const newMataiRecords  = records.filter(r =>
    !r.dateProclamation && !r.dateRegistration && r.objection !== "yes"
  );

  const objectionRecords = records.filter(r => r.objection === "yes");

  const alertRecords     = records.filter(r => {
    if (r.objection === "yes" || r.dateRegistration || !r.dateProclamation) return false;
    if (effectiveRegDate(r)) return false;
    const days = Math.ceil((new Date(r.dateProclamation) - now) / (1000*60*60*24));
    return days <= 120;
  });

  // ── "Other Reports" — filtered cuts ──────────────────────
  // For each type, we filter by the relevant date field and filterType
  const filteredReady = records.filter(r => {
    if (r.objection === "yes" || r.status === "completed" || r.dateRegistration) return false;
    if (!effectiveRegDate(r)) return false;
    if (filterType !== "all" && filterType !== "ready") return false;
    return inRange(r.dateProclamation, filterFrom, filterTo);
  });

  const filteredNew = records.filter(r => {
    if (r.dateProclamation || r.dateRegistration || r.objection === "yes") return false;
    if (filterType !== "all" && filterType !== "new") return false;
    return inRange(r.dateConferred, filterFrom, filterTo);
  });

  const filteredProclamation = records.filter(r => {
    if (r.objection === "yes" || r.dateRegistration || !r.dateProclamation) return false;
    if (effectiveRegDate(r)) return false;
    if (filterType !== "all" && filterType !== "proclamation") return false;
    return inRange(r.dateProclamation, filterFrom, filterTo);
  });

  const filteredObjections = records.filter(r => {
    if (r.objection !== "yes") return false;
    if (filterType !== "all" && filterType !== "objections") return false;
    const refDate = r.objectionDate || r.dateProclamation;
    return inRange(refDate, filterFrom, filterTo);
  });

  // When no date filter set, show all records for that type
  const noFilter = !filterFrom && !filterTo;

  const filteredReadyFinal       = noFilter ? (filterType === "all" || filterType === "ready"        ? readyToRegister  : []) : filteredReady;
  const filteredNewFinal         = noFilter ? (filterType === "all" || filterType === "new"          ? newMataiRecords  : []) : filteredNew;
  const filteredProcFinal        = noFilter ? (filterType === "all" || filterType === "proclamation" ? alertRecords     : []) : filteredProclamation;
  const filteredObjFinal         = noFilter ? (filterType === "all" || filterType === "objections"   ? objectionRecords : []) : filteredObjections;

  const filteredTotal = filteredReadyFinal.length + filteredNewFinal.length + filteredProcFinal.length + filteredObjFinal.length;

  const dateRangeLabel = (filterFrom || filterTo)
    ? `${filterFrom ? fmtDate(filterFrom) : "Beginning"} — ${filterTo ? fmtDate(filterTo) : "Today"}`
    : "All dates";

  // ── PDF helpers ───────────────────────────────────────────
  const mkRow = (cells, i) =>
    `<tr style="background:${i%2?"#f9f9f9":"#fff"}">${cells.map(c=>`<td style="padding:4px 8px;border-bottom:1px solid #eee">${c}</td>`).join("")}</tr>`;

  const mkTable = (headers, rows, color="#1a5c35") =>
    `<table><thead><tr>${headers.map(h=>`<th style="background:${color};color:#fff;padding:5px 8px;text-align:left;font-family:'Cinzel',serif;font-size:0.6rem;letter-spacing:0.06em;text-transform:uppercase">${h}</th>`).join("")}</tr></thead><tbody>${rows}</tbody></table>`;

  const mkSection = (title, color, headers, rowsHtml) =>
    rowsHtml.length === 0 ? "" :
    `<h2 style="font-family:'Cinzel',serif;color:${color};font-size:0.9rem;margin:1.5rem 0 0.4rem;border-bottom:2px solid ${color};padding-bottom:4px;text-transform:uppercase;letter-spacing:0.1em">${title}</h2>
    ${mkTable(headers, rowsHtml, color)}`;

  const footer = `<div class="footer">Samoa Matai Title Registry — Resitalaina o Matai — Confidential</div>
    <script>window.onload=()=>window.print();<\/script></body></html>`;

  // Monthly PDF generators
  const printRegisteredMonth = () => {
    const label = `${MONTHS[filterMonth-1]} ${filterYear}`;
    const rows = registeredMonth.map((r,i) => mkRow([i+1,`<strong>${r.mataiTitle||"—"}</strong>`,r.holderName||"—",r.mataiType||"—",r.village||"—",r.district||"—",fmtDate(r.dateProclamation),`<span style="color:#1a5c35;font-weight:600">${fmtDate(r.dateRegistration)}</span>`],i)).join("");
    openPDF("Registered Matai", reportHeader(`Registered Matai — ${label}`,`All matai titles registered in ${label}`,registeredMonth.length,genBy)
      + mkTable(["#","Matai Title","Holder","Type","Village","District","Proclaimed","Registered"],rows) + footer);
    logAudit("REPORT_PDF", { type:"registered_month", month: label });
  };

  const printRegisteredAll = () => {
    const rows = registeredAll.map((r,i) => mkRow([i+1,`<strong>${r.mataiTitle||"—"}</strong>`,r.holderName||"—",r.mataiType||"—",r.village||"—",r.district||"—",fmtDate(r.dateProclamation),`<span style="color:#1a5c35;font-weight:600">${fmtDate(r.dateRegistration)}</span>`],i)).join("");
    openPDF("All Registered Matai", reportHeader("All Registered Matai Titles","Complete list of all registered matai titles",registeredAll.length,genBy)
      + mkTable(["#","Matai Title","Holder","Type","Village","District","Proclaimed","Registered"],rows) + footer);
    logAudit("REPORT_PDF", { type:"registered_all" });
  };

  const printMonthlyFull = () => {
    const newRows  = newMataiRecords.map((r,i)   => mkRow([i+1,`<strong>${r.mataiTitle||"—"}</strong>`,r.holderName||"—",r.village||"—",r.district||"—",fmtDate(r.dateConferred)],i)).join("");
    const readyRows= readyToRegister.map((r,i)   => mkRow([i+1,`<strong>${r.mataiTitle||"—"}</strong>`,r.holderName||"—",r.village||"—",r.district||"—",fmtDate(r.dateProclamation),`<span style="color:#1a5c35;font-weight:600">${fmtDate(effectiveRegDate(r))}</span>`],i)).join("");
    const regRows  = registeredAll.map((r,i)     => mkRow([i+1,`<strong>${r.mataiTitle||"—"}</strong>`,r.holderName||"—",r.village||"—",r.district||"—",fmtDate(r.dateProclamation),`<span style="color:#1a5c35;font-weight:600">${fmtDate(r.dateRegistration)}</span>`],i)).join("");
    const objRows  = objectionRecords.map((r,i)  => mkRow([i+1,`<strong>${r.mataiTitle||"—"}</strong>`,r.holderName||"—",r.village||"—",r.district||"—",fmtDate(r.dateProclamation),`<span style="color:#8b1a1a">${fmtDate(r.objectionDate)}</span>`],i)).join("");
    const stats = [["Total",records.length,"#1a5c35"],["Registered",registeredAll.length,"#155c31"],["New Titles",newMataiRecords.length,"#7c3aed"],["Ready",readyToRegister.length,"#1e6b3c"],["Objections",objectionRecords.length,"#8b1a1a"]];
    const html = reportHeader(`Monthly Report — ${monthLabel}`,`Summary of all matai title activity for ${monthLabel}`,records.length,genBy)
      + `<div style="display:flex;gap:1rem;margin-bottom:1.5rem;flex-wrap:wrap">${stats.map(([l,n,c])=>`<div style="border:1px solid ${c}30;border-radius:4px;padding:0.5rem 1rem;text-align:center;min-width:80px"><div style="font-size:1.6rem;font-weight:bold;color:${c}">${n}</div><div style="font-size:0.6rem;text-transform:uppercase;color:${c};letter-spacing:0.05em;font-family:'Cinzel',serif">${l}</div></div>`).join("")}</div>`
      + mkSection("New Matai Titles","#7c3aed",["#","Title","Holder","Village","District","Conferred"],newRows)
      + mkSection("Ready to Register","#1e6b3c",["#","Title","Holder","Village","District","Proclaimed","Reg. Date"],readyRows)
      + mkSection("Registered Titles","#155c31",["#","Title","Holder","Village","District","Proclaimed","Registered"],regRows)
      + mkSection("Active Objections","#8b1a1a",["#","Title","Holder","Village","District","Proclaimed","Objection Date"],objRows)
      + footer;
    openPDF("Monthly Report", html);
    logAudit("REPORT_PDF", { type:"monthly_full", month: monthLabel });
  };

  // "Full Reports" PDF generators (all records, no month filter)
  const printFullReady = () => {
    const rows = readyToRegister.map((r,i) => mkRow([i+1,`<strong>${r.mataiTitle||"—"}</strong>`,r.holderName||"—",r.village||"—",r.district||"—",fmtDate(r.dateProclamation),`<span style="color:#1a5c35;font-weight:600">${fmtDate(effectiveRegDate(r))}</span>`],i)).join("");
    openPDF("Ready to Register", reportHeader("Ready to Register","All titles where the 4-month proclamation period is complete — awaiting confirmation",readyToRegister.length,genBy)
      + mkTable(["#","Matai Title","Holder","Village","District","Proclaimed","Reg. Date"],rows) + footer);
    logAudit("REPORT_PDF", { type:"full_ready" });
  };

  const printFullNew = () => {
    const rows = newMataiRecords.map((r,i) => mkRow([i+1,`<strong>${r.mataiTitle||"—"}</strong>`,r.holderName||"—",r.mataiType||"—",r.village||"—",r.district||"—",fmtDate(r.dateConferred)],i)).join("");
    openPDF("New Matai Titles", reportHeader("New Matai Titles","All titles entered but not yet proclaimed",newMataiRecords.length,genBy)
      + mkTable(["#","Matai Title","Holder","Type","Village","District","Date Conferred"],rows) + footer);
    logAudit("REPORT_PDF", { type:"full_new" });
  };

  const printFullProclamation = () => {
    const rows = alertRecords.map((r,i) => mkRow([i+1,`<strong>${r.mataiTitle||"—"}</strong>`,r.holderName||"—",r.village||"—",r.district||"—",fmtDate(r.dateProclamation),`<span style="color:#1a5c35">${fmtDate(autoRegDate(r.dateProclamation))}</span>`],i)).join("");
    openPDF("Proclamation Report", reportHeader("Proclamation Report","All active proclamations — not yet registered",alertRecords.length,genBy)
      + mkTable(["#","Matai Title","Holder","Village","District","Proclaimed","Auto Reg. Date"],rows) + footer);
    logAudit("REPORT_PDF", { type:"full_proclamation" });
  };

  const printFullObjections = () => {
    const rows = objectionRecords.map((r,i) => mkRow([i+1,`<strong>${r.mataiTitle||"—"}</strong>`,r.holderName||"—",r.village||"—",r.district||"—",fmtDate(r.dateProclamation),`<span style="color:#8b1a1a;font-weight:600">${fmtDate(r.objectionDate)}</span>`],i)).join("");
    openPDF("Objections Report", reportHeader("Objections Report","All titles with active objections filed — all dates",objectionRecords.length,genBy)
      + mkTable(["#","Matai Title","Holder","Village","District","Proclaimed","Objection Date"],rows) + footer);
    logAudit("REPORT_PDF", { type:"full_objections" });
  };

  // "Other Reports" — filtered PDF
  const printFilteredReport = () => {
    const readyRows  = filteredReadyFinal.map((r,i)  => mkRow([i+1,`<strong>${r.mataiTitle||"—"}</strong>`,r.holderName||"—",r.village||"—",r.district||"—",fmtDate(r.dateProclamation),`<span style="color:#1a5c35;font-weight:600">${fmtDate(effectiveRegDate(r))}</span>`],i)).join("");
    const newRows    = filteredNewFinal.map((r,i)    => mkRow([i+1,`<strong>${r.mataiTitle||"—"}</strong>`,r.holderName||"—",r.village||"—",r.district||"—",fmtDate(r.dateConferred)],i)).join("");
    const procRows   = filteredProcFinal.map((r,i)   => mkRow([i+1,`<strong>${r.mataiTitle||"—"}</strong>`,r.holderName||"—",r.village||"—",r.district||"—",fmtDate(r.dateProclamation),`<span style="color:#1a5c35">${fmtDate(autoRegDate(r.dateProclamation))}</span>`],i)).join("");
    const objRows    = filteredObjFinal.map((r,i)    => mkRow([i+1,`<strong>${r.mataiTitle||"—"}</strong>`,r.holderName||"—",r.village||"—",r.district||"—",fmtDate(r.dateProclamation),`<span style="color:#8b1a1a;font-weight:600">${fmtDate(r.objectionDate)}</span>`],i)).join("");
    const typeLabel  = { all:"All Types", ready:"Ready to Register", new:"New Matai Titles", proclamation:"Proclamation Report", objections:"Objections Report" }[filterType];
    const html = reportHeader(
      `Filtered Report — ${typeLabel}`, dateRangeLabel, filteredTotal, genBy, dateRangeLabel)
      + mkSection("Ready to Register","#1e6b3c",["#","Title","Holder","Village","District","Proclaimed","Reg. Date"],readyRows)
      + mkSection("New Matai Titles","#7c3aed",["#","Title","Holder","Village","District","Date Conferred"],newRows)
      + mkSection("Proclamation Report","#1a5c35",["#","Title","Holder","Village","District","Proclaimed","Auto Reg. Date"],procRows)
      + mkSection("Objections Report","#8b1a1a",["#","Title","Holder","Village","District","Proclaimed","Objection Date"],objRows)
      + footer;
    openPDF("Filtered Report", html);
    logAudit("REPORT_PDF", { type:"filtered", filterType, from: filterFrom, to: filterTo });
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

  const FullReportCard = ({ title, desc, onClick, count, color="#1a5c35" }) => (
    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"1rem 1.1rem", background:"#fafafa", border:"1px solid rgba(30,107,60,0.12)", borderRadius:"4px", marginBottom:"0.6rem" }}>
      <div>
        <p style={{ fontFamily:"'Cinzel',serif", fontSize:"0.8rem", color, fontWeight:600 }}>{title}</p>
        <p style={{ fontSize:"0.73rem", color:"rgba(26,26,26,0.5)", marginTop:"2px" }}>{desc}</p>
      </div>
      <button onClick={onClick} disabled={count === 0}
        style={{ fontSize:"0.68rem", padding:"0.4rem 1rem", fontFamily:"'Cinzel',serif", letterSpacing:"0.08em", textTransform:"uppercase",
          background: count === 0 ? "#f3f4f6" : `${color}15`,
          border:`1px solid ${count === 0 ? "#e5e7eb" : color}`,
          color: count === 0 ? "#9ca3af" : color,
          borderRadius:"3px", cursor: count === 0 ? "not-allowed" : "pointer", whiteSpace:"nowrap" }}>
        📄 Print ({count})
      </button>
    </div>
  );

  const inputStyle = { fontSize:"0.78rem", padding:"0.4rem 0.65rem", border:"1px solid rgba(30,107,60,0.3)", borderRadius:"3px", color:"#1a5c35", fontFamily:"'Cinzel',serif", background:"#fff" };
  const labelStyle = { fontSize:"0.65rem", fontFamily:"'Cinzel',serif", letterSpacing:"0.1em", textTransform:"uppercase", color:"rgba(26,26,26,0.5)", display:"block", marginBottom:"4px" };

  const typeOptions = [
    { value:"all",         label:"All Types" },
    { value:"ready",       label:"Ready to Register" },
    { value:"new",         label:"New Matai Titles" },
    { value:"proclamation",label:"Proclamation Report" },
    { value:"objections",  label:"Objections Report" },
  ];

  // Filtered preview rows for on-screen table
  const previewRows = [
    ...filteredReadyFinal.map(r => ({ ...r, _type:"Ready to Register", _typeColor:"#1e6b3c", _date: r.dateProclamation })),
    ...filteredNewFinal.map(r =>   ({ ...r, _type:"New Matai Title",    _typeColor:"#7c3aed", _date: r.dateConferred })),
    ...filteredProcFinal.map(r =>  ({ ...r, _type:"Proclamation",       _typeColor:"#1a5c35", _date: r.dateProclamation })),
    ...filteredObjFinal.map(r =>   ({ ...r, _type:"Objection",          _typeColor:"#8b1a1a", _date: r.objectionDate || r.dateProclamation })),
  ].sort((a,b) => (b._date||"").localeCompare(a._date||""));

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
          <TabBtn id="monthly"    label="Monthly Reports" />
          <TabBtn id="full"       label="Full Reports" />
          <TabBtn id="registered" label="Registered Matai" count={registeredAll.length} color="#155c31" />
          <TabBtn id="other"      label="Filtered Reports" />
        </div>

        {/* ── Monthly Reports tab ── */}
        {activeTab === "monthly" && (
          <div style={{ display:"grid", gridTemplateColumns:"1fr 280px", gap:"1.5rem", alignItems:"start" }}>
            <div style={sStyle}>
              <p style={{ fontFamily:"'Cinzel',serif", fontSize:"0.65rem", letterSpacing:"0.15em", color:"#1e6b3c", textTransform:"uppercase", marginBottom:"1rem" }}>◈ Monthly Summary Reports</p>
              <FullReportCard title="Full Monthly Report" desc={`All activity for ${monthLabel}`} onClick={printMonthlyFull} count={records.length} />
              <FullReportCard title="Registered This Month" desc={`All matai titles registered in ${monthLabel}`} onClick={printRegisteredMonth} count={registeredMonth.length} />
            </div>
            <div style={{ ...sStyle, position:"sticky", top:"2rem" }}>
              <p style={{ fontFamily:"'Cinzel',serif", fontSize:"0.65rem", letterSpacing:"0.15em", color:"#1e6b3c", textTransform:"uppercase", marginBottom:"1rem" }}>◈ Current Month Summary</p>
              <p style={{ fontFamily:"'Cinzel',serif", fontSize:"0.72rem", color:"#1e6b3c", marginBottom:"1rem" }}>{monthLabel}</p>
              {[
                ["Total Records",       records.length,          "#1a5c35"],
                ["Registered",          registeredAll.length,    "#155c31"],
                ["Ready to Register",   readyToRegister.length,  "#1e6b3c"],
                ["New Titles",          newMataiRecords.length,  "#7c3aed"],
                ["Proclamation Alerts", alertRecords.length,     "#c0392b"],
                ["Objections",          objectionRecords.length, "#8b1a1a"],
              ].map(([label, count, col]) => (
                <div key={label} style={{ display:"flex", justifyContent:"space-between", padding:"0.45rem 0", borderBottom:"1px solid rgba(30,107,60,0.08)" }}>
                  <span style={{ fontSize:"0.78rem", color:"rgba(26,26,26,0.65)" }}>{label}</span>
                  <span style={{ fontFamily:"'Cinzel Decorative',serif", fontSize:"1rem", color:col, fontWeight:700 }}>{count}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Full Reports tab ── */}
        {activeTab === "full" && (
          <div style={{ display:"grid", gridTemplateColumns:"1fr 280px", gap:"1.5rem", alignItems:"start" }}>
            <div style={sStyle}>
              <p style={{ fontFamily:"'Cinzel',serif", fontSize:"0.65rem", letterSpacing:"0.15em", color:"#1e6b3c", textTransform:"uppercase", marginBottom:"0.4rem" }}>◈ Full Reports — All Records, All Dates</p>
              <p style={{ fontSize:"0.75rem", color:"rgba(26,26,26,0.45)", marginBottom:"1.2rem" }}>These reports include every record across all months, not filtered by date.</p>
              <FullReportCard title="Ready to Register" desc="All titles where the 4-month proclamation period is complete — awaiting confirmation" onClick={printFullReady} count={readyToRegister.length} />
              <FullReportCard title="New Matai Titles" desc="All titles entered but not yet proclaimed" onClick={printFullNew} count={newMataiRecords.length} color="#7c3aed" />
              <FullReportCard title="Proclamation Report" desc="All active proclamations within 120-day alert window" onClick={printFullProclamation} count={alertRecords.length} />
              <FullReportCard title="Objections Report" desc="All titles with active objections — across all dates" onClick={printFullObjections} count={objectionRecords.length} color="#8b1a1a" />
            </div>
            <div style={{ ...sStyle, position:"sticky", top:"2rem" }}>
              <p style={{ fontFamily:"'Cinzel',serif", fontSize:"0.65rem", letterSpacing:"0.15em", color:"#1e6b3c", textTransform:"uppercase", marginBottom:"1rem" }}>◈ Overview</p>
              {[
                ["Ready to Register",   readyToRegister.length,  "#1e6b3c"],
                ["New Titles",          newMataiRecords.length,  "#7c3aed"],
                ["Proclamation Alerts", alertRecords.length,     "#1a5c35"],
                ["Objections",          objectionRecords.length, "#8b1a1a"],
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
            <div style={sStyle}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"1rem" }}>
                <p style={{ fontFamily:"'Cinzel',serif", fontSize:"0.65rem", letterSpacing:"0.15em", color:"#155c31", textTransform:"uppercase" }}>◈ {registeredAll.length} Registered Matai Titles</p>
                <div style={{ display:"flex", gap:"0.5rem", alignItems:"center" }}>
                  <input type="month" value={monthFilter} onChange={e => setMonthFilter(e.target.value)} style={inputStyle} />
                  <button onClick={printRegisteredMonth} disabled={registeredMonth.length === 0}
                    style={{ fontSize:"0.68rem", padding:"0.35rem 0.8rem", fontFamily:"'Cinzel',serif", letterSpacing:"0.08em", textTransform:"uppercase", background: registeredMonth.length === 0 ? "#f3f4f6" : "#155c3115", border:`1px solid ${registeredMonth.length === 0 ? "#e5e7eb" : "#155c31"}`, color: registeredMonth.length === 0 ? "#9ca3af" : "#155c31", borderRadius:"3px", cursor: registeredMonth.length === 0 ? "not-allowed" : "pointer" }}>
                    📄 Month ({registeredMonth.length})
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
                        <td style={{ padding:"0.45rem 0.75rem" }}>{r.mataiType||"—"}</td>
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

        {/* ── Filtered Reports tab ── */}
        {activeTab === "other" && (
          <div style={{ display:"grid", gridTemplateColumns:"1fr 280px", gap:"1.5rem", alignItems:"start" }}>
            <div>
              {/* Filter controls */}
              <div style={{ ...sStyle, marginBottom:"1rem" }}>
                <p style={{ fontFamily:"'Cinzel',serif", fontSize:"0.65rem", letterSpacing:"0.15em", color:"#1e6b3c", textTransform:"uppercase", marginBottom:"1rem" }}>◈ Filter Reports</p>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr auto", gap:"0.75rem", alignItems:"end" }}>
                  <div>
                    <label style={labelStyle}>Report Type</label>
                    <select value={filterType} onChange={e => setFilterType(e.target.value)}
                      style={{ ...inputStyle, width:"100%", appearance:"none", backgroundImage:"url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%231a5c35' fill='none' stroke-width='2'/%3E%3C/svg%3E\")", backgroundRepeat:"no-repeat", backgroundPosition:"right 8px center", paddingRight:"28px" }}>
                      {typeOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>From Date</label>
                    <input type="date" value={filterFrom} onChange={e => setFilterFrom(e.target.value)} style={{ ...inputStyle, width:"100%" }} />
                  </div>
                  <div>
                    <label style={labelStyle}>To Date</label>
                    <input type="date" value={filterTo} onChange={e => setFilterTo(e.target.value)} style={{ ...inputStyle, width:"100%" }} />
                  </div>
                  <div style={{ display:"flex", gap:"0.5rem" }}>
                    <button onClick={() => { setFilterFrom(""); setFilterTo(""); setFilterType("all"); }}
                      style={{ fontSize:"0.68rem", padding:"0.4rem 0.75rem", fontFamily:"'Cinzel',serif", letterSpacing:"0.06em", textTransform:"uppercase", background:"transparent", border:"1px solid rgba(30,107,60,0.3)", color:"#1e6b3c", borderRadius:"3px", cursor:"pointer", whiteSpace:"nowrap" }}>
                      Clear
                    </button>
                    <button onClick={printFilteredReport} disabled={filteredTotal === 0}
                      style={{ fontSize:"0.68rem", padding:"0.4rem 0.9rem", fontFamily:"'Cinzel',serif", letterSpacing:"0.06em", textTransform:"uppercase", background: filteredTotal === 0 ? "#f3f4f6" : "#1a5c3515", border:`1px solid ${filteredTotal === 0 ? "#e5e7eb" : "#1a5c35"}`, color: filteredTotal === 0 ? "#9ca3af" : "#1a5c35", borderRadius:"3px", cursor: filteredTotal === 0 ? "not-allowed" : "pointer", whiteSpace:"nowrap" }}>
                      📄 Print ({filteredTotal})
                    </button>
                  </div>
                </div>
              </div>

              {/* Results */}
              <div style={sStyle}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"0.75rem" }}>
                  <p style={{ fontFamily:"'Cinzel',serif", fontSize:"0.65rem", letterSpacing:"0.15em", color:"#1e6b3c", textTransform:"uppercase" }}>
                    ◈ Results — {previewRows.length} Record{previewRows.length !== 1 ? "s" : ""}
                  </p>
                  <span style={{ fontSize:"0.72rem", color:"rgba(26,26,26,0.45)", fontStyle:"italic" }}>{dateRangeLabel}</span>
                </div>
                {loading ? <p style={{ fontStyle:"italic", color:"#9ca3af" }}>Loading…</p>
                : previewRows.length === 0
                  ? <div style={{ textAlign:"center", padding:"3rem", color:"rgba(26,26,26,0.35)" }}>
                    <p style={{ fontSize:"1.5rem", marginBottom:"0.5rem" }}>🔍</p>
                    <p style={{ fontStyle:"italic", fontSize:"0.85rem" }}>No records match the selected filter.</p>
                    <p style={{ fontSize:"0.75rem", marginTop:"0.25rem", color:"rgba(26,26,26,0.25)" }}>Try changing the report type or adjusting the date range.</p>
                  </div>
                  : <table style={{ width:"100%", borderCollapse:"collapse", fontSize:"0.82rem" }}>
                    <thead>
                      <tr style={{ background:"#1a5c35" }}>
                        {["Type","Matai Title","Holder","Village","District","Date"].map(h => (
                          <th key={h} style={{ padding:"0.5rem 0.75rem", color:"#fff", fontFamily:"'Cinzel',serif", fontSize:"0.6rem", letterSpacing:"0.08em", textTransform:"uppercase", textAlign:"left", whiteSpace:"nowrap" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {previewRows.map((r,i) => (
                        <tr key={r.id+r._type} style={{ background: i%2===0 ? "#fff" : "#f5faf7" }}>
                          <td style={{ padding:"0.45rem 0.75rem" }}>
                            <span style={{ fontSize:"0.65rem", fontFamily:"'Cinzel',serif", color:r._typeColor, background:`${r._typeColor}12`, border:`1px solid ${r._typeColor}30`, padding:"2px 7px", borderRadius:"2px", whiteSpace:"nowrap" }}>{r._type}</span>
                          </td>
                          <td style={{ padding:"0.45rem 0.75rem", fontFamily:"'Cinzel',serif", fontWeight:700, color:"#1a5c35" }}>{r.mataiTitle||"—"}</td>
                          <td style={{ padding:"0.45rem 0.75rem" }}>{r.holderName||"—"}</td>
                          <td style={{ padding:"0.45rem 0.75rem" }}>{r.village||"—"}</td>
                          <td style={{ padding:"0.45rem 0.75rem", fontSize:"0.78rem" }}>{r.district||"—"}</td>
                          <td style={{ padding:"0.45rem 0.75rem", fontSize:"0.78rem", color:r._typeColor, fontWeight:600 }}>{fmtDate(r._date)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                }
              </div>
            </div>

            {/* Right summary */}
            <div style={{ ...sStyle, position:"sticky", top:"2rem" }}>
              <p style={{ fontFamily:"'Cinzel',serif", fontSize:"0.65rem", letterSpacing:"0.15em", color:"#1e6b3c", textTransform:"uppercase", marginBottom:"1rem" }}>◈ Filter Summary</p>
              <div style={{ marginBottom:"1rem" }}>
                <p style={{ fontSize:"0.72rem", color:"rgba(26,26,26,0.45)", marginBottom:"2px" }}>Period</p>
                <p style={{ fontSize:"0.78rem", color:"#1a5c35", fontWeight:600 }}>{dateRangeLabel}</p>
              </div>
              {[
                ["Ready to Register",   filteredReadyFinal.length,  "#1e6b3c"],
                ["New Matai Titles",    filteredNewFinal.length,    "#7c3aed"],
                ["Proclamation",        filteredProcFinal.length,   "#1a5c35"],
                ["Objections",          filteredObjFinal.length,    "#8b1a1a"],
              ].map(([label, count, col]) => (
                <div key={label} style={{ display:"flex", justifyContent:"space-between", padding:"0.45rem 0", borderBottom:"1px solid rgba(30,107,60,0.08)" }}>
                  <span style={{ fontSize:"0.78rem", color:"rgba(26,26,26,0.65)" }}>{label}</span>
                  <span style={{ fontFamily:"'Cinzel Decorative',serif", fontSize:"1rem", color:col, fontWeight:700 }}>{count}</span>
                </div>
              ))}
              <div style={{ marginTop:"0.75rem", paddingTop:"0.75rem", borderTop:"2px solid rgba(30,107,60,0.15)", display:"flex", justifyContent:"space-between" }}>
                <span style={{ fontSize:"0.78rem", fontFamily:"'Cinzel',serif", color:"#1a5c35", textTransform:"uppercase", letterSpacing:"0.06em" }}>Total</span>
                <span style={{ fontFamily:"'Cinzel Decorative',serif", fontSize:"1.2rem", color:"#1a5c35", fontWeight:700 }}>{filteredTotal}</span>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

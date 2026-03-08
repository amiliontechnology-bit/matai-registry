import { useState, useEffect } from "react";
import { collection, getDocs, writeBatch, doc, updateDoc, onSnapshot } from "firebase/firestore";
import { auth, db } from "../firebase";
import { getPermissions } from "../utils/roles";
import { logAudit } from "../utils/audit";
import { cacheClear, cacheGet, cacheSet } from "../utils/cache";
import Sidebar from "../components/Sidebar";
import { Navigate } from "react-router-dom";


// ── Savali helpers ────────────────────────────────────────────────────────────
const SAVAII_DISTRICTS = [
  "FAASALELEAGA Nu 1","FAASALELEAGA Nu 2","FAASALELEAGA Nu 3","FAASALELEAGA Nu. 04",
  "GAGAEMAUGA Nu.01","GAGAEMAUGA Nu.02","GAGAEMAUGA Nu.03",
  "GAGAIFOMAUGA Nu.03","GAGAIFOMAUGA Nu.1","GAGAIFOMAUGA Nu.2",
  "ALATAUA SISIFO","FALEALUPO","PALAULI","PALAULI LE FALEFA","PALAULI SISIFO",
  "SATUPAITEA","VAISIGANO Nu.1","VAISIGANO Nu.02","SALEGA",
];
const getSavaliIsland = (d) => SAVAII_DISTRICTS.some(s => s.toUpperCase() === (d||"").trim().toUpperCase()) ? "SAVAII" : "UPOLU";
const get28th = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-28`;
const addMonths4 = (ds) => { const d = new Date(ds+"T00:00:00"); d.setMonth(d.getMonth()+4); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; };

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

// Is the date's year+month equal to a given YYYY-MM string?
function inMonth(dateStr, ym) {
  if (!dateStr || !ym) return false;
  return dateStr.split("T")[0].substring(0,7) === ym;
}

// Is the date within a from–to range?
function inRange(dateStr, from, to) {
  if (!dateStr) return false;
  const d = dateStr.split("T")[0];
  if (from && d < from) return false;
  if (to   && d > to)   return false;
  return true;
}

// Is the date on or before today?
function isUpToToday(dateStr) {
  if (!dateStr) return false;
  const today = new Date(); today.setHours(0,0,0,0);
  return new Date(dateStr + "T00:00:00") <= today;
}

function openPDF(title, html) {
  const blob = new Blob([html], { type: "text/html" });
  const url  = URL.createObjectURL(blob);
  const win  = window.open(url, "_blank");
  // Release the object URL after the tab has loaded
  if (win) win.addEventListener("load", () => URL.revokeObjectURL(url), { once: true });
}

function reportHeader(title, subtitle, count, generatedBy, extra) {
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
    ${extra ? `<span>${extra}</span>` : `<span>Records: ${count}</span>`}
  </div>`;
}

export default function Reports({ userRole }) {
  const [records,    setRecords]    = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [activeTab,  setActiveTab]  = useState("monthly");
  // ── Savali tab state ──────────────────────────────────────────────────────
  const [savaliRecords,      setSavaliRecords]      = useState([]);
  const [savaliSelected,     setSavaliSelected]     = useState(new Set());
  const [savaliEditRecord,   setSavaliEditRecord]   = useState(null);
  const [savaliEditForm,     setSavaliEditForm]     = useState({});
  const [savaliShowConfirm,  setSavaliShowConfirm]  = useState(false);
  const [savaliSaving,       setSavaliSaving]       = useState(false);
  const [savaliProcDate,     setSavaliProcDate]     = useState(get28th());
  const [pdfMonth,           setPdfMonth]           = useState(() => { const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}`; });


  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo,   setFilterTo]   = useState("");
  const [filterType, setFilterType] = useState("all");
  const [monthFilter, setMonthFilter] = useState(() => {
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,"0")}`;
  });

  const perms = getPermissions(userRole);
  const user  = auth.currentUser;

  useEffect(() => {
    setLoading(true);
    const unsub = onSnapshot(collection(db, "registrations"), (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      data.sort((a,b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
      cacheSet("registrations", data);
      setRecords(data);
      const noProc = data.filter(r => !r.dateProclamation || r.dateProclamation.trim() === "");
      setSavaliRecords(noProc);
      setSavaliSelected(new Set(noProc.map(r => r.id)));
      setLoading(false);
    }, (err) => { console.error(err); setLoading(false); });
    return () => unsub();
  }, []);

  if (userRole === null) return null;
  if (!perms.canViewReports) return <Navigate to="/dashboard" />;

  const genBy      = user?.displayName || user?.email || "Admin";
  const now        = new Date();
  const currentYM  = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}`;
  const monthLabel = `${MONTHS[now.getMonth()]} ${now.getFullYear()}`;
  const [filterYear, filterMonth] = monthFilter.split("-").map(Number);
  const selMonthLabel = `${MONTHS[filterMonth-1]} ${filterYear}`;

  // ── ALL-TIME data cuts ──────────────────────────────────────
  const registeredAll = records
    .filter(r => r.dateRegistration || r.status === "completed")
    .sort((a,b) => (b.dateRegistration||"").localeCompare(a.dateRegistration||""));

  const readyAll = records.filter(r =>
    r.objection !== "yes" && !r.dateRegistration && r.status !== "completed" && !!effectiveRegDate(r)
  );

  const newAll = records.filter(r =>
    !r.dateProclamation && !r.dateRegistration && r.objection !== "yes"
  );

  const objAll = records.filter(r => r.objection === "yes");

  const procAll = records.filter(r => {
    if (r.objection === "yes" || r.dateRegistration || !r.dateProclamation) return false;
    if (effectiveRegDate(r)) return false; // reg date passed → goes to readyAll instead
    // Include all records actively within proclamation period (proclaimed but reg date not yet reached)
    const procDate = new Date(r.dateProclamation + "T00:00:00");
    return procDate <= now; // proclaimed in the past, reg date not yet reached
  });

  // ── MONTHLY cuts (filter by current month) ──────────────────
  // New Matai: dateConferred in current month
  const newMonth = newAll.filter(r => inMonth(r.dateConferred, currentYM));

  // Ready to Register: auto reg date falls in current month
  const readyMonth = readyAll.filter(r => {
    const rd = effectiveRegDate(r) || autoRegDate(r.dateProclamation);
    return inMonth(rd, currentYM);
  });

  // Proclamation Report (monthly): proclamation date in current month
  const procMonth = records.filter(r => {
    if (r.objection === "yes" || r.dateRegistration) return false;
    return inMonth(r.dateProclamation, currentYM);
  });

  // Objection Report (monthly): objection date in current month
  const objMonth = objAll.filter(r => inMonth(r.objectionDate || r.dateProclamation, currentYM));

  // Registered this month (for full monthly report only)
  const regMonth = registeredAll.filter(r => inMonth(r.dateRegistration, currentYM));

  // ── Registered Matai tab: filter by selected month ──────────
  const registeredFiltered = registeredAll.filter(r => {
    if (!r.dateRegistration) return false;
    const p = r.dateRegistration.split("-");
    return parseInt(p[0]) === filterYear && parseInt(p[1]) === filterMonth;
  });

  // ── Filtered Reports tab ─────────────────────────────────────
  const noFilter = !filterFrom && !filterTo;

  const applyRange = (arr, dateField) => {
    if (noFilter) return arr;
    return arr.filter(r => inRange(r[dateField] || "", filterFrom, filterTo));
  };

  const fReady = (filterType==="all"||filterType==="ready")
    ? applyRange(readyAll, "dateProclamation") : [];
  const fNew   = (filterType==="all"||filterType==="new")
    ? applyRange(newAll, "dateConferred") : [];
  const fProc  = (filterType==="all"||filterType==="proclamation")
    ? applyRange(procAll, "dateProclamation") : [];
  const fObj   = (filterType==="all"||filterType==="objections")
    ? applyRange(objAll, "objectionDate") : [];

  const filteredTotal = fReady.length + fNew.length + fProc.length + fObj.length;
  const dateRangeLabel = (filterFrom || filterTo)
    ? `${filterFrom ? fmtDate(filterFrom) : "Beginning"} — ${filterTo ? fmtDate(filterTo) : "Today"}`
    : "All dates";

  // ── PDF helpers ───────────────────────────────────────────────
  const footer = `<div class="footer">Samoa Matai Title Registry — Resitalaina o Matai — Confidential</div>
    </body></html>`;

  const mkRow = (cells, i) =>
    `<tr style="background:${i%2?"#f9f9f9":"#fff"}">${cells.map(c=>`<td style="padding:4px 8px;border-bottom:1px solid #eee">${c}</td>`).join("")}</tr>`;

  const mkTable = (color, headers, rows) =>
    `<table><thead><tr>${headers.map(h=>`<th style="background:${color};color:#fff;padding:5px 8px;text-align:left;font-family:'Cinzel',serif;font-size:0.6rem;letter-spacing:0.06em;text-transform:uppercase">${h}</th>`).join("")}</tr></thead><tbody>${rows}</tbody></table>`;

  const mkSection = (title, color, headers, rowsHtml) =>
    !rowsHtml ? "" :
    `<h2 style="font-family:'Cinzel',serif;color:${color};font-size:0.9rem;margin:1.5rem 0 0.4rem;border-bottom:2px solid ${color};padding-bottom:4px;text-transform:uppercase;letter-spacing:0.1em">${title}</h2>
    ${mkTable(color, headers, rowsHtml)}`;

  const rowReady  = (r,i) => mkRow([i+1,`<strong>${r.mataiTitle||"—"}</strong>`,r.holderName||"—",r.village||"—",r.district||"—",fmtDate(r.dateProclamation),`<span style="color:#1a5c35;font-weight:600">${fmtDate(effectiveRegDate(r)||autoRegDate(r.dateProclamation))}</span>`],i);
  const rowNew    = (r,i) => mkRow([i+1,`<strong>${r.mataiTitle||"—"}</strong>`,r.holderName||"—",r.mataiType||"—",r.village||"—",r.district||"—",fmtDate(r.dateConferred)],i);
  const rowProc   = (r,i) => mkRow([i+1,`<strong>${r.mataiTitle||"—"}</strong>`,r.holderName||"—",r.village||"—",r.district||"—",fmtDate(r.dateProclamation),`<span style="color:#1a5c35">${fmtDate(autoRegDate(r.dateProclamation))}</span>`],i);
  const rowObj    = (r,i) => mkRow([i+1,`<strong>${r.mataiTitle||"—"}</strong>`,r.holderName||"—",r.village||"—",r.district||"—",fmtDate(r.dateProclamation),`<span style="color:#8b1a1a;font-weight:600">${fmtDate(r.objectionDate)}</span>`],i);
  const rowReg    = (r,i) => mkRow([i+1,`<strong>${r.mataiTitle||"—"}</strong>`,r.holderName||"—",r.mataiType||"—",r.village||"—",r.district||"—",fmtDate(r.dateProclamation),`<span style="color:#1a5c35;font-weight:600">${fmtDate(r.dateRegistration)}</span>`],i);

  const HDR_READY = ["#","Matai Title","Holder","Village","District","Proclaimed","Reg. Date"];
  const HDR_NEW   = ["#","Matai Title","Holder","Type","Village","District","Date Conferred"];
  const HDR_PROC  = ["#","Matai Title","Holder","Village","District","Proclaimed","Auto Reg. Date"];
  const HDR_OBJ   = ["#","Matai Title","Holder","Village","District","Proclaimed","Objection Date"];
  const HDR_REG   = ["#","Matai Title","Holder","Type","Village","District","Proclaimed","Registered"];

  // Monthly PDFs
  const printMonthlyFull = () => {
    const stats = [["Total",records.length,"#1a5c35"],["Registered",regMonth.length,"#155c31"],["New",newMonth.length,"#7c3aed"],["Ready",readyMonth.length,"#1e6b3c"],["Proclaimed",procMonth.length,"#1a5c35"],["Objections",objMonth.length,"#8b1a1a"]];
    const html = reportHeader(`Monthly Report — ${monthLabel}`,`All matai title activity for ${monthLabel}`,records.length,genBy)
      + `<div style="display:flex;gap:1rem;margin-bottom:1.5rem;flex-wrap:wrap">${stats.map(([l,n,c])=>`<div style="border:1px solid ${c}30;border-radius:4px;padding:0.5rem 1rem;text-align:center;min-width:80px"><div style="font-size:1.6rem;font-weight:bold;color:${c}">${n}</div><div style="font-size:0.6rem;text-transform:uppercase;color:${c};letter-spacing:0.05em;font-family:'Cinzel',serif">${l}</div></div>`).join("")}</div>`
      + mkSection("New Matai Titles","#7c3aed",HDR_NEW,newMonth.map(rowNew).join(""))
      + mkSection("Ready to Register","#1e6b3c",HDR_READY,readyMonth.map(rowReady).join(""))
      + mkSection("Proclamation Report","#1a5c35",HDR_PROC,procMonth.map(rowProc).join(""))
      + mkSection("Objections Report","#8b1a1a",HDR_OBJ,objMonth.map(rowObj).join(""))
      + mkSection("Registered This Month","#155c31",HDR_REG,regMonth.map(rowReg).join(""))
      + footer;
    openPDF("Monthly Report", html);
    logAudit("REPORT_PDF", { type:"monthly_full", month: monthLabel });
  };

  const printMonthlyNew      = () => { openPDF("New Matai Titles",    reportHeader(`New Matai Titles — ${monthLabel}`,`Titles entered or imported in ${monthLabel}`,newMonth.length,genBy)   + mkTable("#7c3aed",HDR_NEW,  newMonth.map(rowNew).join(""))   + footer); logAudit("REPORT_PDF",{type:"monthly_new"}); };
  const printMonthlyReady    = () => { openPDF("Ready to Register",   reportHeader(`Ready to Register — ${monthLabel}`,`Reg. date falls in ${monthLabel}, awaiting confirmation`,readyMonth.length,genBy) + mkTable("#1e6b3c",HDR_READY,readyMonth.map(rowReady).join("")) + footer); logAudit("REPORT_PDF",{type:"monthly_ready"}); };
  const printMonthlyProc     = () => { openPDF("Proclamation Report", reportHeader(`Proclamation Report — ${monthLabel}`,`Active proclamations in ${monthLabel}`,procMonth.length,genBy)      + mkTable("#1a5c35",HDR_PROC, procMonth.map(rowProc).join(""))  + footer); logAudit("REPORT_PDF",{type:"monthly_proc"}); };
  const printMonthlyObj      = () => { openPDF("Objections Report",   reportHeader(`Objections Report — ${monthLabel}`,`Objections filed in ${monthLabel}`,objMonth.length,genBy)            + mkTable("#8b1a1a",HDR_OBJ,  objMonth.map(rowObj).join(""))   + footer); logAudit("REPORT_PDF",{type:"monthly_obj"}); };

  // Full PDFs (all up to today)
  const printFullNew    = () => { openPDF("New Matai Titles",    reportHeader("New Matai Titles","All titles entered — not yet proclaimed, up to today",newAll.length,genBy)         + mkTable("#7c3aed",HDR_NEW,  newAll.map(rowNew).join(""))   + footer); logAudit("REPORT_PDF",{type:"full_new"}); };
  const printFullReady  = () => { openPDF("Ready to Register",   reportHeader("Ready to Register","All titles where proclamation period is complete — up to today",readyAll.length,genBy) + mkTable("#1e6b3c",HDR_READY,readyAll.map(rowReady).join("")) + footer); logAudit("REPORT_PDF",{type:"full_ready"}); };
  const printFullProc   = () => { openPDF("Proclamation Report", reportHeader("Proclamation Report","All active proclamations up to today",procAll.length,genBy)                     + mkTable("#1a5c35",HDR_PROC, procAll.map(rowProc).join(""))  + footer); logAudit("REPORT_PDF",{type:"full_proc"}); };
  const printFullObj    = () => { openPDF("Objections Report",   reportHeader("Objections Report","All titles with active objections — up to today",objAll.length,genBy)             + mkTable("#8b1a1a",HDR_OBJ,  objAll.map(rowObj).join(""))   + footer); logAudit("REPORT_PDF",{type:"full_obj"}); };

  // Registered PDFs
  const printRegisteredFiltered = () => { openPDF("Registered Matai", reportHeader(`Registered Matai — ${selMonthLabel}`,`Matai titles registered in ${selMonthLabel}`,registeredFiltered.length,genBy) + mkTable("#155c31",HDR_REG,registeredFiltered.map(rowReg).join("")) + footer); logAudit("REPORT_PDF",{type:"registered_month",month:selMonthLabel}); };
  const printRegisteredAll      = () => { openPDF("All Registered",   reportHeader("All Registered Matai","Complete list of all registered matai titles",registeredAll.length,genBy)          + mkTable("#155c31",HDR_REG,registeredAll.map(rowReg).join(""))      + footer); logAudit("REPORT_PDF",{type:"registered_all"}); };

  // Filtered PDF
  const printFiltered = () => {
    const typeLabel = { all:"All Types", ready:"Ready to Register", new:"New Matai Titles", proclamation:"Proclamation Report", objections:"Objections Report" }[filterType];
    const html = reportHeader(`Filtered Report — ${typeLabel}`,dateRangeLabel,filteredTotal,genBy,`Period: ${dateRangeLabel}`)
      + mkSection("Ready to Register","#1e6b3c",HDR_READY,fReady.map(rowReady).join(""))
      + mkSection("New Matai Titles","#7c3aed",HDR_NEW,fNew.map(rowNew).join(""))
      + mkSection("Proclamation Report","#1a5c35",HDR_PROC,fProc.map(rowProc).join(""))
      + mkSection("Objections Report","#8b1a1a",HDR_OBJ,fObj.map(rowObj).join(""))
      + footer;
    openPDF("Filtered Report", html);
    logAudit("REPORT_PDF", { type:"filtered", filterType, from:filterFrom, to:filterTo });
  };


  // ── Savali helpers ────────────────────────────────────────────────────────
  const savaliGrouped = (rows) => {
    const sort = arr => [...arr].sort((a,b) => (a.village||"").localeCompare(b.village||""));
    return { upolu: sort(rows.filter(r => getSavaliIsland(r.district)==="UPOLU")), savaii: sort(rows.filter(r => getSavaliIsland(r.district)==="SAVAII")) };
  };
  const savaliToggleAll = () => savaliSelected.size === savaliRecords.length ? setSavaliSelected(new Set()) : setSavaliSelected(new Set(savaliRecords.map(r=>r.id)));
  const savaliToggleOne = (id) => { const s=new Set(savaliSelected); s.has(id)?s.delete(id):s.add(id); setSavaliSelected(s); };
  const savaliOpenEdit = (r) => { setSavaliEditRecord(r); setSavaliEditForm({ village:r.village||"", mataiTitle:r.mataiTitle||"", holderName:r.holderName||"", faapogai:r.faapogai||"" }); };
  const savaliSaveEdit = async () => {
    if (!savaliEditRecord) return;
    setSavaliSaving(true);
    try {
      await updateDoc(doc(db,"registrations",savaliEditRecord.id), savaliEditForm);
      cacheClear("registrations");
      await logAudit("EDIT_SAVALI_RECORD",{id:savaliEditRecord.id,changes:savaliEditForm});
      setSavaliEditRecord(null);
      const snap = await getDocs(collection(db,"registrations"));
      const all = snap.docs.map(d=>({id:d.id,...d.data()}));
      cacheSet("registrations",all);
      const noProc = all.filter(r=>!r.dateProclamation||r.dateProclamation.trim()==="");
      setSavaliRecords(noProc); setRecords(all);
    } catch(e) { alert("Error: "+e.message); }
    setSavaliSaving(false);
  };
  const savaliSetDates = async () => {
    setSavaliSaving(true);
    const toSet = savaliRecords.filter(r=>savaliSelected.has(r.id));
    try {
      const batch = writeBatch(db);
      toSet.forEach(r => batch.update(doc(db,"registrations",r.id),{dateProclamation:savaliProcDate}));
      await batch.commit();
      cacheClear("registrations");
      await logAudit("SET_PROCLAMATION_DATE",{date:savaliProcDate,count:toSet.length,recordIds:toSet.map(r=>r.id)});
      setSavaliShowConfirm(false);
      const snap = await getDocs(collection(db,"registrations"));
      const all = snap.docs.map(d=>({id:d.id,...d.data()}));
      cacheSet("registrations",all);
      const noProc = all.filter(r=>!r.dateProclamation||r.dateProclamation.trim()==="");
      setSavaliRecords(noProc); setRecords(all);
      setSavaliSelected(new Set(noProc.map(r=>r.id)));
    } catch(e) { alert("Error: "+e.message); }
    setSavaliSaving(false);
  };
  const savaliEndDate = addMonths4(savaliProcDate);
  const savaliPDFStyles = `
    @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700&display=swap');
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:Arial,sans-serif;padding:15mm 20mm;color:#000;font-size:10pt}
    .hdr{text-align:center;border-bottom:2px solid #1a5c35;padding-bottom:10px;margin-bottom:14px}
    .hdr img{height:65px;margin-bottom:6px}
    .hdr h1{font-family:'Cinzel',serif;font-size:13pt;letter-spacing:0.08em;color:#1a5c35;margin-bottom:3px}
    .hdr .sub{font-size:9pt;color:#555;margin-top:2px}
    .hdr .dr{font-size:10pt;color:#555}
    .meta{display:flex;justify-content:space-between;font-size:7pt;color:#888;margin-bottom:12px;font-style:italic}
    table{width:100%;border-collapse:collapse;margin-bottom:14px;page-break-inside:auto}
    thead{display:table-header-group}
    th{background:#1a5c35;color:#fff;padding:4px 8px;text-align:center;font-family:'Cinzel',serif;font-size:7pt;letter-spacing:0.08em;text-transform:uppercase}
    td{border:1px solid #ccc;padding:4px 7px;text-align:center;font-size:9pt}
    tr:nth-child(even) td{background:#f5faf7}
    tr{page-break-inside:avoid}
    .footer{margin-top:20px;font-size:7pt;color:#aaa;border-top:1px solid #eee;padding-top:6px;display:flex;justify-content:space-between;font-style:italic;font-family:'Cinzel',serif;letter-spacing:0.06em}
    @media print{body{padding:12mm 15mm}}
  `;
  const savaliMkRows = rows => rows.map(r=>`<tr><td>${r.village||""}</td><td style="text-transform:uppercase;font-weight:600">${r.mataiTitle||""}</td><td>${r.holderName||""}</td><td>${r.faapogai||""}</td></tr>`).join("");
  const savaliOpenPDF = (title, island, rows, procFmt, endFmt) => {
    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"/><title>${title}</title>
      <style>${savaliPDFStyles}</style></head><body>
      <div class="hdr">
        <img src="${window.location.origin}/mjca_logo.jpeg" alt="Emblem" onerror="this.style.display='none'"/>
        <h1>LISI O LE SAVALI</h1>
        <div class="sub">${island}</div>
        <div class="dr">Matagaluega o Faamasinoga ma le Faafoeina o Tulaga Tau Faamasinoga</div>
        <div class="dr" style="margin-top:4px;font-weight:bold">${procFmt} &nbsp;&#9658;&nbsp; ${endFmt}</div>
      </div>
      <div class="meta"><span>Printed: ${fmtDate(new Date().toISOString().split("T")[0])}</span><span>${island} — ${rows.length} record${rows.length!==1?"s":""}</span></div>
      <table><thead><tr><th>NUU</th><th>SUAFA MATAI</th><th>IGOA TAULEALEA</th><th>FAAPOGAI</th></tr></thead>
      <tbody>${savaliMkRows(rows)}</tbody></table>
      <div class="footer"><span>SAVALI &mdash; ${island} &mdash; ${procFmt} &ndash; ${endFmt}</span><span>Aofa&#x2019;i: ${rows.length}</span></div>
    </body></html>`;
    const blob = new Blob([html],{type:"text/html"});
    const url = URL.createObjectURL(blob);
    const win = window.open(url,"_blank");
    if (win) win.addEventListener("load",()=>{ URL.revokeObjectURL(url); setTimeout(()=>win.print(),800); },{once:true});
  };
  // Records matching the selected PDF month (YYYY-MM) for PDF generation
  const savaliByProcDate = records.filter(r => {
    if (!r.dateProclamation || r.objection === "yes") return false;
    return r.dateProclamation.trim().startsWith(pdfMonth);
  });
  const savaliPrintUpolu = () => {
    const {upolu} = savaliGrouped(savaliByProcDate);
    savaliOpenPDF(`Savali Upolu ${fmtDate(savaliProcDate)}`, "UPOLU", upolu, fmtDate(savaliProcDate), fmtDate(savaliEndDate));
  };
  const savaliPrintSavaii = () => {
    const {savaii} = savaliGrouped(savaliByProcDate);
    savaliOpenPDF(`Savali Savaii ${fmtDate(savaliProcDate)}`, "SAVAII", savaii, fmtDate(savaliProcDate), fmtDate(savaliEndDate));
  };

  // ── Shared UI components ──────────────────────────────────────
  const sStyle = { background:"#fff", border:"1px solid rgba(30,107,60,0.2)", borderRadius:"4px", padding:"1.5rem", marginBottom:"1rem", boxShadow:"0 1px 4px rgba(0,0,0,0.05)" };
  const inputStyle = { fontSize:"0.78rem", padding:"0.4rem 0.65rem", border:"1px solid rgba(30,107,60,0.3)", borderRadius:"3px", color:"#1a5c35", fontFamily:"'Cinzel',serif", background:"#fff" };
  const labelStyle = { fontSize:"0.65rem", fontFamily:"'Cinzel',serif", letterSpacing:"0.1em", textTransform:"uppercase", color:"rgba(26,26,26,0.5)", display:"block", marginBottom:"4px" };

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

  const [expandedReport, setExpandedReport] = useState(null);

  const ReportRow = ({ title, desc, onClick, count, color="#1a5c35", data=[], headers=[] }) => {
    const isExpanded = expandedReport === title;
    return (
      <div style={{ marginBottom:"0.5rem" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"0.9rem 1rem", background:"#fafafa", border:"1px solid rgba(30,107,60,0.1)", borderRadius: isExpanded ? "4px 4px 0 0" : "4px" }}>
          <div>
            <p style={{ fontFamily:"'Cinzel',serif", fontSize:"0.8rem", color, fontWeight:600 }}>{title}</p>
            <p style={{ fontSize:"0.73rem", color:"rgba(26,26,26,0.5)", marginTop:"2px" }}>{desc}</p>
          </div>
          {perms.canPrint ? (
            <button onClick={onClick} disabled={count === 0}
              style={{ fontSize:"0.68rem", padding:"0.4rem 1rem", fontFamily:"'Cinzel',serif", letterSpacing:"0.08em", textTransform:"uppercase",
                background: count===0 ? "#f3f4f6" : `${color}15`,
                border:`1px solid ${count===0 ? "#e5e7eb" : color}`,
                color: count===0 ? "#9ca3af" : color,
                borderRadius:"3px", cursor:count===0 ? "not-allowed" : "pointer", whiteSpace:"nowrap" }}>
              📄 Print ({count})
            </button>
          ) : (
            <button onClick={() => count > 0 && setExpandedReport(isExpanded ? null : title)}
              disabled={count === 0}
              style={{ fontSize:"0.68rem", padding:"0.4rem 0.9rem", fontFamily:"'Cinzel',serif", letterSpacing:"0.08em", textTransform:"uppercase",
                background: count===0 ? "#f3f4f6" : isExpanded ? `${color}25` : `${color}10`,
                border:`1px solid ${count===0 ? "#e5e7eb" : color}`,
                color: count===0 ? "#9ca3af" : color,
                borderRadius:"3px", cursor:count===0 ? "not-allowed" : "pointer", whiteSpace:"nowrap" }}>
              {count===0 ? "0 records" : isExpanded ? "▲ Hide" : `▼ View (${count})`}
            </button>
          )}
        </div>
        {!perms.canPrint && isExpanded && data.length > 0 && (
          <div style={{ border:"1px solid rgba(30,107,60,0.1)", borderTop:"none", borderRadius:"0 0 4px 4px", overflowX:"auto" }}>
            <table style={{ width:"100%", borderCollapse:"collapse", fontSize:"0.78rem" }}>
              <thead>
                <tr style={{ background: color }}>
                  {headers.map(h => (
                    <th key={h} style={{ padding:"0.5rem 0.75rem", color:"#fff", fontFamily:"'Cinzel',serif", fontSize:"0.6rem", letterSpacing:"0.1em", textTransform:"uppercase", textAlign:"left", whiteSpace:"nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.map((r, i) => (
                  <tr key={r.id} style={{ background: i%2 ? "#f9fafb" : "#fff" }}>
                    {headers.map((h,j) => (
                      <td key={j} style={{ padding:"0.5rem 0.75rem", borderBottom:"1px solid #f3f4f6", color:"#374151" }}>
                        {j===0 ? i+1
                          : h==="Matai Title" ? (r.mataiTitle||"—")
                          : h==="Holder" ? (r.holderName||"—")
                          : h==="Type" ? (r.mataiType||"—")
                          : h==="Village" ? (r.village||"—")
                          : h==="District" ? (r.district||"—")
                          : h==="Proclaimed" ? fmtDate(r.dateProclamation)
                          : h==="Reg. Date" ? fmtDate(effectiveRegDate(r)||autoRegDate(r.dateProclamation))
                          : h==="Auto Reg. Date" ? fmtDate(autoRegDate(r.dateProclamation))
                          : h==="Date Conferred" ? fmtDate(r.dateConferred)
                          : h==="Objection Date" ? fmtDate(r.objectionDate)
                          : h==="Registered" ? fmtDate(r.dateRegistration)
                          : "—"}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  };

  const SummaryRow = ({ label, count, color }) => (
    <div style={{ display:"flex", justifyContent:"space-between", padding:"0.45rem 0", borderBottom:"1px solid rgba(30,107,60,0.08)" }}>
      <span style={{ fontSize:"0.78rem", color:"rgba(26,26,26,0.65)" }}>{label}</span>
      <span style={{ fontFamily:"'Cinzel Decorative',serif", fontSize:"1rem", color, fontWeight:700 }}>{count}</span>
    </div>
  );

  const previewRows = [
    ...fReady.map(r => ({ ...r, _type:"Ready to Register", _typeColor:"#1e6b3c", _date:r.dateProclamation })),
    ...fNew.map(r   => ({ ...r, _type:"New Matai Title",   _typeColor:"#7c3aed", _date:r.dateConferred })),
    ...fProc.map(r  => ({ ...r, _type:"Proclamation",      _typeColor:"#1a5c35", _date:r.dateProclamation })),
    ...fObj.map(r   => ({ ...r, _type:"Objection",         _typeColor:"#8b1a1a", _date:r.objectionDate||r.dateProclamation })),
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

        <div style={{ display:"flex", gap:"0.5rem", marginBottom:"1.5rem", flexWrap:"wrap" }}>
          <TabBtn id="monthly"    label="Monthly Reports" />
          <TabBtn id="full"       label="Full Reports" />
          <TabBtn id="registered" label="Registered Matai" count={registeredAll.length} color="#155c31" />
          <TabBtn id="other"      label="Filtered Reports" />
          <TabBtn id="savali"    label="Savali" count={savaliRecords.length} color="#b45309" />
        </div>

        {/* ══ MONTHLY REPORTS ══ */}
        {activeTab === "monthly" && (
          <div style={{ display:"grid", gridTemplateColumns:"1fr 280px", gap:"1.5rem", alignItems:"start" }}>
            <div style={sStyle}>
              <p style={{ fontFamily:"'Cinzel',serif", fontSize:"0.65rem", letterSpacing:"0.15em", color:"#1e6b3c", textTransform:"uppercase", marginBottom:"0.25rem" }}>◈ Monthly Reports — {monthLabel}</p>
              <p style={{ fontSize:"0.74rem", color:"rgba(26,26,26,0.4)", marginBottom:"1.1rem" }}>All data filtered to the current month only.</p>
              <ReportRow title="Full Monthly Report" desc={`All activity summary for ${monthLabel}`} onClick={printMonthlyFull} count={records.length} data={records} headers={["#","Matai Title","Holder","Type","Village","District","Proclaimed"]} />
              <ReportRow title="New Matai Titles" desc={`Titles entered or imported in ${monthLabel}`} onClick={printMonthlyNew} count={newMonth.length} color="#7c3aed" data={newMonth} headers={HDR_NEW} />
              <ReportRow title="Ready to Register" desc={`Registration date falls in ${monthLabel} — awaiting confirmation`} onClick={printMonthlyReady} count={readyMonth.length} data={readyMonth} headers={HDR_READY} />
              <ReportRow title="Proclamation Report" desc={`Proclamations active in ${monthLabel}`} onClick={printMonthlyProc} count={procMonth.length} data={procMonth} headers={HDR_PROC} />
              <ReportRow title="Objections Report" desc={`Objections filed in ${monthLabel}`} onClick={printMonthlyObj} count={objMonth.length} color="#8b1a1a" data={objMonth} headers={HDR_OBJ} />
            </div>
            <div style={{ ...sStyle, position:"sticky", top:"2rem" }}>
              <p style={{ fontFamily:"'Cinzel',serif", fontSize:"0.65rem", letterSpacing:"0.15em", color:"#1e6b3c", textTransform:"uppercase", marginBottom:"0.75rem" }}>◈ {monthLabel} Summary</p>
              <SummaryRow label="Total Records"      count={records.length}    color="#1a5c35" />
              <SummaryRow label="New Matai Titles"   count={newMonth.length}   color="#7c3aed" />
              <SummaryRow label="Ready to Register"  count={readyMonth.length} color="#1e6b3c" />
              <SummaryRow label="Proclamations"      count={procMonth.length}  color="#1a5c35" />
              <SummaryRow label="Objections"         count={objMonth.length}   color="#8b1a1a" />
              <SummaryRow label="Registered"         count={regMonth.length}   color="#155c31" />
            </div>
          </div>
        )}

        {/* ══ FULL REPORTS ══ */}
        {activeTab === "full" && (
          <div style={{ display:"grid", gridTemplateColumns:"1fr 280px", gap:"1.5rem", alignItems:"start" }}>
            <div style={sStyle}>
              <p style={{ fontFamily:"'Cinzel',serif", fontSize:"0.65rem", letterSpacing:"0.15em", color:"#1e6b3c", textTransform:"uppercase", marginBottom:"0.25rem" }}>◈ Full Reports — All Records Up To Today</p>
              <p style={{ fontSize:"0.74rem", color:"rgba(26,26,26,0.4)", marginBottom:"1.1rem" }}>Includes every record across all months, not limited to the current month.</p>
              <ReportRow title="New Matai Titles"   desc="All titles entered but not yet proclaimed — across all dates"  onClick={printFullNew}   count={newAll.length}   color="#7c3aed" data={newAll}   headers={HDR_NEW} />
              <ReportRow title="Ready to Register"  desc="All titles where the 4-month proclamation period is complete"  onClick={printFullReady} count={readyAll.length} data={readyAll} headers={HDR_READY} />
              <ReportRow title="Proclamation Report" desc="All active proclamations within 120-day window"               onClick={printFullProc}  count={procAll.length} data={procAll}  headers={HDR_PROC} />
              <ReportRow title="Objections Report"  desc="All titles with active objections — across all dates"          onClick={printFullObj}   count={objAll.length}  color="#8b1a1a" data={objAll} headers={HDR_OBJ} />
            </div>
            <div style={{ ...sStyle, position:"sticky", top:"2rem" }}>
              <p style={{ fontFamily:"'Cinzel',serif", fontSize:"0.65rem", letterSpacing:"0.15em", color:"#1e6b3c", textTransform:"uppercase", marginBottom:"0.75rem" }}>◈ All-Time Overview</p>
              <SummaryRow label="New Matai Titles"   count={newAll.length}   color="#7c3aed" />
              <SummaryRow label="Ready to Register"  count={readyAll.length} color="#1e6b3c" />
              <SummaryRow label="Proclamation Alerts" count={procAll.length} color="#1a5c35" />
              <SummaryRow label="Objections"          count={objAll.length}  color="#8b1a1a" />
            </div>
          </div>
        )}

        {/* ══ REGISTERED MATAI ══ */}
        {activeTab === "registered" && (
          <div style={{ display:"grid", gridTemplateColumns:"1fr 280px", gap:"1.5rem", alignItems:"start" }}>
            <div style={sStyle}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"1rem", flexWrap:"wrap", gap:"0.5rem" }}>
                <p style={{ fontFamily:"'Cinzel',serif", fontSize:"0.65rem", letterSpacing:"0.15em", color:"#155c31", textTransform:"uppercase" }}>◈ Registered Matai Titles</p>
                <div style={{ display:"flex", gap:"0.5rem", alignItems:"center", flexWrap:"wrap" }}>
                  <div>
                    <label style={{ ...labelStyle, display:"inline", marginRight:"6px" }}>Filter month</label>
                    <input type="month" value={monthFilter} onChange={e => setMonthFilter(e.target.value)} style={inputStyle} />
                  </div>
                  {perms.canPrint && <button onClick={printRegisteredFiltered} disabled={registeredFiltered.length===0}
                    style={{ fontSize:"0.68rem", padding:"0.35rem 0.8rem", fontFamily:"'Cinzel',serif", letterSpacing:"0.08em", textTransform:"uppercase", background:registeredFiltered.length===0?"#f3f4f6":"#155c3115", border:`1px solid ${registeredFiltered.length===0?"#e5e7eb":"#155c31"}`, color:registeredFiltered.length===0?"#9ca3af":"#155c31", borderRadius:"3px", cursor:registeredFiltered.length===0?"not-allowed":"pointer" }}>
                    📄 {selMonthLabel} ({registeredFiltered.length})
                  </button>}

                </div>
              </div>
              {loading ? <p style={{ fontStyle:"italic", color:"#9ca3af" }}>Loading…</p>
              : registeredFiltered.length === 0
                ? <div style={{ textAlign:"center", padding:"3rem", color:"rgba(26,26,26,0.35)" }}>
                    <p style={{ fontSize:"1.5rem", marginBottom:"0.5rem" }}>📋</p>
                    <p style={{ fontStyle:"italic" }}>No registered records for {selMonthLabel}.</p>
                    <p style={{ fontSize:"0.73rem", marginTop:"6px", color:"rgba(26,26,26,0.25)" }}>Try selecting a different month or use the All Records view below.</p>
                  </div>
                : <>
                  <p style={{ fontSize:"0.73rem", color:"rgba(26,26,26,0.45)", marginBottom:"0.75rem", fontStyle:"italic" }}>
                    Showing {registeredFiltered.length} record{registeredFiltered.length!==1?"s":""} — {selMonthLabel}
                  </p>
                  <table style={{ width:"100%", borderCollapse:"collapse", fontSize:"0.82rem" }}>
                    <thead>
                      <tr style={{ background:"#155c31" }}>
                        {["Matai Title","Holder","Type","Village","District","Proclaimed","Registered"].map(h => (
                          <th key={h} style={{ padding:"0.5rem 0.75rem", color:"#fff", fontFamily:"'Cinzel',serif", fontSize:"0.6rem", letterSpacing:"0.08em", textTransform:"uppercase", textAlign:"left", whiteSpace:"nowrap" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {registeredFiltered.map((r,i) => (
                        <tr key={r.id} style={{ background:i%2===0?"#fff":"#f5faf7" }}>
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
                </>
              }

              {/* ── All Records section below ── */}
              {!loading && registeredAll.length > 0 && (
                <div style={{ marginTop:"1.5rem", paddingTop:"1.5rem", borderTop:"2px solid rgba(21,92,49,0.1)" }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"0.75rem" }}>
                    <p style={{ fontFamily:"'Cinzel',serif", fontSize:"0.65rem", letterSpacing:"0.15em", color:"#155c31", textTransform:"uppercase" }}>
                      ◈ All Registered Records — {registeredAll.length}
                    </p>
                    {perms.canPrint && <button onClick={printRegisteredAll}
                      style={{ fontSize:"0.68rem", padding:"0.35rem 0.9rem", fontFamily:"'Cinzel',serif", letterSpacing:"0.08em", textTransform:"uppercase", background:"#155c3115", border:"1px solid #155c31", color:"#155c31", borderRadius:"3px", cursor:"pointer" }}>
                      📄 Generate All Records Report
                    </button>}
                  </div>
                  <table style={{ width:"100%", borderCollapse:"collapse", fontSize:"0.82rem" }}>
                    <thead>
                      <tr style={{ background:"#2d6a4f" }}>
                        {["Matai Title","Holder","Type","Village","District","Proclaimed","Registered"].map(h => (
                          <th key={h} style={{ padding:"0.5rem 0.75rem", color:"#fff", fontFamily:"'Cinzel',serif", fontSize:"0.6rem", letterSpacing:"0.08em", textTransform:"uppercase", textAlign:"left", whiteSpace:"nowrap" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {registeredAll.map((r,i) => (
                        <tr key={r.id} style={{ background:i%2===0?"#fff":"#f5faf7" }}>
                          <td style={{ padding:"0.45rem 0.75rem", fontFamily:"'Cinzel',serif", fontWeight:700, color:"#2d6a4f" }}>{r.mataiTitle}</td>
                          <td style={{ padding:"0.45rem 0.75rem" }}>{r.holderName}</td>
                          <td style={{ padding:"0.45rem 0.75rem" }}>{r.mataiType||"—"}</td>
                          <td style={{ padding:"0.45rem 0.75rem" }}>{r.village||"—"}</td>
                          <td style={{ padding:"0.45rem 0.75rem", fontSize:"0.78rem" }}>{r.district||"—"}</td>
                          <td style={{ padding:"0.45rem 0.75rem", fontSize:"0.78rem" }}>{fmtDate(r.dateProclamation)}</td>
                          <td style={{ padding:"0.45rem 0.75rem", color:"#2d6a4f", fontWeight:600 }}>{fmtDate(r.dateRegistration)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            <div style={{ ...sStyle, position:"sticky", top:"2rem" }}>
              <p style={{ fontFamily:"'Cinzel',serif", fontSize:"0.65rem", letterSpacing:"0.15em", color:"#155c31", textTransform:"uppercase", marginBottom:"0.75rem" }}>◈ Registration Summary</p>
              <SummaryRow label="Total Registered"      count={registeredAll.length}      color="#155c31" />
              <SummaryRow label={`${selMonthLabel}`}    count={registeredFiltered.length}  color="#155c31" />
            </div>
          </div>
        )}

        {/* ══ FILTERED REPORTS ══ */}
        {activeTab === "other" && (
          <div style={{ display:"grid", gridTemplateColumns:"1fr 280px", gap:"1.5rem", alignItems:"start" }}>
            <div>
              <div style={{ ...sStyle }}>
                <p style={{ fontFamily:"'Cinzel',serif", fontSize:"0.65rem", letterSpacing:"0.15em", color:"#1e6b3c", textTransform:"uppercase", marginBottom:"1.25rem" }}>◈ Filter Reports</p>
                <div style={{ display:"grid", gridTemplateColumns:"1.2fr 1fr 1fr", gap:"1rem", marginBottom:"0.75rem" }}>
                  <div>
                    <label style={labelStyle}>Report Type</label>
                    <select value={filterType} onChange={e => setFilterType(e.target.value)}
                      style={{ ...inputStyle, width:"100%", appearance:"none", backgroundImage:"url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%231a5c35' fill='none' stroke-width='2'/%3E%3C/svg%3E\")", backgroundRepeat:"no-repeat", backgroundPosition:"right 8px center", paddingRight:"28px" }}>
                      <option value="all">All Types</option>
                      <option value="ready">Ready to Register</option>
                      <option value="new">New Matai Titles</option>
                      <option value="proclamation">Proclamation Report</option>
                      <option value="objections">Objections Report</option>
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
                </div>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                  <p style={{ fontSize:"0.68rem", color:"rgba(30,107,60,0.5)", fontStyle:"italic" }}>
                    {filterType === "ready" || filterType === "proclamation" ? "📅 Filtering by proclamation date" :
                     filterType === "new" ? "📅 Filtering by date conferred" :
                     filterType === "objections" ? "📅 Filtering by objection date" :
                     "📅 Date filter applies across proclamation, conferred & objection dates"}
                  </p>
                  <div style={{ display:"flex", gap:"0.5rem" }}>
                    <button onClick={() => { setFilterFrom(""); setFilterTo(""); setFilterType("all"); }}
                      style={{ fontSize:"0.68rem", padding:"0.4rem 0.9rem", fontFamily:"'Cinzel',serif", letterSpacing:"0.06em", textTransform:"uppercase", background:"transparent", border:"1px solid rgba(30,107,60,0.3)", color:"#1e6b3c", borderRadius:"3px", cursor:"pointer" }}>
                      Clear
                    </button>
                    {perms.canPrint && <button onClick={printFiltered} disabled={filteredTotal===0}
                      style={{ fontSize:"0.68rem", padding:"0.4rem 1rem", fontFamily:"'Cinzel',serif", letterSpacing:"0.06em", textTransform:"uppercase", background:filteredTotal===0?"#f3f4f6":"#1a5c3515", border:`1px solid ${filteredTotal===0?"#e5e7eb":"#1a5c35"}`, color:filteredTotal===0?"#9ca3af":"#1a5c35", borderRadius:"3px", cursor:filteredTotal===0?"not-allowed":"pointer", whiteSpace:"nowrap" }}>
                      📄 Open Report ({filteredTotal})
                    </button>}
                  </div>
                </div>
              </div>

              <div style={sStyle}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"0.75rem" }}>
                  <p style={{ fontFamily:"'Cinzel',serif", fontSize:"0.65rem", letterSpacing:"0.15em", color:"#1e6b3c", textTransform:"uppercase" }}>◈ Results — {previewRows.length} Record{previewRows.length!==1?"s":""}</p>
                  <span style={{ fontSize:"0.72rem", color:"rgba(26,26,26,0.45)", fontStyle:"italic" }}>{dateRangeLabel}</span>
                </div>
                {loading ? <p style={{ fontStyle:"italic", color:"#9ca3af" }}>Loading…</p>
                : previewRows.length === 0
                  ? <div style={{ textAlign:"center", padding:"3rem", color:"rgba(26,26,26,0.35)" }}>
                      <p style={{ fontSize:"1.5rem", marginBottom:"0.5rem" }}>🔍</p>
                      <p style={{ fontStyle:"italic" }}>No records match the selected filter.</p>
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
                          <tr key={r.id+r._type} style={{ background:i%2===0?"#fff":"#f5faf7" }}>
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

            <div style={{ ...sStyle, position:"sticky", top:"2rem" }}>
              <p style={{ fontFamily:"'Cinzel',serif", fontSize:"0.65rem", letterSpacing:"0.15em", color:"#1e6b3c", textTransform:"uppercase", marginBottom:"0.75rem" }}>◈ Filter Summary</p>
              <div style={{ marginBottom:"0.75rem" }}>
                <p style={{ fontSize:"0.72rem", color:"rgba(26,26,26,0.45)", marginBottom:"2px" }}>Period</p>
                <p style={{ fontSize:"0.78rem", color:"#1a5c35", fontWeight:600 }}>{dateRangeLabel}</p>
              </div>
              <SummaryRow label="Ready to Register" count={fReady.length} color="#1e6b3c" />
              <SummaryRow label="New Matai Titles"  count={fNew.length}   color="#7c3aed" />
              <SummaryRow label="Proclamation"      count={fProc.length}  color="#1a5c35" />
              <SummaryRow label="Objections"        count={fObj.length}   color="#8b1a1a" />
              <div style={{ marginTop:"0.75rem", paddingTop:"0.75rem", borderTop:"2px solid rgba(30,107,60,0.15)", display:"flex", justifyContent:"space-between" }}>
                <span style={{ fontSize:"0.78rem", fontFamily:"'Cinzel',serif", color:"#1a5c35", textTransform:"uppercase", letterSpacing:"0.06em" }}>Total</span>
                <span style={{ fontFamily:"'Cinzel Decorative',serif", fontSize:"1.2rem", color:"#1a5c35", fontWeight:700 }}>{filteredTotal}</span>
              </div>
            </div>
          </div>
        )}

        {/* ══ SAVALI REPORT ══ */}
        {activeTab === "savali" && (() => {
          const { upolu: svUpolu, savaii: svSavaii } = savaliGrouped(savaliRecords);
          const TH = { padding:"0.5rem 0.8rem", textAlign:"center", fontFamily:"'Cinzel',serif", fontSize:"0.6rem", letterSpacing:"0.08em", textTransform:"uppercase", background:"#1a5c35", color:"#fff" };
          const TD = (i) => ({ padding:"0.45rem 0.8rem", textAlign:"center", fontSize:"0.82rem", borderBottom:"1px solid #e5e7eb", background:i%2===0?"#fff":"#f5faf7" });
          const SvTable = ({ rows, offset=0 }) => {
            const allSel = rows.length>0 && rows.every(r=>savaliSelected.has(r.id));
            return (
              <div style={{overflowX:"auto",marginBottom:"1.25rem"}}>
                <table style={{width:"100%",borderCollapse:"collapse"}}>
                  <thead>
                    <tr>
                      <th style={{...TH,width:"38px"}}><input type="checkbox" checked={allSel} onChange={()=>{const s=new Set(savaliSelected);rows.forEach(r=>allSel?s.delete(r.id):s.add(r.id));setSavaliSelected(s);}}/></th>
                      {["NUU","SUAFA MATAI","IGOA TAULEALEA","FAAPOGAI",""].map(h=><th key={h} style={TH}>{h}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r,i)=>(
                      <tr key={r.id}>
                        <td style={{...TD(i+offset),borderBottom:"1px solid #e5e7eb"}}><input type="checkbox" checked={savaliSelected.has(r.id)} onChange={()=>savaliToggleOne(r.id)}/></td>
                        <td style={TD(i+offset)}>{r.village||<span style={{color:"#bbb"}}>—</span>}</td>
                        <td style={{...TD(i+offset),textTransform:"uppercase",fontFamily:"'Cinzel',serif",fontSize:"0.72rem",color:"#1a5c35",fontWeight:600}}>{r.mataiTitle||<span style={{color:"#bbb"}}>—</span>}</td>
                        <td style={TD(i+offset)}>{r.holderName||<span style={{color:"#bbb"}}>—</span>}</td>
                        <td style={TD(i+offset)}>{r.faapogai||<span style={{color:"#bbb"}}>—</span>}</td>
                        <td style={{...TD(i+offset),width:"50px"}}>
                          <button onClick={()=>savaliOpenEdit(r)} style={{background:"none",border:"1px solid #d1d5db",borderRadius:"3px",padding:"2px 7px",cursor:"pointer",fontSize:"0.75rem",color:"#555"}}>✏️</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          };
          return (
            <div style={{display:"grid",gridTemplateColumns:"1fr 260px",gap:"1.5rem",alignItems:"start"}}>
              <div>
                {/* Controls bar */}
                <div style={{...sStyle,display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:"0.75rem",marginBottom:"1rem"}}>
                  <div>
                    <p style={{fontFamily:"'Cinzel',serif",fontSize:"0.65rem",letterSpacing:"0.15em",color:"#b45309",textTransform:"uppercase",marginBottom:"2px"}}>◈ Savali Report</p>
                    <p style={{fontSize:"0.73rem",color:"rgba(26,26,26,0.45)"}}>Records pending proclamation date. Select records then set date to publish.</p>
                  </div>
                  <div style={{display:"flex",gap:"0.5rem",flexWrap:"wrap",alignItems:"center"}}>
                    {perms.canEdit && <button onClick={()=>setSavaliShowConfirm(true)} disabled={savaliSelected.size===0}
                      style={{padding:"0.45rem 1rem",fontFamily:"'Cinzel',serif",fontSize:"0.62rem",letterSpacing:"0.08em",textTransform:"uppercase",borderRadius:"3px",border:"1px solid #b45309",background:savaliSelected.size===0?"transparent":"#b4530912",color:savaliSelected.size===0?"#bbb":"#b45309",cursor:savaliSelected.size===0?"not-allowed":"pointer"}}>
                      📅 Set Date ({savaliSelected.size})
                    </button>}
                  </div>
                </div>

                {/* ── PDF by Month ── */}
                {perms.canPrint && (() => {
                  const {upolu, savaii} = savaliGrouped(savaliByProcDate);
                  const total = upolu.length + savaii.length;
                  // Build list of unique proclamation months from all records
                  const months = [...new Set(
                    records.filter(r => r.dateProclamation && r.objection !== "yes")
                      .map(r => r.dateProclamation.trim().substring(0,7))
                  )].sort().reverse();
                  return (
                    <div style={{...sStyle, marginBottom:"1rem"}}>
                      <p style={{fontFamily:"'Cinzel',serif",fontSize:"0.65rem",letterSpacing:"0.15em",color:"#1a5c35",textTransform:"uppercase",marginBottom:"0.75rem"}}>◈ Generate Savali PDF by Proclamation Month</p>
                      <div style={{display:"flex",gap:"0.75rem",alignItems:"center",flexWrap:"wrap"}}>
                        <div>
                          <label style={{...labelStyle,marginBottom:"4px"}}>Select Month</label>
                          <select value={pdfMonth} onChange={e=>setPdfMonth(e.target.value)}
                            style={{...inputStyle, minWidth:"160px"}}>
                            {months.length === 0
                              ? <option value="">No proclaimed records</option>
                              : months.map(m => {
                                  const [y,mo] = m.split("-");
                                  const label = new Date(parseInt(y), parseInt(mo)-1, 1).toLocaleString("en",{month:"long",year:"numeric"});
                                  const cnt = records.filter(r=>r.dateProclamation&&r.dateProclamation.startsWith(m)&&r.objection!=="yes").length;
                                  return <option key={m} value={m}>{label} ({cnt} records)</option>;
                                })
                            }
                          </select>
                        </div>
                        <div style={{display:"flex",gap:"0.5rem",alignItems:"flex-end",paddingBottom:"0"}}>
                          {upolu.length > 0
                            ? <button onClick={savaliPrintUpolu}
                                style={{padding:"0.45rem 1rem",fontFamily:"'Cinzel',serif",fontSize:"0.62rem",letterSpacing:"0.08em",textTransform:"uppercase",borderRadius:"3px",border:"1px solid #1a5c35",background:"#1a5c3512",color:"#1a5c35",cursor:"pointer"}}>
                                📄 PDF Upolu ({upolu.length})
                              </button>
                            : <button disabled style={{padding:"0.45rem 1rem",fontFamily:"'Cinzel',serif",fontSize:"0.62rem",letterSpacing:"0.08em",textTransform:"uppercase",borderRadius:"3px",border:"1px solid #d1d5db",background:"transparent",color:"#bbb",cursor:"not-allowed"}}>
                                📄 PDF Upolu (0)
                              </button>
                          }
                          {savaii.length > 0
                            ? <button onClick={savaliPrintSavaii}
                                style={{padding:"0.45rem 1rem",fontFamily:"'Cinzel',serif",fontSize:"0.62rem",letterSpacing:"0.08em",textTransform:"uppercase",borderRadius:"3px",border:"1px solid #b45309",background:"#b4530912",color:"#b45309",cursor:"pointer"}}>
                                📄 PDF Savaii ({savaii.length})
                              </button>
                            : <button disabled style={{padding:"0.45rem 1rem",fontFamily:"'Cinzel',serif",fontSize:"0.62rem",letterSpacing:"0.08em",textTransform:"uppercase",borderRadius:"3px",border:"1px solid #d1d5db",background:"transparent",color:"#bbb",cursor:"not-allowed"}}>
                                📄 PDF Savaii (0)
                              </button>
                          }
                        </div>
                        {total === 0 && pdfMonth && <p style={{fontSize:"0.75rem",color:"#9ca3af",fontStyle:"italic"}}>No records with proclamation date in this month.</p>}
                      </div>
                    </div>
                  );
                })()}

                {loading ? <p style={{fontStyle:"italic",color:"#9ca3af",padding:"2rem",textAlign:"center"}}>Loading…</p>
                : savaliRecords.length===0
                ? <div style={{textAlign:"center",padding:"3rem",color:"rgba(26,26,26,0.35)"}}>
                    <p style={{fontSize:"2rem",marginBottom:"0.5rem"}}>✅</p>
                    <p style={{fontStyle:"italic"}}>All records have proclamation dates set.</p>
                  </div>
                : <>
                    {svUpolu.length>0 && <>
                      <p style={{fontFamily:"'Cinzel',serif",fontSize:"0.75rem",letterSpacing:"0.18em",color:"#1a5c35",textAlign:"center",margin:"0.5rem 0 0.6rem",textTransform:"uppercase"}}>— UPOLU —</p>
                      <SvTable rows={svUpolu} offset={0}/>
                    </>}
                    {svSavaii.length>0 && <>
                      <p style={{fontFamily:"'Cinzel',serif",fontSize:"0.75rem",letterSpacing:"0.18em",color:"#1a5c35",textAlign:"center",margin:"1rem 0 0.6rem",textTransform:"uppercase"}}>— SAVAII —</p>
                      <SvTable rows={svSavaii} offset={svUpolu.length}/>
                    </>}
                  </>}
              </div>

              {/* Sidebar summary */}
              <div style={{...sStyle,position:"sticky",top:"2rem"}}>
                <p style={{fontFamily:"'Cinzel',serif",fontSize:"0.65rem",letterSpacing:"0.15em",color:"#b45309",textTransform:"uppercase",marginBottom:"1rem"}}>◈ Savali Summary</p>
                <div style={{marginBottom:"1rem"}}>
                  <p style={{fontSize:"0.65rem",fontFamily:"'Cinzel',serif",letterSpacing:"0.08em",color:"rgba(26,26,26,0.45)",textTransform:"uppercase",marginBottom:"3px"}}>Proclamation Date</p>
                  <input type="date" value={savaliProcDate} onChange={e=>setSavaliProcDate(e.target.value)}
                    style={{width:"100%",padding:"0.4rem 0.65rem",border:"1px solid rgba(180,83,9,0.4)",borderRadius:"3px",fontSize:"0.78rem",color:"#b45309",fontFamily:"'Cinzel',serif",background:"#fff",boxSizing:"border-box"}}/>
                  <p style={{fontSize:"0.68rem",color:"rgba(26,26,26,0.4)",marginTop:"4px",fontStyle:"italic"}}>
                    Range: {fmtDate(savaliProcDate)} – {fmtDate(savaliEndDate)}
                  </p>
                </div>
                <div style={{borderTop:"1px solid rgba(180,83,9,0.15)",paddingTop:"0.75rem"}}>
                  <SummaryRow label="Pending Records" count={savaliRecords.length} color="#b45309"/>
                  <SummaryRow label="Upolu"           count={svUpolu.length}       color="#1a5c35"/>
                  <SummaryRow label="Savaii"          count={svSavaii.length}      color="#1a5c35"/>
                  <SummaryRow label="Selected"        count={savaliSelected.size}  color="#b45309"/>
                </div>
                <button onClick={savaliToggleAll} style={{marginTop:"0.75rem",width:"100%",padding:"0.4rem",fontFamily:"'Cinzel',serif",fontSize:"0.6rem",letterSpacing:"0.08em",textTransform:"uppercase",border:"1px solid rgba(180,83,9,0.3)",borderRadius:"3px",background:"transparent",color:"#b45309",cursor:"pointer"}}>
                  {savaliSelected.size===savaliRecords.length?"Deselect All":"Select All"}
                </button>
              </div>

              {/* Set Date modal */}
              {savaliShowConfirm && (
                <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.45)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center"}}>
                  <div style={{background:"#fff",borderRadius:"8px",padding:"2rem",maxWidth:"400px",width:"90%",boxShadow:"0 8px 32px rgba(0,0,0,0.2)"}}>
                    <p style={{fontFamily:"'Cinzel',serif",fontSize:"0.8rem",letterSpacing:"0.1em",color:"#1a5c35",marginBottom:"0.75rem",textTransform:"uppercase"}}>Set Proclamation Date</p>
                    <p style={{fontSize:"0.88rem",color:"#374151",marginBottom:"1rem"}}>Setting date for <strong>{savaliSelected.size}</strong> record{savaliSelected.size!==1?"s":""}.</p>
                    <input type="date" value={savaliProcDate} onChange={e=>setSavaliProcDate(e.target.value)}
                      style={{width:"100%",padding:"0.5rem",border:"1px solid #d1d5db",borderRadius:"4px",fontSize:"0.9rem",marginBottom:"0.5rem",boxSizing:"border-box"}}/>
                    <p style={{fontSize:"0.75rem",color:"#6b7280",marginBottom:"1.25rem"}}>Range: {fmtDate(savaliProcDate)} – {fmtDate(savaliEndDate)}</p>
                    <div style={{display:"flex",gap:"0.75rem",justifyContent:"flex-end"}}>
                      <button onClick={()=>setSavaliShowConfirm(false)} disabled={savaliSaving} style={{padding:"0.5rem 1rem",borderRadius:"4px",border:"1px solid #d1d5db",background:"#fff",cursor:"pointer",fontFamily:"'Cinzel',serif",fontSize:"0.65rem",letterSpacing:"0.08em",textTransform:"uppercase"}}>Cancel</button>
                      <button onClick={savaliSetDates} disabled={savaliSaving||!savaliProcDate} style={{padding:"0.5rem 1rem",borderRadius:"4px",border:"none",background:"#1a5c35",color:"#fff",cursor:"pointer",fontFamily:"'Cinzel',serif",fontSize:"0.65rem",letterSpacing:"0.08em",textTransform:"uppercase"}}>
                        {savaliSaving?"Saving…":`Confirm — ${savaliSelected.size}`}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Edit modal */}
              {savaliEditRecord && (
                <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.45)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center"}}>
                  <div style={{background:"#fff",borderRadius:"8px",padding:"2rem",maxWidth:"460px",width:"90%",boxShadow:"0 8px 32px rgba(0,0,0,0.2)"}}>
                    <p style={{fontFamily:"'Cinzel',serif",fontSize:"0.8rem",letterSpacing:"0.1em",color:"#1a5c35",marginBottom:"1.25rem",textTransform:"uppercase"}}>Edit Record</p>
                    {[{key:"village",label:"NUU (Village)"},{key:"mataiTitle",label:"Suafa Matai (Matai Title)"},{key:"holderName",label:"Igoa Taulealea (Untitled Name)"},{key:"faapogai",label:"Faapogai"}].map(({key,label})=>(
                      <div key={key} style={{marginBottom:"0.85rem"}}>
                        <label style={{display:"block",fontFamily:"'Cinzel',serif",fontSize:"0.6rem",letterSpacing:"0.1em",textTransform:"uppercase",color:"rgba(26,26,26,0.5)",marginBottom:"4px"}}>{label}</label>
                        <input value={savaliEditForm[key]||""} onChange={e=>setSavaliEditForm(f=>({...f,[key]:e.target.value}))}
                          style={{width:"100%",padding:"0.45rem 0.6rem",border:"1px solid #d1d5db",borderRadius:"4px",fontSize:"0.88rem",boxSizing:"border-box"}}/>
                      </div>
                    ))}
                    <div style={{display:"flex",gap:"0.75rem",justifyContent:"flex-end",marginTop:"1.25rem"}}>
                      <button onClick={()=>setSavaliEditRecord(null)} disabled={savaliSaving} style={{padding:"0.5rem 1rem",borderRadius:"4px",border:"1px solid #d1d5db",background:"#fff",cursor:"pointer",fontFamily:"'Cinzel',serif",fontSize:"0.65rem",letterSpacing:"0.08em",textTransform:"uppercase"}}>Cancel</button>
                      <button onClick={savaliSaveEdit} disabled={savaliSaving} style={{padding:"0.5rem 1rem",borderRadius:"4px",border:"none",background:"#1a5c35",color:"#fff",cursor:"pointer",fontFamily:"'Cinzel',serif",fontSize:"0.65rem",letterSpacing:"0.08em",textTransform:"uppercase"}}>
                        {savaliSaving?"Saving…":"Save Changes"}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })()}


      </div>
    </div>
  );
}

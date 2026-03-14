import { useState, useEffect, useRef } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { doc, getDoc, getDocs, collection, addDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../firebase";
import { getPermissions } from "../utils/roles";
import { logAudit } from "../utils/audit";
import { cacheGet, cacheSet } from "../utils/cache";
import Sidebar from "../components/Sidebar";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

// Official Samoa district number → name
const DISTRICT_BY_NUM = {
  1:"VAIMAUGA SASA'E",
  2:"VAIMAUGA SISIFO",
  3:"FALEATA SASA'E",
  4:"FALEATA SISIFO",
  5:"SAGAGA LE FALEFA",
  6:"SAGAGA LE USOGA",
  7:"AANA ALOFI Nu.1",
  8:"AANA ALOFI Nu.2",
  9:"AANA ALOFI Nu.03",
  10:"AIGA I LE TAI",
  11:"SAMATAU & FALELATAI",
  12:"LEFAGA & FALEASEELA",
  13:"SAFATA",
  14:"SIUMU",
  15:"FALEALILI",
  16:"LOTOFAGA",
  17:"LEPA",
  18:"ALEIPATA ITUPA I LUGA",
  19:"ALEIPATA ITUPA I LALO",
  20:"VAA O FONOTI",
  21:"ANOAMAA SASA'E",
  22:"ANOAMAA SISIFO",
  23:"FAASALELEAGA Nu 1",
  24:"FAASALELEAGA Nu 2",
  25:"FAASALELEAGA Nu 3",
  26:"FAASALELEAGA Nu. 04",
  27:"GAGAEMAUGA Nu.01",
  28:"GAGAEMAUGA Nu.02",
  29:"GAGAEMAUGA Nu.03",
  30:"GAGAIFOMAUGA Nu.1",
  31:"GAGAIFOMAUGA Nu.2",
  32:"GAGAIFOMAUGA Nu.03",
  33:"VAISIGANO Nu.1",
  34:"VAISIGANO Nu.02",
  35:"FALEALUPO",
  36:"ALATAUA SISIFO",
  37:"SALEGA",
  38:"PALAULI SISIFO",
  39:"SATUPAITEA",
  40:"PALAULI",
  41:"PALAULI LE FALEFA",
};

// Village → district name (204 villages from official list)
const VILLAGE_TO_DISTRICT = {
  "AFEGA":"SAGAGA LE USOGA",
  "ALAMAGOTO":"VAIMAUGA SISIFO",
  "AMAILE":"ALEIPATA ITUPA I LALO",
  "AOPO":"GAGAIFOMAUGA Nu.03",
  "APAI & SATUILAGI":"AIGA I LE TAI",
  "APIA":"VAIMAUGA SISIFO",
  "APOLIMA TAI":"AIGA I LE TAI",
  "APOLIMA UTA":"AIGA I LE TAI",
  "ASAGA":"FAASALELEAGA Nu. 04",
  "AUALA":"VAISIGANO Nu.1",
  "AUFAGA":"LEPA",
  "AVAO":"GAGAEMAUGA Nu.03",
  "AVATA":"FALEALUPO",
  "EVA":"ANOAMAA SISIFO",
  "EVEEVE & VAIMAGA":"FAASALELEAGA Nu 2",
  "FAALA":"PALAULI",
  "FAGAEE":"GAGAIFOMAUGA Nu.03",
  "FAGAFAU":"SALEGA",
  "FAGALII":"VAIMAUGA SASA'E",
  "FAGAMALO":"GAGAEMAUGA Nu.03",
  "FAGASA":"VAISIGANO Nu.02",
  "FAIAAI":"SALEGA",
  "FALANAI":"FAASALELEAGA Nu. 04",
  "FALEAPUNA":"VAA O FONOTI",
  "FALEASEELA":"LEFAGA & FALEASEELA",
  "FALEASIU":"AANA ALOFI Nu.1",
  "FALEATIU":"AANA ALOFI Nu.03",
  "FALEFA":"ANOAMAA SASA'E",
  "FALELIMA":"ALATAUA SISIFO",
  "FALETAGALOA":"GAGAIFOMAUGA Nu.2",
  "FALEU TAI":"AIGA I LE TAI",
  "FALEU UTA":"AIGA I LE TAI",
  "FALEULA":"SAGAGA LE FALEFA",
  "FALEVAI & SAMA'I":"SAMATAU & FALELATAI",
  "FALEVAO":"ANOAMAA SASA'E",
  "FASITOO-TAI":"AANA ALOFI Nu.03",
  "FASITOOUTA":"AANA ALOFI Nu.1",
  "FATAUSI":"FAASALELEAGA Nu 2",
  "FATUVALU":"GAGAIFOMAUGA Nu.2",
  "FAUSAGA":"SAFATA",
  "FOALALO":"PALAULI SISIFO",
  "FOALUGA":"PALAULI SISIFO",
  "FOGAPOA & TUASIVI":"FAASALELEAGA Nu 2",
  "FOGASAVAII":"SALEGA",
  "FOGATULI":"SALEGA",
  "FUAILOLOO":"AIGA I LE TAI",
  "FUSI":"SAFATA",
  "FUSI & FUIFATU":"FAASALELEAGA Nu 2",
  "GAGAIFOLEVAO":"LEFAGA & FALEASEELA",
  "GATAIVAI":"PALAULI LE FALEFA",
  "GAUTAVAI":"PALAULI LE FALEFA",
  "IVA":"FAASALELEAGA Nu 1",
  "LALOMALAVA":"FAASALELEAGA Nu 1",
  "LALOMANU":"ALEIPATA ITUPA I LUGA",
  "LALOMAUGA":"ANOAMAA SASA'E",
  "LALOVI MULIFANUA":"AIGA I LE TAI",
  "LANO":"FAASALELEAGA Nu. 04",
  "LAULII":"VAIMAUGA SASA'E",
  "LEAUVAA":"GAGAEMAUGA Nu.01",
  "LEFAGOALII":"GAGAIFOMAUGA Nu.2",
  "LELEPA":"GAGAEMAUGA Nu.03",
  "LEMALU":"GAGAEMAUGA Nu.01",
  "LEPA & VAIGALU":"LEPA",
  "LEPEA":"FALEATA SASA'E",
  "LEPUAI":"AIGA I LE TAI",
  "LETOGO":"VAIMAUGA SASA'E",
  "LETUI":"GAGAIFOMAUGA Nu.03",
  "LEULUMOEGA":"AANA ALOFI Nu.2",
  "LEUSOALII":"ANOAMAA SISIFO",
  "LEVI & ALAMUTU":"SAGAGA LE FALEFA",
  "LONA":"VAA O FONOTI",
  "LOTOFAGA":"SAFATA",
  "LOTOPUE":"ALEIPATA ITUPA I LALO",
  "LOTOSO'A":"SAGAGA LE FALEFA",
  "LUATUANUU":"ANOAMAA SISIFO",
  "LUFILUFI":"ANOAMAA SASA'E",
  "MAASINA":"VAA O FONOTI",
  "MAGIAGI":"VAIMAUGA SISIFO",
  "MALAE & SALIMU":"FAASALELEAGA Nu 3",
  "MALAELA & MUTIATELE":"ALEIPATA ITUPA I LALO",
  "MALAEMALU & TAFATAFA":"FALEALILI",
  "MALIE":"SAGAGA LE USOGA",
  "MANASE":"GAGAIFOMAUGA Nu.1",
  "MANINOA":"SIUMU",
  "MANUNU":"ANOAMAA SASA'E",
  "MATAFAA":"LEFAGA & FALEASEELA",
  "MATAFALA":"SIUMU",
  "MATAUTU":"LOTOFAGA",
  "MATAUTU & LEVI":"SAMATAU & FALELATAI",
  "MATAUTU FALEALILI":"FALEALILI",
  "MATAUTU LEFAGA":"LEFAGA & FALEASEELA",
  "MATAVAI":"GAGAIFOMAUGA Nu.2",
  "MATAVAI ASAU":"VAISIGANO Nu.1",
  "MAUGA":"GAGAEMAUGA Nu.01",
  "MOATAA":"VAIMAUGA SISIFO",
  "MOSULA":"SATUPAITEA",
  "MULIVAI":"SAFATA",
  "MUSUMUSU & SALIMU":"VAA O FONOTI",
  "NEIAFU":"ALATAUA SISIFO",
  "NIUSUATIA":"SAFATA",
  "NOAFOALII":"AANA ALOFI Nu.2",
  "PAIA":"GAGAIFOMAUGA Nu.2",
  "PAPA PULEIA":"PALAULI LE FALEFA",
  "PAPA SATAUA":"VAISIGANO Nu.02",
  "PATA":"SAMATAU & FALELATAI",
  "PATAMEA":"GAGAEMAUGA Nu.01",
  "PITONUU":"SATUPAITEA",
  "POUTASI":"FALEALILI",
  "PUAPUA":"FAASALELEAGA Nu. 04",
  "PULEIA":"PALAULI LE FALEFA",
  "SAAGA":"SIUMU",
  "SAANAPU":"SAFATA",
  "SAASAAI":"FAASALELEAGA Nu 3",
  "SAFAATOA":"LEFAGA & FALEASEELA",
  "SAFAI":"GAGAEMAUGA Nu.03",
  "SAFOTU":"GAGAIFOMAUGA Nu.1",
  "SAFUA":"FAASALELEAGA Nu 1",
  "SAGONE":"SALEGA",
  "SAINA":"FALEATA SISIFO",
  "SAIPIPI":"FAASALELEAGA Nu 3",
  "SALAILUA":"PALAULI SISIFO",
  "SALAMUMU":"GAGAEMAUGA Nu.02",
  "SALANI":"FALEALILI",
  "SALEAAUMUA":"ALEIPATA ITUPA I LALO",
  "SALEAPAGA & SIUPAPA":"LEPA",
  "SALEAULA":"GAGAEMAUGA Nu.02",
  "SALEIA":"GAGAEMAUGA Nu.03",
  "SALEILUA":"FALEALILI",
  "SALELAVALU":"FAASALELEAGA Nu 1",
  "SALELESI":"ANOAMAA SISIFO",
  "SALELOLOGA":"FAASALELEAGA Nu 1",
  "SALEPOUA'E & NONO'A":"SAGAGA LE FALEFA",
  "SALESATELE":"FALEALILI",
  "SALETELE":"ANOAMAA SASA'E",
  "SALUA & SATOI":"AIGA I LE TAI",
  "SAMALAEULU":"GAGAEMAUGA Nu.01",
  "SAMAMEA":"VAA O FONOTI",
  "SAMATA- UTA":"SALEGA",
  "SAMATA-TAI":"SALEGA",
  "SAMATAU":"SAMATAU & FALELATAI",
  "SAMAUGA":"GAGAIFOMAUGA Nu.2",
  "SAMUSU":"ALEIPATA ITUPA I LALO",
  "SAOLUAFATA":"ANOAMAA SISIFO",
  "SAPAPALII":"FAASALELEAGA Nu 2",
  "SAPINI & LUUA":"FAASALELEAGA Nu 3",
  "SAPOE / UTULAELAE":"FALEALILI",
  "SAPUNAOA":"FALEALILI",
  "SASINA":"GAGAIFOMAUGA Nu.03",
  "SATALO":"FALEALILI",
  "SATAOA":"SAFATA",
  "SATAPUALA":"AANA ALOFI Nu.03",
  "SATAUA":"VAISIGANO Nu.02",
  "SATITOA":"ALEIPATA ITUPA I LALO",
  "SATOALEAPAI":"GAGAEMAUGA Nu.03",
  "SATUFIA":"SATUPAITEA",
  "SATUIATUA":"PALAULI SISIFO",
  "SATUIMALUFILUFI":"AANA ALOFI Nu.03",
  "SAUANO":"ANOAMAA SASA'E",
  "SAVAIA & TAFAGAMANU":"LEFAGA & FALEASEELA",
  "SILI":"PALAULI LE FALEFA",
  "SIUFAGA":"FAASALELEAGA Nu 3",
  "SIUFAGA FALELATAI":"SAMATAU & FALELATAI",
  "SIUMU SASA'E":"SIUMU",
  "SIUNIU":"FALEALILI",
  "SIUTU":"PALAULI SISIFO",
  "SIUVAO":"SALEGA",
  "SOLOSOLO":"ANOAMAA SISIFO",
  "TAELEFAGA":"VAA O FONOTI",
  "TAFITOALA":"SAFATA",
  "TAFUA":"PALAULI LE FALEFA",
  "TAGA":"PALAULI SISIFO",
  "TANUGAMANONO":"VAIMAUGA SISIFO",
  "TAPUELEELE":"FAASALELEAGA Nu 2",
  "TIAVEA":"ALEIPATA ITUPA I LALO",
  "TOAMUA / PUIPAA":"FALEATA SISIFO",
  "TUANAI":"SAGAGA LE USOGA",
  "TUFUTAFOE":"ALATAUA SISIFO",
  "UAFATO":"VAA O FONOTI",
  "ULUTOGIA":"ALEIPATA ITUPA I LUGA",
  "UTUALII & TUFULELE":"SAGAGA LE FALEFA",
  "UTUFAALALAFA":"ALEIPATA ITUPA I LALO",
  "UTULOA ASAU":"VAISIGANO Nu.1",
  "VAEAGA":"SATUPAITEA",
  "VAIAFAI":"FAASALELEAGA Nu 1",
  "VAIALA":"VAIMAUGA SISIFO",
  "VAIEE":"SAFATA",
  "VAIGAGA":"FALEATA SISIFO",
  "VAILELE":"VAIMAUGA SASA'E",
  "VAILIMA":"VAIMAUGA SISIFO",
  "VAILOA":"PALAULI",
  "VAILOA ALEIPATA":"ALEIPATA ITUPA I LUGA",
  "VAILOA FALEATA":"FALEATA SASA'E",
  "VAILUUTAI":"AANA ALOFI Nu.03",
  "VAIMOSO":"FALEATA SASA'E",
  "VAIPOULI":"GAGAEMAUGA Nu.03",
  "VAIPUA":"SALEGA",
  "VAISALA":"VAISIGANO Nu.1",
  "VAISAULU":"FAASALELEAGA Nu 1",
  "VAITELE":"FALEATA SISIFO",
  "VAITOOMULI":"PALAULI",
  "VAIUSU":"FALEATA SISIFO",
  "VAOTUPUA":"FALEALUPO",
  "VAOVAI":"FALEALILI",
  "VAVAU":"LOTOFAGA",
};

// Resolve district from stored value, number, or village fallback
function resolveDistrict(district, village) {
  if (district) {
    const n = parseInt(district, 10);
    if (!isNaN(n) && DISTRICT_BY_NUM[n]) return DISTRICT_BY_NUM[n];
    return district;
  }
  if (village) {
    return VILLAGE_TO_DISTRICT[village.trim().toUpperCase()] || "";
  }
  return "";
}


export default function Certificate({ userRole }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [record, setRecord] = useState(null);
  const [allRecords, setAllRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [showResults, setShowResults] = useState(false);
  const [certLang, setCertLang] = useState("sm"); // "sm" = Samoan, "en" = English
  const [generating, setGenerating] = useState(false);
  const [printId, setPrintId] = useState(null); // stamped on certificate during PDF generation
  const searchRef = useRef(null);

  useEffect(() => {
    (async () => {
      try {
        const cached = cacheGet("registrations");
        let list;
        if (cached) {
          list = cached;
        } else {
          const snap = await getDocs(collection(db, "registrations"));
          list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
          list.sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
          cacheSet("registrations", list);
        }
        setAllRecords(list);
        if (id) {
          const snap = await getDoc(doc(db, "registrations", id));
          if (snap.exists()) setRecord({ id: snap.id, ...snap.data() });
          else setError("Record not found.");
        }
      } catch { setError("Failed to load record."); }
      finally { setLoading(false); }
    })();
  }, [id]);

  // Close search dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) setShowResults(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const currentIndex = allRecords.findIndex(r => r.id === id);
  const prevRecord = currentIndex > 0 ? allRecords[currentIndex - 1] : null;
  const nextRecord = currentIndex < allRecords.length - 1 ? allRecords[currentIndex + 1] : null;

  const handleSearch = (q) => {
    setSearchQuery(q);
    if (!q.trim()) { setSearchResults([]); setShowResults(false); return; }
    const lower = q.toLowerCase();
    const results = allRecords.filter(r =>
      r.mataiTitle?.toLowerCase().includes(lower) ||
      r.holderName?.toLowerCase().includes(lower) ||
      r.village?.toLowerCase().includes(lower) ||
      r.mataiCertNumber?.toLowerCase().includes(lower) ||
      r.certItumalo?.toString().includes(lower)
    ).slice(0, 8);
    setSearchResults(results);
    setShowResults(true);
  };

  const selectRecord = (r) => {
    setSearchQuery("");
    setShowResults(false);
    navigate(`/certificate/${r.id}`);
  };

  // Date helpers — parse YYYY-MM-DD safely without timezone shift
  const MONTHS_SA = ["Ianuari","Fepuari","Mati","Aperila","Me","Iuni","Iulai","Aokuso","Setema","Oketopa","Novema","Tesema"];
  const parseDateParts = (str) => {
    if (!str) return null;
    const parts = String(str).split("T")[0].split("-");
    if (parts.length === 3 && parts[0].length === 4) {
      return { y: parseInt(parts[0]), m: parseInt(parts[1]) - 1, d: parseInt(parts[2]) };
    }
    const dt = new Date(str);
    return isNaN(dt) ? null : { y: dt.getFullYear(), m: dt.getMonth(), d: dt.getDate() };
  };
  const getDay   = (str) => { const p = parseDateParts(str); return p ? String(p.d).padStart(2,"0") : ""; };
  const getMonth = (str) => { const p = parseDateParts(str); return p ? MONTHS_SA[p.m] : ""; };
  const getMonthEn = (str) => { const p = parseDateParts(str); return p ? ["January","February","March","April","May","June","July","August","September","October","November","December"][p.m] : ""; };
  const getYear  = (str) => { const p = parseDateParts(str); return p ? p.y : ""; };
  const formatDate = (str) => {
    const p = parseDateParts(str);
    if (!p) return str || "—";
    return `${String(p.d).padStart(2,"0")}-${String(p.m+1).padStart(2,"0")}-${p.y}`;
  };

  // Today's date — always used for issued date on certificate (reflects print date)
  const todayStr = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; })();

  const perms = getPermissions(userRole);

  const handlePrint = async () => {
    if (!record || generating) return;
    setGenerating(true);

    // 1. Generate unique Print ID  e.g. PRINT-20260311-A3F2
    const datePart = new Date().toISOString().slice(0,10).replace(/-/g,"");
    const randPart = Math.random().toString(36).toUpperCase().slice(2,6);
    const newPrintId = `PRINT-${datePart}-${randPart}`;
    setPrintId(newPrintId);

    // Let React re-render the print ID onto the certificate before capturing
    await new Promise(r => setTimeout(r, 120));

    try {
      // 2. Generate tamper-evident hash
      const now = new Date().toISOString();
      const certData = JSON.stringify({
        printId:     newPrintId,
        recordId:    id,
        mataiTitle:  record.mataiTitle,
        holderName:  record.holderName,
        village:     record.village,
        district:    record.district,
        dateConferred:       record.dateConferred,
        dateRegistration:    record.dateRegistration,
        dateSavaliPublished: record.dateSavaliPublished,
        certLaupepa: record.certLaupepa,
        certRegBook: record.certRegBook,
        generatedAt: now,
        generatedBy: auth.currentUser?.email,
      });
      const msgBuffer  = new TextEncoder().encode(certData);
      const hashBuffer = await window.crypto.subtle.digest("SHA-256", msgBuffer);
      const hashHex    = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2,"0")).join("");

      await addDoc(collection(db, "documentHashes"), {
        printId:      newPrintId,
        recordId:     id,
        mataiTitle:   record.mataiTitle,
        holderName:   record.holderName,
        village:      record.village,
        certNumber:   `${record.certItumalo || ""}/${record.certLaupepa || ""}/${record.certRegBook || ""}`,
        hash:         hashHex,
        generatedBy:  auth.currentUser?.email || "unknown",
        generatedAt:  serverTimestamp(),
        language:     certLang,
        userAgent:    navigator.userAgent,
      });

      // 3. Render certificate div to canvas
      const el = document.getElementById("certificate");
      const canvas = await html2canvas(el, {
        scale: 3,
        useCORS: true,
        backgroundColor: "#faf8f2",
        logging: false,
      });

      // 4. Create landscape A4 PDF
      const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const margin = 8;
      const availW = pageW - margin * 2;
      const availH = pageH - margin * 2;
      const imgW = canvas.width;
      const imgH = canvas.height;
      const ratio = Math.min(availW / imgW, availH / imgH);
      const finalW = imgW * ratio;
      const finalH = imgH * ratio;
      const x = margin + (availW - finalW) / 2;
      const y = margin + (availH - finalH) / 2;

      pdf.addImage(canvas.toDataURL("image/png"), "PNG", x, y, finalW, finalH);

      // 5. Open in new tab — user can print from there, file is not auto-saved
      const blobUrl = pdf.output("bloburl");
      window.open(blobUrl, "_blank");

      logAudit("PRINT", { printId: newPrintId, mataiTitle: record.mataiTitle, recordId: id, format: "pdf" });
    } catch (err) {
      console.error("PDF generation failed:", err);
      alert("PDF generation failed. Please try again.");
    } finally {
      setGenerating(false);
      setPrintId(null); // clear the stamp from the screen after capture
    }
  };

  // Helpers for JSX
  const GREEN     = "#1a5c35";
  const GREEN_MID = "rgba(26,92,53,0.4)";
  const GREEN_PALE= "rgba(26,92,53,0.15)";

  const uline = (minW = "120px", extra = {}) => ({
    borderBottom: `1px solid ${GREEN}`,
    minWidth: minW,
    display: "inline-block",
    textAlign: "center",
    fontWeight: "bold",
    paddingBottom: "1px",
    verticalAlign: "baseline",
    ...extra,
  });

  const sectionHead = (title) => <h3 className="section-head">◈ {title}</h3>;

  const readField = (label, value) => (
    <div className="form-group">
      <label>{label}</label>
      <div style={{
        padding: "0.55rem 0.75rem", background: "#f9fafb", border: "1px solid #e5e7eb",
        borderRadius: "4px", fontSize: "0.95rem", minHeight: "2.2rem",
        color: value && value !== "—" ? "#1a1a1a" : "#9ca3af",
        fontStyle: value && value !== "—" ? "normal" : "italic",
      }}>
        {value || "—"}
      </div>
    </div>
  );

  if (loading) return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:"100vh", color:"#1e6b3c", fontStyle:"italic" }}>Loading…</div>
  );

  // ── Void check: petition was upheld by court — registration is void ──
  if (record && record.status === "void") return (
    <div className="app-layout">
      <div className="pattern-bg" />
      <Sidebar userRole={userRole} userEmail={auth.currentUser?.email} />
      <div className="sidebar-content">
        <div style={{ maxWidth:"600px", margin:"6rem auto", textAlign:"center" }}>
          <div style={{ fontSize:"3rem", marginBottom:"1rem" }}>⛔</div>
          <h2 style={{ fontFamily:"'Cinzel',serif", fontSize:"1.3rem", color:"#8b1a1a", marginBottom:"0.75rem" }}>
            Registration Void
          </h2>
          <p style={{ color:"rgba(26,26,26,0.6)", fontSize:"0.95rem", marginBottom:"0.5rem" }}>
            <strong style={{ color:"#1a1a1a" }}>{record.mataiTitle} — {record.holderName}</strong>
          </p>
          <p style={{ color:"#8b1a1a", fontSize:"0.88rem", marginBottom:"2rem", lineHeight:"1.6" }}>
            The court upheld the petition against this title. The registration has been voided and a certificate cannot be issued.
          </p>
          <div style={{ display:"flex", gap:"1rem", justifyContent:"center" }}>
            <Link to="/dashboard">
              <button style={{ padding:"0.6rem 1.4rem", fontFamily:"'Cinzel',serif", fontSize:"0.72rem", letterSpacing:"0.1em", textTransform:"uppercase", background:"#fef2f2", border:"1px solid #fca5a5", color:"#8b1a1a", borderRadius:"3px", cursor:"pointer" }}>
                ← Back to Registry
              </button>
            </Link>
            <Link to={`/register/${record.id}`}>
              <button style={{ padding:"0.6rem 1.4rem", fontFamily:"'Cinzel',serif", fontSize:"0.72rem", letterSpacing:"0.1em", textTransform:"uppercase", background:"#1a5c35", border:"1px solid #1a5c35", color:"#fff", borderRadius:"3px", cursor:"pointer" }}>
                ✎ View Record
              </button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );

  // ── Block certificate if no registration date or date hasn't passed yet ──
  // Exception: incompleteConfirmed (old historical records) always allowed
  // Exception: objection="resolved" (dismissed) records allowed once reg date is set and passed
  const regDatePassed = record?.incompleteConfirmed
    || (record?.dateRegistration && new Date(record.dateRegistration + "T00:00:00") <= new Date());
  if (record && !regDatePassed) return (
    <div className="app-layout">
      <div className="pattern-bg" />
      <Sidebar userRole={userRole} userEmail={auth.currentUser?.email} />
      <div className="sidebar-content">
        <div style={{ maxWidth:"600px", margin:"6rem auto", textAlign:"center" }}>
          <div style={{ fontSize:"3rem", marginBottom:"1rem" }}>🏅</div>
          <h2 style={{ fontFamily:"'Cinzel',serif", fontSize:"1.3rem", color:"#1a5c35", marginBottom:"0.75rem" }}>
            Certificate Not Yet Available
          </h2>
          <p style={{ color:"rgba(26,26,26,0.6)", fontSize:"0.95rem", marginBottom:"0.5rem" }}>
            <strong style={{ color:"#1a1a1a" }}>{record.mataiTitle} — {record.holderName}</strong>
          </p>
          <p style={{ color:"rgba(26,26,26,0.55)", fontSize:"0.88rem", marginBottom:"2rem", lineHeight:"1.6" }}>
            {record.objection === "resolved" && !record.dateRegistration
              ? <>The objection was dismissed by court. Open the record and enter a registration date (at least 4 months from the Savali published date) to make the certificate available.</>
              : record.objection === "resolved" && record.dateRegistration
                ? <>The registration date for this title is <strong>{formatDate(record.dateRegistration)}</strong>. The certificate will be available once that date has passed.</>
                : record.dateRegistration
                  ? <>The registration date for this title is <strong>{formatDate(record.dateRegistration)}</strong>. The certificate will be available once that date has passed.</>
                  : <>This record does not have a registration date yet. Once the 4-month Savali publication period is complete, it will appear in <strong>Notifications → Ready to Register</strong> for staff to confirm.</>
            }
          </p>
          <div style={{ display:"flex", gap:"1rem", justifyContent:"center" }}>
            <Link to="/dashboard">
              <button style={{ padding:"0.6rem 1.4rem", fontFamily:"'Cinzel',serif", fontSize:"0.72rem", letterSpacing:"0.1em", textTransform:"uppercase", background:"#f0faf4", border:"1px solid #a7d7b8", color:"#1e6b3c", borderRadius:"3px", cursor:"pointer" }}>
                ← Back to Registry
              </button>
            </Link>
            <Link to={`/register/${record.id}`}>
              <button style={{ padding:"0.6rem 1.4rem", fontFamily:"'Cinzel',serif", fontSize:"0.72rem", letterSpacing:"0.1em", textTransform:"uppercase", background:"#1a5c35", border:"1px solid #1a5c35", color:"#fff", borderRadius:"3px", cursor:"pointer" }}>
                ✎ Edit Record
              </button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );

  const afiogaName = record ? [record.mataiTitle?.toUpperCase(), record.holderName].filter(Boolean).join("  ") : "";
  const district   = record ? resolveDistrict(record.district, record.village) : "";

  return (
    <div className="app-layout">
      <div className="pattern-bg" />
      <Sidebar userRole={userRole} userEmail={auth.currentUser?.email} />
      <div className="sidebar-content">

        {/* ── Dark toolbar: back / edit / prev-next ── */}
        <div className="no-print" style={{
          background:"#0f2e1a", borderBottom:"1px solid rgba(255,255,255,0.1)",
          padding:"0.85rem 2rem", display:"flex", justifyContent:"space-between", alignItems:"center",
          margin:"-2rem -2rem 2rem",
        }}>
          <div style={{ display:"flex", alignItems:"center", gap:"1rem" }}>
            <Link to="/dashboard" style={{ color:"rgba(255,255,255,0.6)", textDecoration:"none", fontFamily:"'Cinzel',serif", fontSize:"0.72rem", letterSpacing:"0.1em" }}>
              ← Registry
            </Link>
            {record && (
              <Link to={`/register/${record.id}`} style={{ color:"rgba(255,255,255,0.6)", textDecoration:"none", fontFamily:"'Cinzel',serif", fontSize:"0.72rem", letterSpacing:"0.1em" }}>
                ✎ Edit Record
              </Link>
            )}

          </div>

          <div style={{ display:"flex", alignItems:"center", gap:"0.75rem" }}>
            <button onClick={() => prevRecord && navigate(`/certificate/${prevRecord.id}`)}
              disabled={!prevRecord}
              style={{ background: prevRecord ? "rgba(255,255,255,0.1)" : "transparent", color: prevRecord ? "#fff" : "rgba(255,255,255,0.25)", border:"1px solid rgba(255,255,255,0.2)", padding:"0.45rem 0.9rem", fontFamily:"'Cinzel',serif", fontSize:"0.7rem", borderRadius:"2px", cursor: prevRecord ? "pointer" : "not-allowed" }}>
              ◀ Prev
            </button>
            <span style={{ color:"rgba(255,255,255,0.4)", fontFamily:"'Cinzel',serif", fontSize:"0.68rem" }}>
              {currentIndex >= 0 ? `${currentIndex + 1} / ${allRecords.length}` : ""}
            </span>
            <button onClick={() => nextRecord && navigate(`/certificate/${nextRecord.id}`)}
              disabled={!nextRecord}
              style={{ background: nextRecord ? "rgba(255,255,255,0.1)" : "transparent", color: nextRecord ? "#fff" : "rgba(255,255,255,0.25)", border:"1px solid rgba(255,255,255,0.2)", padding:"0.45rem 0.9rem", fontFamily:"'Cinzel',serif", fontSize:"0.7rem", borderRadius:"2px", cursor: nextRecord ? "pointer" : "not-allowed" }}>
              Next ▶
            </button>
          </div>

          <div style={{ width:"140px" }} />
        </div>

        {/* ── Page heading + search ── */}
        <div className="no-print" style={{ marginBottom:"2rem" }}>
          <p className="page-eyebrow">View Record</p>
          <h2 className="page-title" style={{ marginBottom:"1.25rem" }}>
            {record ? record.mataiTitle : "Search Registry"}
          </h2>

          <div style={{ position:"relative", maxWidth:"540px" }} ref={searchRef}>
            <span style={{ position:"absolute", left:"0.85rem", top:"50%", transform:"translateY(-50%)", fontSize:"1rem", pointerEvents:"none", color:"rgba(26,92,53,0.5)" }}>🔍</span>
            <input
              type="text"
              value={searchQuery}
              onChange={e => handleSearch(e.target.value)}
              onFocus={() => searchQuery && setShowResults(true)}
              placeholder="Search by title, name, village or cert number…"
              style={{ width:"100%", padding:"0.75rem 1rem 0.75rem 2.5rem", border:"2px solid rgba(26,92,53,0.3)", borderRadius:"6px", fontSize:"1rem", fontFamily:"'EB Garamond',serif", color:"#1a1a1a", background:"#fff", outline:"none", boxShadow:"0 2px 8px rgba(0,0,0,0.06)" }}
            />
            {showResults && searchResults.length > 0 && (
              <div style={{ position:"absolute", top:"calc(100% + 6px)", left:0, right:0, background:"#fff", border:"1px solid rgba(26,92,53,0.2)", borderRadius:"6px", boxShadow:"0 8px 24px rgba(0,0,0,0.12)", zIndex:50, overflow:"hidden" }}>
                {searchResults.map(r => (
                  <div key={r.id} onClick={() => selectRecord(r)}
                    style={{ padding:"0.75rem 1rem", cursor:"pointer", borderBottom:"1px solid #f3f4f6", display:"flex", justifyContent:"space-between", alignItems:"center" }}
                    onMouseEnter={e => e.currentTarget.style.background = "#f0faf4"}
                    onMouseLeave={e => e.currentTarget.style.background = "#fff"}>
                    <div>
                      <span style={{ fontFamily:"'Cinzel',serif", fontWeight:"700", color:"#1a5c35", fontSize:"0.95rem" }}>{r.mataiTitle}</span>
                      <span style={{ color:"#6b7280", fontSize:"0.85rem", marginLeft:"0.5rem" }}>{r.holderName}</span>
                    </div>
                    <span style={{ fontSize:"0.78rem", color:"#9ca3af" }}>{r.village}</span>
                  </div>
                ))}
              </div>
            )}
            {showResults && searchQuery && searchResults.length === 0 && (
              <div style={{ position:"absolute", top:"calc(100% + 6px)", left:0, right:0, background:"#fff", border:"1px solid rgba(26,92,53,0.2)", borderRadius:"6px", boxShadow:"0 8px 24px rgba(0,0,0,0.12)", zIndex:50, padding:"1rem", color:"#9ca3af", fontSize:"0.88rem", fontStyle:"italic", textAlign:"center" }}>
                No records found
              </div>
            )}
          </div>
        </div>

        {error && (
          <div style={{ background:"rgba(139,26,26,0.08)", border:"1px solid rgba(139,26,26,0.2)", borderRadius:"4px", padding:"1rem", color:"#8b1a1a", marginBottom:"2rem" }}>
            {error} &nbsp;—&nbsp; <Link to="/dashboard" style={{ color:"#8b1a1a" }}>← Return to Registry</Link>
          </div>
        )}

        {record && (<>

          {/* ── Record detail sections (read-only, matches Register layout) ── */}
          <div className="no-print" style={{ display:"flex", flexDirection:"column", gap:"1.5rem", marginBottom:"2.5rem" }}>

            <div className="card">
              {sectionHead("Title & Holder")}
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"1.2rem" }}>
                <div style={{ gridColumn:"1 / -1" }}>{readField("Matai Title (Suafa Matai)", record.mataiTitle)}</div>
                {readField("Untitled Name (Igoa Taulealea)", record.holderName)}
                {readField("Gender (Tane/Tamaitai)", record.gender)}
                {readField("Title Type (Ituaiga Suafa)", record.mataiType)}
              </div>
            </div>

            <div className="card">
              {sectionHead("Village & District (of New Title)")}
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"1.2rem" }}>
                {readField("District (Itūmālō)", record.district)}
                {readField("Village (Nu'u e Patino iai le Suafa Matai)", record.village)}
              </div>
            </div>

            <div className="card">
              {sectionHead("Other Matai Title (for Records)")}
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"1.2rem" }}>
                {readField("Other Matai Title (Isi Suafa Matai)", record.familyTitles)}
                {readField("Village of Other Title (Nu'u o loo Matai ai)", record.nuuMataiAi)}
              </div>
            </div>

            <div className="card">
              {sectionHead("Certificate Numbers")}
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:"1.2rem" }}>
                {readField("Numera o le Itumalo", record.certItumalo)}
                {readField("Numera ole Laupepa", record.certLaupepa)}
                {readField("Registry Book Number", record.certRegBook)}
              </div>
              {record.mataiCertNumber && (
                <div style={{ marginTop:"0.75rem", padding:"0.6rem 1rem", background:"#e8f5ed", borderRadius:"4px", border:"1px solid #c3e6cb" }}>
                  <p style={{ fontFamily:"'Cinzel',serif", fontSize:"0.72rem", color:"#155c31", letterSpacing:"0.1em" }}>
                    Certificate Number: <strong style={{ fontSize:"0.88rem" }}>{record.mataiCertNumber}</strong>
                  </p>
                </div>
              )}
            </div>

            <div className="card">
              {sectionHead("Important Dates")}
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"1.2rem" }}>
                {readField("Aso o le Saofai (Date of Conferral)", formatDate(record.dateConferred))}
                {readField("Aso o le Faasalalauga (Savali Published Date)", formatDate(record.dateSavaliPublished))}
                {readField("Aso na Resitala ai (Date of Registration)", formatDate(record.dateRegistration))}
                {readField("Date Issued (Aso Tuuina Mai)", formatDate(record.dateIssued))}
                {readField("Aso Fanau (Date of Birth)", formatDate(record.dateBirth))}
                {readField("Nuu na Fanau ai (Village of Birth)", record.nuuFanau)}
              </div>
            </div>

            <div className="card">
              {sectionHead("Faapogai & Notes")}
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"1.2rem" }}>
                {readField("Faapogai", record.faapogai)}
                {readField("Isi Faamatalaga (Notes)", record.notes)}
              </div>
            </div>

          </div>

          {/* ── Certificate section heading + Language toggle + Print button ── */}
          <div className="no-print" style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"1.25rem" }}>
            <div>
              <p style={{ fontFamily:"'Cinzel',serif", fontSize:"0.7rem", letterSpacing:"0.2em", color:"#1e6b3c", textTransform:"uppercase", marginBottom:"0.25rem" }}>Official Document</p>
              <h3 style={{ fontFamily:"'Cinzel Decorative',serif", fontSize:"1.3rem", color:"#1a1a1a" }}>Certificate of Registration</h3>
            </div>
            <div style={{ display:"flex", alignItems:"center", gap:"1rem" }}>
              {/* Language toggle */}
              <div style={{ display:"flex", border:"1px solid rgba(26,92,53,0.3)", borderRadius:"3px", overflow:"hidden" }}>
                <button onClick={() => setCertLang("sm")}
                  style={{ padding:"0.4rem 0.9rem", fontFamily:"'Cinzel',serif", fontSize:"0.65rem", letterSpacing:"0.1em", textTransform:"uppercase", cursor:"pointer", border:"none",
                    background: certLang === "sm" ? "linear-gradient(135deg,#14482a,#1e6b3c)" : "#fff",
                    color: certLang === "sm" ? "#fff" : "#1e6b3c" }}>
                  🇼🇸 Samoan
                </button>
                <button onClick={() => setCertLang("en")}
                  style={{ padding:"0.4rem 0.9rem", fontFamily:"'Cinzel',serif", fontSize:"0.65rem", letterSpacing:"0.1em", textTransform:"uppercase", cursor:"pointer", border:"none", borderLeft:"1px solid rgba(26,92,53,0.3)",
                    background: certLang === "en" ? "linear-gradient(135deg,#14482a,#1e6b3c)" : "#fff",
                    color: certLang === "en" ? "#fff" : "#1e6b3c" }}>
                  🇬🇧 English
                </button>
              </div>
              {perms.canPrint && (
                <button onClick={handlePrint} disabled={generating} style={{
                  background: generating ? "#6b7280" : "linear-gradient(135deg,#14482a,#1e6b3c,#2d9b57)",
                  color:"#fff", border:"none",
                  padding:"0.6rem 1.5rem", fontFamily:"'Cinzel',serif", fontSize:"0.75rem",
                  fontWeight:"700", letterSpacing:"0.12em", textTransform:"uppercase",
                  borderRadius:"2px", cursor: generating ? "not-allowed" : "pointer",
                  opacity: generating ? 0.8 : 1,
                }}>
                  {generating ? "⏳ Generating PDF…" : "⬇ Save as PDF"}
                </button>
              )}
            </div>
          </div>

          {/* ── Certificate document ── */}
          <div id="certificate-wrapper" style={{ display:"flex", justifyContent:"center", padding:"2rem 1rem 4rem", background:"#f0ede6" }}>
            <div id="certificate" style={{
              width:"1020px", background:"#faf8f2", color:"#1a1208",
              position:"relative", fontFamily:"'EB Garamond', Georgia, serif",
              boxShadow:"0 20px 80px rgba(0,0,0,0.25)", overflow:"hidden"
            }}>

              {/* Outer border — dark green */}
              <div style={{ position:"absolute", inset:"8px",  border:"3px solid #1a5c35", pointerEvents:"none", zIndex:1 }} />
              {/* Inner border — gold */}
              <div style={{ position:"absolute", inset:"14px", border:"1px solid #c9a84c", pointerEvents:"none", zIndex:1 }} />

              {/* Emblem watermark — centred behind all content */}
              <div style={{
                position:"absolute", inset:0, zIndex:2, pointerEvents:"none",
                display:"flex", alignItems:"center", justifyContent:"center"
              }}>
                <img src={"/emblem.png"} alt=""
                  style={{ width:"420px", height:"420px", objectFit:"contain", opacity:0.055 }} />
              </div>

              {/* ── HEADER ── */}
              <div style={{ position:"relative", zIndex:3, padding:"24px 70px 18px", display:"flex", alignItems:"center", gap:"28px", borderBottom:"2px solid #1a5c35" }}>
                <div style={{ flexShrink:0 }}>
                  <img src={"/emblem.png"} alt="Samoa Emblem"
                    style={{ width:"95px", height:"95px", objectFit:"contain" }} />
                </div>
                <div>
                  <p style={{ fontFamily:"'Cinzel',serif", fontSize:"10px", letterSpacing:"0.2em", color:"#1a5c35", textTransform:"uppercase", marginBottom:"3px" }}>
                    {certLang === "sm"
                      ? "Matagaluega o Faamasinoga ma le Faafoeina o Tulaga Tau Faamasinoga"
                      : "Ministry of Justice and Courts Administration"}
                  </p>
                  <p style={{ fontFamily:"'EB Garamond',serif", fontSize:"12px", color:"#5a3e00", fontStyle:"italic", marginBottom:"10px" }}>
                    {certLang === "sm"
                      ? "Ministry of Justice and Courts Administration"
                      : "Matagaluega o Faamasinoga ma le Faafoeina o Tulaga Tau Faamasinoga"}
                  </p>
                  <h1 style={{ fontFamily:"'Cinzel',serif", fontSize:"22px", fontWeight:"700", letterSpacing:"0.15em", color:"#1a5c35", textTransform:"uppercase" }}>
                    {certLang === "sm"
                      ? "Tusi Faamaonia o le Umia o le Suafa Matai"
                      : "Matai Title Certificate"}
                  </h1>
                </div>
              </div>

              {/* ── BODY ── */}
              <div style={{ position:"relative", zIndex:3, padding:"24px 90px 28px" }}>

                {/* Cert number — top right */}
                <div style={{ display:"flex", justifyContent:"flex-end", marginBottom:"20px" }}>
                  <span style={{ fontFamily:"'Cinzel',serif", fontSize:"12px", color:"#1a1208", letterSpacing:"0.05em" }}>
                    <span style={{ fontVariant:"small-caps" }}>{certLang === "sm" ? "Numera:" : "Number:"}</span>{" "}
                    <strong style={{ fontSize:"16px" }}>
                      {(record.certItumalo && record.certLaupepa && record.certRegBook)
                        ? `${record.certItumalo}/${record.certLaupepa}/${record.certRegBook}`
                        : record.mataiCertNumber || record.refNumber || "___/___/___"}
                    </strong>
                  </span>
                </div>

                {/* Title + Holder + Village header — same layout for both languages */}
                <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"center", gap:"20px", marginBottom:"6px" }}>
                  <div style={{ flex:1, textAlign:"center" }}>
                    <div style={{ fontSize:"26px", fontWeight:"600", letterSpacing:"0.03em" }}>
                      <span style={{ textTransform:"uppercase" }}>{record.mataiTitle || ""}</span>
                      &nbsp;&nbsp;&nbsp;
                      <span>{record.holderName || ""}</span>
                    </div>
                    <div style={{ borderBottom:"1px solid #1a5c35", width:"70%", margin:"6px auto 8px" }} />
                    <div style={{ fontSize:"20px", marginBottom:"4px" }}>{record.village || ""}</div>
                    <div style={{ borderBottom:"1px solid #1a5c35", width:"30%", margin:"0 auto 20px" }} />
                  </div>
                  {record.holderPhoto && (
                    <div style={{ flexShrink:0, marginTop:"4px" }}>
                      <img src={record.holderPhoto} alt="Holder"
                        style={{ width:"90px", height:"115px", objectFit:"cover", border:"1.5px solid #1a5c35", borderRadius:"2px" }} />
                    </div>
                  )}
                </div>

                {/* Divider */}
                <div style={{ borderTop:"1px solid rgba(26,92,53,0.2)", marginBottom:"18px" }} />

                {/* Body text */}
                <div style={{ fontSize:"17px", lineHeight:"2.6", color:"#1a1208", textAlign:"center" }}>

                  {certLang === "sm" ? (<>
                    {/* ── SAMOAN body ── */}
                    <div style={{ display:"flex", alignItems:"baseline", justifyContent:"center", flexWrap:"wrap", gap:"6px", marginBottom:"2px" }}>
                      <span>Ua tuuina atu lenei Tusi Faamaonia e faailoa atu ai le avea o Oe o le nofo aloa'ia o le suafa</span>
                      <span style={{ borderBottom:"1px solid #1a5c35", minWidth:"130px", fontWeight:"700", textAlign:"center", paddingBottom:"1px", display:"inline-block", textTransform:"uppercase" }}>
                        {record.mataiTitle || ""}
                      </span>
                    </div>
                    <div style={{ display:"flex", alignItems:"baseline", justifyContent:"center", flexWrap:"wrap", gap:"6px", marginBottom:"2px" }}>
                      <span>o le nu'u o</span>
                      <span style={{ borderBottom:"1px solid #1a5c35", minWidth:"110px", textAlign:"center", paddingBottom:"1px", display:"inline-block" }}>
                        {record.village || ""}
                      </span>
                      <span>i le Itumalo</span>
                      <span style={{ borderBottom:"1px solid #1a5c35", minWidth:"180px", fontWeight:"600", textAlign:"center", paddingBottom:"1px", display:"inline-block" }}>
                        {district || ""}
                      </span>
                      <span>ma na resitalaina i le</span>
                    </div>
                    <div style={{ display:"flex", alignItems:"baseline", justifyContent:"center", gap:"8px", marginBottom:"2px" }}>
                      <span>aso</span>
                      <span style={{ borderBottom:"1px solid #1a5c35", minWidth:"38px", textAlign:"center", paddingBottom:"1px", display:"inline-block" }}>{getDay(record.dateRegistration)}</span>
                      <span>o</span>
                      <span style={{ borderBottom:"1px solid #1a5c35", minWidth:"100px", textAlign:"center", paddingBottom:"1px", display:"inline-block" }}>{getMonth(record.dateRegistration)}</span>
                      <span style={{ borderBottom:"1px solid #1a5c35", minWidth:"58px", textAlign:"center", paddingBottom:"1px", display:"inline-block" }}>{getYear(record.dateRegistration)}</span>
                    </div>
                    <div style={{ display:"flex", alignItems:"baseline", justifyContent:"center", gap:"8px" }}>
                      <span>Tuuina atu i lenei aso</span>
                      <span style={{ borderBottom:"1px solid #1a5c35", minWidth:"38px", textAlign:"center", paddingBottom:"1px", display:"inline-block" }}>{getDay(todayStr)}</span>
                      <span>o</span>
                      <span style={{ borderBottom:"1px solid #1a5c35", minWidth:"100px", textAlign:"center", paddingBottom:"1px", display:"inline-block" }}>{getMonth(todayStr)}</span>
                      <span style={{ borderBottom:"1px solid #1a5c35", minWidth:"58px", textAlign:"center", paddingBottom:"1px", display:"inline-block" }}>{getYear(todayStr)}</span>
                    </div>
                  </>) : (<>
                    {/* ── ENGLISH body — matches Samoan inline-underline layout ── */}
                    {(() => {
                      const ordinal = (ds) => {
                        const d = parseInt(getDay(ds));
                        if (!d) return "";
                        const s = ["st","nd","rd"][((d+90)%100-10)%10-1]||"th";
                        return <>{d}<sup style={{fontSize:"10px"}}>{s}</sup></>;
                      };
                      const ul = (val, minW, bold) => (
                        <span style={{ borderBottom:"1px solid #1a5c35", minWidth:minW||"110px", textAlign:"center", paddingBottom:"1px", display:"inline-block", fontWeight:bold?"700":"inherit", textTransform:bold?"uppercase":"inherit" }}>{val}</span>
                      );
                      return (<>
                        {/* Line 1 */}
                        <div style={{ display:"flex", alignItems:"baseline", justifyContent:"center", flexWrap:"wrap", gap:"6px", marginBottom:"2px" }}>
                          <span>This Certificate is hereby issued and presented to confirm that you are the duly recognised holder of the title</span>
                          {ul(record.mataiTitle || "", "130px", true)}
                        </div>
                        {/* Line 2 */}
                        <div style={{ display:"flex", alignItems:"baseline", justifyContent:"center", flexWrap:"wrap", gap:"6px", marginBottom:"2px" }}>
                          <span>of the village of</span>
                          {ul(record.village || "", "110px", false)}
                          <span>, in the District of</span>
                          {ul(district || "", "180px", true)}
                          <span>, and was registered on the</span>
                        </div>
                        {/* Line 3 — registration date */}
                        <div style={{ display:"flex", alignItems:"baseline", justifyContent:"center", gap:"8px", marginBottom:"2px" }}>
                          {ul(ordinal(record.dateRegistration), "48px")}
                          <span>of</span>
                          {ul(getMonthEn(record.dateRegistration), "100px")}
                          {ul(getYear(record.dateRegistration), "58px")}
                        </div>
                        {/* Line 4 — issued date */}
                        <div style={{ display:"flex", alignItems:"baseline", justifyContent:"center", gap:"8px" }}>
                          <span>Issued on this day</span>
                          {ul(ordinal(todayStr), "48px")}
                          <span>of</span>
                          {ul(getMonthEn(todayStr), "100px")}
                          {ul(getYear(todayStr), "58px")}
                        </div>
                      </>);
                    })()}
                  </>)}

                </div>

                {/* Bottom divider */}
                <div style={{ borderTop:"1px solid rgba(26,92,53,0.2)", margin:"20px 0 14px" }} />

                {/* Signature + Print ID row */}
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-end" }}>

                  {/* Print ID stamp — bottom left, only visible when generating */}
                  <div style={{ fontSize:"9px", fontFamily:"monospace", color: printId ? "#888" : "transparent", letterSpacing:"0.05em", lineHeight:"1.6" }}>
                    <div>{printId || "PRINT-00000000-0000"}</div>
                    <div style={{ fontSize:"8px", color: printId ? "#aaa" : "transparent" }}>
                      {printId ? new Date().toLocaleString("en-WS") : ""}
                    </div>
                  </div>

                  {/* Signature — bottom right */}
                  <div style={{ textAlign:"center", minWidth:"260px" }}>
                    <div style={{ borderBottom:"1px solid #1a5c35", paddingBottom:"36px", marginBottom:"6px" }} />
                    {certLang === "sm" && (
                      <p style={{ fontFamily:"'Cinzel',serif", fontSize:"10px", letterSpacing:"0.14em", color:"#1a5c35", textTransform:"uppercase", marginBottom:"3px" }}>
                        Mo le Resitara
                      </p>
                    )}
                    {certLang === "en" && (<>
                      <p style={{ fontFamily:"'Cinzel',serif", fontSize:"9px", letterSpacing:"0.1em", color:"#1a5c35", textTransform:"uppercase", lineHeight:"1.7" }}>
                        Registrar / Chief Executive Officer
                      </p>
                      <p style={{ fontFamily:"'Cinzel',serif", fontSize:"8px", letterSpacing:"0.08em", color:"#666", textTransform:"uppercase" }}>
                        Ministry of Justice and Courts Administration
                      </p>
                    </>)}
                  </div>
                </div>

              </div>
            </div>
          </div>

        </>)}

      </div>{/* end sidebar-content */}

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700&family=Cinzel+Decorative:wght@400;700&family=EB+Garamond:ital,wght@0,400;0,600;1,400&display=swap');
        @media print {
          /* Hide all UI chrome */
          .no-print  { display: none !important; }
          .sidebar   { display: none !important; }
          .pattern-bg { display: none !important; }

          /* Hide dev banner (fixed position element from App.jsx) */
          body > div[style*="DEVELOPMENT"],
          body > div[style*="position:fixed"],
          body > div[style*="position: fixed"] { display: none !important; }

          /* Reset layout */
          html, body { margin: 0 !important; padding: 0 !important; background: white !important; }
          .app-layout { display: block !important; background: white !important; }
          .sidebar-content { margin-left: 0 !important; padding: 0 !important; background: white !important; }

          /* Certificate wrapper fills the page */
          #certificate-wrapper {
            padding: 0 !important;
            background: white !important;
            display: flex !important;
            justify-content: center !important;
            align-items: flex-start !important;
            page-break-inside: avoid !important;
          }

          /* Certificate fills landscape width exactly */
          #certificate {
            box-shadow: none !important;
            width: 277mm !important;
            max-width: 277mm !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }

          /* Ensure colours print */
          #certificate, #certificate * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color-adjust: exact !important;
          }

          @page {
            size: A4 landscape;
            margin: 10mm 10mm 10mm 10mm;
          }
        }
      `}</style>
    </div>
  );
}

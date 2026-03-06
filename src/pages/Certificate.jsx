import { useState, useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../firebase";
import { getPermissions } from "../utils/roles";
import { logAudit } from "../utils/audit";

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
  const [record, setRecord] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState("");

  useEffect(() => {
    (async () => {
      try {
        const snap = await getDoc(doc(db, "registrations", id));
        if (snap.exists()) setRecord({ id: snap.id, ...snap.data() });
        else setError("Record not found.");
      } catch { setError("Failed to load certificate."); }
      finally { setLoading(false); }
    })();
  }, [id]);

  const MONTHS_SA = ["Ianuari","Fepuari","Mati","Aperila","Me","Iuni","Iulai","Aokuso","Setema","Oketopa","Novema","Tesema"];
  // Parse YYYY-MM-DD safely without timezone shifting
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
  const getYear  = (str) => { const p = parseDateParts(str); return p ? p.y : ""; };
  const formatDate = (str) => {
    const p = parseDateParts(str);
    if (!p) return str || "—";
    return `${String(p.d).padStart(2,"0")}/${String(p.m+1).padStart(2,"0")}/${p.y}`;
  };

  const perms = getPermissions(userRole);
  const handlePrint = () => {
    logAudit("PRINT", { mataiTitle: record?.mataiTitle, recordId: id });
    window.print();
  };

  if (loading) return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:"100vh", color:"#1e6b3c", fontStyle:"italic" }}>Loading certificate…</div>
  );
  if (error) return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:"100vh", flexDirection:"column", gap:"1rem" }}>
      <p style={{ color:"#8b1a1a" }}>{error}</p>
      <Link to="/dashboard"><button className="btn-secondary">← Return to Registry</button></Link>
    </div>
  );

  const afiogaName = [record.mataiTitle, record.holderName].filter(Boolean).join("  ");

  // Resolve district — use stored value first, fall back to village lookup
  const district = resolveDistrict(record.district, record.village);

  const GREEN      = "#1a5c35";
  const GREEN_PALE = "rgba(26,92,53,0.15)";
  const GREEN_MID  = "rgba(26,92,53,0.4)";

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

  return (
    <>
      {/* ── Toolbar ── */}
      <div className="no-print" style={{
        background:"#0f2e1a", borderBottom:"1px solid rgba(255,255,255,0.1)",
        padding:"0.85rem 2rem", display:"flex", justifyContent:"space-between", alignItems:"center"
      }}>
        <div style={{ display:"flex", alignItems:"center", gap:"1rem" }}>
          <Link to="/dashboard" style={{ color:"rgba(255,255,255,0.6)", textDecoration:"none", fontFamily:"'Cinzel',serif", fontSize:"0.72rem", letterSpacing:"0.1em" }}>
            ← Registry
          </Link>
          <Link to={`/register/${id}`} style={{ color:"rgba(255,255,255,0.6)", textDecoration:"none", fontFamily:"'Cinzel',serif", fontSize:"0.72rem", letterSpacing:"0.1em" }}>
            ✎ Edit Record
          </Link>
        </div>
        {perms.canPrint && (
          <button onClick={handlePrint} style={{
            background:"linear-gradient(135deg,#14482a,#1e6b3c,#2d9b57)", color:"#fff", border:"none",
            padding:"0.6rem 1.5rem", fontFamily:"'Cinzel',serif", fontSize:"0.75rem",
            fontWeight:"700", letterSpacing:"0.12em", textTransform:"uppercase", borderRadius:"2px", cursor:"pointer"
          }}>
            🖨 Print / Save PDF
          </button>
        )}
      </div>

      {/* ── Certificate viewer ── */}
      <div id="certificate-wrapper" style={{ display:"flex", justifyContent:"center", padding:"2rem 1rem 4rem", background:"#f7f4ef" }}>
        <div id="certificate" style={{
          width:"794px", minHeight:"560px", background:"#fdf8f0", color:"#1a1208",
          position:"relative", fontFamily:"'EB Garamond', Georgia, serif",
          boxShadow:"0 20px 80px rgba(0,0,0,0.25)", overflow:"hidden"
        }}>

          {/* Double border */}
          <div style={{ position:"absolute", inset:"12px", border:`2px solid ${GREEN}`, pointerEvents:"none", zIndex:1 }} />
          <div style={{ position:"absolute", inset:"18px", border:`1px solid ${GREEN_MID}`, pointerEvents:"none", zIndex:1 }} />

          {/* Corner ornaments */}
          {[["top","left"],["top","right"],["bottom","left"],["bottom","right"]].map(([v,h]) => (
            <svg key={`${v}${h}`} width="60" height="60" viewBox="0 0 60 60" fill="none"
              style={{ position:"absolute", [v]:8, [h]:8,
                transform:`rotate(${v==="bottom"?180:0}deg) scaleX(${h==="right"?-1:1})`, zIndex:2, pointerEvents:"none" }}>
              <path d="M5 5 L25 5 L5 25 Z" fill="none" stroke={GREEN} strokeWidth="1.5"/>
              <path d="M5 5 L15 5 L5 15 Z" fill={GREEN_PALE}/>
              <circle cx="30" cy="5" r="2" fill={GREEN} opacity="0.5"/>
              <circle cx="5"  cy="30" r="2" fill={GREEN} opacity="0.5"/>
            </svg>
          ))}

          {/* Side stripe patterns */}
          <div style={{ position:"absolute", left:28, top:70, bottom:70, width:20,
            backgroundImage:`repeating-linear-gradient(180deg,transparent 0,transparent 10px,${GREEN_PALE} 10px,${GREEN_PALE} 11px)`, zIndex:1 }} />
          <div style={{ position:"absolute", right:28, top:70, bottom:70, width:20,
            backgroundImage:`repeating-linear-gradient(180deg,transparent 0,transparent 10px,${GREEN_PALE} 10px,${GREEN_PALE} 11px)`, zIndex:1 }} />

          {/* ── Content ── */}
          <div style={{ padding:"36px 70px 36px", position:"relative", zIndex:3 }}>

            {/* Cert number — top right */}
            <div style={{
              position:"absolute", top:24, right:70,
              border:`1px solid ${GREEN}`, padding:"3px 10px",
              fontFamily:"'Cinzel',serif", fontSize:"10px", color: GREEN, letterSpacing:"0.1em"
            }}>
              {(record.certItumalo && record.certLaupepa && record.certRegBook) ? `${record.certItumalo}/${record.certLaupepa}/${record.certRegBook}` : record.mataiCertNumber || record.refNumber || "___/___/___"}
            </div>

            {/* Emblem + headings */}
            <div style={{ textAlign:"center", marginBottom:"10px" }}>
              <div style={{ width:"80px", height:"80px", margin:"0 auto 6px" }}>
                <img src={process.env.PUBLIC_URL + "/emblem.png"} alt="Samoa Emblem"
                  style={{ width:"80px", height:"80px", objectFit:"contain" }} />
              </div>
              <p style={{ fontFamily:"'Cinzel',serif", fontSize:"7.5px", letterSpacing:"0.35em", color: GREEN, textTransform:"uppercase", marginBottom:"3px" }}>
                Independent State of Samoa
              </p>
              <p style={{ fontFamily:"'Cinzel',serif", fontSize:"8px", letterSpacing:"0.13em", color:"#5a3e00", textTransform:"uppercase", marginBottom:"5px" }}>
                Matagaluega o Faamasinoga ma le Faafoeina o Tulaga Tau Faamasinoga
              </p>
              <h1 style={{ fontFamily:"'Cinzel Decorative',serif", fontSize:"19px", color:"#3d2800", marginBottom:"3px" }}>
                Tusi Faamaonia o le Umia o le Suafa Matai
              </h1>
              <p style={{ fontFamily:"'Cinzel',serif", fontSize:"8px", letterSpacing:"0.2em", color: GREEN, textTransform:"uppercase" }}>
                Certificate of Registration — Matai Title
              </p>
            </div>

            {/* Divider */}
            <div style={{ display:"flex", alignItems:"center", gap:"10px", margin:"10px 0 14px" }}>
              <div style={{ flex:1, height:"1px", background:`linear-gradient(to right,transparent,${GREEN})` }}/>
              <span style={{ color: GREEN, fontSize:"12px" }}>✦</span>
              <div style={{ flex:1, height:"1px", background:`linear-gradient(to left,transparent,${GREEN})` }}/>
            </div>

            {/* LINE 1 — Afioga [Title + Name] */}
            <div style={{ display:"flex", alignItems:"baseline", gap:"10px", marginBottom:"10px" }}>
              <span style={{ fontFamily:"'Cinzel',serif", fontSize:"11px", color: GREEN, letterSpacing:"0.1em", whiteSpace:"nowrap" }}>Afioga</span>
              <span style={{ ...uline("340px"), fontSize:"16px", textAlign:"left", paddingLeft:"6px" }}>
                {afiogaName}
              </span>
            </div>

            {/* LINE 2 — Village on its own line */}
            <div style={{ display:"flex", alignItems:"baseline", marginBottom:"14px" }}>
              <span style={{ ...uline("220px"), fontSize:"15px", textAlign:"left", paddingLeft:"6px" }}>
                {record.village || ""}
              </span>
            </div>

            {/* Thin rule */}
            <div style={{ height:"1px", background:`linear-gradient(to right, transparent, ${GREEN}, transparent)`, marginBottom:"12px", opacity:0.4 }} />

            {/* BODY TEXT — line by line matching original */}
            <div style={{ fontSize:"13px", lineHeight:"2.15", color:"#1a1208" }}>

              {/* Ua tuuina... suafa [TITLE] */}
              <div style={{ display:"flex", alignItems:"baseline", flexWrap:"wrap", gap:"4px" }}>
                <span>Ua tuuina atu lenei Tusi Faamaoni e faailoa atu ai le avea o Oe o le nofo aloa'ia o le suafa</span>
                <span style={uline("110px")}>{record.mataiTitle || ""}</span>
              </div>

              {/* o le nu'u o [VILLAGE] i le Itumalo [DISTRICT] ma na resitara i le */}
              <div style={{ display:"flex", alignItems:"baseline", flexWrap:"wrap", gap:"4px" }}>
                <span>o le nu'u o</span>
                <span style={uline("100px")}>{record.village || ""}</span>
                <span>i le Itumalo</span>
                <span style={uline("175px")}>{district}</span>
                <span>ma na resitara i le</span>
              </div>

              {/* aso [DD] o [MONTH] [YEAR] */}
              <div style={{ display:"flex", alignItems:"baseline", gap:"5px" }}>
                <span>aso</span>
                <span style={uline("34px")}>{getDay(record.dateRegistration)}</span>
                <span>o</span>
                <span style={uline("88px")}>{getMonth(record.dateRegistration)}</span>
                <span style={uline("54px")}>{getYear(record.dateRegistration)}</span>
              </div>

              {/* Tuuina atu i lenei aso [DD] o [MONTH] [YEAR] */}
              <div style={{ display:"flex", alignItems:"baseline", gap:"5px" }}>
                <span>Tuuina atu i lenei aso</span>
                <span style={uline("34px")}>{getDay(record.dateIssued)}</span>
                <span>o</span>
                <span style={uline("88px")}>{getMonth(record.dateIssued)}</span>
                <span style={uline("54px")}>{getYear(record.dateIssued)}</span>
              </div>

            </div>

            {/* Divider */}
            <div style={{ height:"1px", background:`linear-gradient(to right, transparent, ${GREEN}, transparent)`, margin:"14px 0", opacity:0.4 }} />

            {/* FOOTER — registrar signature right aligned, matching original */}
            <div style={{ display:"flex", justifyContent:"flex-end", alignItems:"flex-end" }}>
              <div style={{ textAlign:"center", minWidth:"220px" }}>
                <div style={{ borderBottom:`1px solid ${GREEN}`, marginBottom:"5px", paddingBottom:"30px" }}/>
                <p style={{ fontFamily:"'Cinzel',serif", fontSize:"9px", letterSpacing:"0.12em", color: GREEN, textTransform:"uppercase" }}>
                  Resitara
                </p>
                <p style={{ fontFamily:"'Cinzel',serif", fontSize:"9px", color:"#3d2800", marginTop:"3px" }}>
                  Mo le: <strong>RESITARA</strong>
                </p>
              </div>
            </div>

          </div>
        </div>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700&family=Cinzel+Decorative:wght@400;700&family=EB+Garamond:ital,wght@0,400;0,600;1,400&display=swap');
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; margin: 0 !important; }
          #certificate-wrapper { padding: 0 !important; background: white !important; }
          #certificate { box-shadow: none !important; }
          @page { size: A4 portrait; margin: 0.5cm; }
        }
      `}</style>
    </>
  );
}

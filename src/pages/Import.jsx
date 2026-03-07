import { useState } from "react";
import { collection, addDoc, getDocs, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../firebase";
import { logAudit } from "../utils/audit";
import { getPermissions } from "../utils/roles";
import Sidebar from "../components/Sidebar";
import { Navigate, useNavigate } from "react-router-dom";

function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map(h => h.trim().replace(/^"|"$/g, ""));
  return lines.slice(1).map(line => {
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

// Normalise a key for fuzzy lookup
const norm = (s) => String(s || "").toLowerCase().replace(/[\s\n\r_\-\/\.'']/g, "");

// ── Official district number → name (from Samoa district list) ──
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

// ── Village → district name (from Samoa district list) ──
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

// Map a raw spreadsheet row to Firestore fields
function mapRow(row) {
  // Build normalised key lookup
  const lookup = {};
  for (const k of Object.keys(row)) {
    lookup[norm(k)] = row[k];
  }
  const g = (...keys) => {
    for (const k of keys) {
      const v = lookup[norm(k)];
      if (v !== undefined && v !== null && String(v).trim() !== "") {
        // Return Date objects as-is so parseDate can handle them properly
        if (v instanceof Date) return v;
        return String(v).trim();
      }
    }
    return "";
  };

  const today = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; })();

  const parseDate = (val) => {
    if (!val && val !== 0) return "";
    // JS Date object — XLSX.js cellDates returns LOCAL midnight, use local methods
    if (val instanceof Date) {
      if (isNaN(val.getTime())) return "";
      return `${val.getFullYear()}-${String(val.getMonth()+1).padStart(2,"0")}-${String(val.getDate()).padStart(2,"0")}`;
    }
    // Excel serial number (raw:true mode)
    if (typeof val === "number" && val > 1000) {
      const d = new Date(Math.round((val - 25569) * 86400 * 1000));
      return d.toISOString().split("T")[0];
    }
    const s = String(val).trim();
    if (!s || s === "Invalid Date") return "";
    // YYYY-MM-DD or ISO datetime
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
    // MM/DD/YY or MM/DD/YYYY — XLSX.js default format with raw:false
    const mdy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
    if (mdy) {
      const yr = mdy[3].length === 2 ? (parseInt(mdy[3]) > 30 ? "19" : "20") + mdy[3] : mdy[3];
      return `${yr}-${mdy[1].padStart(2,"0")}-${mdy[2].padStart(2,"0")}`;
    }
    // DD-MM-YYYY or DD.MM.YYYY
    const dmy = s.match(/^(\d{1,2})[\-.](\d{1,2})[\-.](\d{4})$/);
    if (dmy) return `${dmy[3]}-${dmy[2].padStart(2,"0")}-${dmy[1].padStart(2,"0")}`;
    // Year only
    if (/^\d{4}$/.test(s)) return `${s}-01-01`;
    return "";
  };

  const makeDate = (dayVal, yearVal) => {
    if (dayVal instanceof Date) return parseDate(dayVal);
    const d = String(dayVal || "").trim();
    const y = String(yearVal || "").trim();
    if (!d && !y) return "";
    if (/^\d{4}-\d{2}-\d{2}/.test(d)) return d.slice(0, 10);
    if (!d && y && /^\d{4}$/.test(y)) return `${y}-01-01`;
    return parseDate(d || y);
  };

  // ── Numera o le Itumalo → district name ──
  // This field holds the official district number (1-41)
  const itumaaloRaw = g("Numera o le Itumalo", "numeraoleItumalo", "itumaalo", "itumalo");
  const itumaaloNum = parseInt(itumaaloRaw, 10);
  let districtName  = (!isNaN(itumaaloNum) && DISTRICT_BY_NUM[itumaaloNum])
                        ? DISTRICT_BY_NUM[itumaaloNum] : "";

  // ── Numera ole Laupepa = registry volume number ──
  const laupepaNum     = g("Numera ole Laupepa", "numeraolelaupepa");
  // ── Registry Book Numbers = sequential entry number ──
  const regBookNum     = g("Registry Book Numbers", "registrybooknumbers");

  // ── Matai Cert Number = Itumalo / Laupepa / RegBookNum ──
  // e.g. "2/13/45" means district 2, volume 13, entry 45
  const parts = [itumaaloRaw, laupepaNum, regBookNum].filter(Boolean);
  const mataiCertNumber = parts.length ? parts.join("/") : "";

  // ── Village ──
  const village = g(
    "Nuu e Patino iai le \nSuafa Matai", "nuuepatinoiailesuafamatai", "NuuePatinoiailesuafaMatai",
    "NuuePatinoiailesuafa", "village", "nuu"
  );

  // If district not set from Itumalo field, try village lookup
  if (!districtName && village) {
    districtName = VILLAGE_TO_DISTRICT[village.trim().toUpperCase()] || "";
  }

  // Normalise gender to match dropdown values: "Tane" or "Tamaitai"
  const gRaw = g("Tane/Tamaitai","tanetamaitai").toLowerCase().trim();
  const gender = gRaw === "tane" || gRaw === "male" || gRaw === "m" ? "Tane"
               : gRaw === "fafine" || gRaw === "female" || gRaw === "tamaitai" || gRaw === "f" ? "Tamaitai"
               : g("Tane/Tamaitai","tanetamaitai");

  // Normalise mataiType: "Alii"/"Ali'i" → "Ali'i", "Tulafale" → "Tulafale"
  const tRaw = g("Ituaiga Suafa","ituaigasuafa").toLowerCase().replace(/[''']/g,"").trim();
  const mataiType = tRaw === "alii" ? "Ali'i"
                  : tRaw === "tulafale" ? "Tulafale"
                  : g("Ituaiga Suafa","ituaigasuafa");

  // Normalise village case to match DISTRICT_VILLAGES dropdown options
  let normVillage = village;
  if (districtName) {
    const opts = VILLAGE_TO_DISTRICT; // flat lookup
    // Try to match title-case from the district villages
    const villageUpper = village.trim().toUpperCase();
    // Find the canonical casing from VILLAGE_TO_DISTRICT keys
    const canonicalKey = Object.keys(VILLAGE_TO_DISTRICT).find(k => k === villageUpper);
    if (canonicalKey) {
      // Convert to Title Case for display
      normVillage = canonicalKey.split(" ").map(w => w.charAt(0) + w.slice(1).toLowerCase()).join(" ");
    }
  }

  return {
    mataiTitle:       g("Suafa Matai","suafamatai"),
    holderName:       g("Igoa Taulealea","igoataulealea"),
    gender,
    mataiType,
    village:          normVillage,
    district:         districtName,
    nuuMataiAi:       g("Nuu o loo \nMatai ai","Nuu o loo Matai ai","nuuoloomataiai","nuoloomatai"),
    dateConferred:    parseDate(g("Aso o le Saofai","asoolesaofai")),
    dateProclamation: parseDate(g("Aso o le \nFaasalalauga","Aso o le Faasalalauga","asoolefaasalalauga")),
    dateRegistration: parseDate(g("Aso na \nResitala ai","Aso na Resitala ai","asonaresitalaai")),
    dateIssued:       parseDate(g("dateIssued","dateisuued")) || today,
    dateBirth:        parseDate(g("Aso Fanau","asofanau")),
    nuuFanau:         g("Nuu na Fanau ai","nuunafanauai"),
    certItumalo:      itumaaloRaw,
    certLaupepa:      laupepaNum,
    certRegBook:      regBookNum,
    mataiCertNumber,
    refNumber:        regBookNum,
    faapogai:         g("Faapogai","faapogai"),
    familyTitles:     g("Isi Suafa Matai","isisuafamatai"),
    notes:            g("Isi Faamatalaga","isifaamatalaga"),
  };
}

// Columns shown in the preview table
const PREVIEW_COLS = [
  { key:"mataiCertNumber",  label:"Cert No.",        required: false },
  { key:"mataiTitle",       label:"Suafa Matai",     required: true  },
  { key:"holderName",       label:"Igoa Taulealea",  required: false },
  { key:"gender",           label:"Tane/Tamaitai",   required: false },
  { key:"mataiType",        label:"Ituaiga Suafa",   required: false },
  { key:"village",          label:"Nu'u",            required: false },
  { key:"district",         label:"Itumalo",         required: false },
  { key:"dateConferred",    label:"Aso Saofai",      required: false },
  { key:"dateRegistration", label:"Aso Resitala",    required: false },
  { key:"faapogai",         label:"Faapogai",        required: false },
];

export default function Import({ userRole }) {
  const navigate = useNavigate();
  const [file, setFile]         = useState(null);
  const [preview, setPreview]   = useState([]);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [done, setDone]         = useState(0);
  const [errors, setErrors]     = useState([]);
  const [step, setStep]         = useState("upload");
  const [dragOver, setDragOver] = useState(false);
  const perms = getPermissions(userRole);
  const user  = auth.currentUser;

  if (!perms.canAdd) return <Navigate to="/dashboard" />;

  const processRows = (rows) => {
    const mapped = rows.map(mapRow);
    setPreview(mapped);
    setStep("preview");
  };

  const handleFile = async (f) => {
    if (!f) return;
    setFile(f); setErrors([]);
    const ext = f.name.split(".").pop().toLowerCase();

    if (ext === "csv") {
      const text = await f.text();
      processRows(parseCSV(text));
    } else if (ext === "xlsx" || ext === "xls") {
      const loadAndProcess = async () => {
        const buf  = await f.arrayBuffer();
        const wb   = window.XLSX.read(buf, { type:"array", cellDates: true });
        const ws   = wb.Sheets[wb.SheetNames[0]];
        const rows = window.XLSX.utils.sheet_to_json(ws, { defval:"", raw: true });
        processRows(rows);
      };
      if (window.XLSX) {
        loadAndProcess();
      } else {
        const script = document.createElement("script");
        script.src = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
        script.onload = loadAndProcess;
        document.head.appendChild(script);
      }
    } else {
      setErrors(["Unsupported file type. Please upload .csv, .xlsx or .xls"]);
    }
  };

  const handleInputChange = (e) => handleFile(e.target.files[0]);

  const handleDrop = (e) => {
    e.preventDefault(); setDragOver(false);
    handleFile(e.dataTransfer.files[0]);
  };

  const handleImport = async () => {
    setImporting(true); setProgress(0); setDone(0);
    const errs = [];
    const skippedRows = [];
    const dupWarnings = [];
    let count = 0;

    // Identify skipped rows with their numbers and available content
    preview.forEach((row, i) => {
      if (!row.mataiTitle) {
        const hint = row.holderName || row.faapogai || row.notes || row.village || "(empty row)";
        skippedRows.push(`Row ${i + 1} — no Suafa Matai. Available data: "${hint}"`);
      }
    });

    // Load existing records once for dupe checking
    const existingSnap = await getDocs(collection(db, "registrations"));
    const existingRecords = existingSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const existingCertNums = new Map(
      existingRecords
        .filter(r => r.mataiCertNumber)
        .map(r => [r.mataiCertNumber, r])
    );
    const existingTitles = new Map(
      existingRecords
        .filter(r => r.mataiTitle)
        .map(r => [r.mataiTitle.trim().toUpperCase(), r])
    );

    const valid = preview.filter(r => r.mataiTitle);
    for (let i = 0; i < valid.length; i++) {
      const row = valid[i];

      // Check for duplicate cert number
      if (row.mataiCertNumber && existingCertNums.has(row.mataiCertNumber)) {
        const existing = existingCertNums.get(row.mataiCertNumber);
        dupWarnings.push(`⚠ Row ${i+1} — Cert No. ${row.mataiCertNumber} already exists: "${existing.mataiTitle}" (${existing.holderName}). Imported anyway — please review.`);
        await logAudit("DUPLICATE_WARNING", { certNumber: row.mataiCertNumber, mataiTitle: row.mataiTitle, existingTitle: existing.mataiTitle, source: "import" });
      }

      // Check for duplicate matai title
      const titleKey = row.mataiTitle.trim().toUpperCase();
      if (existingTitles.has(titleKey)) {
        const existing = existingTitles.get(titleKey);
        dupWarnings.push(`⚠ Row ${i+1} — Title "${row.mataiTitle}" already exists (holder: ${existing.holderName}). Imported anyway — please review.`);
      }

      try {
        await addDoc(collection(db, "registrations"), { ...row, createdAt: serverTimestamp() });
        count++;
      } catch (err) {
        errs.push(`Row ${i + 1} (${row.mataiTitle}): ${err.message}`);
      }
      setProgress(Math.round(((i + 1) / valid.length) * 100));
    }

    await logAudit("IMPORT", { count, file: file?.name, skipped: skippedRows.length, duplicates: dupWarnings.length });
    const { cacheClear } = await import("../utils/cache");
    cacheClear("registrations");
    cacheClear("auditLog");
    setDone(count);
    setErrors([...skippedRows, ...dupWarnings, ...errs]);
    setImporting(false);
    setStep("done");
    // Always redirect to dashboard after import completes (2s to show result, 4s if there are warnings)
    const delay = (errs.length > 0 || skippedRows.length > 0 || dupWarnings.length > 0) ? 4000 : 2000;
    setTimeout(() => navigate("/dashboard"), delay);
  };

  const reset = () => {
    setFile(null); setPreview([]); setProgress(0);
    setDone(0); setErrors([]); setStep("upload");
  };

  const validCount   = preview.filter(r => r.mataiTitle).length;
  const skippedCount = preview.length - validCount;

  // ── Shared styles using the same variables as the rest of the app ──
  const thStyle = {
    background: "#155c31", color: "rgba(255,255,255,0.92)",
    padding: "0.75rem 1rem", fontFamily: "'Cinzel',serif",
    fontSize: "0.62rem", letterSpacing: "0.15em",
    textTransform: "uppercase", textAlign: "left", whiteSpace: "nowrap",
  };

  return (
    <div className="app-layout">
      <div className="pattern-bg" />
      <Sidebar userRole={userRole} userEmail={user?.email} />
      <div className="sidebar-content">

        {/* ── Header ── */}
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:"2rem" }}>
          <div>
            <p className="page-eyebrow">Data Management</p>
            <h1 className="page-title">Import Records</h1>
          </div>
          {step !== "upload" && (
            <button className="btn-secondary" onClick={reset}>← Start Over</button>
          )}
        </div>

        {/* ── UPLOAD STEP ── */}
        {step === "upload" && (
          <div style={{ display:"grid", gridTemplateColumns:"1fr 340px", gap:"1.5rem", alignItems:"start" }}>

            {/* Drop zone */}
            <div
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              style={{
                background: dragOver ? "#e8f5ed" : "#fff",
                border: `2px dashed ${dragOver ? "#155c31" : "#a7c9b2"}`,
                borderRadius: "8px", padding: "4rem 2rem", textAlign: "center",
                transition: "all 0.2s", cursor: "pointer",
              }}
            >
              <div style={{ fontSize:"3rem", marginBottom:"1.25rem" }}>📂</div>
              <p style={{ fontFamily:"'Cinzel',serif", fontSize:"0.85rem", color:"#155c31", letterSpacing:"0.15em", textTransform:"uppercase", marginBottom:"0.5rem" }}>
                Drag & Drop File Here
              </p>
              <p style={{ color:"#6b7280", fontSize:"0.88rem", marginBottom:"2rem" }}>
                Supports .csv, .xlsx, .xls
              </p>
              <input type="file" accept=".csv,.xlsx,.xls" onChange={handleInputChange}
                style={{ display:"none" }} id="file-input" />
              <label htmlFor="file-input">
                <span className="btn-primary" style={{ cursor:"pointer", padding:"0.75rem 2.5rem", fontSize:"0.8rem" }}>
                  Choose File
                </span>
              </label>
              {errors.map((e,i) => (
                <div key={i} className="alert alert-error" style={{ marginTop:"1rem", textAlign:"left" }}>{e}</div>
              ))}
            </div>

            {/* Column guide */}
            <div className="card">
              <h3 className="section-head">◈ Column Mapping</h3>
              <p style={{ fontSize:"0.83rem", color:"#374151", marginBottom:"1.25rem", lineHeight:1.6 }}>
                The importer maps these Excel columns to the registry fields:
              </p>
              <div style={{ display:"flex", flexDirection:"column", gap:"0" }}>
                {[
                  ["Numera o le Itumalo",            "District Number",     false],
                  ["Numera ole Laupepa",             "Volume Number",       false],
                  ["Registry Book Numbers",          "Entry Number",        false],
                  ["Suafa Matai",                    "Matai Title",         true ],
                  ["Nuu e Patino iai le Suafa Matai","Village",             false],
                  ["Igoa Taulealea",                 "Holder Name",         false],
                  ["Tane/Tamaitai",                  "Gender",              false],
                  ["Ituaiga Suafa",                  "Title Type",          false],
                  ["Aso o le Saofai",                "Date of Saofai",      false],
                  ["Aso o le Faasalalauga",          "Date of Proclamation",false],
                  ["Aso na Resitala ai",             "Date Registered",     false],
                  ["Aso Fanau",                      "Date of Birth",       false],
                  ["Nuu na Fanau ai",                "Village of Birth",    false],
                  ["Faapogai",                       "Faapogai",            false],
                  ["Isi Suafa Matai",                "Other Family Titles", false],
                  ["Nuu o loo Matai ai",             "Village (Matai held)",false],
                  ["Isi Faamatalaga",                "Notes",               false],
                ].map(([excel, field, req]) => (
                  <div key={field} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"0.45rem 0", borderBottom:"1px solid #f3f4f6" }}>
                    <span style={{ fontSize:"0.8rem", color:"#111827", fontWeight: req ? "600" : "normal" }}>
                      {excel}{req && <span style={{ color:"#991b1b", marginLeft:"2px" }}>*</span>}
                    </span>
                    <span style={{ fontSize:"0.75rem", color:"#6b7280", fontStyle:"italic" }}>{field}</span>
                  </div>
                ))}
              </div>
              <p style={{ fontSize:"0.72rem", color:"#991b1b", marginTop:"0.75rem" }}>* Required — rows missing this will be skipped</p>
            </div>
          </div>
        )}

        {/* ── PREVIEW STEP ── */}
        {step === "preview" && !importing && (
          <div>
            {/* Stats bar */}
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr auto", gap:"1rem", marginBottom:"1.5rem", alignItems:"center" }}>
              <div className="stat-card">
                <p style={{ fontFamily:"'Cinzel',serif", fontSize:"0.62rem", color:"#6b7280", letterSpacing:"0.15em", textTransform:"uppercase", marginBottom:"0.3rem" }}>Total Rows</p>
                <p style={{ fontFamily:"'Cinzel Decorative',serif", fontSize:"1.8rem", color:"#155c31" }}>{preview.length}</p>
              </div>
              <div className="stat-card">
                <p style={{ fontFamily:"'Cinzel',serif", fontSize:"0.62rem", color:"#6b7280", letterSpacing:"0.15em", textTransform:"uppercase", marginBottom:"0.3rem" }}>Will Import</p>
                <p style={{ fontFamily:"'Cinzel Decorative',serif", fontSize:"1.8rem", color:"#155c31" }}>{validCount}</p>
              </div>
              <div className="stat-card">
                <p style={{ fontFamily:"'Cinzel',serif", fontSize:"0.62rem", color:"#6b7280", letterSpacing:"0.15em", textTransform:"uppercase", marginBottom:"0.3rem" }}>Will Skip</p>
                <p style={{ fontFamily:"'Cinzel Decorative',serif", fontSize:"1.8rem", color: skippedCount > 0 ? "#991b1b" : "#6b7280" }}>{skippedCount}</p>
              </div>
              <div style={{ display:"flex", flexDirection:"column", gap:"0.5rem" }}>
                <button onClick={handleImport} className="btn-primary" style={{ fontSize:"0.78rem", whiteSpace:"nowrap" }}>
                  ↑ Import {validCount} Records
                </button>
                <button onClick={reset} className="btn-secondary" style={{ fontSize:"0.75rem" }}>Cancel</button>
              </div>
            </div>

            <p style={{ fontFamily:"'Cinzel',serif", fontSize:"0.68rem", color:"#374151", letterSpacing:"0.1em", marginBottom:"0.85rem" }}>
              File: <strong style={{ color:"#155c31" }}>{file?.name}</strong>
              {skippedCount > 0 && <span style={{ color:"#991b1b", marginLeft:"1rem" }}>⚠ {skippedCount} rows missing Matai Title will be skipped</span>}
            </p>

            {/* Preview table */}
            <div style={{ background:"#fff", border:"1px solid #d1d5db", borderRadius:"6px", overflow:"hidden", boxShadow:"0 1px 3px rgba(0,0,0,0.08)" }}>
              <div style={{ overflowX:"auto", maxHeight:"500px", overflowY:"auto" }}>
                <table style={{ width:"100%", borderCollapse:"collapse" }}>
                  <thead style={{ position:"sticky", top:0, zIndex:1 }}>
                    <tr>
                      <th style={{ ...thStyle, width:"40px" }}>#</th>
                      {PREVIEW_COLS.map(col => <th key={col.key} style={thStyle}>{col.label}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((row, i) => (
                      <tr key={i} style={{ background: !row.mataiTitle ? "#fef2f2" : i % 2 === 0 ? "#fff" : "#fafafa", borderBottom:"1px solid #e5e7eb" }}>
                        <td style={{ padding:"0.7rem 1rem", color:"#9ca3af", fontSize:"0.8rem" }}>{i+1}</td>
                        {PREVIEW_COLS.map(col => (
                          <td key={col.key} style={{
                            padding:"0.7rem 1rem", fontSize:"0.87rem",
                            maxWidth:"150px", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap",
                            color: col.key === "mataiTitle" ? "#155c31" : !row.mataiTitle ? "#991b1b" : "#111827",
                            fontWeight: col.key === "mataiTitle" ? "700" : "normal",
                          }}>
                            {row[col.key] || <span style={{ color:"#d1d5db" }}>—</span>}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ── PROGRESS ── */}
        {importing && (
          <div className="card" style={{ textAlign:"center", padding:"3rem" }}>
            <p style={{ fontFamily:"'Cinzel',serif", fontSize:"0.82rem", color:"#155c31", letterSpacing:"0.2em", textTransform:"uppercase", marginBottom:"1.5rem" }}>
              Importing Records…
            </p>
            <div style={{ background:"#e8f5ed", borderRadius:"4px", height:"10px", overflow:"hidden", maxWidth:"400px", margin:"0 auto 1rem" }}>
              <div style={{ background:"#155c31", height:"100%", width:`${progress}%`, transition:"width 0.3s", borderRadius:"4px" }} />
            </div>
            <p style={{ fontFamily:"'Cinzel Decorative',serif", fontSize:"2rem", color:"#155c31" }}>{progress}%</p>
          </div>
        )}

        {/* ── DONE ── */}
        {step === "done" && !importing && (
          <div>
            <div className="card" style={{ textAlign:"center", padding:"3rem", marginBottom:"1.5rem", borderColor:"#a7c9b2" }}>
              <div style={{ fontSize:"3rem", marginBottom:"1rem" }}>✅</div>
              <p style={{ fontFamily:"'Cinzel Decorative',serif", fontSize:"2.5rem", color:"#155c31", marginBottom:"0.25rem" }}>{done}</p>
              <p style={{ fontFamily:"'Cinzel',serif", fontSize:"0.78rem", color:"#155c31", letterSpacing:"0.2em", textTransform:"uppercase" }}>
                Records Imported Successfully
              </p>
              {skippedCount > 0 && (
                <p style={{ marginTop:"0.75rem", fontSize:"0.88rem", color:"#991b1b" }}>
                  {skippedCount} rows were skipped (missing Matai Title)
                </p>
              )}
            </div>
            {errors.length > 0 && (
              <div className="card" style={{ marginBottom:"1.5rem", borderColor:"#fca5a5" }}>
                <h3 className="section-head" style={{ color:"#991b1b" }}>◈ {errors.length} Skipped Row{errors.length !== 1 ? "s" : ""}</h3>
                <p style={{ fontSize:"0.83rem", color:"#6b7280", marginBottom:"1rem" }}>
                  These rows had no Suafa Matai and were not imported. Review the data below to determine if they should be added manually.
                </p>
                <div style={{ maxHeight:"320px", overflowY:"auto", display:"flex", flexDirection:"column", gap:"0.3rem" }}>
                  {errors.map((e, i) => (
                    <div key={i} style={{ display:"flex", gap:"0.75rem", alignItems:"flex-start", padding:"0.55rem 0.85rem", background: e.includes("no Suafa Matai") ? "#fef9f0" : "#fef2f2", border:"1px solid", borderColor: e.includes("no Suafa Matai") ? "#fcd34d" : "#fca5a5", borderRadius:"4px", fontSize:"0.82rem" }}>
                      <span style={{ color: e.includes("no Suafa Matai") ? "#92400e" : "#991b1b", minWidth:"16px" }}>
                        {e.includes("no Suafa Matai") ? "⚠" : "✕"}
                      </span>
                      <span style={{ color:"#374151" }}>{e}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div style={{ display:"flex", gap:"1rem" }}>
              <button onClick={reset} className="btn-primary" style={{ fontSize:"0.78rem" }}>Import Another File</button>
              <a href="#/dashboard"><button className="btn-secondary" style={{ fontSize:"0.78rem" }}>← View Registry</button></a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

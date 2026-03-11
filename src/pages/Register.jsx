import { useState, useEffect } from "react";
import { Link, useNavigate, useParams, useLocation } from "react-router-dom";
import { signOut } from "firebase/auth";
import { collection, addDoc, doc, getDoc, updateDoc, serverTimestamp, getDocs } from "firebase/firestore";
import { auth, db } from "../firebase";
import { logAudit, diffRecords } from "../utils/audit";
import { getPermissions } from "../utils/roles";
import { cacheGet, cacheSet, cacheClear } from "../utils/cache";
import Sidebar from "../components/Sidebar";


// ── Official Samoa district numbering ──
const DISTRICT_NUM = {
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

// Dropdown options sorted by number: "1 – VAIMAUGA SASA'E"
const DISTRICT_OPTIONS = Object.entries(DISTRICT_NUM)
  .sort((a,b) => Number(a[0]) - Number(b[0]))
  .map(([num, name]) => ({ num: Number(num), name }));

// Village → district name lookup
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

// District name → villages list
const DISTRICT_VILLAGES = {
  "AANA ALOFI Nu.03": ['Faleatiu', 'Fasitoo-Tai', 'Satapuala', 'Satuimalufilufi', 'Vailuutai'],
  "AANA ALOFI Nu.1": ['Faleasiu', 'Fasitoouta'],
  "AANA ALOFI Nu.2": ['Leulumoega', 'Noafoalii'],
  "AIGA I LE TAI": ['Apai & Satuilagi', 'Apolima Tai', 'Apolima Uta', 'Faleu Tai', 'Faleu Uta', 'Fuailoloo', 'Lalovi Mulifanua', 'Lepuai', 'Salua & Satoi'],
  "ALATAUA SISIFO": ['Falelima', 'Neiafu', 'Tufutafoe'],
  "ALEIPATA ITUPA I LALO": ['Amaile', 'Lotopue', 'Malaela & Mutiatele', 'Saleaaumua', 'Samusu', 'Satitoa', 'Tiavea', 'Utufaalalafa'],
  "ALEIPATA ITUPA I LUGA": ['Lalomanu', 'Ulutogia', 'Vailoa Aleipata'],
  "ANOAMAA SASA'E": ['Falefa', 'Falevao', 'Lalomauga', 'Lufilufi', 'Manunu', 'Saletele', 'Sauano'],
  "ANOAMAA SISIFO": ['Eva', 'Fusi', 'Leusoalii', 'Luatuanuu', 'Salelesi', 'Saoluafata', 'Solosolo'],
  "FAASALELEAGA Nu 1": ['Iva', 'Lalomalava', 'Safua', 'Salelavalu', 'Salelologa', 'Vaiafai', 'Vaisaulu'],
  "FAASALELEAGA Nu 2": ['Eveeve & Vaimaga', 'Fatausi', 'Fogapoa & Tuasivi', 'Fusi & Fuifatu', 'Sapapalii', 'Tapueleele'],
  "FAASALELEAGA Nu 3": ['Malae & Salimu', 'Saasaai', 'Saipipi', 'Sapini & Luua', 'Siufaga'],
  "FAASALELEAGA Nu. 04": ['Asaga', 'Falanai', 'Lano', 'Puapua'],
  "FALEALILI": ['Malaemalu & Tafatafa', 'Matautu Falealili', 'Poutasi', 'Salani', 'Saleilua', 'Salesatele', 'Sapoe / Utulaelae', 'Sapunaoa', 'Satalo', 'Siuniu', 'Vaovai'],
  "FALEALUPO": ['Avata', 'Vaotupua'],
  "FALEATA SASA'E": ['Lepea', 'Vailoa Faleata', 'Vaimoso'],
  "FALEATA SISIFO": ['Saina', 'Toamua / Puipaa', 'Vaigaga', 'Vaitele', 'Vaiusu'],
  "GAGAEMAUGA Nu.01": ['Leauvaa', 'Lemalu', 'Mauga', 'Patamea', 'Samalaeulu'],
  "GAGAEMAUGA Nu.02": ['Salamumu', 'Saleaula'],
  "GAGAEMAUGA Nu.03": ['Avao', 'Fagamalo', 'Lelepa', 'Safai', 'Saleia', 'Satoaleapai', 'Vaipouli'],
  "GAGAIFOMAUGA Nu.03": ['Aopo', 'Fagaee', 'Letui', 'Sasina'],
  "GAGAIFOMAUGA Nu.1": ['Manase', 'Safotu'],
  "GAGAIFOMAUGA Nu.2": ['Faletagaloa', 'Fatuvalu', 'Lefagoalii', 'Matavai', 'Paia', 'Samauga'],
  "LEFAGA & FALEASEELA": ['Faleaseela', 'Gagaifolevao', 'Matafaa', 'Matautu Lefaga', 'Safaatoa', 'Savaia & Tafagamanu'],
  "LEPA": ['Aufaga', 'Lepa & Vaigalu', 'Saleapaga & Siupapa'],
  "LOTOFAGA": ['Lotofaga', 'Matautu', 'Vavau'],
  "PALAULI": ['Faala', 'Vailoa', 'Vaitoomuli'],
  "PALAULI LE FALEFA": ['Gataivai', 'Gautavai', 'Papa Puleia', 'Puleia', 'Sili', 'Tafua'],
  "PALAULI SISIFO": ['Foalalo', 'Foaluga', 'Salailua', 'Satuiatua', 'Siutu', 'Taga'],
  "SAFATA": ['Fausaga', 'Fusi', 'Lotofaga', 'Mulivai', 'Niusuatia', 'Saanapu', 'Sataoa', 'Tafitoala', 'Vaiee'],
  "SAGAGA LE FALEFA": ['Faleula', 'Levi & Alamutu', "Lotoso'A", "Salepoua'E & Nono'A", 'Utualii & Tufulele'],
  "SAGAGA LE USOGA": ['Afega', 'Malie', 'Tuanai'],
  "SALEGA": ['Fagafau', 'Faiaai', 'Fogasavaii', 'Fogatuli', 'Sagone', 'Samata- Uta', 'Samata-Tai', 'Siuvao', 'Vaipua'],
  "SAMATAU & FALELATAI": ["Falevai & Sama'I", 'Matautu & Levi', 'Pata', 'Samatau', 'Siufaga Falelatai'],
  "SATUPAITEA": ['Mosula', 'Pitonuu', 'Satufia', 'Vaeaga'],
  "SIUMU": ['Maninoa', 'Matafala', 'Saaga', "Siumu Sasa'E"],
  "VAA O FONOTI": ['Faleapuna', 'Lona', 'Maasina', 'Musumusu & Salimu', 'Samamea', 'Taelefaga', 'Uafato'],
  "VAIMAUGA SASA'E": ['Fagalii', 'Laulii', 'Letogo', 'Vailele'],
  "VAIMAUGA SISIFO": ['Alamagoto', 'Apia', 'Magiagi', 'Matautu', 'Moataa', 'Tanugamanono', 'Vaiala', 'Vailima'],
  "VAISIGANO Nu.02": ['Fagasa', 'Papa Sataua', 'Sataua'],
  "VAISIGANO Nu.1": ['Auala', 'Matavai Asau', 'Utuloa Asau', 'Vaisala'],
};

const MATAI_TYPES = ["Ali'i", "Tulafale"];

const EMPTY = {
  // Title & Holder
  mataiTitle: "", holderName: "", gender: "", mataiType: "Ali'i",
  familyName: "",
  // Village & District
  village: "", district: "",
  nuuMataiAi: "",       // Nuu o loo Matai ai
  // Dates
  intention: "no",      // Intention filed before saofai?
  dateConferred: "",    // Aso o le Saofai
  dateOfficeReceived: "", // Aso tauaaoina ai e le ofisa
  dateSavaliPublished: "", // Aso o le Faasalalauga
  dateRegistration: "", // Aso na Resitala ai
  dateIssued: (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; })(),
  dateBirth: "",        // Aso Fanau
  nuuFanau: "",         // Nuu na Fanau ai
  // Certificate numbers
  certItumalo: "", certLaupepa: "", certRegBook: "",
  mataiCertNumber: "",
  // Other
  faapogai: "",
  familyTitles: "",     // Isi Suafa Matai
  notes: "",            // Isi Faamatalaga
  suli: "",
  // Photo ID
  photoIdType: "",      // passport / drivers_licence
  photoIdNumber: "",
  photoIdImage: "",     // base64 data URL
  // Objection
  objection: "no",
  objectionDate: "",
  objectionApplicationDate: "",  // Aso faaulu ai le talosaga
  objectionApplicantName: "",    // Suafa o le na faaulua le talosaga
  objectionActingRegistrar: "",  // Suafa o le sui resitala
  objectionFileNumber: "",       // File #
  objectionLCNumber: "",         // LC # - Faaiuga Faamasinoga
};

export default function Register({ userRole }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState(EMPTY);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(!!id);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [dupWarning, setDupWarning] = useState("");
  const [certMismatch, setCertMismatch] = useState("");
  const [districtVillagesFS, setDistrictVillagesFS] = useState(null);
  const [allRecords, setAllRecords] = useState([]);
  const isEdit = !!id;
  const perms = getPermissions(userRole);
  const today = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; })();

  // Load all records for prev/next navigation
  useEffect(() => {
    (async () => {
      try {
        const cached = cacheGet("registrations");
        if (cached) { setAllRecords(cached); return; }
        const snap = await getDocs(collection(db, "registrations"));
        const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        data.sort((a,b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
        cacheSet("registrations", data);
        setAllRecords(data);
      } catch {}
    })();
  }, []);

  // Navigation list — use filtered IDs from dashboard state if available, else all records
  const passedIds   = location.state?.recordIds;
  const backTo      = location.state?.backTo;
  const backTab     = location.state?.backTab;
  const dupCertNum  = location.state?.dupCertNum;
  const isDupMode   = !!(backTo && dupCertNum);
  const navRecords = passedIds && allRecords.length > 0
    ? passedIds.map(pid => allRecords.find(r => r.id === pid)).filter(Boolean)
    : allRecords;
  const isFiltered = !!(passedIds && passedIds.length < allRecords.length);

  const currentIndex = isEdit ? navRecords.findIndex(r => r.id === id) : -1;
  const prevRecord   = currentIndex > 0 ? navRecords[currentIndex - 1] : null;
  const nextRecord   = currentIndex >= 0 && currentIndex < navRecords.length - 1 ? navRecords[currentIndex + 1] : null;

  // Auto-set dateRegistration when objection=no and dateSavaliPublished is set
  // Registration date rule:
  // Proclamations go out on the 28th of each month.
  // After 4 months, if no objection, registration is on the 29th of that month.
  // Exception: if the 4th month is February, use 28th (or 29th in a leap year).
  // i.e. always the 29th, clamped to the last day of the target month.
  const calcRegDate = (proclamation) => {
    if (!proclamation || !proclamation.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(proclamation.trim())) return null;
    const p = new Date(proclamation + "T00:00:00");
    if (isNaN(p.getTime())) return null;
    // Move to 1st of the month, add 4 months, then set day to 29 (clamped)
    const target = new Date(p.getFullYear(), p.getMonth() + 4, 1);
    const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
    const regDay = Math.min(29, lastDay);
    const reg = new Date(target.getFullYear(), target.getMonth(), regDay);
    const dateStr = `${reg.getFullYear()}-${String(reg.getMonth()+1).padStart(2,"0")}-${String(reg.getDate()).padStart(2,"0")}`;
    const today = new Date(); today.setHours(0,0,0,0);
    const isPast = reg <= today;
    return { dateStr, isPast };
  };

  const autoRegDate = (proclamation) => {
    const result = calcRegDate(proclamation);
    // Only auto-fill dateRegistration if the 4-month period has already passed
    // If still within Savali publication period, leave blank — staff must confirm via Notifications
    return result && result.isPast ? result.dateStr : "";
  };

  // Age validation — holder must be 21+ as of the conferred date
  const validateAge = (dob, conferred) => {
    if (!dob) return { valid: false, missing: true };
    const birth = new Date(dob + "T00:00:00");
    const refDate = conferred ? new Date(conferred + "T00:00:00") : new Date();
    refDate.setHours(0,0,0,0);
    const age = refDate.getFullYear() - birth.getFullYear() -
      (refDate < new Date(refDate.getFullYear(), birth.getMonth(), birth.getDate()) ? 1 : 0);
    return { valid: age >= 21, age, missing: false };
  };

  // Date order validation helpers
  const validatePublishedDate = (published, conferred, intentionVal) => {
    if (!published || !conferred) return null;
    const p = new Date(published + "T00:00:00");
    const c = new Date(conferred + "T00:00:00");
    if (intentionVal === "yes") {
      // Intention process: Savali is published BEFORE saofai — must be at least 4 months before
      const minSaofai = new Date(p.getFullYear(), p.getMonth() + 4, p.getDate());
      if (c < minSaofai) return "For Intention process: Saofai date must be at least 4 months after the Savali Published Date.";
    } else {
      // Normal process: Savali published AFTER saofai
      if (p <= c) return "Savali Published Date must be after the Date of Conferral (Saofai).";
    }
    return null;
  };

  const validateRegistrationDate = (regDate, published, conferred) => {
    if (!regDate) return null;
    const r = new Date(regDate + "T00:00:00");
    if (conferred) {
      const c = new Date(conferred + "T00:00:00");
      if (r <= c) return "Registration Date must be after the Date of Conferral.";
    }
    if (published) {
      const p = new Date(published + "T00:00:00");
      const minReg = new Date(p.getFullYear(), p.getMonth() + 4, p.getDate());
      if (r < minReg) return "Registration Date must be at least 4 months after the Savali Published Date.";
    }
    return null;
  };

  // Cert number mismatch warning — certItumalo should match selected district
  useEffect(() => {
    if (!form.certItumalo || !form.district) { setCertMismatch(""); return; }
    const expectedNum = districtNameToNum(form.district);
    if (expectedNum && Number(form.certItumalo) !== Number(expectedNum)) {
      const expectedDistrict = DISTRICT_NUM[Number(form.certItumalo)] || "unknown district";
      setCertMismatch(
        "⚠ Certificate Itumalo number (" + form.certItumalo + ") does not match the selected district (" +
        form.district + "). Number " + form.certItumalo + " corresponds to " + expectedDistrict + ". Please correct before saving."
      );
    } else {
      setCertMismatch("");
    }
  }, [form.certItumalo, form.district]);

  const fmtDateDMY = (dateStr) => {
    if (!dateStr || !dateStr.trim()) return "";
    const parts = dateStr.trim().split("-");
    if (parts.length !== 3 || parts[0].length !== 4) return dateStr;
    const d = parseInt(parts[2],10), m = parseInt(parts[1],10), y = parseInt(parts[0],10);
    if (isNaN(d) || isNaN(m) || isNaN(y)) return "";
    return `${String(d).padStart(2,"0")}-${String(m).padStart(2,"0")}-${y}`;
  };

  const regDateHint = (proclamation) => {
    const result = calcRegDate(proclamation);
    if (!result) return null;
    return { dateStr: result.dateStr, display: fmtDateDMY(result.dateStr), isPast: result.isPast };
  };

  const handleIdImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setForm(f => ({ ...f, photoIdImage: ev.target.result }));
    reader.readAsDataURL(file);
  };

  // Load district/villages from Firestore (falls back to hardcoded if not set)
  useEffect(() => {
    const cached = cacheGet("districtVillages");
    if (cached) { setDistrictVillagesFS(cached); return; }
    getDoc(doc(db, "settings", "districtVillages"))
      .then(snap => {
        if (snap.exists()) {
          cacheSet("districtVillages", snap.data().data);
          setDistrictVillagesFS(snap.data().data);
        }
      })
      .catch(() => {});
  }, []);

  const activeDistrictVillages = districtVillagesFS || DISTRICT_VILLAGES;
  const activeDistrictOptions = Object.keys(activeDistrictVillages).sort()
    .map((name) => {
      const entry = Object.entries(DISTRICT_NUM).find(([, n]) => n === name);
      return { num: entry ? Number(entry[0]) : "", name };
    })
    .sort((a, b) => Number(a.num) - Number(b.num));
  const villages = form.district ? (activeDistrictVillages[form.district] || []) : [];

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const snap = await getDoc(doc(db, "registrations", id));
        if (snap.exists()) {
          const data = snap.data();

          // ── Helper: convert any date value to YYYY-MM-DD string for <input type="date"> ──
          const toDateStr = (val) => {
            if (!val) return "";
            // Already YYYY-MM-DD string — use directly, no Date object needed
            const s = String(val).trim();
            if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
            // Firestore Timestamp
            if (val?.toDate) {
              const d = val.toDate();
              return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
            }
            // JS Date object
            if (val instanceof Date) {
              if (isNaN(val)) return "";
              return `${val.getFullYear()}-${String(val.getMonth()+1).padStart(2,"0")}-${String(val.getDate()).padStart(2,"0")}`;
            }
            // DD/MM/YYYY
            const dmy = s.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/);
            if (dmy) return `${dmy[3]}-${dmy[2].padStart(2,"0")}-${dmy[1].padStart(2,"0")}`;
            // MM/DD/YYYY
            const mdy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
            if (mdy) return `${mdy[3]}-${mdy[1].padStart(2,"0")}-${mdy[2].padStart(2,"0")}`;
            return "";
          };

          // ── 1. Normalise all date fields ──
          data.dateConferred       = toDateStr(data.dateConferred);
          data.dateOfficeReceived  = toDateStr(data.dateOfficeReceived);
          data.dateSavaliPublished = toDateStr(data.dateSavaliPublished);
          data.dateRegistration    = toDateStr(data.dateRegistration);
          data.dateIssued          = toDateStr(data.dateIssued) || (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; })();
          data.dateBirth           = toDateStr(data.dateBirth);
          data.objectionDate            = toDateStr(data.objectionDate);
          data.objectionApplicationDate = toDateStr(data.objectionApplicationDate);

          // ── 2. Cert number: parse combined string if parts missing ──
          if (!data.certItumalo && !data.certLaupepa && !data.certRegBook && data.mataiCertNumber) {
            const parts = String(data.mataiCertNumber).split("/");
            data.certItumalo = parts[0] || "";
            data.certLaupepa = parts[1] || "";
            data.certRegBook  = parts[2] || "";
          }
          // Ensure laupepa and regBook are strings; normalise certItumalo (strip leading zeros)
          data.certItumalo  = data.certItumalo  ? String(Number(data.certItumalo))  : "";
          data.certLaupepa  = data.certLaupepa  ? String(data.certLaupepa)          : "";
          data.certRegBook  = data.certRegBook  ? String(data.certRegBook)           : "";

          // ── 4. District: only derive from certItumalo if district not already stored ──
          if (!data.district && data.certItumalo) {
            data.district = DISTRICT_NUM[Number(data.certItumalo)] || "";
          }
          // Fallback: derive from village
          if (!data.district && data.village) {
            data.district = VILLAGE_TO_DISTRICT[data.village.trim().toUpperCase()] || "";
          }

          // ── 5. Village: match exact casing of dropdown options ──
          if (data.district && data.village) {
            const opts = DISTRICT_VILLAGES[data.district] || [];
            const match = opts.find(v => v.toLowerCase() === data.village.trim().toLowerCase());
            if (match) data.village = match;
          }

          // ── 6. Gender normalise ──
          const gRaw = (data.gender || "").toLowerCase().trim();
          if (gRaw === "tane" || gRaw === "male" || gRaw === "m") data.gender = "Tane";
          else if (gRaw === "fafine" || gRaw === "female" || gRaw === "tamaitai" || gRaw === "f") data.gender = "Tamaitai";

          // ── 7. mataiType normalise ──
          const tRaw = (data.mataiType || "").toLowerCase().replace(/[''']/g, "").trim();
          if (tRaw === "alii") data.mataiType = "Ali'i";
          else if (tRaw === "tulafale") data.mataiType = "Tulafale";

          // dateRegistration must only be set via Notifications confirm — never auto-filled
          // Old/backlogged records with past proclamation dates will appear in Notifications as overdue
          setForm({ ...EMPTY, ...data });
        }
      } catch { setError("Failed to load record."); }
      finally { setFetching(false); }
    })();
  }, [id]);

  // Reverse lookup: district name → number
  const districtNameToNum = (name) => {
    const entry = Object.entries(DISTRICT_NUM).find(([, n]) => n === name);
    return entry ? String(entry[0]) : "";
  };

  // Normalise certItumalo — strip leading zeros so "02" becomes "2"
  const normItumalo = (val) => (val === "" || val === null || val === undefined) ? "" : String(Number(val)) === "NaN" ? val : String(Number(val));

  const set = (field) => (e) => {
    const val = e.target.value;
    setForm(prev => {
      const updates = { ...prev, [field]: val };
      if (field === "district") {
        // District changed — clear village, normalise certItumalo from district
        updates.village = "";
        updates.certItumalo = normItumalo(districtNameToNum(val));
      } else if (field === "village" && val) {
        // Village changed — derive district, normalise certItumalo
        const derivedDistrict = VILLAGE_TO_DISTRICT[val.trim().toUpperCase()] || prev.district;
        updates.district = derivedDistrict;
        updates.certItumalo = normItumalo(districtNameToNum(derivedDistrict)) || prev.certItumalo;
      } else if (field === "certItumalo") {
        // certItumalo typed manually — normalise and keep district in sync
        updates.certItumalo = normItumalo(val);
      }
      return updates;
    });
  };

  // Check for duplicate Matai title OR cert number
  const checkDuplicate = async (title) => {
    if (!title.trim()) return;
    try {
      // Use cached records if available
      let allDocs = cacheGet("registrations");
      if (!allDocs) {
        const snap = await getDocs(collection(db, "registrations"));
        allDocs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        cacheSet("registrations", allDocs);
      }
      const existing = allDocs.filter(d => d.id !== id && d.mataiTitle === title.trim());
      if (existing.length > 0) {
        const rec = existing[0];
        setDupWarning(`⚠️ A registration for "${title}" already exists (holder: ${rec.holderName}, village: ${rec.village}). Please verify before proceeding.`);
      } else {
        setDupWarning("");
      }
    } catch { setDupWarning(""); }
  };

  // Check cert number uniqueness on blur
  const checkCertDuplicate = async () => {
    const certNum = [form.certItumalo, form.certLaupepa, form.certRegBook].filter(Boolean).join("/");
    if (!certNum || certNum.split("/").length < 3) return;
    try {
      // Use cached records if available — avoids a full Firestore read
      let allDocs = cacheGet("registrations");
      if (!allDocs) {
        const snap = await getDocs(collection(db, "registrations"));
        allDocs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        cacheSet("registrations", allDocs);
      }
      const existing = allDocs.filter(d => {
        if (d.id === id) return false;
        const storedCert = d.mataiCertNumber || [d.certItumalo, d.certLaupepa, d.certRegBook].filter(Boolean).join("/");
        return storedCert === certNum;
      });
      if (existing.length > 0) {
        const rec = existing[0];
        setDupWarning(`⚠️ Certificate number ${certNum} already exists on record: "${rec.mataiTitle}" (${rec.holderName}, ${rec.village}). Please check before saving.`);
        logAudit("DUPLICATE_WARNING", { certNumber: certNum, mataiTitle: form.mataiTitle, existingTitle: rec.mataiTitle });
      } else {
        setDupWarning(""); // clear warning if no conflict
      }
    } catch { /* ignore */ }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(""); setSuccess("");
    // Required fields validation
    const missing = [];
    if (!form.mataiTitle.trim())   missing.push("Matai Title (Suafa Matai)");
    if (!form.holderName.trim())   missing.push("Untitled Name (Igoa Taulealea)");
    if (!form.gender)              missing.push("Gender (Tane/Tamaitai)");
    if (!form.mataiType)           missing.push("Title Type (Ituaiga Suafa)");
    if (!form.district)            missing.push("District (Itumalo)");
    if (!form.village)             missing.push("Village (Nu'u)");
    if (!form.certItumalo && !form.certLaupepa && !form.certRegBook && !form.mataiCertNumber)
                                   missing.push("Matai Certificate Number");
    if (!form.certLaupepa?.trim()) missing.push("Numera ole Laupepa (Volume / Book Number)");
    if (!form.certRegBook?.trim()) missing.push("Registry Book Numbers (Entry Number)");
    if (!form.faapogai?.trim())    missing.push("Faapogai");
    if (!form.dateConferred && form.intention !== "yes") missing.push("Aso o le Saofai (Date of Conferral)");
    if (!form.nuuFanau)            missing.push("Nuu na Fanau ai (Village of Birth)");
    if (missing.length > 0) {
      setError("The following required fields are missing: " + missing.join(", ") + ".");
      return;
    }
    // Date of birth is required
    if (!form.dateBirth) {
      setError("Date of Birth (Aso Fanau) is required. The holder must be 21 years or older at the date of conferral.");
      return;
    }
    // Holder must be 21 or older as of the conferred date
    const ageCheck = validateAge(form.dateBirth, form.dateConferred);
    if (!ageCheck.valid) {
      const yrStr = ageCheck.age !== 1 ? "s" : "";
      setError("Holder must be at least 21 years old as of the Date of Conferral. Age at conferral: " + ageCheck.age + " year" + yrStr + ".");
      return;
    }
    // Published date must be after conferred date
    const publishedErr = validatePublishedDate(form.dateSavaliPublished, form.dateConferred, form.intention);
    if (publishedErr) { setError(publishedErr); return; }
    // Registration date order checks
    const regErr = validateRegistrationDate(form.dateRegistration, form.dateSavaliPublished, form.dateConferred);
    if (regErr) { setError(regErr); return; }
    // Block save if cert number mismatch
    if (certMismatch) {
      setError("Please correct the certificate Itumalo number — it does not match the selected district.");
      return;
    }
    // Block save if a cert number duplicate is detected
    if (dupWarning) {
      setError("Please resolve the duplicate certificate number warning before saving.");
      return;
    }
    setLoading(true);
    try {
      if (isEdit) {
        // Get old record for diff
        const oldSnap = await getDoc(doc(db, "registrations", id));
        const oldRec = oldSnap.exists() ? oldSnap.data() : {};
        const changes = diffRecords(oldRec, form);
        // Compose cert number from parts if all 3 set
      const certNum = [form.certItumalo, form.certLaupepa, form.certRegBook].filter(Boolean).join("/");
      // Never save an auto-calculated dateRegistration — only save if staff manually entered it
      const calcResult2 = calcRegDate(form.dateSavaliPublished);
      const isAutoCalc2 = calcResult2 && form.dateRegistration === calcResult2.dateStr;
      const finalRegDate2 = isAutoCalc2 ? "" : form.dateRegistration;
      const regPassed2 = finalRegDate2 && new Date(finalRegDate2 + "T00:00:00") <= new Date();
      const autoStatus = (regPassed2 && finalRegDate2) ? "completed" : "pending";
      const saveForm = { ...form, dateRegistration: finalRegDate2, mataiCertNumber: certNum || form.mataiCertNumber, status: autoStatus };
      await updateDoc(doc(db, "registrations", id), { ...saveForm, updatedAt: serverTimestamp() });
        await logAudit("UPDATE", {
          mataiTitle: form.mataiTitle,
          recordId: id,
          fieldsChanged: changes.length,
          changes: changes.join(" | ")
        });
        cacheClear("registrations");
        setSuccess("Registration updated successfully.");
      } else {
        const certNum = [form.certItumalo, form.certLaupepa, form.certRegBook].filter(Boolean).join("/");
        // Never save an auto-calculated dateRegistration — only save if staff manually entered it
        // Auto-calculated = matches the calcRegDate result; manual = staff typed something different
        const calcResult = calcRegDate(form.dateSavaliPublished);
        const isAutoCalc = calcResult && form.dateRegistration === calcResult.dateStr;
        const finalRegDate = isAutoCalc ? "" : form.dateRegistration;
        const regPassed = finalRegDate && new Date(finalRegDate + "T00:00:00") <= new Date();
        const autoStatus = (regPassed && finalRegDate) ? "completed" : "pending";
        const saveForm = { ...form, dateRegistration: finalRegDate, mataiCertNumber: certNum || form.mataiCertNumber, status: autoStatus };
        const docRef = await addDoc(collection(db, "registrations"), { ...saveForm, createdAt: serverTimestamp() });
        await logAudit("CREATE", { mataiTitle: form.mataiTitle, holderName: form.holderName, district: form.district, village: form.village });
        cacheClear("registrations");
        setSuccess("Title registered successfully.");
        // Never navigate to certificate on new entry — must be confirmed via Notifications
        setTimeout(() => navigate("/dashboard"), 1200);
      }
    } catch (err) {
      setError("Failed to save. Please try again.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const sectionHead = (title) => (
    <h3 className="section-head">◈ {title}</h3>
  );

  if (fetching) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", color: "var(--gold)", fontStyle: "italic" }}>Loading…</div>
  );

  const viewOnly = !perms.canEdit && isEdit; // view-only mode when no edit permission

  return (
    <div className="app-layout">
      <div className="pattern-bg" />
      <Sidebar userRole={userRole} userEmail={auth.currentUser?.email} />
      <div className="sidebar-content">

        <div className="fade-in" style={{ marginBottom: "2.5rem" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
            <div>
              <p className="page-eyebrow">{viewOnly ? "View Record" : isEdit ? "Edit Record" : "New Registration"}</p>
              <h2 className="page-title">{viewOnly ? "Matai Title Details" : isEdit ? "Update Matai Title" : "New Matai Entry"}</h2>
            </div>
            {isEdit && navRecords.length > 0 && (
              <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:"0.35rem", paddingTop:"0.5rem" }}>
                {/* Duplicate mode badge */}
                {isDupMode && (
                  <span style={{ fontFamily:"'Cinzel',serif", fontSize:"0.6rem", color:"#c0392b", background:"#fff5f5", border:"1px solid #fca5a5", borderRadius:"20px", padding:"1px 10px", letterSpacing:"0.06em" }}>
                    ⚠ Duplicate Group — Cert No. {dupCertNum}
                  </span>
                )}
                {/* Filtered view badge */}
                {isFiltered && !isDupMode && (
                  <span style={{ fontFamily:"'Cinzel',serif", fontSize:"0.6rem", color:"#1e40af", background:"#eff6ff", border:"1px solid #bfdbfe", borderRadius:"20px", padding:"1px 8px", letterSpacing:"0.06em" }}>
                    🔍 Filtered view — {navRecords.length} records
                  </span>
                )}
                <div style={{ display:"flex", alignItems:"center", gap:"0.5rem" }}>
                  {/* Back to duplicates button */}
                  {isDupMode && (
                    <button
                      onClick={() => navigate(backTo, { state: { tab: backTab } })}
                      style={{ padding:"0.5rem 0.9rem", fontFamily:"'Cinzel',serif", fontSize:"0.68rem", letterSpacing:"0.08em", textTransform:"uppercase", background:"#fff5f5", border:"1px solid #fca5a5", color:"#c0392b", borderRadius:"3px", cursor:"pointer" }}>
                      ✕ Close
                    </button>
                  )}
                  <button
                    onClick={() => prevRecord && navigate(`/register/${prevRecord.id}`, { state: location.state })}
                    disabled={!prevRecord}
                    title={prevRecord ? `← ${prevRecord.mataiTitle}` : "No previous record"}
                    style={{ padding:"0.5rem 0.9rem", fontFamily:"'Cinzel',serif", fontSize:"0.68rem", letterSpacing:"0.08em", textTransform:"uppercase", background: prevRecord ? (isDupMode ? "#fff5f5" : "#f0faf4") : "#f9fafb", border:`1px solid ${prevRecord ? (isDupMode ? "#fca5a5" : "#a7d7b8") : "#e5e7eb"}`, color: prevRecord ? (isDupMode ? "#c0392b" : "#1e6b3c") : "#9ca3af", borderRadius:"3px", cursor: prevRecord ? "pointer" : "not-allowed" }}>
                    ← Prev
                  </button>
                  <span style={{ fontFamily:"'Cinzel',serif", fontSize:"0.65rem", color: isDupMode ? "#c0392b" : "rgba(26,26,26,0.4)", letterSpacing:"0.05em", whiteSpace:"nowrap" }}>
                    {currentIndex + 1} / {navRecords.length}
                  </span>
                  <button
                    onClick={() => nextRecord && navigate(`/register/${nextRecord.id}`, { state: location.state })}
                    disabled={!nextRecord}
                    title={nextRecord ? `${nextRecord.mataiTitle} →` : "No next record"}
                    style={{ padding:"0.5rem 0.9rem", fontFamily:"'Cinzel',serif", fontSize:"0.68rem", letterSpacing:"0.08em", textTransform:"uppercase", background: nextRecord ? (isDupMode ? "#fff5f5" : "#f0faf4") : "#f9fafb", border:`1px solid ${nextRecord ? (isDupMode ? "#fca5a5" : "#a7d7b8") : "#e5e7eb"}`, color: nextRecord ? (isDupMode ? "#c0392b" : "#1e6b3c") : "#9ca3af", borderRadius:"3px", cursor: nextRecord ? "pointer" : "not-allowed" }}>
                    Next →
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {viewOnly && (
          <div style={{ background:"#f0f9ff", border:"1px solid #bae6fd", borderLeft:"4px solid #0284c7", borderRadius:"4px", padding:"0.75rem 1.25rem", marginBottom:"1.5rem", display:"flex", alignItems:"center", gap:"0.75rem" }}>
            <span style={{ fontSize:"1rem" }}>👁</span>
            <p style={{ fontSize:"0.85rem", color:"#0369a1", fontFamily:"'Cinzel',serif", letterSpacing:"0.06em" }}>View Only — you do not have permission to edit this record.</p>
          </div>
        )}

        {error && <div className="alert alert-error" style={{ marginBottom: "1.5rem" }}>{error}</div>}
        {success && <div className="alert alert-success" style={{ marginBottom: "1.5rem" }}>{success}</div>}
        {dupWarning && <div className="alert alert-error" style={{ marginBottom: "1.5rem" }}>{dupWarning}</div>}

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
        <fieldset disabled={viewOnly} style={{ border:"none", padding:0, margin:0 }}>

          {/* ── Title & Holder ── */}
          <div className="card fade-in-delay-1">
            {sectionHead("Title & Holder")}
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"1.2rem" }}>
              <div className="form-group" style={{ gridColumn:"1 / -1" }}>
                <label>Matai Title (Suafa Matai) *</label>
                <input type="text" required value={form.mataiTitle}
                  onChange={set("mataiTitle")} onBlur={e => checkDuplicate(e.target.value)}
                  placeholder="e.g. Faleolo, Tupua, Malietoa…" />
              </div>
              <div className="form-group">
                <label>Untitled Name (Igoa Taulealea) *</label>
                <input type="text" required value={form.holderName} onChange={set("holderName")}
                  placeholder="Full name of person receiving the title" />
              </div>
              <div className="form-group">
                <label>Gender (Tane/Tamaitai) <span style={{ color:"#c0392b", fontWeight:700 }}>*</span></label>
                <select value={form.gender} onChange={set("gender")}>
                  <option value="">— Select —</option>
                  <option value="Tane">Tane (Male)</option>
                  <option value="Tamaitai">Tamaitai (Female)</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div className="form-group">
                <label>Title Type (Ituaiga Suafa) <span style={{ color:"#c0392b", fontWeight:700 }}>*</span></label>
                <select value={form.mataiType} onChange={set("mataiType")}>
                  {MATAI_TYPES.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* ── Village & District ── */}
          <div className="card fade-in-delay-2">
            {sectionHead("Village & District (of New Title)")}
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"1.2rem" }}>
              <div className="form-group">
                <label>District (Itūmālō) <span style={{ color:"#c0392b", fontWeight:700 }}>*</span></label>
                <select value={form.district} onChange={set("district")}>
                  <option value="">— Select District —</option>
                  {activeDistrictOptions.map(({ num, name }) => (
                    <option key={num} value={name}>{num} – {name}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Village (Nu'u e Patino iai le Suafa Matai) <span style={{ color:"#c0392b", fontWeight:700 }}>*</span></label>
                <select value={form.village} onChange={set("village")} disabled={!form.district}>
                  <option value="">— Select Village —</option>
                  {villages.map(v => <option key={v}>{v}</option>)}
                </select>
              </div>
            </div>
            {!form.district && (
              <p style={{ fontSize:"0.8rem", color:"rgba(45,122,79,0.6)", fontStyle:"italic", marginTop:"0.5rem" }}>
                Select a district first to see its villages
              </p>
            )}
          </div>

          {/* ── Other Matai Title ── */}
          <div className="card fade-in-delay-2">
            {sectionHead("Other Matai Title (for Records)")}
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"1.2rem" }}>
              <div className="form-group">
                <label>Other Matai Title (Isi Suafa Matai)</label>
                <input type="text" value={form.familyTitles || ""} onChange={set("familyTitles")}
                  placeholder="Other Matai title this person holds" />
              </div>
              <div className="form-group">
                <label>Village of Other Title (Nu'u o loo Matai ai)</label>
                <input type="text" value={form.nuuMataiAi || ""} onChange={set("nuuMataiAi")}
                  placeholder="Village where the other title is held" />
              </div>
            </div>
          </div>

          {/* ── Certificate Numbers ── */}
          <div className="card fade-in-delay-2">
            {sectionHead("Certificate Numbers")}
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:"1.5rem", alignItems:"start" }}>

              {/* Itumalo */}
              <div className="form-group" style={{ margin:0 }}>
                <label style={{ display:"block", marginBottom:"0.4rem" }}>
                  Numera o le Itumalo <span style={{ color:"#c0392b", fontWeight:700 }}>*</span>
                  <span style={{ display:"block", fontSize:"0.68rem", color:"#9ca3af", fontWeight:400, letterSpacing:"0.03em", marginTop:"2px" }}>Auto-set from District</span>
                </label>
                <input type="number" min="1" max="41" value={form.certItumalo} onChange={set("certItumalo")}
                  placeholder="e.g. 1"
                  style={{ width:"100%", boxSizing:"border-box",
                    borderColor: certMismatch ? "#c0392b" : form.certItumalo ? "#155c31" : undefined,
                    background: certMismatch ? "#fff5f5" : undefined }} />
                {form.certItumalo && DISTRICT_NUM[Number(form.certItumalo)] && !certMismatch && (
                  <p style={{ fontSize:"0.72rem", color:"#155c31", marginTop:"5px", fontStyle:"italic", letterSpacing:"0.03em" }}>
                    ✓ {DISTRICT_NUM[Number(form.certItumalo)]}
                  </p>
                )}
                {certMismatch && (
                  <p style={{ fontSize:"0.7rem", color:"#c0392b", marginTop:"5px", lineHeight:1.4 }}>{certMismatch}</p>
                )}
              </div>

              {/* Laupepa */}
              <div className="form-group" style={{ margin:0 }}>
                <label style={{ display:"block", marginBottom:"0.4rem" }}>
                  Numera ole Laupepa <span style={{ color:"#c0392b", fontWeight:700 }}>*</span>
                  <span style={{ display:"block", fontSize:"0.68rem", color:"#9ca3af", fontWeight:400, letterSpacing:"0.03em", marginTop:"2px" }}>Volume / Book number</span>
                </label>
                <input type="text" inputMode="numeric" value={form.certLaupepa}
                  onKeyDown={e => { if (!/[0-9]/.test(e.key) && !["Backspace","Delete","ArrowLeft","ArrowRight","Tab","Enter"].includes(e.key)) e.preventDefault(); }}
                  onChange={e => setForm(f => ({ ...f, certLaupepa: e.target.value.replace(/[^0-9]/g,"") }))}
                  placeholder="e.g. 12"
                  style={{ width:"100%", boxSizing:"border-box", ...(!form.certLaupepa ? { borderColor:"#c0392b", background:"#fff5f5" } : {}) }} />
                {!form.certLaupepa
                  ? <p style={{ fontSize:"0.72rem", color:"#c0392b", marginTop:"4px" }}>✗ Required — numbers only</p>
                  : !/^\d+$/.test(String(form.certLaupepa))
                    ? <p style={{ fontSize:"0.72rem", color:"#c0392b", marginTop:"4px" }}>✗ Numbers only — no letters or symbols</p>
                    : null}
              </div>

              {/* Registry Book */}
              <div className="form-group" style={{ margin:0 }}>
                <label style={{ display:"block", marginBottom:"0.4rem" }}>
                  Registry Book Numbers <span style={{ color:"#c0392b", fontWeight:700 }}>*</span>
                  <span style={{ display:"block", fontSize:"0.68rem", color:"#9ca3af", fontWeight:400, letterSpacing:"0.03em", marginTop:"2px" }}>Entry number</span>
                </label>
                <input type="text" inputMode="numeric" value={form.certRegBook}
                  onKeyDown={e => { if (!/[0-9]/.test(e.key) && !["Backspace","Delete","ArrowLeft","ArrowRight","Tab","Enter"].includes(e.key)) e.preventDefault(); }}
                  onChange={e => setForm(f => ({ ...f, certRegBook: e.target.value.replace(/[^0-9]/g,"") }))}
                  onBlur={checkCertDuplicate}
                  placeholder="e.g. 1234"
                  style={{ width:"100%", boxSizing:"border-box", ...(!form.certRegBook ? { borderColor:"#c0392b", background:"#fff5f5" } : {}) }} />
                {!form.certRegBook
                  ? <p style={{ fontSize:"0.72rem", color:"#c0392b", marginTop:"4px" }}>✗ Required — numbers only</p>
                  : !/^\d+$/.test(String(form.certRegBook))
                    ? <p style={{ fontSize:"0.72rem", color:"#c0392b", marginTop:"4px" }}>✗ Numbers only — no letters or symbols</p>
                    : null}
              </div>
            </div>

            {/* Composed cert number preview */}
            {(form.certItumalo || form.certLaupepa || form.certRegBook) && (
              <div style={{ marginTop:"1.25rem", padding:"0.75rem 1.25rem", background:"#e8f5ed", borderRadius:"6px", border:"1px solid #c3e6cb", display:"flex", alignItems:"center", gap:"1rem" }}>
                <span style={{ fontSize:"0.68rem", fontFamily:"'Cinzel',serif", letterSpacing:"0.12em", textTransform:"uppercase", color:"#6b7280" }}>Certificate Number</span>
                <strong style={{ fontFamily:"'Cinzel',serif", fontSize:"1rem", color:"#155c31", letterSpacing:"0.08em" }}>
                  {[form.certItumalo, form.certLaupepa, form.certRegBook].filter(Boolean).join(" / ")}
                </strong>
              </div>
            )}
          </div>

          {/* ── Intention ── */}
          <div className="card fade-in-delay-2">
            {sectionHead("Intention (Fa'amoemoe)")}
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"1.2rem" }}>
              <div className="form-group">
                <label>Intention Filed? <span style={{ fontSize:"0.78rem", color:"#6b7280", fontWeight:400 }}>(default: No)</span></label>
                <select value={form.intention} onChange={e => setForm(f => ({ ...f, intention: e.target.value }))}>
                  <option value="no">No — Standard process</option>
                  <option value="yes">Yes — Intention filed before Saofai</option>
                </select>
              </div>
            </div>
            {form.intention === "yes" && (
              <div style={{ marginTop:"0.75rem", padding:"0.75rem 1rem", background:"#eff6ff", border:"1px solid #bfdbfe", borderRadius:"4px" }}>
                <p style={{ fontSize:"0.85rem", color:"#1e40af", fontWeight:600 }}>
                  ℹ Intention process: Savali is published <strong>before</strong> Saofai. The publication period must be at least 4 months. If no objection, Saofai proceeds, then the title is registered and certificate can be printed.
                </p>
              </div>
            )}
          </div>

          {/* ── Important Dates ── */}
          {(() => {
            const publishedErr = validatePublishedDate(form.dateSavaliPublished, form.dateConferred, form.intention);
            const regErr       = validateRegistrationDate(form.dateRegistration, form.dateSavaliPublished, form.dateConferred);
            const ageResult    = validateAge(form.dateBirth, form.dateConferred);
            const ageErr       = form.dateBirth && !ageResult.valid
              ? `Holder is ${ageResult.age} year${ageResult.age !== 1 ? "s" : ""} old at conferral date — must be 21 or older`
              : null;
            const hasDateErrors = !!(publishedErr || regErr || ageErr);
            const calc   = calcRegDate(form.dateSavaliPublished);
            const isAuto = calc && form.dateRegistration === calc.dateStr;
            const errStyle  = { borderColor:"#c0392b", background:"#fff5f5" };
            const autoStyle = { borderColor:"#fcd34d", background:"#fffbeb" };
            return (
          <div className="card fade-in-delay-2">
            {sectionHead("Important Dates")}
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"1.2rem" }}>
              <div className="form-group">
                <label>Aso o le Saofai (Date of Conferral) {form.intention !== "yes" && <span style={{ color:"#c0392b", fontWeight:700 }}>*</span>}</label>
                <input type="date" value={form.dateConferred} onChange={set("dateConferred")}
                  style={!form.dateConferred && form.intention !== "yes" ? errStyle : {}} />
                {!form.dateConferred && form.intention !== "yes" && (
                  <p style={{ fontSize:"0.72rem", color:"#c0392b", marginTop:"4px" }}>✗ Date of Conferral is required</p>
                )}
                {form.intention === "yes" && (
                  <p style={{ fontSize:"0.72rem", color:"#1e40af", marginTop:"4px", fontStyle:"italic" }}>
                    ⓘ For Intention process — Saofai date can be added after publication period
                  </p>
                )}
              </div>
              <div className="form-group">
                <label>Aso tauaaoina ai e le ofisa (Office Date Received)</label>
                <input type="date" value={form.dateOfficeReceived || ""} onChange={set("dateOfficeReceived")} />
                <p style={{ fontSize:"0.72rem", color:"#6b7280", marginTop:"4px", fontStyle:"italic" }}>
                  ⓘ Date the office received the application after Saofai
                </p>
              </div>
              <div className="form-group">
                <label>Aso o le Faasalalauga (Savali Published Date){form.intention === "yes" ? " — must be BEFORE Saofai date (Intention process)" : ""}</label>
                <input type="date" value={form.dateSavaliPublished}
                  onChange={e => setForm(f => ({ ...f, dateSavaliPublished: e.target.value }))}
                  style={publishedErr ? errStyle : {}} />
                {publishedErr && (
                  <p style={{ fontSize:"0.72rem", color:"#c0392b", marginTop:"4px" }}>✗ {publishedErr}</p>
                )}
              </div>
              <div className="form-group">
                <label>Aso na Resitala ai (Date of Registration)</label>
                <input type="date" value={form.dateRegistration} onChange={set("dateRegistration")}
                  style={isAuto ? autoStyle : (regErr ? errStyle : {})} />
                {isAuto && (
                  <p style={{ fontSize:"0.72rem", color:"#92400e", marginTop:"4px", fontStyle:"italic" }}>
                    ⚠ Auto-calculated — will not be saved until confirmed in Notifications
                  </p>
                )}
                {!isAuto && regErr && (
                  <p style={{ fontSize:"0.72rem", color:"#c0392b", marginTop:"4px" }}>✗ {regErr}</p>
                )}
              </div>
              <div className="form-group">
                <label>Date Issued (Aso Tuuina Mai)</label>
                <input type="date" value={form.dateIssued} readOnly disabled
                  style={{ background:"#f3f4f6", color:"#6b7280", cursor:"not-allowed", borderColor:"#e5e7eb" }} />
                <p style={{ fontSize:"0.72rem", color:"#6b7280", marginTop:"4px", fontStyle:"italic" }}>
                  ⓘ Auto-set to today's date — cannot be edited
                </p>
              </div>
              <div className="form-group">
                <label>Aso Fanau (Date of Birth) <span style={{ color:"#c0392b", fontWeight:700 }}>*</span></label>
                <input type="date" value={form.dateBirth || ""} onChange={set("dateBirth")}
                  style={!form.dateBirth || ageErr ? errStyle : {}} />
                {ageErr && (
                  <p style={{ fontSize:"0.72rem", color:"#c0392b", marginTop:"4px" }}>✗ {ageErr}</p>
                )}
                {!form.dateBirth && (
                  <p style={{ fontSize:"0.72rem", color:"#c0392b", marginTop:"4px" }}>✗ Date of birth is required</p>
                )}
              </div>
              <div className="form-group">
                <label>Nuu na Fanau ai (Village of Birth) <span style={{ color:"#c0392b", fontWeight:700 }}>*</span></label>
                <input type="text" value={form.nuuFanau || ""} onChange={set("nuuFanau")}
                  placeholder="Village where holder was born" />
              </div>
            </div>
            {hasDateErrors && (
              <div style={{ marginTop:"1rem", padding:"0.75rem 1rem", background:"#fef2f2", border:"1px solid #fca5a5", borderRadius:"4px" }}>
                <p style={{ fontSize:"0.85rem", color:"#8b1a1a", fontWeight:600 }}>
                  ⚠ Please fix the date errors above before saving.
                </p>
              </div>
            )}
          </div>
            );
          })()}

          {/* ── Faapogai & Notes ── */}
          <div className="card fade-in-delay-3">
            {sectionHead("Faapogai & Notes")}
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"1.2rem" }}>
              <div className="form-group">
                <label>Faapogai <span style={{ color:"#c0392b", fontWeight:700 }}>*</span></label>
                <input type="text" value={form.faapogai} onChange={set("faapogai")}
                  placeholder="e.g. SULI" />
              </div>
              <div className="form-group">
                <label>Isi Faamatalaga (Notes)</label>
                <textarea rows={3} value={form.notes} onChange={set("notes")}
                  placeholder="Any additional notes…" style={{ resize:"vertical" }} />
              </div>
            </div>
          </div>

          {/* ── Photo Identification ── */}
          <div className="card fade-in-delay-3">
            {sectionHead("Photo Identification")}
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"1.2rem" }}>
              <div className="form-group">
                <label>ID Type</label>
                <select value={form.photoIdType} onChange={set("photoIdType")}>
                  <option value="">— Select —</option>
                  <option value="passport">Passport</option>
                  <option value="drivers_licence">Driver's Licence</option>
                </select>
              </div>
              <div className="form-group">
                <label>ID Number</label>
                <input type="text" value={form.photoIdNumber} onChange={set("photoIdNumber")}
                  placeholder="Enter ID number" />
              </div>
              <div className="form-group" style={{ gridColumn:"1/-1" }}>
                <label>Upload ID Image</label>
                <input type="file" accept="image/*" onChange={handleIdImageUpload}
                  style={{ fontSize:"0.88rem" }} />
                {form.photoIdImage && (
                  <div style={{ marginTop:"0.75rem" }}>
                    <img src={form.photoIdImage} alt="ID preview"
                      style={{ maxWidth:"220px", maxHeight:"140px", objectFit:"contain", border:"1px solid #c3e6cb", borderRadius:"4px", padding:"4px" }} />
                    <button type="button" onClick={() => setForm(f => ({ ...f, photoIdImage:"" }))}
                      style={{ display:"block", marginTop:"0.4rem", fontSize:"0.75rem", color:"#8b1a1a", background:"none", border:"none", cursor:"pointer" }}>
                      ✕ Remove image
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── Objection ── */}
          <div className="card fade-in-delay-3">
            {sectionHead("Objection (Savali Publication Period)")}
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"1.2rem" }}>
              <div className="form-group">
                <label>Objection Filed?</label>
                <select value={form.objection} onChange={e => {
                  const val = e.target.value;
                  const autoReg = val === "no" ? autoRegDate(form.dateSavaliPublished) : "";
                  setForm(f => ({ ...f, objection: val, objectionDate: val === "yes" ? today : "", dateRegistration: f.dateRegistration !== "" ? f.dateRegistration : autoReg }));
                }}>
                  <option value="no">No — No objection</option>
                  <option value="yes">Yes — Objection filed</option>
                </select>
              </div>
              {form.objection === "yes" && (
                <div className="form-group">
                  <label>Date Objection Filed</label>
                  <input type="date" value={form.objectionDate} onChange={set("objectionDate")} />
                </div>
              )}
            </div>
            {form.objection === "yes" && (<>
              <div style={{ marginTop:"1rem", display:"grid", gridTemplateColumns:"1fr 1fr", gap:"1.2rem" }}>
                <div className="form-group">
                  <label>Aso faaulu ai le talosaga (Date Application Filed)</label>
                  <input type="date" value={form.objectionApplicationDate || ""} onChange={set("objectionApplicationDate")} />
                </div>
                <div className="form-group">
                  <label>Suafa o le na faaulua le talosaga (Name of Applicant)</label>
                  <input type="text" value={form.objectionApplicantName || ""} onChange={set("objectionApplicantName")}
                    placeholder="Name of person who filed the objection" />
                </div>
                <div className="form-group">
                  <label>Suafa o le sui resitala (Acting Registrar)</label>
                  <input type="text" value={form.objectionActingRegistrar || ""} onChange={set("objectionActingRegistrar")}
                    placeholder="Name of acting registrar" />
                </div>
                <div className="form-group">
                  <label>File #</label>
                  <input type="text" value={form.objectionFileNumber || ""} onChange={set("objectionFileNumber")}
                    placeholder="File number" />
                </div>
                <div className="form-group">
                  <label>LC # — Faaiuga Faamasinoga (Court Decision)</label>
                  <input type="text" value={form.objectionLCNumber || ""} onChange={set("objectionLCNumber")}
                    placeholder="LC number / Court decision reference" />
                </div>
              </div>
              <div style={{ marginTop:"0.75rem", padding:"0.75rem 1rem", background:"#fef2f2", border:"1px solid #fca5a5", borderRadius:"4px" }}>
                <p style={{ fontSize:"0.85rem", color:"#8b1a1a", fontWeight:600 }}>
                  ⚠ Objection filed — this title cannot be registered until resolved through court.
                </p>
              </div>
            </>)}
            {form.objection === "no" && form.dateSavaliPublished && (() => {
              const hint = regDateHint(form.dateSavaliPublished);
              if (!hint) return null;
              return hint.isPast ? (
                <div style={{ marginTop:"0.75rem", padding:"0.75rem 1rem", background:"#fef3c7", border:"1px solid #fcd34d", borderRadius:"4px" }}>
                  <p style={{ fontSize:"0.85rem", color:"#92400e" }}>
                    ⚠ Savali publication period has passed — expected registration date was <strong>{hint.display}</strong>. This record will appear in <strong>Notifications → Ready to Register</strong> as overdue and must be confirmed before the certificate is available.
                  </p>
                </div>
              ) : (
                <div style={{ marginTop:"0.75rem", padding:"0.75rem 1rem", background:"#fff8e1", border:"1px solid #ffe082", borderRadius:"4px" }}>
                  <p style={{ fontSize:"0.85rem", color:"#7a5c00" }}>
                    ⏳ Savali publication period not yet complete — expected registration date is <strong>{hint.display}</strong>. This record will appear in <strong>Notifications → Ready to Register</strong> once that date has passed for staff to confirm.
                  </p>
                </div>
              );
            })()}
          </div>

          <div className="fade-in-delay-4" style={{ display: "flex", gap: "1rem", justifyContent: "flex-end", flexWrap: "wrap", alignItems: "center" }}>
            {isDupMode
              ? <button type="button" className="btn-secondary" onClick={() => navigate(backTo, { state: { tab: backTab } })}>← Back to Duplicates</button>
              : <Link to="/dashboard"><button type="button" className="btn-secondary">{ viewOnly ? "Back" : "Cancel" }</button></Link>
            }
            {!viewOnly && (() => {
                const _pubErr = validatePublishedDate(form.dateSavaliPublished, form.dateConferred, form.intention);
                const _regErr = validateRegistrationDate(form.dateRegistration, form.dateSavaliPublished, form.dateConferred);
                const _ageRes = validateAge(form.dateBirth, form.dateConferred);
                const _ageErr = form.dateBirth && !_ageRes.valid
                  ? `Holder is ${_ageRes.age} year${_ageRes.age !== 1 ? "s" : ""} old at conferral — must be 21+`
                  : null;
                const _certErr = (!form.certLaupepa || !/^\d+$/.test(String(form.certLaupepa))) ||
                                 (!form.certRegBook  || !/^\d+$/.test(String(form.certRegBook)));
                const _hasErrors = !!(_pubErr || _regErr || _ageErr || _certErr);
                return (
                  <>
                    {_hasErrors && (
                      <p style={{ fontSize:"0.78rem", color:"#c0392b", margin:0, fontStyle:"italic" }}>
                        ⚠ {_certErr && !(_pubErr||_regErr||_ageErr) ? "Laupepa & Registry Book numbers are required" : "Fix errors before saving"}
                      </p>
                    )}
                    <button type="submit" className="btn-primary"
                      disabled={loading || _hasErrors}
                      title={_hasErrors ? "Fix all errors before saving" : ""}
                      style={_hasErrors ? { opacity:0.5, cursor:"not-allowed" } : {}}>
                      {loading ? "Saving…" : isEdit ? "Update Registration" : "Register & Generate Certificate"}
                    </button>
                  </>
                );
              })()}
          </div>
          </fieldset>
        </form>
      </div>
    </div>
  );
}

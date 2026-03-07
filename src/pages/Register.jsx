import { useState, useEffect } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { signOut } from "firebase/auth";
import { collection, addDoc, doc, getDoc, updateDoc, serverTimestamp, getDocs, query, where } from "firebase/firestore";
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
  "ANOAMAA SISIFO": ['Eva', 'Leusoalii', 'Luatuanuu', 'Salelesi', 'Saoluafata', 'Solosolo'],
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
  "LOTOFAGA": ['Matautu', 'Vavau'],
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
  "VAIMAUGA SISIFO": ['Alamagoto', 'Apia', 'Magiagi', 'Moataa', 'Tanugamanono', 'Vaiala', 'Vailima'],
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
  dateConferred: "",    // Aso o le Saofai
  dateProclamation: "", // Aso o le Faasalalauga
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
};

export default function Register({ userRole }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [form, setForm] = useState(EMPTY);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(!!id);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [dupWarning, setDupWarning] = useState("");
  const [districtVillagesFS, setDistrictVillagesFS] = useState(null);
  const isEdit = !!id;
  const perms = getPermissions(userRole);
  const today = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; })();

  // Auto-set dateRegistration when objection=no and dateProclamation is set
  const autoRegDate = (proclamation) => {
    if (!proclamation) return "";
    const d = new Date(proclamation + "T00:00:00");
    const day = d.getDate(); // preserve proclamation day
    d.setDate(1); // move to 1st to avoid month-overflow
    d.setMonth(d.getMonth() + 4);
    // clamp day to last day of target month
    const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    d.setDate(Math.min(day, lastDay));
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  };

  const formatDisplayDate = (dateStr) => {
    if (!dateStr) return "";
    const [y, m, day] = dateStr.split("-");
    const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    return `${parseInt(day)} ${months[parseInt(m)-1]} ${y}`;
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
    .map((name, i) => ({ num: i + 1, name }));
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
          data.dateConferred    = toDateStr(data.dateConferred);
          data.dateProclamation = toDateStr(data.dateProclamation);
          data.dateRegistration = toDateStr(data.dateRegistration);
          data.dateIssued       = toDateStr(data.dateIssued) || (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; })();
          data.dateBirth        = toDateStr(data.dateBirth);
          data.objectionDate    = toDateStr(data.objectionDate);

          // ── 2. Cert number: parse combined string if parts missing ──
          if (!data.certItumalo && !data.certLaupepa && !data.certRegBook && data.mataiCertNumber) {
            const parts = String(data.mataiCertNumber).split("/");
            data.certItumalo = parts[0] || "";
            data.certLaupepa = parts[1] || "";
            data.certRegBook  = parts[2] || "";
          }
          // Ensure laupepa and regBook are strings
          data.certLaupepa = data.certLaupepa ? String(data.certLaupepa) : "";
          data.certRegBook  = data.certRegBook  ? String(data.certRegBook)  : "";

          // ── 4. District: derive from certItumalo number ──
          if (data.certItumalo) {
            data.district = DISTRICT_NUM[Number(data.certItumalo)] || data.district || "";
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

  const set = (field) => (e) => {
    const val = e.target.value;
    setForm(prev => ({
      ...prev,
      [field]: val,
      ...(field === "district" ? {
        village: "",
        certItumalo: districtNameToNum(val)
      } : {})
    }));
  };

  // Check for duplicate Matai title
  const checkDuplicate = async (title) => {
    if (!title.trim()) return;
    try {
      const q = query(collection(db, "registrations"), where("mataiTitle", "==", title.trim()));
      const snap = await getDocs(q);
      const existing = snap.docs.filter(d => d.id !== id);
      if (existing.length > 0) {
        const rec = existing[0].data();
        setDupWarning(`⚠️ A registration for "${title}" already exists (holder: ${rec.holderName}). Please verify before proceeding.`);
      } else {
        setDupWarning("");
      }
    } catch { setDupWarning(""); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(""); setSuccess("");
    if (!form.mataiTitle.trim() || !form.holderName.trim()) {
      setError("Matai Title (Suafa Matai) and Untitled Name (Suafa Taulealea) are required.");
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
      const autoStatus = form.dateRegistration ? "completed" : "pending";
      const saveForm = { ...form, mataiCertNumber: certNum || form.mataiCertNumber, status: autoStatus };
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
        const autoStatus = form.dateRegistration ? "completed" : "pending";
        const saveForm = { ...form, mataiCertNumber: certNum || form.mataiCertNumber, status: autoStatus };
        const docRef = await addDoc(collection(db, "registrations"), { ...saveForm, createdAt: serverTimestamp() });
        await logAudit("CREATE", { mataiTitle: form.mataiTitle, holderName: form.holderName, district: form.district, village: form.village });
        cacheClear("registrations");
        setSuccess("Title registered successfully.");
        setTimeout(() => navigate(`/certificate/${docRef.id}`), 1200);
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

  return (
    <div className="app-layout">
      <div className="pattern-bg" />
      <Sidebar userRole={userRole} userEmail={auth.currentUser?.email} />
      <div className="sidebar-content">

        <div className="fade-in" style={{ marginBottom: "2.5rem" }}>
          <p className="page-eyebrow">{isEdit ? "Edit Record" : "New Registration"}</p>
          <h2 className="page-title">{isEdit ? "Update Matai Title" : "Register Matai Title"}</h2>
        </div>

        {error && <div className="alert alert-error" style={{ marginBottom: "1.5rem" }}>{error}</div>}
        {success && <div className="alert alert-success" style={{ marginBottom: "1.5rem" }}>{success}</div>}
        {dupWarning && <div className="alert alert-error" style={{ marginBottom: "1.5rem" }}>{dupWarning}</div>}

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>

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
                <label>Gender (Tane/Tamaitai)</label>
                <select value={form.gender} onChange={set("gender")}>
                  <option value="">— Select —</option>
                  <option value="Tane">Tane (Male)</option>
                  <option value="Tamaitai">Tamaitai (Female)</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div className="form-group">
                <label>Title Type (Ituaiga Suafa)</label>
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
                <label>District (Itūmālō)</label>
                <select value={form.district} onChange={set("district")}>
                  <option value="">— Select District —</option>
                  {activeDistrictOptions.map(({ num, name }) => (
                    <option key={num} value={name}>{num} – {name}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Village (Nu'u e Patino iai le Suafa Matai)</label>
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
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:"1.2rem" }}>
              <div className="form-group">
                <label>Numera o le Itumalo</label>
                <input type="number" min="1" max="41" value={form.certItumalo} onChange={set("certItumalo")}
                  placeholder="1–41" />
                {form.certItumalo && DISTRICT_NUM[Number(form.certItumalo)] && (
                  <p style={{ fontSize:"0.75rem", color:"#155c31", marginTop:"4px", fontStyle:"italic" }}>
                    {DISTRICT_NUM[Number(form.certItumalo)]}
                  </p>
                )}
              </div>
              <div className="form-group">
                <label>Numera ole Laupepa</label>
                <input type="text" value={form.certLaupepa} onChange={set("certLaupepa")}
                  placeholder="Volume / Book number" />
              </div>
              <div className="form-group">
                <label>Registry Book Numbers</label>
                <input type="text" value={form.certRegBook} onChange={set("certRegBook")}
                  placeholder="Entry number" />
              </div>
            </div>
            {(form.certItumalo || form.certLaupepa || form.certRegBook) && (
              <div style={{ marginTop:"0.75rem", padding:"0.6rem 1rem", background:"#e8f5ed", borderRadius:"4px", border:"1px solid #c3e6cb" }}>
                <p style={{ fontFamily:"'Cinzel',serif", fontSize:"0.72rem", color:"#155c31", letterSpacing:"0.1em" }}>
                  Certificate Number: <strong style={{ fontSize:"0.88rem" }}>
                    {[form.certItumalo, form.certLaupepa, form.certRegBook].filter(Boolean).join("/")}
                  </strong>
                </p>
              </div>
            )}
          </div>

          {/* ── Important Dates ── */}
          <div className="card fade-in-delay-2">
            {sectionHead("Important Dates")}
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"1.2rem" }}>
              <div className="form-group">
                <label>Aso o le Saofai (Date of Conferral)</label>
                <input type="date" value={form.dateConferred} onChange={set("dateConferred")} />
              </div>
              <div className="form-group">
                <label>Aso o le Faasalalauga (Date of Proclamation)</label>
                <input type="date" value={form.dateProclamation} onChange={e => {
                  const val = e.target.value;
                  setForm(f => ({
                    ...f,
                    dateProclamation: val,
                    dateRegistration: f.objection === "no" ? autoRegDate(val) : f.dateRegistration
                  }));
                }} />
              </div>
              <div className="form-group">
                <label>Aso na Resitala ai (Date of Registration)</label>
                <input type="date" value={form.dateRegistration} onChange={set("dateRegistration")} />
              </div>
              <div className="form-group">
                <label>Date Issued (Aso Tuuina Mai)</label>
                <input type="date" value={form.dateIssued} onChange={set("dateIssued")} />
              </div>
              <div className="form-group">
                <label>Aso Fanau (Date of Birth)</label>
                <input type="date" value={form.dateBirth || ""} onChange={set("dateBirth")} />
              </div>
              <div className="form-group">
                <label>Nuu na Fanau ai (Village of Birth)</label>
                <input type="text" value={form.nuuFanau || ""} onChange={set("nuuFanau")}
                  placeholder="Village where holder was born" />
              </div>
            </div>
          </div>

          {/* ── Faapogai & Notes ── */}
          <div className="card fade-in-delay-3">
            {sectionHead("Faapogai & Notes")}
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"1.2rem" }}>
              <div className="form-group">
                <label>Faapogai</label>
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
            {sectionHead("Objection (Proclamation Period)")}
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"1.2rem" }}>
              <div className="form-group">
                <label>Objection Filed?</label>
                <select value={form.objection} onChange={e => {
                  const val = e.target.value;
                  const autoReg = val === "no" ? autoRegDate(form.dateProclamation) : "";
                  setForm(f => ({ ...f, objection: val, objectionDate: val === "yes" ? today : "", dateRegistration: autoReg }));
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
            {form.objection === "yes" && (
              <div style={{ marginTop:"0.75rem", padding:"0.75rem 1rem", background:"#fef2f2", border:"1px solid #fca5a5", borderRadius:"4px" }}>
                <p style={{ fontSize:"0.85rem", color:"#8b1a1a", fontWeight:600 }}>
                  ⚠ Objection filed — this title cannot be registered until resolved through court.
                </p>
              </div>
            )}
            {form.objection === "no" && form.dateProclamation && (
              <div style={{ marginTop:"0.75rem", padding:"0.75rem 1rem", background:"#e8f5ed", border:"1px solid #c3e6cb", borderRadius:"4px" }}>
                <p style={{ fontSize:"0.85rem", color:"#155c31" }}>
                  ✓ No objection — Registration date auto-set to <strong>{formatDisplayDate(autoRegDate(form.dateProclamation))}</strong> (same day of 4th month after proclamation)
                </p>
              </div>
            )}
          </div>

          <div className="fade-in-delay-4" style={{ display: "flex", gap: "1rem", justifyContent: "flex-end" }}>
            <Link to="/dashboard"><button type="button" className="btn-secondary">Cancel</button></Link>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? "Saving…" : isEdit ? "Update Registration" : "Register & Generate Certificate"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

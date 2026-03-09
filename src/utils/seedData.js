import { collection, addDoc, serverTimestamp, getDocs, deleteDoc } from "firebase/firestore";
import { db } from "../firebase";

// ── Date helpers ──────────────────────────────────────────
function fmt(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
function daysAgo(n)    { const d = new Date(); d.setDate(d.getDate()-n);    return fmt(d); }
function daysFromNow(n){ const d = new Date(); d.setDate(d.getDate()+n);    return fmt(d); }
function monthsAgo(n, day=28) {
  const d = new Date(); d.setDate(1); d.setMonth(d.getMonth()-n);
  const last = new Date(d.getFullYear(), d.getMonth()+1, 0).getDate();
  d.setDate(Math.min(day, last)); return fmt(d);
}
function monthsFromNow(n, day=28) {
  const d = new Date(); d.setDate(1); d.setMonth(d.getMonth()+n);
  const last = new Date(d.getFullYear(), d.getMonth()+1, 0).getDate();
  d.setDate(Math.min(day, last)); return fmt(d);
}
function regDateFor(procStr) {
  if (!procStr) return "";
  const p = new Date(procStr + "T00:00:00");
  const target = new Date(p.getFullYear(), p.getMonth()+4, 1);
  const lastDay = new Date(target.getFullYear(), target.getMonth()+1, 0).getDate();
  const reg = new Date(target.getFullYear(), target.getMonth(), Math.min(29, lastDay));
  return fmt(reg);
}
function thisMonthDate(day) {
  const d = new Date();
  const last = new Date(d.getFullYear(), d.getMonth()+1, 0).getDate();
  d.setDate(Math.min(day, last)); return fmt(d);
}

const SAMPLES = [

  // ════════════════════════════════════════════════
  // SECTION 1 — ALREADY REGISTERED (various past months)
  // ════════════════════════════════════════════════
  {
    mataiTitle:"FALEOLO", holderName:"Sione Faleolo Tuilagi", gender:"Male", mataiType:"Ali'i",
    village:"Fagalii", district:"VAIMAUGA SASA'E",
    dateConferred:"2024-09-28", dateSavaliPublished:"2024-10-28",
    dateRegistration:"2025-02-28", dateIssued:"2025-03-05",
    dateBirth:"1975-04-20", nuuFanau:"Fagalii",
    certItumalo:"01", certLaupepa:"53", certRegBook:"188",
    faapogai:"SULI", familyTitles:"FALEOLO", nuuMataiAi:"Fagalii",
    objection:"no", idType:"passport", idNumber:"P1234567",
    notes:"Registered Feb 2025", status:"completed"
  },
  {
    mataiTitle:"FAUMUINA", holderName:"Paulo Faumuina Setu", gender:"Male", mataiType:"Ali'i",
    village:"Magiagi", district:"VAIMAUGA SISIFO",
    dateConferred:"2024-05-28", dateSavaliPublished:"2024-06-28",
    dateRegistration:"2024-10-29", dateIssued:"2024-11-01",
    dateBirth:"1978-05-30", nuuFanau:"Magiagi",
    certItumalo:"02", certLaupepa:"08", certRegBook:"154",
    objection:"no", idType:"passport", idNumber:"P5544332",
    notes:"Registered Oct 2024", status:"completed"
  },
  {
    mataiTitle:"LEIATAUA", holderName:"Alofa Leiataua Tui", gender:"Male", mataiType:"Tulafale",
    village:"Vailele", district:"VAIMAUGA SASA'E",
    dateConferred:"2024-01-28", dateSavaliPublished:"2024-02-28",
    dateRegistration:"2024-06-29", dateIssued:"2024-07-03",
    dateBirth:"1988-12-01", nuuFanau:"Vailele",
    certItumalo:"01", certLaupepa:"62", certRegBook:"334",
    objection:"no", idType:"drivers_licence", idNumber:"DL998877",
    notes:"Registered Jun 2024", status:"completed"
  },
  {
    mataiTitle:"TUPA'I", holderName:"Tupa'i Leatua Fotu", gender:"Male", mataiType:"Ali'i",
    village:"Leulumoega", district:"AANA ALOFI Nu.1",
    dateConferred:"2023-08-10", dateSavaliPublished:"2023-09-28",
    dateRegistration:"2024-01-29", dateIssued:"2024-02-05",
    dateBirth:"1970-07-14", nuuFanau:"Leulumoega",
    certItumalo:"07", certLaupepa:"21", certRegBook:"120",
    objection:"no", idType:"passport", idNumber:"P1122334",
    notes:"Registered Jan 2024", status:"completed"
  },
  {
    mataiTitle:"FALETAGALOA", holderName:"Mere Faletagaloa Asi", gender:"Female", mataiType:"Ali'i",
    village:"Siumu", district:"AANA ALOFI Nu.2",
    dateConferred:"2023-11-15", dateSavaliPublished:"2023-12-28",
    dateRegistration:"2024-04-29", dateIssued:"2024-05-02",
    dateBirth:"1982-03-28", nuuFanau:"Siumu",
    certItumalo:"08", certLaupepa:"05", certRegBook:"198",
    objection:"no", idType:"national_id", idNumber:"NID001122",
    notes:"Registered Apr 2024", status:"completed"
  },

  // ════════════════════════════════════════════════
  // SECTION 2 — READY TO REGISTER (period passed, no reg date)
  // ════════════════════════════════════════════════
  {
    mataiTitle:"MALUSEU", holderName:"Richard Neemia", gender:"Male", mataiType:"Tulafale",
    village:"Vaigaga", district:"FALEATA SISIFO",
    dateConferred:monthsAgo(6), dateSavaliPublished:monthsAgo(5),
    dateRegistration:"", dateIssued:"",
    dateBirth:"1986-09-16", nuuFanau:"Vaigaga",
    certItumalo:"04", certLaupepa:"03", certRegBook:"267",
    objection:"no", idType:"drivers_licence", idNumber:"DL987654",
    notes:"Proclaimed 5 months ago — overdue, ready to register", status:"pending"
  },
  {
    mataiTitle:"TOFAEONO", holderName:"Lafitai Iupati Fuatai", gender:"Male", mataiType:"Ali'i",
    village:"Vaiala", district:"VAIMAUGA SISIFO",
    dateConferred:monthsAgo(5), dateSavaliPublished:monthsAgo(4),
    dateRegistration:"", dateIssued:"",
    dateBirth:"1960-06-12", nuuFanau:"Vaiala",
    certItumalo:"02", certLaupepa:"53", certRegBook:"192",
    objection:"no", idType:"passport", idNumber:"P7654321",
    notes:"Proclaimed exactly 4 months ago — due now", status:"pending"
  },
  {
    mataiTitle:"TUIMALEALIIFANO", holderName:"Tuimalealiifano Vaaletoa", gender:"Male", mataiType:"Ali'i",
    village:"Lufilufi", district:"ANOAMAA SASA'E",
    dateConferred:"2025-08-28", dateSavaliPublished:"2025-09-28",
    dateRegistration:"", dateIssued:"",
    dateBirth:"1968-02-14", nuuFanau:"Lufilufi",
    certItumalo:"06", certLaupepa:"33", certRegBook:"450",
    objection:"no", idType:"passport", idNumber:"P7788990",
    notes:"Sep 2025 proclamation → Feb 2026 reg date (past)", status:"pending"
  },
  {
    mataiTitle:"TAGALOA", holderName:"Tagaloa Faleupolu Asi", gender:"Male", mataiType:"Tulafale",
    village:"Faleasiu", district:"AANA ALOFI Nu.1",
    dateConferred:"2025-09-28", dateSavaliPublished:"2025-10-28",
    dateRegistration:"", dateIssued:"",
    dateBirth:"1972-07-09", nuuFanau:"Faleasiu",
    certItumalo:"07", certLaupepa:"19", certRegBook:"388",
    objection:"no", idType:"drivers_licence", idNumber:"DL556677",
    notes:"Oct 2025 proclamation → Feb 2026 reg date (past)", status:"pending"
  },

  // ════════════════════════════════════════════════
  // SECTION 3 — PROCLAMATION PERIOD (alerts — within 120 days)
  // Reg date falls this month OR near future (for monthly proclamation report)
  // ════════════════════════════════════════════════
  {
    mataiTitle:"SAIFALEUPOLU", holderName:"Manu Saifaleupolu", gender:"Male", mataiType:"Ali'i",
    village:"Laulii", district:"VAIMAUGA SASA'E",
    dateConferred:monthsAgo(3), dateSavaliPublished:monthsAgo(2),
    // reg date = 2 months from now → alert window
    dateRegistration:"", dateIssued:"",
    dateBirth:"1982-07-19", nuuFanau:"Laulii",
    certItumalo:"01", certLaupepa:"47", certRegBook:"215",
    objection:"no", idType:"drivers_licence", idNumber:"DL445566",
    notes:"2 months remaining in proclamation period", status:"pending"
  },
  {
    mataiTitle:"IOSEFO", holderName:"Iosefo Faleata Lameko", gender:"Male", mataiType:"Tulafale",
    village:"Falefa", district:"ANOAMAA SASA'E",
    dateConferred:monthsAgo(2), dateSavaliPublished:monthsAgo(1),
    dateRegistration:"", dateIssued:"",
    dateBirth:"1970-03-14", nuuFanau:"Falefa",
    certItumalo:"06", certLaupepa:"11", certRegBook:"410",
    objection:"no", idType:"passport", idNumber:"P3344556",
    notes:"1 month remaining in proclamation period", status:"pending"
  },
  // Proclaimed this month — reg date = 4 months from now (for current month proclamation report)
  {
    mataiTitle:"FONOTI", holderName:"Fonoti Lesa Tuiloma", gender:"Female", mataiType:"Ali'i",
    village:"Nofoalii", district:"AANA ALOFI Nu.2",
    dateConferred:daysAgo(10), dateSavaliPublished:thisMonthDate(8),
    dateRegistration:"", dateIssued:"",
    dateBirth:"1985-04-17", nuuFanau:"Nofoalii",
    certItumalo:"08", certLaupepa:"08", certRegBook:"521",
    objection:"no", idType:"passport", idNumber:"P4433221",
    notes:"Proclaimed this month — 4 months to go", status:"pending"
  },
  {
    mataiTitle:"FALEASI'U", holderName:"Leota Faleasi'u Taualii", gender:"Male", mataiType:"Ali'i",
    village:"Faleasi'u", district:"AANA ALOFI Nu.1",
    dateConferred:daysAgo(20), dateSavaliPublished:thisMonthDate(3),
    dateRegistration:"", dateIssued:"",
    dateBirth:"1979-09-12", nuuFanau:"Faleasi'u",
    certItumalo:"07", certLaupepa:"30", certRegBook:"540",
    objection:"no", idType:"national_id", idNumber:"NID334455",
    notes:"Proclaimed this month — in alert window", status:"pending"
  },
  {
    mataiTitle:"SEUMANU", holderName:"Seumanu Tualagi Fale", gender:"Male", mataiType:"Tulafale",
    village:"Afega", district:"SAGAGA LE USOGA",
    dateConferred:daysAgo(35), dateSavaliPublished:monthsAgo(1,15),
    dateRegistration:"", dateIssued:"",
    dateBirth:"1965-11-30", nuuFanau:"Afega",
    certItumalo:"09", certLaupepa:"44", certRegBook:"560",
    objection:"no", idType:"drivers_licence", idNumber:"DL223344",
    notes:"1 month 15 days into proclamation — 2.5 months remaining", status:"pending"
  },

  // ════════════════════════════════════════════════
  // SECTION 4 — OBJECTIONS (this month and past months)
  // ════════════════════════════════════════════════
  {
    mataiTitle:"LEAUSA", holderName:"Tala Faleolo Ioane", gender:"Female", mataiType:"Ali'i",
    village:"Apia", district:"VAIMAUGA SISIFO",
    dateConferred:monthsAgo(3), dateSavaliPublished:monthsAgo(2),
    dateRegistration:"", dateIssued:"",
    dateBirth:"1990-03-05", nuuFanau:"Apia",
    certItumalo:"02", certLaupepa:"12", certRegBook:"301",
    objection:"yes", objectionDate:daysAgo(20),
    idType:"passport", idNumber:"P2233445",
    notes:"Objection filed this month", status:"pending"
  },
  {
    mataiTitle:"TOFA", holderName:"Tofa Saleimoa Peseta", gender:"Male", mataiType:"Tulafale",
    village:"Saleimoa", district:"VAIMAUGA SASA'E",
    dateConferred:monthsAgo(4), dateSavaliPublished:monthsAgo(3),
    dateRegistration:"", dateIssued:"",
    dateBirth:"1965-11-18", nuuFanau:"Saleimoa",
    certItumalo:"01", certLaupepa:"29", certRegBook:"278",
    objection:"yes", objectionDate:daysAgo(45),
    idType:"drivers_licence", idNumber:"DL776655",
    notes:"Objection filed 45 days ago — court pending", status:"pending"
  },
  {
    mataiTitle:"SOLOFA", holderName:"Solofa Tuiasau Aiono", gender:"Male", mataiType:"Ali'i",
    village:"Faleatiu", district:"FALEATA SASA'E",
    dateConferred:monthsAgo(5), dateSavaliPublished:monthsAgo(4),
    dateRegistration:"", dateIssued:"",
    dateBirth:"1975-08-22", nuuFanau:"Faleatiu",
    certItumalo:"03", certLaupepa:"37", certRegBook:"315",
    objection:"yes", objectionDate:thisMonthDate(5),
    idType:"passport", idNumber:"P6677889",
    notes:"Objection filed this current month", status:"pending"
  },
  {
    mataiTitle:"PESETA", holderName:"Peseta Nofoaga Leau", gender:"Female", mataiType:"Tulafale",
    village:"Satapuala", district:"AIGA I LE TAI",
    dateConferred:monthsAgo(6), dateSavaliPublished:monthsAgo(5),
    dateRegistration:"", dateIssued:"",
    dateBirth:"1980-01-07", nuuFanau:"Satapuala",
    certItumalo:"10", certLaupepa:"16", certRegBook:"290",
    objection:"yes", objectionDate:monthsAgo(2),
    idType:"national_id", idNumber:"NID556677",
    notes:"Objection filed 2 months ago", status:"pending"
  },

  // ════════════════════════════════════════════════
  // SECTION 5 — NEW MATAI TITLES (entered this month, no proclamation)
  // ════════════════════════════════════════════════
  {
    mataiTitle:"FAAUI", holderName:"Sina Faaui Pago", gender:"Female", mataiType:"Ali'i",
    village:"Malie", district:"SAGAGA LE USOGA",
    dateConferred:thisMonthDate(2), dateSavaliPublished:"",
    dateRegistration:"", dateIssued:"",
    dateBirth:"1995-11-22", nuuFanau:"Malie",
    certItumalo:"06", certLaupepa:"06", certRegBook:"089",
    objection:"no", idType:"passport", idNumber:"P9988776",
    notes:"New this month — not yet proclaimed", status:"pending"
  },
  {
    mataiTitle:"MAIAVA", holderName:"Maiava Salafai Taufa", gender:"Male", mataiType:"Ali'i",
    village:"Mulifanua", district:"AIGA I LE TAI",
    dateConferred:thisMonthDate(6), dateSavaliPublished:"",
    dateRegistration:"", dateIssued:"",
    dateBirth:"1983-06-07", nuuFanau:"Mulifanua",
    certItumalo:"10", certLaupepa:"14", certRegBook:"602",
    objection:"no", idType:"national_id", idNumber:"NID998877",
    notes:"New this month — conferred, awaiting proclamation", status:"pending"
  },
  {
    mataiTitle:"FUIMAONO", holderName:"Fuimaono Tasi Alofaaga", gender:"Female", mataiType:"Ali'i",
    village:"Siusega", district:"FALEATA SISIFO",
    dateConferred:daysAgo(3), dateSavaliPublished:"",
    dateRegistration:"", dateIssued:"",
    dateBirth:"1991-08-25", nuuFanau:"Siusega",
    certItumalo:"04", certLaupepa:"22", certRegBook:"501",
    objection:"no", idType:"national_id", idNumber:"NID112233",
    notes:"New — entered 3 days ago, not yet proclaimed", status:"pending"
  },
  // Older new title (from last month) — should appear in full reports but NOT monthly
  {
    mataiTitle:"ALALATOA", holderName:"Alalatoa Sione Pouvi", gender:"Male", mataiType:"Tulafale",
    village:"Amaile", district:"ANOAMAA SISIFO",
    dateConferred:monthsAgo(1, 15), dateSavaliPublished:"",
    dateRegistration:"", dateIssued:"",
    dateBirth:"1988-02-14", nuuFanau:"Amaile",
    certItumalo:"05", certLaupepa:"18", certRegBook:"615",
    objection:"no", idType:"drivers_licence", idNumber:"DL112244",
    notes:"Entered last month — no proclamation yet", status:"pending"
  },

  // ════════════════════════════════════════════════
  // SECTION 6 — INTENTIONAL DUPLICATES (for testing duplicate detection)
  // ════════════════════════════════════════════════
  // This record has same cert number as FALEOLO (01/53/188)
  {
    mataiTitle:"FALEOLO II", holderName:"Tama Faleolo Sapa", gender:"Male", mataiType:"Ali'i",
    village:"Fagalii", district:"VAIMAUGA SASA'E",
    dateConferred:daysAgo(30), dateSavaliPublished:"",
    dateRegistration:"", dateIssued:"",
    dateBirth:"1980-06-15", nuuFanau:"Fagalii",
    certItumalo:"01", certLaupepa:"53", certRegBook:"188",
    mataiCertNumber:"01/53/188",
    objection:"no", idType:"passport", idNumber:"P1122334",
    notes:"TEST: Duplicate cert number 01/53/188 — same as FALEOLO", status:"pending"
  },
  // This record has same cert number as FAUMUINA (02/08/154)
  {
    mataiTitle:"FAUMUINA JUNIOR", holderName:"Lupe Faumuina Tuu", gender:"Female", mataiType:"Tulafale",
    village:"Magiagi", district:"VAIMAUGA SISIFO",
    dateConferred:daysAgo(15), dateSavaliPublished:"",
    dateRegistration:"", dateIssued:"",
    dateBirth:"1992-11-03", nuuFanau:"Magiagi",
    certItumalo:"02", certLaupepa:"08", certRegBook:"154",
    mataiCertNumber:"02/08/154",
    objection:"no", idType:"national_id", idNumber:"NID445566",
    notes:"TEST: Duplicate cert number 02/08/154 — same as FAUMUINA", status:"pending"
  },
];

export async function seedTestData(onProgress) {
  try {
    const snap = await getDocs(collection(db, "registrations"));
    for (const d of snap.docs) await deleteDoc(d.ref);

    for (let i = 0; i < SAMPLES.length; i++) {
      if (onProgress) onProgress(i+1, SAMPLES.length, SAMPLES[i].mataiTitle);
      const s = SAMPLES[i];
      // Always compose mataiCertNumber from the 3 parts so duplicate detection works
      const certNum = [s.certItumalo, s.certLaupepa, s.certRegBook].filter(Boolean).join("/");
      await addDoc(collection(db, "registrations"), {
        ...s,
        mataiCertNumber: certNum || s.mataiCertNumber || "",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        createdBy: "seed@test.com",
      });
    }
    return { success: true, message: `${SAMPLES.length} test records loaded.` };
  } catch (err) {
    return { success: false, message: `Error: ${err.message}` };
  }
}

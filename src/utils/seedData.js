import { collection, addDoc, serverTimestamp, getDocs, deleteDoc } from "firebase/firestore";
import { db } from "../firebase";

function daysAgo(n) {
  const d = new Date(); d.setDate(d.getDate() - n);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
function daysFromNow(n) {
  const d = new Date(); d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
function onThe28th(monthsOffset) {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() + monthsOffset);
  d.setDate(28);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-28`;
}
function regDateFor(procStr) {
  if (!procStr) return "";
  const p = new Date(procStr + "T00:00:00");
  const target = new Date(p.getFullYear(), p.getMonth() + 4, 1);
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  const day = Math.min(29, lastDay);
  const reg = new Date(target.getFullYear(), target.getMonth(), day);
  return `${reg.getFullYear()}-${String(reg.getMonth()+1).padStart(2,"0")}-${String(reg.getDate()).padStart(2,"0")}`;
}

// Oct → Feb (28th, non-leap), Feb → Jun (29th), Jun → Oct (29th), etc.
const SAMPLES = [
  // ── REGISTERED (completed) ─────────────────────────────────────────
  {
    mataiTitle: "FALEOLO", holderName: "Sione Faleolo Tuilagi", gender: "Male", mataiType: "Ali'i",
    village: "Fagalii", district: "VAIMAUGA SASA'E",
    dateConferred: "2024-09-28", dateProclamation: "2024-10-28",
    dateRegistration: "2025-02-28", // Oct→Feb, clamped to 28
    dateIssued: "2025-03-05", dateBirth: "1975-04-20", nuuFanau: "Fagalii",
    certItumalo:"01", certLaupepa:"53", certRegBook:"188",
    faapogai:"SULI", familyTitles:"FALEOLO", nuuMataiAi:"Fagalii",
    objection:"no", objectionDate:"", idType:"passport", idNumber:"P1234567",
    notes:"Oct proclamation → Feb registration (28th, no leap year)", status:"completed"
  },
  {
    mataiTitle: "FAUMUINA", holderName: "Paulo Faumuina Setu", gender: "Male", mataiType: "Ali'i",
    village: "Magiagi", district: "VAIMAUGA SISIFO",
    dateConferred: "2024-05-28", dateProclamation: "2024-06-28",
    dateRegistration: "2024-10-29", // Jun→Oct (29th)
    dateIssued: "2024-11-01", dateBirth: "1978-05-30", nuuFanau: "Magiagi",
    certItumalo:"02", certLaupepa:"08", certRegBook:"154",
    objection:"no", objectionDate:"", idType:"passport", idNumber:"P5544332",
    notes:"Jun proclamation → Oct registration (29th)", status:"completed"
  },
  {
    mataiTitle: "LEIATAUA", holderName: "Alofa Leiataua Tui", gender: "Male", mataiType: "Tulafale",
    village: "Vailele", district: "VAIMAUGA SASA'E",
    dateConferred: "2024-01-28", dateProclamation: "2024-02-28",
    dateRegistration: "2024-06-29", // Feb→Jun (29th)
    dateIssued: "2024-07-03", dateBirth: "1988-12-01", nuuFanau: "Vailele",
    certItumalo:"01", certLaupepa:"62", certRegBook:"334",
    objection:"no", objectionDate:"", idType:"drivers_licence", idNumber:"DL998877",
    notes:"Feb proclamation → Jun registration (29th)", status:"completed"
  },

  // ── OVERDUE — past 4 months, no registration yet ───────────────────
  {
    mataiTitle: "MALUSEU", holderName: "Richard Neemia", gender: "Male", mataiType: "Tulafale",
    village: "Vaigaga", district: "FALEATA SISIFO",
    dateConferred: onThe28th(-6), dateProclamation: onThe28th(-5),
    dateRegistration: "", dateIssued: "",
    dateBirth: "1986-09-16", nuuFanau: "Vaigaga",
    certItumalo:"04", certLaupepa:"03", certRegBook:"267",
    objection:"no", objectionDate:"", idType:"drivers_licence", idNumber:"DL987654",
    notes:"Proclaimed 5 months ago — overdue, ready to register", status:"pending"
  },
  {
    mataiTitle: "TOFAEONO", holderName: "Lafitai Iupati Fuatai", gender: "Male", mataiType: "Ali'i",
    village: "Vaiala", district: "VAIMAUGA SISIFO",
    dateConferred: onThe28th(-5), dateProclamation: onThe28th(-4),
    dateRegistration: "", dateIssued: "",
    dateBirth: "1960-06-12", nuuFanau: "Vaiala",
    certItumalo:"02", certLaupepa:"53", certRegBook:"192",
    objection:"no", objectionDate:"", idType:"passport", idNumber:"P7654321",
    notes:"Proclaimed exactly 4 months ago — registration due now", status:"pending"
  },

  // ── IN PROCLAMATION PERIOD (not yet 4 months) ──────────────────────
  {
    mataiTitle: "SAIFALEUPOLU", holderName: "Manu Saifaleupolu", gender: "Male", mataiType: "Ali'i",
    village: "Laulii", district: "VAIMAUGA SASA'E",
    dateConferred: onThe28th(-3), dateProclamation: onThe28th(-2),
    dateRegistration: "", dateIssued: "",
    dateBirth: "1982-07-19", nuuFanau: "Laulii",
    certItumalo:"01", certLaupepa:"47", certRegBook:"215",
    objection:"no", objectionDate:"", idType:"drivers_licence", idNumber:"DL445566",
    notes:"Proclaimed 2 months ago — 2 months remaining in proclamation period", status:"pending"
  },
  {
    mataiTitle: "IOSEFO", holderName: "Iosefo Faleata Lameko", gender: "Male", mataiType: "Tulafale",
    village: "Falefa", district: "ANOAMAA SASA'E",
    dateConferred: onThe28th(-2), dateProclamation: onThe28th(-1),
    dateRegistration: "", dateIssued: "",
    dateBirth: "1970-03-14", nuuFanau: "Falefa",
    certItumalo:"06", certLaupepa:"11", certRegBook:"410",
    objection:"no", objectionDate:"", idType:"passport", idNumber:"P3344556",
    notes:"Proclaimed 1 month ago — 3 months remaining", status:"pending"
  },
  {
    mataiTitle: "FUIMAONO", holderName: "Fuimaono Tasi Alofaaga", gender: "Female", mataiType: "Ali'i",
    village: "Siusega", district: "FALEATA SISIFO",
    dateConferred: daysAgo(10), dateProclamation: daysFromNow(5),
    dateRegistration: "", dateIssued: "",
    dateBirth: "1991-08-25", nuuFanau: "Siusega",
    certItumalo:"03", certLaupepa:"22", certRegBook:"501",
    objection:"no", objectionDate:"", idType:"national_id", idNumber:"NID112233",
    notes:"Proclamation upcoming in 5 days", status:"pending"
  },

  // ── OBJECTION FILED ────────────────────────────────────────────────
  {
    mataiTitle: "LEAUSA", holderName: "Tala Faleolo Ioane", gender: "Female", mataiType: "Ali'i",
    village: "Apia", district: "VAIMAUGA SISIFO",
    dateConferred: onThe28th(-3), dateProclamation: onThe28th(-2),
    dateRegistration: "", dateIssued: "",
    dateBirth: "1990-03-05", nuuFanau: "Apia",
    certItumalo:"02", certLaupepa:"12", certRegBook:"301",
    objection:"yes", objectionDate: daysAgo(20), idType:"passport", idNumber:"P2233445",
    notes:"Objection filed — cannot register until resolved", status:"pending"
  },
  {
    mataiTitle: "TOFA", holderName: "Tofa Saleimoa Peseta", gender: "Male", mataiType: "Tulafale",
    village: "Saleimoa", district: "VAIMAUGA SASA'E",
    dateConferred: onThe28th(-4), dateProclamation: onThe28th(-3),
    dateRegistration: "", dateIssued: "",
    dateBirth: "1965-11-18", nuuFanau: "Saleimoa",
    certItumalo:"01", certLaupepa:"29", certRegBook:"278",
    objection:"yes", objectionDate: daysAgo(45), idType:"drivers_licence", idNumber:"DL776655",
    notes:"Objection filed 45 days ago — court pending", status:"pending"
  },

  // ── JAN 2026 PROCLAMATION TEST CASES ─────────────────────────────
  // Proclaimed 28 Sep 2025 → reg date = 28 Feb 2026 (Feb clamped to 28) — SHOULD BE REGISTERED
  {
    mataiTitle: "TUIMALEALIIFANO", holderName: "Tuimalealiifano Vaaletoa", gender: "Male", mataiType: "Ali\'i",
    village: "Lufilufi", district: "ANOAMAA SASA'E",
    dateConferred: "2025-08-28", dateProclamation: "2025-09-28",
    dateRegistration: "", dateIssued: "",
    dateBirth: "1968-02-14", nuuFanau: "Lufilufi",
    certItumalo:"06", certLaupepa:"33", certRegBook:"450",
    objection:"no", objectionDate:"", idType:"passport", idNumber:"P7788990",
    notes:"Sep 2025 proclamation → 28 Feb 2026 reg date (should auto-fill as date has passed)", status:"pending"
  },
  // Proclaimed 28 Oct 2025 → reg date = 28 Feb 2026 (Feb clamped) — SHOULD BE REGISTERED
  {
    mataiTitle: "TAGALOA", holderName: "Tagaloa Faleupolu Asi", gender: "Male", mataiType: "Tulafale",
    village: "Faleasiu", district: "AANA ALOFI Nu.1",
    dateConferred: "2025-09-28", dateProclamation: "2025-10-28",
    dateRegistration: "", dateIssued: "",
    dateBirth: "1972-07-09", nuuFanau: "Faleasiu",
    certItumalo:"05", certLaupepa:"19", certRegBook:"388",
    objection:"no", objectionDate:"", idType:"drivers_licence", idNumber:"DL556677",
    notes:"Oct 2025 proclamation → 28 Feb 2026 reg date (should auto-fill as date has passed)", status:"pending"
  },
  // Proclaimed 28 Jan 2026 → reg date = 29 May 2026 — still in proclamation period
  {
    mataiTitle: "FONOTI", holderName: "Fonoti Lesa Tuiloma", gender: "Female", mataiType: "Ali\'i",
    village: "Nofoalii", district: "AANA ALOFI Nu.2",
    dateConferred: "2025-12-28", dateProclamation: "2026-01-28",
    dateRegistration: "", dateIssued: "",
    dateBirth: "1985-04-17", nuuFanau: "Nofoalii",
    certItumalo:"07", certLaupepa:"08", certRegBook:"521",
    objection:"no", objectionDate:"", idType:"passport", idNumber:"P4433221",
    notes:"28 Jan 2026 proclamation → 29 May 2026 reg date (still in proclamation period)", status:"pending"
  },

  // ── NEW — no proclamation date yet ────────────────────────────────
  {
    mataiTitle: "FAAUI", holderName: "Sina Faaui Pago", gender: "Female", mataiType: "Ali'i",
    village: "Malie", district: "SAGAGA LE USOGA",
    dateConferred: daysAgo(5), dateProclamation: "",
    dateRegistration: "", dateIssued: "",
    dateBirth: "1995-11-22", nuuFanau: "Malie",
    certItumalo:"05", certLaupepa:"06", certRegBook:"089",
    objection:"no", objectionDate:"", idType:"passport", idNumber:"P9988776",
    notes:"New — conferral done, not yet proclaimed", status:"pending"
  },
  {
    mataiTitle: "MAIAVA", holderName: "Maiava Salafai Taufa", gender: "Male", mataiType: "Ali'i",
    village: "Mulifanua", district: "AIGA I LE TAI",
    dateConferred: daysAgo(2), dateProclamation: "",
    dateRegistration: "", dateIssued: "",
    dateBirth: "1983-06-07", nuuFanau: "Mulifanua",
    certItumalo:"07", certLaupepa:"14", certRegBook:"602",
    objection:"no", objectionDate:"", idType:"national_id", idNumber:"NID998877",
    notes:"Very new entry — just conferred", status:"pending"
  },
];

export async function seedTestData(onProgress) {
  try {
    // Clear existing records first
    const snap = await getDocs(collection(db, "registrations"));
    for (const d of snap.docs) await deleteDoc(d.ref);

    for (let i = 0; i < SAMPLES.length; i++) {
      if (onProgress) onProgress(i+1, SAMPLES.length, SAMPLES[i].mataiTitle);
      await addDoc(collection(db, "registrations"), {
        ...SAMPLES[i],
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

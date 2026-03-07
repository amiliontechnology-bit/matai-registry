import { collection, addDoc, serverTimestamp, getDocs } from "firebase/firestore";
import { db } from "../firebase";

// Helper: date string N months before today
function monthsAgo(n, day = 28) {
  const d = new Date();
  d.setMonth(d.getMonth() - n);
  d.setDate(day);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
function monthsFromNow(n, day = 28) {
  const d = new Date();
  d.setMonth(d.getMonth() + n);
  d.setDate(day);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
function autoRegDate(procStr) {
  if (!procStr) return "";
  const d = new Date(procStr);
  d.setMonth(d.getMonth() + 4);
  const yr = d.getFullYear(), mo = d.getMonth();
  const isLeap = (yr%4===0 && yr%100!==0) || yr%400===0;
  d.setDate((mo===1 && isLeap) ? 28 : 29);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

const SAMPLES = [
  // 1. Already registered — completed, should NOT appear in proclamation alerts
  {
    mataiTitle: "FALEOLO", holderName: "Sione Faleolo Tuilagi", gender: "Male", mataiType: "Ali'i",
    village: "Fagalii", district: "VAIMAUGA SASA'E",
    dateConferred: "2023-10-15",
    dateProclamation: "2023-11-28",
    dateRegistration: autoRegDate("2023-11-28"),
    dateIssued: "2024-04-02",
    dateBirth: "1975-04-20", nuuFanau: "Fagalii",
    certItumalo:"01", certLaupepa:"53", certRegBook:"188",
    faapogai:"SULI", familyTitles:"FALEOLO", nuuMataiAi:"Fagalii",
    objection:"no", objectionDate:"",
    idType:"passport", idNumber:"P1234567",
    notes:"Test: completed — should NOT show in alerts",
    status:"completed"
  },
  // 2. Proclaimed 5 months ago — OVERDUE, no reg date → should appear in proclamation alerts + ready to register
  {
    mataiTitle: "MALUSEU", holderName: "Richard Neemia", gender: "Male", mataiType: "Tulafale",
    village: "Vaigaga", district: "FALEATA SISIFO",
    dateConferred: monthsAgo(6),
    dateProclamation: monthsAgo(5),
    dateRegistration: "",
    dateIssued: "",
    dateBirth: "1986-09-16", nuuFanau: "Vaigaga",
    certItumalo:"04", certLaupepa:"03", certRegBook:"267",
    objection:"no", objectionDate:"",
    idType:"drivers_licence", idNumber:"DL987654",
    notes:"Test: 5 months past proclamation — overdue, ready to register",
    status:"pending"
  },
  // 3. Proclaimed exactly 4 months ago (on the 28th) → registration date should be 29th of this month
  {
    mataiTitle: "TOFAEONO", holderName: "Lafitai Iupati Fuatai", gender: "Male", mataiType: "Ali'i",
    village: "Vaiala", district: "VAIMAUGA SISIFO",
    dateConferred: monthsAgo(5),
    dateProclamation: monthsAgo(4),
    dateRegistration: "",
    dateIssued: "",
    dateBirth: "1960-06-12", nuuFanau: "Vaiala",
    certItumalo:"02", certLaupepa:"53", certRegBook:"192",
    objection:"no", objectionDate:"",
    idType:"passport", idNumber:"P7654321",
    notes:`Test: proclaimed 4 months ago on 28th — reg date should be 29th of this month (${autoRegDate(monthsAgo(4))})`,
    status:"pending"
  },
  // 4. OBJECTION raised — should appear in Objections tab only
  {
    mataiTitle: "LEAUSA", holderName: "Tala Faleolo Ioane", gender: "Female", mataiType: "Ali'i",
    village: "Apia", district: "VAIMAUGA SISIFO",
    dateConferred: monthsAgo(3),
    dateProclamation: monthsAgo(2),
    dateRegistration: "",
    dateIssued: "",
    dateBirth: "1990-03-05", nuuFanau: "Apia",
    certItumalo:"02", certLaupepa:"12", certRegBook:"301",
    objection:"yes", objectionDate: monthsAgo(1),
    idType:"passport", idNumber:"P2233445",
    notes:"Test: objection raised — should NOT appear in proclamation alerts",
    status:"pending"
  },
  // 5. Proclaimed 2 months ago — in alert window (60 days remaining approx)
  {
    mataiTitle: "SAIFALEUPOLU", holderName: "Manu Saifaleupolu", gender: "Male", mataiType: "Ali'i",
    village: "Laulii", district: "VAIMAUGA SASA'E",
    dateConferred: monthsAgo(3),
    dateProclamation: monthsAgo(2),
    dateRegistration: "",
    dateIssued: "",
    dateBirth: "1982-07-19", nuuFanau: "Laulii",
    certItumalo:"01", certLaupepa:"47", certRegBook:"215",
    objection:"no", objectionDate:"",
    idType:"drivers_licence", idNumber:"DL445566",
    notes:"Test: 2 months past proclamation — in alert window",
    status:"pending"
  },
  // 6. Brand new — no proclamation date yet → New Matai Titles report
  {
    mataiTitle: "FAAUI", holderName: "Sina Faaui Pago", gender: "Female", mataiType: "Tulafale",
    village: "Malie", district: "SAGAGA LE USOGA",
    dateConferred: monthsAgo(0, 15),
    dateProclamation: "",
    dateRegistration: "",
    dateIssued: "",
    dateBirth: "1995-11-22", nuuFanau: "Malie",
    certItumalo:"05", certLaupepa:"06", certRegBook:"089",
    objection:"no", objectionDate:"",
    idType:"passport", idNumber:"P9988776",
    notes:"Test: new entry, no proclamation yet — should appear in New Matai Titles",
    status:"pending"
  },
  // 7. Proclaimed in 1 month — upcoming, in alert window
  {
    mataiTitle: "FAUMUINA", holderName: "Paulo Faumuina Setu", gender: "Male", mataiType: "Ali'i",
    village: "Magiagi", district: "VAIMAUGA SISIFO",
    dateConferred: monthsAgo(2),
    dateProclamation: monthsFromNow(1),
    dateRegistration: "",
    dateIssued: "",
    dateBirth: "1978-05-30", nuuFanau: "Magiagi",
    certItumalo:"02", certLaupepa:"08", certRegBook:"154",
    objection:"no", objectionDate:"",
    idType:"passport", idNumber:"P5544332",
    notes:"Test: proclamation in 1 month — upcoming alert",
    status:"pending"
  },
  // 8. Leap year test — proclamation in October 2027 → reg date falls in Feb 2028 (leap year) → should be 28th Feb 2028
  {
    mataiTitle: "LEIATAUA", holderName: "Alofa Leiataua Tui", gender: "Male", mataiType: "Ali'i",
    village: "Vailele", district: "VAIMAUGA SASA'E",
    dateConferred: "2027-09-28",
    dateProclamation: "2027-10-28",
    dateRegistration: "",
    dateIssued: "",
    dateBirth: "1988-12-01", nuuFanau: "Vailele",
    certItumalo:"01", certLaupepa:"62", certRegBook:"334",
    objection:"no", objectionDate:"",
    idType:"drivers_licence", idNumber:"DL998877",
    notes:"Test LEAP YEAR: proclaimed Oct 2027 → 4 months = Feb 2028 (leap year) → reg date should be 28 Feb 2028 (not 29th)",
    status:"pending"
  },
];

export async function seedTestData(onProgress) {
  try {
    const snap = await getDocs(collection(db, "registrations"));
    if (snap.size >= 5) {
      return { success: false, message: "Data already exists — clear existing records first." };
    }
    for (let i = 0; i < SAMPLES.length; i++) {
      const rec = SAMPLES[i];
      if (onProgress) onProgress(i+1, SAMPLES.length, rec.mataiTitle);
      await addDoc(collection(db, "registrations"), {
        ...rec,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        createdBy: "seed@test.com",
      });
    }
    return { success: true, message: `${SAMPLES.length} test records added.` };
  } catch (err) {
    return { success: false, message: `Error: ${err.message}` };
  }
}

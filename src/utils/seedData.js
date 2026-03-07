import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";

// Today's date helper
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; };
const daysAgo = (n) => { const d = new Date(); d.setDate(d.getDate()-n); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; };
const daysFromNow = (n) => daysAgo(-n);

const SAMPLES = [
  // 1. Normal - proclamation in 20 days (upcoming, no objection)
  {
    mataiTitle:"FALEOLO", holderName:"Sione Faleolo Tuilagi", gender:"Male", mataiType:"Ali'i",
    village:"FAGALII", district:"VAIMAUGA SASA'E",
    dateConferred: daysAgo(30), dateProclamation: daysFromNow(20), dateRegistration:"", dateIssued: today(),
    dateBirth:"1975-06-15", nuuFanau:"FAGALII",
    certItumalo:"1", certLaupepa:"53", certRegBook:"192", mataiCertNumber:"1/53/192",
    faapogai:"SULI", familyTitles:"", nuuMataiAi:"",
    photoIdType:"passport", photoIdNumber:"P1234567", photoIdImage:"",
    objection:"no", objectionDate:"",
    notes:"Test record — proclamation upcoming in 20 days",
  },
  // 2. Normal - proclamation in 5 days (critical)
  {
    mataiTitle:"MALUSEU", holderName:"Richard Neemia Faleolo", gender:"Male", mataiType:"Tulafale",
    village:"VAIGAGA", district:"FALEATA SISIFO",
    dateConferred: daysAgo(100), dateProclamation: daysFromNow(5), dateRegistration:"", dateIssued: today(),
    dateBirth:"1986-09-16", nuuFanau:"VAIGAGA",
    certItumalo:"4", certLaupepa:"3", certRegBook:"267", mataiCertNumber:"4/3/267",
    faapogai:"", familyTitles:"", nuuMataiAi:"",
    photoIdType:"drivers_licence", photoIdNumber:"DL987654", photoIdImage:"",
    objection:"no", objectionDate:"",
    notes:"Test record — proclamation critical (5 days)",
  },
  // 3. Objection filed
  {
    mataiTitle:"TOFAEONO", holderName:"Lafitai Iupati Fuatai", gender:"Male", mataiType:"Ali'i",
    village:"VAIALA", district:"VAIMAUGA SISIFO",
    dateConferred: daysAgo(60), dateProclamation: daysAgo(45), dateRegistration:"", dateIssued: today(),
    dateBirth:"1968-03-22", nuuFanau:"VAIALA",
    certItumalo:"2", certLaupepa:"53", certRegBook:"192", mataiCertNumber:"2/53/192",
    faapogai:"", familyTitles:"", nuuMataiAi:"",
    photoIdType:"passport", photoIdNumber:"P9876543", photoIdImage:"",
    objection:"yes", objectionDate: daysAgo(10),
    notes:"Test record — objection filed 10 days ago, must go to court",
  },
  // 4. Overdue - proclamation was 5 months ago, not registered
  {
    mataiTitle:"LEOTA", holderName:"Faleolo Sila Taufa", gender:"Female", mataiType:"Ali'i",
    village:"APIA", district:"VAIMAUGA SISIFO",
    dateConferred: daysAgo(180), dateProclamation: daysAgo(155), dateRegistration:"", dateIssued: today(),
    dateBirth:"1990-11-30", nuuFanau:"APIA",
    certItumalo:"2", certLaupepa:"41", certRegBook:"88", mataiCertNumber:"2/41/88",
    faapogai:"", familyTitles:"", nuuMataiAi:"",
    photoIdType:"drivers_licence", photoIdNumber:"DL112233", photoIdImage:"",
    objection:"no", objectionDate:"",
    notes:"Test record — OVERDUE, proclamation was 5 months ago",
  },
  // 5. Completed / Printed
  {
    mataiTitle:"FALEATA", holderName:"Tupa Saleaula Moe", gender:"Male", mataiType:"Tulafale",
    village:"FASITOOUTA", district:"AANA ALOFI Nu.1",
    dateConferred: daysAgo(200), dateProclamation: daysAgo(160), dateRegistration: daysAgo(130), dateIssued: daysAgo(128),
    dateBirth:"1955-04-07", nuuFanau:"FASITOOUTA",
    certItumalo:"7", certLaupepa:"12", certRegBook:"33", mataiCertNumber:"7/12/33",
    faapogai:"SULI", familyTitles:"FALEOLO", nuuMataiAi:"FAGALII",
    photoIdType:"passport", photoIdNumber:"P5554443", photoIdImage:"",
    objection:"no", objectionDate:"",
    status:"completed", printedAt: daysAgo(128),
    notes:"Test record — completed and printed",
  },
  // 6. Proclamation exactly 4 months ago (borderline)
  {
    mataiTitle:"SALAVE'A", holderName:"Peata Fono Lima", gender:"Female", mataiType:"Ali'i",
    village:"LALOMANU", district:"ALEIPATA ITUPA I LUGA",
    dateConferred: daysAgo(140), dateProclamation: daysAgo(121), dateRegistration:"", dateIssued: today(),
    dateBirth:"1982-07-19", nuuFanau:"LALOMANU",
    certItumalo:"18", certLaupepa:"7", certRegBook:"14", mataiCertNumber:"18/7/14",
    faapogai:"", familyTitles:"", nuuMataiAi:"",
    photoIdType:"drivers_licence", photoIdNumber:"DL445566", photoIdImage:"",
    objection:"no", objectionDate:"",
    notes:"Test record — borderline overdue (121 days since proclamation)",
  },
];

export async function seedTestData(onProgress) {
  const results = [];
  for (let i = 0; i < SAMPLES.length; i++) {
    try {
      const ref = await addDoc(collection(db, "registrations"), {
        ...SAMPLES[i],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      results.push({ ok:true, id: ref.id, title: SAMPLES[i].mataiTitle });
      onProgress?.(i+1, SAMPLES.length, SAMPLES[i].mataiTitle);
    } catch(e) {
      results.push({ ok:false, title: SAMPLES[i].mataiTitle, error: e.message });
    }
  }
  return results;
}

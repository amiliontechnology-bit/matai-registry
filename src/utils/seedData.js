import { collection, addDoc, serverTimestamp, getDocs, deleteDoc } from "firebase/firestore";
import { db } from "../firebase";

// ── Date helpers ──────────────────────────────────────────
function fmt(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
function mAgo(n) {
  const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - n);
  d.setDate(Math.min(28, new Date(d.getFullYear(), d.getMonth()+1, 0).getDate()));
  return fmt(d);
}
function mFwd(n) {
  const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() + n);
  d.setDate(Math.min(28, new Date(d.getFullYear(), d.getMonth()+1, 0).getDate()));
  return fmt(d);
}
function dAgo(n) { const d = new Date(); d.setDate(d.getDate()-n); return fmt(d); }
const TODAY = fmt(new Date());

const SAMPLES = [

  // ═══════════════════════════════════════════════════════════
  // 1. COMPLETED / REGISTERED — can print certificate
  // ═══════════════════════════════════════════════════════════
  {
    mataiTitle: "FALEOLO", holderName: "Sione Faleolo Tuilagi", gender: "Tane",
    mataiType: "Ali'i", village: "Fagalii", district: "VAIMAUGA SASA'E",
    certItumalo: "1", certLaupepa: "53", certRegBook: "188",
    dateConferred: mAgo(14), dateOfficeReceived: dAgo(14*30+5),
    dateSavaliPublished: mAgo(8), dateRegistration: mAgo(5),
    dateIssued: TODAY, dateBirth: "1975-04-20", nuuFanau: "Fagalii",
    faapogai: "SULI", familyTitles: "LEIATAUA", nuuMataiAi: "Fagalii",
    photoIdType: "passport", photoIdNumber: "P1234567",
    intention: "no", objection: "no",
    notes: "Completed — can print both Samoan & English certificate.", status: "completed",
  },
  {
    mataiTitle: "FIAME", holderName: "Naomi Fiame Mata'afa", gender: "Tamaitai",
    mataiType: "Ali'i", village: "Lufilufi", district: "ANOAMAA SASA'E",
    certItumalo: "21", certLaupepa: "5", certRegBook: "99",
    dateConferred: mAgo(16), dateOfficeReceived: dAgo(16*30+4),
    dateSavaliPublished: mAgo(10), dateRegistration: mAgo(7),
    dateIssued: TODAY, dateBirth: "1970-10-05", nuuFanau: "Lufilufi",
    faapogai: "SULI", familyTitles: "", nuuMataiAi: "",
    photoIdType: "drivers_licence", photoIdNumber: "DL998877",
    intention: "no", objection: "no",
    notes: "Female title holder — registered and certified.", status: "completed",
  },
  {
    mataiTitle: "VA'AIGA", holderName: "Tuilagi Va'aiga Siu", gender: "Tane",
    mataiType: "Tulafale", village: "Vailele", district: "VAIMAUGA SASA'E",
    certItumalo: "1", certLaupepa: "33", certRegBook: "711",
    dateConferred: mAgo(24), dateOfficeReceived: dAgo(24*30+3),
    dateSavaliPublished: mAgo(18), dateRegistration: mAgo(15),
    dateIssued: TODAY, dateBirth: "1966-03-12", nuuFanau: "Vailele",
    faapogai: "SULI", familyTitles: "TUILAGI", nuuMataiAi: "Magiagi",
    photoIdType: "passport", photoIdNumber: "P9988776",
    intention: "no", objection: "no",
    notes: "Old completed record.", status: "completed",
  },

  // ═══════════════════════════════════════════════════════════
  // 2. READY TO REGISTER — Savali period passed, overdue
  //    → Notifications → Proclamation (red OVERDUE) + Ready to Register
  // ═══════════════════════════════════════════════════════════
  {
    mataiTitle: "TUPUA", holderName: "Iosefa Tupua Salave'a", gender: "Tane",
    mataiType: "Ali'i", village: "Lufilufi", district: "ANOAMAA SASA'E",
    certItumalo: "21", certLaupepa: "7", certRegBook: "212",
    dateConferred: mAgo(6), dateOfficeReceived: dAgo(6*30+3),
    dateSavaliPublished: mAgo(5), dateRegistration: "",
    dateIssued: TODAY, dateBirth: "1981-07-22", nuuFanau: "Lufilufi",
    faapogai: "SULI", familyTitles: "TUILAGI", nuuMataiAi: "",
    photoIdType: "passport", photoIdNumber: "P7654321",
    intention: "no", objection: "no",
    notes: "5 months past Savali — ready to confirm registration.",
    status: "pending",
  },
  {
    mataiTitle: "MALIETOA", holderName: "Falefou Malietoa Tanu", gender: "Tane",
    mataiType: "Ali'i", village: "Malie", district: "SAGAGA LE USOGA",
    certItumalo: "6", certLaupepa: "22", certRegBook: "318",
    dateConferred: mAgo(5), dateOfficeReceived: dAgo(5*30+7),
    dateSavaliPublished: mAgo(4), dateRegistration: "",
    dateIssued: TODAY, dateBirth: "1979-03-18", nuuFanau: "Malie",
    faapogai: "SULI", familyTitles: "", nuuMataiAi: "",
    photoIdType: "drivers_licence", photoIdNumber: "DL556677",
    intention: "no", objection: "no",
    notes: "4 months past Savali — overdue for registration.",
    status: "pending",
  },

  // ═══════════════════════════════════════════════════════════
  // 3. IN SAVALI PUBLICATION PERIOD — still counting down
  //    → Notifications → Proclamation (countdown days)
  // ═══════════════════════════════════════════════════════════
  {
    mataiTitle: "AFAMASAGA", holderName: "Salafai Afamasaga Tupa'i", gender: "Tane",
    mataiType: "Ali'i", village: "Tanugamanono", district: "VAIMAUGA SISIFO",
    certItumalo: "2", certLaupepa: "41", certRegBook: "882",
    dateConferred: mAgo(3), dateOfficeReceived: dAgo(3*30+3),
    dateSavaliPublished: mAgo(2), dateRegistration: "",
    dateIssued: TODAY, dateBirth: "1989-11-05", nuuFanau: "Tanugamanono",
    faapogai: "SULI", familyTitles: "", nuuMataiAi: "",
    photoIdType: "passport", photoIdNumber: "P3344556",
    intention: "no", objection: "no",
    notes: "2 months into publication period — 1 month remaining.",
    status: "pending",
  },
  {
    mataiTitle: "TAGALOA", holderName: "Aeau Tagaloa Faleupolu", gender: "Tane",
    mataiType: "Ali'i", village: "Faleasiu", district: "AANA ALOFI Nu.1",
    certItumalo: "7", certLaupepa: "14", certRegBook: "189",
    dateConferred: mAgo(2), dateOfficeReceived: dAgo(2*30+4),
    dateSavaliPublished: mAgo(1), dateRegistration: "",
    dateIssued: TODAY, dateBirth: "1993-06-28", nuuFanau: "Faleasiu",
    faapogai: "SULI", familyTitles: "", nuuMataiAi: "",
    photoIdType: "drivers_licence", photoIdNumber: "DL223344",
    intention: "no", objection: "no",
    notes: "1 month into publication — 2 months remaining.",
    status: "pending",
  },

  // ═══════════════════════════════════════════════════════════
  // 4. OBJECTION FILED — with all new objection fields
  //    → Notifications → Objections tab
  // ═══════════════════════════════════════════════════════════
  {
    mataiTitle: "FATA", holderName: "Leota Fata Savea", gender: "Tane",
    mataiType: "Tulafale", village: "Fausaga", district: "SAFATA",
    certItumalo: "13", certLaupepa: "8", certRegBook: "440",
    dateConferred: mAgo(6), dateOfficeReceived: dAgo(6*30+6),
    dateSavaliPublished: mAgo(5), dateRegistration: "",
    dateIssued: TODAY, dateBirth: "1977-09-14", nuuFanau: "Fausaga",
    faapogai: "SULI", familyTitles: "", nuuMataiAi: "",
    photoIdType: "passport", photoIdNumber: "P2233445",
    intention: "no", objection: "yes",
    objectionDate: mAgo(3),
    objectionApplicationDate: mAgo(3),
    objectionApplicantName: "Tasi Savea Fata",
    objectionActingRegistrar: "Lealofi Tuilagi",
    objectionFileNumber: "OBJ-2025-0041",
    objectionLCNumber: "LC-2025-118",
    notes: "Objection filed — court case pending LC-2025-118.",
    status: "pending",
  },
  {
    mataiTitle: "LEATINU'U", holderName: "Peni Leatinu'u Sefo", gender: "Tane",
    mataiType: "Tulafale", village: "Falefa", district: "ANOAMAA SASA'E",
    certItumalo: "21", certLaupepa: "11", certRegBook: "302",
    dateConferred: mAgo(7), dateOfficeReceived: dAgo(7*30+8),
    dateSavaliPublished: mAgo(6), dateRegistration: "",
    dateIssued: TODAY, dateBirth: "1964-04-30", nuuFanau: "Falefa",
    faapogai: "SULI", familyTitles: "FALEOLO", nuuMataiAi: "Fagalii",
    photoIdType: "drivers_licence", photoIdNumber: "DL776655",
    intention: "no", objection: "yes",
    objectionDate: mAgo(4),
    objectionApplicationDate: mAgo(4),
    objectionApplicantName: "Alofa Sefo Leatinu'u",
    objectionActingRegistrar: "Taufa Moli",
    objectionFileNumber: "OBJ-2025-0027",
    objectionLCNumber: "LC-2025-095",
    notes: "LC case ongoing. Hearing scheduled.",
    status: "pending",
  },

  // ═══════════════════════════════════════════════════════════
  // 5. INTENTION PROCESS — Savali published BEFORE Saofai
  //    → Tests new Intention=yes validation
  // ═══════════════════════════════════════════════════════════
  {
    mataiTitle: "SOOAEMALELAGI", holderName: "Setope Sooaemalelagi", gender: "Tane",
    mataiType: "Ali'i", village: "Leulumoega", district: "AANA ALOFI Nu.2",
    certItumalo: "8", certLaupepa: "19", certRegBook: "388",
    // Savali published 5 months ago (BEFORE saofai), saofai 1 month ago
    dateSavaliPublished: mAgo(5),
    dateConferred: mAgo(1),
    dateOfficeReceived: dAgo(30+5),
    dateRegistration: "", dateIssued: TODAY, dateBirth: "1985-08-11", nuuFanau: "Leulumoega",
    faapogai: "SULI", familyTitles: "", nuuMataiAi: "",
    photoIdType: "passport", photoIdNumber: "PW123456",
    intention: "yes", objection: "no",
    notes: "Intention process — Savali published before Saofai, no objection received.",
    status: "pending",
  },

  // ═══════════════════════════════════════════════════════════
  // 6. NO SAVALI YET — conferred, waiting for publication
  //    → Notifications → New Matai tab
  // ═══════════════════════════════════════════════════════════
  {
    mataiTitle: "TUILAGI", holderName: "Lesa Tuilagi Fono", gender: "Tane",
    mataiType: "Tulafale", village: "Moataa", district: "VAIMAUGA SISIFO",
    certItumalo: "2", certLaupepa: "42", certRegBook: "903",
    dateConferred: mAgo(1), dateOfficeReceived: dAgo(30+2),
    dateSavaliPublished: "", dateRegistration: "",
    dateIssued: TODAY, dateBirth: "1981-02-17", nuuFanau: "Moataa",
    faapogai: "SULI", familyTitles: "FALEOLO", nuuMataiAi: "Fagalii",
    photoIdType: "passport", photoIdNumber: "P1122334",
    intention: "no", objection: "no",
    notes: "Office date received — awaiting Savali publication.",
    status: "pending",
  },
  {
    mataiTitle: "LAFI", holderName: "Luisa Lafi Toleafoa", gender: "Tamaitai",
    mataiType: "Tulafale", village: "Apia", district: "VAIMAUGA SISIFO",
    certItumalo: "2", certLaupepa: "18", certRegBook: "420",
    dateConferred: dAgo(15), dateOfficeReceived: dAgo(10),
    dateSavaliPublished: "", dateRegistration: "",
    dateIssued: TODAY, dateBirth: "1981-05-22", nuuFanau: "Apia",
    faapogai: "SULI", familyTitles: "", nuuMataiAi: "",
    photoIdType: "drivers_licence", photoIdNumber: "DL445566",
    intention: "no", objection: "no",
    notes: "Recently conferred — not yet in Savali.",
    status: "pending",
  },

  // ═══════════════════════════════════════════════════════════
  // 7. DUPLICATE CERT NUMBERS — for Notifications → Duplicates tab
  // ═══════════════════════════════════════════════════════════
  {
    mataiTitle: "MAUALAIVAO", holderName: "Fepuleai Maualaivao Asi", gender: "Tane",
    mataiType: "Ali'i", village: "Solosolo", district: "ANOAMAA SISIFO",
    certItumalo: "22", certLaupepa: "10", certRegBook: "777",
    dateConferred: mAgo(14), dateOfficeReceived: dAgo(14*30+5),
    dateSavaliPublished: mAgo(8), dateRegistration: mAgo(5),
    dateIssued: TODAY, dateBirth: "1987-09-03", nuuFanau: "Solosolo",
    faapogai: "SULI", familyTitles: "", nuuMataiAi: "",
    photoIdType: "passport", photoIdNumber: "P6677889",
    intention: "no", objection: "no",
    notes: "TEST: Duplicate cert 22/10/777 — same as record below.",
    status: "completed",
  },
  {
    mataiTitle: "MAUALAIVAO", holderName: "Ioane Maualaivao Lima", gender: "Tane",
    mataiType: "Ali'i", village: "Luatuanuu", district: "ANOAMAA SISIFO",
    certItumalo: "22", certLaupepa: "10", certRegBook: "777",
    dateConferred: mAgo(20), dateOfficeReceived: dAgo(20*30+4),
    dateSavaliPublished: mAgo(14), dateRegistration: mAgo(11),
    dateIssued: TODAY, dateBirth: "1963-11-28", nuuFanau: "Luatuanuu",
    faapogai: "SULI", familyTitles: "", nuuMataiAi: "",
    photoIdType: "drivers_licence", photoIdNumber: "DL334455",
    intention: "no", objection: "no",
    notes: "TEST: Duplicate cert 22/10/777 — same as record above.",
    status: "completed",
  },
];

export async function seedTestData(onProgress) {
  try {
    // Wipe existing records first
    const snap = await getDocs(collection(db, "registrations"));
    let wiped = 0;
    for (const d of snap.docs) {
      await deleteDoc(d.ref);
      wiped++;
      if (onProgress) onProgress(-wiped, snap.size, "Clearing…");
    }

    // Insert new records
    for (let i = 0; i < SAMPLES.length; i++) {
      if (onProgress) onProgress(i + 1, SAMPLES.length, SAMPLES[i].mataiTitle);
      const s = SAMPLES[i];
      const certNum = [s.certItumalo, s.certLaupepa, s.certRegBook].filter(Boolean).join("/");
      await addDoc(collection(db, "registrations"), {
        ...s,
        mataiCertNumber: certNum,
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

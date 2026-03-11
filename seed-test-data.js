/**
 * ─────────────────────────────────────────────────────────────
 *  MATAI REGISTRY — TEST DATA SEED SCRIPT
 *  Covers: Dashboard, Notifications (all tabs), Certificate
 * ─────────────────────────────────────────────────────────────
 *
 *  USAGE:
 *    1. Download your DEV service account JSON from:
 *       Firebase Console → Project Settings → Service Accounts → Generate new private key
 *       (make sure you're on the TEST project, not prod)
 *
 *    2. Place the JSON file next to this script, e.g.: service-account-dev.json
 *
 *    3. Run:
 *       node seed-test-data.js service-account-dev.json
 *
 *    4. Check https://resitalaina-o-matai-test.web.app
 *
 *  WIPE ONLY (clears all existing test records first):
 *       node seed-test-data.js service-account-dev.json --wipe
 */

const admin = require("firebase-admin");
const path  = require("path");

const saPath = process.argv[2];
if (!saPath) {
  console.error("Usage: node seed-test-data.js <path-to-service-account.json> [--wipe]");
  process.exit(1);
}

const wipeOnly = process.argv.includes("--wipe");

const sa = require(path.resolve(saPath));
admin.initializeApp({ credential: admin.credential.cert(sa) });
const db = admin.firestore();

// ── Date helpers ──────────────────────────────────────────────
const today = new Date();
const fmt = (d) => {
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,"0")}-${String(x.getDate()).padStart(2,"0")}`;
};
const addM = (d, n) => { const x = new Date(d); x.setMonth(x.getMonth() + n); return x; };
const addD = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };

const T = {
  today:        fmt(today),
  minus1m:      fmt(addM(today, -1)),
  minus2m:      fmt(addM(today, -2)),
  minus3m:      fmt(addM(today, -3)),
  minus4m:      fmt(addM(today, -4)),
  minus5m:      fmt(addM(today, -5)),
  minus6m:      fmt(addM(today, -6)),
  minus12m:     fmt(addM(today, -12)),
  minus24m:     fmt(addM(today, -24)),
  plus1m:       fmt(addM(today, +1)),
  plus2m:       fmt(addM(today, +2)),
  dob30:        fmt(addD(today, -365 * 30)),
  dob45:        fmt(addD(today, -365 * 45)),
  dob60:        fmt(addD(today, -365 * 60)),
};

// ── Seed records ──────────────────────────────────────────────
// Covers every Notifications tab + Dashboard state
const records = [

  // ── 1. READY TO REGISTER (overdue) ────────────────────────
  // Savali published 5 months ago, no objection, not yet registered
  {
    _label: "READY-OVERDUE-1",
    mataiTitle: "FALEOLO", holderName: "Sione Faleolo Matu'u", gender: "Tane",
    mataiType: "Ali'i", village: "Leulumoega", district: "AANA ALOFI Nu.2",
    certItumalo: "8", certLaupepa: "19", certRegBook: "501",
    mataiCertNumber: "8/19/501",
    dateConferred: T.minus6m, dateOfficeReceived: fmt(addD(addM(today,-6), 5)),
    dateSavaliPublished: T.minus5m,
    dateRegistration: "", dateIssued: T.today, dateBirth: T.dob30,
    nuuFanau: "Apia", nuuMataiAi: "", familyTitles: "",
    faapogai: "SULI", notes: "Ready to register — overdue. Published 5 months ago.",
    intention: "no", objection: "no",
    status: "pending",
  },
  {
    _label: "READY-OVERDUE-2",
    mataiTitle: "TUPUA", holderName: "Iosefa Tupua Salave'a", gender: "Tane",
    mataiType: "Ali'i", village: "Lufilufi", district: "ANOAMAA SASA'E",
    certItumalo: "21", certLaupepa: "07", certRegBook: "212",
    mataiCertNumber: "21/07/212",
    dateConferred: T.minus5m, dateOfficeReceived: fmt(addD(addM(today,-5), 3)),
    dateSavaliPublished: T.minus4m,
    dateRegistration: "", dateIssued: T.today, dateBirth: T.dob45,
    nuuFanau: "Lufilufi", nuuMataiAi: "", familyTitles: "TUILAGI",
    faapogai: "SULI", notes: "4 months past Savali — ready to confirm registration.",
    intention: "no", objection: "no",
    status: "pending",
  },

  // ── 2. IN SAVALI PUBLICATION PERIOD (not yet ready) ────────
  // Savali published 1-2 months ago — still in 3-month window
  {
    _label: "IN-PERIOD-1",
    mataiTitle: "MALIETOA", holderName: "Falefou Malietoa Tanu", gender: "Tane",
    mataiType: "Ali'i", village: "Malie", district: "SAGAGA LE USOGA",
    certItumalo: "6", certLaupepa: "22", certRegBook: "318",
    mataiCertNumber: "6/22/318",
    dateConferred: T.minus3m, dateOfficeReceived: fmt(addD(addM(today,-3), 7)),
    dateSavaliPublished: T.minus2m,
    dateRegistration: "", dateIssued: T.today, dateBirth: T.dob30,
    nuuFanau: "Malie", nuuMataiAi: "", familyTitles: "",
    faapogai: "SULI", notes: "Still in Savali publication period — 1 month remaining.",
    intention: "no", objection: "no",
    status: "pending",
  },
  {
    _label: "IN-PERIOD-2",
    mataiTitle: "TAGALOA", holderName: "Aeau Tagaloa Faleupolu", gender: "Tane",
    mataiType: "Ali'i", village: "Faleasiu", district: "AANA ALOFI Nu.1",
    certItumalo: "7", certLaupepa: "14", certRegBook: "189",
    mataiCertNumber: "7/14/189",
    dateConferred: T.minus2m, dateOfficeReceived: fmt(addD(addM(today,-2), 4)),
    dateSavaliPublished: T.minus1m,
    dateRegistration: "", dateIssued: T.today, dateBirth: T.dob45,
    nuuFanau: "Faleasiu", nuuMataiAi: "", familyTitles: "",
    faapogai: "SULI", notes: "2 months in publication — not yet ready.",
    intention: "no", objection: "no",
    status: "pending",
  },

  // ── 3. OBJECTION FILED ──────────────────────────────────────
  {
    _label: "OBJECTION-1",
    mataiTitle: "FATA", holderName: "Leota Fata Savea", gender: "Tane",
    mataiType: "Tulafale", village: "Safata", district: "SAFATA",
    certItumalo: "13", certLaupepa: "08", certRegBook: "440",
    mataiCertNumber: "13/08/440",
    dateConferred: T.minus5m, dateOfficeReceived: fmt(addD(addM(today,-5), 6)),
    dateSavaliPublished: T.minus4m,
    dateRegistration: "", dateIssued: T.today, dateBirth: T.dob45,
    nuuFanau: "Safata", nuuMataiAi: "", familyTitles: "",
    faapogai: "SULI",
    notes: "Objection filed — pending court resolution.",
    intention: "no", objection: "yes",
    objectionDate: T.minus3m,
    objectionApplicationDate: T.minus3m,
    objectionApplicantName: "Tasi Savea Fata",
    objectionActingRegistrar: "Lealofi Tuilagi",
    objectionFileNumber: "OBJ-2025-0041",
    objectionLCNumber: "LC-2025-118",
    status: "pending",
  },
  {
    _label: "OBJECTION-2",
    mataiTitle: "LEATINU'U", holderName: "Peni Leatinu'u Sefo", gender: "Tane",
    mataiType: "Tulafale", village: "Falefa", district: "ANOAMAA SASA'E",
    certItumalo: "21", certLaupepa: "11", certRegBook: "302",
    mataiCertNumber: "21/11/302",
    dateConferred: T.minus6m, dateOfficeReceived: fmt(addD(addM(today,-6), 8)),
    dateSavaliPublished: T.minus5m,
    dateRegistration: "", dateIssued: T.today, dateBirth: T.dob60,
    nuuFanau: "Falefa", nuuMataiAi: "FALEOLO", familyTitles: "FALEOLO",
    faapogai: "SULI",
    notes: "LC case ongoing. File submitted.",
    intention: "no", objection: "yes",
    objectionDate: T.minus4m,
    objectionApplicationDate: T.minus4m,
    objectionApplicantName: "Alofa Sefo Leatinu'u",
    objectionActingRegistrar: "Taufa Moli",
    objectionFileNumber: "OBJ-2025-0027",
    objectionLCNumber: "LC-2025-095",
    status: "pending",
  },

  // ── 4. INTENTION PROCESS ───────────────────────────────────
  // Savali published BEFORE saofai (intention=yes)
  {
    _label: "INTENTION-PENDING",
    mataiTitle: "SOOAEMALELAGI", holderName: "Setope Sooaemalelagi", gender: "Tane",
    mataiType: "Ali'i", village: "Leulumoega", district: "AANA ALOFI Nu.2",
    certItumalo: "8", certLaupepa: "19", certRegBook: "388",
    mataiCertNumber: "8/19/388",
    // Savali published 5 months ago (before saofai), saofai happened 1 month ago
    dateSavaliPublished: T.minus5m,
    dateConferred: T.minus1m,
    dateOfficeReceived: fmt(addD(addM(today,-1), 5)),
    dateRegistration: "", dateIssued: T.today, dateBirth: T.dob30,
    nuuFanau: "Leulumoega", nuuMataiAi: "", familyTitles: "",
    faapogai: "SULI",
    notes: "Intention process — Savali published before Saofai. No objection received.",
    intention: "yes", objection: "no",
    status: "pending",
  },

  // ── 5. COMPLETED / REGISTERED ─────────────────────────────
  {
    _label: "COMPLETED-1",
    mataiTitle: "FIAME", holderName: "Naomi Fiame Mata'afa", gender: "Tamaitai",
    mataiType: "Ali'i", village: "Lufilufi", district: "ANOAMAA SASA'E",
    certItumalo: "21", certLaupepa: "05", certRegBook: "099",
    mataiCertNumber: "21/05/099",
    dateConferred: T.minus12m, dateOfficeReceived: fmt(addD(addM(today,-12), 4)),
    dateSavaliPublished: T.minus6m,
    dateRegistration: fmt(addD(addM(today,-3), 1)),
    dateIssued: T.today, dateBirth: T.dob45,
    nuuFanau: "Lufilufi", nuuMataiAi: "", familyTitles: "",
    faapogai: "SULI", notes: "Registered and certificate issued.",
    intention: "no", objection: "no",
    status: "completed",
  },
  {
    _label: "COMPLETED-2",
    mataiTitle: "VA'AIGA", holderName: "Tuilagi Va'aiga Siu", gender: "Tane",
    mataiType: "Tulafale", village: "Vailele", district: "VAIMAUGA SASA'E",
    certItumalo: "1", certLaupepa: "33", certRegBook: "711",
    mataiCertNumber: "1/33/711",
    dateConferred: T.minus24m, dateOfficeReceived: fmt(addD(addM(today,-24), 3)),
    dateSavaliPublished: fmt(addM(today, -10)),
    dateRegistration: fmt(addM(today, -7)),
    dateIssued: T.today, dateBirth: T.dob60,
    nuuFanau: "Vailele", nuuMataiAi: "", familyTitles: "TUILAGI",
    faapogai: "SULI", notes: "Old record — completed.",
    intention: "no", objection: "no",
    status: "completed",
  },
  {
    _label: "COMPLETED-3-FEMALE",
    mataiTitle: "FALEOLO", holderName: "Sala Faleolo Mau", gender: "Tamaitai",
    mataiType: "Ali'i", village: "Fasitoouta", district: "AANA ALOFI Nu.1",
    certItumalo: "7", certLaupepa: "28", certRegBook: "554",
    mataiCertNumber: "7/28/554",
    dateConferred: fmt(addM(today, -18)), dateOfficeReceived: fmt(addD(addM(today,-18), 6)),
    dateSavaliPublished: fmt(addM(today, -8)),
    dateRegistration: fmt(addM(today, -5)),
    dateIssued: T.today, dateBirth: T.dob45,
    nuuFanau: "Fasitoouta", nuuMataiAi: "", familyTitles: "",
    faapogai: "SULI", notes: "Female title holder — registered.",
    intention: "no", objection: "no",
    status: "completed",
  },

  // ── 6. NO SAVALI YET (New Matai — awaiting publication) ────
  {
    _label: "NEW-NO-SAVALI-1",
    mataiTitle: "AFAMASAGA", holderName: "Salafai Afamasaga Tupa'i", gender: "Tane",
    mataiType: "Ali'i", village: "Tanugamanono", district: "VAIMAUGA SISIFO",
    certItumalo: "2", certLaupepa: "41", certRegBook: "882",
    mataiCertNumber: "2/41/882",
    dateConferred: T.minus2m, dateOfficeReceived: fmt(addD(addM(today,-2), 3)),
    dateSavaliPublished: "", dateRegistration: "", dateIssued: T.today, dateBirth: T.dob30,
    nuuFanau: "Tanugamanono", nuuMataiAi: "", familyTitles: "",
    faapogai: "SULI", notes: "Saofai done, office received. Awaiting Savali publication.",
    intention: "no", objection: "no",
    status: "pending",
  },
  {
    _label: "NEW-NO-SAVALI-2",
    mataiTitle: "TUILAGI", holderName: "Lesa Tuilagi Fono", gender: "Tane",
    mataiType: "Tulafale", village: "Moataa", district: "VAIMAUGA SISIFO",
    certItumalo: "2", certLaupepa: "42", certRegBook: "903",
    mataiCertNumber: "2/42/903",
    dateConferred: T.minus1m, dateOfficeReceived: fmt(addD(addM(today,-1), 2)),
    dateSavaliPublished: "", dateRegistration: "", dateIssued: T.today, dateBirth: T.dob45,
    nuuFanau: "Moataa", nuuMataiAi: "FALEOLO", familyTitles: "FALEOLO",
    faapogai: "SULI", notes: "Recently conferred — not yet in Savali.",
    intention: "no", objection: "no",
    status: "pending",
  },

  // ── 7. DUPLICATE CERT NUMBER (for notifications → Duplicates tab) ──
  {
    _label: "DUP-A",
    mataiTitle: "MAUALAIVAO", holderName: "Fepuleai Maualaivao Asi", gender: "Tane",
    mataiType: "Ali'i", village: "Solosolo", district: "ANOAMAA SISIFO",
    certItumalo: "22", certLaupepa: "10", certRegBook: "777",
    mataiCertNumber: "22/10/777",
    dateConferred: fmt(addM(today,-14)), dateOfficeReceived: fmt(addD(addM(today,-14), 5)),
    dateSavaliPublished: fmt(addM(today,-8)),
    dateRegistration: fmt(addM(today,-5)), dateIssued: T.today, dateBirth: T.dob30,
    nuuFanau: "Solosolo", nuuMataiAi: "", familyTitles: "",
    faapogai: "SULI", notes: "DUPLICATE CERT TEST — same cert number as MAUALAIVAO-B.",
    intention: "no", objection: "no",
    status: "completed",
  },
  {
    _label: "DUP-B",
    mataiTitle: "MAUALAIVAO", holderName: "Ioane Maualaivao Lima", gender: "Tane",
    mataiType: "Ali'i", village: "Luatuanuu", district: "ANOAMAA SISIFO",
    certItumalo: "22", certLaupepa: "10", certRegBook: "777",
    mataiCertNumber: "22/10/777",
    dateConferred: fmt(addM(today,-20)), dateOfficeReceived: fmt(addD(addM(today,-20), 4)),
    dateSavaliPublished: fmt(addM(today,-14)),
    dateRegistration: fmt(addM(today,-11)), dateIssued: T.today, dateBirth: T.dob45,
    nuuFanau: "Luatuanuu", nuuMataiAi: "", familyTitles: "",
    faapogai: "SULI", notes: "DUPLICATE CERT TEST — same cert number as MAUALAIVAO-A.",
    intention: "no", objection: "no",
    status: "completed",
  },

  // ── 8. PHOTO ID UPLOADED (for testing photo ID display) ────
  {
    _label: "PHOTO-ID",
    mataiTitle: "LAFI", holderName: "Luisa Lafi Toleafoa", gender: "Tamaitai",
    mataiType: "Tulafale", village: "Apia", district: "VAIMAUGA SISIFO",
    certItumalo: "2", certLaupepa: "18", certRegBook: "420",
    mataiCertNumber: "2/18/420",
    dateConferred: T.minus3m, dateOfficeReceived: fmt(addD(addM(today,-3), 4)),
    dateSavaliPublished: T.minus2m,
    dateRegistration: "", dateIssued: T.today, dateBirth: T.dob45,
    nuuFanau: "Apia", nuuMataiAi: "", familyTitles: "",
    faapogai: "SULI", notes: "Test record with photo ID type set.",
    photoIdType: "passport", photoIdNumber: "PW123456", photoIdImage: "",
    intention: "no", objection: "no",
    status: "pending",
  },
];

// ─────────────────────────────────────────────────────────────
async function wipeCollection(colName) {
  const snap = await db.collection(colName).get();
  if (snap.empty) return;
  const batch = db.batch();
  snap.docs.forEach(d => batch.delete(d.ref));
  await batch.commit();
  console.log(`  ✓ Wiped ${snap.size} docs from "${colName}"`);
}

async function seed() {
  console.log("\n🌱 Matai Registry — Test Data Seed");
  console.log("  Project:", sa.project_id);
  console.log("  Records to seed:", records.length);
  console.log("  Wipe mode:", wipeOnly);
  console.log("");

  // Always wipe registrations before seeding
  process.stdout.write("  Wiping existing test registrations…");
  await wipeCollection("registrations");

  if (wipeOnly) {
    console.log("  ✓ Wipe complete. Exiting.\n");
    process.exit(0);
  }

  let ok = 0, fail = 0;
  for (const r of records) {
    const label = r._label;
    const { _label, ...data } = r;
    try {
      await db.collection("registrations").add({
        ...data,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      console.log(`  ✓ [${label}] ${data.mataiTitle} — ${data.holderName}`);
      ok++;
    } catch (err) {
      console.error(`  ✗ [${label}] FAILED: ${err.message}`);
      fail++;
    }
  }

  console.log(`\n  ✅ Done — ${ok} seeded, ${fail} failed`);
  console.log("\n  📋 What to test:\n");
  console.log("  Dashboard:");
  console.log("    • All records visible, filter by Completed / Pending");
  console.log("    • MAUALAIVAO appears twice (duplicate cert) — badge shows in Notifications");
  console.log("\n  Notifications → Proclamation:");
  console.log("    • MALIETOA, TAGALOA — in publication period (days remaining shown)");
  console.log("    • FALEOLO, TUPUA — OVERDUE (red)");
  console.log("\n  Notifications → Ready to Register:");
  console.log("    • FALEOLO, TUPUA — confirm registration → becomes Completed");
  console.log("\n  Notifications → Objections:");
  console.log("    • FATA, LEATINU'U — objection details visible");
  console.log("\n  Notifications → Duplicates:");
  console.log("    • MAUALAIVAO × 2 — same cert number 22/10/777");
  console.log("\n  Notifications → New Matai (no Savali yet):");
  console.log("    • AFAMASAGA, TUILAGI — no Savali date entered");
  console.log("\n  Certificate:");
  console.log("    • FIAME, VA'AIGA, FALEOLO (Sala) — completed, can print both Samoan & English");
  console.log("    • Verify no watermark, correct signature text");
  console.log("\n  Register form:");
  console.log("    • SOOAEMALELAGI — Intention=yes, verify Savali-before-Saofai validation");
  console.log("    • FATA — Objection fields all filled");
  console.log("    • AFAMASAGA — Office Date Received field visible\n");
  process.exit(0);
}

seed().catch(err => { console.error(err); process.exit(1); });

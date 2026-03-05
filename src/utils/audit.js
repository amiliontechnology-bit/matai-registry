import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db, auth } from "../firebase";

export async function logAudit(action, details = {}) {
  try {
    const user = auth.currentUser;
    await addDoc(collection(db, "auditLog"), {
      action,
      details,
      userEmail: user?.email || "unknown",
      userId: user?.uid || "unknown",
      timestamp: serverTimestamp()
    });
  } catch (err) {
    console.error("Audit log failed:", err);
  }
}

// Compare old and new record, return human-readable list of changes
export function diffRecords(oldRec, newRec) {
  const LABELS = {
    mataiTitle: "Matai Title", holderName: "Holder Name", gender: "Gender",
    mataiType: "Title Type", familyName: "Family Name", village: "Village",
    district: "District", dateConferred: "Date of Conferral",
    dateProclamation: "Date of Proclamation", dateRegistration: "Date of Registration",
    dateIssued: "Date Issued", refNumber: "Reference Number",
    faapogai: "Faapogai", notes: "Notes"
  };
  const changes = [];
  for (const key of Object.keys(LABELS)) {
    const oldVal = oldRec[key] || "";
    const newVal = newRec[key] || "";
    if (oldVal !== newVal) {
      changes.push(`${LABELS[key]}: "${oldVal}" → "${newVal}"`);
    }
  }
  return changes;
}

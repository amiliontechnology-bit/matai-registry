import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db, auth } from "../firebase";

// All possible action types
export const AUDIT_ACTIONS = {
  LOGIN:                    "LOGIN",
  LOGOUT:                   "LOGOUT",
  CREATE:                   "CREATE",
  UPDATE:                   "UPDATE",
  DELETE:                   "DELETE",
  PRINT:                    "PRINT",
  IMPORT:                   "IMPORT",
  EXPORT:                   "EXPORT",
  CREATE_USER:              "CREATE_USER",
  UPDATE_ROLE:              "UPDATE_ROLE",
  DELETE_USER:              "DELETE_USER",
  PASSWORD_RESET_REQUESTED: "PASSWORD_RESET_REQUESTED",
  NOTIFICATION_SENT:        "NOTIFICATION_SENT",
  VIEW_RECORD:              "VIEW_RECORD",
  VIEW_CERTIFICATE:         "VIEW_CERTIFICATE",
  SEARCH:                   "SEARCH",
  FILTER:                   "FILTER",
};

export async function logAudit(action, details = {}) {
  try {
    const user = auth.currentUser;
    await addDoc(collection(db, "auditLog"), {
      action,
      details: sanitizeDetails(details),
      userEmail:  user?.email  || "unknown",
      userId:     user?.uid    || "unknown",
      timestamp:  serverTimestamp(),
      sessionId:  getSessionId(),
    });
  } catch (err) {
    console.error("Audit log failed:", err);
  }
}

// Sanitize details — remove undefined/null values
function sanitizeDetails(details) {
  const clean = {};
  for (const [k, v] of Object.entries(details)) {
    if (v !== undefined && v !== null) clean[k] = v;
  }
  return clean;
}

// Generate a session ID stored in sessionStorage
function getSessionId() {
  let sid = sessionStorage.getItem("auditSessionId");
  if (!sid) {
    sid = `sess_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
    sessionStorage.setItem("auditSessionId", sid);
  }
  return sid;
}

// Compare old and new record — return human-readable list of changes
export function diffRecords(oldRec, newRec) {
  const LABELS = {
    mataiTitle:       "Matai Title",
    holderName:       "Holder Name",
    gender:           "Gender",
    mataiType:        "Title Type",
    familyName:       "Family Name",
    village:          "Village",
    district:         "District",
    dateConferred:    "Date of Conferral",
    dateSavaliPublished: "Savali Published Date",
    dateRegistration: "Date of Registration",
    dateIssued:       "Date Issued",
    mataiCertNumber:  "Matai Certificate Number",
    suli:             "Suli",
    faapogai:         "Faapogai",
    notes:            "Notes",
  };
  const changes = [];
  for (const key of Object.keys(LABELS)) {
    const oldVal = (oldRec[key] || "").toString().trim();
    const newVal = (newRec[key] || "").toString().trim();
    if (oldVal !== newVal) {
      const display_old = oldVal || "(empty)";
      const display_new = newVal || "(empty)";
      changes.push(`${LABELS[key]}: "${display_old}" → "${display_new}"`);
    }
  }
  return changes;
}

// Log page/record views (call from certificate/dashboard)
export function logView(recordId, mataiTitle) {
  return logAudit(AUDIT_ACTIONS.VIEW_CERTIFICATE, { recordId, mataiTitle });
}

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

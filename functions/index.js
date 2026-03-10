const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { beforeUserSignedIn } = require("firebase-functions/v2/identity");
const { setGlobalOptions } = require("firebase-functions/v2");
const admin = require("firebase-admin");
const { Resend } = require("resend");

admin.initializeApp();

// Set default region for all v2 functions
setGlobalOptions({ region: "australia-southeast1" });

const MAX_FAILED_ATTEMPTS = 5;

// ── Blocking function: check lockout before sign-in ───────────────────────
exports.beforeSignIn = beforeUserSignedIn(async (event) => {
  const user = event.data;
    const uid = user.uid;
    const userRef = admin.firestore().collection("users").doc(uid);
    const userDoc = await userRef.get();
    if (!userDoc.exists) return;

    const data = userDoc.data();
    if (data.lockedOut === true) {
      throw new HttpsError("permission-denied", "ACCOUNT_LOCKED");
    }

    // Reset failed login counter on successful sign-in
    if (data.failedLogins && data.failedLogins > 0) {
      await userRef.update({ failedLogins: 0 });
    }
  });

// ── Callable: record a failed login attempt ───────────────────────────────
// Called by the client after a wrong-password error.
// Looks up the user by email, increments failedLogins, locks at MAX_FAILED_ATTEMPTS.
exports.recordFailedLogin = onCall(async (request) => {
  const data = request.data;
    const { email } = data;
    if (!email) return { success: false };

    try {
      const authUser = await admin.auth().getUserByEmail(email);
      const uid = authUser.uid;
      const userRef = admin.firestore().collection("users").doc(uid);
      const userDoc = await userRef.get();
      if (!userDoc.exists) return { success: false };

      const current = userDoc.data().failedLogins || 0;
      const newCount = current + 1;
      const lockedOut = newCount >= MAX_FAILED_ATTEMPTS;

      await userRef.update({
        failedLogins: newCount,
        lockedOut,
        ...(lockedOut ? { lockedAt: admin.firestore.FieldValue.serverTimestamp() } : {}),
      });

      if (lockedOut) {
        await admin.firestore().collection("auditLog").add({
          action:    "ACCOUNT_LOCKED",
          targetEmail: email,
          targetUid:  uid,
          reason:    `${MAX_FAILED_ATTEMPTS} consecutive failed login attempts`,
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
        });
      }

      return { lockedOut, attemptsRemaining: Math.max(0, MAX_FAILED_ATTEMPTS - newCount) };
    } catch (err) {
      // Don't reveal whether the email exists
      return { success: false };
    }
  });

// ── Callable: unlock a user account (admin only) ──────────────────────────
exports.unlockUser = onCall(async (request) => {
  const { data, auth } = request;
    if (!auth) {
      throw new HttpsError("unauthenticated", "Must be logged in.");
    }

    const callerDoc = await admin.firestore()
      .collection("users").doc(auth.uid).get();
    if (!callerDoc.exists || callerDoc.data().role !== "admin") {
      throw new HttpsError("permission-denied", "Only admins can unlock accounts.");
    }

    const { uid } = data;
    if (!uid) throw new HttpsError("invalid-argument", "uid is required.");

    const targetUser = await admin.auth().getUser(uid);

    await admin.firestore().collection("users").doc(uid).update({
      lockedOut: false,
      failedLogins: 0,
      lockedAt: null,
    });

    await admin.firestore().collection("auditLog").add({
      action:      "ACCOUNT_UNLOCKED",
      targetUid:   uid,
      targetEmail: targetUser.email,
      unlockedBy:  auth.token.email || auth.uid,
      timestamp:   admin.firestore.FieldValue.serverTimestamp(),
    });

    return { success: true };
  });



exports.sendNotification = onCall(async (request) => {
  const { data, auth } = request;

    if (!auth) {
      throw new HttpsError("unauthenticated", "You must be logged in to send notifications.");
    }

    const { toEmail, subject, htmlBody, textBody } = data;

    if (!toEmail || !subject) {
      throw new HttpsError("invalid-argument", "toEmail and subject are required.");
    }

    const resend = new Resend(process.env.RESEND_API_KEY);

    try {
      const result = await resend.emails.send({
        from:    "Matai Registry <onboarding@resend.dev>",
        to:      [toEmail],
        subject: subject,
        html:    htmlBody || `<pre style="font-family:Georgia,serif">${textBody}</pre>`,
        text:    textBody || subject,
      });

      await admin.firestore().collection("auditLog").add({
        action:    "EMAIL_SENT",
        toEmail:   toEmail,
        subject:   subject,
        sentBy:    auth.token.email || auth.uid,
        resendId:  result.data?.id || null,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
      });

      return { success: true, id: result.data?.id };

    } catch (err) {
      console.error("Resend error:", err);
      throw new HttpsError("internal", err.message || "Failed to send email.");
    }
  });

// ── Admin: Disable / Enable a user account ────────────────────────────────
exports.toggleUserDisabled = onCall(async (request) => {
  const { data, auth } = request;

    if (!auth) {
      throw new HttpsError("unauthenticated", "Must be logged in.");
    }

    const callerDoc = await admin.firestore()
      .collection("users").doc(auth.uid).get();
    const callerRole = callerDoc.exists ? callerDoc.data().role : null;
    if (callerRole !== "admin") {
      throw new HttpsError("permission-denied", "Only admins can disable users.");
    }

    const { uid, disabled } = data;
    if (!uid || typeof disabled !== "boolean") {
      throw new HttpsError("invalid-argument", "uid and disabled (boolean) are required.");
    }

    // Prevent disabling yourself
    if (uid === auth.uid) {
      throw new HttpsError("failed-precondition", "You cannot disable your own account.");
    }

    const targetUser = await admin.auth().getUser(uid);
    await admin.auth().updateUser(uid, { disabled });

    // Mirror the disabled state in Firestore
    await admin.firestore().collection("users").doc(uid).update({ disabled });

    await admin.firestore().collection("auditLog").add({
      action:      disabled ? "USER_DISABLED" : "USER_ENABLED",
      targetUid:   uid,
      targetEmail: targetUser.email,
      setBy:       auth.token.email || auth.uid,
      timestamp:   admin.firestore.FieldValue.serverTimestamp(),
    });

    return { success: true };
  });

// ── Admin: Set a user's password directly ──────────────────────────────────
exports.setUserPassword = onCall(async (request) => {
  const { data, auth } = request;

    if (!auth) {
      throw new HttpsError("unauthenticated", "Must be logged in.");
    }

    const callerDoc = await admin.firestore()
      .collection("users")
      .doc(auth.uid)
      .get();

    const callerRole = callerDoc.exists ? callerDoc.data().role : null;
    if (callerRole !== "admin") {
      throw new HttpsError("permission-denied", "Only admins can set passwords.");
    }

    const { uid, newPassword } = data;

    if (!uid || !newPassword) {
      throw new HttpsError("invalid-argument", "uid and newPassword are required.");
    }
    if (newPassword.length < 8) {
      throw new HttpsError("invalid-argument", "Password must be at least 8 characters.");
    }

    // Get the target user's email for audit log
    let targetUser;
    try {
      targetUser = await admin.auth().getUser(uid);
    } catch (err) {
      throw new HttpsError("not-found", `User not found: ${err.message}`);
    }

    // Update the password via Admin SDK
    try {
      await admin.auth().updateUser(uid, { password: newPassword });
    } catch (err) {
      throw new HttpsError("invalid-argument", err.message || "Failed to update password.");
    }

    // Audit log
    await admin.firestore().collection("auditLog").add({
      action:     "PASSWORD_SET_BY_ADMIN",
      targetUid:  uid,
      targetEmail: targetUser.email,
      setBy:      auth.token.email || auth.uid,
      timestamp:  admin.firestore.FieldValue.serverTimestamp(),
    });

    return { success: true };
  });


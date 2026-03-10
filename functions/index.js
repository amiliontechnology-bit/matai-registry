const functions = require("firebase-functions");
const admin     = require("firebase-admin");
const { Resend } = require("resend");

admin.initializeApp();

const MAX_FAILED_ATTEMPTS = 5;

// ── Blocking function: check lockout before sign-in ───────────────────────
exports.beforeSignIn = functions
  .region("australia-southeast1")
  .auth.user().beforeSignIn(async (user) => {
    const uid = user.uid;
    const userRef = admin.firestore().collection("users").doc(uid);
    const userDoc = await userRef.get();
    if (!userDoc.exists) return;

    const data = userDoc.data();
    if (data.lockedOut === true) {
      throw new functions.auth.HttpsError(
        "permission-denied",
        "ACCOUNT_LOCKED"
      );
    }

    // Reset failed login counter on successful sign-in
    if (data.failedLogins && data.failedLogins > 0) {
      await userRef.update({ failedLogins: 0 });
    }
  });

// ── Callable: record a failed login attempt ───────────────────────────────
// Called by the client after a wrong-password error.
// Looks up the user by email, increments failedLogins, locks at MAX_FAILED_ATTEMPTS.
exports.recordFailedLogin = functions
  .region("australia-southeast1")
  .https.onCall(async (data) => {
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
exports.unlockUser = functions
  .region("australia-southeast1")
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError("unauthenticated", "Must be logged in.");
    }

    const callerDoc = await admin.firestore()
      .collection("users").doc(context.auth.uid).get();
    if (!callerDoc.exists || callerDoc.data().role !== "admin") {
      throw new functions.https.HttpsError("permission-denied", "Only admins can unlock accounts.");
    }

    const { uid } = data;
    if (!uid) throw new functions.https.HttpsError("invalid-argument", "uid is required.");

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
      unlockedBy:  context.auth.token.email || context.auth.uid,
      timestamp:   admin.firestore.FieldValue.serverTimestamp(),
    });

    return { success: true };
  });

const RESEND_API_KEY = "re_3cGfE5e2_51g9J53xGUzKeKwzhtsb273U";

exports.sendNotification = functions
  .region("australia-southeast1")
  .https.onCall(async (data, context) => {

    if (!context.auth) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "You must be logged in to send notifications."
      );
    }

    const { toEmail, subject, htmlBody, textBody } = data;

    if (!toEmail || !subject) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "toEmail and subject are required."
      );
    }

    const resend = new Resend(RESEND_API_KEY);

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
        sentBy:    context.auth.token.email || context.auth.uid,
        resendId:  result.data?.id || null,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
      });

      return { success: true, id: result.data?.id };

    } catch (err) {
      console.error("Resend error:", err);
      throw new functions.https.HttpsError("internal", err.message || "Failed to send email.");
    }
  });

// ── Admin: Disable / Enable a user account ────────────────────────────────
exports.toggleUserDisabled = functions
  .region("australia-southeast1")
  .https.onCall(async (data, context) => {

    if (!context.auth) {
      throw new functions.https.HttpsError("unauthenticated", "Must be logged in.");
    }

    const callerDoc = await admin.firestore()
      .collection("users").doc(context.auth.uid).get();
    const callerRole = callerDoc.exists ? callerDoc.data().role : null;
    if (callerRole !== "admin") {
      throw new functions.https.HttpsError("permission-denied", "Only admins can disable users.");
    }

    const { uid, disabled } = data;
    if (!uid || typeof disabled !== "boolean") {
      throw new functions.https.HttpsError("invalid-argument", "uid and disabled (boolean) are required.");
    }

    // Prevent disabling yourself
    if (uid === context.auth.uid) {
      throw new functions.https.HttpsError("failed-precondition", "You cannot disable your own account.");
    }

    const targetUser = await admin.auth().getUser(uid);
    await admin.auth().updateUser(uid, { disabled });

    // Mirror the disabled state in Firestore
    await admin.firestore().collection("users").doc(uid).update({ disabled });

    await admin.firestore().collection("auditLog").add({
      action:      disabled ? "USER_DISABLED" : "USER_ENABLED",
      targetUid:   uid,
      targetEmail: targetUser.email,
      setBy:       context.auth.token.email || context.auth.uid,
      timestamp:   admin.firestore.FieldValue.serverTimestamp(),
    });

    return { success: true };
  });

// ── Admin: Set a user's password directly ──────────────────────────────────
exports.setUserPassword = functions
  .region("australia-southeast1")
  .https.onCall(async (data, context) => {

    // Must be authenticated
    if (!context.auth) {
      throw new functions.https.HttpsError("unauthenticated", "Must be logged in.");
    }

    // Caller must be admin or standard_admin in Firestore
    const callerDoc = await admin.firestore()
      .collection("users")
      .doc(context.auth.uid)
      .get();

    const callerRole = callerDoc.exists ? callerDoc.data().role : null;
    if (callerRole !== "admin") {
      throw new functions.https.HttpsError("permission-denied", "Only admins can set passwords.");
    }

    const { uid, newPassword } = data;

    if (!uid || !newPassword) {
      throw new functions.https.HttpsError("invalid-argument", "uid and newPassword are required.");
    }
    if (newPassword.length < 6) {
      throw new functions.https.HttpsError("invalid-argument", "Password must be at least 6 characters.");
    }

    // Get the target user's email for audit log
    const targetUser = await admin.auth().getUser(uid);

    // Update the password via Admin SDK
    await admin.auth().updateUser(uid, { password: newPassword });

    // Audit log
    await admin.firestore().collection("auditLog").add({
      action:     "PASSWORD_SET_BY_ADMIN",
      targetUid:  uid,
      targetEmail: targetUser.email,
      setBy:      context.auth.token.email || context.auth.uid,
      timestamp:  admin.firestore.FieldValue.serverTimestamp(),
    });

    return { success: true };
  });


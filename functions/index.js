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
      throw new functions.auth.HttpsError("permission-denied", "ACCOUNT_LOCKED");
    }

    if (data.failedLogins && data.failedLogins > 0) {
      await userRef.update({ failedLogins: 0 });
    }
  });

// ── Callable: record a failed login attempt ───────────────────────────────
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
          action:      "ACCOUNT_LOCKED",
          targetEmail: email,
          targetUid:   uid,
          reason:      `${MAX_FAILED_ATTEMPTS} consecutive failed login attempts`,
          timestamp:   admin.firestore.FieldValue.serverTimestamp(),
        });
      }

      return { lockedOut, attemptsRemaining: Math.max(0, MAX_FAILED_ATTEMPTS - newCount) };
    } catch (err) {
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

// ── Callable: send notification email ─────────────────────────────────────
exports.sendNotification = functions
  .region("australia-southeast1")
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError("unauthenticated", "You must be logged in to send notifications.");
    }

    const { toEmail, subject, htmlBody, textBody } = data;
    if (!toEmail || !subject) {
      throw new functions.https.HttpsError("invalid-argument", "toEmail and subject are required.");
    }

    // API key injected at deploy time via functions/.env (never committed to git)
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

    if (uid === context.auth.uid) {
      throw new functions.https.HttpsError("failed-precondition", "You cannot disable your own account.");
    }

    const targetUser = await admin.auth().getUser(uid);
    await admin.auth().updateUser(uid, { disabled });
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

// ── Admin: Set a user's password directly ─────────────────────────────────
exports.setUserPassword = functions
  .region("australia-southeast1")
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError("unauthenticated", "Must be logged in.");
    }

    const callerDoc = await admin.firestore()
      .collection("users").doc(context.auth.uid).get();
    const callerRole = callerDoc.exists ? callerDoc.data().role : null;
    if (callerRole !== "admin") {
      throw new functions.https.HttpsError("permission-denied", "Only admins can set passwords.");
    }

    const { uid, newPassword } = data;
    if (!uid || !newPassword) {
      throw new functions.https.HttpsError("invalid-argument", "uid and newPassword are required.");
    }
    if (newPassword.length < 8) {
      throw new functions.https.HttpsError("invalid-argument", "Password must be at least 8 characters.");
    }

    let targetUser;
    try {
      targetUser = await admin.auth().getUser(uid);
    } catch (err) {
      console.error("getUser error:", err.code, err.message);
      throw new functions.https.HttpsError("not-found", `User not found: ${err.message}`);
    }

    try {
      await admin.auth().updateUser(uid, { password: newPassword, emailVerified: true });
    } catch (err) {
      console.error("updateUser error:", JSON.stringify({ code: err.code, message: err.message, errorInfo: err.errorInfo }));
      const msg = err?.errorInfo?.message || err?.message || "Failed to update password.";
      throw new functions.https.HttpsError("invalid-argument", msg);
    }

    // Audit log — wrapped so a failure here does not break the response
    try {
      await admin.firestore().collection("auditLog").add({
        action:      "PASSWORD_SET_BY_ADMIN",
        targetUid:   uid,
        targetEmail: targetUser.email,
        setBy:       context.auth.token.email || context.auth.uid,
        timestamp:   admin.firestore.FieldValue.serverTimestamp(),
      });
    } catch (err) {
      console.error("auditLog write failed:", err.message);
    }

    return { success: true };
  });

exports.verifyUserEmail = functions
  .region("australia-southeast1")
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError("unauthenticated", "Must be logged in.");
    }
    const callerDoc = await admin.firestore()
      .collection("users").doc(context.auth.uid).get();
    const callerRole = callerDoc.exists ? callerDoc.data().role : null;
    if (callerRole !== "admin") {
      throw new functions.https.HttpsError("permission-denied", "Only admins can verify emails.");
    }
    const { uid } = data;
    if (!uid) {
      throw new functions.https.HttpsError("invalid-argument", "uid is required.");
    }
    await admin.auth().updateUser(uid, { emailVerified: true });
    return { success: true };
  });

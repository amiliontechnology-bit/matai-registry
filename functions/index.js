const functions = require("firebase-functions");
const admin     = require("firebase-admin");
const { Resend } = require("resend");

admin.initializeApp();

// ─────────────────────────────────────────────────────────
//  sendNotification — callable Firebase Function
//  Called from the React app to send notification emails
//  via Resend. The Resend API key is stored securely in
//  Firebase environment config, never exposed to the client.
//
//  Deploy:
//    firebase functions:config:set resend.api_key="re_YOUR_KEY"
//    firebase deploy --only functions
// ─────────────────────────────────────────────────────────

exports.sendNotification = functions
  .region("australia-southeast1")
  .https.onCall(async (data, context) => {

    // Must be authenticated
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

    // Get API key from Firebase config
    const apiKey = functions.config().resend?.api_key;
    if (!apiKey) {
      throw new functions.https.HttpsError(
        "failed-precondition",
        "Resend API key not configured. Run: firebase functions:config:set resend.api_key=\"re_YOUR_KEY\""
      );
    }

    const resend = new Resend(apiKey);

    try {
      const result = await resend.emails.send({
        from:    "Matai Registry <onboarding@resend.dev>",
        to:      [toEmail],
        subject: subject,
        html:    htmlBody  || `<pre style="font-family:Georgia,serif">${textBody}</pre>`,
        text:    textBody  || subject,
      });

      // Log to Firestore audit
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

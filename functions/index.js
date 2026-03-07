const functions = require("firebase-functions");
const admin     = require("firebase-admin");
const { Resend } = require("resend");

admin.initializeApp();

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

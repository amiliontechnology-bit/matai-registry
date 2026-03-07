// ─────────────────────────────────────────────────────────
//  EmailJS integration — sends notification emails directly
//  from the browser using your EmailJS account.
//
//  Setup (one-time):
//   1. Go to https://www.emailjs.com — sign up free
//   2. Add an Email Service (connect your Gmail/Outlook)
//   3. Create an Email Template with these variables:
//        {{to_email}}  {{subject}}  {{message}}  {{from_name}}
//   4. Copy your Service ID, Template ID, Public Key below
// ─────────────────────────────────────────────────────────

import emailjs from "@emailjs/browser";

// ⚠ Replace these with your real EmailJS credentials
export const EMAILJS_CONFIG = {
  serviceId:  "YOUR_SERVICE_ID",   // e.g. "service_abc123"
  templateId: "YOUR_TEMPLATE_ID",  // e.g. "template_xyz456"
  publicKey:  "YOUR_PUBLIC_KEY",   // e.g. "abcDEF123xyz"
};

export function isEmailJSConfigured() {
  return (
    EMAILJS_CONFIG.serviceId  !== "YOUR_SERVICE_ID" &&
    EMAILJS_CONFIG.templateId !== "YOUR_TEMPLATE_ID" &&
    EMAILJS_CONFIG.publicKey  !== "YOUR_PUBLIC_KEY"
  );
}

/**
 * Send an email via EmailJS
 * @param {string} toEmail
 * @param {string} subject
 * @param {string} message   — plain text body
 * @param {string} fromName
 */
export async function sendEmail({ toEmail, subject, message, fromName = "Matai Registry" }) {
  if (!isEmailJSConfigured()) {
    throw new Error("EmailJS is not configured. Please update src/utils/email.js with your credentials.");
  }

  return emailjs.send(
    EMAILJS_CONFIG.serviceId,
    EMAILJS_CONFIG.templateId,
    {
      to_email:  toEmail,
      subject:   subject,
      message:   message,
      from_name: fromName,
      reply_to:  toEmail,
    },
    EMAILJS_CONFIG.publicKey
  );
}

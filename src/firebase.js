import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { initializeAppCheck, ReCaptchaV3Provider } from "firebase/app-check";

const firebaseConfig = {
  apiKey:            process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain:        process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId:         process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket:     process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId:             process.env.REACT_APP_FIREBASE_APP_ID,
};

export const app  = initializeApp(firebaseConfig);
export const db   = getFirestore(app);
export const auth = getAuth(app);

// App Check — protects against unauthorised API abuse
// Prod:  uses reCAPTCHA v3 (REACT_APP_RECAPTCHA_SITE_KEY)
// Test:  uses debug token  (REACT_APP_APPCHECK_DEBUG_TOKEN=true)
//        Firebase auto-generates a debug token and logs it to the console.
//        Register that token in Firebase Console → App Check → Apps → debug tokens.
const debugToken = process.env.REACT_APP_APPCHECK_DEBUG_TOKEN;
const siteKey    = process.env.REACT_APP_RECAPTCHA_SITE_KEY;

if (debugToken) {
  // eslint-disable-next-line no-restricted-globals
  self.FIREBASE_APPCHECK_DEBUG_TOKEN = debugToken === "true" ? true : debugToken;
}

if (siteKey || debugToken) {
  initializeAppCheck(app, {
    // When debug token is active Firebase bypasses reCAPTCHA entirely.
    // siteKey falls back to "debug-placeholder" so the provider can still init.
    provider: new ReCaptchaV3Provider(siteKey || "debug-placeholder"),
    isTokenAutoRefreshEnabled: true,
  });
}

// Secondary app used ONLY for creating new users
// This prevents the admin from being signed out when creating a new user
const secondaryApp = initializeApp(firebaseConfig, "secondary");
export const secondaryAuth = getAuth(secondaryApp);

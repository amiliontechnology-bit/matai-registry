import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
// import { initializeAppCheck, ReCaptchaV3Provider } from "firebase/app-check"; // Re-enable with App Check

// Firebase config — values are public by design (Firebase API keys are not secrets)
// They are also passed as env vars in CI so the build always has them
const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY            || "AIzaSyBA5afvNbvfkMrFFaaVBR7kcGFWOyxzoCk",
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN        || "resitalaina-o-matai.firebaseapp.com",
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID         || "resitalaina-o-matai",
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET     || "resitalaina-o-matai.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "1066492699678",
  appId:             import.meta.env.VITE_FIREBASE_APP_ID             || "1:1066492699678:web:e2e6e0859d192be347ba0f",
};

export const app  = initializeApp(firebaseConfig);
export const db   = getFirestore(app);
export const auth = getAuth(app);

// App Check — temporarily disabled pending reCAPTCHA v3 key verification
// Re-enable once correct v3 key is confirmed working in Google reCAPTCHA admin
// const siteKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY;
// if (siteKey) {
//   initializeAppCheck(app, {
//     provider: new ReCaptchaV3Provider(siteKey),
//     isTokenAutoRefreshEnabled: true,
//   });
// }

// Secondary app used ONLY for creating new users
// This prevents the admin from being signed out when creating a new user
const secondaryApp = initializeApp(firebaseConfig, "secondary");
export const secondaryAuth = getAuth(secondaryApp);

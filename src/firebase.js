import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyBA5afvNbvfkMrFFaaVBR7kcGFWOyxzoCk",
  authDomain: "resitalaina-o-matai.web.app",
  projectId: "resitalaina-o-matai",
  storageBucket: "resitalaina-o-matai.firebasestorage.app",
  messagingSenderId: "1066492699678",
  appId: "1:1066492699678:web:e2e6e0859d192be347ba0f"
};

export const app = initializeApp(firebaseConfig);
export const db  = getFirestore(app);
export const auth = getAuth(app);

// Secondary app used ONLY for creating new users
// This prevents the admin from being signed out when creating a new user
const secondaryApp = initializeApp(firebaseConfig, "secondary");
export const secondaryAuth = getAuth(secondaryApp);

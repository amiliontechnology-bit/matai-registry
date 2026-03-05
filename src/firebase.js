// src/firebase.js
// ─────────────────────────────────────────────────────────────
// SETUP INSTRUCTIONS:
// 1. Go to https://console.firebase.google.com
// 2. Create a new project (e.g. "matai-registry")
// 3. Click "Web" icon to add a web app
// 4. Copy your firebaseConfig values below
// 5. In Firebase console → Firestore Database → Create database (Start in production mode)
// 6. In Firebase console → Authentication → Sign-in method → Enable Email/Password
// 7. In Firestore → Rules, paste:
//
//    rules_version = '2';
//    service cloud.firestore {
//      match /databases/{database}/documents {
//        match /registrations/{doc} {
//          allow read, write: if request.auth != null;
//        }
//      }
//    }
// ─────────────────────────────────────────────────────────────

import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyBA5afvNbvfkMrFFaaVBR7kcGFWOyxzoCk",
  authDomain: "resitalaina-o-matai.firebaseapp.com",
  projectId: "resitalaina-o-matai",
  storageBucket: "resitalaina-o-matai.firebasestorage.app",
  messagingSenderId: "1066492699678",
  appId: "1:1066492699678:web:e2e6e0859d192be347ba0f"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);

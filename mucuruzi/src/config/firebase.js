// ============================================================
// firebase.js — Mucuruzi Firebase Initialization
// ============================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getAuth,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  getFirestore,
  enableIndexedDbPersistence,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAyBXSDWakPZYLTbnD-EtINzx1ylybtKMk",
  authDomain: "ebmrwanda-492ea.firebaseapp.com",
  projectId: "ebmrwanda-492ea",
  storageBucket: "ebmrwanda-492ea.firebasestorage.app",
  messagingSenderId: "231667451559",
  appId: "1:231667451559:web:a6501ff0f39f6e938f3d82",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Auth instance
export const auth = getAuth(app);

// Firestore instance
export const db = getFirestore(app);

// Enable offline persistence (IndexedDB)
enableIndexedDbPersistence(db).catch((err) => {
  if (err.code === "failed-precondition") {
    // Multiple tabs open — persistence only works in one tab at a time
    console.warn(
      "[Mucuruzi] Offline persistence unavailable: multiple tabs open."
    );
  } else if (err.code === "unimplemented") {
    // Browser does not support IndexedDB
    console.warn(
      "[Mucuruzi] Offline persistence not supported in this browser."
    );
  }
});

export default app;

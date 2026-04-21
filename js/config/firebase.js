// ============================================================
//  MUCURUZI — Firebase Configuration
//  Initializes Firebase app, Auth, and Firestore
//  Enables offline persistence for weak internet areas
// ============================================================

const firebaseConfig = {
  apiKey:            "AIzaSyDrsQ0POTuxvsRzsK0jCpHLStNpkE4v8kI",
  authDomain:        "shyaka-b1213.firebaseapp.com",
  projectId:         "shyaka-b1213",
  storageBucket:     "shyaka-b1213.firebasestorage.app",
  messagingSenderId: "426082280139",
  appId:             "1:426082280139:web:8a49256a2445d665d3f14e",
  measurementId:     "G-NPWV43C3D7"
};

// ── Initialize Firebase ──────────────────────────────────────
firebase.initializeApp(firebaseConfig);

// ── Auth ─────────────────────────────────────────────────────
const auth = firebase.auth();

// ── Firestore ────────────────────────────────────────────────
const db = firebase.firestore();

// ── Offline Persistence ──────────────────────────────────────
// Allows businesses with weak internet to continue working.
// Data syncs automatically when connection is restored.
db.enablePersistence({ synchronizeTabs: true })
  .then(() => {
    console.log('[Mucuruzi] Offline persistence enabled.');
  })
  .catch((err) => {
    if (err.code === 'failed-precondition') {
      // Multiple tabs open — persistence only works in one tab at a time.
      console.warn('[Mucuruzi] Offline persistence unavailable: multiple tabs open.');
    } else if (err.code === 'unimplemented') {
      // Browser does not support persistence.
      console.warn('[Mucuruzi] Offline persistence not supported in this browser.');
    }
  });

// ── Firestore Collection References ─────────────────────────
// Centralized so we never mistype a collection name anywhere.
const Collections = {
  USERS:      'users',
  PRODUCTS:   'products',
  STOCK:      'stock',
  ORDERS:     'orders',
  INVOICES:   'invoices',
  LISTINGS:   'listings',
};

// ── Firestore Helpers ────────────────────────────────────────
const serverTimestamp = () => firebase.firestore.FieldValue.serverTimestamp();
const increment       = (n) => firebase.firestore.FieldValue.increment(n);
const arrayUnion      = (...items) => firebase.firestore.FieldValue.arrayUnion(...items);
const deleteField     = () => firebase.firestore.FieldValue.delete();

console.log('[Mucuruzi] Firebase initialized. Project:', firebaseConfig.projectId);

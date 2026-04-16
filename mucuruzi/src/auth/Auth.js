// ============================================================
// Auth.js — Mucuruzi Authentication Logic
// ============================================================

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

import {
  doc,
  setDoc,
  getDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

import { auth, db } from "../config/firebase.js";

// ─── ROLES ───────────────────────────────────────────────────
export const ROLES = {
  MANUFACTURER: "manufacturer",
  DISTRIBUTOR: "distributor",
  RETAILER: "retailer",
  BUYER: "buyer",
};

// Business roles that require full registration fields
export const BUSINESS_ROLES = [
  ROLES.MANUFACTURER,
  ROLES.DISTRIBUTOR,
  ROLES.RETAILER,
];

// ─── REGISTER ────────────────────────────────────────────────
/**
 * Register a new user.
 * @param {Object} data - Registration form data
 * @returns {Object} { success: true, user } | { success: false, error: string }
 */
export async function register(data) {
  try {
    const {
      email,
      password,
      role,
      name,           // buyer
      businessName,   // business roles
      ownerName,      // business roles
      phone,
      tinNumber,      // business roles
      sdcId,          // business roles
    } = data;

    // 1. Create Firebase Auth account
    const credential = await createUserWithEmailAndPassword(auth, email, password);
    const uid = credential.user.uid;

    // 2. Build Firestore user profile
    const isBusinessRole = BUSINESS_ROLES.includes(role);

    const userProfile = {
      uid,
      email,
      role,
      phone,
      createdAt: serverTimestamp(),
      // Manufacturer starts as pending; others are active immediately
      status: role === ROLES.MANUFACTURER ? "pending" : "active",
    };

    if (isBusinessRole) {
      userProfile.businessName = businessName;
      userProfile.ownerName = ownerName;
      userProfile.tinNumber = tinNumber;
      userProfile.sdcId = sdcId || "";
    } else {
      // Buyer
      userProfile.name = name;
      userProfile.tinNumber = "";
      userProfile.sdcId = "";
    }

    // 3. Save to Firestore users collection
    await setDoc(doc(db, "users", uid), userProfile);

    return { success: true, user: userProfile };
  } catch (err) {
    return { success: false, error: _formatError(err.code) };
  }
}

// ─── LOGIN ───────────────────────────────────────────────────
/**
 * Sign in an existing user.
 * @param {string} email
 * @param {string} password
 * @returns {Object} { success: true, user, profile } | { success: false, error }
 */
export async function login(email, password) {
  try {
    const credential = await signInWithEmailAndPassword(auth, email, password);
    const uid = credential.user.uid;

    // Fetch Firestore profile
    const profileSnap = await getDoc(doc(db, "users", uid));

    if (!profileSnap.exists()) {
      await signOut(auth);
      return { success: false, error: "Account profile not found. Contact support." };
    }

    const profile = profileSnap.data();

    // Block pending manufacturers
    if (profile.status === "pending") {
      await signOut(auth);
      return {
        success: false,
        error: "Your manufacturer account is awaiting admin approval.",
      };
    }

    return { success: true, user: credential.user, profile };
  } catch (err) {
    return { success: false, error: _formatError(err.code) };
  }
}

// ─── LOGOUT ──────────────────────────────────────────────────
export async function logout() {
  try {
    await signOut(auth);
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// ─── RESET PASSWORD ──────────────────────────────────────────
/**
 * Send a password reset email.
 * @param {string} email
 */
export async function resetPassword(email) {
  try {
    await sendPasswordResetEmail(auth, email);
    return { success: true };
  } catch (err) {
    return { success: false, error: _formatError(err.code) };
  }
}

// ─── AUTH STATE LISTENER ─────────────────────────────────────
/**
 * Subscribe to auth state changes.
 * @param {Function} callback - receives { user, profile } or null
 */
export function onAuthChange(callback) {
  return onAuthStateChanged(auth, async (user) => {
    if (!user) {
      callback(null);
      return;
    }

    const profileSnap = await getDoc(doc(db, "users", user.uid));
    if (profileSnap.exists()) {
      callback({ user, profile: profileSnap.data() });
    } else {
      callback(null);
    }
  });
}

// ─── GET CURRENT USER PROFILE ────────────────────────────────
export async function getCurrentProfile() {
  const user = auth.currentUser;
  if (!user) return null;

  const snap = await getDoc(doc(db, "users", user.uid));
  return snap.exists() ? snap.data() : null;
}

// ─── PRIVATE: FORMAT FIREBASE ERROR CODES ────────────────────
function _formatError(code) {
  const messages = {
    "auth/email-already-in-use": "An account with this email already exists.",
    "auth/invalid-email": "Please enter a valid email address.",
    "auth/weak-password": "Password must be at least 6 characters.",
    "auth/user-not-found": "No account found with this email.",
    "auth/wrong-password": "Incorrect password. Please try again.",
    "auth/too-many-requests": "Too many attempts. Please try again later.",
    "auth/network-request-failed": "Network error. Check your connection.",
    "auth/user-disabled": "This account has been disabled.",
  };
  return messages[code] || "Something went wrong. Please try again.";
  }

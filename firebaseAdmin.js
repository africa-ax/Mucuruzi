// ============================================================
//  MUCURUZI — api/utils/firebaseAdmin.js
//  Initializes Firebase Admin SDK using Vercel environment variables.
//
//  Environment variables required in Vercel dashboard:
//    FIREBASE_PROJECT_ID    → from Service Account JSON
//    FIREBASE_CLIENT_EMAIL  → from Service Account JSON
//    FIREBASE_PRIVATE_KEY   → from Service Account JSON
//
//  How to get these:
//    Firebase Console → Project Settings → Service Accounts
//    → Generate New Private Key → download JSON
//    Copy values into Vercel Environment Variables
// ============================================================

import admin from 'firebase-admin';

// Only initialize once — Vercel may reuse function instances
if (!admin.apps.length) {
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (!privateKey) {
    throw new Error(
      'FIREBASE_PRIVATE_KEY is not set. ' +
      'Add it to Vercel Environment Variables.'
    );
  }

  admin.initializeApp({
    credential: admin.credential.cert({
      projectId:   process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      // Vercel stores \n as literal \\n — this fixes it
      privateKey:  privateKey.replace(/\\n/g, '\n'),
    }),
  });
}

// Firestore admin instance — bypasses all security rules
export const adminDb = admin.firestore();

// Auth admin instance — verifies ID tokens
export const adminAuth = admin.auth();

export default admin;

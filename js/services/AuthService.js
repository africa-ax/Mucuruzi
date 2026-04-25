// ============================================================
//  MUCURUZI — AuthService.js
//  Handles all Firebase Authentication operations.
//
//  Methods:
//    AuthService.register(userData)
//    AuthService.login(email, password)
//    AuthService.loginWithGoogle()
//    AuthService.logout()
//    AuthService.sendPasswordReset(email)
//    AuthService.onAuthStateChanged(callback)
//    AuthService.getCurrentUser()
// ============================================================

const AuthService = (() => {

  // ── Flag: blocks onAuthStateChanged during registration ───────
  // Firebase fires onAuthStateChanged the moment the Auth user is
  // created — BEFORE the Firestore profile is saved. This flag
  // tells onAuthStateChanged to ignore that premature event.
  let _isRegistering = false;

  // ── Private: Save user profile to Firestore ──────────────────
  const _saveUserProfile = async (uid, profileData) => {
    await db.collection(Collections.USERS).doc(uid).set({
      ...profileData,
      uid,
      createdAt: serverTimestamp(),
    });
  };

  // ── Private: Get user profile from Firestore ─────────────────
  const _getUserProfile = async (uid) => {
    const doc = await db.collection(Collections.USERS).doc(uid).get();
    return doc.exists ? doc.data() : null;
  };

  // ── 1. Register ───────────────────────────────────────────────
  const register = async (userData) => {
    let createdAuthUser = null;

    try {
      const {
        email, password, businessName,
        role, phone, district,
        tinNumber = '', sdcId = '',
      } = userData;

      // Block onAuthStateChanged from firing during registration.
      // Firebase fires it the moment Auth user is created —
      // BEFORE Firestore profile is saved. Without this flag,
      // the app would redirect to login with no profile found.
      _isRegistering = true;

      // STEP 1 — Create Firebase Auth user
      const credential = await auth.createUserWithEmailAndPassword(email, password);
      createdAuthUser = credential.user;
      const uid = createdAuthUser.uid;

      // STEP 2 — Build profile object
      const isSeller = ROLE_CAN_SELL.includes(role);

      const profile = {
        uid,
        businessName: businessName.trim(),
        email:        email.trim().toLowerCase(),
        role,
        phone:        phone.trim(),
        district:     district.trim(),
        tinNumber:    isSeller ? tinNumber.trim() : '',
        sdcId:        isSeller ? sdcId.trim()     : '',
        photoURL:     '',
        isActive:     true,
      };

      // STEP 3 — Save Firestore profile
      // Use { merge: false } to ensure a clean write
      await db.collection(Collections.USERS).doc(uid).set({
        ...profile,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      });

      // STEP 4 — Release flag now that profile exists
      _isRegistering = false;

      return { success: true, user: profile };

    } catch (err) {
      _isRegistering = false;

      // ── ROLLBACK ──────────────────────────────────────────────
      // If Auth user was created but Firestore save failed,
      // delete the Auth user so they are not stuck.
      // Without this, second attempt shows "email already in use".
      if (createdAuthUser) {
        try {
          await createdAuthUser.delete();
          console.warn('[AuthService] Auth user rolled back after Firestore failure.');
        } catch (deleteErr) {
          console.error('[AuthService] Rollback failed:', deleteErr.message);
        }
      }

      return { success: false, error: _parseAuthError(err) };
    }
  };

  // ── 2. Login with Email/Password ──────────────────────────────
  const login = async (email, password) => {
    try {
      const credential = await auth.signInWithEmailAndPassword(email, password);
      const profile = await _getUserProfile(credential.user.uid);

      if (!profile) {
        await auth.signOut();
        return { success: false, error: 'Account profile not found. Please register.' };
      }

      return { success: true, user: profile };

    } catch (err) {
      return { success: false, error: _parseAuthError(err) };
    }
  };

  // ── 3. Login with Google ──────────────────────────────────────
  const loginWithGoogle = async () => {
    try {
      const provider = new firebase.auth.GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });

      const credential = await auth.signInWithPopup(provider);
      const uid = credential.user.uid;

      const profile = await _getUserProfile(uid);

      if (!profile) {
        await auth.signOut();
        return {
          success:           false,
          needsRegistration: true,
          error:             'No account found for this Google account. Please register first.',
        };
      }

      return { success: true, user: profile };

    } catch (err) {
      return { success: false, error: _parseAuthError(err) };
    }
  };

  // ── 4. Logout ─────────────────────────────────────────────────
  const logout = async () => {
    try {
      await auth.signOut();
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  };

  // ── 5. Send Password Reset Email ──────────────────────────────
  const sendPasswordReset = async (email) => {
    try {
      if (!email || !email.trim()) {
        return { success: false, error: 'Please enter your email address.' };
      }
      await auth.sendPasswordResetEmail(email.trim().toLowerCase());
      return {
        success: true,
        message: `Password reset link sent to ${email}. Check your inbox.`,
      };
    } catch (err) {
      return { success: false, error: _parseAuthError(err) };
    }
  };

  // ── 6. Auth State Listener ────────────────────────────────────
  // Ignores events fired during registration (_isRegistering flag).
  const onAuthStateChanged = (callback) => {
    return auth.onAuthStateChanged(async (firebaseUser) => {

      // Ignore premature event fired during registration
      if (_isRegistering) {
        console.log('[AuthService] Skipping onAuthStateChanged — registration in progress.');
        return;
      }

      if (firebaseUser) {
        const profile = await _getUserProfile(firebaseUser.uid);
        callback(profile || null);
      } else {
        callback(null);
      }
    });
  };

  // ── 7. Get Current User ───────────────────────────────────────
  const getCurrentUser = () => auth.currentUser;

  // ── Private: Parse Firebase Auth Errors ──────────────────────
  const _parseAuthError = (err) => {
    const map = {
      'auth/email-already-in-use':    'This email is already registered.',
      'auth/invalid-email':           'Invalid email address.',
      'auth/weak-password':           'Password must be at least 6 characters.',
      'auth/user-not-found':          'No account found with this email.',
      'auth/wrong-password':          'Incorrect password.',
      'auth/too-many-requests':       'Too many attempts. Please try again later.',
      'auth/network-request-failed':  'Network error. Check your connection.',
      'auth/popup-closed-by-user':    'Google sign-in was cancelled.',
      'auth/cancelled-popup-request': 'Google sign-in was cancelled.',
      'auth/invalid-credential':      'Invalid credentials. Please try again.',
    };
    return map[err.code] || err.message || 'Something went wrong. Please try again.';
  };

  // ── Public API ────────────────────────────────────────────────
  return {
    register,
    login,
    loginWithGoogle,
    logout,
    sendPasswordReset,
    onAuthStateChanged,
    getCurrentUser,
  };

})();

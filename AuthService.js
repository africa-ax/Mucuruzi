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
  /**
   * Creates a new Firebase Auth user and saves profile to Firestore.
   *
   * @param {Object} userData
   * @param {string} userData.email
   * @param {string} userData.password
   * @param {string} userData.businessName
   * @param {string} userData.role          - from ROLES constant
   * @param {string} userData.phone
   * @param {string} userData.district
   * @param {string} [userData.tinNumber]   - required for seller roles
   * @param {string} [userData.sdcId]       - required for seller roles
   *
   * @returns {Promise<{success: boolean, user?: Object, error?: string}>}
   */
  const register = async (userData) => {
    try {
      const {
        email, password, businessName,
        role, phone, district,
        tinNumber = '', sdcId = '',
      } = userData;

      // Create Firebase Auth user
      const credential = await auth.createUserWithEmailAndPassword(email, password);
      const uid = credential.user.uid;

      // Build profile — sellers get TIN and SDC, buyers do not
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

      await _saveUserProfile(uid, profile);

      return { success: true, user: profile };

    } catch (err) {
      return { success: false, error: _parseAuthError(err) };
    }
  };

  // ── 2. Login with Email/Password ──────────────────────────────
  /**
   * @param {string} email
   * @param {string} password
   * @returns {Promise<{success: boolean, user?: Object, error?: string}>}
   */
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
  /**
   * Google sign-in. Only works if user already has a Firestore profile.
   * If no profile exists → reject and ask them to register first.
   *
   * @returns {Promise<{success: boolean, user?: Object, error?: string, needsRegistration?: boolean}>}
   */
  const loginWithGoogle = async () => {
    try {
      const provider = new firebase.auth.GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });

      const credential = await auth.signInWithPopup(provider);
      const uid = credential.user.uid;

      // Check if profile exists in Firestore
      const profile = await _getUserProfile(uid);

      if (!profile) {
        // No profile — sign them out and tell them to register
        await auth.signOut();
        return {
          success:             false,
          needsRegistration:   true,
          error:               'No account found for this Google account. Please register first.',
        };
      }

      return { success: true, user: profile };

    } catch (err) {
      return { success: false, error: _parseAuthError(err) };
    }
  };

  // ── 4. Logout ─────────────────────────────────────────────────
  /**
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  const logout = async () => {
    try {
      await auth.signOut();
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  };

  // ── 5. Send Password Reset Email ──────────────────────────────
  /**
   * Sends a password reset link to the given email address.
   * User clicks the link in their email to set a new password.
   *
   * @param {string} email
   * @returns {Promise<{success: boolean, message?: string, error?: string}>}
   */
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
  /**
   * Listens for auth state changes (login / logout).
   * Callback receives the full Firestore profile or null.
   *
   * @param {Function} callback - called with (profile | null)
   * @returns {Function} unsubscribe function
   */
  const onAuthStateChanged = (callback) => {
    return auth.onAuthStateChanged(async (firebaseUser) => {
      if (firebaseUser) {
        const profile = await _getUserProfile(firebaseUser.uid);
        callback(profile || null);
      } else {
        callback(null);
      }
    });
  };

  // ── 7. Get Current User ───────────────────────────────────────
  /**
   * Returns the current Firebase Auth user (not the Firestore profile).
   * Use onAuthStateChanged for the full profile.
   */
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

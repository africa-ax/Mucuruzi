// ============================================================
//  MUCURUZI — AuthService.js (UPDATED)
// ============================================================

const AuthService = (() => {
  let _isRegistering = false;

  // ── Private: Save user profile to Firestore ──────────────────
  const _saveUserProfile = async (uid, profileData) => {
    // Explicitly use .doc(uid) to keep IDs synced
    return db.collection(Collections.USERS).doc(uid).set({
      ...profileData,
      uid: uid,
      createdAt: serverTimestamp(),
      isActive: true
    });
  };

  const _getUserProfile = async (uid) => {
    const doc = await db.collection(Collections.USERS).doc(uid).get();
    return doc.exists ? doc.data() : null;
  };

  // ── 1. Register (Improved logic) ──────────────────────────────
  const register = async (userData) => {
    try {
      const {
        email, password, businessName,
        role, phone, district,
        tinNumber = '', sdcId = '',
      } = userData;

      _isRegistering = true;

      // 1. Create Firebase Auth user FIRST
      const credential = await auth.createUserWithEmailAndPassword(email, password);
      const user = credential.user;

      // 2. Prepare profile data
      const isSeller = ROLE_CAN_SELL.includes(role);
      const profile = {
        uid: user.uid,
        businessName: businessName.trim(),
        email: email.trim().toLowerCase(),
        role,
        phone: phone.trim(),
        district: district.trim(),
        tinNumber: isSeller ? tinNumber.trim() : '',
        sdcId: isSeller ? sdcId.trim() : '',
        photoURL: '',
        isActive: true,
      };

      // 3. Save profile to Firestore
      await _saveUserProfile(user.uid, profile);

      _isRegistering = false;
      return { success: true, user: profile };

    } catch (err) {
      _isRegistering = false;
      console.error("Registration Error:", err.code, err.message);

      // If auth succeeded but Firestore failed, we remove the auth user
      // so the user can retry without getting "Email already in use"
      if (auth.currentUser && err.code !== 'auth/email-already-in-use') {
        try { await auth.currentUser.delete(); } catch(e) { console.error("Cleanup failed", e); }
      }
      
      return { success: false, error: _parseAuthError(err) };
    }
  };

  // ... (Keep login, loginWithGoogle, logout, and _parseAuthError as they were) ...

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

  const loginWithGoogle = async () => {
    try {
      const provider = new firebase.auth.GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      const credential = await auth.signInWithPopup(provider);
      const profile = await _getUserProfile(credential.user.uid);

      if (!profile) {
        await auth.signOut();
        return { success: false, needsRegistration: true, error: 'No account found. Please register first.' };
      }
      return { success: true, user: profile };
    } catch (err) {
      return { success: false, error: _parseAuthError(err) };
    }
  };

  const logout = async () => {
    try { await auth.signOut(); return { success: true }; }
    catch (err) { return { success: false, error: err.message }; }
  };

  const onAuthStateChanged = (callback) => {
    return auth.onAuthStateChanged(async (firebaseUser) => {
      if (_isRegistering) return;
      if (firebaseUser) {
        const profile = await _getUserProfile(firebaseUser.uid);
        callback(profile || null);
      } else {
        callback(null);
      }
    });
  };

  const _parseAuthError = (err) => {
    const map = {
      'auth/email-already-in-use': 'This email is already registered.',
      'auth/invalid-email': 'Invalid email address.',
      'auth/weak-password': 'Password must be at least 6 characters.',
      'auth/user-not-found': 'No account found with this email.',
      'auth/wrong-password': 'Incorrect password.',
      'auth/network-request-failed': 'Network error. Check your connection.',
    };
    return map[err.code] || err.message || 'Something went wrong.';
  };

  return { register, login, loginWithGoogle, logout, onAuthStateChanged, getCurrentUser: () => auth.currentUser };
})();

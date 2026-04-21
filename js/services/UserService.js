// ============================================================
//  MUCURUZI — UserService.js
//  Handles all user profile operations after registration.
// ============================================================

const UserService = (() => {

  // ── 1. Get Profile ───────────────────────────────────────────
  /**
   * @param {string} uid
   * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
   */
  const getProfile = async (uid) => {
    try {
      const doc = await db.collection(Collections.USERS).doc(uid).get();
      if (!doc.exists) return { success: false, error: 'User profile not found.' };
      return { success: true, data: doc.data() };
    } catch (err) {
      return { success: false, error: err.message };
    }
  };

  // ── 2. Update Profile ────────────────────────────────────────
  /**
   * Update allowed profile fields only.
   * TIN, SDC, role and email cannot be changed here.
   *
   * @param {string} uid
   * @param {Object} data - {businessName, phone, district, photoURL}
   */
  const updateProfile = async (uid, data) => {
    try {
      const allowed = {};
      if (data.businessName) allowed.businessName = data.businessName.trim();
      if (data.phone)        allowed.phone        = data.phone.trim();
      if (data.district)     allowed.district     = data.district.trim();
      if (data.photoURL)     allowed.photoURL     = data.photoURL;

      if (Object.keys(allowed).length === 0) {
        return { success: false, error: 'No valid fields to update.' };
      }

      allowed.updatedAt = serverTimestamp();
      await db.collection(Collections.USERS).doc(uid).update(allowed);
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  };

  // ── 3. Get Users By Role ─────────────────────────────────────
  /**
   * @param {string} role
   * @returns {Promise<{success: boolean, data?: Array, error?: string}>}
   */
  const getUsersByRole = async (role) => {
    try {
      const snap = await db.collection(Collections.USERS)
        .where('role', '==', role)
        .where('isActive', '==', true)
        .get();
      return { success: true, data: snap.docs.map(d => d.data()) };
    } catch (err) {
      return { success: false, error: err.message };
    }
  };

  // ── 4. Search Business ───────────────────────────────────────
  /**
   * Search sellers by business name or TIN.
   * Fetches all active sellers and filters client-side
   * (Firestore does not support native full-text search).
   *
   * @param {string} query
   */
  const searchBusiness = async (query) => {
    try {
      if (!query || query.trim().length < 2) {
        return { success: false, error: 'Search query must be at least 2 characters.' };
      }

      const q    = query.trim().toLowerCase();
      const snap = await db.collection(Collections.USERS)
        .where('isActive', '==', true)
        .get();

      const results = snap.docs
        .map(d => d.data())
        .filter(u =>
          ROLE_CAN_SELL.includes(u.role) && (
            u.businessName.toLowerCase().includes(q) ||
            u.tinNumber.includes(q)
          )
        );

      return { success: true, data: results };
    } catch (err) {
      return { success: false, error: err.message };
    }
  };

  // ── 5. Get User By TIN ───────────────────────────────────────
  /**
   * @param {string} tin
   */
  const getUserByTIN = async (tin) => {
    try {
      const snap = await db.collection(Collections.USERS)
        .where('tinNumber', '==', tin.trim())
        .limit(1)
        .get();

      if (snap.empty) return { success: false, error: 'No business found with this TIN.' };
      return { success: true, data: snap.docs[0].data() };
    } catch (err) {
      return { success: false, error: err.message };
    }
  };

  return { getProfile, updateProfile, getUsersByRole, searchBusiness, getUserByTIN };

})();

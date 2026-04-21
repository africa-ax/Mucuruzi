// ============================================================
//  MUCURUZI — User Model
//  Defines the shape of a user document in Firestore.
//  Collection: users/{uid}
// ============================================================

const UserModel = (() => {

  /**
   * Creates a clean validated user object ready to save to Firestore.
   *
   * @param {Object} data
   * @returns {{success: boolean, data?: Object, error?: string}}
   */
  const create = (data) => {
    const {
      uid, businessName, email, role,
      phone, district,
      tinNumber = '',
      sdcId     = '',
      photoURL  = '',
    } = data;

    // ── Validation ─────────────────────────────────────────
    if (!uid)          return { success: false, error: 'uid is required.' };
    if (!businessName) return { success: false, error: 'Business name is required.' };
    if (!email)        return { success: false, error: 'Email is required.' };
    if (!role || !Object.values(ROLES).includes(role)) {
      return { success: false, error: `Invalid role. Must be one of: ${Object.values(ROLES).join(', ')}.` };
    }
    if (!phone)    return { success: false, error: 'Phone number is required.' };
    if (!district) return { success: false, error: 'District is required.' };

    const isSeller = ROLE_CAN_SELL.includes(role);

    if (isSeller) {
      if (!tinNumber || !/^\d{9}$/.test(tinNumber)) {
        return { success: false, error: 'TIN must be exactly 9 digits for seller roles.' };
      }
      if (!sdcId) {
        return { success: false, error: 'SDC Device ID is required for seller roles.' };
      }
    }

    // ── Build Object ───────────────────────────────────────
    return {
      success: true,
      data: {
        uid,
        businessName: businessName.trim(),
        email:        email.trim().toLowerCase(),
        role,
        phone:        phone.trim(),
        district:     district.trim(),
        tinNumber:    isSeller ? tinNumber.trim() : '',
        sdcId:        isSeller ? sdcId.trim()     : '',
        photoURL:     photoURL || '',
        isActive:     true,
        createdAt:    serverTimestamp(),
      },
    };
  };

  const isSeller = (role) => ROLE_CAN_SELL.includes(role);
  const isBuyer  = (role) => role === ROLES.BUYER;

  return { create, isSeller, isBuyer };

})();

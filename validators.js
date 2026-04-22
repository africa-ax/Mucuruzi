// ============================================================
//  MUCURUZI — validators.js
//  Pure validation functions. Return true/false only.
//  Used in forms before calling any service.
// ============================================================

const Validators = (() => {

  const validateEmail = (email) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim());

  // Rwanda phone: 07XXXXXXXX or +2507XXXXXXXX
  const validatePhone = (phone) =>
    /^(\+?250)?07[2389]\d{7}$/.test(String(phone || '').replace(/\s/g, ''));

  // TIN: exactly 9 digits
  const validateTIN = (tin) =>
    /^\d{9}$/.test(String(tin || '').trim());

  const validatePassword = (password) =>
    String(password || '').length >= 6;

  const validateQuantity = (value) => {
    const n = parseFloat(value);
    return !isNaN(n) && n > 0;
  };

  const validatePrice = (value) => {
    const n = parseFloat(value);
    return !isNaN(n) && n >= 0;
  };

  // UNSPSC: exactly 8 digits
  const validateItemCode = (code) =>
    /^\d{8}$/.test(String(code || '').trim());

  // Purchase code: 5 or 6 digits
  const validatePurchaseCode = (code) =>
    /^\d{5,6}$/.test(String(code || '').trim());

  const validateRequired = (value) =>
    String(value || '').trim().length > 0;

  return {
    validateEmail,
    validatePhone,
    validateTIN,
    validatePassword,
    validateQuantity,
    validatePrice,
    validateItemCode,
    validatePurchaseCode,
    validateRequired,
  };

})();

// ============================================================
//  MUCURUZI — validators.js (stub — full version coming later)
// ============================================================
const Validators = {
  isEmail:  (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
  isTIN:    (v) => /^\d{9}$/.test(String(v || '')),
  isPhone:  (v) => /^[0-9+\s\-]{9,15}$/.test(String(v || '')),
  notEmpty: (v) => String(v || '').trim().length > 0,
};

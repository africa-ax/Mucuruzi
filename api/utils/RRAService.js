// ============================================================
//  MUCURUZI — api/utils/RRAService.js
//  SERVER-SIDE RRA Service (runs on Vercel, never visible to browser)
//
//  Sandbox now  → generates realistic fake seals
//  Production   → swap internals of submitInvoice() and
//                 verifyPurchaseCode() with real RRA fetch() calls
//                 using process.env.RRA_API_KEY
//
//  This file is identical in structure to the browser version
//  but runs securely on the server. The RRA_API_KEY environment
//  variable is NEVER exposed to the browser.
// ============================================================

// ── Mode ──────────────────────────────────────────────────────
// Change to 'production' when RRA grants API access
const MODE = process.env.RRA_MODE || 'sandbox';
const RRA_API_KEY = process.env.RRA_API_KEY || '';
const VSDC_ENDPOINT = 'https://sandbox.rra.gov.rw/api/v1';

// ── Helpers ───────────────────────────────────────────────────
const _isValidTIN = (tin) => /^\d{9}$/.test(String(tin || '').trim());

const _randomAlpha = (length) => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  return Array.from({ length }, () =>
    chars[Math.floor(Math.random() * chars.length)]
  ).join('');
};

const _randomNumeric = (length) => {
  return Array.from({ length }, () =>
    Math.floor(Math.random() * 10)
  ).join('');
};

const _dateStamp = () => {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}${m}${d}`;
};

const _delay = () =>
  new Promise(resolve => setTimeout(resolve, 50 + Math.random() * 100));

// ── 1. verifyPurchaseCode ─────────────────────────────────────
/**
 * Validates purchase code from *800*SellerTIN# or MyRRA website.
 * Code must be 5 or 6 digits — real RRA rule.
 *
 * @param {string} sellerTIN
 * @param {string} purchaseCode
 */
export const verifyPurchaseCode = async (sellerTIN, purchaseCode) => {
  await _delay();

  if (!_isValidTIN(sellerTIN)) {
    return { success: false, message: 'Invalid seller TIN. Must be 9 digits.' };
  }

  const codeStr    = String(purchaseCode || '').trim();
  const codeValid  = /^\d{5,6}$/.test(codeStr);

  if (!codeValid) {
    return {
      success: false,
      message: 'Invalid purchase code. Must be 5 or 6 digits from *800*SellerTIN# or MyRRA.',
    };
  }

  if (MODE === 'sandbox') {
    return { success: true, message: 'Purchase code verified.', purchaseCode: codeStr };
  }

  // ── PRODUCTION: replace with real RRA API call ─────────────
  // const response = await fetch(`${VSDC_ENDPOINT}/verify-purchase-code`, {
  //   method: 'POST',
  //   headers: {
  //     'Content-Type': 'application/json',
  //     'Authorization': `Bearer ${RRA_API_KEY}`,
  //   },
  //   body: JSON.stringify({ sellerTIN, purchaseCode: codeStr }),
  // });
  // return await response.json();
};

// ── 2. submitInvoice ─────────────────────────────────────────
/**
 * THE SINGLE ENTRY POINT for all invoice submission.
 * Receives invoice data, returns complete RRA Digital Seal.
 *
 * Sandbox: generates realistic fake seal
 * Production: calls real RRA VSDC API using RRA_API_KEY
 *
 * @param {Object} payload
 * @param {string} payload.invoiceId
 * @param {string} payload.sellerTIN
 * @param {string} payload.buyerTIN
 * @param {Array}  payload.items
 * @param {number} payload.subtotal
 * @param {number} payload.vatAmount
 * @param {number} payload.total
 * @param {string} payload.purchaseCode
 */
export const submitInvoice = async (payload) => {
  await _delay();

  const { invoiceId, sellerTIN, buyerTIN, subtotal, vatAmount, total } = payload;

  // Validate
  if (!invoiceId)              return { success: false, error: 'Missing invoiceId.' };
  if (!_isValidTIN(sellerTIN)) return { success: false, error: 'Invalid sellerTIN.' };
  if (typeof subtotal !== 'number') return { success: false, error: 'subtotal must be a number.' };
  if (typeof total    !== 'number') return { success: false, error: 'total must be a number.' };

  if (MODE === 'sandbox') {
    const year         = new Date().getFullYear();
    const signature    = _randomAlpha(20);
    const internalData = _dateStamp() + String(sellerTIN).trim() + _randomNumeric(9);
    const receiptNumber = `RCP-${year}-${_randomNumeric(7)}`;
    const sdcId        = `SDC-${_randomNumeric(3)}-${year}`;
    const sdcDateTime  = new Date().toISOString();
    const qrCode       = `https://verify.rra.gov.rw/invoice/${invoiceId}?sig=${signature.slice(0, 8)}`;

    return {
      success: true,
      signature,
      internalData,
      receiptNumber,
      sdcId,
      sdcDateTime,
      qrCode,
    };
  }

  // ── PRODUCTION: replace with real RRA VSDC API call ────────
  // try {
  //   const response = await fetch(`${VSDC_ENDPOINT}/invoice/submit`, {
  //     method: 'POST',
  //     headers: {
  //       'Content-Type': 'application/json',
  //       'Authorization': `Bearer ${RRA_API_KEY}`,
  //     },
  //     body: JSON.stringify(payload),
  //   });
  //   return await response.json();
  // } catch (err) {
  //   return { success: false, error: err.message };
  // }
};

// ── 3. lookupTIN ─────────────────────────────────────────────
/**
 * Returns business details for a TIN.
 *
 * @param {string} tin
 */
export const lookupTIN = async (tin) => {
  await _delay();

  const tinStr = String(tin || '').trim();

  if (!_isValidTIN(tinStr)) {
    return { success: false, error: 'Invalid TIN. Must be exactly 9 digits.' };
  }

  if (MODE === 'sandbox') {
    return {
      success:      true,
      tin:          tinStr,
      businessName: `Business TIN ${tinStr}`,
      role:         'unknown',
      address:      'Rwanda',
    };
  }

  // ── PRODUCTION: replace with real TIN lookup ───────────────
  // const response = await fetch(`${VSDC_ENDPOINT}/tin/${tinStr}`, {
  //   headers: { 'Authorization': `Bearer ${RRA_API_KEY}` },
  // });
  // return await response.json();
};

export default { verifyPurchaseCode, submitInvoice, lookupTIN, MODE };

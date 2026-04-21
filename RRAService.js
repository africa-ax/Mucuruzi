// ============================================================
//  MUCURUZI — RRAService.js
//  Simulates the Rwanda Revenue Authority VSDC API (EBM 2.1)
//
//  ARCHITECTURE RULE:
//  App code must ONLY call:
//    - RRAService.submitInvoice(payload)
//    - RRAService.verifyPurchaseCode(buyerTIN, sellerTIN, code)
//    - RRAService.lookupTIN(tin)
//
//  When switching to live RRA API:
//  → Replace ONLY the internals of these 3 functions.
//  → Zero changes needed in UI, models, or other services.
// ============================================================

const RRAService = (() => {

  // ── Mode ────────────────────────────────────────────────────
  // 'sandbox'    → all responses are simulated locally
  // 'production' → real RRA API calls (replace internals when ready)
  const MODE = 'sandbox';

  const VSDC_ENDPOINT = 'https://sandbox.rra.gov.rw/api/v1/invoice/submit'; // placeholder

  // ── Private Helpers ─────────────────────────────────────────

  /**
   * Validate a TIN — must be exactly 9 digits
   */
  const _isValidTIN = (tin) => {
    if (!tin) return false;
    return /^\d{9}$/.test(String(tin).trim());
  };

  /**
   * Generate a random alphanumeric string of given length
   */
  const _randomAlpha = (length) => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };

  /**
   * Generate a random numeric string of given length
   */
  const _randomNumeric = (length) => {
    let result = '';
    for (let i = 0; i < length; i++) {
      result += Math.floor(Math.random() * 10).toString();
    }
    return result;
  };

  /**
   * Get current date as YYYYMMDD
   */
  const _dateStamp = () => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}${m}${d}`;
  };

  /**
   * Simulate a short network delay (50–150ms)
   * Makes sandbox feel like a real API call
   */
  const _delay = () =>
    new Promise((resolve) => setTimeout(resolve, 50 + Math.random() * 100));

  // ── Mock TIN Database ────────────────────────────────────────
  // In production this comes from RRA's TIN lookup API
  const _mockTINDatabase = {
    '100000001': { businessName: 'Kigali Fresh Foods Ltd',     role: 'manufacturer', address: 'KG 123 St, Kigali' },
    '100000002': { businessName: 'Muhanga Distributors Co.',   role: 'distributor',  address: 'NR 45 Av, Muhanga' },
    '100000003': { businessName: 'Remera Retail Shop',         role: 'retailer',     address: 'KG 78 Rd, Remera, Kigali' },
    '100000004': { businessName: 'Gasabo General Supplies',    role: 'distributor',  address: 'KG 200 Blvd, Gasabo' },
    '100000005': { businessName: 'Nyamirambo Trading Centre',  role: 'retailer',     address: 'KN 15 St, Nyamirambo' },
    '100000006': { businessName: 'Rwanda Building Materials',  role: 'manufacturer', address: 'KK 7 Av, Kicukiro' },
    '100000007': { businessName: 'Kimironko Electronics Hub',  role: 'retailer',     address: 'KG 9 St, Kimironko' },
    '100000008': { businessName: 'Musanze Agro Suppliers',     role: 'distributor',  address: 'MU 3 Rd, Musanze' },
    '100000009': { businessName: 'Huye Pharma Distributors',   role: 'distributor',  address: 'HY 11 St, Huye' },
    '100000010': { businessName: 'Rubavu Import Export Ltd',   role: 'manufacturer', address: 'RB 22 Av, Rubavu' },
  };

  // ── 1. verifyPurchaseCode ─────────────────────────────────────
  /**
   * Validates a purchase code obtained by the buyer via *800*SellerTIN#.
   *
   * HOW IT WORKS IN REAL LIFE:
   *   1. Buyer dials *800*SellerTIN# on their phone
   *   2. RRA USSD returns a 5 or 6 digit code to the buyer's phone
   *   3. Buyer reads that code to the seller
   *   4. Seller types it into this app
   *   5. This function validates it
   *
   * NOTE: Buyer TIN is NOT required here.
   *   - Final buyers (walk-in, regular buyers) have no TIN.
   *   - The purchase code is tied to the SELLER's TIN only.
   *   - Buyer TIN is captured separately on the invoice when available (B2B only).
   *
   * @param {string} sellerTIN     - 9-digit seller TIN
   * @param {string} purchaseCode  - 5 or 6 digit code from *800*SellerTIN#
   * @returns {Promise<{success: boolean, message: string, purchaseCode?: string}>}
   */
  const verifyPurchaseCode = async (sellerTIN, purchaseCode) => {
    await _delay();

    // Validate seller TIN
    if (!_isValidTIN(sellerTIN)) {
      return { success: false, message: 'Invalid seller TIN. Must be 9 digits.' };
    }

    // Validate purchase code — strictly 5 or 6 digits (real RRA USSD output)
    const codeStr = String(purchaseCode || '').trim();
    const codePattern = /^\d{5,6}$/;

    if (!codePattern.test(codeStr)) {
      return {
        success: false,
        message: 'Invalid purchase code. Must be a 5 or 6 digit number received via *800*SellerTIN#.',
      };
    }

    if (MODE === 'sandbox') {
      // Sandbox: any correctly formatted code passes
      return {
        success:      true,
        message:      'Purchase code verified successfully.',
        purchaseCode: codeStr,
      };
    }

    // Production: replace with real RRA API call
    // const response = await fetch(VSDC_ENDPOINT + '/verify-purchase-code', {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${RRA_API_KEY}` },
    //   body: JSON.stringify({ sellerTIN, purchaseCode: codeStr }),
    // });
    // return await response.json();
  };

  // ── 2. submitInvoice ─────────────────────────────────────────
  /**
   * THE SINGLE ENTRY POINT for all invoice submission.
   *
   * Mimics sending invoice data to the RRA VSDC server and
   * receiving back the full Digital Seal.
   *
   * In production: replace internals with real fetch() to RRA API.
   * The return shape MUST always match — never change the keys.
   *
   * @param {Object} invoicePayload
   * @param {string} invoicePayload.invoiceId      - internal invoice ID
   * @param {string} invoicePayload.sellerTIN      - 9-digit seller TIN
   * @param {string} invoicePayload.buyerTIN       - 9-digit buyer TIN
   * @param {Array}  invoicePayload.items          - invoice line items
   * @param {number} invoicePayload.subtotal       - pre-VAT total
   * @param {number} invoicePayload.vatAmount      - VAT amount
   * @param {number} invoicePayload.total          - grand total
   * @param {string} invoicePayload.purchaseCode   - verified *800# code
   *
   * @returns {Promise<{
   *   success: boolean,
   *   signature: string,       // 20-char mock cryptographic hash
   *   internalData: string,    // 26-char: YYYYMMDD(8) + SellerTIN(9) + Random(9)
   *   receiptNumber: string,   // e.g. RCP-2026-XXXXXX
   *   sdcId: string,           // e.g. SDC-001-2024
   *   sdcDateTime: string,     // ISO timestamp
   *   qrCode: string,          // verify.rra.gov.rw URL
   *   error?: string           // present only if success is false
   * }>}
   */
  const submitInvoice = async (invoicePayload) => {
    await _delay();

    // ── Validate required fields ───────────────────────────
    const { invoiceId, sellerTIN, buyerTIN, subtotal, vatAmount, total } = invoicePayload;

    if (!invoiceId) {
      return { success: false, error: 'Missing invoiceId.' };
    }
    if (!_isValidTIN(sellerTIN)) {
      return { success: false, error: 'Invalid sellerTIN. Must be 9 digits.' };
    }
    if (!_isValidTIN(buyerTIN)) {
      return { success: false, error: 'Invalid buyerTIN. Must be 9 digits.' };
    }
    if (typeof subtotal !== 'number' || typeof vatAmount !== 'number' || typeof total !== 'number') {
      return { success: false, error: 'subtotal, vatAmount, and total must be numbers.' };
    }

    if (MODE === 'sandbox') {
      // ── Build Digital Seal (sandbox simulation) ────────────

      // signature: 20-char alphanumeric mock hash
      const signature = _randomAlpha(20);

      // internalData: YYYYMMDD(8) + SellerTIN(9) + Random(9) = 26 chars
      const internalData = _dateStamp() + String(sellerTIN).trim() + _randomNumeric(9);

      // receiptNumber: RCP-YYYY-XXXXXXX
      const year = new Date().getFullYear();
      const receiptNumber = `RCP-${year}-${_randomNumeric(7)}`;

      // sdcId: SDC-XXX-YYYY
      const sdcId = `SDC-${_randomNumeric(3)}-${year}`;

      // sdcDateTime: current ISO timestamp
      const sdcDateTime = new Date().toISOString();

      // qrCode: RRA verify URL
      const qrCode = `https://verify.rra.gov.rw/invoice/${invoiceId}?sig=${signature.slice(0, 8)}`;

      return {
        success:       true,
        signature,
        internalData,
        receiptNumber,
        sdcId,
        sdcDateTime,
        qrCode,
      };
    }

    // ── Production: replace this block with real RRA API call ──
    // try {
    //   const response = await fetch(VSDC_ENDPOINT, {
    //     method: 'POST',
    //     headers: {
    //       'Content-Type': 'application/json',
    //       'Authorization': `Bearer ${RRA_API_KEY}`,
    //     },
    //     body: JSON.stringify(invoicePayload),
    //   });
    //   const data = await response.json();
    //   return data;
    // } catch (err) {
    //   return { success: false, error: err.message };
    // }
  };

  // ── 3. lookupTIN ─────────────────────────────────────────────
  /**
   * Returns business details for a given TIN.
   * In production: calls RRA's TIN verification API.
   *
   * @param {string} tin - 9-digit TIN number
   * @returns {Promise<{
   *   success: boolean,
   *   tin: string,
   *   businessName: string,
   *   role: string,
   *   address: string,
   *   error?: string
   * }>}
   */
  const lookupTIN = async (tin) => {
    await _delay();

    const tinStr = String(tin || '').trim();

    if (!_isValidTIN(tinStr)) {
      return { success: false, error: 'Invalid TIN. Must be exactly 9 digits.' };
    }

    if (MODE === 'sandbox') {
      // Check mock database first
      const found = _mockTINDatabase[tinStr];

      if (found) {
        return {
          success: true,
          tin: tinStr,
          businessName: found.businessName,
          role:         found.role,
          address:      found.address,
        };
      }

      // TIN not in mock DB — return generic sandbox response
      // (in production this would be a real unknown TIN error)
      return {
        success:      true,
        tin:          tinStr,
        businessName: `Business TIN ${tinStr}`,
        role:         'unknown',
        address:      'Rwanda',
      };
    }

    // Production: replace with real RRA TIN lookup API
    // const response = await fetch(`${VSDC_ENDPOINT}/tin/${tinStr}`, { ... });
    // return await response.json();
  };

  // ── Public API ───────────────────────────────────────────────
  return {
    verifyPurchaseCode,
    submitInvoice,
    lookupTIN,
    MODE, // expose so other services can check if in sandbox
  };

})();

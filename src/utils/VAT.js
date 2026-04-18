// ============================================================
// VAT.js — Mucuruzi VAT Calculation Utilities
// All prices use parseFloat(toFixed(2)) to prevent
// floating-point errors in tax calculations
// ============================================================

// ─── VAT RATE ─────────────────────────────────────────────────
export const VAT_RATE = 18; // Rwanda standard VAT rate %

// ─── TAX GRADE LABELS ─────────────────────────────────────────
export const TAX_GRADES = {
  A: { label: "Standard Rate",  vatRate: 18, description: "18% VAT applies" },
  B: { label: "VAT Exempt",     vatRate: 0,  description: "Exempt from VAT" },
  C: { label: "Zero Rated",     vatRate: 0,  description: "0% VAT (Zero Rated)" },
  D: { label: "Non-Taxable",    vatRate: 0,  description: "Not subject to VAT" },
};

// ─── CORE PRICE PARSER ────────────────────────────────────────
/**
 * Safely parse any value to a 2-decimal float.
 * Prevents floating-point tax errors throughout the system.
 * @param {any} value
 * @returns {number}
 */
export function parsePrice(value) {
  const parsed = parseFloat(parseFloat(value || 0).toFixed(2));
  return isNaN(parsed) ? 0 : parsed;
}

// ─── VAT CALCULATIONS ─────────────────────────────────────────
/**
 * Calculate VAT amount from a subtotal.
 * @param {number} subtotal  - Price before VAT
 * @param {number} vatRate   - VAT percentage (e.g. 18)
 * @returns {number}         - VAT amount
 */
export function calculateVAT(subtotal, vatRate) {
  const sub  = parsePrice(subtotal);
  const rate = parsePrice(vatRate);
  return parsePrice((sub * rate) / 100);
}

/**
 * Calculate total (subtotal + VAT).
 * @param {number} subtotal
 * @param {number} vatRate
 * @returns {number}
 */
export function calculateTotal(subtotal, vatRate) {
  const sub = parsePrice(subtotal);
  const vat = calculateVAT(sub, vatRate);
  return parsePrice(sub + vat);
}

/**
 * Extract VAT from a VAT-inclusive price.
 * Used when price already includes VAT.
 * @param {number} inclusivePrice
 * @param {number} vatRate
 * @returns {{ subtotal, vat, total }}
 */
export function extractVAT(inclusivePrice, vatRate) {
  const total    = parsePrice(inclusivePrice);
  const rate     = parsePrice(vatRate);
  const subtotal = parsePrice(total / (1 + rate / 100));
  const vat      = parsePrice(total - subtotal);
  return { subtotal, vat, total };
}

/**
 * Calculate line item totals for an invoice item.
 * @param {number} unitPrice
 * @param {number} quantity
 * @param {number} vatRate
 * @returns {{ unitPrice, quantity, subtotal, vat, total }}
 */
export function calculateLineItem(unitPrice, quantity, vatRate) {
  const price    = parsePrice(unitPrice);
  const qty      = parsePrice(quantity);
  const subtotal = parsePrice(price * qty);
  const vat      = calculateVAT(subtotal, vatRate);
  const total    = parsePrice(subtotal + vat);

  return {
    unitPrice: price,
    quantity:  qty,
    subtotal,
    vat,
    total,
  };
}

/**
 * Calculate full invoice totals from an array of items.
 * @param {Array} items - [{ unitPrice, quantity, vatRate }]
 * @returns {{ subtotal, totalVAT, grandTotal }}
 */
export function calculateInvoiceTotals(items) {
  let subtotal = 0;
  let totalVAT = 0;

  for (const item of items) {
    const line  = calculateLineItem(item.unitPrice, item.quantity, item.vatRate || 0);
    subtotal   += line.subtotal;
    totalVAT   += line.vat;
  }

  return {
    subtotal:   parsePrice(subtotal),
    totalVAT:   parsePrice(totalVAT),
    grandTotal: parsePrice(subtotal + totalVAT),
  };
}

// ─── FORMATTING ───────────────────────────────────────────────
/**
 * Format a number as Rwanda Francs.
 * @param {number} amount
 * @returns {string} e.g. "RWF 1,500.00"
 */
export function formatRWF(amount) {
  const n = parsePrice(amount);
  return `RWF ${n.toLocaleString("en-RW", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * Format VAT rate for display.
 * @param {number} vatRate
 * @returns {string} e.g. "18%" or "0% (Exempt)"
 */
export function formatVATRate(vatRate, taxGrade) {
  if (vatRate === 0) {
    const grade = TAX_GRADES[taxGrade];
    return grade ? `0% (${grade.label})` : "0%";
  }
  return `${vatRate}%`;
}

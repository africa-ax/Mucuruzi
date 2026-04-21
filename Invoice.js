// ============================================================
//  MUCURUZI — Invoice Model
//  Defines the shape of an invoice document in Firestore.
//  Collection: invoices/{invoiceId}
//
//  An invoice is ONLY created after:
//  1. Order is confirmed by seller
//  2. RRAService.submitInvoice() returns success
//
//  RETURN POLICY:
//  Buyer may request a return within 7 days of invoice creation.
//  Partial or full returns are allowed.
//  Returns must be approved by the seller.
// ============================================================

const InvoiceModel = (() => {

  // Return window in milliseconds (7 days)
  const RETURN_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

  /**
   * Generates a unique invoice ID
   * @returns {string}
   */
  const generateId = () => {
    const year = new Date().getFullYear();
    const rand = Math.random().toString(36).substr(2, 8).toUpperCase();
    return `${INVOICE.PREFIX}-${year}-${rand}`;
  };

  /**
   * Creates a clean invoice object by merging a confirmed order
   * with the RRA digital seal response.
   *
   * @param {Object} orderData    - confirmed order document from Firestore
   * @param {Object} rraResponse  - response from RRAService.submitInvoice()
   *
   * @returns {{success: boolean, data?: Object, error?: string}}
   */
  const create = (orderData, rraResponse) => {

    // ── Validate RRA Response ──────────────────────────────
    if (!rraResponse || !rraResponse.success) {
      return { success: false, error: 'Cannot create invoice: RRA submission failed.' };
    }

    const {
      signature, internalData,
      receiptNumber, sdcId,
      sdcDateTime, qrCode,
    } = rraResponse;

    if (!signature || !internalData || !receiptNumber || !sdcId || !qrCode) {
      return { success: false, error: 'Incomplete RRA digital seal. Cannot generate invoice.' };
    }

    // ── Validate Order Data ────────────────────────────────
    if (!orderData.orderId)  return { success: false, error: 'orderId is required.' };
    if (!orderData.sellerTIN) return { success: false, error: 'sellerTIN is required.' };

    // ── Re-validate All Prices ─────────────────────────────
    // Belt and suspenders — ensure no floating point errors
    const subtotal  = Price.round(orderData.subtotal);
    const vatAmount = Price.round(orderData.vatAmount);
    const total     = Price.round(orderData.total);

    const items = (orderData.items || []).map(item => ({
      productId:    item.productId,
      productName:  item.productName,
      rraItemCode:  item.rraItemCode,
      unit:         item.unit,
      taxGrade:     item.taxGrade,
      quantity:     Price.round(item.quantity),
      unitPrice:    Price.round(item.unitPrice),
      lineSubtotal: Price.round(item.lineSubtotal),
      vatAmount:    Price.round(item.vatAmount),
      lineTotal:    Price.round(item.lineTotal),
    }));

    // ── Return Deadline ────────────────────────────────────
    // 7 days from now — stored as ISO string for easy comparison
    const returnDeadline = new Date(Date.now() + RETURN_WINDOW_MS).toISOString();

    // ── Invoice ID ─────────────────────────────────────────
    const invoiceId = generateId();

    // ── Build Object ───────────────────────────────────────
    return {
      success: true,
      data: {
        invoiceId,
        orderId:       orderData.orderId,

        // Seller info
        sellerId:      orderData.sellerId,
        sellerTIN:     orderData.sellerTIN,
        sellerName:    orderData.sellerName,

        // Buyer info
        // RRA standard: use '000000000' for buyers without TIN
        buyerId:       orderData.buyerId,
        buyerTIN:      orderData.buyerTIN || '000000000',
        buyerName:     orderData.buyerName,

        // Purchase code from *800*SellerTIN#
        purchaseCode:  orderData.purchaseCode || '',

        // Line items
        items,

        // Totals (all Price.round() validated)
        subtotal,
        vatAmount,
        total,

        // RRA Digital Seal — from RRAService.submitInvoice()
        signature,
        internalData,
        receiptNumber,
        sdcId,
        sdcDateTime,
        qrCode,

        // Return management
        returnStatus:   null,        // null | 'requested' | 'approved' | 'rejected'
        returnDeadline,              // ISO string — 7 days from creation
        returnedItems:  [],          // filled when return is requested
        returnedAt:     null,
        creditNoteId:   null,        // filled when return is approved

        createdAt: serverTimestamp(),
      },
    };
  };

  /**
   * Checks whether a return is still allowed for this invoice.
   *
   * @param {Object} invoice - invoice document from Firestore
   * @returns {{allowed: boolean, reason?: string}}
   */
  const canReturn = (invoice) => {
    if (invoice.returnStatus === 'approved') {
      return { allowed: false, reason: 'A return has already been approved for this invoice.' };
    }
    if (invoice.returnStatus === 'requested') {
      return { allowed: false, reason: 'A return request is already pending approval.' };
    }

    const deadline = new Date(invoice.returnDeadline);
    const now      = new Date();

    if (now > deadline) {
      return { allowed: false, reason: 'Return window has expired (7 days from purchase).' };
    }

    return { allowed: true };
  };

  /**
   * Validates return items against original invoice items.
   * Ensures returned quantities never exceed purchased quantities.
   *
   * @param {Object} invoice        - original invoice
   * @param {Array}  returnItems    - [{productId, quantity}]
   * @returns {{success: boolean, items?: Array, error?: string}}
   */
  const validateReturnItems = (invoice, returnItems) => {
    if (!returnItems || returnItems.length === 0) {
      return { success: false, error: 'Please select at least one item to return.' };
    }

    const validated = [];

    for (const returnItem of returnItems) {
      const original = invoice.items.find(i => i.productId === returnItem.productId);

      if (!original) {
        return { success: false, error: `Product ${returnItem.productId} not found in this invoice.` };
      }

      if (returnItem.quantity <= 0) {
        return { success: false, error: `Return quantity must be greater than 0 for ${original.productName}.` };
      }

      if (returnItem.quantity > original.quantity) {
        return {
          success: false,
          error: `Cannot return more than purchased. Max for ${original.productName}: ${original.quantity} ${original.unit}.`,
        };
      }

      // Calculate refund for this item proportionally
      const refundSubtotal = Price.round((returnItem.quantity / original.quantity) * original.lineSubtotal);
      const refundVAT      = Price.round((returnItem.quantity / original.quantity) * original.vatAmount);
      const refundTotal    = Price.round(refundSubtotal + refundVAT);

      validated.push({
        productId:      original.productId,
        productName:    original.productName,
        unit:           original.unit,
        taxGrade:       original.taxGrade,
        quantity:       returnItem.quantity,
        unitPrice:      original.unitPrice,
        refundSubtotal,
        refundVAT,
        refundTotal,
      });
    }

    const totalRefund = Price.round(validated.reduce((sum, i) => sum + i.refundTotal, 0));

    return { success: true, items: validated, totalRefund };
  };

  return {
    create,
    generateId,
    canReturn,
    validateReturnItems,
    RETURN_WINDOW_MS,
  };

})();

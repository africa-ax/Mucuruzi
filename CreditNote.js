// ============================================================
//  MUCURUZI — CreditNote Model
//  Created when a seller approves a buyer's return request.
//  Collection: creditNotes/{creditNoteId}
//
//  A Credit Note is a formal document (like an invoice) that:
//  - Records which items were returned
//  - Shows the refund amount
//  - Is visible to both seller and buyer
//  - Triggers stock reversal when created
// ============================================================

const CreditNoteModel = (() => {

  /**
   * Generates a unique credit note ID
   * @returns {string}
   */
  const generateId = () => {
    const year = new Date().getFullYear();
    const rand = Math.random().toString(36).substr(2, 8).toUpperCase();
    return `CN-${year}-${rand}`;
  };

  /**
   * Creates a clean credit note object ready to save to Firestore.
   * Called only when seller approves a return request.
   *
   * @param {Object} invoice        - original invoice document
   * @param {Array}  validatedItems - output from InvoiceModel.validateReturnItems()
   * @param {number} totalRefund    - total refund amount
   * @param {string} approvedBy     - uid of the seller approving the return
   *
   * @returns {{success: boolean, data?: Object, error?: string}}
   */
  const create = (invoice, validatedItems, totalRefund, approvedBy) => {

    // ── Validation ─────────────────────────────────────────
    if (!invoice)          return { success: false, error: 'Original invoice is required.' };
    if (!invoice.invoiceId) return { success: false, error: 'invoiceId is required.' };
    if (!validatedItems || validatedItems.length === 0) {
      return { success: false, error: 'Returned items are required.' };
    }
    if (typeof totalRefund !== 'number' || totalRefund <= 0) {
      return { success: false, error: 'Total refund must be a positive number.' };
    }
    if (!approvedBy) return { success: false, error: 'approvedBy (seller uid) is required.' };

    // ── Build Object ───────────────────────────────────────
    const creditNoteId = generateId();

    return {
      success: true,
      data: {
        creditNoteId,
        invoiceId:   invoice.invoiceId,
        orderId:     invoice.orderId,

        // Seller info
        sellerId:    invoice.sellerId,
        sellerTIN:   invoice.sellerTIN,
        sellerName:  invoice.sellerName,

        // Buyer info
        buyerId:     invoice.buyerId,
        buyerTIN:    invoice.buyerTIN,
        buyerName:   invoice.buyerName,

        // Returned items with refund breakdown
        returnedItems: validatedItems.map(item => ({
          productId:      item.productId,
          productName:    item.productName,
          unit:           item.unit,
          taxGrade:       item.taxGrade,
          quantity:       item.quantity,
          unitPrice:      item.unitPrice,
          refundSubtotal: Price.round(item.refundSubtotal),
          refundVAT:      Price.round(item.refundVAT),
          refundTotal:    Price.round(item.refundTotal),
        })),

        // Total refund amount
        totalRefund: Price.round(totalRefund),

        // Who approved
        approvedBy,

        // Reference to original invoice SDC info
        originalReceiptNumber: invoice.receiptNumber,
        originalSdcId:         invoice.sdcId,

        createdAt: serverTimestamp(),
      },
    };
  };

  return { create, generateId };

})();

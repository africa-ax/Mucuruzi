// ============================================================
//  MUCURUZI — InvoiceService.js
//  Handles invoice retrieval and the full return flow.
//
//  NOTE: Invoice CREATION happens inside OrderService.confirmOrder()
//  as part of the atomic batch. This service handles everything
//  after the invoice exists — fetching, returns, credit notes.
// ============================================================

const InvoiceService = (() => {

  // ── 1. Get My Invoices ───────────────────────────────────────
  /**
   * Fetch all invoices where user is buyer or seller.
   *
   * @param {string} uid
   * @param {string} role - 'buyer' | 'seller'
   */
  const getMyInvoices = async (uid, role = 'buyer') => {
    try {
      const field = role === 'seller' ? 'sellerId' : 'buyerId';
      const snap  = await db.collection(Collections.INVOICES)
        .where(field, '==', uid)
        .orderBy('createdAt', 'desc')
        .get();

      return { success: true, data: snap.docs.map(d => d.data()) };
    } catch (err) {
      return { success: false, error: err.message };
    }
  };

  // ── 2. Get Invoice By ID ─────────────────────────────────────
  /**
   * @param {string} invoiceId
   */
  const getInvoiceById = async (invoiceId) => {
    try {
      const doc = await db.collection(Collections.INVOICES).doc(invoiceId).get();
      if (!doc.exists) return { success: false, error: 'Invoice not found.' };
      return { success: true, data: doc.data() };
    } catch (err) {
      return { success: false, error: err.message };
    }
  };

  // ── 3. Request Return ────────────────────────────────────────
  /**
   * Buyer requests a return on some or all items from an invoice.
   *
   * Validates:
   * - 7-day return window
   * - No existing pending/approved return
   * - Return quantities do not exceed purchased quantities
   *
   * @param {string} invoiceId
   * @param {Array}  returnItems  - [{productId, quantity}]
   * @param {string} buyerUid
   */
  const requestReturn = async (invoiceId, returnItems, buyerUid) => {
    try {
      const invoiceDoc = await db.collection(Collections.INVOICES).doc(invoiceId).get();
      if (!invoiceDoc.exists) return { success: false, error: 'Invoice not found.' };

      const invoice = invoiceDoc.data();

      // Verify buyer owns this invoice
      if (invoice.buyerId !== buyerUid) {
        return { success: false, error: 'You are not the buyer on this invoice.' };
      }

      // Check return window and existing return status
      const canReturn = InvoiceModel.canReturn(invoice);
      if (!canReturn.allowed) {
        return { success: false, error: canReturn.reason };
      }

      // Validate return items and calculate refunds
      const validation = InvoiceModel.validateReturnItems(invoice, returnItems);
      if (!validation.success) return validation;

      // Save return request on invoice
      await db.collection(Collections.INVOICES).doc(invoiceId).update({
        returnStatus:  'requested',
        returnedItems: validation.items,
        totalRefund:   validation.totalRefund,
        returnRequestedAt: serverTimestamp(),
      });

      // Update order to flag return
      await db.collection(Collections.ORDERS).doc(invoice.orderId).update({
        hasReturn: true,
      });

      return { success: true, totalRefund: validation.totalRefund };
    } catch (err) {
      return { success: false, error: err.message };
    }
  };

  // ── 4. Approve Return ────────────────────────────────────────
  /**
   * Seller approves a return request.
   *
   * FLOW:
   * 1. Build credit note
   * 2. Open Firestore batch:
   *    a. Update invoice returnStatus → approved
   *    b. Save credit note
   *    c. Reverse seller stock  (goods come back)
   *    d. Deduct buyer stock    (goods leave buyer)
   * 3. Commit batch
   *
   * @param {string} invoiceId
   * @param {string} sellerUid
   */
  const approveReturn = async (invoiceId, sellerUid) => {
    try {
      const invoiceDoc = await db.collection(Collections.INVOICES).doc(invoiceId).get();
      if (!invoiceDoc.exists) return { success: false, error: 'Invoice not found.' };

      const invoice = invoiceDoc.data();

      if (invoice.sellerId !== sellerUid) {
        return { success: false, error: 'You are not the seller on this invoice.' };
      }
      if (invoice.returnStatus !== 'requested') {
        return { success: false, error: 'No pending return request found on this invoice.' };
      }

      // Build credit note
      const cnResult = CreditNoteModel.create(
        invoice,
        invoice.returnedItems,
        invoice.totalRefund,
        sellerUid
      );
      if (!cnResult.success) return cnResult;

      const creditNote = cnResult.data;

      // Firestore batch
      const batch = db.batch();

      // a. Update invoice
      const invoiceRef = db.collection(Collections.INVOICES).doc(invoiceId);
      batch.update(invoiceRef, {
        returnStatus:  'approved',
        returnedAt:    serverTimestamp(),
        creditNoteId:  creditNote.creditNoteId,
      });

      // b. Save credit note
      const cnRef = db.collection(Collections.CREDIT_NOTES).doc(creditNote.creditNoteId);
      batch.set(cnRef, creditNote);

      // c & d. Reverse stock per returned item
      for (const item of invoice.returnedItems) {
        // Seller gets stock back
        const sellerStockId  = StockModel.generateId(sellerUid, item.productId);
        const sellerStockRef = db.collection(Collections.STOCK).doc(sellerStockId);
        const sellerStockDoc = await sellerStockRef.get();

        if (sellerStockDoc.exists) {
          batch.update(sellerStockRef, StockModel.buildReversal(sellerStockDoc.data(), item.quantity));
        }

        // Buyer loses stock
        const buyerStockId  = StockModel.generateId(invoice.buyerId, item.productId);
        const buyerStockRef = db.collection(Collections.STOCK).doc(buyerStockId);
        const buyerStockDoc = await buyerStockRef.get();

        if (buyerStockDoc.exists) {
          const deduction = StockModel.buildDeduction(buyerStockDoc.data(), item.quantity);
          if (deduction.success) {
            batch.update(buyerStockRef, deduction.update);
          }
        }
      }

      await batch.commit();

      return { success: true, creditNoteId: creditNote.creditNoteId };
    } catch (err) {
      return { success: false, error: err.message };
    }
  };

  // ── 5. Reject Return ─────────────────────────────────────────
  /**
   * Seller rejects a return request. No stock changes.
   *
   * @param {string} invoiceId
   * @param {string} sellerUid
   * @param {string} reason
   */
  const rejectReturn = async (invoiceId, sellerUid, reason = '') => {
    try {
      const invoiceDoc = await db.collection(Collections.INVOICES).doc(invoiceId).get();
      if (!invoiceDoc.exists) return { success: false, error: 'Invoice not found.' };

      const invoice = invoiceDoc.data();

      if (invoice.sellerId !== sellerUid) {
        return { success: false, error: 'You are not the seller on this invoice.' };
      }
      if (invoice.returnStatus !== 'requested') {
        return { success: false, error: 'No pending return request found.' };
      }

      await db.collection(Collections.INVOICES).doc(invoiceId).update({
        returnStatus:       'rejected',
        returnRejectReason: reason.trim(),
        returnRejectedAt:   serverTimestamp(),
      });

      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  };

  // ── 6. Get Credit Note ───────────────────────────────────────
  /**
   * @param {string} creditNoteId
   */
  const getCreditNote = async (creditNoteId) => {
    try {
      const doc = await db.collection(Collections.CREDIT_NOTES).doc(creditNoteId).get();
      if (!doc.exists) return { success: false, error: 'Credit note not found.' };
      return { success: true, data: doc.data() };
    } catch (err) {
      return { success: false, error: err.message };
    }
  };

  return {
    getMyInvoices,
    getInvoiceById,
    requestReturn,
    approveReturn,
    rejectReturn,
    getCreditNote,
  };

})();

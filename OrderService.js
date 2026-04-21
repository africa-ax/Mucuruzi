// ============================================================
//  MUCURUZI — OrderService.js
//  Handles the full order lifecycle.
//
//  CONFIRM ORDER RULE — "API First, Batch Second":
//  1. Call RRA API first  (outside Firestore batch)
//  2. Await full RRA response
//  3. Only if RRA succeeds → open Firestore batch
//  4. Write everything atomically in one batch commit
//
//  This guarantees: if RRA fails → nothing is written.
//  If batch fails  → RRA result is discarded, order stays pending.
// ============================================================

const OrderService = (() => {

  // ── 1. Create Order ──────────────────────────────────────────
  /**
   * Buyer places a new order. Saves to Firestore with status: pending.
   *
   * @param {Object} data
   * @param {string} data.sellerId
   * @param {string} data.sellerTIN
   * @param {string} data.sellerName
   * @param {string} data.buyerId
   * @param {string} data.buyerTIN    - empty if buyer has no TIN
   * @param {string} data.buyerName
   * @param {Array}  data.items
   */
  const createOrder = async (data) => {
    try {
      const result = OrderModel.create(data);
      if (!result.success) return result;

      await db.collection(Collections.ORDERS)
        .doc(result.data.orderId)
        .set(result.data);

      return { success: true, data: result.data };
    } catch (err) {
      return { success: false, error: err.message };
    }
  };

  // ── 2. Confirm Order ─────────────────────────────────────────
  /**
   * Seller confirms an order.
   *
   * FLOW (API First, Batch Second):
   *
   * STEP 1 — Check all seller stock availability
   * STEP 2 — Verify purchase code with RRA     [API call]
   * STEP 3 — Submit invoice to RRA             [API call]
   * --- RRA succeeded ---
   * STEP 4 — Build invoice document
   * STEP 5 — Open Firestore batch:
   *           a. Update order → confirmed
   *           b. Save invoice
   *           c. Deduct seller stock (per item)
   *           d. Add buyer stock    (per item)
   * STEP 6 — Commit batch atomically
   *
   * @param {string} orderId
   * @param {string} purchaseCode   - from buyer via *800*SellerTIN#
   * @param {Object} sellerProfile  - current seller's profile
   * @param {Object} buyerProfile   - buyer's profile
   */
  const confirmOrder = async (orderId, purchaseCode, sellerProfile, buyerProfile) => {
    try {

      // ── Fetch the order ────────────────────────────────────
      const orderDoc = await db.collection(Collections.ORDERS).doc(orderId).get();
      if (!orderDoc.exists) return { success: false, error: 'Order not found.' };

      const order = orderDoc.data();

      if (order.status !== ORDER_STATUS.PENDING) {
        return { success: false, error: `Order is already ${order.status}.` };
      }
      if (order.sellerId !== sellerProfile.uid) {
        return { success: false, error: 'You are not the seller for this order.' };
      }

      // ── STEP 1: Check stock availability for all items ────
      for (const item of order.items) {
        const check = await StockService.checkAvailability(
          sellerProfile.uid, item.productId, item.quantity
        );
        if (!check.success) return check;
      }

      // ── STEP 2: Verify purchase code with RRA [API] ───────
      const codeResult = await RRAService.verifyPurchaseCode(
        sellerProfile.tinNumber,
        purchaseCode
      );
      if (!codeResult.success) {
        return { success: false, error: `Purchase code invalid: ${codeResult.message}` };
      }

      // ── STEP 3: Submit invoice to RRA [API] ───────────────
      const invoicePayload = {
        invoiceId:    InvoiceModel.generateId(), // pre-generate for RRA
        sellerTIN:    sellerProfile.tinNumber,
        buyerTIN:     buyerProfile.tinNumber || '000000000',
        items:        order.items,
        subtotal:     order.subtotal,
        vatAmount:    order.vatAmount,
        total:        order.total,
        purchaseCode: codeResult.purchaseCode,
      };

      const rraResult = await RRAService.submitInvoice(invoicePayload);
      if (!rraResult.success) {
        return { success: false, error: `RRA submission failed: ${rraResult.error}` };
      }

      // ── RRA SUCCEEDED — now touch Firestore ───────────────

      // ── STEP 4: Build invoice document ────────────────────
      const orderWithCode = {
        ...order,
        purchaseCode:  codeResult.purchaseCode,
        sellerTIN:     sellerProfile.tinNumber,
        sellerName:    sellerProfile.businessName,
        buyerTIN:      buyerProfile.tinNumber || '',
        buyerName:     buyerProfile.businessName,
      };

      // Override invoiceId to match what was sent to RRA
      const invoiceResult = InvoiceModel.create(orderWithCode, {
        ...rraResult,
        invoiceId: invoicePayload.invoiceId,
      });
      if (!invoiceResult.success) return invoiceResult;

      const invoice = invoiceResult.data;
      // Ensure invoice uses the same ID sent to RRA
      invoice.invoiceId = invoicePayload.invoiceId;

      // ── STEP 5 & 6: Firestore batch ───────────────────────
      const batch = db.batch();

      // a. Update order status
      const orderRef = db.collection(Collections.ORDERS).doc(orderId);
      batch.update(orderRef, {
        status:       ORDER_STATUS.CONFIRMED,
        purchaseCode: codeResult.purchaseCode,
        invoiceId:    invoice.invoiceId,
        confirmedAt:  serverTimestamp(),
      });

      // b. Save invoice
      const invoiceRef = db.collection(Collections.INVOICES).doc(invoice.invoiceId);
      batch.set(invoiceRef, invoice);

      // c. Deduct seller stock per item
      for (const item of order.items) {
        const sellerStockId  = StockModel.generateId(sellerProfile.uid, item.productId);
        const sellerStockRef = db.collection(Collections.STOCK).doc(sellerStockId);
        const sellerStockDoc = await sellerStockRef.get();

        if (sellerStockDoc.exists) {
          const deduction = StockModel.buildDeduction(sellerStockDoc.data(), item.quantity);
          if (!deduction.success) return deduction;
          batch.update(sellerStockRef, deduction.update);
        }
      }

      // d. Add buyer stock per item
      for (const item of order.items) {
        const buyerStockId  = StockModel.generateId(buyerProfile.uid, item.productId);
        const buyerStockRef = db.collection(Collections.STOCK).doc(buyerStockId);
        const buyerStockDoc = await buyerStockRef.get();

        if (buyerStockDoc.exists) {
          // Buyer already has this product — update (singleton rule)
          const update = StockModel.buildUpdate(
            buyerStockDoc.data(),
            item.quantity,
            item.unitPrice,
            item.unitPrice
          );
          batch.update(buyerStockRef, update);
        } else {
          // First time buyer gets this product — create
          const newStock = StockModel.create({
            ownerId:      buyerProfile.uid,
            ownerRole:    buyerProfile.role,
            productId:    item.productId,
            productName:  item.productName,
            unit:         item.unit,
            quantity:     item.quantity,
            buyingPrice:  item.unitPrice,
            sellingPrice: item.unitPrice,
          });
          if (!newStock.success) return newStock;
          batch.set(buyerStockRef, newStock.data);
        }
      }

      // Commit everything atomically
      await batch.commit();

      return { success: true, invoiceId: invoice.invoiceId };

    } catch (err) {
      return { success: false, error: err.message };
    }
  };

  // ── 3. Reject Order ──────────────────────────────────────────
  /**
   * Seller rejects an order. Status update only — no stock change.
   *
   * @param {string} orderId
   * @param {string} sellerUid
   * @param {string} reason
   */
  const rejectOrder = async (orderId, sellerUid, reason = '') => {
    try {
      const doc = await db.collection(Collections.ORDERS).doc(orderId).get();
      if (!doc.exists) return { success: false, error: 'Order not found.' };

      const order = doc.data();
      if (order.sellerId !== sellerUid) {
        return { success: false, error: 'You are not the seller for this order.' };
      }
      if (order.status !== ORDER_STATUS.PENDING) {
        return { success: false, error: `Order is already ${order.status}.` };
      }

      await db.collection(Collections.ORDERS).doc(orderId).update({
        status:     ORDER_STATUS.REJECTED,
        rejectReason: reason.trim(),
        rejectedAt: serverTimestamp(),
      });

      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  };

  // ── 4. Get My Orders ─────────────────────────────────────────
  /**
   * Fetch all orders where user is buyer or seller.
   *
   * @param {string} uid
   * @param {string} role - 'buyer' | 'seller'
   */
  const getMyOrders = async (uid, role = 'buyer') => {
    try {
      const field = role === 'seller' ? 'sellerId' : 'buyerId';
      const snap  = await db.collection(Collections.ORDERS)
        .where(field, '==', uid)
        .orderBy('createdAt', 'desc')
        .get();

      return { success: true, data: snap.docs.map(d => d.data()) };
    } catch (err) {
      return { success: false, error: err.message };
    }
  };

  // ── 5. Get Order By ID ───────────────────────────────────────
  /**
   * @param {string} orderId
   */
  const getOrderById = async (orderId) => {
    try {
      const doc = await db.collection(Collections.ORDERS).doc(orderId).get();
      if (!doc.exists) return { success: false, error: 'Order not found.' };
      return { success: true, data: doc.data() };
    } catch (err) {
      return { success: false, error: err.message };
    }
  };

  return {
    createOrder,
    confirmOrder,
    rejectOrder,
    getMyOrders,
    getOrderById,
  };

})();

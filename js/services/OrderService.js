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
      // If buyer is an Exporter — override all item taxGrades to 'B' (zero-rated)
      // Exports from Rwanda are zero-rated per RRA rules
      if (data.buyerRole === ROLES.EXPORTER && data.items) {
        data.items = data.items.map(item => ({ ...item, taxGrade: 'B' }));
      }

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
  // ── 2. Confirm Order ─────────────────────────────────────────
  /**
   * Confirms an order by calling the secure Vercel API endpoint.
   * All validation, RRA calls, and Firestore writes happen server-side.
   * The browser only sends the orderId and purchaseCode.
   *
   * @param {string} orderId
   * @param {string} purchaseCode
   * @param {Object} sellerProfile  - kept for signature compatibility
   * @param {Object} buyerProfile   - kept for signature compatibility
   */
  const confirmOrder = async (orderId, purchaseCode, sellerProfile, buyerProfile) => {
    try {

      // ── Get Firebase Auth ID token ─────────────────────────
      // This proves to the server that the caller is logged in
      const currentUser = auth.currentUser;
      if (!currentUser) {
        return { success: false, error: 'You must be logged in to confirm orders.' };
      }

      const idToken = await currentUser.getIdToken();

      // ── Call Vercel secure endpoint ────────────────────────
      const response = await fetch('/api/confirmOrder', {
        method: 'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${idToken}`,
        },
        body: JSON.stringify({ orderId, purchaseCode }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        return {
          success: false,
          error: result.error || 'Server error. Please try again.',
        };
      }

      return {
        success:       true,
        invoiceId:     result.invoiceId,
        receiptNumber: result.receiptNumber,
      };

    } catch (err) {
      // Network error — fallback message
      return {
        success: false,
        error: 'Could not reach server. Check your connection and try again.',
      };
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

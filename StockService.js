// ============================================================
//  MUCURUZI — StockService.js
//  Handles all stock operations.
//
//  SINGLETON RULE (NON-NEGOTIABLE):
//  ownerId + productId = ONE stock document always.
//  addStock() checks first — updates if exists, creates if not.
// ============================================================

const StockService = (() => {

  // ── Private: Get Stock Doc ───────────────────────────────────
  const _getStockDoc = async (ownerId, productId) => {
    const stockId = StockModel.generateId(ownerId, productId);
    const doc     = await db.collection(Collections.STOCK).doc(stockId).get();
    return { stockId, doc, exists: doc.exists, data: doc.exists ? doc.data() : null };
  };

  // ── 1. Add Stock ─────────────────────────────────────────────
  /**
   * SINGLETON ENFORCER — the only way stock is ever added.
   *
   * Checks if stock document already exists for this owner + product:
   * - EXISTS  → update quantity (weighted average buying price)
   * - MISSING → create new stock document
   *
   * @param {string} ownerId
   * @param {string} ownerRole
   * @param {string} productId
   * @param {string} productName
   * @param {string} unit
   * @param {number} quantity
   * @param {number} buyingPrice
   * @param {number} sellingPrice
   */
  const addStock = async (
    ownerId, ownerRole, productId, productName,
    unit, quantity, buyingPrice, sellingPrice
  ) => {
    try {
      const { stockId, doc, exists, data } = await _getStockDoc(ownerId, productId);
      const ref = db.collection(Collections.STOCK).doc(stockId);

      if (exists) {
        // ── Update existing stock ──────────────────────────
        const update = StockModel.buildUpdate(data, quantity, buyingPrice, sellingPrice);
        await ref.update(update);
      } else {
        // ── Create new stock document ──────────────────────
        const result = StockModel.create({
          ownerId, ownerRole, productId, productName,
          unit, quantity, buyingPrice, sellingPrice,
        });
        if (!result.success) return result;
        await ref.set(result.data);
      }

      return { success: true, stockId };
    } catch (err) {
      return { success: false, error: err.message };
    }
  };

  // ── 2. Deduct Stock ──────────────────────────────────────────
  /**
   * Reduces stock quantity after a confirmed sale.
   * Fails safely if quantity is insufficient.
   *
   * @param {string} ownerId
   * @param {string} productId
   * @param {number} quantity
   */
  const deductStock = async (ownerId, productId, quantity) => {
    try {
      const { doc, exists, data } = await _getStockDoc(ownerId, productId);

      if (!exists) return { success: false, error: 'Stock record not found.' };

      const result = StockModel.buildDeduction(data, quantity);
      if (!result.success) return result;

      await doc.ref.update(result.update);
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  };

  // ── 3. Reverse Stock ─────────────────────────────────────────
  /**
   * Adds stock back after an approved return.
   * Called on the SELLER's stock (goods come back to seller).
   *
   * @param {string} ownerId
   * @param {string} productId
   * @param {number} quantity
   */
  const reverseStock = async (ownerId, productId, quantity) => {
    try {
      const { doc, exists, data } = await _getStockDoc(ownerId, productId);

      if (!exists) return { success: false, error: 'Stock record not found for reversal.' };

      const update = StockModel.buildReversal(data, quantity);
      await doc.ref.update(update);
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  };

  // ── 4. Get My Stock ──────────────────────────────────────────
  /**
   * Fetch all stock for a given owner, optionally filtered by type.
   *
   * @param {string} uid
   * @param {string|null} stockType - 'inventory' | 'rawMaterial' | null (all)
   */
  const getMyStock = async (uid, stockType = null) => {
    try {
      let query = db.collection(Collections.STOCK)
        .where('ownerId', '==', uid)
        .orderBy('updatedAt', 'desc');

      if (stockType) {
        query = db.collection(Collections.STOCK)
          .where('ownerId', '==', uid)
          .where('stockType', '==', stockType)
          .orderBy('updatedAt', 'desc');
      }

      const snap = await query.get();
      return { success: true, data: snap.docs.map(d => d.data()) };
    } catch (err) {
      return { success: false, error: err.message };
    }
  };

  // ── 5. Get Stock Item ────────────────────────────────────────
  /**
   * Fetch a single stock document.
   *
   * @param {string} ownerId
   * @param {string} productId
   */
  const getStockItem = async (ownerId, productId) => {
    try {
      const { exists, data } = await _getStockDoc(ownerId, productId);
      if (!exists) return { success: false, error: 'Stock item not found.' };
      return { success: true, data };
    } catch (err) {
      return { success: false, error: err.message };
    }
  };

  // ── 6. Check Availability ────────────────────────────────────
  /**
   * Check if a seller has enough stock before confirming an order.
   *
   * @param {string} ownerId
   * @param {string} productId
   * @param {number} requiredQty
   */
  const checkAvailability = async (ownerId, productId, requiredQty) => {
    try {
      const { exists, data } = await _getStockDoc(ownerId, productId);

      if (!exists) {
        return { success: false, available: false, error: 'Product not in stock.' };
      }
      if (data.quantity < requiredQty) {
        return {
          success:   false,
          available: false,
          error:     `Insufficient stock. Available: ${data.quantity} ${data.unit}, Required: ${requiredQty}.`,
        };
      }

      return { success: true, available: true, currentQty: data.quantity };
    } catch (err) {
      return { success: false, error: err.message };
    }
  };

  return {
    addStock,
    deductStock,
    reverseStock,
    getMyStock,
    getStockItem,
    checkAvailability,
  };

})();

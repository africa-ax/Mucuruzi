// ============================================================
//  MUCURUZI — Stock Model
//  Defines the shape of a stock document in Firestore.
//  Collection: stock/{ownerId_productId}
//
//  SINGLETON RULE (NON-NEGOTIABLE):
//  For every unique ownerId + productId combination,
//  only ONE stock document may ever exist.
//  stockId = ownerId_productId — always.
// ============================================================

const StockModel = (() => {

  /**
   * Generates the singleton stock document ID.
   * This is the only way stock IDs should ever be created.
   *
   * @param {string} ownerId
   * @param {string} productId
   * @returns {string} e.g. "uid123_PRD-001"
   */
  const generateId = (ownerId, productId) => {
    if (!ownerId || !productId) {
      throw new Error('StockModel.generateId: ownerId and productId are required.');
    }
    return `${ownerId}_${productId}`;
  };

  /**
   * Creates a NEW stock document (first time this owner gets this product).
   * For subsequent purchases of same product → use buildUpdate() instead.
   *
   * @param {Object} data
   * @param {string} data.ownerId
   * @param {string} data.ownerRole       - used to determine stockType
   * @param {string} data.productId
   * @param {string} data.productName
   * @param {string} data.unit
   * @param {number} data.quantity        - initial quantity
   * @param {number} data.buyingPrice     - price paid per unit
   * @param {number} data.sellingPrice    - price to sell at per unit
   *
   * @returns {{success: boolean, data?: Object, error?: string}}
   */
  const create = (data) => {
    const {
      ownerId, ownerRole,
      productId, productName, unit,
      quantity, buyingPrice, sellingPrice,
    } = data;

    // ── Validation ─────────────────────────────────────────
    if (!ownerId)     return { success: false, error: 'ownerId is required.' };
    if (!ownerRole)   return { success: false, error: 'ownerRole is required.' };
    if (!productId)   return { success: false, error: 'productId is required.' };
    if (!productName) return { success: false, error: 'productName is required.' };
    if (!unit)        return { success: false, error: 'unit is required.' };

    if (typeof quantity !== 'number' || quantity < 0) {
      return { success: false, error: 'quantity must be a non-negative number.' };
    }
    if (typeof buyingPrice !== 'number' || buyingPrice < 0) {
      return { success: false, error: 'buyingPrice must be a non-negative number.' };
    }
    if (typeof sellingPrice !== 'number' || sellingPrice < 0) {
      return { success: false, error: 'sellingPrice must be a non-negative number.' };
    }

    // ── Stock Type Routing ─────────────────────────────────
    // Manufacturer buying → rawMaterial
    // Everyone else      → inventory
    const stockType = getStockType(ownerRole);

    // ── Build Object ───────────────────────────────────────
    const stockId = generateId(ownerId, productId);

    return {
      success: true,
      data: {
        stockId,
        ownerId,
        productId,
        productName:   productName.trim(),
        unit,
        stockType,
        quantity:      Price.round(quantity),
        buyingPrice:   Price.round(buyingPrice),
        sellingPrice:  Price.round(sellingPrice),
        lastPurchaseDate: serverTimestamp(),
        lastSaleDate:     null,
        updatedAt:        serverTimestamp(),
      },
    };
  };

  /**
   * Builds an update object for when the same owner buys the same product again.
   * Recalculates average buying price and adds to existing quantity.
   * NEVER creates a new document — always updates the existing one.
   *
   * @param {Object} existingStock  - current stock document from Firestore
   * @param {number} newQuantity    - quantity being added
   * @param {number} newBuyingPrice - price paid in this new purchase
   * @param {number} newSellingPrice - updated selling price (optional)
   *
   * @returns {Object} Firestore update payload
   */
  const buildUpdate = (existingStock, newQuantity, newBuyingPrice, newSellingPrice) => {
    const oldQty   = existingStock.quantity      || 0;
    const oldPrice = existingStock.buyingPrice   || 0;

    // Weighted average cost price
    const totalQty    = Price.round(oldQty + newQuantity);
    const avgPrice    = Price.round(
      ((oldQty * oldPrice) + (newQuantity * newBuyingPrice)) / totalQty
    );

    return {
      quantity:         totalQty,
      buyingPrice:      avgPrice,
      sellingPrice:     newSellingPrice
                          ? Price.round(newSellingPrice)
                          : existingStock.sellingPrice,
      lastPurchaseDate: serverTimestamp(),
      updatedAt:        serverTimestamp(),
    };
  };

  /**
   * Builds an update object for when stock is deducted after a sale.
   *
   * @param {Object} existingStock
   * @param {number} soldQuantity
   * @returns {{success: boolean, update?: Object, error?: string}}
   */
  const buildDeduction = (existingStock, soldQuantity) => {
    if (existingStock.quantity < soldQuantity) {
      return {
        success: false,
        error: `Insufficient stock. Available: ${existingStock.quantity} ${existingStock.unit}.`,
      };
    }

    return {
      success: true,
      update: {
        quantity:     Price.round(existingStock.quantity - soldQuantity),
        lastSaleDate: serverTimestamp(),
        updatedAt:    serverTimestamp(),
      },
    };
  };

  /**
   * Builds an update object for when stock is reversed after a return.
   *
   * @param {Object} existingStock
   * @param {number} returnedQuantity
   * @returns {Object} Firestore update payload
   */
  const buildReversal = (existingStock, returnedQuantity) => {
    return {
      quantity:  Price.round(existingStock.quantity + returnedQuantity),
      updatedAt: serverTimestamp(),
    };
  };

  return {
    generateId,
    create,
    buildUpdate,
    buildDeduction,
    buildReversal,
  };

})();

// ============================================================
//  MUCURUZI — Order Model
//  Defines the shape of an order document in Firestore.
//  Collection: orders/{orderId}
// ============================================================

const OrderModel = (() => {

  /**
   * Generates a unique order ID
   * @returns {string}
   */
  const generateId = () => {
    return 'ORD-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6).toUpperCase();
  };

  /**
   * Calculates totals for an array of order items.
   * Applies VAT per item based on its taxGrade.
   * ALL arithmetic goes through Price.round().
   *
   * @param {Array} items
   * @returns {{subtotal, vatAmount, total, items}}
   */
  const calculateTotals = (items) => {
    let subtotal  = 0;
    let vatAmount = 0;

    const enrichedItems = items.map((item) => {
      const lineSubtotal = Price.round(item.quantity * item.unitPrice);
      const lineVAT      = Price.calcVAT(lineSubtotal, item.taxGrade);
      const lineTotal    = Price.round(lineSubtotal + lineVAT);

      subtotal  += lineSubtotal;
      vatAmount += lineVAT;

      return {
        ...item,
        lineSubtotal,
        vatAmount: lineVAT,
        lineTotal,
      };
    });

    return {
      items:     enrichedItems,
      subtotal:  Price.round(subtotal),
      vatAmount: Price.round(vatAmount),
      total:     Price.round(subtotal + vatAmount),
    };
  };

  /**
   * Creates a clean validated order object ready to save to Firestore.
   *
   * @param {Object} data
   * @param {string} data.sellerId
   * @param {string} data.sellerTIN
   * @param {string} data.sellerName
   * @param {string} data.buyerId
   * @param {string} data.buyerTIN       - empty string if buyer has no TIN
   * @param {string} data.buyerName
   * @param {Array}  data.items          - array of order line items
   * @param {string} [data.purchaseCode] - from *800*SellerTIN# — added later
   *
   * @returns {{success: boolean, data?: Object, error?: string}}
   */
  const create = (data) => {
    const {
      sellerId, sellerTIN, sellerName,
      buyerId,  buyerTIN = '', buyerName,
      items,
      purchaseCode = '',
    } = data;

    // ── Validation ─────────────────────────────────────────
    if (!sellerId)   return { success: false, error: 'sellerId is required.' };
    if (!sellerTIN)  return { success: false, error: 'sellerTIN is required.' };
    if (!sellerName) return { success: false, error: 'sellerName is required.' };
    if (!buyerId)    return { success: false, error: 'buyerId is required.' };
    if (!buyerName)  return { success: false, error: 'buyerName is required.' };

    if (!items || !Array.isArray(items) || items.length === 0) {
      return { success: false, error: 'Order must have at least one item.' };
    }

    // Validate each item
    for (const item of items) {
      if (!item.productId)   return { success: false, error: 'Each item must have a productId.' };
      if (!item.productName) return { success: false, error: 'Each item must have a productName.' };
      if (!item.rraItemCode) return { success: false, error: 'Each item must have an rraItemCode.' };
      if (!item.unit)        return { success: false, error: 'Each item must have a unit.' };
      if (typeof item.quantity !== 'number' || item.quantity <= 0) {
        return { success: false, error: `Invalid quantity for item: ${item.productName}.` };
      }
      if (typeof item.unitPrice !== 'number' || item.unitPrice <= 0) {
        return { success: false, error: `Invalid unit price for item: ${item.productName}.` };
      }
      if (!item.taxGrade || !TAX_GRADES[item.taxGrade]) {
        return { success: false, error: `Invalid tax grade for item: ${item.productName}.` };
      }
    }

    // ── Calculate Totals ───────────────────────────────────
    const totals   = calculateTotals(items);
    const orderId  = generateId();

    // ── Build Object ───────────────────────────────────────
    return {
      success: true,
      data: {
        orderId,
        sellerId,
        sellerTIN,
        sellerName,
        buyerId,
        buyerTIN:     buyerTIN || '',        // empty for non-business buyers
        buyerName,
        items:        totals.items,
        subtotal:     totals.subtotal,
        vatAmount:    totals.vatAmount,
        total:        totals.total,
        purchaseCode, // filled in when buyer provides *800# code
        status:       ORDER_STATUS.PENDING,  // always starts as pending
        hasReturn:    false,
        createdAt:    serverTimestamp(),
      },
    };
  };

  return { create, generateId, calculateTotals };

})();

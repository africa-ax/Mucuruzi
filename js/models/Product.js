// ============================================================
//  MUCURUZI — Product Model
//  Defines the shape of a product document in Firestore.
//  Collection: products/{productId}
// ============================================================

const ProductModel = (() => {

  /**
   * Generates a unique product ID
   * @returns {string}
   */
  const generateId = () => {
    return 'PRD-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6).toUpperCase();
  };

  /**
   * Creates a clean validated product object ready to save to Firestore.
   *
   * @param {Object} data
   * @param {string} data.productName
   * @param {string} data.rraItemCode   - must be exactly 8 digits (UNSPSC)
   * @param {string} data.category
   * @param {string} data.unit          - must be from official RRA units list
   * @param {string} data.taxGrade      - A, B, C, or D
   * @param {string} data.createdBy     - uid of the seller creating the product
   *
   * @returns {{success: boolean, data?: Object, error?: string}}
   */
  const create = (data) => {
    const {
      productName, rraItemCode,
      category, unit, taxGrade,
      createdBy,
    } = data;

    // ── Validation ─────────────────────────────────────────
    if (!productName) return { success: false, error: 'Product name is required.' };

    if (!rraItemCode || !/^\d{8}$/.test(String(rraItemCode).trim())) {
      return { success: false, error: 'RRA item code must be exactly 8 digits (UNSPSC standard).' };
    }

    if (!category) return { success: false, error: 'Category is required.' };

    if (!unit || !UNIT_LIST.includes(unit)) {
      return { success: false, error: `Unit must be one of: ${UNIT_LIST.join(', ')}.` };
    }

    if (!taxGrade || !TAX_GRADES[taxGrade]) {
      return { success: false, error: 'Tax grade must be A, B, C, or D.' };
    }

    if (!createdBy) return { success: false, error: 'createdBy (uid) is required.' };

    // ── Build Object ───────────────────────────────────────
    const productId = generateId();

    return {
      success: true,
      data: {
        productId,
        productName:  productName.trim(),
        rraItemCode:  String(rraItemCode).trim(),
        category:     category.trim(),
        unit,
        taxGrade,
        vatRate:      TAX_GRADES[taxGrade].vatRate,
        taxGradeLabel: TAX_GRADES[taxGrade].label,
        createdBy,
        createdAt:    serverTimestamp(),
      },
    };
  };

  return { create, generateId };

})();

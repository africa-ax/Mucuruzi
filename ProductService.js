// ============================================================
//  MUCURUZI — ProductService.js
//  Handles product creation, retrieval and RRA item search.
// ============================================================

const ProductService = (() => {

  // Cache for rra_items.json — loaded once
  let _rraItemsCache = null;

  // ── Private: Load RRA Items ──────────────────────────────────
  const _loadRRAItems = async () => {
    if (_rraItemsCache) return _rraItemsCache;
    try {
      const res  = await fetch('data/rra_items.json');
      _rraItemsCache = await res.json();
      return _rraItemsCache;
    } catch (err) {
      console.error('[ProductService] Failed to load rra_items.json:', err);
      return [];
    }
  };

  // ── 1. Search RRA Items ──────────────────────────────────────
  /**
   * Search the local RRA product catalog by name, code or category.
   * Used during product creation so sellers pick official items.
   *
   * @param {string} query
   * @returns {Promise<{success: boolean, data?: Array, error?: string}>}
   */
  const searchRRAItems = async (query) => {
    try {
      if (!query || query.trim().length < 2) {
        return { success: false, error: 'Search query must be at least 2 characters.' };
      }

      const items = await _loadRRAItems();
      const q     = query.trim().toLowerCase();

      const results = items.filter(item =>
        item.productName.toLowerCase().includes(q) ||
        item.itemCode.includes(q) ||
        item.category.toLowerCase().includes(q)
      );

      return { success: true, data: results };
    } catch (err) {
      return { success: false, error: err.message };
    }
  };

  // ── 2. Create Product ────────────────────────────────────────
  /**
   * Validates and saves a new product to Firestore.
   * Only seller roles can create products.
   *
   * @param {Object} data  - product fields
   * @param {string} uid   - seller uid
   * @param {string} role  - seller role
   */
  const createProduct = async (data, uid, role) => {
    try {
      if (!ROLE_CAN_SELL.includes(role)) {
        return { success: false, error: 'Only sellers can create products.' };
      }

      const result = ProductModel.create({ ...data, createdBy: uid });
      if (!result.success) return result;

      await db.collection(Collections.PRODUCTS)
        .doc(result.data.productId)
        .set(result.data);

      return { success: true, data: result.data };
    } catch (err) {
      return { success: false, error: err.message };
    }
  };

  // ── 3. Get My Products ───────────────────────────────────────
  /**
   * Fetch all products created by a specific seller.
   *
   * @param {string} uid
   */
  const getMyProducts = async (uid) => {
    try {
      const snap = await db.collection(Collections.PRODUCTS)
        .where('createdBy', '==', uid)
        .orderBy('createdAt', 'desc')
        .get();

      return { success: true, data: snap.docs.map(d => d.data()) };
    } catch (err) {
      return { success: false, error: err.message };
    }
  };

  // ── 4. Get Product By ID ─────────────────────────────────────
  /**
   * @param {string} productId
   */
  const getProductById = async (productId) => {
    try {
      const doc = await db.collection(Collections.PRODUCTS).doc(productId).get();
      if (!doc.exists) return { success: false, error: 'Product not found.' };
      return { success: true, data: doc.data() };
    } catch (err) {
      return { success: false, error: err.message };
    }
  };

  // ── 5. Get All Products ──────────────────────────────────────
  /**
   * Fetch all products — used in marketplace browsing.
   */
  const getAllProducts = async () => {
    try {
      const snap = await db.collection(Collections.PRODUCTS)
        .orderBy('createdAt', 'desc')
        .get();

      return { success: true, data: snap.docs.map(d => d.data()) };
    } catch (err) {
      return { success: false, error: err.message };
    }
  };

  return {
    searchRRAItems,
    createProduct,
    getMyProducts,
    getProductById,
    getAllProducts,
  };

})();

// ============================================================
//  MUCURUZI — MarketplaceService.js
//  Handles public listings, product discovery, and business search.
//
//  Two discovery paths:
//  1. Search product  → see all sellers, sorted cheapest first
//  2. Search business → see that seller's full listing page
//
//  Marketplace is a DISCOVERY layer only.
//  All actual transactions go through OrderService.
// ============================================================

const MarketplaceService = (() => {

  // ── Private: Generate Listing ID ────────────────────────────
  const _generateListingId = (sellerId, productId) => `${sellerId}_${productId}`;

  // ── 1. Create Listing ────────────────────────────────────────
  /**
   * Seller lists a product on the marketplace.
   * One listing per seller per product (same singleton pattern).
   *
   * @param {string} sellerId
   * @param {Object} sellerProfile
   * @param {Object} product       - product document
   * @param {number} publicPrice   - price shown on marketplace
   */
  const createListing = async (sellerId, sellerProfile, product, publicPrice) => {
    try {
      if (!ROLE_CAN_SELL.includes(sellerProfile.role)) {
        return { success: false, error: 'Only sellers can create listings.' };
      }
      if (typeof publicPrice !== 'number' || publicPrice <= 0) {
        return { success: false, error: 'Public price must be a positive number.' };
      }

      const listingId = _generateListingId(sellerId, product.productId);

      const listing = {
        listingId,
        sellerId,
        sellerName:   sellerProfile.businessName,
        sellerRole:   sellerProfile.role,
        sellerTIN:    sellerProfile.tinNumber,
        sellerDistrict: sellerProfile.district,
        productId:    product.productId,
        productName:  product.productName,
        rraItemCode:  product.rraItemCode,
        category:     product.category,
        unit:         product.unit,
        taxGrade:     product.taxGrade,
        publicPrice:  Price.round(publicPrice),
        isActive:     true,
        viewCount:    0,
        createdAt:    serverTimestamp(),
        updatedAt:    serverTimestamp(),
      };

      await db.collection(Collections.LISTINGS).doc(listingId).set(listing);
      return { success: true, data: listing };
    } catch (err) {
      return { success: false, error: err.message };
    }
  };

  // ── 2. Toggle Listing ────────────────────────────────────────
  /**
   * Seller turns their listing on or off.
   *
   * @param {string} listingId
   * @param {boolean} isActive
   * @param {string} sellerUid
   */
  const toggleListing = async (listingId, isActive, sellerUid) => {
    try {
      const doc = await db.collection(Collections.LISTINGS).doc(listingId).get();
      if (!doc.exists) return { success: false, error: 'Listing not found.' };
      if (doc.data().sellerId !== sellerUid) {
        return { success: false, error: 'You do not own this listing.' };
      }

      await db.collection(Collections.LISTINGS).doc(listingId).update({
        isActive,
        updatedAt: serverTimestamp(),
      });

      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  };

  // ── 3. Update Listing Price ──────────────────────────────────
  /**
   * @param {string} listingId
   * @param {number} newPrice
   * @param {string} sellerUid
   */
  const updateListingPrice = async (listingId, newPrice, sellerUid) => {
    try {
      if (typeof newPrice !== 'number' || newPrice <= 0) {
        return { success: false, error: 'Price must be a positive number.' };
      }

      const doc = await db.collection(Collections.LISTINGS).doc(listingId).get();
      if (!doc.exists) return { success: false, error: 'Listing not found.' };
      if (doc.data().sellerId !== sellerUid) {
        return { success: false, error: 'You do not own this listing.' };
      }

      await db.collection(Collections.LISTINGS).doc(listingId).update({
        publicPrice: Price.round(newPrice),
        updatedAt:   serverTimestamp(),
      });

      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  };

  // ── 4. Get Listings ──────────────────────────────────────────
  /**
   * Get all active listings with optional category filter.
   * Sorted cheapest first.
   *
   * @param {Object} filters - {category?: string}
   */
  const getListings = async (filters = {}) => {
    try {
      let query = db.collection(Collections.LISTINGS)
        .where('isActive', '==', true)
        .orderBy('publicPrice', 'asc');

      if (filters.category) {
        query = db.collection(Collections.LISTINGS)
          .where('isActive', '==', true)
          .where('category', '==', filters.category)
          .orderBy('publicPrice', 'asc');
      }

      const snap = await query.get();
      return { success: true, data: snap.docs.map(d => d.data()) };
    } catch (err) {
      return { success: false, error: err.message };
    }
  };

  // ── 5. Get Listings By Product ───────────────────────────────
  /**
   * Get all sellers of the same product, sorted cheapest first.
   * This powers the "compare sellers" feature (Option A — sorted list).
   *
   * @param {string} productId
   */
  const getListingsByProduct = async (productId) => {
    try {
      const snap = await db.collection(Collections.LISTINGS)
        .where('isActive',  '==', true)
        .where('productId', '==', productId)
        .orderBy('publicPrice', 'asc')
        .get();

      return { success: true, data: snap.docs.map(d => d.data()) };
    } catch (err) {
      return { success: false, error: err.message };
    }
  };

  // ── 6. Get Listings By Seller ────────────────────────────────
  /**
   * Get all active listings from one business.
   * Powers the Business Profile page.
   *
   * @param {string} sellerId
   */
  const getListingsBySeller = async (sellerId) => {
    try {
      const snap = await db.collection(Collections.LISTINGS)
        .where('sellerId', '==', sellerId)
        .where('isActive', '==', true)
        .orderBy('publicPrice', 'asc')
        .get();

      return { success: true, data: snap.docs.map(d => d.data()) };
    } catch (err) {
      return { success: false, error: err.message };
    }
  };

  // ── 7. Search Listings ───────────────────────────────────────
  /**
   * Search active listings by product name or business name.
   * Client-side filter (Firestore limitation).
   *
   * @param {string} query
   */
  const searchListings = async (query) => {
    try {
      if (!query || query.trim().length < 2) {
        return { success: false, error: 'Search query must be at least 2 characters.' };
      }

      const q    = query.trim().toLowerCase();
      const snap = await db.collection(Collections.LISTINGS)
        .where('isActive', '==', true)
        .get();

      const results = snap.docs
        .map(d => d.data())
        .filter(l =>
          l.productName.toLowerCase().includes(q) ||
          l.sellerName.toLowerCase().includes(q)  ||
          l.category.toLowerCase().includes(q)
        )
        .sort((a, b) => a.publicPrice - b.publicPrice); // cheapest first

      return { success: true, data: results };
    } catch (err) {
      return { success: false, error: err.message };
    }
  };

  // ── 8. Increment View Count ──────────────────────────────────
  /**
   * Track how many times a listing was viewed.
   * Called silently — no await needed in UI.
   *
   * @param {string} listingId
   */
  const incrementViewCount = (listingId) => {
    db.collection(Collections.LISTINGS).doc(listingId).update({
      viewCount: increment(1),
    }).catch(() => {}); // silent fail — view count is not critical
  };

  return {
    createListing,
    toggleListing,
    updateListingPrice,
    getListings,
    getListingsByProduct,
    getListingsBySeller,
    searchListings,
    incrementViewCount,
  };

})();

// ============================================================
//  MUCURUZI — ProductListView.js
//  Manufacturer only. Full product management.
//
//  Each product card has:
//  - Edit Name button
//  - Delete button
//  - List on Marketplace button (if not listed)
//  - Listed badge with Remove option (if already listed)
// ============================================================

const ProductListView = (() => {

  let _allProducts = [];
  let _listings    = {};  // productId → listing doc

  const render = async (user, root) => {
    root.innerHTML = `
      <div class="page-header" style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px">
        <div>
          <h1 class="page-title">My Products</h1>
          <p class="page-subtitle">Manage your registered products</p>
        </div>
        <button class="btn btn-primary" onclick="Router.navigate('#product-form')">
          + Add Product
        </button>
      </div>

      <div class="form-group">
        <input id="product-search" type="text" class="form-input"
          placeholder="Search by name, code or category..."
          oninput="ProductListView._filter(this.value)" />
      </div>

      <div id="product-list">
        <div class="loader-spinner" style="margin:40px auto;"></div>
      </div>
    `;

    await _load(user);
  };

  const _load = async (user) => {
    const [productsRes, listingsRes] = await Promise.all([
      ProductService.getMyProducts(user.uid),
      MarketplaceService.getListingsBySeller(user.uid),
    ]);

    _allProducts = productsRes.data || [];

    // Build listings map by productId
    _listings = {};
    (listingsRes.data || []).forEach(l => {
      _listings[l.productId] = l;
    });

    _render(_allProducts);
  };

  const _filter = (query) => {
    const q = query.toLowerCase();
    _render(_allProducts.filter(p =>
      p.productName.toLowerCase().includes(q) ||
      p.rraItemCode.includes(q) ||
      p.category.toLowerCase().includes(q)
    ));
  };

  const _render = (products) => {
    const el = document.getElementById('product-list');
    if (!el) return;

    if (products.length === 0) {
      el.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">⬡</div>
          <h3 class="empty-state-title">No products yet</h3>
          <p class="empty-state-text">
            Add your first product using official RRA item codes.
          </p>
          <button class="btn btn-primary mt-md"
            onclick="Router.navigate('#product-form')">
            + Add Product
          </button>
        </div>
      `;
      return;
    }

    el.innerHTML = `
      <div class="product-grid">
        ${products.map(p => {
          const isListed = !!_listings[p.productId];
          const listing  = _listings[p.productId];
          return `
            <div class="card product-card">

              <!-- RRA info row -->
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
                <span class="badge badge-muted">${p.rraItemCode}</span>
                <span class="badge badge-${_taxBadge(p.taxGrade)}">
                  Grade ${p.taxGrade}
                </span>
              </div>

              <!-- Product name -->
              <h3 style="font-family:var(--font-display);font-size:1rem;font-weight:700;margin-bottom:2px">
                ${p.productName}
              </h3>
              <p class="text-muted text-xs">${p.category} · ${p.unit}</p>

              <!-- Marketplace status -->
              <div style="margin:10px 0;padding:8px;background:var(--color-surface-2);border-radius:var(--radius-sm)">
                ${isListed ? `
                  <div style="display:flex;align-items:center;justify-content:space-between">
                    <div>
                      <span class="badge badge-success">✓ Listed</span>
                      <p class="text-xs text-muted mt-sm">
                        ${Formatters.formatCurrency(listing.publicPrice)} / ${p.unit}
                      </p>
                    </div>
                  </div>
                ` : `
                  <p class="text-xs text-muted">Not listed on marketplace</p>
                `}
              </div>

              <!-- Action buttons -->
              <div style="display:flex;flex-direction:column;gap:6px;margin-top:auto">

                ${isListed ? `
                  <button class="btn btn-secondary btn-sm btn-block"
                    onclick="ProductListView._openListModal('${p.productId}')">
                    ✏ Update Listing
                  </button>
                  <button class="btn btn-danger btn-sm btn-block"
                    onclick="ProductListView._removeListing('${listing.listingId}', '${p.productName.replace(/'/g, "\\'")}')">
                    ✕ Remove from Marketplace
                  </button>
                ` : `
                  <button class="btn btn-primary btn-sm btn-block"
                    onclick="ProductListView._openListModal('${p.productId}')">
                    ⊞ List on Marketplace
                  </button>
                `}

                <div style="display:flex;gap:6px">
                  <button class="btn btn-secondary btn-sm" style="flex:1"
                    onclick="ProductListView._editName('${p.productId}', '${p.productName.replace(/'/g, "\\'")}')">
                    ✏ Edit Name
                  </button>
                  <button class="btn btn-danger btn-sm"
                    onclick="ProductListView._deleteProduct('${p.productId}', '${p.productName.replace(/'/g, "\\'")}')">
                    🗑
                  </button>
                </div>

              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  };

  // ── List on Marketplace ───────────────────────────────────────
  const _openListModal = (productId) => {
    const product = _allProducts.find(p => p.productId === productId);
    if (!product) return;

    const existingListing = _listings[productId];
    const currentPrice    = existingListing?.publicPrice || '';
    const currentStock    = '';

    Modal.show({
      title: existingListing ? 'Update Listing' : 'List on Marketplace',
      body: `
        <div style="background:var(--color-surface-2);border-radius:var(--radius-md);padding:var(--space-md);margin-bottom:var(--space-md)">
          <p style="font-weight:700">${product.productName}</p>
          <p class="text-muted text-xs">${product.rraItemCode} · ${product.category} · ${product.unit}</p>
        </div>

        <div class="form-group">
          <label class="form-label">
            Public Selling Price (RWF per ${product.unit})
          </label>
          <input id="modal-listing-price" type="number" class="form-input"
            value="${currentPrice}"
            placeholder="e.g. 1500" min="0" step="1" />
        </div>

        ${!existingListing ? `
          <div class="form-group">
            <label class="form-label">
              Stock Quantity to Add (${product.unit})
            </label>
            <input id="modal-listing-stock" type="number" class="form-input"
              placeholder="e.g. 500" min="0" step="1" />
            <p class="form-hint">
              Leave at 0 if you already have stock in inventory.
            </p>
          </div>
        ` : ''}
      `,
      confirmText: existingListing ? 'Update Price' : 'List Product',
      onConfirm:   () => _submitListing(product, !!existingListing),
    });
  };

  const _submitListing = async (product, isUpdate) => {
    const price    = parseFloat(document.getElementById('modal-listing-price')?.value);
    const stockQty = parseFloat(document.getElementById('modal-listing-stock')?.value) || 0;

    if (!price || price <= 0) {
      Toast.error('Please enter a valid selling price.');
      return;
    }

    Loader.show(isUpdate ? 'Updating listing...' : 'Listing product...');

    const user    = window.currentUser;
    const stockId = StockModel.generateId(user.uid, product.productId);

    if (isUpdate) {
      // Update price only
      const listingId = `${user.uid}_${product.productId}`;
      await MarketplaceService.updateListingPrice(listingId, price, user.uid);
    } else {
      // Create listing
      await MarketplaceService.createListing(user.uid, user, product, price);

      // Add stock if quantity provided
      if (stockQty > 0) {
        const stockRef = db.collection(Collections.STOCK).doc(stockId);
        const stockDoc = await stockRef.get();

        if (stockDoc.exists) {
          const update = StockModel.buildUpdate(stockDoc.data(), stockQty, 0, price);
          await stockRef.update({ ...update, source: 'produced' });
        } else {
          await stockRef.set({
            stockId,
            ownerId:          user.uid,
            productId:        product.productId,
            productName:      product.productName,
            unit:             product.unit,
            stockType:        STOCK_TYPES.INVENTORY,
            source:           'produced',
            quantity:         Price.round(stockQty),
            buyingPrice:      0,
            sellingPrice:     Price.round(price),
            lastPurchaseDate: serverTimestamp(),
            lastSaleDate:     null,
            updatedAt:        serverTimestamp(),
          });
        }
      }
    }

    Loader.hide();
    Toast.success(isUpdate ? 'Listing price updated!' : `${product.productName} listed on marketplace!`);
    await _load(user);
  };

  // ── Remove Listing ────────────────────────────────────────────
  const _removeListing = (listingId, productName) => {
    Modal.danger(
      'Remove Listing',
      `Remove "${productName}" from the marketplace? Your stock is not affected.`,
      async () => {
        Loader.show('Removing...');
        await db.collection(Collections.LISTINGS).doc(listingId).delete();
        Loader.hide();
        Toast.success(`${productName} removed from marketplace.`);
        await _load(window.currentUser);
      },
      'Remove'
    );
  };

  // ── Edit Product Name ─────────────────────────────────────────
  const _editName = (productId, currentName) => {
    Modal.show({
      title:       'Edit Product Name',
      confirmText: 'Save Name',
      body: `
        <div class="form-group">
          <label class="form-label">Product Name</label>
          <input id="edit-product-name" type="text" class="form-input"
            value="${currentName}" autocomplete="off" />
        </div>
      `,
      onConfirm: async () => {
        const newName = document.getElementById('edit-product-name')?.value.trim();
        if (!newName) { Toast.error('Product name cannot be empty.'); return; }

        Loader.show('Updating...');

        // Update product name
        await db.collection(Collections.PRODUCTS).doc(productId).update({
          productName: newName,
        });

        // Update stock document name if exists
        const stockId  = StockModel.generateId(window.currentUser.uid, productId);
        const stockDoc = await db.collection(Collections.STOCK).doc(stockId).get();
        if (stockDoc.exists) {
          await db.collection(Collections.STOCK).doc(stockId).update({
            productName: newName,
            updatedAt:   serverTimestamp(),
          });
        }

        // Update listing name if exists
        const listingId  = `${window.currentUser.uid}_${productId}`;
        const listingDoc = await db.collection(Collections.LISTINGS).doc(listingId).get();
        if (listingDoc.exists) {
          await db.collection(Collections.LISTINGS).doc(listingId).update({
            productName: newName,
            updatedAt:   serverTimestamp(),
          });
        }

        Loader.hide();
        Toast.success('Product name updated.');
        await _load(window.currentUser);
      },
    });
  };

  // ── Delete Product ────────────────────────────────────────────
  const _deleteProduct = (productId, productName) => {
    Modal.danger(
      'Delete Product',
      `Delete "${productName}"? This will also remove it from the marketplace. Stock records are kept for audit.`,
      async () => {
        Loader.show('Deleting...');

        const user = window.currentUser;

        // Delete product
        await db.collection(Collections.PRODUCTS).doc(productId).delete();

        // Delete listing if exists
        const listingId = `${user.uid}_${productId}`;
        const listingDoc = await db.collection(Collections.LISTINGS).doc(listingId).get();
        if (listingDoc.exists) {
          await db.collection(Collections.LISTINGS).doc(listingId).delete();
        }

        // Note: stock is kept for audit trail — not deleted

        Loader.hide();
        Toast.success(`${productName} deleted.`);
        await _load(user);
      },
      'Delete'
    );
  };

  const _taxBadge = (g) => ({ A:'warning', B:'info', C:'success', D:'muted' }[g] || 'muted');

  return { render, _filter, _openListModal, _removeListing, _editName, _deleteProduct };

})();

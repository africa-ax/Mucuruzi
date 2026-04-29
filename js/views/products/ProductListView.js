// ============================================================
//  MUCURUZI — ProductListView.js
//  Manufacturer only. Compact product grid.
// ============================================================

const ProductListView = (() => {

  let _allProducts = [];
  let _listings    = {};

  const render = async (user, root) => {
    root.innerHTML = `
      <div class="page-header" style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px">
        <div>
          <h1 class="page-title">My Products</h1>
          <p class="page-subtitle">Manage your registered products</p>
        </div>
        <button class="btn btn-primary btn-sm" onclick="Router.navigate('#product-form')">
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
    _listings    = {};
    (listingsRes.data || []).forEach(l => { _listings[l.productId] = l; });

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
          <p class="empty-state-text">Add your first product using RRA item codes.</p>
          <button class="btn btn-primary mt-md" onclick="Router.navigate('#product-form')">
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
            <div class="card product-card" style="padding:var(--space-md)">

              <!-- Top row: code + grade -->
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
                <span class="badge badge-muted" style="font-size:0.62rem">${p.rraItemCode}</span>
                <span class="badge badge-${_taxBadge(p.taxGrade)}" style="font-size:0.62rem">
                  Grade ${p.taxGrade}
                </span>
              </div>

              <!-- Name -->
              <h3 style="font-family:var(--font-display);font-size:0.875rem;font-weight:700;margin-bottom:2px;line-height:1.3">
                ${p.productName}
              </h3>
              <p class="text-muted" style="font-size:0.72rem;margin-bottom:8px">
                ${p.category} · ${p.unit}
              </p>

              <!-- Listing status -->
              <div style="padding:6px 8px;background:var(--color-surface-2);border-radius:var(--radius-sm);margin-bottom:8px">
                ${isListed ? `
                  <div style="display:flex;align-items:center;justify-content:space-between">
                    <span class="badge badge-success" style="font-size:0.6rem">✓ Listed</span>
                    <span class="text-xs text-muted">
                      ${Formatters.formatCurrency(listing.publicPrice)}/${p.unit}
                    </span>
                  </div>
                ` : `
                  <p class="text-xs text-muted">Not listed on marketplace</p>
                `}
              </div>

              <!-- Actions -->
              <div style="display:flex;flex-direction:column;gap:5px">
                ${isListed ? `
                  <button class="btn btn-secondary btn-sm btn-block"
                    style="font-size:0.78rem;padding:6px"
                    onclick="ProductListView._openListModal('${p.productId}')">
                    ✏ Update Listing
                  </button>
                  <button class="btn btn-danger btn-sm btn-block"
                    style="font-size:0.78rem;padding:6px"
                    onclick="ProductListView._removeListing('${listing.listingId}','${p.productName.replace(/'/g,"\\'")}')">
                    ✕ Remove Listing
                  </button>
                ` : `
                  <button class="btn btn-primary btn-sm btn-block"
                    style="font-size:0.78rem;padding:6px"
                    onclick="ProductListView._openListModal('${p.productId}')">
                    ⊞ List on Marketplace
                  </button>
                `}
                <div style="display:flex;gap:5px">
                  <button class="btn btn-secondary btn-sm" style="flex:1;font-size:0.78rem;padding:5px"
                    onclick="ProductListView._editName('${p.productId}','${p.productName.replace(/'/g,"\\'")}')">
                    ✏ Edit
                  </button>
                  <button class="btn btn-danger btn-sm" style="font-size:0.78rem;padding:5px 8px"
                    onclick="ProductListView._deleteProduct('${p.productId}','${p.productName.replace(/'/g,"\\'")}')">
                    🗑
                  </button>
                </div>
              </div>

            </div>
          `;
        }).join('')}
      </div>
      <p class="text-xs text-muted mt-sm">${products.length} product${products.length !== 1 ? 's' : ''}</p>
    `;
  };

  const _openListModal = (productId) => {
    const p = _allProducts.find(p => p.productId === productId);
    if (!p) return;
    const isListed = !!_listings[productId];
    const listing  = _listings[productId];

    Modal.show({
      title: isListed ? 'Update Listing' : 'List on Marketplace',
      body: `
        <div style="background:var(--color-surface-2);border-radius:var(--radius-md);padding:var(--space-md);margin-bottom:var(--space-md)">
          <p style="font-weight:700;font-size:0.875rem">${p.productName}</p>
          <p class="text-muted text-xs">${p.rraItemCode} · ${p.category} · ${p.unit}</p>
        </div>
        <div class="form-group">
          <label class="form-label">Public Price (RWF per ${p.unit})</label>
          <input id="modal-listing-price" type="number" class="form-input"
            value="${listing?.publicPrice || ''}"
            placeholder="e.g. 1500" min="0" step="1" />
        </div>
        ${!isListed ? `
          <div class="form-group" style="margin:0">
            <label class="form-label">Stock Quantity (${p.unit}) — optional</label>
            <input id="modal-listing-stock" type="number" class="form-input"
              placeholder="0 if already in inventory" min="0" step="1" />
            <p class="form-hint">Leave 0 if you already added stock to inventory.</p>
          </div>
        ` : ''}
      `,
      confirmText: isListed ? 'Update Price' : 'List Product',
      onConfirm:   () => _submitListing(p, isListed),
    });
  };

  const _submitListing = async (p, isUpdate) => {
    const price    = parseFloat(document.getElementById('modal-listing-price')?.value);
    const stockQty = parseFloat(document.getElementById('modal-listing-stock')?.value) || 0;

    if (!price || price <= 0) { Toast.error('Enter a valid price.'); return; }

    Loader.show(isUpdate ? 'Updating...' : 'Listing...');
    const user    = window.currentUser;
    const stockId = StockModel.generateId(user.uid, p.productId);

    if (isUpdate) {
      await MarketplaceService.updateListingPrice(`${user.uid}_${p.productId}`, price, user.uid);
    } else {
      await MarketplaceService.createListing(user.uid, user, p, price);
      if (stockQty > 0) {
        const stockRef = db.collection(Collections.STOCK).doc(stockId);
        const stockDoc = await stockRef.get();
        if (stockDoc.exists) {
          const upd = StockModel.buildUpdate(stockDoc.data(), stockQty, 0, price);
          await stockRef.update({ ...upd, source: 'produced' });
        } else {
          await stockRef.set({
            stockId, ownerId: user.uid, productId: p.productId,
            productName: p.productName, unit: p.unit,
            stockType: STOCK_TYPES.INVENTORY, source: 'produced',
            quantity: Price.round(stockQty), buyingPrice: 0,
            sellingPrice: Price.round(price),
            lastPurchaseDate: serverTimestamp(),
            lastSaleDate: null, updatedAt: serverTimestamp(),
          });
        }
      }
    }

    Loader.hide();
    Toast.success(isUpdate ? 'Listing updated!' : `${p.productName} listed!`);
    await _load(user);
  };

  const _removeListing = (listingId, productName) => {
    Modal.danger('Remove Listing',
      `Remove "${productName}" from marketplace?`,
      async () => {
        Loader.show('Removing...');
        await db.collection(Collections.LISTINGS).doc(listingId).delete();
        Loader.hide();
        Toast.success('Removed from marketplace.');
        await _load(window.currentUser);
      }, 'Remove'
    );
  };

  const _editName = (productId, currentName) => {
    Modal.show({
      title: 'Edit Product Name',
      confirmText: 'Save',
      body: `
        <div class="form-group" style="margin:0">
          <label class="form-label">Product Name</label>
          <input id="edit-product-name" type="text" class="form-input"
            value="${currentName}" autocomplete="off" />
        </div>
      `,
      onConfirm: async () => {
        const newName = document.getElementById('edit-product-name')?.value.trim();
        if (!newName) { Toast.error('Name cannot be empty.'); return; }
        Loader.show('Updating...');
        const user    = window.currentUser;
        const stockId = StockModel.generateId(user.uid, productId);
        const listId  = `${user.uid}_${productId}`;

        await db.collection(Collections.PRODUCTS).doc(productId).update({ productName: newName });

        const stockDoc = await db.collection(Collections.STOCK).doc(stockId).get();
        if (stockDoc.exists) {
          await db.collection(Collections.STOCK).doc(stockId).update({
            productName: newName, updatedAt: serverTimestamp(),
          });
        }

        const listDoc = await db.collection(Collections.LISTINGS).doc(listId).get();
        if (listDoc.exists) {
          await db.collection(Collections.LISTINGS).doc(listId).update({
            productName: newName, updatedAt: serverTimestamp(),
          });
        }

        Loader.hide();
        Toast.success('Product name updated.');
        await _load(user);
      },
    });
  };

  const _deleteProduct = (productId, productName) => {
    Modal.danger('Delete Product',
      `Delete "${productName}"? This removes it from the marketplace too. Stock records are kept.`,
      async () => {
        Loader.show('Deleting...');
        const user   = window.currentUser;
        const listId = `${user.uid}_${productId}`;
        await db.collection(Collections.PRODUCTS).doc(productId).delete();
        const listDoc = await db.collection(Collections.LISTINGS).doc(listId).get();
        if (listDoc.exists) {
          await db.collection(Collections.LISTINGS).doc(listId).delete();
        }
        Loader.hide();
        Toast.success(`${productName} deleted.`);
        await _load(user);
      }, 'Delete'
    );
  };

  const _taxBadge = (g) => ({ A:'warning', B:'info', C:'success', D:'muted' }[g] || 'muted');

  return { render, _filter, _openListModal, _removeListing, _editName, _deleteProduct };

})();

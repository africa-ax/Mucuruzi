// ============================================================
//  MUCURUZI — InventoryView.js
//  All seller roles. Compact product grid.
// ============================================================

const InventoryView = (() => {

  let _allStock = [];
  let _listings = {};

  const render = async (user, root) => {
    root.innerHTML = `
      <div class="page-header" style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px">
        <div>
          <h1 class="page-title">Inventory</h1>
          <p class="page-subtitle">Your current stock levels</p>
        </div>
        <button class="btn btn-primary btn-sm" onclick="Router.navigate('#marketplace')">
          + Buy Stock
        </button>
      </div>

      <div class="form-group">
        <input id="inv-search" type="text" class="form-input"
          placeholder="Search inventory..."
          oninput="InventoryView._filter(this.value)" />
      </div>

      <div id="inventory-list">
        <div class="loader-spinner" style="margin:40px auto;"></div>
      </div>
    `;

    await _load(user);
  };

  const _load = async (user) => {
    const [stockRes, listingsRes] = await Promise.all([
      StockService.getMyStock(user.uid, STOCK_TYPES.INVENTORY),
      MarketplaceService.getListingsBySeller(user.uid),
    ]);

    _allStock = stockRes.data || [];
    _listings = {};
    (listingsRes.data || []).forEach(l => { _listings[l.productId] = l; });

    _render(_allStock);
  };

  const _filter = (query) => {
    const q = query.toLowerCase();
    _render(_allStock.filter(s => s.productName.toLowerCase().includes(q)));
  };

  const _render = (stock) => {
    const el = document.getElementById('inventory-list');
    if (!el) return;

    if (stock.length === 0) {
      el.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">📦</div>
          <h3 class="empty-state-title">No inventory yet</h3>
          <p class="empty-state-text">Buy stock from the marketplace to get started.</p>
          <button class="btn btn-primary mt-md" onclick="Router.navigate('#marketplace')">
            Browse Marketplace
          </button>
        </div>
      `;
      return;
    }

    el.innerHTML = `
      <div class="product-grid">
        ${stock.map(s => {
          const lowStock = s.quantity <= 5;
          const isListed = !!_listings[s.productId];
          const listing  = _listings[s.productId];
          return `
            <div class="card product-card" style="padding:var(--space-md)">

              <!-- Top row -->
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
                <span class="badge ${s.source === 'produced' ? 'badge-manufacturer' : s.source === 'imported' ? 'badge-info' : 'badge-muted'}" style="font-size:0.62rem">
                  ${STOCK_SOURCE_LABELS[s.source] || '📦 Purchased'}
                </span>
                ${lowStock
                  ? `<span class="badge badge-warning" style="font-size:0.62rem">⚠ Low</span>`
                  : isListed
                    ? `<span class="badge badge-success" style="font-size:0.62rem">✓ Listed</span>`
                    : ''
                }
              </div>

              <!-- Name -->
              <h3 style="font-family:var(--font-display);font-size:0.875rem;font-weight:700;margin-bottom:2px;line-height:1.3">
                ${s.productName}
              </h3>
              <p class="text-muted" style="font-size:0.72rem;margin-bottom:8px">${s.unit}</p>

              <!-- Stats row -->
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:8px;padding:8px;background:var(--color-surface-2);border-radius:var(--radius-sm)">
                <div>
                  <p class="stat-label" style="font-size:0.62rem">Qty</p>
                  <p style="font-size:1.2rem;font-weight:700;line-height:1;color:${lowStock ? 'var(--color-warning)' : 'var(--color-text)'}">
                    ${s.quantity}
                  </p>
                </div>
                <div>
                  <p class="stat-label" style="font-size:0.62rem">Sell Price</p>
                  <p style="font-weight:700;font-size:0.875rem;color:var(--color-accent);line-height:1.2">
                    ${Formatters.formatCurrency(s.sellingPrice)}
                  </p>
                </div>
              </div>

              <!-- Actions -->
              <div style="display:flex;flex-direction:column;gap:5px">
                ${isListed ? `
                  <button class="btn btn-secondary btn-sm btn-block"
                    style="font-size:0.78rem;padding:6px"
                    onclick="InventoryView._openListModal('${s.stockId}')">
                    ✏ Update Price
                  </button>
                  <button class="btn btn-danger btn-sm btn-block"
                    style="font-size:0.78rem;padding:6px"
                    onclick="InventoryView._removeListing('${listing.listingId}', '${s.productName.replace(/'/g,"\\'")}')">
                    ✕ Remove Listing
                  </button>
                ` : `
                  <button class="btn btn-primary btn-sm btn-block"
                    style="font-size:0.78rem;padding:6px"
                    onclick="InventoryView._openListModal('${s.stockId}')">
                    ⊞ List on Marketplace
                  </button>
                `}
                <button class="btn btn-ghost btn-sm btn-block"
                  style="font-size:0.78rem;padding:5px"
                  onclick="InventoryView._editPrice('${s.stockId}', '${s.productName.replace(/'/g,"\\'")}', ${s.sellingPrice})">
                  ✏ Edit Price
                </button>
              </div>

            </div>
          `;
        }).join('')}
      </div>
      <p class="text-xs text-muted mt-sm">${stock.length} item${stock.length !== 1 ? 's' : ''} in inventory</p>
    `;
  };

  const _openListModal = (stockId) => {
    const s = _allStock.find(s => s.stockId === stockId);
    if (!s) return;
    const isListed = !!_listings[s.productId];

    Modal.show({
      title:       isListed ? 'Update Listing Price' : 'List on Marketplace',
      confirmText: isListed ? 'Update Price' : 'List Product',
      body: `
        <div style="background:var(--color-surface-2);border-radius:var(--radius-md);padding:var(--space-md);margin-bottom:var(--space-md)">
          <p style="font-weight:700;font-size:0.875rem">${s.productName}</p>
          <p class="text-muted text-xs">Available: ${s.quantity} ${s.unit}</p>
        </div>
        <div class="form-group" style="margin:0">
          <label class="form-label">Public Price (RWF per ${s.unit})</label>
          <input id="listing-price" type="number" class="form-input"
            value="${_listings[s.productId]?.publicPrice || s.sellingPrice || ''}"
            placeholder="e.g. 1500" min="0" step="1" />
        </div>
      `,
      onConfirm: () => _submitListing(s, isListed),
    });
  };

  const _submitListing = async (s, isUpdate) => {
    const price = parseFloat(document.getElementById('listing-price')?.value);
    if (!price || price <= 0) { Toast.error('Enter a valid price.'); return; }

    Loader.show(isUpdate ? 'Updating...' : 'Listing...');
    const user    = window.currentUser;
    const stockId = s.stockId;

    if (isUpdate) {
      const listingId = `${user.uid}_${s.productId}`;
      await MarketplaceService.updateListingPrice(listingId, price, user.uid);
    } else {
      const productRes = await ProductService.getProductById(s.productId);
      const product = productRes.success ? productRes.data : {
        productId: s.productId, productName: s.productName,
        rraItemCode: '00000000', category: 'General',
        unit: s.unit, taxGrade: 'B',
      };
      await MarketplaceService.createListing(user.uid, user, product, price);
    }

    await db.collection(Collections.STOCK).doc(stockId).update({
      sellingPrice: Price.round(price),
      updatedAt:    serverTimestamp(),
    });

    Loader.hide();
    Toast.success(isUpdate ? 'Listing updated!' : `${s.productName} listed!`);
    await _load(user);
  };

  const _removeListing = (listingId, productName) => {
    Modal.danger('Remove Listing',
      `Remove "${productName}" from marketplace? Stock is not affected.`,
      async () => {
        Loader.show('Removing...');
        await db.collection(Collections.LISTINGS).doc(listingId).delete();
        Loader.hide();
        Toast.success(`${productName} removed from marketplace.`);
        await _load(window.currentUser);
      }, 'Remove'
    );
  };

  const _editPrice = (stockId, productName, currentPrice) => {
    Modal.show({
      title: 'Edit Selling Price',
      confirmText: 'Update',
      body: `
        <p class="mb-md text-sm">Update price for <strong>${productName}</strong></p>
        <div class="form-group" style="margin:0">
          <label class="form-label">Selling Price (RWF)</label>
          <input id="new-price" type="number" class="form-input"
            value="${currentPrice}" min="0" />
        </div>
      `,
      onConfirm: async () => {
        const newPrice = parseFloat(document.getElementById('new-price')?.value);
        if (!newPrice || newPrice < 0) { Toast.error('Enter a valid price.'); return; }
        Loader.show('Updating...');
        await db.collection(Collections.STOCK).doc(stockId).update({
          sellingPrice: Price.round(newPrice),
          updatedAt:    serverTimestamp(),
        });
        Loader.hide();
        Toast.success('Price updated.');
        await _load(window.currentUser);
      },
    });
  };

  return { render, _filter, _openListModal, _removeListing, _editPrice };

})();

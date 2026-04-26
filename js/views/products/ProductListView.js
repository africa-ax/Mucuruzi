// ============================================================
//  MUCURUZI — ProductListView.js
//  Manufacturer only. Shows all products they created.
//
//  "List on Marketplace" modal now collects:
//    - Public price
//    - Initial stock quantity
//  Then does THREE things atomically:
//    1. Creates/updates listing  (marketplace)
//    2. Creates/updates stock    (inventory, source: produced)
//    3. Shows confirmation toast
// ============================================================

const ProductListView = (() => {

  let _allProducts = [];

  const render = async (user, root) => {
    root.innerHTML = `
      <div class="page-header" style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px">
        <div>
          <h1 class="page-title">My Products</h1>
          <p class="page-subtitle">Products registered with official RRA item codes</p>
        </div>
        <button class="btn btn-primary" onclick="Router.navigate('#product-form')">+ Add Product</button>
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
    const res    = await ProductService.getMyProducts(user.uid);
    _allProducts = res.data || [];
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
          <p class="empty-state-text">Add your first product using official RRA item codes.</p>
          <button class="btn btn-primary" onclick="Router.navigate('#product-form')">+ Add Product</button>
        </div>
      `;
      return;
    }

    el.innerHTML = `
      <div class="product-grid">
        ${products.map(p => `
          <div class="card product-card">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">
              <span class="badge badge-muted">${p.rraItemCode}</span>
              <span class="badge badge-${_taxBadge(p.taxGrade)}">Grade ${p.taxGrade}</span>
            </div>
            <h3 style="font-family:var(--font-display);font-size:1rem;font-weight:700;margin-bottom:4px">
              ${p.productName}
            </h3>
            <p class="text-muted text-sm">${p.category} · ${p.unit}</p>
            <div style="margin-top:12px;display:flex;flex-direction:column;gap:6px">
              <button class="btn btn-primary btn-block btn-sm"
                onclick="ProductListView._openListModal('${p.productId}')">
                ⊞ List on Marketplace
              </button>
              <button class="btn btn-secondary btn-block btn-sm"
                onclick="Router.navigate('#inventory')">
                📦 View in Inventory
              </button>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  };

  // ── List on Marketplace Modal ─────────────────────────────────
  const _openListModal = (productId) => {
    const product = _allProducts.find(p => p.productId === productId);
    if (!product) return;

    Modal.show({
      title: 'List on Marketplace',
      body: `
        <!-- Product Preview -->
        <div style="background:var(--color-surface-2);border-radius:var(--radius-md);padding:var(--space-md);margin-bottom:var(--space-md)">
          <p style="font-weight:700">${product.productName}</p>
          <p class="text-muted text-xs">${product.rraItemCode} · ${product.category} · ${product.unit}</p>
        </div>

        <!-- Public Price -->
        <div class="form-group">
          <label class="form-label">Public Selling Price (RWF per ${product.unit})</label>
          <input id="listing-price" type="number" class="form-input"
            placeholder="e.g. 1500" min="0" step="1" />
        </div>

        <!-- Initial Stock -->
        <div class="form-group">
          <label class="form-label">Initial Stock Quantity (${product.unit})</label>
          <input id="listing-stock" type="number" class="form-input"
            placeholder="e.g. 500" min="1" step="1" />
          <p class="form-hint">
            How many ${product.unit} do you have available right now?
            This will be added to your inventory as <strong>produced goods</strong>
            — separate from raw materials.
          </p>
        </div>

        <!-- Info box -->
        <div style="background:var(--color-accent-glow);border:1px solid var(--color-accent);border-radius:var(--radius-md);padding:var(--space-sm) var(--space-md)">
          <p class="text-xs" style="color:var(--color-accent)">
            ✓ Product will be listed on the marketplace<br/>
            ✓ Stock will be added to your inventory<br/>
            ✓ Buyers can find and order this product
          </p>
        </div>
      `,
      confirmText: 'List & Add to Stock',
      onConfirm:   () => _submitListing(product),
    });
  };

  const _submitListing = async (product) => {
    const priceInput = document.getElementById('listing-price');
    const stockInput = document.getElementById('listing-stock');

    const price    = parseFloat(priceInput?.value);
    const stockQty = parseFloat(stockInput?.value);

    // Validate
    if (!price || price <= 0) {
      Toast.error('Please enter a valid selling price.');
      return;
    }
    if (!stockQty || stockQty <= 0) {
      Toast.error('Please enter a valid initial stock quantity.');
      return;
    }

    Loader.show('Listing product and updating stock...');

    const user = window.currentUser;

    // ── Step 1: Create or update marketplace listing ──────────
    const listingRes = await MarketplaceService.createListing(
      user.uid,
      user,
      product,
      price
    );

    if (!listingRes.success) {
      Loader.hide();
      Toast.error('Listing failed: ' + listingRes.error);
      return;
    }

    // ── Step 2: Add to stock as produced inventory ────────────
    // source: 'produced' distinguishes this from 'purchased' raw materials
    const stockId  = StockModel.generateId(user.uid, product.productId);
    const stockRef = db.collection(Collections.STOCK).doc(stockId);
    const stockDoc = await stockRef.get();

    if (stockDoc.exists) {
      // Stock already exists — add to existing quantity
      const existing = stockDoc.data();
      const update   = StockModel.buildUpdate(existing, stockQty, 0, price);
      await stockRef.update({
        ...update,
        sellingPrice: Price.round(price),
        source:       'produced',
      });
    } else {
      // Create new stock document
      const newStock = StockModel.create({
        ownerId:      user.uid,
        ownerRole:    user.role,
        productId:    product.productId,
        productName:  product.productName,
        unit:         product.unit,
        quantity:     stockQty,
        buyingPrice:  0,            // produced goods — no purchase cost
        sellingPrice: price,
      });

      // Build clean stock document manually
      // Avoids serverTimestamp() nesting issues during set()
      const now = new Date().toISOString();

      await stockRef.set({
        stockId:          stockId,
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

    Loader.hide();
    Toast.success(`${product.productName} listed on marketplace with ${stockQty} ${product.unit} in stock!`);

    // Reload to show updated state
    await _load(user);
  };

  const _taxBadge = (g) => ({ A:'warning', B:'info', C:'success', D:'muted' }[g] || 'muted');

  return { render, _filter, _openListModal };

})();

// ============================================================
//  MUCURUZI — ProductFormView.js
//  Manufacturer only.
//
//  Single flow — one form, one submit:
//  1. Search RRA catalog → pick item → RRA fields lock
//  2. Set custom product name (pre-filled, editable)
//  3. Set initial stock quantity
//  4. Set public selling price
//  5. Save → product + stock + listing all created at once
// ============================================================

const ProductFormView = (() => {

  let _selectedRRAItem = null;

  const render = (user, root) => {
    _selectedRRAItem = null;

    root.innerHTML = `
      <div class="page-header" style="display:flex;align-items:center;gap:12px">
        <button class="btn btn-ghost btn-sm" onclick="Router.navigate('#products')">← Back</button>
        <div>
          <h1 class="page-title">Add Product</h1>
          <p class="page-subtitle">Search RRA catalog then set your product details</p>
        </div>
      </div>

      <div class="card" style="max-width:560px">

        <!-- Step 1: Search RRA catalog -->
        <div id="search-section">
          <div class="form-group">
            <label class="form-label">Search RRA Item Catalog</label>
            <input id="rra-search" type="text" class="form-input"
              placeholder="Type name, code or category e.g. Sugar, 50221200, Food"
              oninput="ProductFormView._search(this.value)" />
            <p class="form-hint">
              Search the official RRA product catalog to find your item code.
            </p>
          </div>

          <!-- Search results -->
          <div id="rra-results"></div>
        </div>

        <!-- Step 2: Product details form (shown after RRA item selected) -->
        <div id="product-details-section" class="hidden">

          <!-- Selected RRA item info — locked -->
          <div id="rra-selected-info"
            style="background:var(--color-surface-2);border:1px solid var(--color-border);border-radius:var(--radius-md);padding:var(--space-md);margin-bottom:var(--space-lg)">
          </div>

          <!-- Custom product name — editable -->
          <div class="form-group">
            <label class="form-label">Product Name</label>
            <input id="product-name" type="text" class="form-input"
              placeholder="e.g. Samsung Galaxy A15 128GB" />
            <p class="form-hint">
              Give your specific product a clear name. The RRA item code above is fixed for compliance.
            </p>
          </div>

          <!-- Initial stock -->
          <div class="form-group">
            <label class="form-label" id="stock-label">Initial Stock Quantity</label>
            <div style="display:flex;align-items:center;gap:12px">
              <input id="initial-stock" type="number" class="form-input"
                placeholder="e.g. 500" min="0" step="1" style="flex:1" />
              <span id="stock-unit-label"
                style="color:var(--color-text-muted);font-weight:600;white-space:nowrap;min-width:40px">
              </span>
            </div>
            <p class="form-hint">How many units do you have available right now.</p>
          </div>

          <!-- Public selling price -->
          <div class="form-group">
            <label class="form-label" id="price-label">Public Selling Price (RWF)</label>
            <div style="display:flex;align-items:center;gap:12px">
              <input id="selling-price" type="number" class="form-input"
                placeholder="e.g. 1500" min="0" step="1" style="flex:1" />
              <span id="price-unit-label"
                style="color:var(--color-text-muted);font-weight:600;white-space:nowrap;min-width:40px">
              </span>
            </div>
            <p class="form-hint">Price buyers will see on the marketplace per unit.</p>
          </div>

          <!-- Summary box -->
          <div style="background:var(--color-accent-glow);border:1px solid var(--color-accent);border-radius:var(--radius-md);padding:var(--space-md);margin-bottom:var(--space-lg)">
            <p class="text-xs" style="color:var(--color-accent);font-weight:600;margin-bottom:6px">
              One submit will:
            </p>
            <p class="text-xs" style="color:var(--color-accent)">
              ✓ Register product with RRA item code<br/>
              ✓ Add initial stock to your inventory<br/>
              ✓ List product on the marketplace
            </p>
          </div>

          <!-- Action buttons -->
          <div style="display:flex;gap:12px">
            <button class="btn btn-secondary" onclick="ProductFormView._clearSelection()">
              ← Search Again
            </button>
            <button id="save-btn" class="btn btn-primary" style="flex:1"
              onclick="ProductFormView._save()">
              Save Product
            </button>
          </div>

        </div>

      </div>
    `;
  };

  // ── Search ────────────────────────────────────────────────────
  let _searchTimeout = null;

  const _search = (query) => {
    clearTimeout(_searchTimeout);
    const resultsEl = document.getElementById('rra-results');
    if (!resultsEl) return;

    if (!query || query.trim().length < 2) {
      resultsEl.innerHTML = '';
      return;
    }

    _searchTimeout = setTimeout(async () => {
      const res   = await ProductService.searchRRAItems(query);
      const items = res.data || [];

      if (items.length === 0) {
        resultsEl.innerHTML = `
          <p class="text-muted text-sm" style="padding:8px 0">
            No results for "${query}". Try a different name or code.
          </p>
        `;
        return;
      }

      resultsEl.innerHTML = `
        <div class="rra-results-list">
          ${items.map(item => `
            <div class="rra-result-item"
              onclick="ProductFormView._selectItem(${JSON.stringify(item).replace(/"/g, '&quot;')})">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
                <span class="badge badge-muted">${item.itemCode}</span>
                <span class="badge badge-${_taxBadge(item.taxGrade)}">
                  Grade ${item.taxGrade}
                </span>
              </div>
              <p style="font-weight:600;margin-bottom:2px">${item.productName}</p>
              <p class="text-muted text-xs">${item.category} · ${item.unit}</p>
            </div>
          `).join('')}
        </div>
      `;
    }, 300);
  };

  // ── Select RRA Item ───────────────────────────────────────────
  const _selectItem = (item) => {
    _selectedRRAItem = item;

    // Hide search, show details form
    document.getElementById('search-section').classList.add('hidden');
    document.getElementById('product-details-section').classList.remove('hidden');

    // Fill locked RRA info box
    document.getElementById('rra-selected-info').innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:8px">
        <div>
          <p class="text-xs text-muted" style="margin-bottom:2px">RRA ITEM CODE — LOCKED</p>
          <p style="font-family:monospace;font-weight:700;color:var(--color-accent);font-size:1rem">
            ${item.itemCode}
          </p>
        </div>
        <span class="badge badge-${_taxBadge(item.taxGrade)}">
          Grade ${item.taxGrade} — ${TAX_GRADES[item.taxGrade]?.label || ''}
        </span>
      </div>
      <p class="text-muted text-xs" style="margin-top:6px">
        ${item.category} · ${item.unit}
      </p>
    `;

    // Pre-fill product name with RRA name — user can edit
    const nameInput = document.getElementById('product-name');
    if (nameInput) nameInput.value = item.productName;

    // Show unit labels next to inputs
    const unit = item.unit;
    const stockUnitEl = document.getElementById('stock-unit-label');
    const priceUnitEl = document.getElementById('price-unit-label');
    if (stockUnitEl) stockUnitEl.textContent = unit;
    if (priceUnitEl) priceUnitEl.textContent = unit;

    // Focus product name so user can immediately edit
    setTimeout(() => nameInput?.focus(), 100);
  };

  // ── Clear Selection ───────────────────────────────────────────
  const _clearSelection = () => {
    _selectedRRAItem = null;
    document.getElementById('rra-search').value = '';
    document.getElementById('rra-results').innerHTML = '';
    document.getElementById('search-section').classList.remove('hidden');
    document.getElementById('product-details-section').classList.add('hidden');
  };

  // ── Save — all three writes at once ──────────────────────────
  const _save = async () => {
    if (!_selectedRRAItem) {
      Toast.error('Please select an item from the RRA catalog first.');
      return;
    }

    const productName  = document.getElementById('product-name')?.value.trim();
    const initialStock = parseFloat(document.getElementById('initial-stock')?.value);
    const sellingPrice = parseFloat(document.getElementById('selling-price')?.value);

    // Validate
    if (!productName) {
      Toast.error('Please enter a product name.');
      document.getElementById('product-name')?.focus();
      return;
    }
    if (!initialStock || initialStock <= 0) {
      Toast.error('Please enter a valid initial stock quantity.');
      document.getElementById('initial-stock')?.focus();
      return;
    }
    if (!sellingPrice || sellingPrice <= 0) {
      Toast.error('Please enter a valid selling price.');
      document.getElementById('selling-price')?.focus();
      return;
    }

    Loader.show('Saving product...');

    const user = window.currentUser;

    // ── Write 1: Save product to Firestore ────────────────────
    const productResult = await ProductService.createProduct({
      productName,
      rraItemCode: _selectedRRAItem.itemCode,
      category:    _selectedRRAItem.category,
      unit:        _selectedRRAItem.unit,
      taxGrade:    _selectedRRAItem.taxGrade,
    }, user.uid, user.role);

    if (!productResult.success) {
      Loader.hide();
      Toast.error('Product save failed: ' + productResult.error);
      return;
    }

    const product = productResult.data;

    // ── Write 2: Create stock document ────────────────────────
    const stockId  = StockModel.generateId(user.uid, product.productId);
    const stockRef = db.collection(Collections.STOCK).doc(stockId);

    await stockRef.set({
      stockId,
      ownerId:          user.uid,
      productId:        product.productId,
      productName:      productName,
      unit:             product.unit,
      stockType:        STOCK_TYPES.INVENTORY,
      source:           'produced',
      quantity:         Price.round(initialStock),
      buyingPrice:      0,
      sellingPrice:     Price.round(sellingPrice),
      lastPurchaseDate: serverTimestamp(),
      lastSaleDate:     null,
      updatedAt:        serverTimestamp(),
    });

    // ── Write 3: Create marketplace listing ───────────────────
    await MarketplaceService.createListing(
      user.uid,
      user,
      product,
      sellingPrice
    );

    Loader.hide();
    Toast.success(`${productName} saved, stocked and listed on marketplace!`);
    setTimeout(() => Router.navigate('#products'), 800);
  };

  const _taxBadge = (g) => ({ A:'warning', B:'info', C:'success', D:'muted' }[g] || 'muted');

  return { render, _search, _selectItem, _clearSelection, _save };

})();

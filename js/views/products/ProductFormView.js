// ============================================================
//  MUCURUZI — ProductFormView.js
//  Manufacturer only.
//
//  Does ONE thing only — creates the product.
//  Listing and stock are handled separately in ProductListView.
//
//  Flow:
//  1. Search RRA catalog
//  2. Pick item → RRA fields lock
//  3. Type custom product name (editable, RRA name is just placeholder)
//  4. Save → product saved to Firestore
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
          <p class="page-subtitle">Search RRA catalog and register your product</p>
        </div>
      </div>

      <div class="card" style="max-width:520px">

        <!-- Search section -->
        <div id="search-section">
          <div class="form-group">
            <label class="form-label">Search RRA Item Catalog</label>
            <input
              id="rra-search"
              type="text"
              class="form-input"
              placeholder="Type name, code or category..."
              oninput="ProductFormView._search(this.value)"
              autocomplete="off"
            />
            <p class="form-hint">
              e.g. "Sugar", "50221200", "Construction"
            </p>
          </div>
          <div id="rra-results"></div>
        </div>

        <!-- Details section — shown after item selected -->
        <div id="details-section" class="hidden">

          <!-- Locked RRA info -->
          <div id="rra-locked-info"
            style="background:var(--color-surface-2);border:1px solid var(--color-border);border-radius:var(--radius-md);padding:var(--space-md);margin-bottom:var(--space-lg)">
          </div>

          <!-- Product name — fully editable -->
          <div class="form-group">
            <label class="form-label">Product Name</label>
            <input
              id="product-name"
              type="text"
              class="form-input"
              autocomplete="off"
            />
            <p class="form-hint">
              Use a specific name e.g. "Kabuye Sugar 50kg" or "Samsung Galaxy A15".
              RRA item code above is fixed for compliance.
            </p>
          </div>

          <div style="display:flex;gap:12px;margin-top:var(--space-lg)">
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
            No results for "${query}".
          </p>
        `;
        return;
      }

      resultsEl.innerHTML = `
        <div class="rra-results-list">
          ${items.map(item => `
            <div class="rra-result-item"
              onclick="ProductFormView._selectItem(${JSON.stringify(item).replace(/"/g, '&quot;')})">
              <div style="display:flex;justify-content:space-between;margin-bottom:4px">
                <span class="badge badge-muted">${item.itemCode}</span>
                <span class="badge badge-${_taxBadge(item.taxGrade)}">Grade ${item.taxGrade}</span>
              </div>
              <p style="font-weight:600;margin-bottom:2px">${item.productName}</p>
              <p class="text-muted text-xs">${item.category} · ${item.unit}</p>
            </div>
          `).join('')}
        </div>
      `;
    }, 300);
  };

  // ── Select Item ───────────────────────────────────────────────
  const _selectItem = (item) => {
    _selectedRRAItem = item;

    // Switch sections
    document.getElementById('search-section').classList.add('hidden');
    document.getElementById('details-section').classList.remove('hidden');

    // Show locked RRA info
    document.getElementById('rra-locked-info').innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
        <div>
          <p class="text-xs text-muted">RRA ITEM CODE</p>
          <p style="font-family:monospace;font-weight:800;font-size:1.1rem;color:var(--color-accent)">
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

    // Set placeholder — NOT value — so user types their own name freely
    const nameInput = document.getElementById('product-name');
    if (nameInput) {
      nameInput.placeholder = item.productName;
      nameInput.value = '';
      // Focus immediately so user can start typing
      setTimeout(() => {
        nameInput.focus();
      }, 50);
    }
  };

  // ── Clear ─────────────────────────────────────────────────────
  const _clearSelection = () => {
    _selectedRRAItem = null;
    const searchInput = document.getElementById('rra-search');
    if (searchInput) searchInput.value = '';
    const resultsEl = document.getElementById('rra-results');
    if (resultsEl) resultsEl.innerHTML = '';
    document.getElementById('search-section').classList.remove('hidden');
    document.getElementById('details-section').classList.add('hidden');
  };

  // ── Save ──────────────────────────────────────────────────────
  const _save = async () => {
    if (!_selectedRRAItem) {
      Toast.error('Please select an item from the RRA catalog.');
      return;
    }

    const nameInput   = document.getElementById('product-name');
    const productName = nameInput?.value.trim();

    if (!productName) {
      Toast.error('Please enter a product name.');
      nameInput?.focus();
      return;
    }

    Loader.button('save-btn', true, 'Save Product', 'Saving...');

    const res = await ProductService.createProduct({
      productName,
      rraItemCode: _selectedRRAItem.itemCode,
      category:    _selectedRRAItem.category,
      unit:        _selectedRRAItem.unit,
      taxGrade:    _selectedRRAItem.taxGrade,
    }, window.currentUser.uid, window.currentUser.role);

    Loader.button('save-btn', false, 'Save Product');

    if (!res.success) {
      Toast.error(res.error);
      return;
    }

    Toast.success(`${productName} saved! You can now list it on the marketplace.`);
    setTimeout(() => Router.navigate('#products'), 800);
  };

  const _taxBadge = (g) => ({ A:'warning', B:'info', C:'success', D:'muted' }[g] || 'muted');

  return { render, _search, _selectItem, _clearSelection, _save };

})();  

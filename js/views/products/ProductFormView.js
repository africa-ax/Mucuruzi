// ============================================================
//  MUCURUZI — ProductFormView.js
//  Manufacturer only. Create product by searching RRA catalog.
// ============================================================

const ProductFormView = (() => {

  let _selectedItem = null;

  const render = (user, root) => {
    root.innerHTML = `
      <div class="page-header" style="display:flex;align-items:center;gap:12px">
        <button class="btn btn-ghost btn-sm" onclick="Router.navigate('#products')">← Back</button>
        <div>
          <h1 class="page-title">Add Product</h1>
          <p class="page-subtitle">Search the RRA catalog to find your product</p>
        </div>
      </div>

      <div class="card" style="max-width:560px">

        <!-- Step 1: Search RRA catalog -->
        <div class="form-group">
          <label class="form-label">Search RRA Item Catalog</label>
          <input id="rra-search" type="text" class="form-input"
            placeholder="Type product name, code or category..."
            oninput="ProductFormView._search(this.value)" />
          <p class="form-hint">Search by name (e.g. Sugar), code (e.g. 50221200) or category (e.g. Food)</p>
        </div>

        <!-- Search Results -->
        <div id="rra-results" class="hidden"></div>

        <!-- Step 2: Selected item preview + confirm -->
        <div id="product-preview" class="hidden">
          <div style="background:var(--color-surface-2);border:1px solid var(--color-border);border-radius:var(--radius-md);padding:var(--space-md);margin-bottom:var(--space-md)">
            <div style="display:flex;justify-content:space-between;align-items:flex-start">
              <div>
                <p class="text-xs text-muted">RRA ITEM CODE</p>
                <p id="preview-code" class="font-bold text-accent"></p>
              </div>
              <span id="preview-grade" class="badge"></span>
            </div>
            <h3 id="preview-name" style="font-family:var(--font-display);font-size:1.1rem;font-weight:700;margin:8px 0 4px"></h3>
            <p id="preview-meta" class="text-muted text-sm"></p>
          </div>

          <button id="save-product-btn" class="btn btn-primary btn-block btn-lg"
            onclick="ProductFormView._save()">
            Save Product
          </button>
          <button class="btn btn-ghost btn-block mt-sm" onclick="ProductFormView._clearSelection()">
            Search Again
          </button>
        </div>

      </div>
    `;
  };

  let _searchTimeout = null;

  const _search = (query) => {
    clearTimeout(_searchTimeout);
    const resultsEl = document.getElementById('rra-results');

    if (!query || query.trim().length < 2) {
      resultsEl.classList.add('hidden');
      return;
    }

    // Debounce 300ms
    _searchTimeout = setTimeout(async () => {
      const res = await ProductService.searchRRAItems(query);
      const items = res.data || [];

      if (items.length === 0) {
        resultsEl.innerHTML = `<p class="text-muted text-sm" style="padding:8px 0">No results found for "${query}".</p>`;
        resultsEl.classList.remove('hidden');
        return;
      }

      resultsEl.innerHTML = `
        <div class="rra-results-list">
          ${items.map(item => `
            <div class="rra-result-item" onclick="ProductFormView._select(${JSON.stringify(item).replace(/"/g, '&quot;')})">
              <div style="display:flex;justify-content:space-between;align-items:center">
                <span class="badge badge-muted">${item.itemCode}</span>
                <span class="badge badge-${_taxBadge(item.taxGrade)}">Grade ${item.taxGrade}</span>
              </div>
              <p style="font-weight:600;margin:4px 0">${item.productName}</p>
              <p class="text-muted text-xs">${item.category} · ${item.unit}</p>
            </div>
          `).join('')}
        </div>
      `;
      resultsEl.classList.remove('hidden');
    }, 300);
  };

  const _select = (item) => {
    _selectedItem = item;

    document.getElementById('rra-results').classList.add('hidden');
    document.getElementById('product-preview').classList.remove('hidden');
    document.getElementById('rra-search').value = item.productName;

    document.getElementById('preview-code').textContent  = item.itemCode;
    document.getElementById('preview-name').textContent  = item.productName;
    document.getElementById('preview-meta').textContent  = `${item.category} · ${item.unit}`;
    document.getElementById('preview-grade').className   = `badge badge-${_taxBadge(item.taxGrade)}`;
    document.getElementById('preview-grade').textContent = `Grade ${item.taxGrade} — ${TAX_GRADES[item.taxGrade]?.label}`;
  };

  const _clearSelection = () => {
    _selectedItem = null;
    document.getElementById('rra-search').value = '';
    document.getElementById('product-preview').classList.add('hidden');
    document.getElementById('rra-results').classList.add('hidden');
  };

  const _save = async () => {
    if (!_selectedItem) { Toast.error('Please select a product from the catalog.'); return; }

    Loader.button('save-product-btn', true, 'Save Product', 'Saving...');

    const res = await ProductService.createProduct({
      productName:  _selectedItem.productName,
      rraItemCode:  _selectedItem.itemCode,
      category:     _selectedItem.category,
      unit:         _selectedItem.unit,
      taxGrade:     _selectedItem.taxGrade,
    }, window.currentUser.uid, window.currentUser.role);

    Loader.button('save-product-btn', false, 'Save Product');

    if (res.success) {
      Toast.success('Product saved successfully!');
      setTimeout(() => Router.navigate('#products'), 800);
    } else {
      Toast.error(res.error);
    }
  };

  const _taxBadge = (g) => ({ A:'warning', B:'info', C:'success', D:'muted' }[g] || 'muted');

  return { render, _search, _select, _clearSelection, _save };

})();

// ============================================================
//  MUCURUZI — MarketplaceView.js
//  All roles. Browse listings by product or by business.
// ============================================================

const MarketplaceView = (() => {

  let _allListings = [];
  let _activeCategory = 'all';

  const CATEGORIES = [
    'All', 'Food & Beverages', 'Construction', 'Electronics',
    'Textiles & Clothing', 'Agriculture', 'Pharmaceuticals',
    'Fuel & Energy', 'Household', 'Stationery',
  ];

  const render = async (user, root) => {
    root.innerHTML = `
      <div class="page-header">
        <h1 class="page-title">Marketplace</h1>
        <p class="page-subtitle">Browse products from verified traders across Rwanda</p>
      </div>

      <!-- Search -->
      <div style="display:flex;gap:12px;margin-bottom:var(--space-md);flex-wrap:wrap">
        <input id="market-search" type="text" class="form-input" style="flex:1;min-width:200px"
          placeholder="Search products or businesses..."
          oninput="MarketplaceView._search(this.value)" />
        <button class="btn btn-secondary" onclick="MarketplaceView._searchBusiness()">
          🏪 Find Business
        </button>
      </div>

      <!-- Category Filters -->
      <div class="category-bar" id="category-bar">
        ${CATEGORIES.map(c => `
          <button class="category-btn ${c === 'All' ? 'active' : ''}"
            onclick="MarketplaceView._filterCategory('${c}')">
            ${c}
          </button>
        `).join('')}
      </div>

      <!-- Listings -->
      <div id="market-listings">
        <div class="loader-spinner" style="margin:40px auto;"></div>
      </div>
    `;

    await _load();
  };

  const _load = async () => {
    const res    = await MarketplaceService.getListings();
    _allListings = res.data || [];
    _renderListings(_allListings);
  };

  let _searchTimeout = null;
  const _search = (query) => {
    clearTimeout(_searchTimeout);
    if (!query.trim()) { _renderListings(_filterByCategory(_allListings)); return; }
    _searchTimeout = setTimeout(async () => {
      const res = await MarketplaceService.searchListings(query);
      _renderListings(res.data || []);
    }, 350);
  };

  const _filterCategory = (category) => {
    _activeCategory = category;
    document.querySelectorAll('.category-btn').forEach(b =>
      b.classList.toggle('active', b.textContent.trim() === category)
    );
    _renderListings(_filterByCategory(_allListings));
  };

  const _filterByCategory = (listings) => {
    if (_activeCategory === 'All') return listings;
    return listings.filter(l => l.category === _activeCategory);
  };

  const _renderListings = (listings) => {
    const el = document.getElementById('market-listings');
    if (!el) return;

    if (listings.length === 0) {
      el.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">⊞</div>
          <h3 class="empty-state-title">No listings found</h3>
          <p class="empty-state-text">Try a different search or category.</p>
        </div>
      `;
      return;
    }

    el.innerHTML = `
      <p class="text-muted text-xs mb-md">${listings.length} listing${listings.length !== 1 ? 's' : ''} — sorted cheapest first</p>
      <div class="product-grid">
        ${listings.map(l => `
          <div class="card market-card" onclick="MarketplaceService.incrementViewCount('${l.listingId}')">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">
              <span class="badge badge-${l.sellerRole}">${Formatters.formatRole(l.sellerRole)}</span>
              <span class="badge badge-${_taxBadge(l.taxGrade)}">Grade ${l.taxGrade}</span>
            </div>
            <h3 style="font-family:var(--font-display);font-size:1rem;font-weight:700;margin-bottom:4px">${l.productName}</h3>
            <p class="text-muted text-sm" style="margin-bottom:8px">
              <a href="#business/${l.sellerId}" style="color:var(--color-text-muted)">${l.sellerName}</a>
              · ${l.sellerDistrict}
            </p>
            <p style="font-size:1.2rem;font-weight:700;color:var(--color-accent);margin-bottom:12px">
              ${Formatters.formatCurrency(l.publicPrice)} <span class="text-xs text-muted">/ ${l.unit}</span>
            </p>
            <div style="display:flex;gap:8px">
              <button class="btn btn-primary btn-sm" style="flex:1"
                onclick="event.stopPropagation();Router.navigate('#order-form/${l.sellerId}')">
                Buy
              </button>
              <button class="btn btn-secondary btn-sm"
                onclick="event.stopPropagation();Router.navigate('#product-detail/${l.productId}')">
                Compare
              </button>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  };

  const _searchBusiness = () => {
    Modal.show({
      title:       'Find a Business',
      confirmText: 'Search',
      body: `
        <div class="form-group">
          <label class="form-label">Business Name or TIN</label>
          <input id="biz-search-input" type="text" class="form-input" placeholder="e.g. Kigali Fresh or 100000001" />
        </div>
        <div id="biz-search-results" style="margin-top:12px"></div>
      `,
      hideCancel:  false,
      onConfirm:   async () => {
        const query = document.getElementById('biz-search-input')?.value;
        if (!query) return;
        const res     = await UserService.searchBusiness(query);
        const results = res.data || [];
        const el      = document.getElementById('biz-search-results');
        if (!el) return;
        if (results.length === 0) { el.innerHTML = `<p class="text-muted text-sm">No businesses found.</p>`; return; }
        el.innerHTML = results.map(b => `
          <div style="padding:10px;border:1px solid var(--color-border);border-radius:var(--radius-md);margin-bottom:8px;cursor:pointer"
            onclick="Modal.close();Router.navigate('#business/${b.uid}')">
            <p style="font-weight:600">${b.businessName}</p>
            <p class="text-xs text-muted">${Formatters.formatRole(b.role)} · ${b.district}</p>
          </div>
        `).join('');
      },
    });
  };

  const _taxBadge = (g) => ({ A:'warning', B:'info', C:'success', D:'muted' }[g] || 'muted');

  return { render, _search, _filterCategory, _searchBusiness };

})();

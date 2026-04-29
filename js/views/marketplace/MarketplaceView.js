// ============================================================
//  MUCURUZI — MarketplaceView.js
//  Compact market grid — 4-5 cards per row on desktop.
// ============================================================

const MarketplaceView = (() => {

  let _allListings    = [];
  let _activeCategory = 'All';

  const CATEGORIES = [
    'All','Food & Beverages','Construction','Electronics',
    'Textiles & Clothing','Agriculture','Pharmaceuticals',
    'Fuel & Energy','Household','Stationery',
  ];

  const render = async (user, root) => {
    root.innerHTML = `
      <div class="page-header" style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px">
        <div>
          <h1 class="page-title">Marketplace</h1>
          <p class="page-subtitle">Browse products from verified traders</p>
        </div>
        <button class="btn btn-secondary btn-sm" onclick="MarketplaceView._searchBusiness()">
          🏪 Find Business
        </button>
      </div>

      <!-- Search -->
      <div class="form-group">
        <input id="market-search" type="text" class="form-input"
          placeholder="Search products or businesses..."
          oninput="MarketplaceView._search(this.value)" />
      </div>

      <!-- Category Filters -->
      <div class="category-bar">
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
      <p class="text-xs text-muted mb-md">
        ${listings.length} listing${listings.length !== 1 ? 's' : ''} — sorted cheapest first
      </p>
      <div class="market-grid">
        ${listings.map(l => `
          <div class="card market-card"
            style="padding:var(--space-md)"
            onclick="MarketplaceService.incrementViewCount('${l.listingId}')">

            <!-- Top: role badge + tax grade -->
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
              <span class="badge badge-${l.sellerRole}" style="font-size:0.62rem">
                ${Formatters.formatRole(l.sellerRole)}
              </span>
              <span class="badge badge-${_taxBadge(l.taxGrade)}" style="font-size:0.62rem">
                Grade ${l.taxGrade}
              </span>
            </div>

            <!-- Product name -->
            <h3 style="font-family:var(--font-display);font-size:0.875rem;font-weight:700;margin-bottom:2px;line-height:1.3">
              ${l.productName}
            </h3>

            <!-- Seller -->
            <p class="text-muted" style="font-size:0.72rem;margin-bottom:6px">
              <a href="#business/${l.sellerId}"
                onclick="event.stopPropagation()"
                style="color:var(--color-text-muted)">
                ${l.sellerName}
              </a>
              · ${l.sellerDistrict}
            </p>

            <!-- Price -->
            <p style="font-size:1.05rem;font-weight:700;color:var(--color-accent);margin-bottom:10px">
              ${Formatters.formatCurrency(l.publicPrice)}
              <span class="text-xs text-muted font-bold" style="font-weight:400">/ ${l.unit}</span>
            </p>

            <!-- Actions -->
            <div style="display:flex;gap:6px">
              <button class="btn btn-primary btn-sm" style="flex:1;padding:6px 8px;font-size:0.78rem"
                onclick="event.stopPropagation();Router.navigate('#order-form/${l.sellerId}')">
                Buy
              </button>
              <button class="btn btn-secondary btn-sm" style="padding:6px 10px;font-size:0.78rem"
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
          <input id="biz-search-input" type="text" class="form-input"
            placeholder="e.g. Kigali Fresh or 100000001" />
        </div>
        <div id="biz-search-results" style="margin-top:12px"></div>
      `,
      onConfirm: async () => {
        const query = document.getElementById('biz-search-input')?.value;
        if (!query) return;
        const res     = await UserService.searchBusiness(query);
        const results = res.data || [];
        const el      = document.getElementById('biz-search-results');
        if (!el) return;
        if (results.length === 0) {
          el.innerHTML = `<p class="text-muted text-sm">No businesses found.</p>`;
          return;
        }
        el.innerHTML = results.map(b => `
          <div class="list-row" style="border-radius:var(--radius-md);border:1px solid var(--color-border);margin-bottom:6px"
            onclick="Modal.close();Router.navigate('#business/${b.uid}')">
            <div class="list-row-main">
              <p class="list-row-title">${b.businessName}</p>
              <p class="list-row-sub">${Formatters.formatRole(b.role)} · ${b.district}</p>
            </div>
            <span class="badge badge-${b.role}">${Formatters.formatRole(b.role)}</span>
          </div>
        `).join('');
      },
    });
  };

  const _taxBadge = (g) => ({ A:'warning', B:'info', C:'success', D:'muted' }[g] || 'muted');

  return { render, _search, _filterCategory, _searchBusiness };

})();

// ============================================================
//  MUCURUZI — RawMaterialsView.js
//  Manufacturer only. Shows rawMaterial stock type.
// ============================================================

const RawMaterialsView = (() => {

  let _allStock = [];

  const render = async (user, root) => {
    root.innerHTML = `
      <div class="page-header">
        <h1 class="page-title">Raw Materials</h1>
        <p class="page-subtitle">Input materials purchased for production</p>
      </div>

      <div style="display:flex;gap:12px;margin-bottom:var(--space-md);flex-wrap:wrap">
        <input id="rm-search" type="text" class="form-input" style="flex:1;min-width:200px"
          placeholder="Search raw materials..." oninput="RawMaterialsView._filter(this.value)" />
        <button class="btn btn-primary" onclick="Router.navigate('#marketplace')">+ Buy Materials</button>
      </div>

      <div id="rm-list"><div class="loader-spinner" style="margin:40px auto;"></div></div>
    `;

    await _load(user);
  };

  const _load = async (user) => {
    const res = await StockService.getMyStock(user.uid, STOCK_TYPES.RAW_MATERIAL);
    _allStock  = res.data || [];
    _render(_allStock);
  };

  const _filter = (query) => {
    const q = query.toLowerCase();
    _render(_allStock.filter(s => s.productName.toLowerCase().includes(q)));
  };

  const _render = (stock) => {
    const el = document.getElementById('rm-list');
    if (!el) return;

    if (stock.length === 0) {
      el.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">◎</div>
          <h3 class="empty-state-title">No raw materials yet</h3>
          <p class="empty-state-text">Purchase materials from the marketplace to start production.</p>
          <button class="btn btn-primary" onclick="Router.navigate('#marketplace')">Browse Marketplace</button>
        </div>
      `;
      return;
    }

    el.innerHTML = `
      <div class="product-grid">
        ${stock.map(s => {
          const lowStock = s.quantity <= 5;
          return `
            <div class="card product-card ${lowStock ? 'low-stock-card' : ''}">
              ${lowStock ? `<div class="low-stock-badge">⚠ Low Stock</div>` : ''}
              <span class="badge badge-manufacturer" style="margin-bottom:8px">Raw Material</span>
              <h3 style="font-family:var(--font-display);font-size:1rem;font-weight:700;margin-bottom:4px">${s.productName}</h3>
              <p class="text-muted text-sm">${s.unit}</p>
              <div style="margin:12px 0;display:grid;grid-template-columns:1fr 1fr;gap:8px">
                <div>
                  <p class="stat-label">Quantity</p>
                  <p style="font-size:1.4rem;font-weight:700;color:${lowStock?'var(--color-warning)':'var(--color-text)'}">${s.quantity}</p>
                </div>
                <div>
                  <p class="stat-label">Avg. Cost</p>
                  <p style="font-weight:600">${Formatters.formatCurrency(s.buyingPrice)}</p>
                </div>
              </div>
              <p class="text-xs text-muted">Last purchased ${Formatters.timeAgo(s.lastPurchaseDate)}</p>
            </div>
          `;
        }).join('')}
      </div>
    `;
  };

  return { render, _filter };

})();

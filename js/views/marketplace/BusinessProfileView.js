// ============================================================
//  MUCURUZI — BusinessProfileView.js
//  Public store page of a specific seller.
// ============================================================

const BusinessProfileView = (() => {

  const render = async (user, sellerId, root) => {
    root.innerHTML = `
      <div class="page-header" style="display:flex;align-items:center;gap:12px">
        <button class="btn btn-ghost btn-sm" onclick="Router.navigate('#marketplace')">← Marketplace</button>
        <h1 class="page-title">Business Profile</h1>
      </div>
      <div id="biz-content"><div class="loader-spinner" style="margin:40px auto;"></div></div>
    `;

    await _load(user, sellerId);
  };

  const _load = async (user, sellerId) => {
    const [profileRes, listingsRes] = await Promise.all([
      UserService.getProfile(sellerId),
      MarketplaceService.getListingsBySeller(sellerId),
    ]);

    if (!profileRes.success) { Toast.error('Business not found.'); return; }

    const seller   = profileRes.data;
    const listings = listingsRes.data || [];
    const el       = document.getElementById('biz-content');
    if (!el) return;

    el.innerHTML = `
      <!-- Business Header -->
      <div class="card mb-md">
        <div style="display:flex;align-items:center;gap:var(--space-md);flex-wrap:wrap">
          <div style="width:56px;height:56px;border-radius:var(--radius-lg);background:var(--color-accent-glow);border:2px solid var(--color-accent);display:flex;align-items:center;justify-content:center;font-family:var(--font-display);font-size:1.4rem;font-weight:800;color:var(--color-accent)">
            ${seller.businessName.charAt(0)}
          </div>
          <div style="flex:1">
            <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
              <h2 style="font-family:var(--font-display);font-size:1.2rem;font-weight:700">${seller.businessName}</h2>
              <span class="badge badge-${seller.role}">${Formatters.formatRole(seller.role)}</span>
            </div>
            <p class="text-muted text-sm">${seller.district}, Rwanda</p>
            ${seller.tinNumber ? `<p class="text-xs text-muted">TIN: ${seller.tinNumber}</p>` : ''}
          </div>
          <button class="btn btn-primary" onclick="Router.navigate('#order-form/${seller.uid}')">
            + Place Order
          </button>
        </div>
      </div>

      <!-- Listings -->
      <h3 style="font-family:var(--font-display);font-weight:700;margin-bottom:var(--space-md)">
        Available Products (${listings.length})
      </h3>

      ${listings.length === 0 ? `
        <div class="empty-state">
          <p class="empty-state-text">This business has no active listings right now.</p>
        </div>
      ` : `
        <div class="product-grid">
          ${listings.map(l => `
            <div class="card market-card">
              <div style="display:flex;justify-content:space-between;margin-bottom:8px">
                <span class="badge badge-muted">${l.rraItemCode}</span>
                <span class="badge badge-${_taxBadge(l.taxGrade)}">Grade ${l.taxGrade}</span>
              </div>
              <h3 style="font-family:var(--font-display);font-size:1rem;font-weight:700;margin-bottom:4px">${l.productName}</h3>
              <p class="text-muted text-sm mb-md">${l.category} · ${l.unit}</p>
              <p style="font-size:1.2rem;font-weight:700;color:var(--color-accent);margin-bottom:12px">
                ${Formatters.formatCurrency(l.publicPrice)} / ${l.unit}
              </p>
              <button class="btn btn-primary btn-block btn-sm"
                onclick="Router.navigate('#order-form/${seller.uid}')">
                Buy from ${seller.businessName}
              </button>
            </div>
          `).join('')}
        </div>
      `}
    `;
  };

  const _taxBadge = (g) => ({ A:'warning', B:'info', C:'success', D:'muted' }[g] || 'muted');

  return { render };

})();

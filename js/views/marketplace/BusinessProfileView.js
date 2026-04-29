// ============================================================
//  MUCURUZI — BusinessProfileView.js
//  Public store page. Compact product grid.
// ============================================================

const BusinessProfileView = (() => {

  const render = async (user, sellerId, root) => {
    root.innerHTML = `
      <div class="page-header" style="display:flex;align-items:center;gap:12px">
        <button class="btn btn-ghost btn-sm"
          onclick="Router.navigate('#marketplace')">← Marketplace</button>
        <h1 class="page-title">Business Profile</h1>
      </div>
      <div id="biz-content">
        <div class="loader-spinner" style="margin:40px auto;"></div>
      </div>
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
      <div class="card mb-md" style="padding:var(--space-md)">
        <div style="display:flex;align-items:center;gap:var(--space-md);flex-wrap:wrap">
          <div style="width:48px;height:48px;border-radius:var(--radius-md);background:var(--color-accent-glow);border:2px solid var(--color-accent);display:flex;align-items:center;justify-content:center;font-family:var(--font-display);font-size:1.3rem;font-weight:800;color:var(--color-accent);flex-shrink:0">
            ${seller.businessName.charAt(0)}
          </div>
          <div style="flex:1;min-width:0">
            <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
              <h2 style="font-family:var(--font-display);font-size:1.1rem;font-weight:700">
                ${seller.businessName}
              </h2>
              <span class="badge badge-${seller.role}">${Formatters.formatRole(seller.role)}</span>
            </div>
            <p class="text-muted text-xs">${seller.district}, Rwanda ${seller.tinNumber ? `· TIN: ${seller.tinNumber}` : ''}</p>
          </div>
          <button class="btn btn-primary btn-sm"
            onclick="Router.navigate('#order-form/${seller.uid}')">
            + Place Order
          </button>
        </div>
      </div>

      <!-- Listings -->
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--space-md)">
        <h3 style="font-family:var(--font-display);font-weight:700;font-size:0.95rem">
          Products (${listings.length})
        </h3>
        <p class="text-xs text-muted">Sorted cheapest first</p>
      </div>

      ${listings.length === 0 ? `
        <div class="empty-state">
          <p class="empty-state-text">No active listings right now.</p>
        </div>
      ` : `
        <div class="market-grid">
          ${listings.map(l => `
            <div class="card market-card" style="padding:var(--space-md)">

              <div style="display:flex;justify-content:space-between;margin-bottom:6px">
                <span class="badge badge-muted" style="font-size:0.6rem">${l.rraItemCode}</span>
                <span class="badge badge-${_taxBadge(l.taxGrade)}" style="font-size:0.6rem">
                  Grade ${l.taxGrade}
                </span>
              </div>

              <h3 style="font-family:var(--font-display);font-size:0.875rem;font-weight:700;margin-bottom:2px;line-height:1.3">
                ${l.productName}
              </h3>
              <p class="text-muted" style="font-size:0.72rem;margin-bottom:8px">
                ${l.category} · ${l.unit}
              </p>

              <p style="font-size:1.05rem;font-weight:700;color:var(--color-accent);margin-bottom:10px">
                ${Formatters.formatCurrency(l.publicPrice)}
                <span style="font-size:0.72rem;font-weight:400;color:var(--color-text-muted)">/ ${l.unit}</span>
              </p>

              <button class="btn btn-primary btn-sm btn-block"
                style="font-size:0.78rem;padding:6px"
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

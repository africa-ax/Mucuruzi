// ============================================================
//  MUCURUZI — ProductDetailView.js
//  Single product — all sellers sorted cheapest first.
// ============================================================

const ProductDetailView = (() => {

  const render = async (user, productId, root) => {
    root.innerHTML = `
      <div class="page-header" style="display:flex;align-items:center;gap:12px">
        <button class="btn btn-ghost btn-sm" onclick="Router.navigate('#marketplace')">← Marketplace</button>
        <h1 class="page-title">Compare Sellers</h1>
      </div>
      <div id="pd-content"><div class="loader-spinner" style="margin:40px auto;"></div></div>
    `;

    await _load(user, productId);
  };

  const _load = async (user, productId) => {
    const [productRes, listingsRes] = await Promise.all([
      ProductService.getProductById(productId),
      MarketplaceService.getListingsByProduct(productId),
    ]);

    const listings = listingsRes.data || [];
    const el       = document.getElementById('pd-content');
    if (!el) return;

    // Get product info from first listing if product doc not found
    const productName = productRes.data?.productName || listings[0]?.productName || 'Product';
    const category    = productRes.data?.category    || listings[0]?.category    || '';
    const unit        = productRes.data?.unit        || listings[0]?.unit        || '';
    const taxGrade    = productRes.data?.taxGrade    || listings[0]?.taxGrade    || 'B';
    const itemCode    = productRes.data?.rraItemCode || listings[0]?.rraItemCode || '';

    el.innerHTML = `
      <!-- Product Header -->
      <div class="card mb-md">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:8px">
          <div>
            <span class="badge badge-muted mb-sm">${itemCode}</span>
            <h2 style="font-family:var(--font-display);font-size:1.2rem;font-weight:700">${productName}</h2>
            <p class="text-muted text-sm">${category} · ${unit}</p>
          </div>
          <span class="badge badge-info">Grade ${taxGrade} — ${TAX_GRADES[taxGrade]?.label || ''}</span>
        </div>
      </div>

      <!-- Seller List -->
      <h3 style="font-family:var(--font-display);font-weight:700;margin-bottom:var(--space-md)">
        ${listings.length} Seller${listings.length !== 1 ? 's' : ''} — Cheapest First
      </h3>

      ${listings.length === 0 ? `
        <div class="empty-state">
          <p class="empty-state-text">No active sellers for this product right now.</p>
        </div>
      ` : `
        <div style="display:flex;flex-direction:column;gap:12px">
          ${listings.map((l, i) => `
            <div class="card" style="${i === 0 ? 'border-color:var(--color-accent)' : ''}">
              ${i === 0 ? `<span class="badge badge-success mb-sm">Best Price</span>` : ''}
              <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px">
                <div style="flex:1">
                  <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;flex-wrap:wrap">
                    <p style="font-weight:600">${l.sellerName}</p>
                    <span class="badge badge-${l.sellerRole}">${Formatters.formatRole(l.sellerRole)}</span>
                  </div>
                  <p class="text-muted text-sm">${l.sellerDistrict}, Rwanda</p>
                </div>
                <div style="text-align:right">
                  <p style="font-size:1.3rem;font-weight:700;color:${i===0?'var(--color-accent)':'var(--color-text)'}">
                    ${Formatters.formatCurrency(l.publicPrice)}
                  </p>
                  <p class="text-xs text-muted">per ${l.unit}</p>
                </div>
              </div>
              <div style="display:flex;gap:8px;margin-top:12px">
                <button class="btn btn-primary btn-sm" style="flex:1"
                  onclick="Router.navigate('#order-form/${l.sellerId}')">
                  Buy from ${l.sellerName}
                </button>
                <button class="btn btn-secondary btn-sm"
                  onclick="Router.navigate('#business/${l.sellerId}')">
                  View Store
                </button>
              </div>
            </div>
          `).join('')}
        </div>
      `}
    `;
  };

  return { render };

})();

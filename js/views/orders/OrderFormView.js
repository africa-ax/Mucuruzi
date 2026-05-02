// ============================================================
//  MUCURUZI — OrderFormView.js
//  Compact product rows. Multiple products visible at once.
// ============================================================

const OrderFormView = (() => {

  let _seller   = null;
  let _listings = [];

  const render = async (user, sellerId, root) => {
    root.innerHTML = `
      <div class="page-header" style="display:flex;align-items:center;gap:12px">
        <button class="btn btn-ghost btn-sm" onclick="history.back()">← Back</button>
        <div>
          <h1 class="page-title">Place Order</h1>
          <p class="page-subtitle" id="order-seller-name">Loading...</p>
        </div>
      </div>
      <div id="order-form-content">
        <div class="loader-spinner" style="margin:40px auto;"></div>
      </div>
    `;
    await _load(user, sellerId);
  };

  const _load = async (user, sellerId) => {
    const [sellerRes, listingsRes] = await Promise.all([
      UserService.getProfile(sellerId),
      MarketplaceService.getListingsBySeller(sellerId),
    ]);

    if (!sellerRes.success) { Toast.error('Seller not found.'); return; }

    _seller   = sellerRes.data;
    _listings = listingsRes.data || [];

    document.getElementById('order-seller-name').textContent =
      `Ordering from ${_seller.businessName}`;

    _renderForm(user);
  };

  const _renderForm = (user) => {
    const el = document.getElementById('order-form-content');
    if (!el) return;

    if (_listings.length === 0) {
      el.innerHTML = `
        <div class="empty-state">
          <p class="empty-state-text">This seller has no active listings.</p>
        </div>
      `;
      return;
    }

    const hasTIN   = user.tinNumber;
    const myrraURL = 'https://myrra.rra.gov.rw';

    el.innerHTML = `
      <div style="display:grid;grid-template-columns:1fr 360px;gap:var(--space-lg);align-items:start">

        <!-- Left: products + purchase code -->
        <div style="display:flex;flex-direction:column;gap:var(--space-md)">

          <!-- Purchase Code -->
          <div class="card" style="border-color:var(--color-accent);padding:var(--space-md)">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--space-sm)">
              <h3 style="font-family:var(--font-display);font-weight:700;font-size:0.95rem;color:var(--color-accent)">
                Purchase Code
              </h3>
              <div style="display:flex;gap:8px;align-items:center">
                <code style="background:var(--color-bg);padding:3px 8px;border-radius:4px;font-size:0.8rem;color:var(--color-accent)">
                  *800*${_seller.tinNumber}#
                </code>
                <span class="text-muted text-xs">or</span>
                <a href="${myrraURL}" target="_blank" class="btn btn-secondary btn-sm">
                  MyRRA ↗
                </a>
              </div>
            </div>
            <input id="order-purchase-code" type="text" inputmode="numeric"
              class="form-input"
              placeholder="Enter 5 or 6 digit code"
              maxlength="6"
              oninput="this.value=this.value.replace(/[^0-9]/g,'')"
              style="font-size:1.1rem;letter-spacing:0.25em;font-family:monospace;text-align:center;font-weight:700" />
            `
              <p class="text-xs mt-sm" style="color:var(--color-warning)">
                ⚠ Sandbox — use any 5-6 digit number e.g. 123456
              </p>
            `}
          </div>

          <!-- Products -->
          <div class="card" style="padding:0;overflow:hidden">
            <div style="padding:var(--space-md);border-bottom:1px solid var(--color-border);display:flex;align-items:center;justify-content:space-between">
              <h3 style="font-family:var(--font-display);font-weight:700;font-size:0.95rem">
                Products (${_listings.length})
              </h3>
              <p class="text-xs text-muted">Enter quantity to add</p>
            </div>
            <div>
              ${_listings.map((l, i) => `
                <div class="product-row"
                  style="${i === _listings.length - 1 ? 'border-bottom:none' : ''}">
                  <div class="product-row-info">
                    <p class="product-row-name">${l.productName}</p>
                    <p class="product-row-meta">${l.unit} · Grade ${l.taxGrade}</p>
                  </div>
                  <span class="product-row-price">
                    ${Formatters.formatCurrency(l.publicPrice)}/${l.unit}
                  </span>
                  <div class="product-row-qty">
                    <input type="number" id="qty-${l.productId}"
                      class="form-input"
                      style="width:90px;text-align:center;padding:7px 8px"
                      min="0" step="1" value="0" placeholder="0"
                      oninput="OrderFormView._updateSummary()" />
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        </div>

        <!-- Right: Order Summary (sticky) -->
        <div style="position:sticky;top:calc(var(--navbar-height) + 16px)">
          <div class="card hidden" id="order-summary">
            <h3 style="font-family:var(--font-display);font-weight:700;font-size:0.95rem;margin-bottom:var(--space-md)">
              Order Summary
            </h3>
            <div id="summary-items"></div>
            <div class="divider"></div>
            <div id="summary-totals"></div>
            <button class="btn btn-primary btn-block mt-md" id="place-order-btn"
              onclick="OrderFormView._submitOrder()">
              ✓ Place Order
            </button>
          </div>

          ${document.getElementById('order-summary') ? '' : `
            <div class="card" style="text-align:center;padding:var(--space-xl)">
              <p class="text-muted text-sm">
                Enter quantities above to see order summary
              </p>
            </div>
          `}
        </div>

      </div>
    `;

    // Show placeholder card until items selected
    setTimeout(() => {
      const s = document.getElementById('order-summary');
      if (s && s.classList.contains('hidden')) {
        s.insertAdjacentHTML('afterend', `
          <div class="card" id="summary-placeholder" style="text-align:center;padding:var(--space-xl)">
            <p class="text-muted text-sm">Enter quantities to see order summary</p>
          </div>
        `);
      }
    }, 0);
  };

  const _updateSummary = () => {
    const cartItems = _listings
      .map(l => ({
        listing:  l,
        quantity: parseFloat(document.getElementById(`qty-${l.productId}`)?.value) || 0,
      }))
      .filter(c => c.quantity > 0);

    const summaryEl     = document.getElementById('order-summary');
    const placeholderEl = document.getElementById('summary-placeholder');
    if (!summaryEl) return;

    if (cartItems.length === 0) {
      summaryEl.classList.add('hidden');
      if (placeholderEl) placeholderEl.style.display = '';
      return;
    }

    summaryEl.classList.remove('hidden');
    if (placeholderEl) placeholderEl.style.display = 'none';

    const items  = cartItems.map(c => ({
      productId:   c.listing.productId,
      productName: c.listing.productName,
      rraItemCode: c.listing.rraItemCode,
      unit:        c.listing.unit,
      taxGrade:    c.listing.taxGrade,
      quantity:    c.quantity,
      unitPrice:   c.listing.publicPrice,
    }));

    const totals = OrderModel.calculateTotals(items);

    document.getElementById('summary-items').innerHTML = `
      <div style="display:flex;flex-direction:column;gap:6px;margin-bottom:8px">
        ${totals.items.map(i => `
          <div style="display:flex;justify-content:space-between;font-size:0.8rem">
            <span class="text-muted">${i.productName} ×${i.quantity}</span>
            <span>${Formatters.formatCurrency(i.lineTotal)}</span>
          </div>
        `).join('')}
      </div>
    `;

    document.getElementById('summary-totals').innerHTML = `
      <div style="display:flex;flex-direction:column;gap:5px;font-size:0.875rem">
        <div style="display:flex;justify-content:space-between">
          <span class="text-muted">Subtotal</span>
          <span>${Formatters.formatCurrency(totals.subtotal)}</span>
        </div>
        <div style="display:flex;justify-content:space-between">
          <span class="text-muted">VAT (18%)</span>
          <span>${Formatters.formatCurrency(totals.vatAmount)}</span>
        </div>
        <div style="display:flex;justify-content:space-between;font-weight:700;font-size:1rem;padding-top:8px;border-top:1px solid var(--color-border);margin-top:4px">
          <span>Total</span>
          <span style="color:var(--color-accent)">${Formatters.formatCurrency(totals.total)}</span>
        </div>
      </div>
    `;
  };

  const _submitOrder = async () => {
    const purchaseCode = document.getElementById('order-purchase-code')?.value.trim();

    if (!purchaseCode || !/^\d{5,6}$/.test(purchaseCode)) {
      Toast.error('Please enter a valid 5 or 6 digit purchase code.');
      document.getElementById('order-purchase-code')?.focus();
      return;
    }

    const cartItems = _listings
      .map(l => ({
        listing:  l,
        quantity: parseFloat(document.getElementById(`qty-${l.productId}`)?.value) || 0,
      }))
      .filter(c => c.quantity > 0);

    if (cartItems.length === 0) {
      Toast.error('Please enter a quantity for at least one product.');
      return;
    }

    Loader.show('Placing order...');

    const user  = window.currentUser;
    const items = cartItems.map(c => ({
      productId:   c.listing.productId,
      productName: c.listing.productName,
      rraItemCode: c.listing.rraItemCode,
      unit:        c.listing.unit,
      taxGrade:    c.listing.taxGrade,
      quantity:    c.quantity,
      unitPrice:   c.listing.publicPrice,
    }));

    const res = await OrderService.createOrder({
      sellerId:    _seller.uid,
      sellerTIN:   _seller.tinNumber,
      sellerName:  _seller.businessName,
      buyerId:     user.uid,
      buyerTIN:    user.tinNumber || '',
      buyerName:   user.businessName,
      buyerRole:   user.role,
      items,
      purchaseCode,
    });

    Loader.hide();

    if (res.success) {
      Toast.success('Order placed!');
      setTimeout(() => Router.navigate('#orders'), 800);
    } else {
      Toast.error(res.error);
    }
  };

  return { render, _updateSummary, _submitOrder };

})();

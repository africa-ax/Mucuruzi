// ============================================================
//  MUCURUZI — OrderFormView.js
//  Buyer places a new order to one seller.
//
//  Changes:
//  1. Quantity is a direct number input (not +/- buttons)
//  2. Buyer enters purchase code before submitting
//     (dial *800*SellerTIN# first, get code, then place order)
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
          <p class="empty-state-text">This seller has no active listings right now.</p>
        </div>
      `;
      return;
    }

    el.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:var(--space-lg)">

        <!-- Purchase Code Instruction -->
        <div class="card" style="border-color:var(--color-accent);background:var(--color-accent-glow)">
          <h3 style="font-family:var(--font-display);font-weight:700;color:var(--color-accent);margin-bottom:8px">
            Step 1 — Get Your Purchase Code
          </h3>
          <p class="text-sm" style="margin-bottom:12px">
            Before placing your order, dial this on your phone:
          </p>
          <div style="background:var(--color-bg);border-radius:var(--radius-md);padding:var(--space-md);text-align:center;margin-bottom:12px">
            <p style="font-family:monospace;font-size:1.3rem;font-weight:800;color:var(--color-accent);letter-spacing:0.1em">
              *800*${_seller.tinNumber}#
            </p>
          </div>
          <p class="text-muted text-xs">
            RRA will send you a 5 or 6 digit code. Enter it below before submitting your order.
          </p>
          ${RRAService.MODE === 'sandbox' ? `
            <p class="text-xs mt-sm" style="color:var(--color-warning)">
              ⚠ Sandbox mode — type any 5 or 6 digit number e.g. <strong>123456</strong>
            </p>
          ` : ''}
        </div>

        <!-- Purchase Code Input -->
        <div class="card">
          <h3 style="font-family:var(--font-display);font-weight:700;margin-bottom:var(--space-md)">
            Step 2 — Enter Purchase Code
          </h3>
          <div class="form-group" style="margin:0">
            <label class="form-label">Purchase Code</label>
            <input id="order-purchase-code" type="text" class="form-input"
              placeholder="5 or 6 digit code from *800*${_seller.tinNumber}#"
              maxlength="6"
              oninput="this.value=this.value.replace(/[^0-9]/g,'')"
              style="font-size:1.2rem;letter-spacing:0.2em;font-family:monospace;text-align:center" />
          </div>
        </div>

        <!-- Product List -->
        <div class="card">
          <h3 style="font-family:var(--font-display);font-weight:700;margin-bottom:var(--space-md)">
            Step 3 — Select Products & Quantities
          </h3>
          <div style="display:flex;flex-direction:column;gap:var(--space-md)">
            ${_listings.map(l => `
              <div style="padding:var(--space-md);background:var(--color-surface-2);border-radius:var(--radius-md);border:1px solid var(--color-border)">
                <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;flex-wrap:wrap;gap:8px">
                  <div>
                    <p style="font-weight:600">${l.productName}</p>
                    <p class="text-muted text-xs">${l.unit} · Grade ${l.taxGrade}</p>
                  </div>
                  <p style="color:var(--color-accent);font-weight:700">${Formatters.formatCurrency(l.publicPrice)} / ${l.unit}</p>
                </div>
                <div style="display:flex;align-items:center;gap:12px">
                  <label class="form-label" style="margin:0;white-space:nowrap">Quantity (${l.unit})</label>
                  <input
                    type="number"
                    id="qty-${l.productId}"
                    class="form-input"
                    style="width:120px;text-align:center"
                    min="0"
                    step="1"
                    value="0"
                    placeholder="0"
                    oninput="OrderFormView._updateSummary()"
                    data-product-id="${l.productId}"
                  />
                </div>
              </div>
            `).join('')}
          </div>
        </div>

        <!-- Order Summary -->
        <div class="card hidden" id="order-summary">
          <h3 style="font-family:var(--font-display);font-weight:700;margin-bottom:var(--space-md)">
            Order Summary
          </h3>
          <div id="summary-items"></div>
          <div class="divider"></div>
          <div id="summary-totals"></div>
          <button class="btn btn-primary btn-block btn-lg mt-md" id="place-order-btn"
            onclick="OrderFormView._submitOrder()">
            ✓ Place Order
          </button>
        </div>

      </div>
    `;
  };

  const _updateSummary = () => {
    const cartItems = _listings
      .map(l => ({
        listing:  l,
        quantity: parseFloat(document.getElementById(`qty-${l.productId}`)?.value) || 0,
      }))
      .filter(c => c.quantity > 0);

    const summaryEl = document.getElementById('order-summary');
    if (!summaryEl) return;

    if (cartItems.length === 0) {
      summaryEl.classList.add('hidden');
      return;
    }

    summaryEl.classList.remove('hidden');

    const items = cartItems.map(c => ({
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
      <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:12px">
        ${totals.items.map(i => `
          <div style="display:flex;justify-content:space-between;font-size:0.875rem">
            <span>${i.productName} × ${i.quantity} ${i.unit}</span>
            <span>${Formatters.formatCurrency(i.lineTotal)}</span>
          </div>
        `).join('')}
      </div>
    `;

    document.getElementById('summary-totals').innerHTML = `
      <div style="display:flex;flex-direction:column;gap:6px;font-size:0.9rem">
        <div style="display:flex;justify-content:space-between">
          <span class="text-muted">Subtotal</span>
          <span>${Formatters.formatCurrency(totals.subtotal)}</span>
        </div>
        <div style="display:flex;justify-content:space-between">
          <span class="text-muted">VAT</span>
          <span>${Formatters.formatCurrency(totals.vatAmount)}</span>
        </div>
        <div style="display:flex;justify-content:space-between;font-weight:700;font-size:1rem;margin-top:4px">
          <span>Total</span>
          <span style="color:var(--color-accent)">${Formatters.formatCurrency(totals.total)}</span>
        </div>
      </div>
    `;
  };

  const _submitOrder = async () => {
    const purchaseCode = document.getElementById('order-purchase-code')?.value.trim();

    // Validate purchase code first
    if (!purchaseCode || !/^\d{5,6}$/.test(purchaseCode)) {
      Toast.error('Please enter a valid 5 or 6 digit purchase code from *800*SellerTIN#.');
      document.getElementById('order-purchase-code')?.focus();
      return;
    }

    // Gather cart items
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

    // Validate all quantities are positive numbers
    for (const c of cartItems) {
      if (c.quantity <= 0 || isNaN(c.quantity)) {
        Toast.error(`Invalid quantity for ${c.listing.productName}.`);
        return;
      }
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
      sellerId:     _seller.uid,
      sellerTIN:    _seller.tinNumber,
      sellerName:   _seller.businessName,
      buyerId:      user.uid,
      buyerTIN:     user.tinNumber || '',
      buyerName:    user.businessName,
      items,
      purchaseCode, // stored on order so seller can confirm without re-entering
    });

    Loader.hide();

    if (res.success) {
      Toast.success('Order placed successfully!');
      setTimeout(() => Router.navigate('#orders'), 800);
    } else {
      Toast.error(res.error);
    }
  };

  return { render, _updateSummary, _submitOrder };

})();

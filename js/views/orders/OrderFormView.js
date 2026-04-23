// ============================================================
//  MUCURUZI — OrderFormView.js
//  Buyer places a new order to one seller.
//  Seller is pre-selected from marketplace.
//  Cart is built from seller's active listings only.
// ============================================================

const OrderFormView = (() => {

  let _seller   = null;
  let _listings = [];
  let _cart     = {};   // productId → {listing, quantity}

  /**
   * @param {Object} user
   * @param {string} sellerId  - pre-selected from marketplace
   * @param {Object} root
   */
  const render = async (user, sellerId, root) => {
    _cart = {};

    root.innerHTML = `
      <div class="page-header" style="display:flex;align-items:center;gap:12px">
        <button class="btn btn-ghost btn-sm" onclick="history.back()">← Back</button>
        <div>
          <h1 class="page-title">Place Order</h1>
          <p class="page-subtitle" id="order-seller-name">Loading seller...</p>
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

    document.getElementById('order-seller-name').textContent = _seller.businessName;

    _renderForm();
  };

  const _renderForm = () => {
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
      <div style="display:grid;grid-template-columns:1fr;gap:var(--space-lg)">

        <!-- Product List -->
        <div class="card">
          <div class="card-header"><h3 class="card-title">Available Products</h3></div>
          <div class="order-items-list">
            ${_listings.map(l => `
              <div class="order-item-row">
                <div style="flex:1">
                  <p style="font-weight:600">${l.productName}</p>
                  <p class="text-muted text-sm">${l.unit} · <span class="badge badge-${_taxBadge(l.taxGrade)}">Grade ${l.taxGrade}</span></p>
                  <p style="color:var(--color-accent);font-weight:600">${Formatters.formatCurrency(l.publicPrice)} / ${l.unit}</p>
                </div>
                <div style="display:flex;align-items:center;gap:8px">
                  <button class="btn btn-ghost btn-sm" onclick="OrderFormView._updateCart('${l.productId}', -1)">−</button>
                  <span id="qty-${l.productId}" style="min-width:24px;text-align:center;font-weight:600">0</span>
                  <button class="btn btn-secondary btn-sm" onclick="OrderFormView._updateCart('${l.productId}', 1)">+</button>
                </div>
              </div>
            `).join('')}
          </div>
        </div>

        <!-- Order Summary -->
        <div class="card" id="order-summary" style="display:none">
          <div class="card-header"><h3 class="card-title">Order Summary</h3></div>
          <div id="summary-items"></div>
          <div class="divider"></div>
          <div id="summary-totals"></div>
          <button class="btn btn-primary btn-block btn-lg mt-md"
            onclick="OrderFormView._submitOrder()">
            Place Order
          </button>
        </div>

      </div>
    `;
  };

  const _updateCart = (productId, delta) => {
    const listing = _listings.find(l => l.productId === productId);
    if (!listing) return;

    const current = _cart[productId]?.quantity || 0;
    const newQty  = Math.max(0, current + delta);

    if (newQty === 0) {
      delete _cart[productId];
    } else {
      _cart[productId] = { listing, quantity: newQty };
    }

    const qtyEl = document.getElementById(`qty-${productId}`);
    if (qtyEl) qtyEl.textContent = newQty;

    _updateSummary();
  };

  const _updateSummary = () => {
    const cartItems = Object.values(_cart);
    const summaryEl = document.getElementById('order-summary');
    if (!summaryEl) return;

    if (cartItems.length === 0) {
      summaryEl.style.display = 'none';
      return;
    }

    summaryEl.style.display = 'block';

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
    const cartItems = Object.values(_cart);
    if (cartItems.length === 0) { Toast.error('Add at least one item to your order.'); return; }

    Loader.show('Placing order...');

    const items = cartItems.map(c => ({
      productId:   c.listing.productId,
      productName: c.listing.productName,
      rraItemCode: c.listing.rraItemCode,
      unit:        c.listing.unit,
      taxGrade:    c.listing.taxGrade,
      quantity:    c.quantity,
      unitPrice:   c.listing.publicPrice,
    }));

    const user = window.currentUser;

    const res = await OrderService.createOrder({
      sellerId:   _seller.uid,
      sellerTIN:  _seller.tinNumber,
      sellerName: _seller.businessName,
      buyerId:    user.uid,
      buyerTIN:   user.tinNumber || '',
      buyerName:  user.businessName,
      items,
    });

    Loader.hide();

    if (res.success) {
      Toast.success('Order placed successfully!');
      setTimeout(() => Router.navigate('#orders'), 800);
    } else {
      Toast.error(res.error);
    }
  };

  const _taxBadge = (g) => ({ A:'warning', B:'info', C:'success', D:'muted' }[g] || 'muted');

  return { render, _updateCart, _submitOrder };

})();

// ============================================================
//  MUCURUZI — WalkInSaleView.js
//  Retailer POS. Two column layout on desktop.
//  Products + cart visible simultaneously.
// ============================================================

const WalkInSaleView = (() => {

  let _stock = [];

  const render = async (user, root) => {
    root.innerHTML = `
      <div class="page-header">
        <h1 class="page-title">Walk-in Sale</h1>
        <p class="page-subtitle">Sell to a customer right now</p>
      </div>

      <div style="display:grid;grid-template-columns:1fr 340px;gap:var(--space-lg);align-items:start">

        <!-- Left column: customer + purchase code + products -->
        <div style="display:flex;flex-direction:column;gap:var(--space-md)">

          <!-- Customer + Purchase Code in one row -->
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-md)">

            <!-- Customer Info -->
            <div class="card" style="padding:var(--space-md)">
              <h3 style="font-family:var(--font-display);font-weight:700;font-size:0.875rem;margin-bottom:var(--space-sm)">
                Customer
              </h3>
              <div class="form-group" style="margin-bottom:var(--space-sm)">
                <label class="form-label">Name</label>
                <input id="customer-name" type="text" class="form-input"
                  placeholder="e.g. Jean Paul" autocomplete="off" />
              </div>
              <div class="form-group" style="margin:0">
                <label class="form-label">Phone</label>
                <input id="customer-phone" type="tel" class="form-input"
                  placeholder="e.g. 0788123456" />
              </div>
            </div>

            <!-- Purchase Code -->
            <div class="card" style="padding:var(--space-md);border-color:var(--color-accent)">
              <h3 style="font-family:var(--font-display);font-weight:700;font-size:0.875rem;margin-bottom:4px;color:var(--color-accent)">
                Purchase Code
              </h3>
              <div style="display:flex;gap:6px;align-items:center;margin-bottom:var(--space-sm)">
                <code style="font-size:0.78rem;background:var(--color-bg);padding:3px 6px;border-radius:4px;color:var(--color-accent)">
                  *800*${user.tinNumber}#
                </code>
                <span class="text-muted text-xs">or</span>
                <a href="https://myrra.rra.gov.rw" target="_blank"
                  class="btn btn-ghost btn-sm" style="padding:2px 6px;font-size:0.72rem">
                  MyRRA↗
                </a>
              </div>
              <input id="walkin-purchase-code" type="text" inputmode="numeric"
                class="form-input"
                placeholder="5-6 digit code"
                maxlength="6"
                oninput="this.value=this.value.replace(/[^0-9]/g,'')"
                style="font-size:1rem;letter-spacing:0.2em;font-family:monospace;text-align:center;font-weight:700" />
              `
                <p class="text-xs mt-sm" style="color:var(--color-warning)">
                  ⚠ Sandbox: use e.g. 123456
                </p>
              `}
            </div>
          </div>

          <!-- Products -->
          <div class="card" style="padding:0;overflow:hidden">
            <div style="padding:var(--space-md);border-bottom:1px solid var(--color-border);display:flex;align-items:center;gap:12px">
              <h3 style="font-family:var(--font-display);font-weight:700;font-size:0.95rem;flex:1">
                Products
              </h3>
              <input id="walkin-search" type="text"
                style="width:200px;background:var(--color-surface-2);border:1px solid var(--color-border);border-radius:var(--radius-md);padding:6px 12px;color:var(--color-text);font-size:0.8rem"
                placeholder="Search..."
                oninput="WalkInSaleView._search(this.value)" />
            </div>
            <div id="walkin-products">
              <div class="loader-spinner" style="margin:24px auto;"></div>
            </div>
          </div>

        </div>

        <!-- Right column: Cart (sticky) -->
        <div style="position:sticky;top:calc(var(--navbar-height) + 16px)">
          <div class="card hidden" id="walkin-cart" style="padding:var(--space-md)">
            <h3 style="font-family:var(--font-display);font-weight:700;font-size:0.95rem;margin-bottom:var(--space-md)">
              Cart
            </h3>
            <div id="cart-items"></div>
            <div class="divider"></div>
            <div id="cart-totals"></div>
            <button id="walkin-confirm-btn"
              class="btn btn-primary btn-block mt-md"
              onclick="WalkInSaleView._confirmSale()">
              ✓ Confirm Sale
            </button>
          </div>
          <div id="cart-placeholder" class="card"
            style="text-align:center;padding:var(--space-xl);color:var(--color-text-muted)">
            <p style="font-size:2rem;margin-bottom:8px">🛒</p>
            <p class="text-sm">Add products to see cart</p>
          </div>
        </div>

      </div>
    `;

    await _loadStock(user);
  };

  const _loadStock = async (user) => {
    const res = await StockService.getMyStock(user.uid, STOCK_TYPES.INVENTORY);
    _stock = (res.data || []).filter(s => s.quantity > 0);
    _renderProducts(_stock);
  };

  const _search = (query) => {
    const q = query.toLowerCase();
    _renderProducts(q ? _stock.filter(s => s.productName.toLowerCase().includes(q)) : _stock);
  };

  const _renderProducts = (items) => {
    const el = document.getElementById('walkin-products');
    if (!el) return;

    if (items.length === 0) {
      el.innerHTML = `<p class="text-muted text-sm" style="padding:var(--space-md)">No products found.</p>`;
      return;
    }

    el.innerHTML = `
      <div>
        ${items.map((s, i) => `
          <div class="product-row"
            style="${i === items.length - 1 ? 'border-bottom:none' : ''}">
            <div class="product-row-info">
              <p class="product-row-name">${s.productName}</p>
              <p class="product-row-meta">
                Stock: ${s.quantity} ${s.unit}
                · ${Formatters.formatCurrency(s.sellingPrice)}/${s.unit}
              </p>
            </div>
            <div class="product-row-qty">
              <input type="number" id="wqty-${s.productId}"
                class="form-input"
                style="width:80px;text-align:center;padding:6px 8px"
                min="0" max="${s.quantity}" step="1" value="0" placeholder="0"
                oninput="WalkInSaleView._updateCart()" />
            </div>
          </div>
        `).join('')}
      </div>
    `;
  };

  const _updateCart = () => {
    const cartItems = _stock
      .map(s => ({
        stockItem: s,
        quantity:  parseFloat(document.getElementById(`wqty-${s.productId}`)?.value) || 0,
      }))
      .filter(c => c.quantity > 0);

    const cartEl       = document.getElementById('walkin-cart');
    const placeholder  = document.getElementById('cart-placeholder');
    if (!cartEl) return;

    if (cartItems.length === 0) {
      cartEl.classList.add('hidden');
      if (placeholder) placeholder.style.display = '';
      return;
    }

    cartEl.classList.remove('hidden');
    if (placeholder) placeholder.style.display = 'none';

    const items  = cartItems.map(c => ({
      productId:   c.stockItem.productId,
      productName: c.stockItem.productName,
      unit:        c.stockItem.unit,
      taxGrade:    'B',
      quantity:    c.quantity,
      unitPrice:   c.stockItem.sellingPrice,
      rraItemCode: '00000000',
    }));

    const totals = OrderModel.calculateTotals(items);

    document.getElementById('cart-items').innerHTML = `
      <div style="display:flex;flex-direction:column;gap:5px;margin-bottom:8px">
        ${totals.items.map(i => `
          <div style="display:flex;justify-content:space-between;font-size:0.8rem">
            <span class="text-muted">${i.productName} ×${i.quantity}</span>
            <span>${Formatters.formatCurrency(i.lineTotal)}</span>
          </div>
        `).join('')}
      </div>
    `;

    document.getElementById('cart-totals').innerHTML = `
      <div style="display:flex;flex-direction:column;gap:4px;font-size:0.875rem">
        <div style="display:flex;justify-content:space-between">
          <span class="text-muted">Subtotal</span>
          <span>${Formatters.formatCurrency(totals.subtotal)}</span>
        </div>
        <div style="display:flex;justify-content:space-between">
          <span class="text-muted">VAT</span>
          <span>${Formatters.formatCurrency(totals.vatAmount)}</span>
        </div>
        <div style="display:flex;justify-content:space-between;font-weight:700;font-size:1rem;padding-top:6px;border-top:1px solid var(--color-border);margin-top:2px">
          <span>Total</span>
          <span style="color:var(--color-accent)">${Formatters.formatCurrency(totals.total)}</span>
        </div>
      </div>
    `;
  };

  const _confirmSale = async () => {
    const customerName  = document.getElementById('customer-name')?.value.trim();
    const customerPhone = document.getElementById('customer-phone')?.value.trim();
    const purchaseCode  = document.getElementById('walkin-purchase-code')?.value.trim();

    if (!customerName)  { Toast.error('Please enter customer name.'); return; }
    if (!customerPhone) { Toast.error('Please enter customer phone number.'); return; }
    if (!purchaseCode || !/^\d{5,6}$/.test(purchaseCode)) {
      Toast.error('Please enter a valid 5 or 6 digit purchase code.');
      return;
    }

    const cartItems = _stock
      .map(s => ({
        stockItem: s,
        quantity:  parseFloat(document.getElementById(`wqty-${s.productId}`)?.value) || 0,
      }))
      .filter(c => c.quantity > 0);

    if (cartItems.length === 0) {
      Toast.error('Please add at least one product to the cart.');
      return;
    }

    Loader.show('Processing sale...');

    const user  = window.currentUser;
    const items = cartItems.map(c => ({
      productId:   c.stockItem.productId,
      productName: c.stockItem.productName,
      rraItemCode: '00000000',
      unit:        c.stockItem.unit,
      taxGrade:    'B',
      quantity:    c.quantity,
      unitPrice:   c.stockItem.sellingPrice,
    }));

    const walkInBuyer = {
      uid:          `walkin_${Date.now()}`,
      businessName: customerName,
      phone:        customerPhone,
      role:         ROLES.BUYER,
      tinNumber:    '',
    };

    const orderRes = await OrderService.createOrder({
      sellerId:    user.uid,
      sellerTIN:   user.tinNumber,
      sellerName:  user.businessName,
      buyerId:     walkInBuyer.uid,
      buyerTIN:    '',
      buyerName:   `${customerName} (Walk-in)`,
      items,
      purchaseCode,
    });

    if (!orderRes.success) {
      Loader.hide();
      Toast.error(orderRes.error);
      return;
    }

    const confirmRes = await OrderService.confirmOrder(
      orderRes.data.orderId,
      purchaseCode,
      user,
      walkInBuyer
    );

    Loader.hide();

    if (confirmRes.success) {
      Toast.success('Sale complete! Receipt generated.');
      setTimeout(() => Router.navigate(`#invoice/${confirmRes.invoiceId}`), 600);
    } else {
      Toast.error(confirmRes.error);
    }
  };

  return { render, _search, _updateCart, _confirmSale };

})();

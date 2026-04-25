// ============================================================
//  MUCURUZI — WalkInSaleView.js
//  Retailer only. POS for walk-in customers.
//  Uses direct quantity input — no +/- buttons.
// ============================================================

const WalkInSaleView = (() => {

  let _stock = [];

  const render = async (user, root) => {
    root.innerHTML = `
      <div class="page-header">
        <h1 class="page-title">Walk-in Sale</h1>
        <p class="page-subtitle">Sell to a customer right now</p>
      </div>

      <div style="display:flex;flex-direction:column;gap:var(--space-lg)">

        <!-- Customer Info -->
        <div class="card">
          <h3 class="card-title mb-md">Customer Info</h3>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
            <div class="form-group" style="margin:0">
              <label class="form-label">Customer Name</label>
              <input id="customer-name" type="text" class="form-input" placeholder="e.g. Jean Paul" />
            </div>
            <div class="form-group" style="margin:0">
              <label class="form-label">Phone Number</label>
              <input id="customer-phone" type="tel" class="form-input" placeholder="e.g. 0788123456" />
            </div>
          </div>
        </div>

        <!-- Purchase Code -->
        <div class="card" style="border-color:var(--color-accent);background:var(--color-accent-glow)">
          <h3 style="font-family:var(--font-display);font-weight:700;color:var(--color-accent);margin-bottom:8px">
            Purchase Code
          </h3>
          <p class="text-sm text-muted mb-md">
            Ask the customer to dial <strong style="color:var(--color-accent)">*800*${user.tinNumber}#</strong> on their phone and give you the code.
          </p>
          <input id="walkin-purchase-code" type="text" class="form-input"
            placeholder="5 or 6 digit code"
            maxlength="6"
            oninput="this.value=this.value.replace(/[^0-9]/g,'')"
            style="font-size:1.2rem;letter-spacing:0.2em;font-family:monospace;text-align:center" />
          ${RRAService.MODE === 'sandbox' ? `
            <p class="text-xs mt-sm" style="color:var(--color-warning)">
              ⚠ Sandbox — type any 5 or 6 digit number e.g. <strong>123456</strong>
            </p>
          ` : ''}
        </div>

        <!-- Product List -->
        <div class="card">
          <h3 class="card-title mb-md">Products</h3>
          <input id="walkin-search" type="text" class="form-input"
            placeholder="Search your inventory..."
            oninput="WalkInSaleView._search(this.value)"
            style="margin-bottom:var(--space-md)" />
          <div id="walkin-products">
            <div class="loader-spinner" style="margin:24px auto;"></div>
          </div>
        </div>

        <!-- Cart Summary -->
        <div class="card hidden" id="walkin-cart">
          <h3 class="card-title mb-md">Cart Summary</h3>
          <div id="cart-items"></div>
          <div class="divider"></div>
          <div id="cart-totals"></div>
          <button id="walkin-confirm-btn" class="btn btn-primary btn-block btn-lg mt-md"
            onclick="WalkInSaleView._confirmSale()">
            ✓ Confirm Sale & Generate Receipt
          </button>
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
      el.innerHTML = `<p class="text-muted text-sm">No products found.</p>`;
      return;
    }

    el.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:var(--space-sm)">
        ${items.map(s => `
          <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;padding:var(--space-sm) 0;border-bottom:1px solid var(--color-border)">
            <div style="flex:1">
              <p style="font-weight:600">${s.productName}</p>
              <p class="text-muted text-xs">
                Available: ${s.quantity} ${s.unit} ·
                ${Formatters.formatCurrency(s.sellingPrice)} / ${s.unit}
              </p>
            </div>
            <div style="display:flex;align-items:center;gap:8px">
              <label class="form-label" style="margin:0;font-size:0.75rem;white-space:nowrap">${s.unit}</label>
              <input
                type="number"
                id="wqty-${s.productId}"
                class="form-input"
                style="width:100px;text-align:center"
                min="0"
                max="${s.quantity}"
                step="1"
                value="0"
                placeholder="0"
                oninput="WalkInSaleView._updateCartSummary()"
                data-max="${s.quantity}"
                data-product-id="${s.productId}"
              />
            </div>
          </div>
        `).join('')}
      </div>
    `;
  };

  const _updateCartSummary = () => {
    const cartItems = _stock
      .map(s => ({
        stockItem: s,
        quantity:  parseFloat(document.getElementById(`wqty-${s.productId}`)?.value) || 0,
      }))
      .filter(c => c.quantity > 0);

    const cartEl = document.getElementById('walkin-cart');
    if (!cartEl) return;

    // Validate quantities do not exceed stock
    for (const c of cartItems) {
      if (c.quantity > c.stockItem.quantity) {
        const input = document.getElementById(`wqty-${c.stockItem.productId}`);
        if (input) input.value = c.stockItem.quantity;
        Toast.warning(`Max available for ${c.stockItem.productName}: ${c.stockItem.quantity} ${c.stockItem.unit}`);
        return;
      }
    }

    if (cartItems.length === 0) { cartEl.classList.add('hidden'); return; }
    cartEl.classList.remove('hidden');

    const items = cartItems.map(c => ({
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
      <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:12px">
        ${totals.items.map(i => `
          <div style="display:flex;justify-content:space-between;font-size:0.875rem">
            <span>${i.productName} × ${i.quantity} ${i.unit}</span>
            <span>${Formatters.formatCurrency(i.lineTotal)}</span>
          </div>
        `).join('')}
      </div>
    `;

    document.getElementById('cart-totals').innerHTML = `
      <div style="display:flex;flex-direction:column;gap:6px;font-size:0.9rem">
        <div style="display:flex;justify-content:space-between">
          <span class="text-muted">Subtotal</span>
          <span>${Formatters.formatCurrency(totals.subtotal)}</span>
        </div>
        <div style="display:flex;justify-content:space-between">
          <span class="text-muted">VAT (18%)</span>
          <span>${Formatters.formatCurrency(totals.vatAmount)}</span>
        </div>
        <div style="display:flex;justify-content:space-between;font-weight:700;font-size:1.1rem;margin-top:4px">
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

    // Validate
    if (!customerName)  { Toast.error('Please enter customer name.'); return; }
    if (!customerPhone) { Toast.error('Please enter customer phone number.'); return; }
    if (!purchaseCode || !/^\d{5,6}$/.test(purchaseCode)) {
      Toast.error('Please enter a valid 5 or 6 digit purchase code.');
      document.getElementById('walkin-purchase-code')?.focus();
      return;
    }

    const cartItems = _stock
      .map(s => ({
        stockItem: s,
        quantity:  parseFloat(document.getElementById(`wqty-${s.productId}`)?.value) || 0,
      }))
      .filter(c => c.quantity > 0);

    if (cartItems.length === 0) {
      Toast.error('Please enter a quantity for at least one product.');
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

    // Create order
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

    // Confirm immediately — walk-in = instant sale
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

  return { render, _search, _updateCartSummary, _confirmSale };

})();

// ============================================================
//  MUCURUZI — WalkInSaleView.js
//  Retailer only. POS screen for walk-in customers.
//  Customer name + phone captured. Receipt shown on screen.
// ============================================================

const WalkInSaleView = (() => {

  let _stock = [];
  let _cart  = {};  // productId → {stockItem, quantity}

  const render = async (user, root) => {
    _cart = {};

    root.innerHTML = `
      <div class="page-header">
        <h1 class="page-title">Walk-in Sale</h1>
        <p class="page-subtitle">Sell to a customer right now</p>
      </div>

      <div style="display:grid;grid-template-columns:1fr;gap:var(--space-lg)">

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

        <!-- Product Search + Cart -->
        <div class="card">
          <h3 class="card-title mb-md">Products</h3>
          <input id="walkin-search" type="text" class="form-input"
            placeholder="Search your inventory..."
            oninput="WalkInSaleView._search(this.value)"
            style="margin-bottom:12px" />
          <div id="walkin-products">
            <div class="loader-spinner" style="margin:24px auto;"></div>
          </div>
        </div>

        <!-- Cart Summary -->
        <div class="card" id="walkin-cart" style="display:none">
          <h3 class="card-title mb-md">Cart</h3>
          <div id="cart-items"></div>
          <div class="divider"></div>
          <div id="cart-totals"></div>
          <div class="form-group mt-md">
            <label class="form-label">Purchase Code from *800*${user.tinNumber}#</label>
            <input id="walkin-purchase-code" type="text" class="form-input"
              placeholder="5 or 6 digit code from customer's phone"
              maxlength="6"
              oninput="this.value=this.value.replace(/[^0-9]/g,'')" />
          </div>
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
    _renderProducts(_stock.filter(s => s.productName.toLowerCase().includes(q)));
  };

  const _renderProducts = (items) => {
    const el = document.getElementById('walkin-products');
    if (!el) return;

    if (items.length === 0) {
      el.innerHTML = `<p class="text-muted text-sm">No products found.</p>`;
      return;
    }

    el.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:8px">
        ${items.map(s => `
          <div class="order-item-row">
            <div style="flex:1">
              <p style="font-weight:600">${s.productName}</p>
              <p class="text-muted text-xs">Available: ${s.quantity} ${s.unit} · ${Formatters.formatCurrency(s.sellingPrice)} each</p>
            </div>
            <div style="display:flex;align-items:center;gap:8px">
              <button class="btn btn-ghost btn-sm" onclick="WalkInSaleView._updateCart('${s.productId}', -1)">−</button>
              <span id="wqty-${s.productId}" style="min-width:24px;text-align:center;font-weight:600">0</span>
              <button class="btn btn-secondary btn-sm" onclick="WalkInSaleView._updateCart('${s.productId}', 1)">+</button>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  };

  const _updateCart = (productId, delta) => {
    const stockItem = _stock.find(s => s.productId === productId);
    if (!stockItem) return;

    const current = _cart[productId]?.quantity || 0;
    const newQty  = Math.max(0, Math.min(current + delta, stockItem.quantity));

    if (newQty === 0) delete _cart[productId];
    else _cart[productId] = { stockItem, quantity: newQty };

    const qtyEl = document.getElementById(`wqty-${productId}`);
    if (qtyEl) qtyEl.textContent = newQty;

    _updateCartSummary();
  };

  const _updateCartSummary = () => {
    const cartItems = Object.values(_cart);
    const cartEl    = document.getElementById('walkin-cart');
    if (!cartEl) return;

    if (cartItems.length === 0) { cartEl.style.display = 'none'; return; }
    cartEl.style.display = 'block';

    const items = cartItems.map(c => ({
      productId:   c.stockItem.productId,
      productName: c.stockItem.productName,
      unit:        c.stockItem.unit,
      taxGrade:    'B', // default — retailer sells at standard rate
      quantity:    c.quantity,
      unitPrice:   c.stockItem.sellingPrice,
      rraItemCode: '00000000',
    }));

    const totals = OrderModel.calculateTotals(items);

    document.getElementById('cart-items').innerHTML = `
      <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:12px">
        ${totals.items.map(i => `
          <div style="display:flex;justify-content:space-between;font-size:0.875rem">
            <span>${i.productName} × ${i.quantity}</span>
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
    const cartItems     = Object.values(_cart);

    if (!customerName)  { Toast.error('Please enter customer name.'); return; }
    if (!customerPhone) { Toast.error('Please enter customer phone number.'); return; }
    if (cartItems.length === 0) { Toast.error('Add at least one item to the cart.'); return; }
    if (!purchaseCode || !/^\d{5,6}$/.test(purchaseCode)) {
      Toast.error('Purchase code must be 5 or 6 digits from *800*SellerTIN#.');
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

    // Create a walk-in buyer profile (no real account)
    const walkInBuyer = {
      uid:          `walkin_${Date.now()}`,
      businessName: customerName,
      phone:        customerPhone,
      role:         ROLES.BUYER,
      tinNumber:    '',
    };

    // Create order first
    const orderRes = await OrderService.createOrder({
      sellerId:   user.uid,
      sellerTIN:  user.tinNumber,
      sellerName: user.businessName,
      buyerId:    walkInBuyer.uid,
      buyerTIN:   '',
      buyerName:  `${customerName} (Walk-in)`,
      items,
    });

    if (!orderRes.success) {
      Loader.hide();
      Toast.error(orderRes.error);
      return;
    }

    // Confirm immediately (walk-in = instant sale)
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

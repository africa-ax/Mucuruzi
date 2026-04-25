// ============================================================
//  MUCURUZI — OrderDetailView.js
//  Seller: confirm with purchase code or reject.
//  Buyer: view status, cancel if pending.
// ============================================================

const OrderDetailView = (() => {

  const render = async (user, orderId, root) => {
    root.innerHTML = `
      <div class="page-header" style="display:flex;align-items:center;gap:12px">
        <button class="btn btn-ghost btn-sm" onclick="Router.navigate('#orders')">← Back</button>
        <h1 class="page-title">Order Details</h1>
      </div>
      <div id="order-detail-content">
        <div class="loader-spinner" style="margin:40px auto;"></div>
      </div>
    `;

    await _load(user, orderId);
  };

  const _load = async (user, orderId) => {
    const res = await OrderService.getOrderById(orderId);
    if (!res.success) { Toast.error(res.error); return; }

    const order    = res.data;
    const isSeller = order.sellerId === user.uid;
    const el       = document.getElementById('order-detail-content');
    if (!el) return;

    el.innerHTML = `
      <div style="max-width:600px">

        <!-- Status Banner -->
        <div class="card mb-md" style="border-color:${_statusColor(order.status)}">
          <div style="display:flex;justify-content:space-between;align-items:center">
            <div>
              <p class="text-xs text-muted">${order.orderId}</p>
              <p style="font-weight:600;margin-top:4px">${Formatters.formatDateTime(order.createdAt)}</p>
            </div>
            <span class="badge badge-${_statusBadge(order.status)}" style="font-size:0.85rem;padding:6px 14px">
              ${Formatters.formatStatus(order.status)}
            </span>
          </div>
        </div>

        <!-- Parties -->
        <div class="card mb-md">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
            <div>
              <p class="stat-label">Seller</p>
              <p style="font-weight:600">${order.sellerName}</p>
              <p class="text-muted text-xs">TIN: ${order.sellerTIN}</p>
            </div>
            <div>
              <p class="stat-label">Buyer</p>
              <p style="font-weight:600">${order.buyerName}</p>
              ${order.buyerTIN ? `<p class="text-muted text-xs">TIN: ${order.buyerTIN}</p>` : ''}
            </div>
          </div>
        </div>

        <!-- Items -->
        <div class="card mb-md">
          <h3 class="card-title mb-md">Items Ordered</h3>
          <div class="table-wrapper">
            <table class="table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Qty</th>
                  <th>Unit Price</th>
                  <th>VAT</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                ${order.items.map(i => `
                  <tr>
                    <td>
                      <p style="font-weight:500">${i.productName}</p>
                      <p class="text-xs text-muted">${i.rraItemCode} · ${i.unit}</p>
                    </td>
                    <td>${i.quantity}</td>
                    <td>${Formatters.formatCurrency(i.unitPrice)}</td>
                    <td>${Formatters.formatCurrency(i.vatAmount)}</td>
                    <td style="font-weight:600">${Formatters.formatCurrency(i.lineTotal)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
          <div style="margin-top:16px;text-align:right">
            <p class="text-muted text-sm">Subtotal: ${Formatters.formatCurrency(order.subtotal)}</p>
            <p class="text-muted text-sm">VAT: ${Formatters.formatCurrency(order.vatAmount)}</p>
            <p style="font-size:1.2rem;font-weight:700;color:var(--color-accent)">Total: ${Formatters.formatCurrency(order.total)}</p>
          </div>
        </div>

        <!-- Actions -->
        ${isSeller && order.status === ORDER_STATUS.PENDING ? `
          <div class="card">
            <h3 class="card-title mb-md">Confirm Order</h3>
            <div class="card mb-md" style="background:var(--color-accent-glow);border-color:var(--color-accent)">
              <p class="text-sm" style="color:var(--color-accent);font-weight:600">Purchase Code</p>
              <p style="font-family:var(--font-display);font-size:1.4rem;font-weight:800;letter-spacing:0.1em">
                ${order.purchaseCode || '—'}
              </p>
              <p class="text-xs text-muted mt-sm">Provided by buyer when placing order</p>
            </div>
            <div style="display:flex;gap:12px;margin-top:8px">
              <button id="confirm-btn" class="btn btn-primary" style="flex:1"
                onclick="OrderDetailView._confirm('${order.orderId}')">
                ✓ Confirm Order
              </button>
              <button class="btn btn-danger"
                onclick="OrderDetailView._reject('${order.orderId}')">
                Reject
              </button>
            </div>
          </div>
        ` : ''}

        ${!isSeller && order.status === ORDER_STATUS.CONFIRMED && order.invoiceId ? `
          <button class="btn btn-primary btn-block btn-lg"
            onclick="Router.navigate('#invoice/${order.invoiceId}')">
            View Invoice →
          </button>
        ` : ''}

        ${order.status === ORDER_STATUS.REJECTED ? `
          <div class="card" style="border-color:var(--color-danger)">
            <p style="color:var(--color-danger);font-weight:600">Order Rejected</p>
            ${order.rejectReason ? `<p class="text-muted text-sm mt-sm">Reason: ${order.rejectReason}</p>` : ''}
          </div>
        ` : ''}

      </div>
    `;
  };

  const _confirm = async (orderId) => {
    // Purchase code was submitted by buyer when placing the order
    // Fetch the order to get the stored code
    const orderRes = await OrderService.getOrderById(orderId);
    if (!orderRes.success) { Toast.error('Order not found.'); return; }

    const code = orderRes.data.purchaseCode;
    if (!code || !/^\d{5,6}$/.test(code)) {
      Toast.error('No valid purchase code found on this order.');
      return;
    }

    Loader.show('Verifying purchase code and generating invoice...');

    const buyerRes = await UserService.getProfile(
      (await OrderService.getOrderById(orderId)).data.buyerId
    );

    const res = await OrderService.confirmOrder(
      orderId,
      code,
      window.currentUser,
      buyerRes.data || { uid: '', role: ROLES.BUYER, tinNumber: '', businessName: 'Customer' }
    );

    Loader.hide();

    if (res.success) {
      Toast.success('Order confirmed! Invoice generated.');
      setTimeout(() => Router.navigate(`#invoice/${res.invoiceId}`), 800);
    } else {
      Toast.error(res.error);
    }
  };

  const _reject = (orderId) => {
    Modal.show({
      title:       'Reject Order',
      confirmText: 'Reject Order',
      confirmClass:'btn-danger',
      body: `
        <p class="mb-md">Are you sure you want to reject this order?</p>
        <div class="form-group">
          <label class="form-label">Reason (optional)</label>
          <input id="reject-reason" type="text" class="form-input" placeholder="e.g. Out of stock" />
        </div>
      `,
      onConfirm: async () => {
        const reason = document.getElementById('reject-reason')?.value || '';
        Loader.show('Rejecting order...');
        const res = await OrderService.rejectOrder(orderId, window.currentUser.uid, reason);
        Loader.hide();
        if (res.success) {
          Toast.success('Order rejected.');
          Router.navigate('#orders');
        } else {
          Toast.error(res.error);
        }
      },
    });
  };

  const _statusColor  = (s) => ({ pending:'var(--color-warning)', confirmed:'var(--color-success)', rejected:'var(--color-danger)' }[s] || 'var(--color-border)');
  const _statusBadge  = (s) => ({ pending:'warning', confirmed:'success', rejected:'danger' }[s] || 'muted');

  return { render, _confirm, _reject };

})();

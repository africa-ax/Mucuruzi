// ============================================================
//  MUCURUZI — BuyerDash.js
// ============================================================

const BuyerDash = (() => {

  const _startOfMonth = () => { const d=new Date(); d.setHours(0,0,0,0); d.setDate(1); return d; };
  const _tsToDate = (ts) => { if(!ts) return new Date(0); if(ts.toDate) return ts.toDate(); return new Date(ts); };

  const render = async (user, root) => {
    root.innerHTML = `
      <div class="page-header">
        <h1 class="page-title">Good ${_greeting()}, ${user.businessName} 👋</h1>
        <p class="page-subtitle">Your purchasing overview</p>
      </div>
      <div id="dash-stats" class="stat-grid">${_skeletonStats(4)}</div>

      <!-- Marketplace CTA -->
      <div class="card mt-lg" style="border-color:var(--color-accent);background:var(--color-accent-glow)">
        <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px">
          <div>
            <h3 style="font-family:var(--font-display);font-size:1.1rem;font-weight:700;color:var(--color-accent)">Marketplace</h3>
            <p class="text-muted text-sm">Browse products from verified traders across Rwanda</p>
          </div>
          <button class="btn btn-primary" onclick="Router.navigate('#marketplace')">⊞ Browse Now</button>
        </div>
      </div>

      <div class="dash-grid mt-lg">
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">Recent Orders</h3>
            <a href="#orders" class="btn btn-ghost btn-sm">View all</a>
          </div>
          <div id="dash-orders"><div class="loader-spinner" style="margin:24px auto;"></div></div>
        </div>
        <div class="card">
          <div class="card-header"><h3 class="card-title">Quick Actions</h3></div>
          <div class="dash-actions">
            <button class="btn btn-secondary btn-block mb-md" onclick="Router.navigate('#orders')">◫ My Orders</button>
            <button class="btn btn-secondary btn-block" onclick="Router.navigate('#invoices')">◻ My Receipts</button>
          </div>
        </div>
      </div>
    `;

    await _loadStats(user);
    await _loadRecentOrders(user);
  };

  const _loadStats = async (user) => {
    const monthStart = _startOfMonth();

    const [ordersRes, stockRes, invoicesRes] = await Promise.all([
      OrderService.getMyOrders(user.uid, 'buyer'),
      StockService.getMyStock(user.uid),
      InvoiceService.getMyInvoices(user.uid, 'buyer'),
    ]);

    const orders   = ordersRes.data   || [];
    const stock    = stockRes.data    || [];
    const invoices = invoicesRes.data || [];

    // Orders placed this month
    const ordersThisMonth = orders.filter(o => _tsToDate(o.createdAt) >= monthStart).length;

    // Confirmed orders this month
    const confirmedMonth = orders.filter(o =>
      o.status === ORDER_STATUS.CONFIRMED &&
      _tsToDate(o.createdAt) >= monthStart
    ).length;

    // Returns this month
    const returnsMonth = invoices.filter(i =>
      i.returnStatus === 'approved' &&
      _tsToDate(i.returnedAt) >= monthStart
    ).length;

    document.getElementById('dash-stats').innerHTML = `
      ${_statCard('Orders This Month', ordersThisMonth, 'This month', 'var(--color-buyer)')}
      ${_statCard('Confirmed', confirmedMonth, 'This month', 'var(--color-success)')}
      ${_statCard('Items in Stock', stock.length, 'Right now', 'var(--color-info)')}
      ${_statCard('Returns', returnsMonth, 'This month', 'var(--color-warning)')}
    `;
  };

  const _loadRecentOrders = async (user) => {
    const res    = await OrderService.getMyOrders(user.uid, 'buyer');
    const orders = (res.data || []).slice(0, 5);
    const el     = document.getElementById('dash-orders');
    if (!el) return;

    if (orders.length === 0) {
      el.innerHTML = `<p class="text-muted text-sm" style="padding:16px 0">No orders yet. <a href="#marketplace">Browse marketplace</a></p>`;
      return;
    }

    el.innerHTML = `
      <div class="activity-list">
        ${orders.map(o => `
          <div class="activity-item" onclick="Router.navigate('#order/${o.orderId}')" style="cursor:pointer">
            <div class="activity-dot" style="background:${_statusColor(o.status)}"></div>
            <div class="activity-text">
              <strong>${o.sellerName}</strong>
              <span class="text-muted"> — ${Formatters.formatCurrency(o.total)}</span>
            </div>
            <span class="badge badge-${_statusBadge(o.status)}">${Formatters.formatStatus(o.status)}</span>
          </div>
        `).join('')}
      </div>
    `;
  };

  const _statCard    = (label, value, sub, color) => `<div class="stat-card" style="--stat-color:${color}"><p class="stat-label">${label}</p><p class="stat-value">${value}</p><p class="stat-sub">${sub}</p></div>`;
  const _skeletonStats = (n) => Array(n).fill(0).map(()=>`<div class="stat-card" style="height:90px;background:var(--color-surface-2);border-radius:var(--radius-lg)"></div>`).join('');
  const _greeting    = () => { const h=new Date().getHours(); return h<12?'morning':h<17?'afternoon':'evening'; };
  const _statusColor = (s) => ({pending:'var(--color-warning)',confirmed:'var(--color-success)',rejected:'var(--color-danger)'}[s]||'var(--color-text-muted)');
  const _statusBadge = (s) => ({pending:'warning',confirmed:'success',rejected:'danger'}[s]||'muted');

  return { render };

})();

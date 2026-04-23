// ============================================================
//  MUCURUZI — ManufacturerDash.js
// ============================================================

const ManufacturerDash = (() => {

  // ── Time Helpers ─────────────────────────────────────────────
  const _startOfWeek = () => {
    const d = new Date();
    d.setHours(0,0,0,0);
    d.setDate(d.getDate() - d.getDay());
    return d;
  };

  const _startOfMonth = () => {
    const d = new Date();
    d.setHours(0,0,0,0);
    d.setDate(1);
    return d;
  };

  const _tsToDate = (ts) => {
    if (!ts) return new Date(0);
    if (ts.toDate) return ts.toDate();
    return new Date(ts);
  };

  // ── Render ────────────────────────────────────────────────────
  const render = async (user, root) => {
    root.innerHTML = `
      <div class="page-header">
        <h1 class="page-title">Good ${_greeting()}, ${user.businessName} 👋</h1>
        <p class="page-subtitle">Here is what is happening with your business</p>
      </div>
      <div id="dash-stats" class="stat-grid">
        ${_skeletonStats(4)}
      </div>
      <div class="dash-grid mt-lg">
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">Recent Orders</h3>
            <a href="#orders" class="btn btn-ghost btn-sm">View all</a>
          </div>
          <div id="dash-orders">
            <div class="loader-spinner" style="margin:24px auto;"></div>
          </div>
        </div>
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">Quick Actions</h3>
          </div>
          <div class="dash-actions">
            <button class="btn btn-primary btn-block mb-md" onclick="Router.navigate('#products')">
              ⬡ My Products
            </button>
            <button class="btn btn-secondary btn-block mb-md" onclick="Router.navigate('#raw-materials')">
              ◎ Raw Materials
            </button>
            <button class="btn btn-secondary btn-block" onclick="Router.navigate('#marketplace')">
              ⊞ Marketplace
            </button>
          </div>
        </div>
      </div>
    `;

    await _loadStats(user);
    await _loadRecentOrders(user);
  };

  const _loadStats = async (user) => {
    const weekStart  = _startOfWeek();
    const monthStart = _startOfMonth();

    const [productsRes, stockRes, ordersRes, invoicesRes] = await Promise.all([
      ProductService.getMyProducts(user.uid),
      StockService.getMyStock(user.uid, STOCK_TYPES.RAW_MATERIAL),
      OrderService.getMyOrders(user.uid, 'seller'),
      InvoiceService.getMyInvoices(user.uid, 'seller'),
    ]);

    const products    = productsRes.data  || [];
    const rawMats     = stockRes.data     || [];
    const orders      = ordersRes.data    || [];
    const invoices    = invoicesRes.data  || [];

    // Pending orders — always current
    const pending = orders.filter(o => o.status === ORDER_STATUS.PENDING).length;

    // Confirmed this week
    const confirmedWeek = orders.filter(o =>
      o.status === ORDER_STATUS.CONFIRMED &&
      _tsToDate(o.confirmedAt) >= weekStart
    ).length;

    // Revenue this week and this month
    const revenueWeek  = invoices
      .filter(i => _tsToDate(i.createdAt) >= weekStart)
      .reduce((s, i) => s + (i.total || 0), 0);

    const revenueMonth = invoices
      .filter(i => _tsToDate(i.createdAt) >= monthStart)
      .reduce((s, i) => s + (i.total || 0), 0);

    document.getElementById('dash-stats').innerHTML = `
      ${_statCard('Total Products', products.length, 'All time', 'var(--color-manufacturer)')}
      ${_statCard('Raw Materials', rawMats.length, 'In stock now', 'var(--color-info)')}
      ${_statCard('Pending Orders', pending, 'Right now', 'var(--color-warning)')}
      ${_revenueCard(revenueWeek, revenueMonth)}
    `;
  };

  const _loadRecentOrders = async (user) => {
    const res    = await OrderService.getMyOrders(user.uid, 'seller');
    const orders = (res.data || []).slice(0, 5);
    const el     = document.getElementById('dash-orders');
    if (!el) return;

    if (orders.length === 0) {
      el.innerHTML = `<p class="text-muted text-sm" style="padding:16px 0">No orders yet.</p>`;
      return;
    }

    el.innerHTML = `
      <div class="activity-list">
        ${orders.map(o => `
          <div class="activity-item" onclick="Router.navigate('#order/${o.orderId}')" style="cursor:pointer">
            <div class="activity-dot" style="background:${_statusColor(o.status)}"></div>
            <div class="activity-text">
              <strong>${o.buyerName}</strong>
              <span class="text-muted"> — ${Formatters.formatCurrency(o.total)}</span>
            </div>
            <span class="badge badge-${_statusBadge(o.status)}">${Formatters.formatStatus(o.status)}</span>
          </div>
        `).join('')}
      </div>
    `;
  };

  // ── Helpers ───────────────────────────────────────────────────
  const _statCard = (label, value, sub, color) => `
    <div class="stat-card" style="--stat-color:${color}">
      <p class="stat-label">${label}</p>
      <p class="stat-value">${value}</p>
      <p class="stat-sub">${sub}</p>
    </div>
  `;

  const _revenueCard = (week, month) => `
    <div class="stat-card" style="--stat-color:var(--color-accent); grid-column: span 2;">
      <p class="stat-label">Revenue</p>
      <div style="display:flex;gap:24px;align-items:flex-end;margin-top:8px">
        <div>
          <p class="stat-value">${Formatters.formatCurrency(week)}</p>
          <p class="stat-sub">This week</p>
        </div>
        <div style="border-left:1px solid var(--color-border);padding-left:24px">
          <p class="stat-value" style="font-size:1.3rem">${Formatters.formatCurrency(month)}</p>
          <p class="stat-sub">This month</p>
        </div>
      </div>
    </div>
  `;

  const _skeletonStats = (n) => Array(n).fill(0).map(() => `
    <div class="stat-card skeleton" style="height:90px;background:var(--color-surface-2);border-radius:var(--radius-lg);animation:pulse 1.5s infinite"></div>
  `).join('');

  const _greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'morning';
    if (h < 17) return 'afternoon';
    return 'evening';
  };

  const _statusColor  = (s) => ({ pending:'var(--color-warning)', confirmed:'var(--color-success)', rejected:'var(--color-danger)' }[s] || 'var(--color-text-muted)');
  const _statusBadge  = (s) => ({ pending:'warning', confirmed:'success', rejected:'danger' }[s] || 'muted');

  return { render };

})();

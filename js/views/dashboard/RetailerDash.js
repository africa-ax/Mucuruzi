// ============================================================
//  MUCURUZI — RetailerDash.js
// ============================================================

const RetailerDash = (() => {

  const _startOfToday  = () => { const d = new Date(); d.setHours(0,0,0,0); return d; };
  const _startOfWeek   = () => { const d = new Date(); d.setHours(0,0,0,0); d.setDate(d.getDate()-d.getDay()); return d; };
  const _startOfMonth  = () => { const d = new Date(); d.setHours(0,0,0,0); d.setDate(1); return d; };
  const _tsToDate = (ts) => { if(!ts) return new Date(0); if(ts.toDate) return ts.toDate(); return new Date(ts); };

  const render = async (user, root) => {
    root.innerHTML = `
      <div class="page-header">
        <h1 class="page-title">Good ${_greeting()}, ${user.businessName} 👋</h1>
        <p class="page-subtitle">Your retail overview</p>
      </div>
      <div id="dash-stats" class="stat-grid">${_skeletonStats(4)}</div>

      <!-- Walk-in Sale prominent CTA -->
      <div class="card mt-lg" style="border-color:var(--color-accent);background:var(--color-accent-glow)">
        <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px">
          <div>
            <h3 style="font-family:var(--font-display);font-size:1.1rem;font-weight:700;color:var(--color-accent)">Walk-in Sale</h3>
            <p class="text-muted text-sm">Sell to a customer right now — instant receipt</p>
          </div>
          <button class="btn btn-primary" onclick="Router.navigate('#walkin')">⊕ Start Sale</button>
        </div>
      </div>

      <div class="dash-grid mt-lg">
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">Recent Activity</h3>
            <a href="#orders" class="btn btn-ghost btn-sm">View all</a>
          </div>
          <div id="dash-orders"><div class="loader-spinner" style="margin:24px auto;"></div></div>
        </div>
        <div class="card">
          <div class="card-header"><h3 class="card-title">Quick Actions</h3></div>
          <div class="dash-actions">
            <button class="btn btn-secondary btn-block mb-md" onclick="Router.navigate('#marketplace')">⊞ Browse Marketplace</button>
            <button class="btn btn-secondary btn-block mb-md" onclick="Router.navigate('#inventory')">⬡ View Inventory</button>
            <button class="btn btn-secondary btn-block" onclick="Router.navigate('#invoices')">◻ Receipts</button>
          </div>
        </div>
      </div>
    `;

    await _loadStats(user);
    await _loadRecentOrders(user);
  };

  const _loadStats = async (user) => {
    const today      = _startOfToday();
    const weekStart  = _startOfWeek();
    const monthStart = _startOfMonth();

    const [stockRes, ordersRes, invoicesRes] = await Promise.all([
      StockService.getMyStock(user.uid, STOCK_TYPES.INVENTORY),
      OrderService.getMyOrders(user.uid, 'seller'),
      InvoiceService.getMyInvoices(user.uid, 'seller'),
    ]);

    const stock    = stockRes.data    || [];
    const orders   = ordersRes.data   || [];
    const invoices = invoicesRes.data || [];

    const pending      = orders.filter(o => o.status === ORDER_STATUS.PENDING).length;

    // Walk-in sales today — invoices created today where buyerName contains 'Walk-in'
    const walkInToday = invoices.filter(i =>
      _tsToDate(i.createdAt) >= today && i.buyerName && i.buyerName.toLowerCase().includes('walk')
    ).length;

    const revenueWeek  = invoices.filter(i => _tsToDate(i.createdAt) >= weekStart).reduce((s,i) => s+(i.total||0), 0);
    const revenueMonth = invoices.filter(i => _tsToDate(i.createdAt) >= monthStart).reduce((s,i) => s+(i.total||0), 0);

    document.getElementById('dash-stats').innerHTML = `
      ${_statCard('Inventory Items', stock.length, 'In stock now', 'var(--color-retailer)')}
      ${_statCard('Pending Orders', pending, 'Right now', 'var(--color-warning)')}
      ${_statCard('Walk-in Sales', walkInToday, 'Today', 'var(--color-info)')}
      ${_revenueCard(revenueWeek, revenueMonth)}
    `;
  };

  const _loadRecentOrders = async (user) => {
    const res    = await OrderService.getMyOrders(user.uid, 'seller');
    const orders = (res.data || []).slice(0, 5);
    const el     = document.getElementById('dash-orders');
    if (!el) return;

    if (orders.length === 0) {
      el.innerHTML = `<p class="text-muted text-sm" style="padding:16px 0">No activity yet.</p>`;
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

  const _statCard    = (label, value, sub, color) => `<div class="stat-card" style="--stat-color:${color}"><p class="stat-label">${label}</p><p class="stat-value">${value}</p><p class="stat-sub">${sub}</p></div>`;
  const _revenueCard = (week, month) => `<div class="stat-card" style="--stat-color:var(--color-accent);grid-column:span 2"><p class="stat-label">Revenue</p><div style="display:flex;gap:24px;align-items:flex-end;margin-top:8px"><div><p class="stat-value">${Formatters.formatCurrency(week)}</p><p class="stat-sub">This week</p></div><div style="border-left:1px solid var(--color-border);padding-left:24px"><p class="stat-value" style="font-size:1.3rem">${Formatters.formatCurrency(month)}</p><p class="stat-sub">This month</p></div></div></div>`;
  const _skeletonStats = (n) => Array(n).fill(0).map(()=>`<div class="stat-card" style="height:90px;background:var(--color-surface-2);border-radius:var(--radius-lg)"></div>`).join('');
  const _greeting    = () => { const h=new Date().getHours(); return h<12?'morning':h<17?'afternoon':'evening'; };
  const _statusColor = (s) => ({pending:'var(--color-warning)',confirmed:'var(--color-success)',rejected:'var(--color-danger)'}[s]||'var(--color-text-muted)');
  const _statusBadge = (s) => ({pending:'warning',confirmed:'success',rejected:'danger'}[s]||'muted');

  return { render };

})();

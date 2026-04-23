// ============================================================
//  MUCURUZI — InvoiceListView.js
//  All roles. Sales and purchase invoice tabs.
// ============================================================

const InvoiceListView = (() => {

  let _salesInvoices    = [];
  let _purchaseInvoices = [];
  let _activeTab        = 'purchases';

  const render = async (user, root) => {
    const isSeller = ROLE_CAN_SELL.includes(user.role);
    _activeTab     = isSeller ? 'sales' : 'purchases';

    root.innerHTML = `
      <div class="page-header">
        <h1 class="page-title">${user.role === ROLES.BUYER ? 'My Receipts' : 'Invoices'}</h1>
        <p class="page-subtitle">All your EBM-compliant invoices</p>
      </div>

      ${isSeller ? `
        <div class="tab-bar">
          <button class="tab-btn active" id="tab-sales" onclick="InvoiceListView._switchTab('sales')">Sales Invoices</button>
          <button class="tab-btn" id="tab-purchases" onclick="InvoiceListView._switchTab('purchases')">Purchase Invoices</button>
        </div>
      ` : ''}

      <div id="invoices-container">
        <div class="loader-spinner" style="margin:40px auto;"></div>
      </div>
    `;

    await _load(user);
  };

  const _load = async (user) => {
    const isSeller = ROLE_CAN_SELL.includes(user.role);
    const promises = [InvoiceService.getMyInvoices(user.uid, 'buyer')];
    if (isSeller) promises.push(InvoiceService.getMyInvoices(user.uid, 'seller'));

    const [purchaseRes, salesRes] = await Promise.all(promises);
    _purchaseInvoices = purchaseRes.data  || [];
    _salesInvoices    = salesRes?.data    || [];

    _renderTab(_activeTab);
  };

  const _switchTab = (tab) => {
    _activeTab = tab;
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    const btn = document.getElementById(`tab-${tab}`);
    if (btn) btn.classList.add('active');
    _renderTab(tab);
  };

  const _renderTab = (tab) => {
    const invoices = tab === 'sales' ? _salesInvoices : _purchaseInvoices;
    const el = document.getElementById('invoices-container');
    if (!el) return;

    if (invoices.length === 0) {
      el.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">◻</div>
          <h3 class="empty-state-title">No invoices yet</h3>
          <p class="empty-state-text">Invoices are generated automatically when orders are confirmed.</p>
        </div>
      `;
      return;
    }

    el.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:12px">
        ${invoices.map(inv => `
          <div class="card" onclick="Router.navigate('#invoice/${inv.invoiceId}')" style="cursor:pointer">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:8px">
              <div>
                <p class="text-xs text-muted">${inv.receiptNumber}</p>
                <h3 style="font-weight:600;margin:4px 0">${tab === 'sales' ? inv.buyerName : inv.sellerName}</h3>
                <p class="text-sm text-muted">${Formatters.formatDateTime(inv.createdAt)}</p>
              </div>
              <div style="text-align:right">
                <p style="font-family:var(--font-display);font-size:1.1rem;font-weight:700">${Formatters.formatCurrency(inv.total)}</p>
                <div style="display:flex;gap:6px;justify-content:flex-end;margin-top:4px;flex-wrap:wrap">
                  <span class="badge badge-success">EBM ✓</span>
                  ${inv.returnStatus ? `<span class="badge badge-warning">${Formatters.formatReturnStatus(inv.returnStatus)}</span>` : ''}
                </div>
              </div>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  };

  return { render, _switchTab };

})();

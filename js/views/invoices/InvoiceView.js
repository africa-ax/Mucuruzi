// ============================================================
//  MUCURUZI — InvoiceView.js
//  Full EBM invoice display with RRA digital seal + return flow.
// ============================================================

const InvoiceView = (() => {

  const render = async (user, invoiceId, root) => {
    root.innerHTML = `
      <div class="page-header" style="display:flex;align-items:center;gap:12px">
        <button class="btn btn-ghost btn-sm" onclick="Router.navigate('#invoices')">← Back</button>
        <h1 class="page-title">Invoice</h1>
      </div>
      <div id="invoice-content">
        <div class="loader-spinner" style="margin:40px auto;"></div>
      </div>
    `;

    const res = await InvoiceService.getInvoiceById(invoiceId);
    if (!res.success) { Toast.error(res.error); return; }

    _render(user, res.data);
  };

  const _render = (user, inv) => {
    const el      = document.getElementById('invoice-content');
    if (!el) return;

    const isBuyer  = inv.buyerId === user.uid;
    const canReturn = isBuyer ? InvoiceModel.canReturn(inv) : { allowed: false };
    const deadline  = inv.returnDeadline ? Formatters.formatDate(inv.returnDeadline) : '—';

    el.innerHTML = `
      <div style="max-width:640px" id="invoice-print-area">

        <!-- EBM Header -->
        <div class="card mb-md" style="border-color:var(--color-accent);background:linear-gradient(135deg,var(--color-surface),var(--color-surface-2))">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:12px">
            <div>
              <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
                <div style="width:32px;height:32px;background:var(--color-accent);border-radius:6px;display:flex;align-items:center;justify-content:center;font-weight:800;color:var(--color-bg)">M</div>
                <span style="font-family:var(--font-display);font-weight:700;font-size:1.1rem">Mucuruzi</span>
              </div>
              <span class="badge badge-success">✓ EBM Compliant Invoice</span>
            </div>
            <div style="text-align:right">
              <p class="text-xs text-muted">Receipt Number</p>
              <p style="font-family:var(--font-display);font-weight:700;font-size:1rem;color:var(--color-accent)">${inv.receiptNumber}</p>
              <p class="text-xs text-muted mt-sm">${Formatters.formatDateTime(inv.createdAt)}</p>
            </div>
          </div>
        </div>

        <!-- Parties -->
        <div class="card mb-md">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
            <div>
              <p class="stat-label">Seller</p>
              <p style="font-weight:600">${inv.sellerName}</p>
              <p class="text-muted text-xs">TIN: ${inv.sellerTIN}</p>
              <p class="text-muted text-xs">SDC: ${inv.sdcId}</p>
            </div>
            <div>
              <p class="stat-label">Buyer</p>
              <p style="font-weight:600">${inv.buyerName}</p>
              <p class="text-muted text-xs">TIN: ${inv.buyerTIN}</p>
            </div>
          </div>
        </div>

        <!-- Line Items -->
        <div class="card mb-md">
          <h3 class="card-title mb-md">Items</h3>
          <div class="table-wrapper">
            <table class="table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Code</th>
                  <th>Qty</th>
                  <th>Price</th>
                  <th>VAT</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                ${inv.items.map(i => `
                  <tr>
                    <td>
                      <p style="font-weight:500">${i.productName}</p>
                      <p class="text-xs text-muted">${i.unit} · Grade ${i.taxGrade}</p>
                    </td>
                    <td class="text-xs text-muted">${i.rraItemCode}</td>
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
            <p class="text-muted text-sm">Subtotal: ${Formatters.formatCurrency(inv.subtotal)}</p>
            <p class="text-muted text-sm">VAT (18%): ${Formatters.formatCurrency(inv.vatAmount)}</p>
            <p style="font-size:1.3rem;font-weight:700;color:var(--color-accent);margin-top:4px">
              Total: ${Formatters.formatCurrency(inv.total)}
            </p>
          </div>
        </div>

        <!-- RRA Digital Seal -->
        <div class="card mb-md" style="border-color:var(--color-accent)">
          <h3 class="card-title mb-md" style="color:var(--color-accent)">🔐 RRA Digital Seal</h3>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;font-size:0.8rem">
            <div>
              <p class="stat-label">Signature</p>
              <p style="font-family:monospace;word-break:break-all;color:var(--color-accent)">${inv.signature}</p>
            </div>
            <div>
              <p class="stat-label">Internal Data</p>
              <p style="font-family:monospace;word-break:break-all;color:var(--color-text-muted)">${inv.internalData}</p>
            </div>
            <div>
              <p class="stat-label">SDC ID</p>
              <p style="font-weight:600">${inv.sdcId}</p>
            </div>
            <div>
              <p class="stat-label">SDC Date/Time</p>
              <p style="font-weight:600">${Formatters.formatDateTime(inv.sdcDateTime)}</p>
            </div>
            <div>
              <p class="stat-label">Purchase Code</p>
              <p style="font-weight:600">${inv.purchaseCode || '—'}</p>
            </div>
          </div>

          <!-- QR Code -->
          <div style="margin-top:16px;text-align:center">
            <p class="stat-label mb-sm">Scan to Verify on RRA Portal</p>
            <div id="invoice-qr" style="display:inline-block"></div>
          </div>
        </div>

        <!-- Return Section -->
        ${isBuyer ? `
          <div class="card mb-md" style="border-color:${inv.returnStatus ? 'var(--color-warning)' : 'var(--color-border)'}">
            <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px">
              <div>
                <h3 class="card-title">Returns</h3>
                <p class="text-muted text-xs">Return window closes: ${deadline}</p>
                ${inv.returnStatus ? `<span class="badge badge-warning mt-sm">${Formatters.formatReturnStatus(inv.returnStatus)}</span>` : ''}
              </div>
              ${canReturn.allowed ? `
                <button class="btn btn-secondary" onclick="InvoiceView._openReturnModal('${inv.invoiceId}')">
                  ↩ Request Return
                </button>
              ` : inv.returnStatus === null ? `
                <span class="text-muted text-sm">${canReturn.reason || 'Return not available'}</span>
              ` : ''}
            </div>
            ${inv.creditNoteId ? `
              <button class="btn btn-ghost btn-sm mt-md" onclick="Router.navigate('#credit-note/${inv.creditNoteId}')">
                View Credit Note →
              </button>
            ` : ''}
          </div>
        ` : ''}

        <!-- Seller return approval -->
        ${!isBuyer && inv.returnStatus === 'requested' ? `
          <div class="card mb-md" style="border-color:var(--color-warning)">
            <h3 class="card-title mb-md" style="color:var(--color-warning)">⚠ Return Request Pending</h3>
            <p class="text-muted text-sm mb-md">The buyer has requested to return the following items:</p>
            ${(inv.returnedItems || []).map(i => `
              <div style="display:flex;justify-content:space-between;font-size:0.875rem;padding:6px 0;border-bottom:1px solid var(--color-border)">
                <span>${i.productName} × ${i.quantity} ${i.unit}</span>
                <span style="color:var(--color-warning)">${Formatters.formatCurrency(i.refundTotal)}</span>
              </div>
            `).join('')}
            <p style="font-weight:700;margin-top:12px">Total Refund: ${Formatters.formatCurrency(inv.totalRefund)}</p>
            <div style="display:flex;gap:12px;margin-top:16px">
              <button class="btn btn-primary" style="flex:1" onclick="InvoiceView._approveReturn('${inv.invoiceId}')">
                ✓ Approve Return
              </button>
              <button class="btn btn-danger" onclick="InvoiceView._rejectReturn('${inv.invoiceId}')">
                Reject
              </button>
            </div>
          </div>
        ` : ''}

      </div>
    `;

    // Render QR code
    if (inv.qrCode) {
      QRCodeRenderer.render('invoice-qr', inv.qrCode, 130);
    }
  };

  // ── Return Request Modal ──────────────────────────────────────
  const _openReturnModal = async (invoiceId) => {
    const res = await InvoiceService.getInvoiceById(invoiceId);
    if (!res.success) { Toast.error(res.error); return; }
    const inv = res.data;

    Modal.show({
      title:       'Request Return',
      confirmText: 'Submit Return Request',
      body: `
        <p class="mb-md">Select items to return and enter quantities:</p>
        ${inv.items.map(i => `
          <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--color-border)">
            <div>
              <p style="font-weight:500">${i.productName}</p>
              <p class="text-xs text-muted">Purchased: ${i.quantity} ${i.unit}</p>
            </div>
            <input type="number" id="ret-qty-${i.productId}"
              class="form-input" style="width:80px"
              min="0" max="${i.quantity}" value="0" placeholder="0" />
          </div>
        `).join('')}
      `,
      onConfirm: async () => {
        const returnItems = inv.items
          .map(i => ({
            productId: i.productId,
            quantity:  parseInt(document.getElementById(`ret-qty-${i.productId}`)?.value || 0),
          }))
          .filter(i => i.quantity > 0);

        if (returnItems.length === 0) { Toast.error('Enter quantity for at least one item.'); return; }

        Loader.show('Submitting return request...');
        const result = await InvoiceService.requestReturn(invoiceId, returnItems, window.currentUser.uid);
        Loader.hide();

        if (result.success) {
          Toast.success(`Return requested. Refund amount: ${Formatters.formatCurrency(result.totalRefund)}`);
          InvoiceView.render(window.currentUser, invoiceId, document.getElementById('app-root'));
        } else {
          Toast.error(result.error);
        }
      },
    });
  };

  const _approveReturn = async (invoiceId) => {
    Modal.confirm('Approve this return? Stock will be reversed automatically.', async () => {
      Loader.show('Approving return...');
      const res = await InvoiceService.approveReturn(invoiceId, window.currentUser.uid);
      Loader.hide();
      if (res.success) {
        Toast.success('Return approved. Credit note generated.');
        InvoiceView.render(window.currentUser, invoiceId, document.getElementById('app-root'));
      } else {
        Toast.error(res.error);
      }
    }, 'Approve Return');
  };

  const _rejectReturn = async (invoiceId) => {
    Modal.danger('Reject Return', 'Are you sure you want to reject this return request?', async () => {
      Loader.show('Rejecting return...');
      const res = await InvoiceService.rejectReturn(invoiceId, window.currentUser.uid);
      Loader.hide();
      if (res.success) {
        Toast.success('Return request rejected.');
        InvoiceView.render(window.currentUser, invoiceId, document.getElementById('app-root'));
      } else {
        Toast.error(res.error);
      }
    }, 'Reject');
  };

  return { render, _openReturnModal, _approveReturn, _rejectReturn };

})();

// ============================================================
// OrdersTab.js — Mucuruzi Orders Tab
// All roles: toggle Incoming (seller) / Outgoing (buyer)
// Buyer only: Outgoing only
// ============================================================

import { db }                              from "/src/config/firebase.js";
import { getIncomingOrders, getOutgoingOrders,
         confirmOrder, rejectOrder,
         cancelOrder }                     from "/src/models/Order.js";
import { formatRWF }                       from "/src/utils/VAT.js";

// ── State ─────────────────────────────────────────────────────
let _profile      = null;
let _activeView   = "incoming"; // "incoming" | "outgoing"

// ── Render Orders Tab ─────────────────────────────────────────
export async function renderOrdersTab(container, profile) {
  _profile    = profile;
  const isBuyer = profile.role === "buyer";
  _activeView   = isBuyer ? "outgoing" : "incoming";

  container.innerHTML = `
    <div class="orders-tab">

      ${!isBuyer ? `
        <!-- Toggle: Incoming / Outgoing -->
        <div class="section-toggle">
          <button class="toggle-btn toggle-btn--active" id="btn-incoming">
            Incoming
          </button>
          <button class="toggle-btn" id="btn-outgoing">
            Outgoing
          </button>
        </div>
      ` : ""}

      <!-- Orders List -->
      <div id="orders-list"></div>

    </div>
  `;

  if (!isBuyer) {
    document.getElementById("btn-incoming").addEventListener("click", () => {
      _activeView = "incoming";
      document.getElementById("btn-incoming").classList.add("toggle-btn--active");
      document.getElementById("btn-outgoing").classList.remove("toggle-btn--active");
      _loadOrders();
    });

    document.getElementById("btn-outgoing").addEventListener("click", () => {
      _activeView = "outgoing";
      document.getElementById("btn-outgoing").classList.add("toggle-btn--active");
      document.getElementById("btn-incoming").classList.remove("toggle-btn--active");
      _loadOrders();
    });
  }

  await _loadOrders();
}

// ── Load Orders ───────────────────────────────────────────────
async function _loadOrders() {
  const listEl = document.getElementById("orders-list");
  if (!listEl) return;

  listEl.innerHTML = `
    <div class="orders-loading">
      <div class="mini-spinner"></div>
      <span>Loading orders…</span>
    </div>
  `;

  try {
    const orders = _activeView === "incoming"
      ? await getIncomingOrders(_profile.uid)
      : await getOutgoingOrders(_profile.uid);

    if (orders.length === 0) {
      listEl.innerHTML = `
        <div class="orders-empty">
          <div class="orders-empty-icon">📋</div>
          <h3>No ${_activeView} orders</h3>
          <p>${_activeView === "incoming"
            ? "When buyers place orders with you, they will appear here."
            : "Your placed orders will appear here."
          }</p>
        </div>
      `;
      return;
    }

    listEl.innerHTML = `
      <div class="orders-list">
        ${orders.map(order => _orderCardHTML(order)).join("")}
      </div>
    `;

    _bindOrderActions(orders);

  } catch (err) {
    console.error("[OrdersTab] loadOrders error:", err);
    listEl.innerHTML = `
      <div class="orders-empty">
        <div class="orders-empty-icon">⚠️</div>
        <h3>Failed to load</h3>
        <p>Check your connection and try again.</p>
      </div>
    `;
  }
}

// ── Order Card HTML ───────────────────────────────────────────
function _orderCardHTML(order) {
  const isIncoming  = _activeView === "incoming";
  const isPending   = order.status === "pending";
  const date        = _formatDate(order.createdAt);

  return `
    <div class="order-card order-card--${order.status}" id="ocard-${order.orderId}">

      <!-- Order Header -->
      <div class="order-card-header">
        <div>
          <span class="order-id">#${order.orderId.slice(-8).toUpperCase()}</span>
          <span class="order-date">${date}</span>
        </div>
        <span class="order-status-pill order-status-pill--${order.status}">
          ${_statusLabel(order.status)}
        </span>
      </div>

      <!-- Party Info -->
      <div class="order-party">
        <span class="order-party-label">
          ${isIncoming ? "From" : "To"}
        </span>
        <span class="order-party-name">
          ${isIncoming ? order.buyerName : order.sellerName}
        </span>
      </div>

      <!-- Items -->
      <div class="order-items">
        ${order.items.map(item => `
          <div class="order-item-row">
            <span class="order-item-name">${item.productName}</span>
            <span class="order-item-qty">${item.quantity} ${item.unit}</span>
            <span class="order-item-price">${formatRWF(item.unitPrice)}</span>
          </div>
        `).join("")}
      </div>

      <!-- Totals -->
      <div class="order-totals">
        <div class="order-total-row">
          <span>Subtotal</span>
          <span>${formatRWF(order.subtotal)}</span>
        </div>
        <div class="order-total-row">
          <span>VAT</span>
          <span>${formatRWF(order.vatTotal)}</span>
        </div>
        <div class="order-total-row order-total-row--grand">
          <span>Total</span>
          <span>${formatRWF(order.grandTotal)}</span>
        </div>
      </div>

      <!-- Actions (only on pending) -->
      ${isPending ? `
        <div class="order-actions" id="oactions-${order.orderId}">
          ${isIncoming ? `
            <button class="btn-reject-order" data-orderid="${order.orderId}">
              Reject
            </button>
            <button class="btn-confirm-order" data-orderid="${order.orderId}">
              Confirm Order
            </button>
          ` : `
            <button class="btn-cancel-order" data-orderid="${order.orderId}">
              Cancel Order
            </button>
          `}
        </div>
      ` : ""}

      <!-- Invoice link if confirmed -->
      ${order.status === "confirmed" && order.invoiceId ? `
        <div class="order-invoice-link">
          <span>Invoice: <strong>${order.invoiceId}</strong></span>
        </div>
      ` : ""}

      <!-- Rejection reason -->
      ${order.status === "rejected" && order.rejectReason ? `
        <div class="order-reject-reason">
          Reason: ${order.rejectReason}
        </div>
      ` : ""}

    </div>
  `;
}

// ── Bind Order Actions ────────────────────────────────────────
function _bindOrderActions(orders) {
  // Confirm
  document.querySelectorAll(".btn-confirm-order").forEach(btn => {
    btn.addEventListener("click", () => {
      _showConfirmModal(btn.dataset.orderid);
    });
  });

  // Reject
  document.querySelectorAll(".btn-reject-order").forEach(btn => {
    btn.addEventListener("click", () => {
      _showRejectModal(btn.dataset.orderid);
    });
  });

  // Cancel
  document.querySelectorAll(".btn-cancel-order").forEach(btn => {
    btn.addEventListener("click", () => {
      _showCancelModal(btn.dataset.orderid);
    });
  });
}

// ── Confirm Modal ─────────────────────────────────────────────
function _showConfirmModal(orderId) {
  _showActionModal({
    orderId,
    title:      "Confirm Order?",
    message:    "This will transfer stock to the buyer and generate an invoice. This cannot be undone.",
    confirmLabel: "Confirm Order",
    confirmClass: "btn-modal-confirm",
    onConfirm:  async () => {
      const result = await confirmOrder(orderId, _profile.uid);
      if (result.success) {
        _showToast("Order confirmed. Invoice generated.", "success");
        await _loadOrders();
      } else {
        _showToast(result.error || "Failed to confirm.", "error");
      }
    },
  });
}

// ── Reject Modal ──────────────────────────────────────────────
function _showRejectModal(orderId) {
  const existing = document.getElementById("action-modal");
  if (existing) existing.remove();

  const modal = document.createElement("div");
  modal.id    = "action-modal";
  modal.className = "modal-overlay";
  modal.innerHTML = `
    <div class="modal-box">
      <div class="modal-header">
        <h3>Reject Order?</h3>
        <button class="modal-close" id="close-action-modal">✕</button>
      </div>
      <p class="modal-desc">Optionally provide a reason for rejection.</p>
      <div class="modal-form-group">
        <label for="reject-reason">Reason (optional)</label>
        <input type="text" id="reject-reason" class="modal-input"
          placeholder="e.g. Out of stock" />
      </div>
      <div id="action-modal-error" class="alert alert--error hidden"></div>
      <div class="modal-actions">
        <button class="btn-outline-sm" id="cancel-action-modal">Cancel</button>
        <button class="btn-modal-reject" id="confirm-action">Reject Order</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  document.getElementById("close-action-modal").addEventListener("click",  () => modal.remove());
  document.getElementById("cancel-action-modal").addEventListener("click", () => modal.remove());

  document.getElementById("confirm-action").addEventListener("click", async () => {
    const reason = document.getElementById("reject-reason")?.value.trim() || "";
    const btn    = document.getElementById("confirm-action");
    if (btn) { btn.disabled = true; btn.textContent = "Rejecting…"; }

    const result = await rejectOrder(orderId, _profile.uid, reason);
    modal.remove();

    if (result.success) {
      _showToast("Order rejected.", "error");
      await _loadOrders();
    } else {
      _showToast(result.error || "Failed to reject.", "error");
    }
  });
}

// ── Cancel Modal ──────────────────────────────────────────────
function _showCancelModal(orderId) {
  _showActionModal({
    orderId,
    title:        "Cancel Order?",
    message:      "This will cancel your order. The seller will be notified.",
    confirmLabel: "Cancel Order",
    confirmClass: "btn-modal-reject",
    onConfirm:    async () => {
      const result = await cancelOrder(orderId, _profile.uid);
      if (result.success) {
        _showToast("Order cancelled.", "error");
        await _loadOrders();
      } else {
        _showToast(result.error || "Failed to cancel.", "error");
      }
    },
  });
}

// ── Generic Action Modal ──────────────────────────────────────
function _showActionModal({ title, message, confirmLabel, confirmClass, onConfirm }) {
  const existing = document.getElementById("action-modal");
  if (existing) existing.remove();

  const modal = document.createElement("div");
  modal.id    = "action-modal";
  modal.className = "modal-overlay";
  modal.innerHTML = `
    <div class="modal-box">
      <div class="modal-header">
        <h3>${title}</h3>
        <button class="modal-close" id="close-action-modal">✕</button>
      </div>
      <p class="modal-desc">${message}</p>
      <div id="action-modal-error" class="alert alert--error hidden"></div>
      <div class="modal-actions">
        <button class="btn-outline-sm" id="cancel-action-modal">Go Back</button>
        <button class="${confirmClass}" id="confirm-action">${confirmLabel}</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  document.getElementById("close-action-modal").addEventListener("click",  () => modal.remove());
  document.getElementById("cancel-action-modal").addEventListener("click", () => modal.remove());

  document.getElementById("confirm-action").addEventListener("click", async () => {
    const btn = document.getElementById("confirm-action");
    if (btn) { btn.disabled = true; btn.textContent = "Processing…"; }
    modal.remove();
    await onConfirm();
  });
}

// ── Toast ─────────────────────────────────────────────────────
function _showToast(msg, type = "success") {
  const existing = document.querySelector(".orders-toast");
  if (existing) existing.remove();
  const toast = document.createElement("div");
  toast.className = `orders-toast orders-toast--${type}`;
  toast.textContent = msg;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3500);
}

// ── Helpers ───────────────────────────────────────────────────
function _statusLabel(status) {
  const labels = {
    pending:   "Pending",
    confirmed: "Confirmed",
    rejected:  "Rejected",
    cancelled: "Cancelled",
  };
  return labels[status] || status;
}

function _formatDate(ts) {
  if (!ts) return "—";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString("en-RW", {
    day: "numeric", month: "short", year: "numeric",
  });
}

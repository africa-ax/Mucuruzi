// ============================================================
// DashboardView.js — Mucuruzi Dashboard Shell
// Bottom tab bar + role-based routing + header
// ============================================================

import { logout } from "/src/auth/Auth.js";
import { renderHomeTab } from "/src/views/dashboard/HomeTab.js";

// ── Tab Definitions Per Role ─────────────────────────────────
const TABS = {
  manufacturer: [
    { id: "home",     label: "Home",     icon: iconHome() },
    { id: "products", label: "Products", icon: iconBox() },
    { id: "stock",    label: "Stock",    icon: iconStock() },
    { id: "orders",   label: "Orders",   icon: iconOrders(),  badge: true },
    { id: "invoices", label: "Invoices", icon: iconInvoice() },
  ],
  distributor: [
    { id: "home",        label: "Home",        icon: iconHome() },
    { id: "stock",       label: "Stock",       icon: iconStock() },
    { id: "marketplace", label: "Market",      icon: iconMarket() },
    { id: "orders",      label: "Orders",      icon: iconOrders(), badge: true },
    { id: "invoices",    label: "Invoices",    icon: iconInvoice() },
  ],
  retailer: [
    { id: "home",        label: "Home",        icon: iconHome() },
    { id: "stock",       label: "Stock",       icon: iconStock() },
    { id: "marketplace", label: "Market",      icon: iconMarket() },
    { id: "orders",      label: "Orders",      icon: iconOrders(), badge: true },
    { id: "invoices",    label: "Invoices",    icon: iconInvoice() },
  ],
  buyer: [
    { id: "home",        label: "Home",        icon: iconHome() },
    { id: "marketplace", label: "Market",      icon: iconMarket() },
    { id: "orders",      label: "Orders",      icon: iconOrders(), badge: true },
    { id: "invoices",    label: "Invoices",    icon: iconInvoice() },
  ],
};

// ── State ─────────────────────────────────────────────────────
let _profile = null;
let _activeTab = "home";
let _badgeCounts = {};
let _unsubscribeBadges = null;

// ── Render Dashboard Shell ────────────────────────────────────
export function renderDashboard(profile) {
  _profile = profile;
  _activeTab = "home";

  const container = document.getElementById("app");
  const tabs = TABS[profile.role] || TABS.buyer;

  container.innerHTML = `
    <div class="dashboard-root">

      <!-- Top Header -->
      <header class="dash-header">
        <div class="dash-header-left">
          <div class="dash-logo">M</div>
          <div class="dash-header-info">
            <span class="dash-business-name">
              ${profile.businessName || profile.name || "My Account"}
            </span>
            <span class="dash-role-badge dash-role-badge--${profile.role}">
              ${_capitalize(profile.role)}
            </span>
          </div>
        </div>
        <button class="dash-logout-btn" id="btn-logout" title="Logout">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" stroke-width="2">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
            <polyline points="16 17 21 12 16 7"/>
            <line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
        </button>
      </header>

      <!-- Page Content Area -->
      <main class="dash-content" id="dash-content">
        <!-- Tab views render here -->
      </main>

      <!-- Bottom Tab Bar -->
      <nav class="dash-tab-bar" id="dash-tab-bar">
        ${tabs.map((tab) => `
          <button
            class="tab-item ${tab.id === _activeTab ? "tab-item--active" : ""}"
            data-tab="${tab.id}"
          >
            <span class="tab-icon">
              ${tab.icon}
              ${tab.badge ? `<span class="tab-badge hidden" id="badge-${tab.id}">0</span>` : ""}
            </span>
            <span class="tab-label">${tab.label}</span>
          </button>
        `).join("")}
      </nav>

    </div>
  `;

  // Start listening for badge counts
  _startBadgeListeners();

  // Render default home tab
  _renderTab("home");

  // Tab click events
  document.getElementById("dash-tab-bar").addEventListener("click", (e) => {
    const btn = e.target.closest(".tab-item");
    if (!btn) return;
    const tabId = btn.dataset.tab;
    if (tabId !== _activeTab) _renderTab(tabId);
  });

  // Logout
  document.getElementById("btn-logout").addEventListener("click", async () => {
    if (_unsubscribeBadges) _unsubscribeBadges();
    await logout();
    // app.js onAuthChange will redirect to login automatically
  });
}

// ── Render Tab Content ────────────────────────────────────────
async function _renderTab(tabId) {
  _activeTab = tabId;

  // Update active state on tab bar
  document.querySelectorAll(".tab-item").forEach((btn) => {
    btn.classList.toggle("tab-item--active", btn.dataset.tab === tabId);
  });

  const content = document.getElementById("dash-content");
  content.innerHTML = `<div class="tab-loading">
    <div class="tab-spinner"></div>
  </div>`;

  switch (tabId) {
    case "home":
      renderHomeTab(content, _profile, _badgeCounts);
      break;

    case "products":
      content.innerHTML = _comingSoon("Products", "Create and manage your product catalog using RRA item codes.");
      break;

    case "stock":
      content.innerHTML = _comingSoon("Stock", "View and manage your inventory stock.");
      break;

    case "marketplace":
      content.innerHTML = _comingSoon("Marketplace", "Browse and purchase products from suppliers.");
      break;

    case "orders":
      content.innerHTML = _comingSoon("Orders", "View and manage all your orders.");
      break;

    case "invoices":
      content.innerHTML = _comingSoon("Invoices", "View all EBM-compliant invoices.");
      break;

    default:
      content.innerHTML = _comingSoon("Coming Soon", "This section is being built.");
  }
}

// ── Badge Listeners (Firestore real-time) ─────────────────────
function _startBadgeListeners() {
  // Import Firestore dynamically to keep this file clean
  import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js")
    .then(({ collection, query, where, onSnapshot }) => {
      import("/src/config/firebase.js").then(({ db }) => {
        const uid = _profile.uid;

        // Listen for pending orders where this user is the SELLER
        const ordersRef = collection(db, "orders");
        const q = query(
          ordersRef,
          where("sellerId", "==", uid),
          where("status", "==", "pending")
        );

        const unsub = onSnapshot(q, (snap) => {
          const count = snap.size;
          _badgeCounts.orders = count;
          _updateBadge("orders", count);

          // Also refresh home tab cards if currently on home
          if (_activeTab === "home") {
            const content = document.getElementById("dash-content");
            if (content) renderHomeTab(content, _profile, _badgeCounts);
          }
        });

        _unsubscribeBadges = unsub;
      });
    });
}

// ── Update Badge UI ───────────────────────────────────────────
function _updateBadge(tabId, count) {
  const badge = document.getElementById(`badge-${tabId}`);
  if (!badge) return;
  if (count > 0) {
    badge.textContent = count > 99 ? "99+" : count;
    badge.classList.remove("hidden");
  } else {
    badge.classList.add("hidden");
  }
}

// ── Coming Soon Placeholder ───────────────────────────────────
function _comingSoon(title, desc) {
  return `
    <div class="coming-soon">
      <div class="coming-soon-icon">🔧</div>
      <h3>${title}</h3>
      <p>${desc}</p>
      <span class="coming-soon-tag">Coming next</span>
    </div>
  `;
}

// ── Helpers ───────────────────────────────────────────────────
function _capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// ── SVG Icons ─────────────────────────────────────────────────
function iconHome() {
  return `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
    <polyline points="9 22 9 12 15 12 15 22"/>
  </svg>`;
}

function iconBox() {
  return `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
    <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
    <line x1="12" y1="22.08" x2="12" y2="12"/>
  </svg>`;
}

function iconStock() {
  return `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <line x1="18" y1="20" x2="18" y2="10"/>
    <line x1="12" y1="20" x2="12" y2="4"/>
    <line x1="6"  y1="20" x2="6"  y2="14"/>
  </svg>`;
}

function iconOrders() {
  return `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <polyline points="14 2 14 8 20 8"/>
    <line x1="16" y1="13" x2="8" y2="13"/>
    <line x1="16" y1="17" x2="8" y2="17"/>
    <polyline points="10 9 9 9 8 9"/>
  </svg>`;
}

function iconInvoice() {
  return `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
    <line x1="8"  y1="21" x2="16" y2="21"/>
    <line x1="12" y1="17" x2="12" y2="21"/>
  </svg>`;
}

function iconMarket() {
  return `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/>
    <line x1="3" y1="6" x2="21" y2="6"/>
    <path d="M16 10a4 4 0 0 1-8 0"/>
  </svg>`;
     }

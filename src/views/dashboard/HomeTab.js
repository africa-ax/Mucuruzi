// ============================================================
// HomeTab.js — Dashboard Home Tab
// Role-specific stats cards with live Firestore counts
// ============================================================

import { db } from "/src/config/firebase.js";
import {
  collection,
  query,
  where,
  getCountFromServer,
  onSnapshot,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ── Render Home Tab ───────────────────────────────────────────
export function renderHomeTab(container, profile, badgeCounts = {}) {
  const greeting = _greeting();
  const displayName = profile.businessName || profile.name || "there";

  container.innerHTML = `
    <div class="home-tab">

      <!-- Greeting -->
      <div class="home-greeting">
        <div>
          <p class="home-greeting-time">${greeting}</p>
          <h2 class="home-greeting-name">${displayName}</h2>
        </div>
        <div class="home-greeting-avatar">
          ${(displayName).charAt(0).toUpperCase()}
        </div>
      </div>

      <!-- Stats Cards Grid -->
      <div class="stats-grid" id="stats-grid">
        ${_skeletonCards(4)}
      </div>

      <!-- Recent Activity -->
      <div class="home-section">
        <h3 class="home-section-title">Recent Orders</h3>
        <div id="recent-orders">
          ${_skeletonList(3)}
        </div>
      </div>

    </div>
  `;

  // Load real data
  _loadStats(profile, badgeCounts);
  _loadRecentOrders(profile);
}

// ── Load Stats Cards ──────────────────────────────────────────
async function _loadStats(profile, badgeCounts) {
  const grid = document.getElementById("stats-grid");
  if (!grid) return;

  const uid = profile.uid;
  const role = profile.role;

  try {
    // Build card configs per role
    let cards = [];

    if (role === "manufacturer") {
      const [stockCount, pendingOrders, totalOrders, invoicesCount] =
        await Promise.all([
          _count("stock", [where("ownerId", "==", uid)]),
          _count("orders", [where("sellerId", "==", uid), where("status", "==", "pending")]),
          _count("orders", [where("sellerId", "==", uid)]),
          _count("invoices", [where("sellerId", "==", uid)]),
        ]);

      cards = [
        {
          id: "stock",
          label: "Stock Items",
          value: stockCount,
          icon: iconStock(),
          color: "blue",
          badge: 0,
        },
        {
          id: "pending-orders",
          label: "Pending Orders",
          value: pendingOrders,
          icon: iconPending(),
          color: pendingOrders > 0 ? "orange" : "gray",
          badge: pendingOrders,
        },
        {
          id: "total-orders",
          label: "Total Orders",
          value: totalOrders,
          icon: iconOrders(),
          color: "blue",
          badge: 0,
        },
        {
          id: "invoices",
          label: "Invoices",
          value: invoicesCount,
          icon: iconInvoice(),
          color: "green",
          badge: 0,
        },
      ];
    }

    else if (role === "distributor") {
      const [stockCount, pendingOrders, totalOrders, invoicesCount] =
        await Promise.all([
          _count("stock", [where("ownerId", "==", uid)]),
          _count("orders", [where("sellerId", "==", uid), where("status", "==", "pending")]),
          _count("orders", [where("buyerId", "==", uid)]),
          _count("invoices", [where("buyerId", "==", uid)]),
        ]);

      cards = [
        {
          id: "inventory",
          label: "Inventory Items",
          value: stockCount,
          icon: iconStock(),
          color: "blue",
          badge: 0,
        },
        {
          id: "pending-orders",
          label: "Pending Orders",
          value: pendingOrders,
          icon: iconPending(),
          color: pendingOrders > 0 ? "orange" : "gray",
          badge: pendingOrders,
        },
        {
          id: "purchases",
          label: "My Purchases",
          value: totalOrders,
          icon: iconOrders(),
          color: "blue",
          badge: 0,
        },
        {
          id: "invoices",
          label: "Invoices",
          value: invoicesCount,
          icon: iconInvoice(),
          color: "green",
          badge: 0,
        },
      ];
    }

    else if (role === "retailer") {
      const [stockCount, pendingOrders, totalOrders, invoicesCount] =
        await Promise.all([
          _count("stock", [where("ownerId", "==", uid)]),
          _count("orders", [where("sellerId", "==", uid), where("status", "==", "pending")]),
          _count("orders", [where("buyerId", "==", uid)]),
          _count("invoices", [where("buyerId", "==", uid)]),
        ]);

      cards = [
        {
          id: "inventory",
          label: "Inventory Items",
          value: stockCount,
          icon: iconStock(),
          color: "blue",
          badge: 0,
        },
        {
          id: "pending-orders",
          label: "Pending Orders",
          value: pendingOrders,
          icon: iconPending(),
          color: pendingOrders > 0 ? "orange" : "gray",
          badge: pendingOrders,
        },
        {
          id: "purchases",
          label: "My Purchases",
          value: totalOrders,
          icon: iconOrders(),
          color: "blue",
          badge: 0,
        },
        {
          id: "invoices",
          label: "Invoices",
          value: invoicesCount,
          icon: iconInvoice(),
          color: "green",
          badge: 0,
        },
      ];
    }

    else if (role === "buyer") {
      const [pendingOrders, totalOrders, invoicesCount] =
        await Promise.all([
          _count("orders", [where("buyerId", "==", uid), where("status", "==", "pending")]),
          _count("orders", [where("buyerId", "==", uid)]),
          _count("invoices", [where("buyerId", "==", uid)]),
        ]);

      cards = [
        {
          id: "pending-orders",
          label: "Pending Orders",
          value: pendingOrders,
          icon: iconPending(),
          color: pendingOrders > 0 ? "orange" : "gray",
          badge: pendingOrders,
        },
        {
          id: "my-orders",
          label: "My Orders",
          value: totalOrders,
          icon: iconOrders(),
          color: "blue",
          badge: 0,
        },
        {
          id: "invoices",
          label: "Invoices",
          value: invoicesCount,
          icon: iconInvoice(),
          color: "green",
          badge: 0,
        },
      ];
    }

    // Render cards
    if (grid) {
      grid.innerHTML = cards.map((card) => _cardHTML(card)).join("");
    }

  } catch (err) {
    console.error("[HomeTab] Failed to load stats:", err);
    if (grid) {
      grid.innerHTML = `<p class="stats-error">Could not load stats. Check your connection.</p>`;
    }
  }
}

// ── Load Recent Orders ────────────────────────────────────────
async function _loadRecentOrders(profile) {
  const container = document.getElementById("recent-orders");
  if (!container) return;

  const uid = profile.uid;

  try {
    const { getDocs, query, collection, where, orderBy, limit } =
      await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");

    // Sellers see incoming orders, buyers see their own orders
    const isSeller = ["manufacturer", "distributor", "retailer"].includes(profile.role);
    const field = isSeller ? "sellerId" : "buyerId";

    const q = query(
      collection(db, "orders"),
      where(field, "==", uid),
      orderBy("createdAt", "desc"),
      limit(5)
    );

    const snap = await getDocs(q);

    if (snap.empty) {
      container.innerHTML = `
        <div class="empty-state">
          <p>No orders yet.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = snap.docs.map((doc) => {
      const o = doc.data();
      return `
        <div class="order-row">
          <div class="order-row-left">
            <span class="order-row-id">#${doc.id.slice(-6).toUpperCase()}</span>
            <span class="order-row-date">${_formatDate(o.createdAt)}</span>
          </div>
          <div class="order-row-right">
            <span class="order-status order-status--${o.status}">${_capitalize(o.status)}</span>
            <span class="order-row-total">RWF ${_fmt(o.total)}</span>
          </div>
        </div>
      `;
    }).join("");

  } catch (err) {
    console.error("[HomeTab] Failed to load recent orders:", err);
    container.innerHTML = `<div class="empty-state"><p>Could not load orders.</p></div>`;
  }
}

// ── Card HTML ─────────────────────────────────────────────────
function _cardHTML(card) {
  return `
    <div class="stat-card stat-card--${card.color}">
      <div class="stat-card-top">
        <span class="stat-card-icon">${card.icon}</span>
        ${card.badge > 0
          ? `<span class="stat-card-badge">${card.badge > 99 ? "99+" : card.badge}</span>`
          : ""}
      </div>
      <div class="stat-card-value">${card.value}</div>
      <div class="stat-card-label">${card.label}</div>
    </div>
  `;
}

// ── Firestore Count Helper ────────────────────────────────────
async function _count(collectionName, conditions = []) {
  try {
    const ref = collection(db, collectionName);
    const q = query(ref, ...conditions);
    const snap = await getCountFromServer(q);
    return snap.data().count;
  } catch {
    return 0;
  }
}

// ── Skeleton Loaders ──────────────────────────────────────────
function _skeletonCards(n) {
  return Array(n).fill(`
    <div class="stat-card stat-card--skeleton">
      <div class="skeleton skeleton-icon"></div>
      <div class="skeleton skeleton-value"></div>
      <div class="skeleton skeleton-label"></div>
    </div>
  `).join("");
}

function _skeletonList(n) {
  return Array(n).fill(`
    <div class="order-row order-row--skeleton">
      <div class="skeleton" style="width:40%;height:14px;border-radius:6px;"></div>
      <div class="skeleton" style="width:25%;height:14px;border-radius:6px;"></div>
    </div>
  `).join("");
}

// ── Helpers ───────────────────────────────────────────────────
function _greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function _capitalize(str) {
  if (!str) return "";
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function _fmt(n) {
  if (!n && n !== 0) return "—";
  return Number(n).toLocaleString("en-RW");
}

function _formatDate(ts) {
  if (!ts) return "—";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString("en-RW", { day: "numeric", month: "short" });
}

// ── Icons ─────────────────────────────────────────────────────
function iconStock() {
  return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <line x1="18" y1="20" x2="18" y2="10"/>
    <line x1="12" y1="20" x2="12" y2="4"/>
    <line x1="6"  y1="20" x2="6"  y2="14"/>
  </svg>`;
}

function iconPending() {
  return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <circle cx="12" cy="12" r="10"/>
    <polyline points="12 6 12 12 16 14"/>
  </svg>`;
}

function iconOrders() {
  return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <polyline points="14 2 14 8 20 8"/>
    <line x1="16" y1="13" x2="8" y2="13"/>
    <line x1="16" y1="17" x2="8" y2="17"/>
  </svg>`;
}

function iconInvoice() {
  return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
    <line x1="8"  y1="21" x2="16" y2="21"/>
    <line x1="12" y1="17" x2="12" y2="21"/>
  </svg>`;
  }

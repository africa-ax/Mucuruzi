// ============================================================
// MarketplaceTab.js — Mucuruzi Marketplace
// Shared by ALL roles including Manufacturer (Buy Raw Materials)
// Features: category filter + search + cart + checkout
// ============================================================

import { db }                    from "/src/config/firebase.js";
import { getStockByOwner }       from "/src/models/Stock.js";
import { getProductById }        from "/src/models/Product.js";
import { createOrdersFromCart }  from "/src/models/Order.js";
import { formatRWF, parsePrice } from "/src/utils/VAT.js";
import { RRA_CATEGORIES }        from "/src/rra/RRA_sandbox.js";
import {
  collection,
  getDocs,
  query,
  where,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ── Session Cart (persists while app is open) ─────────────────
// Key: sellerId_productId → cart item
const _cart = new Map();

// ── State ─────────────────────────────────────────────────────
let _profile        = null;
let _allListings    = []; // { stock, product, seller }
let _filtered       = [];
let _activeCategory = "All";
let _searchQuery    = "";

// ── Render Marketplace Tab ────────────────────────────────────
export async function renderMarketplaceTab(container, profile) {
  _profile = profile;

  container.innerHTML = `
    <div class="market-tab">

      <!-- Search + Filter Bar -->
      <div class="market-search-bar">
        <div class="market-search-wrap">
          <span class="market-search-icon">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" stroke-width="2">
              <circle cx="11" cy="11" r="8"/>
              <line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
          </span>
          <input
            type="text"
            id="market-search"
            class="market-search-input"
            placeholder="Search products…"
            autocomplete="off"
          />
          <button class="market-search-clear hidden" id="market-search-clear">✕</button>
        </div>
      </div>

      <!-- Category Pills -->
      <div class="market-categories" id="market-categories">
        <button class="cat-pill cat-pill--active" data-cat="All">All</button>
        ${RRA_CATEGORIES.map(cat => `
          <button class="cat-pill" data-cat="${cat}">${cat}</button>
        `).join("")}
      </div>

      <!-- Listings -->
      <div id="market-listings">
        <div class="market-loading">
          <div class="mini-spinner"></div>
          <span>Loading marketplace…</span>
        </div>
      </div>

    </div>

    <!-- Floating Cart Button -->
    <button class="cart-fab ${_cart.size > 0 ? "" : "hidden"}" id="cart-fab">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" stroke-width="2">
        <circle cx="9" cy="21" r="1"/>
        <circle cx="20" cy="21" r="1"/>
        <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
      </svg>
      <span class="cart-fab-count" id="cart-fab-count">${_cart.size}</span>
    </button>
  `;

  // Bind search
  const searchInput = document.getElementById("market-search");
  const clearBtn    = document.getElementById("market-search-clear");

  searchInput.addEventListener("input", (e) => {
    _searchQuery = e.target.value.trim();
    clearBtn.classList.toggle("hidden", _searchQuery.length === 0);
    _applyFilters();
  });

  clearBtn.addEventListener("click", () => {
    searchInput.value = "";
    _searchQuery      = "";
    clearBtn.classList.add("hidden");
    _applyFilters();
  });

  // Bind category pills
  document.getElementById("market-categories").addEventListener("click", (e) => {
    const pill = e.target.closest(".cat-pill");
    if (!pill) return;
    _activeCategory = pill.dataset.cat;
    document.querySelectorAll(".cat-pill").forEach(p => {
      p.classList.toggle("cat-pill--active", p.dataset.cat === _activeCategory);
    });
    _applyFilters();
  });

  // Bind cart FAB
  document.getElementById("cart-fab").addEventListener("click", _showCart);

  // Load all listings
  await _loadListings();
}

// ── Load All Listings ─────────────────────────────────────────
async function _loadListings() {
  const listingsEl = document.getElementById("market-listings");
  if (!listingsEl) return;

  try {
    // Get all active users who are sellers (not buyer)
    const usersSnap = await getDocs(
      query(
        collection(db, "users"),
        where("status", "==", "active")
      )
    );

    const sellers = usersSnap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(u => u.uid !== _profile.uid && u.role !== "buyer");

    // For each seller get their inventory stock
    const listings = [];

    await Promise.all(sellers.map(async (seller) => {
      const sellerId   = seller.uid || seller.id;
      const stockItems = await getStockByOwner(sellerId, "inventory");

      await Promise.all(stockItems.map(async (stock) => {
        if (stock.quantity <= 0) return;
        if (!stock.sellingPrice || stock.sellingPrice <= 0) return; // Skip unpriced

        const product = await getProductById(stock.productId);
        if (!product) return;

        listings.push({ stock, product, seller });
      }));
    }));

    _allListings = listings;
    _filtered    = listings;
    _renderListings(listings);

  } catch (err) {
    console.error("[Marketplace] loadListings error:", err);
    if (listingsEl) {
      listingsEl.innerHTML = `
        <div class="market-empty">
          <div class="market-empty-icon">⚠️</div>
          <p>Failed to load marketplace. Check your connection.</p>
        </div>
      `;
    }
  }
}

// ── Apply Filters ─────────────────────────────────────────────
function _applyFilters() {
  let results = _allListings;

  // Category filter
  if (_activeCategory !== "All") {
    results = results.filter(l => l.product.category === _activeCategory);
  }

  // Search filter
  if (_searchQuery.length >= 2) {
    const q = _searchQuery.toLowerCase();
    results = results.filter(l =>
      l.product.brandName.toLowerCase().includes(q) ||
      l.product.description.toLowerCase().includes(q) ||
      l.product.itemCode.includes(q)
    );
  }

  _filtered = results;
  _renderListings(results);
}

// ── Render Listings ───────────────────────────────────────────
function _renderListings(listings) {
  const el = document.getElementById("market-listings");
  if (!el) return;

  if (listings.length === 0) {
    el.innerHTML = `
      <div class="market-empty">
        <div class="market-empty-icon">🛒</div>
        <h3>No products found</h3>
        <p>Try a different search or category.</p>
      </div>
    `;
    return;
  }

  el.innerHTML = `
    <div class="market-grid">
      ${listings.map(({ stock, product, seller }) => {
        const sellerId  = seller.uid || seller.id;
        const cartKey   = `${sellerId}_${stock.productId}`;
        const inCart    = _cart.has(cartKey);
        const cartItem  = _cart.get(cartKey);
        const isLow     = stock.quantity <= 10;

        return `
          <div class="market-card">

            <div class="market-card-header">
              <div>
                <h3 class="market-card-name">${product.brandName}</h3>
                <p class="market-card-desc">${product.description}</p>
              </div>
              <span class="market-vat-badge market-vat-badge--${product.taxGrade}">
                Grade ${product.taxGrade} · ${product.vatRate}%
              </span>
            </div>

            <div class="market-card-meta">
              <span class="market-item-code">${product.itemCode}</span>
              <span class="market-category">${product.category}</span>
            </div>

            <div class="market-card-footer">
              <div class="market-price-wrap">
                <span class="market-price">${formatRWF(stock.sellingPrice)}</span>
                <span class="market-unit">per ${product.unit}</span>
              </div>
              <div class="market-stock-wrap">
                <span class="market-avail ${isLow ? "market-avail--low" : ""}">
                  ${isLow ? "⚠️ " : ""}${stock.quantity} ${product.unit} left
                </span>
              </div>
            </div>

            ${inCart ? `
              <div class="market-in-cart">
                <span>✓ In cart (${cartItem.quantity} ${product.unit})</span>
                <button class="btn-remove-cart"
                  data-key="${cartKey}">
                  Remove
                </button>
              </div>
            ` : `
              <button class="btn-add-cart"
                data-sellerid="${sellerId}"
                data-productid="${stock.productId}"
                data-maxqty="${stock.quantity}"
                data-price="${stock.sellingPrice}"
                data-name="${product.brandName}"
                data-itemcode="${product.itemCode}"
                data-vatrate="${product.vatRate}"
                data-unit="${product.unit}">
                Add to Cart
              </button>
            `}

          </div>
        `;
      }).join("")}
    </div>
  `;

  // Bind add to cart buttons
  el.querySelectorAll(".btn-add-cart").forEach(btn => {
    btn.addEventListener("click", () => _showAddToCartModal(btn.dataset));
  });

  // Bind remove from cart buttons
  el.querySelectorAll(".btn-remove-cart").forEach(btn => {
    btn.addEventListener("click", () => {
      _cart.delete(btn.dataset.key);
      _updateCartFab();
      _renderListings(_filtered);
    });
  });
}

// ── Add to Cart Modal ─────────────────────────────────────────
function _showAddToCartModal(data) {
  const existing = document.getElementById("cart-modal");
  if (existing) existing.remove();

  const maxQty = parseInt(data.maxqty || 1);

  const modal = document.createElement("div");
  modal.id    = "cart-modal";
  modal.className = "modal-overlay";
  modal.innerHTML = `
    <div class="modal-box">
      <div class="modal-header">
        <h3>${data.name}</h3>
        <button class="modal-close" id="close-cart-modal">✕</button>
      </div>
      <p class="modal-sub">${formatRWF(parseFloat(data.price))} per ${data.unit}</p>
      <p class="modal-avail">Available: <strong>${maxQty} ${data.unit}</strong></p>

      <div class="modal-form-group">
        <label>Quantity</label>
        <div class="modal-qty-wrap">
          <button class="qty-btn" id="qty-minus">−</button>
          <input
            type="number"
            id="cart-qty"
            class="qty-input"
            value="1"
            min="1"
            max="${maxQty}"
          />
          <button class="qty-btn" id="qty-plus">+</button>
        </div>
        <p class="qty-max-hint">Max: ${maxQty} ${data.unit}</p>
      </div>

      <div class="modal-total-row">
        <span>Total</span>
        <span id="modal-total">${formatRWF(parseFloat(data.price))}</span>
      </div>

      <div id="cart-modal-error" class="alert alert--error hidden"></div>

      <div class="modal-actions">
        <button class="btn-outline-sm" id="cancel-cart-modal">Cancel</button>
        <button class="btn-primary-sm" id="confirm-add-cart">Add to Cart</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  const qtyInput  = document.getElementById("cart-qty");
  const totalEl   = document.getElementById("modal-total");
  const price     = parseFloat(data.price);

  const updateTotal = () => {
    const qty = parseInt(qtyInput.value) || 1;
    totalEl.textContent = formatRWF(parsePrice(price * qty));
  };

  document.getElementById("qty-minus").addEventListener("click", () => {
    const v = parseInt(qtyInput.value) || 1;
    if (v > 1) { qtyInput.value = v - 1; updateTotal(); }
  });

  document.getElementById("qty-plus").addEventListener("click", () => {
    const v = parseInt(qtyInput.value) || 1;
    if (v < maxQty) { qtyInput.value = v + 1; updateTotal(); }
  });

  qtyInput.addEventListener("input", updateTotal);

  document.getElementById("close-cart-modal").addEventListener("click",  () => modal.remove());
  document.getElementById("cancel-cart-modal").addEventListener("click", () => modal.remove());

  document.getElementById("confirm-add-cart").addEventListener("click", () => {
    const qty     = parseInt(qtyInput.value) || 0;
    const errorEl = document.getElementById("cart-modal-error");

    if (qty <= 0) {
      errorEl.textContent = "Please enter a valid quantity.";
      errorEl.classList.remove("hidden");
      return;
    }

    if (qty > maxQty) {
      errorEl.textContent = `Maximum available is ${maxQty} ${data.unit}.`;
      errorEl.classList.remove("hidden");
      return;
    }

    // Add to cart
    const cartKey = `${data.sellerid}_${data.productid}`;
    _cart.set(cartKey, {
      sellerId:    data.sellerid,
      productId:   data.productid,
      productName: data.name,
      itemCode:    data.itemcode,
      quantity:    qty,
      unitPrice:   price,
      vatRate:     parseFloat(data.vatrate) || 0,
      unit:        data.unit,
    });

    modal.remove();
    _updateCartFab();
    _renderListings(_filtered);
  });
}

// ── Show Cart ─────────────────────────────────────────────────
function _showCart() {
  const existing = document.getElementById("cart-drawer");
  if (existing) existing.remove();

  if (_cart.size === 0) return;

  const items   = Array.from(_cart.values());
  let grandTotal = 0;
  items.forEach(i => { grandTotal += parsePrice(i.unitPrice * i.quantity); });

  const drawer = document.createElement("div");
  drawer.id    = "cart-drawer";
  drawer.className = "cart-drawer-overlay";
  drawer.innerHTML = `
    <div class="cart-drawer">
      <div class="cart-drawer-header">
        <h3>My Cart (${items.length} item${items.length > 1 ? "s" : ""})</h3>
        <button class="modal-close" id="close-cart-drawer">✕</button>
      </div>

      <div class="cart-items">
        ${items.map((item, i) => `
          <div class="cart-item">
            <div class="cart-item-info">
              <span class="cart-item-name">${item.productName}</span>
              <span class="cart-item-qty">${item.quantity} ${item.unit} × ${formatRWF(item.unitPrice)}</span>
            </div>
            <div class="cart-item-right">
              <span class="cart-item-total">
                ${formatRWF(parsePrice(item.unitPrice * item.quantity))}
              </span>
              <button class="cart-remove-btn"
                data-key="${item.sellerId}_${item.productId}">✕</button>
            </div>
          </div>
        `).join("")}
      </div>

      <div class="cart-grand-total">
        <span>Grand Total</span>
        <span>${formatRWF(grandTotal)}</span>
      </div>

      <!-- Purchase Code -->
      <div class="cart-purchase-code">
        <label for="purchase-code">RRA Purchase Code</label>
        <p class="purchase-code-hint">Dial *800# to get your purchase code</p>
        <input
          type="text"
          id="purchase-code"
          class="purchase-code-input"
          placeholder="Enter 5–6 digit code"
          maxlength="6"
          inputmode="numeric"
        />
      </div>

      <div id="cart-checkout-error" class="alert alert--error hidden"></div>

      <div class="cart-actions">
        <button class="btn-outline-sm" id="btn-continue-shopping">
          Continue Shopping
        </button>
        <button class="btn-primary-sm" id="btn-place-orders">
          <span id="place-orders-text">Place Orders</span>
          <span id="place-orders-spinner" class="btn-spinner hidden"></span>
        </button>
      </div>

    </div>
  `;

  document.body.appendChild(drawer);

  document.getElementById("close-cart-drawer").addEventListener("click",       () => drawer.remove());
  document.getElementById("btn-continue-shopping").addEventListener("click",   () => drawer.remove());

  // Remove item from cart
  drawer.querySelectorAll(".cart-remove-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      _cart.delete(btn.dataset.key);
      _updateCartFab();
      drawer.remove();
      _renderListings(_filtered);
      if (_cart.size > 0) setTimeout(_showCart, 100);
    });
  });

  // Place orders
  document.getElementById("btn-place-orders").addEventListener("click", async () => {
    await _handleCheckout(drawer);
  });
}

// ── Handle Checkout ───────────────────────────────────────────
async function _handleCheckout(drawer) {
  const purchaseCode = document.getElementById("purchase-code")?.value.trim();
  const errorEl      = document.getElementById("cart-checkout-error");
  const btnText      = document.getElementById("place-orders-text");
  const btnSpinner   = document.getElementById("place-orders-spinner");
  const btn          = document.getElementById("btn-place-orders");

  if (errorEl) errorEl.classList.add("hidden");

  if (!purchaseCode || !/^\d{5,6}$/.test(purchaseCode)) {
    if (errorEl) {
      errorEl.textContent = "Please enter your 5–6 digit RRA purchase code.";
      errorEl.classList.remove("hidden");
    }
    return;
  }

  // Set loading
  if (btn)     btn.disabled       = true;
  if (btnText) btnText.textContent = "Placing orders…";
  if (btnSpinner) btnSpinner.classList.remove("hidden");

  const cartItems = Array.from(_cart.values());

  const result = await createOrdersFromCart({
    buyer: _profile,
    cartItems,
    purchaseCode,
  });

  if (btn)     btn.disabled       = false;
  if (btnText) btnText.textContent = "Place Orders";
  if (btnSpinner) btnSpinner.classList.add("hidden");

  if (result.success) {
    // Clear cart
    _cart.clear();
    _updateCartFab();
    drawer.remove();
    _renderListings(_filtered);
    _showSuccessToast(`${result.orderIds.length} order${result.orderIds.length > 1 ? "s" : ""} placed successfully!`);
  } else {
    const msg = result.errors?.[0]?.error || "Failed to place orders. Try again.";
    if (errorEl) {
      errorEl.textContent = msg;
      errorEl.classList.remove("hidden");
    }
  }
}

// ── Update Cart FAB ───────────────────────────────────────────
function _updateCartFab() {
  const fab       = document.getElementById("cart-fab");
  const fabCount  = document.getElementById("cart-fab-count");
  if (!fab) return;

  const count = _cart.size;
  if (count > 0) {
    fab.classList.remove("hidden");
    if (fabCount) fabCount.textContent = count;
  } else {
    fab.classList.add("hidden");
  }
}

// ── Success Toast ─────────────────────────────────────────────
function _showSuccessToast(msg) {
  const existing = document.querySelector(".market-toast");
  if (existing) existing.remove();

  const toast = document.createElement("div");
  toast.className = "market-toast market-toast--success";
  toast.textContent = msg;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}

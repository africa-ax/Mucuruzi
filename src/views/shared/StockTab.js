// ============================================================
// StockTab.js — Mucuruzi Stock Tab
// Manufacturer: Finished Goods + Raw Materials toggle
// Distributor / Retailer: Inventory only
// Rules:
//   - Low stock warning at <= 10 units
//   - Quantity 0 = document deleted (disappears)
//   - Every role can update their own selling price
//   - New product shows "Set Price" if no price yet
// ============================================================

import { db }                    from "/src/config/firebase.js";
import { getStockByOwner }       from "/src/models/Stock.js";
import { getProductById }        from "/src/models/Product.js";
import { formatRWF, parsePrice } from "/src/utils/VAT.js";
import {
  doc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ── State ─────────────────────────────────────────────────────
let _profile       = null;
let _activeSection = "inventory"; // "inventory" | "rawMaterial"

// ── Render Stock Tab ──────────────────────────────────────────
export async function renderStockTab(container, profile) {
  _profile = profile;

  const isManufacturer = profile.role === "manufacturer";

  container.innerHTML = `
    <div class="stock-tab">

      ${isManufacturer ? `
        <!-- Manufacturer toggle -->
        <div class="section-toggle">
          <button class="toggle-btn toggle-btn--active" id="btn-finished">
            Finished Goods
          </button>
          <button class="toggle-btn" id="btn-raw">
            Raw Materials
          </button>
        </div>
      ` : ""}

      <!-- Stock List -->
      <div id="stock-list-container">
        <div class="stock-loading">
          <div class="mini-spinner"></div>
          <span>Loading stock…</span>
        </div>
      </div>

    </div>
  `;

  if (isManufacturer) {
    document.getElementById("btn-finished").addEventListener("click", () => {
      _activeSection = "inventory";
      _updateToggle("btn-finished", "btn-raw");
      _loadStock("inventory");
    });

    document.getElementById("btn-raw").addEventListener("click", () => {
      _activeSection = "rawMaterial";
      _updateToggle("btn-raw", "btn-finished");
      _loadStock("rawMaterial");
    });

    await _loadStock("inventory");
  } else {
    await _loadStock("inventory");
  }
}

// ── Toggle Helper ─────────────────────────────────────────────
function _updateToggle(activeId, inactiveId) {
  document.getElementById(activeId)?.classList.add("toggle-btn--active");
  document.getElementById(inactiveId)?.classList.remove("toggle-btn--active");
}

// ── Load Stock ────────────────────────────────────────────────
async function _loadStock(stockType) {
  const container = document.getElementById("stock-list-container");
  if (!container) return;

  container.innerHTML = `
    <div class="stock-loading">
      <div class="mini-spinner"></div>
      <span>Loading ${stockType === "rawMaterial" ? "raw materials" : "stock"}…</span>
    </div>
  `;

  try {
    const stockItems = await getStockByOwner(_profile.uid, stockType);

    // Filter out zero-quantity items (should be deleted but safety check)
    const activeItems = stockItems.filter(s => s.quantity > 0);

    if (activeItems.length === 0) {
      container.innerHTML = `
        <div class="stock-empty">
          <div class="stock-empty-icon">📦</div>
          <h3>No ${stockType === "rawMaterial" ? "raw materials" : "stock"} yet</h3>
          <p>${
            stockType === "rawMaterial"
              ? "Buy raw materials from the Products tab."
              : _profile.role === "manufacturer"
                ? "Create products from the Products tab."
                : "Purchase products from the Marketplace."
          }</p>
        </div>
      `;
      return;
    }

    // Fetch product details for each stock item
    const enriched = await Promise.all(
      activeItems.map(async (stock) => {
        const product = await getProductById(stock.productId);
        return { stock, product };
      })
    );

    // Filter out items where product couldn't be fetched
    const valid = enriched.filter(({ product }) => product !== null);

    container.innerHTML = `
      <div class="stock-grid">
        ${valid.map(({ stock, product }) => _stockCardHTML(stock, product)).join("")}
      </div>
    `;

    // Bind all card interactions
    _bindCardEvents(valid);

  } catch (err) {
    console.error("[StockTab] loadStock error:", err);
    container.innerHTML = `
      <div class="stock-empty">
        <div class="stock-empty-icon">⚠️</div>
        <h3>Failed to load</h3>
        <p>Check your connection and try again.</p>
      </div>
    `;
  }
}

// ── Stock Card HTML ───────────────────────────────────────────
function _stockCardHTML(stock, product) {
  const isLowStock    = stock.quantity <= 10;
  const hasPrice      = stock.sellingPrice > 0;
  const stockId       = stock.stockId || stock.id;

  return `
    <div class="stock-card ${isLowStock ? "stock-card--low" : ""}" 
         id="scard-${stockId}">

      <!-- Card Header -->
      <div class="stock-card-header">
        <div class="stock-card-title-wrap">
          <h3 class="stock-card-name">${product.brandName}</h3>
          <span class="stock-vat-badge stock-vat-badge--${product.taxGrade}">
            Grade ${product.taxGrade} · ${product.vatRate}% VAT
          </span>
        </div>
        ${isLowStock ? `
          <span class="low-stock-badge">
            ⚠️ Low
          </span>
        ` : ""}
      </div>

      <!-- RRA Info -->
      <div class="stock-card-rra">
        <span class="stock-rra-code">${product.itemCode}</span>
        <span class="stock-rra-desc">${product.description}</span>
      </div>

      <!-- Stats Row -->
      <div class="stock-stats-row">
        <div class="stock-stat">
          <span class="stock-stat-label">Quantity</span>
          <span class="stock-stat-value ${isLowStock ? "stock-stat-value--low" : ""}">
            ${stock.quantity} ${product.unit}
          </span>
        </div>
        <div class="stock-stat">
          <span class="stock-stat-label">Category</span>
          <span class="stock-stat-value">${product.category}</span>
        </div>
      </div>

      <!-- Price Section -->
      <div class="stock-price-section" id="price-section-${stockId}">
        ${_priceSectionHTML(stockId, stock.sellingPrice, hasPrice)}
      </div>

    </div>
  `;
}

// ── Price Section HTML ────────────────────────────────────────
function _priceSectionHTML(stockId, sellingPrice, hasPrice) {
  if (!hasPrice) {
    return `
      <div class="stock-price-row">
        <span class="stock-no-price">No price set</span>
        <button class="btn-set-price" data-stockid="${stockId}">
          Set Price
        </button>
      </div>
    `;
  }

  return `
    <div class="stock-price-row">
      <div class="stock-price-display">
        <span class="stock-price-label">Selling Price</span>
        <span class="stock-price-value">${formatRWF(sellingPrice)}</span>
      </div>
      <button class="btn-edit-price" data-stockid="${stockId}">
        Edit Price
      </button>
    </div>
  `;
}

// ── Bind Card Events ──────────────────────────────────────────
function _bindCardEvents(items) {
  // Build a map for quick lookup
  const itemMap = {};
  items.forEach(({ stock, product }) => {
    const id = stock.stockId || stock.id;
    itemMap[id] = { stock, product };
  });

  // Set Price buttons
  document.querySelectorAll(".btn-set-price, .btn-edit-price").forEach(btn => {
    btn.addEventListener("click", () => {
      const stockId = btn.dataset.stockid;
      const item    = itemMap[stockId];
      if (item) _showPriceEditor(stockId, item.stock, item.product);
    });
  });
}

// ── Show Price Editor ─────────────────────────────────────────
function _showPriceEditor(stockId, stock, product) {
  const section = document.getElementById(`price-section-${stockId}`);
  if (!section) return;

  const currentPrice = stock.sellingPrice || 0;

  section.innerHTML = `
    <div class="price-editor">
      <div class="price-editor-input-wrap">
        <span class="price-editor-currency">RWF</span>
        <input
          type="number"
          id="price-input-${stockId}"
          class="price-editor-input"
          value="${currentPrice > 0 ? currentPrice : ""}"
          placeholder="Enter price"
          min="0"
          step="0.01"
          autofocus
        />
      </div>
      <div class="price-editor-actions">
        <button class="btn-price-cancel" data-stockid="${stockId}">
          Cancel
        </button>
        <button class="btn-price-save" data-stockid="${stockId}">
          Save
        </button>
      </div>
      <div id="price-error-${stockId}" class="price-error hidden"></div>
    </div>
  `;

  // Focus input
  setTimeout(() => {
    document.getElementById(`price-input-${stockId}`)?.focus();
  }, 50);

  // Cancel
  section.querySelector(".btn-price-cancel").addEventListener("click", () => {
    section.innerHTML = _priceSectionHTML(stockId, stock.sellingPrice, stock.sellingPrice > 0);
    _rebindPriceButton(stockId, stock, product);
  });

  // Save
  section.querySelector(".btn-price-save").addEventListener("click", async () => {
    await _savePrice(stockId, stock, product);
  });

  // Enter key
  document.getElementById(`price-input-${stockId}`)?.addEventListener("keydown", async (e) => {
    if (e.key === "Enter") await _savePrice(stockId, stock, product);
    if (e.key === "Escape") {
      section.innerHTML = _priceSectionHTML(stockId, stock.sellingPrice, stock.sellingPrice > 0);
      _rebindPriceButton(stockId, stock, product);
    }
  });
}

// ── Save Price ────────────────────────────────────────────────
async function _savePrice(stockId, stock, product) {
  const input    = document.getElementById(`price-input-${stockId}`);
  const errorEl  = document.getElementById(`price-error-${stockId}`);
  const saveBtn  = document.querySelector(`.btn-price-save[data-stockid="${stockId}"]`);

  if (!input) return;

  const newPrice = parsePrice(input.value);

  if (newPrice <= 0) {
    if (errorEl) {
      errorEl.textContent = "Price must be greater than 0.";
      errorEl.classList.remove("hidden");
    }
    return;
  }

  if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = "Saving…"; }

  try {
    // Update Firestore
    await updateDoc(doc(db, "stock", stockId), {
      sellingPrice: newPrice,
      updatedAt:    serverTimestamp(),
    });

    // Update local stock object
    stock.sellingPrice = newPrice;

    // Update the card price section
    const section = document.getElementById(`price-section-${stockId}`);
    if (section) {
      section.innerHTML = _priceSectionHTML(stockId, newPrice, true);
      _rebindPriceButton(stockId, stock, product);
    }

    // Flash success on card
    const card = document.getElementById(`scard-${stockId}`);
    if (card) {
      card.classList.add("stock-card--saved");
      setTimeout(() => card.classList.remove("stock-card--saved"), 1500);
    }

  } catch (err) {
    console.error("[StockTab] savePrice error:", err);
    if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = "Save"; }
    if (errorEl) {
      errorEl.textContent = "Failed to save. Try again.";
      errorEl.classList.remove("hidden");
    }
  }
}

// ── Rebind Price Button After Re-render ───────────────────────
function _rebindPriceButton(stockId, stock, product) {
  const btn = document.querySelector(
    `.btn-set-price[data-stockid="${stockId}"], .btn-edit-price[data-stockid="${stockId}"]`
  );
  if (btn) {
    btn.addEventListener("click", () => {
      _showPriceEditor(stockId, stock, product);
    });
  }
  }

// ============================================================
// ProductsTab.js — Manufacturer Products Tab
// Section 1: Create Product (RRA search + add to stock)
// Section 2: Buy Raw Materials (search seller + view stock)
// ============================================================

import { rraAPI }          from "/src/rra/RRA_sandbox.js";
import { createProduct }   from "/src/models/Product.js";
import { getStockByOwner } from "/src/models/Stock.js";
import { formatRWF }       from "/src/utils/VAT.js";
import {
  collection,
  query,
  where,
  getDocs,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { db } from "/src/config/firebase.js";

// Alias: avoids conflict between Firestore query() and _searchSellers(query) parameter
const query_ = query;

// ── State ─────────────────────────────────────────────────────
let _profile         = null;
let _activeSection   = "create"; // "create" | "rawmaterials"
let _selectedRRAItem = null;     // Currently selected RRA item
let _selectedSeller  = null;     // Currently selected seller

// ── Render Products Tab ───────────────────────────────────────
export function renderProductsTab(container, profile) {
  _profile       = profile;
  _activeSection = "create";
  _selectedRRAItem = null;
  _selectedSeller  = null;

  container.innerHTML = `
    <div class="products-tab">

      <!-- Section Toggle -->
      <div class="section-toggle">
        <button class="toggle-btn toggle-btn--active" id="btn-section-create">
          Create Product
        </button>
        <button class="toggle-btn" id="btn-section-raw">
          Buy Raw Materials
        </button>
      </div>

      <!-- Section Content -->
      <div id="section-content"></div>

    </div>
  `;

  // Bind toggle buttons
  document.getElementById("btn-section-create").addEventListener("click", () => {
    _switchSection("create");
  });

  document.getElementById("btn-section-raw").addEventListener("click", () => {
    _switchSection("rawmaterials");
  });

  // Render default section
  _renderCreateSection();
}

// ── Switch Section ────────────────────────────────────────────
function _switchSection(section) {
  _activeSection   = section;
  _selectedRRAItem = null;
  _selectedSeller  = null;

  // Update toggle styles
  document.getElementById("btn-section-create").classList.toggle(
    "toggle-btn--active", section === "create"
  );
  document.getElementById("btn-section-raw").classList.toggle(
    "toggle-btn--active", section === "rawmaterials"
  );

  if (section === "create") {
    _renderCreateSection();
  } else {
    _renderRawMaterialsSection();
  }
}

// ══════════════════════════════════════════════════════════════
// SECTION 1 — CREATE PRODUCT
// ══════════════════════════════════════════════════════════════
function _renderCreateSection() {
  const content = document.getElementById("section-content");
  content.innerHTML = `
    <div class="create-product-section">

      <!-- Step 1: Search RRA Item -->
      <div class="form-card">
        <div class="form-card-title">
          <span class="step-badge">1</span>
          Search RRA Item Code
        </div>

        <div class="search-wrapper">
          <div class="search-input-wrap">
            <span class="search-icon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" stroke-width="2">
                <circle cx="11" cy="11" r="8"/>
                <line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
            </span>
            <input
              type="text"
              id="rra-search"
              class="search-input"
              placeholder="Search by name or code e.g. cement, rice, 50181703"
              autocomplete="off"
            />
            <button class="search-clear hidden" id="search-clear">✕</button>
          </div>

          <!-- Dropdown Results -->
          <div class="search-dropdown hidden" id="search-dropdown"></div>
        </div>

        <!-- Selected Item Display -->
        <div id="selected-item-display" class="hidden"></div>
      </div>

      <!-- Step 2: Product Details (hidden until item selected) -->
      <div class="form-card hidden" id="product-details-card">
        <div class="form-card-title">
          <span class="step-badge">2</span>
          Product Details
        </div>

        <div class="form-group">
          <label for="brand-name">Brand / Product Name</label>
          <input
            type="text"
            id="brand-name"
            class="form-input"
            placeholder="e.g. Kigali Premium Cement"
          />
        </div>

        <div class="form-row-2">
          <div class="form-group">
            <label for="selling-price">Selling Price (RWF)</label>
            <input
              type="number"
              id="selling-price"
              class="form-input"
              placeholder="0"
              min="0"
              step="0.01"
            />
          </div>
          <div class="form-group">
            <label for="quantity">Quantity</label>
            <div class="qty-wrap">
              <input
                type="number"
                id="quantity"
                class="form-input"
                placeholder="0"
                min="1"
                step="1"
              />
              <span class="qty-unit" id="qty-unit">—</span>
            </div>
          </div>
        </div>

        <!-- Error -->
        <div id="create-error" class="alert alert--error hidden"></div>

        <!-- Submit Button -->
        <button class="btn-primary btn-full" id="btn-add-stock">
          <span id="add-stock-text">Add to Stock</span>
          <span id="add-stock-spinner" class="btn-spinner hidden"></span>
        </button>
      </div>

      <!-- Success Message -->
      <div id="create-success" class="hidden"></div>

    </div>
  `;

  _bindCreateSection();
}

function _bindCreateSection() {
  const searchInput = document.getElementById("rra-search");
  const dropdown    = document.getElementById("search-dropdown");
  const clearBtn    = document.getElementById("search-clear");

  let debounceTimer = null;

  // Search input
  searchInput.addEventListener("input", (e) => {
    const val = e.target.value.trim();
    clearBtn.classList.toggle("hidden", val.length === 0);

    clearTimeout(debounceTimer);

    if (val.length < 2) {
      dropdown.classList.add("hidden");
      dropdown.innerHTML = "";
      return;
    }

    debounceTimer = setTimeout(() => {
      _showSearchResults(val);
    }, 250);
  });

  // Clear search
  clearBtn.addEventListener("click", () => {
    searchInput.value  = "";
    _selectedRRAItem   = null;
    clearBtn.classList.add("hidden");
    dropdown.classList.add("hidden");
    dropdown.innerHTML = "";
    document.getElementById("selected-item-display").classList.add("hidden");
    document.getElementById("product-details-card").classList.add("hidden");
  });

  // Close dropdown on outside click
  document.addEventListener("click", (e) => {
    if (!e.target.closest(".search-wrapper")) {
      dropdown.classList.add("hidden");
    }
  });

  // Add to stock button
  document.getElementById("btn-add-stock").addEventListener("click", _handleAddToStock);
}

function _showSearchResults(query) {
  const dropdown = document.getElementById("search-dropdown");
  const results  = rraAPI.searchItems(query);

  if (results.length === 0) {
    dropdown.innerHTML = `
      <div class="dropdown-empty">
        No items found for "<strong>${query}</strong>"
      </div>
    `;
    dropdown.classList.remove("hidden");
    return;
  }

  dropdown.innerHTML = results.map(item => `
    <div class="dropdown-item" data-code="${item.itemCode}">
      <div class="dropdown-item-top">
        <span class="dropdown-item-name">${item.description}</span>
        <span class="dropdown-item-code">${item.itemCode}</span>
      </div>
      <div class="dropdown-item-bottom">
        <span class="dropdown-item-category">${item.category}</span>
        <span class="dropdown-vat-badge dropdown-vat-badge--${item.taxGrade}">
          Grade ${item.taxGrade} · ${item.vatRate}% VAT
        </span>
      </div>
    </div>
  `).join("");

  dropdown.classList.remove("hidden");

  // Bind item selection
  dropdown.querySelectorAll(".dropdown-item").forEach(el => {
    el.addEventListener("click", () => {
      const code = el.dataset.code;
      const item = rraAPI.getItem(code);
      if (item) _selectRRAItem(item);
    });
  });
}

function _selectRRAItem(item) {
  _selectedRRAItem = item;

  // Update search input
  const searchInput = document.getElementById("rra-search");
  searchInput.value = `${item.itemCode} — ${item.description}`;

  // Hide dropdown
  document.getElementById("search-dropdown").classList.add("hidden");

  // Show selected item card
  const display = document.getElementById("selected-item-display");
  display.innerHTML = `
    <div class="selected-item-card">
      <div class="selected-item-header">
        <div>
          <div class="selected-item-name">${item.description}</div>
          <div class="selected-item-code">${item.itemCode}</div>
        </div>
        <span class="vat-pill vat-pill--${item.taxGrade}">
          Grade ${item.taxGrade} · ${item.vatRate}% VAT
        </span>
      </div>
      <div class="selected-item-meta">
        <span>📦 ${item.category}</span>
        <span>📐 Unit: ${item.unit}</span>
      </div>
    </div>
  `;
  display.classList.remove("hidden");

  // Show product details form
  document.getElementById("product-details-card").classList.remove("hidden");

  // Set unit label
  const unitEl = document.getElementById("qty-unit");
  if (unitEl) unitEl.textContent = item.unit;

  // Focus brand name
  setTimeout(() => {
    const brandInput = document.getElementById("brand-name");
    if (brandInput) brandInput.focus();
  }, 100);
}

async function _handleAddToStock() {
  const errorEl  = document.getElementById("create-error");
  const brandEl  = document.getElementById("brand-name");
  const priceEl  = document.getElementById("selling-price");
  const qtyEl    = document.getElementById("quantity");

  _hideEl("create-error");

  // Validate
  if (!_selectedRRAItem) {
    _showAlert("create-error", "Please select an RRA item code first.");
    return;
  }

  const brandName    = brandEl?.value.trim();
  const sellingPrice = parseFloat(priceEl?.value || 0);
  const quantity     = parseFloat(qtyEl?.value || 0);

  if (!brandName) {
    _showAlert("create-error", "Please enter a brand or product name.");
    return;
  }

  if (sellingPrice <= 0) {
    _showAlert("create-error", "Please enter a valid selling price.");
    return;
  }

  if (quantity <= 0) {
    _showAlert("create-error", "Please enter a valid quantity.");
    return;
  }

  _setLoading("btn-add-stock", "add-stock-text", "add-stock-spinner", true, "Adding…");

  const result = await createProduct({
    manufacturerId:  _profile.uid,
    manufacturerTIN: _profile.tinNumber || "",
    rraItem:         _selectedRRAItem,
    brandName,
    sellingPrice,
    quantity,
  });

  _setLoading("btn-add-stock", "add-stock-text", "add-stock-spinner", false, "Add to Stock");

  if (result.success) {
    _showCreateSuccess(brandName, _selectedRRAItem, quantity, sellingPrice, result.isExisting);
  } else {
    _showAlert("create-error", result.error || "Failed to add product. Try again.");
  }
}

function _showCreateSuccess(brandName, rraItem, quantity, price, isExisting) {
  // Hide the form cards
  document.getElementById("product-details-card").classList.add("hidden");
  document.getElementById("selected-item-display").classList.add("hidden");
  document.getElementById("rra-search").value = "";
  document.getElementById("search-clear").classList.add("hidden");
  _selectedRRAItem = null;

  // Show success
  const successEl = document.getElementById("create-success");
  successEl.innerHTML = `
    <div class="success-card">
      <div class="success-icon">✅</div>
      <h3>${isExisting ? "Stock Updated!" : "Product Added!"}</h3>
      <p>
        <strong>${brandName}</strong> has been
        ${isExisting ? "restocked" : "created and added to stock"}.
      </p>
      <div class="success-details">
        <div class="success-detail-row">
          <span>Item</span>
          <span>${rraItem.description}</span>
        </div>
        <div class="success-detail-row">
          <span>Quantity</span>
          <span>${quantity} ${rraItem.unit}</span>
        </div>
        <div class="success-detail-row">
          <span>Selling Price</span>
          <span>${formatRWF(price)}</span>
        </div>
        <div class="success-detail-row">
          <span>VAT Grade</span>
          <span>Grade ${rraItem.taxGrade} · ${rraItem.vatRate}%</span>
        </div>
      </div>
      <p class="success-reset-msg">Form resets in <span id="reset-countdown">3</span>s…</p>
    </div>
  `;
  successEl.classList.remove("hidden");

  // Countdown and reset
  let count = 3;
  const timer = setInterval(() => {
    count--;
    const el = document.getElementById("reset-countdown");
    if (el) el.textContent = count;
    if (count <= 0) {
      clearInterval(timer);
      successEl.classList.add("hidden");
      successEl.innerHTML = "";
    }
  }, 1000);
}

// ══════════════════════════════════════════════════════════════
// SECTION 2 — BUY RAW MATERIALS (delegates to MarketplaceTab)
// ══════════════════════════════════════════════════════════════
async function _renderRawMaterialsSection() {
  const content = document.getElementById("section-content");
  // Reuse the shared MarketplaceTab — same UI, cart, and order flow
  const { renderMarketplaceTab } = await import("/src/views/shared/MarketplaceTab.js");
  await renderMarketplaceTab(content, _profile);
}

// ── Helpers ───────────────────────────────────────────────────
function _showAlert(id, msg) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = msg;
  el.classList.remove("hidden");
}

function _hideEl(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add("hidden");
}

function _setLoading(btnId, textId, spinnerId, loading, label) {
  const btn     = document.getElementById(btnId);
  const text    = document.getElementById(textId);
  const spinner = document.getElementById(spinnerId);
  if (!btn || !text || !spinner) return;
  btn.disabled = loading;
  text.textContent = label;
  spinner.classList.toggle("hidden", !loading);
}

function _capitalize(str) {
  if (!str) return "";
  return str.charAt(0).toUpperCase() + str.slice(1);
}

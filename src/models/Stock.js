// ============================================================
// Stock.js — Mucuruzi Stock Model
// GOLDEN RULE: ONE ownerId + productId = ONE stock document
// stockId format: ownerId_productId
// stockType: "inventory" | "rawMaterial"
// ============================================================

import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  getDocs,
  collection,
  query,
  where,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

import { db } from "/src/config/firebase.js";
import { parsePrice } from "/src/utils/VAT.js";

// ─── ADD TO STOCK (Singleton Rule Enforced) ───────────────────
/**
 * Add quantity to stock. Creates new doc or updates existing.
 * GOLDEN RULE: ONE ownerId + productId = ONE stock document.
 *
 * @param {Object} params
 * @param {string} params.ownerId      - UID of stock owner
 * @param {string} params.productId    - Product ID
 * @param {number} params.quantity     - Quantity to add
 * @param {number} params.sellingPrice - Selling price
 * @param {string} params.stockType    - "inventory" | "rawMaterial"
 *
 * @returns {Object} { success, stockId } | { success: false, error }
 */
export async function addToStock({
  ownerId,
  productId,
  quantity,
  sellingPrice,
  stockType = "inventory",
}) {
  try {
    // ── Validate ─────────────────────────────────────────
    if (!ownerId)    throw new Error("Owner ID is required.");
    if (!productId)  throw new Error("Product ID is required.");
    if (quantity <= 0) throw new Error("Quantity must be greater than 0.");

    const cleanQty   = parsePrice(quantity);
    const cleanPrice = parsePrice(sellingPrice);

    // ── Singleton stock ID ────────────────────────────────
    // productId format: manufacturerId_itemCode
    // Extract itemCode (last part after final underscore)
    // stockId = ownerId_itemCode — prevents double-ownerId when manufacturer owns product
    const itemCodePart = productId.includes("_") ? productId.split("_").pop() : productId;
    const stockId  = `${ownerId}_${itemCodePart}`;
    const stockRef = doc(db, "stock", stockId);
    const existing = await getDoc(stockRef);

    if (existing.exists()) {
      // ── Update existing stock ─────────────────────────
      const current     = existing.data();
      const newQuantity = parsePrice(current.quantity + cleanQty);

      await updateDoc(stockRef, {
        quantity:     newQuantity,
        sellingPrice: cleanPrice, // Always update to latest selling price
        updatedAt:    serverTimestamp(),
      });

    } else {
      // ── Create new stock document ─────────────────────
      await setDoc(stockRef, {
        stockId,
        ownerId,
        productId,
        stockType,
        quantity:     cleanQty,
        sellingPrice: cleanPrice,
        createdAt:    serverTimestamp(),
        updatedAt:    serverTimestamp(),
      });
    }

    return { success: true, stockId };

  } catch (err) {
    console.error("[Stock] addToStock error:", err);
    return { success: false, error: err.message };
  }
}

// ─── DEDUCT FROM STOCK ────────────────────────────────────────
/**
 * Deduct quantity from stock after a confirmed order.
 *
 * @param {string} ownerId
 * @param {string} productId
 * @param {number} quantity
 * @returns {Object} { success } | { success: false, error }
 */
export async function deductFromStock(ownerId, productId, quantity) {
  try {
    const itemCodePart2 = productId.includes("_") ? productId.split("_").pop() : productId;
    const stockId  = `${ownerId}_${itemCodePart2}`;
    const stockRef = doc(db, "stock", stockId);
    const snap     = await getDoc(stockRef);

    if (!snap.exists()) {
      throw new Error("Stock record not found.");
    }

    const current = snap.data();
    const deduct  = parsePrice(quantity);

    if (current.quantity < deduct) {
      throw new Error(
        `Insufficient stock. Available: ${current.quantity}, Requested: ${deduct}`
      );
    }

    const newQuantity = parsePrice(current.quantity - deduct);

    await updateDoc(stockRef, {
      quantity:  newQuantity,
      updatedAt: serverTimestamp(),
    });

    return { success: true, stockId, remainingQuantity: newQuantity };

  } catch (err) {
    console.error("[Stock] deductFromStock error:", err);
    return { success: false, error: err.message };
  }
}

// ─── TRANSFER STOCK (Seller → Buyer on Order Confirm) ─────────
/**
 * Transfer stock from seller to buyer when order is confirmed.
 * Deducts from seller, adds to buyer.
 * Routes to rawMaterial if buyer is manufacturer, else inventory.
 *
 * @param {Object} params
 * @param {string} params.sellerId
 * @param {string} params.buyerId
 * @param {string} params.buyerRole     - buyer's role
 * @param {string} params.productId
 * @param {number} params.quantity
 * @param {number} params.sellingPrice  - seller's price (becomes buyer's cost reference)
 *
 * @returns {Object} { success } | { success: false, error }
 */
export async function transferStock({
  sellerId,
  buyerId,
  buyerRole,
  productId,
  quantity,
  sellingPrice,
}) {
  try {
    // ── Deduct from seller ────────────────────────────────
    const deductResult = await deductFromStock(sellerId, productId, quantity);
    if (!deductResult.success) throw new Error(deductResult.error);

    // ── Route stock type based on buyer role ──────────────
    // Manufacturer receives as raw materials
    // All other roles receive as inventory
    const stockType = buyerRole === "manufacturer" ? "rawMaterial" : "inventory";

    // ── Add to buyer stock ────────────────────────────────
    const addResult = await addToStock({
      ownerId:      buyerId,
      productId,
      quantity,
      sellingPrice, // Buyer inherits seller's selling price as reference
      stockType,
    });

    if (!addResult.success) throw new Error(addResult.error);

    return {
      success:   true,
      stockType,
      sellerId,
      buyerId,
      productId,
      quantity,
    };

  } catch (err) {
    console.error("[Stock] transferStock error:", err);
    return { success: false, error: err.message };
  }
}

// ─── GET STOCK BY OWNER ───────────────────────────────────────
/**
 * Get all stock items for an owner.
 * Optionally filter by stockType.
 *
 * @param {string} ownerId
 * @param {string|null} stockType - "inventory" | "rawMaterial" | null (all)
 * @returns {Array} stock items
 */
export async function getStockByOwner(ownerId, stockType = null) {
  try {
    let q;

    if (stockType) {
      q = query(
        collection(db, "stock"),
        where("ownerId",   "==", ownerId),
        where("stockType", "==", stockType)
      );
    } else {
      q = query(
        collection(db, "stock"),
        where("ownerId", "==", ownerId)
      );
    }

    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));

  } catch (err) {
    console.error("[Stock] getStockByOwner error:", err);
    return [];
  }
}

// ─── GET SINGLE STOCK ITEM ────────────────────────────────────
/**
 * Get a single stock document.
 * @param {string} ownerId
 * @param {string} productId
 * @returns {Object|null}
 */
export async function getStockItem(ownerId, productId) {
  try {
    const itemCodePart3 = productId.includes("_") ? productId.split("_").pop() : productId;
    const stockId = `${ownerId}_${itemCodePart3}`;
    const snap    = await getDoc(doc(db, "stock", stockId));
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() };
  } catch (err) {
    console.error("[Stock] getStockItem error:", err);
    return null;
  }
}

// ─── CHECK STOCK AVAILABILITY ────────────────────────────────
/**
 * Check if enough stock is available before placing order.
 * @param {string} ownerId
 * @param {string} productId
 * @param {number} requestedQty
 * @returns {Object} { available: true } | { available: false, currentQty }
 */
export async function checkStockAvailability(ownerId, productId, requestedQty) {
  try {
    const stock = await getStockItem(ownerId, productId);

    if (!stock) {
      return { available: false, currentQty: 0, message: "Product not in stock." };
    }

    if (stock.quantity < requestedQty) {
      return {
        available:  false,
        currentQty: stock.quantity,
        message:    `Only ${stock.quantity} units available.`,
      };
    }

    return { available: true, currentQty: stock.quantity };

  } catch (err) {
    console.error("[Stock] checkStockAvailability error:", err);
    return { available: false, currentQty: 0, message: err.message };
  }
}

// ============================================================
// Product.js — Mucuruzi Product Model
// Creates products using RRA item codes
// One combined step: create product + add to stock
// ============================================================

import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

import { db } from "/src/config/firebase.js";
import { parsePrice } from "/src/utils/VAT.js";
import { addToStock } from "/src/models/Stock.js";

// ─── CREATE PRODUCT + ADD TO STOCK (One Combined Step) ────────
/**
 * Manufacturer creates a product and immediately adds it to stock.
 * RRA item data is immutable — taken directly from RRA sandbox.
 *
 * @param {Object} params
 * @param {string} params.manufacturerId   - UID of manufacturer
 * @param {string} params.manufacturerTIN  - TIN of manufacturer
 * @param {Object} params.rraItem          - Full RRA item object from RRA_sandbox
 * @param {string} params.brandName        - Manufacturer's product/brand name
 * @param {number} params.sellingPrice     - Price manufacturer sells at
 * @param {number} params.quantity         - Initial stock quantity
 *
 * @returns {Object} { success, productId, stockId } | { success: false, error }
 */
export async function createProduct({
  manufacturerId,
  manufacturerTIN,
  rraItem,
  brandName,
  sellingPrice,
  quantity,
}) {
  try {
    // ── Validate inputs ──────────────────────────────────
    if (!manufacturerId)       throw new Error("Manufacturer ID is required.");
    if (!rraItem?.itemCode)    throw new Error("RRA item code is required.");
    if (!brandName?.trim())    throw new Error("Brand/product name is required.");
    if (sellingPrice <= 0)     throw new Error("Selling price must be greater than 0.");
    if (quantity <= 0)         throw new Error("Quantity must be greater than 0.");

    const cleanPrice    = parsePrice(sellingPrice);
    const cleanQuantity = parsePrice(quantity);
    const cleanName     = brandName.trim();

    // ── Generate product ID ──────────────────────────────
    // Format: manufacturerId_itemCode (unique per manufacturer)
    const productId = `${manufacturerId}_${rraItem.itemCode}`;

    // ── Check if product already exists ─────────────────
    const existingSnap = await getDoc(doc(db, "products", productId));

    if (existingSnap.exists()) {
      // Product exists — just add more stock
      const stockResult = await addToStock({
        ownerId:       manufacturerId,
        productId,
        quantity:      cleanQuantity,
        sellingPrice:  cleanPrice,
        stockType:     "inventory",
      });

      if (!stockResult.success) throw new Error(stockResult.error);

      return {
        success:   true,
        productId,
        stockId:   stockResult.stockId,
        isExisting: true,
        message:   "Product already exists. Stock quantity updated.",
      };
    }

    // ── Save new product to Firestore ────────────────────
    const productData = {
      productId,
      manufacturerId,
      manufacturerTIN: manufacturerTIN || "",

      // Brand info (set by manufacturer)
      brandName:    cleanName,
      sellingPrice: cleanPrice,

      // RRA data — immutable, never changed after creation
      itemCode:    rraItem.itemCode,
      description: rraItem.description,
      category:    rraItem.category,
      unit:        rraItem.unit,
      taxGrade:    rraItem.taxGrade,
      vatRate:     rraItem.vatRate,

      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    await setDoc(doc(db, "products", productId), productData);

    // ── Add initial stock ────────────────────────────────
    const stockResult = await addToStock({
      ownerId:      manufacturerId,
      productId,
      quantity:     cleanQuantity,
      sellingPrice: cleanPrice,
      stockType:    "inventory",
    });

    if (!stockResult.success) throw new Error(stockResult.error);

    return {
      success:    true,
      productId,
      stockId:    stockResult.stockId,
      isExisting: false,
      message:    "Product created and added to stock successfully.",
    };

  } catch (err) {
    console.error("[Product] createProduct error:", err);
    return { success: false, error: err.message };
  }
}

// ─── GET PRODUCTS BY MANUFACTURER ─────────────────────────────
/**
 * Get all products created by a specific manufacturer.
 * @param {string} manufacturerId
 * @returns {Array} products
 */
export async function getProductsByManufacturer(manufacturerId) {
  try {
    const q = query(
      collection(db, "products"),
      where("manufacturerId", "==", manufacturerId),
      orderBy("createdAt", "desc")
    );

    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));

  } catch (err) {
    console.error("[Product] getProductsByManufacturer error:", err);
    return [];
  }
}

// ─── GET SINGLE PRODUCT ───────────────────────────────────────
/**
 * Get a single product by ID.
 * @param {string} productId
 * @returns {Object|null}
 */
export async function getProductById(productId) {
  try {
    const snap = await getDoc(doc(db, "products", productId));
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() };
  } catch (err) {
    console.error("[Product] getProductById error:", err);
    return null;
  }
}

// ─── GET ALL PRODUCTS (for marketplace browsing) ──────────────
/**
 * Get all products available in the marketplace.
 * Used by distributor, retailer, buyer to browse.
 * @returns {Array} products
 */
export async function getAllProducts() {
  try {
    const snap = await getDocs(collection(db, "products"));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (err) {
    console.error("[Product] getAllProducts error:", err);
    return [];
  }
        }

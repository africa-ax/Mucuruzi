// ============================================================
// Order.js — Mucuruzi Order Model
// Shared by ALL roles — handles full order lifecycle
// create → confirm/reject → stock transfer → invoice
// ============================================================

import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

import { db }                  from "/src/config/firebase.js";
import { transferStock }       from "/src/models/Stock.js";
import { calculateInvoiceTotals, parsePrice } from "/src/utils/VAT.js";
import { rraAPI }              from "/src/rra/RRA_sandbox.js";

// ─── GENERATE ORDER ID ────────────────────────────────────────
function _generateOrderId() {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random    = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `ORD-${timestamp}-${random}`;
}

// ─── CREATE ORDER ─────────────────────────────────────────────
/**
 * Create a new order from cart items.
 * Cart is split by seller — one order per seller.
 *
 * @param {Object} params
 * @param {Object} params.buyer         - { uid, role, name/businessName, tinNumber }
 * @param {string} params.sellerId      - Seller UID
 * @param {Array}  params.items         - [{ productId, productName, itemCode, quantity, unitPrice, vatRate, unit }]
 * @param {string} params.purchaseCode  - Buyer's RRA purchase code
 *
 * @returns {Object} { success, orderId } | { success: false, error }
 */
export async function createOrder({ buyer, sellerId, items, purchaseCode }) {
  try {
    // ── Validate ─────────────────────────────────────────
    if (!buyer?.uid)         throw new Error("Buyer information is required.");
    if (!sellerId)           throw new Error("Seller ID is required.");
    if (!items?.length)      throw new Error("Order must have at least one item.");
    if (!purchaseCode)       throw new Error("Purchase code is required.");

    // ── Validate purchase code via RRA sandbox ────────────
    const sellerSnap = await getDoc(doc(db, "users", sellerId));
    if (!sellerSnap.exists()) throw new Error("Seller not found.");
    const seller = sellerSnap.data();

    const codeCheck = rraAPI.verifyPurchaseCode(
      buyer.tinNumber || "000000000",
      seller.tinNumber || "000000000",
      purchaseCode
    );

    if (!codeCheck.verified) {
      throw new Error(codeCheck.message || "Invalid purchase code.");
    }

    // ── Calculate totals ──────────────────────────────────
    const totals = calculateInvoiceTotals(
      items.map(i => ({
        unitPrice: i.unitPrice,
        quantity:  i.quantity,
        vatRate:   i.vatRate || 0,
      }))
    );

    // ── Generate order ID ─────────────────────────────────
    const orderId = _generateOrderId();

    // ── Build order document ──────────────────────────────
    const orderData = {
      orderId,
      buyerId:       buyer.uid,
      buyerRole:     buyer.role,
      buyerName:     buyer.businessName || buyer.name || "",
      buyerTIN:      buyer.tinNumber || "",
      sellerId,
      sellerName:    seller.businessName || seller.name || "",
      sellerTIN:     seller.tinNumber || "",
      items:         items.map(i => ({
        productId:   i.productId,
        productName: i.productName,
        itemCode:    i.itemCode,
        quantity:    parsePrice(i.quantity),
        unitPrice:   parsePrice(i.unitPrice),
        vatRate:     i.vatRate || 0,
        unit:        i.unit || "PCS",
      })),
      subtotal:      totals.subtotal,
      vatTotal:      totals.totalVAT,
      grandTotal:    totals.grandTotal,
      purchaseCode,
      status:        "pending",
      createdAt:     serverTimestamp(),
      updatedAt:     serverTimestamp(),
    };

    await setDoc(doc(db, "orders", orderId), orderData);

    return { success: true, orderId };

  } catch (err) {
    console.error("[Order] createOrder error:", err);
    return { success: false, error: err.message };
  }
}

// ─── CREATE ORDERS FROM CART (Split by Seller) ────────────────
/**
 * Place all cart orders — splits by seller automatically.
 *
 * @param {Object} buyer
 * @param {Array}  cartItems   - [{ sellerId, ...itemFields }]
 * @param {string} purchaseCode
 *
 * @returns {Object} { success, orderIds, errors }
 */
export async function createOrdersFromCart({ buyer, cartItems, purchaseCode }) {
  // Group cart items by seller
  const bySeller = {};
  for (const item of cartItems) {
    if (!bySeller[item.sellerId]) bySeller[item.sellerId] = [];
    bySeller[item.sellerId].push(item);
  }

  const orderIds = [];
  const errors   = [];

  for (const [sellerId, items] of Object.entries(bySeller)) {
    const result = await createOrder({ buyer, sellerId, items, purchaseCode });
    if (result.success) {
      orderIds.push(result.orderId);
    } else {
      errors.push({ sellerId, error: result.error });
    }
  }

  return {
    success:  orderIds.length > 0,
    orderIds,
    errors,
  };
}

// ─── CONFIRM ORDER ────────────────────────────────────────────
/**
 * Seller confirms an order.
 * Triggers: stock transfer + invoice generation.
 *
 * @param {string} orderId
 * @param {string} sellerId - Must match order's sellerId
 *
 * @returns {Object} { success, invoiceId } | { success: false, error }
 */
export async function confirmOrder(orderId, sellerId) {
  try {
    const orderRef  = doc(db, "orders", orderId);
    const orderSnap = await getDoc(orderRef);

    if (!orderSnap.exists())             throw new Error("Order not found.");
    const order = orderSnap.data();

    if (order.sellerId !== sellerId)     throw new Error("Unauthorized.");
    if (order.status !== "pending")      throw new Error(`Order is already ${order.status}.`);

    // ── Transfer stock for each item ──────────────────────
    for (const item of order.items) {
      const result = await transferStock({
        sellerId:     order.sellerId,
        buyerId:      order.buyerId,
        buyerRole:    order.buyerRole,
        productId:    item.productId,
        quantity:     item.quantity,
        sellingPrice: item.unitPrice,
      });

      if (!result.success) throw new Error(`Stock transfer failed: ${result.error}`);
    }

    // ── Generate Invoice ──────────────────────────────────
    const invoiceId = await _generateInvoice(order);

    // ── Update order status ───────────────────────────────
    await updateDoc(orderRef, {
      status:      "confirmed",
      invoiceId,
      confirmedAt: serverTimestamp(),
      updatedAt:   serverTimestamp(),
    });

    return { success: true, orderId, invoiceId };

  } catch (err) {
    console.error("[Order] confirmOrder error:", err);
    return { success: false, error: err.message };
  }
}

// ─── REJECT ORDER ─────────────────────────────────────────────
/**
 * Seller rejects an order. No stock movement.
 *
 * @param {string} orderId
 * @param {string} sellerId
 * @param {string} reason   - Optional rejection reason
 *
 * @returns {Object} { success } | { success: false, error }
 */
export async function rejectOrder(orderId, sellerId, reason = "") {
  try {
    const orderRef  = doc(db, "orders", orderId);
    const orderSnap = await getDoc(orderRef);

    if (!orderSnap.exists())         throw new Error("Order not found.");
    const order = orderSnap.data();

    if (order.sellerId !== sellerId) throw new Error("Unauthorized.");
    if (order.status !== "pending")  throw new Error(`Order is already ${order.status}.`);

    await updateDoc(orderRef, {
      status:     "rejected",
      rejectReason: reason,
      rejectedAt: serverTimestamp(),
      updatedAt:  serverTimestamp(),
    });

    return { success: true };

  } catch (err) {
    console.error("[Order] rejectOrder error:", err);
    return { success: false, error: err.message };
  }
}

// ─── CANCEL ORDER (Buyer) ─────────────────────────────────────
/**
 * Buyer cancels a pending order.
 *
 * @param {string} orderId
 * @param {string} buyerId
 *
 * @returns {Object} { success } | { success: false, error }
 */
export async function cancelOrder(orderId, buyerId) {
  try {
    const orderRef  = doc(db, "orders", orderId);
    const orderSnap = await getDoc(orderRef);

    if (!orderSnap.exists())         throw new Error("Order not found.");
    const order = orderSnap.data();

    if (order.buyerId !== buyerId)   throw new Error("Unauthorized.");
    if (order.status !== "pending")  throw new Error("Only pending orders can be cancelled.");

    await updateDoc(orderRef, {
      status:      "cancelled",
      cancelledAt: serverTimestamp(),
      updatedAt:   serverTimestamp(),
    });

    return { success: true };

  } catch (err) {
    console.error("[Order] cancelOrder error:", err);
    return { success: false, error: err.message };
  }
}

// ─── GET ORDERS (Incoming — as seller) ───────────────────────
export async function getIncomingOrders(sellerId) {
  try {
    const q = query(
      collection(db, "orders"),
      where("sellerId", "==", sellerId),
      orderBy("createdAt", "desc")
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (err) {
    console.error("[Order] getIncomingOrders error:", err);
    return [];
  }
}

// ─── GET ORDERS (Outgoing — as buyer) ────────────────────────
export async function getOutgoingOrders(buyerId) {
  try {
    const q = query(
      collection(db, "orders"),
      where("buyerId", "==", buyerId),
      orderBy("createdAt", "desc")
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (err) {
    console.error("[Order] getOutgoingOrders error:", err);
    return [];
  }
}

// ─── GET SINGLE ORDER ─────────────────────────────────────────
export async function getOrderById(orderId) {
  try {
    const snap = await getDoc(doc(db, "orders", orderId));
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() };
  } catch (err) {
    console.error("[Order] getOrderById error:", err);
    return null;
  }
}

// ─── PRIVATE: GENERATE INVOICE ───────────────────────────────
async function _generateInvoice(order) {
  try {
    const invoiceId = `INV-${order.orderId}`;

    // Submit to RRA sandbox
    const rraResult = rraAPI.submitInvoice({
      invoiceNumber: invoiceId,
      sellerTIN:     order.sellerTIN,
      buyerTIN:      order.buyerTIN,
      sdcId:         order.sdcId || "SDC-DEFAULT",
      items:         order.items.map(i => ({
        itemCode:  i.itemCode,
        qty:       i.quantity,
        unitPrice: i.unitPrice,
        vatRate:   i.vatRate,
      })),
      subtotal:   order.subtotal,
      vatTotal:   order.vatTotal,
      grandTotal: order.grandTotal,
    });

    const invoiceData = {
      invoiceId,
      orderId:       order.orderId,
      sellerId:      order.sellerId,
      sellerName:    order.sellerName,
      sellerTIN:     order.sellerTIN,
      buyerId:       order.buyerId,
      buyerName:     order.buyerName,
      buyerTIN:      order.buyerTIN,
      items:         order.items,
      subtotal:      order.subtotal,
      vatTotal:      order.vatTotal,
      grandTotal:    order.grandTotal,
      // RRA fields
      signature:     rraResult.signature     || null,
      internalData:  rraResult.internalData  || null,
      receiptNumber: rraResult.receiptNumber || null,
      sdcDateTime:   rraResult.sdcDateTime   || null,
      sdcId:         rraResult.sdcId         || null,
      qrCode:        rraResult.qrCode        || null,
      generatedAt:   serverTimestamp(),
    };

    await setDoc(doc(db, "invoices", invoiceId), invoiceData);

    return invoiceId;

  } catch (err) {
    console.error("[Order] _generateInvoice error:", err);
    throw new Error("Invoice generation failed: " + err.message);
  }
  }

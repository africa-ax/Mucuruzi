// ============================================================
// Order.js — Mucuruzi Order Model
// Shared by ALL roles — handles full order lifecycle
// Per-seller purchase code validation via RRA sandbox
// ============================================================

import {
  collection, doc, setDoc, getDoc, getDocs,
  updateDoc, query, where, orderBy, serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

import { db }                    from "/src/config/firebase.js";
import { transferStock }         from "/src/models/Stock.js";
import { calculateInvoiceTotals, parsePrice } from "/src/utils/VAT.js";
import { rraAPI }                from "/src/rra/RRA_sandbox.js";

function _generateOrderId() {
  const t = Date.now().toString(36).toUpperCase();
  const r = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `ORD-${t}-${r}`;
}

// ─── CREATE SINGLE ORDER ──────────────────────────────────────
export async function createOrder({ buyer, sellerId, seller, items, purchaseCode }) {
  try {
    if (!buyer?.uid)    throw new Error("Buyer information is required.");
    if (!sellerId)      throw new Error("Seller ID is required.");
    if (!items?.length) throw new Error("Order must have at least one item.");

    const totals  = calculateInvoiceTotals(
      items.map(i => ({ unitPrice: i.unitPrice, quantity: i.quantity, vatRate: i.vatRate || 0 }))
    );
    const orderId = _generateOrderId();

    await setDoc(doc(db, "orders", orderId), {
      orderId,
      buyerId:    buyer.uid,
      buyerRole:  buyer.role,
      buyerName:  buyer.businessName || buyer.name || "",
      buyerTIN:   buyer.tinNumber    || "",
      sellerId,
      sellerName: seller.businessName || seller.name || "",
      sellerTIN:  seller.tinNumber   || "",
      items: items.map(i => ({
        productId:   i.productId,
        productName: i.productName,
        itemCode:    i.itemCode,
        quantity:    parsePrice(i.quantity),
        unitPrice:   parsePrice(i.unitPrice),
        vatRate:     i.vatRate || 0,
        unit:        i.unit    || "PCS",
      })),
      subtotal:     totals.subtotal,
      vatTotal:     totals.totalVAT,
      grandTotal:   totals.grandTotal,
      purchaseCode,
      status:       "pending",
      createdAt:    serverTimestamp(),
      updatedAt:    serverTimestamp(),
    });

    return { success: true, orderId };
  } catch (err) {
    console.error("[Order] createOrder error:", err);
    return { success: false, error: err.message };
  }
}

// ─── CREATE ORDERS FROM CART ──────────────────────────────────
// cartGroups: [{ sellerId, seller, items, purchaseCode }]
// Validates ALL purchase codes first before creating any order
export async function createOrdersFromCart({ buyer, cartGroups }) {
  // Step 1: Validate all codes first
  const validationErrors = [];
  for (const group of cartGroups) {
    const check = rraAPI.verifyPurchaseCode(
      buyer.tinNumber        || "000000000",
      group.seller.tinNumber || "000000000",
      group.purchaseCode
    );
    if (!check.verified) {
      validationErrors.push({
        sellerName: group.seller.businessName || group.seller.name,
        sellerTIN:  group.seller.tinNumber,
        error:      check.message || "Invalid purchase code.",
      });
    }
  }

  if (validationErrors.length > 0) {
    return { success: false, orderIds: [], errors: validationErrors };
  }

  // Step 2: All valid — create orders
  const orderIds = [];
  const errors   = [];

  for (const group of cartGroups) {
    const result = await createOrder({
      buyer,
      sellerId:     group.sellerId,
      seller:       group.seller,
      items:        group.items,
      purchaseCode: group.purchaseCode,
    });

    if (result.success) orderIds.push(result.orderId);
    else errors.push({ sellerName: group.seller.businessName || group.seller.name, error: result.error });
  }

  return { success: orderIds.length > 0, orderIds, errors };
}

// ─── CONFIRM ORDER ────────────────────────────────────────────
export async function confirmOrder(orderId, sellerId) {
  try {
    const orderRef  = doc(db, "orders", orderId);
    const orderSnap = await getDoc(orderRef);
    if (!orderSnap.exists())         throw new Error("Order not found.");
    const order = orderSnap.data();
    if (order.sellerId !== sellerId) throw new Error("Unauthorized.");
    if (order.status !== "pending")  throw new Error(`Order is already ${order.status}.`);

    for (const item of order.items) {
      const result = await transferStock({
        sellerId: order.sellerId, buyerId: order.buyerId,
        buyerRole: order.buyerRole, productId: item.productId,
        quantity: item.quantity, sellingPrice: item.unitPrice,
      });
      if (!result.success) throw new Error(`Stock transfer failed: ${result.error}`);
    }

    const invoiceId = await _generateInvoice(order);
    await updateDoc(orderRef, { status: "confirmed", invoiceId, confirmedAt: serverTimestamp(), updatedAt: serverTimestamp() });
    return { success: true, orderId, invoiceId };
  } catch (err) {
    console.error("[Order] confirmOrder error:", err);
    return { success: false, error: err.message };
  }
}

// ─── REJECT ORDER ─────────────────────────────────────────────
export async function rejectOrder(orderId, sellerId, reason = "") {
  try {
    const orderRef  = doc(db, "orders", orderId);
    const orderSnap = await getDoc(orderRef);
    if (!orderSnap.exists())         throw new Error("Order not found.");
    const order = orderSnap.data();
    if (order.sellerId !== sellerId) throw new Error("Unauthorized.");
    if (order.status !== "pending")  throw new Error(`Order is already ${order.status}.`);
    await updateDoc(orderRef, { status: "rejected", rejectReason: reason, rejectedAt: serverTimestamp(), updatedAt: serverTimestamp() });
    return { success: true };
  } catch (err) {
    console.error("[Order] rejectOrder error:", err);
    return { success: false, error: err.message };
  }
}

// ─── CANCEL ORDER ─────────────────────────────────────────────
export async function cancelOrder(orderId, buyerId) {
  try {
    const orderRef  = doc(db, "orders", orderId);
    const orderSnap = await getDoc(orderRef);
    if (!orderSnap.exists())       throw new Error("Order not found.");
    const order = orderSnap.data();
    if (order.buyerId !== buyerId) throw new Error("Unauthorized.");
    if (order.status !== "pending")throw new Error("Only pending orders can be cancelled.");
    await updateDoc(orderRef, { status: "cancelled", cancelledAt: serverTimestamp(), updatedAt: serverTimestamp() });
    return { success: true };
  } catch (err) {
    console.error("[Order] cancelOrder error:", err);
    return { success: false, error: err.message };
  }
}

// ─── GET ORDERS ───────────────────────────────────────────────
export async function getIncomingOrders(sellerId) {
  try {
    const snap = await getDocs(query(collection(db, "orders"), where("sellerId", "==", sellerId), orderBy("createdAt", "desc")));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (err) { console.error("[Order] getIncomingOrders:", err); return []; }
}

export async function getOutgoingOrders(buyerId) {
  try {
    const snap = await getDocs(query(collection(db, "orders"), where("buyerId", "==", buyerId), orderBy("createdAt", "desc")));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (err) { console.error("[Order] getOutgoingOrders:", err); return []; }
}

export async function getOrderById(orderId) {
  try {
    const snap = await getDoc(doc(db, "orders", orderId));
    return snap.exists() ? { id: snap.id, ...snap.data() } : null;
  } catch (err) { console.error("[Order] getOrderById:", err); return null; }
}

// ─── GENERATE INVOICE ─────────────────────────────────────────
async function _generateInvoice(order) {
  try {
    const invoiceId = `INV-${order.orderId}`;
    const rraResult = rraAPI.submitInvoice({
      invoiceNumber: invoiceId,
      sellerTIN:     order.sellerTIN,
      buyerTIN:      order.buyerTIN,
      sdcId:         order.sdcId || "SDC-DEFAULT",
      items:         order.items.map(i => ({ itemCode: i.itemCode, qty: i.quantity, unitPrice: i.unitPrice, vatRate: i.vatRate })),
      subtotal:      order.subtotal,
      vatTotal:      order.vatTotal,
      grandTotal:    order.grandTotal,
    });

    await setDoc(doc(db, "invoices", invoiceId), {
      invoiceId, orderId: order.orderId,
      sellerId: order.sellerId, sellerName: order.sellerName, sellerTIN: order.sellerTIN,
      buyerId: order.buyerId, buyerName: order.buyerName, buyerTIN: order.buyerTIN,
      items: order.items,
      subtotal: order.subtotal, vatTotal: order.vatTotal, grandTotal: order.grandTotal,
      signature:     rraResult.signature     || null,
      internalData:  rraResult.internalData  || null,
      receiptNumber: rraResult.receiptNumber || null,
      sdcDateTime:   rraResult.sdcDateTime   || null,
      sdcId:         rraResult.sdcId         || null,
      qrCode:        rraResult.qrCode        || null,
      generatedAt:   serverTimestamp(),
    });

    return invoiceId;
  } catch (err) {
    console.error("[Order] _generateInvoice error:", err);
    throw new Error("Invoice generation failed: " + err.message);
  }
}

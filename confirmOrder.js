// ============================================================
//  MUCURUZI — api/confirmOrder.js
//  Secure Vercel serverless function.
//  Handles order confirmation entirely on the server.
//
//  Flow (API First, Batch Second rule maintained):
//  1. Verify Firebase Auth ID token
//  2. Validate seller is the caller
//  3. Fetch order from Firestore
//  4. Check stock availability
//  5. Call RRAService.verifyPurchaseCode()   [RRA API]
//  6. Call RRAService.submitInvoice()        [RRA API]
//  7. Batch write atomically:
//     a. Update order → confirmed
//     b. Save invoice
//     c. Deduct seller stock
//     d. Add buyer stock
//  8. Return { success, invoiceId }
//
//  Nobody can bypass this — logic runs on server not browser.
//  RRA API key is in environment variables, never visible.
// ============================================================

import { adminDb, adminAuth } from './utils/firebaseAdmin.js';
import { verifyPurchaseCode, submitInvoice } from './utils/RRAService.js';

// ── Constants (mirrored from frontend constants.js) ──────────
const ORDER_STATUS = { PENDING: 'pending', CONFIRMED: 'confirmed', REJECTED: 'rejected' };
const STOCK_TYPES  = { INVENTORY: 'inventory', RAW_MATERIAL: 'rawMaterial' };
const ROLES        = { MANUFACTURER: 'manufacturer', DISTRIBUTOR: 'distributor', RETAILER: 'retailer', EXPORTER: 'exporter', BUYER: 'buyer' };

const Collections = {
  USERS:    'users',
  STOCK:    'stock',
  ORDERS:   'orders',
  INVOICES: 'invoices',
};

// ── Price helpers ─────────────────────────────────────────────
const round   = (v) => parseFloat(parseFloat(v).toFixed(2));
const calcVAT = (subtotal, taxGrade) => {
  const rates = { A: 0.18, B: 0, C: 0, D: 0 };
  return round(subtotal * (rates[taxGrade] ?? 0.18));
};

// ── Stock ID generator (singleton rule) ──────────────────────
const stockId = (ownerId, productId) => `${ownerId}_${productId}`;

// ── Invoice ID generator ──────────────────────────────────────
const generateInvoiceId = () => {
  const year = new Date().getFullYear();
  const rand = Math.random().toString(36).substr(2, 8).toUpperCase();
  return `INV-${year}-${rand}`;
};

// ── Main Handler ──────────────────────────────────────────────
export default async function handler(req, res) {

  // ── Only accept POST ───────────────────────────────────────
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    // ── STEP 1: Verify Firebase Auth token ─────────────────────
    const authHeader = req.headers.authorization || '';
    const idToken    = authHeader.startsWith('Bearer ')
      ? authHeader.slice(7)
      : null;

    if (!idToken) {
      return res.status(401).json({ error: 'Missing authentication token.' });
    }

    let decodedToken;
    try {
      decodedToken = await adminAuth.verifyIdToken(idToken);
    } catch (err) {
      return res.status(401).json({ error: 'Invalid or expired authentication token.' });
    }

    const callerUid = decodedToken.uid;

    // ── STEP 2: Parse request body ──────────────────────────────
    const { orderId, purchaseCode } = req.body;

    if (!orderId)      return res.status(400).json({ error: 'orderId is required.' });
    if (!purchaseCode) return res.status(400).json({ error: 'purchaseCode is required.' });

    // ── STEP 3: Fetch order from Firestore ──────────────────────
    const orderRef = adminDb.collection(Collections.ORDERS).doc(orderId);
    const orderDoc = await orderRef.get();

    if (!orderDoc.exists) {
      return res.status(404).json({ error: 'Order not found.' });
    }

    const order = orderDoc.data();

    // ── STEP 4: Verify caller is the seller ────────────────────
    if (order.sellerId !== callerUid) {
      return res.status(403).json({ error: 'You are not the seller on this order.' });
    }

    if (order.status !== ORDER_STATUS.PENDING) {
      return res.status(400).json({ error: `Order is already ${order.status}.` });
    }

    // ── STEP 5: Fetch seller and buyer profiles ─────────────────
    const [sellerDoc, buyerDoc] = await Promise.all([
      adminDb.collection(Collections.USERS).doc(order.sellerId).get(),
      adminDb.collection(Collections.USERS).doc(order.buyerId).get(),
    ]);

    if (!sellerDoc.exists) {
      return res.status(404).json({ error: 'Seller profile not found.' });
    }

    const seller = sellerDoc.data();
    const buyer  = buyerDoc.exists ? buyerDoc.data() : {
      uid:          order.buyerId,
      businessName: order.buyerName,
      role:         ROLES.BUYER,
      tinNumber:    '',
    };

    // ── STEP 6: Check stock availability (server-side) ─────────
    for (const item of order.items) {
      const stkId  = stockId(seller.uid, item.productId);
      const stkDoc = await adminDb.collection(Collections.STOCK).doc(stkId).get();

      if (!stkDoc.exists) {
        return res.status(400).json({
          error: `Product "${item.productName}" is not in seller stock.`,
        });
      }

      const stk = stkDoc.data();
      if (stk.quantity < item.quantity) {
        return res.status(400).json({
          error: `Insufficient stock for "${item.productName}". Available: ${stk.quantity} ${stk.unit}.`,
        });
      }
    }

    // ── STEP 7: Verify purchase code with RRA [API] ─────────────
    const codeResult = await verifyPurchaseCode(seller.tinNumber, purchaseCode);
    if (!codeResult.success) {
      return res.status(400).json({ error: `Purchase code invalid: ${codeResult.message}` });
    }

    // ── STEP 8: Recalculate totals SERVER-SIDE ──────────────────
    // Never trust prices from the browser — recalculate here
    let subtotal  = 0;
    let vatAmount = 0;

    const enrichedItems = order.items.map(item => {
      const lineSub = round(item.quantity * item.unitPrice);
      const lineVAT = calcVAT(lineSub, item.taxGrade);
      const lineTotal = round(lineSub + lineVAT);
      subtotal  += lineSub;
      vatAmount += lineVAT;
      return { ...item, lineSubtotal: lineSub, vatAmount: lineVAT, lineTotal };
    });

    subtotal  = round(subtotal);
    vatAmount = round(vatAmount);
    const total = round(subtotal + vatAmount);

    // ── STEP 9: Submit invoice to RRA [API] ─────────────────────
    const invoiceId      = generateInvoiceId();
    const invoicePayload = {
      invoiceId,
      sellerTIN:    seller.tinNumber,
      buyerTIN:     buyer.tinNumber || '000000000',
      items:        enrichedItems,
      subtotal,
      vatAmount,
      total,
      purchaseCode: codeResult.purchaseCode,
    };

    const rraResult = await submitInvoice(invoicePayload);
    if (!rraResult.success) {
      return res.status(400).json({ error: `RRA submission failed: ${rraResult.error}` });
    }

    // ── RRA SUCCEEDED — now write to Firestore as admin ────────

    // ── STEP 10: Build invoice document ────────────────────────
    const returnDeadline = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const invoice = {
      invoiceId,
      orderId,
      sellerId:        seller.uid,
      sellerTIN:       seller.tinNumber,
      sellerName:      seller.businessName,
      buyerId:         buyer.uid,
      buyerTIN:        buyer.tinNumber || '000000000',
      buyerName:       buyer.businessName || order.buyerName,
      purchaseCode:    codeResult.purchaseCode,
      items:           enrichedItems,
      subtotal,
      vatAmount,
      total,
      signature:       rraResult.signature,
      internalData:    rraResult.internalData,
      receiptNumber:   rraResult.receiptNumber,
      sdcId:           rraResult.sdcId,
      sdcDateTime:     rraResult.sdcDateTime,
      qrCode:          rraResult.qrCode,
      returnStatus:    null,
      returnDeadline,
      returnedItems:   [],
      returnedAt:      null,
      creditNoteId:    null,
      createdAt:       adminDb.FieldValue
        ? adminDb.FieldValue.serverTimestamp()
        : new Date().toISOString(),
    };

    // Use admin.firestore.FieldValue for server timestamp
    const FieldValue = (await import('firebase-admin')).default.firestore.FieldValue;
    invoice.createdAt = FieldValue.serverTimestamp();

    // ── STEP 11: Atomic batch write ─────────────────────────────
    const batch = adminDb.batch();

    // a. Update order to confirmed
    batch.update(orderRef, {
      status:       ORDER_STATUS.CONFIRMED,
      purchaseCode: codeResult.purchaseCode,
      invoiceId,
      confirmedAt:  FieldValue.serverTimestamp(),
    });

    // b. Save invoice
    const invoiceRef = adminDb.collection(Collections.INVOICES).doc(invoiceId);
    batch.set(invoiceRef, invoice);

    // c. Deduct seller stock per item
    for (const item of order.items) {
      const stkId  = stockId(seller.uid, item.productId);
      const stkRef = adminDb.collection(Collections.STOCK).doc(stkId);
      const stkDoc = await stkRef.get();

      if (stkDoc.exists) {
        const current = stkDoc.data();
        batch.update(stkRef, {
          quantity:     round(current.quantity - item.quantity),
          lastSaleDate: FieldValue.serverTimestamp(),
          updatedAt:    FieldValue.serverTimestamp(),
        });
      }
    }

    // d. Add buyer stock per item
    for (const item of order.items) {
      const buyerStockId  = stockId(buyer.uid, item.productId);
      const buyerStockRef = adminDb.collection(Collections.STOCK).doc(buyerStockId);
      const buyerStockDoc = await buyerStockRef.get();

      const buyerStockType = buyer.role === ROLES.MANUFACTURER
        ? STOCK_TYPES.RAW_MATERIAL
        : STOCK_TYPES.INVENTORY;

      if (buyerStockDoc.exists) {
        // Update existing — weighted average price
        const existing   = buyerStockDoc.data();
        const oldQty     = existing.quantity || 0;
        const newQty     = round(oldQty + item.quantity);
        const avgPrice   = round(
          ((oldQty * (existing.buyingPrice || 0)) + (item.quantity * item.unitPrice)) / newQty
        );
        batch.update(buyerStockRef, {
          quantity:         newQty,
          buyingPrice:      avgPrice,
          lastPurchaseDate: FieldValue.serverTimestamp(),
          updatedAt:        FieldValue.serverTimestamp(),
        });
      } else {
        // Create new stock document
        batch.set(buyerStockRef, {
          stockId:          buyerStockId,
          ownerId:          buyer.uid,
          productId:        item.productId,
          productName:      item.productName,
          unit:             item.unit,
          stockType:        buyerStockType,
          source:           'purchased',
          quantity:         round(item.quantity),
          buyingPrice:      round(item.unitPrice),
          sellingPrice:     round(item.unitPrice),
          lastPurchaseDate: FieldValue.serverTimestamp(),
          lastSaleDate:     null,
          updatedAt:        FieldValue.serverTimestamp(),
        });
      }
    }

    // Commit everything atomically
    await batch.commit();

    // ── STEP 12: Return success ────────────────────────────────
    return res.status(200).json({
      success:   true,
      invoiceId,
      receiptNumber: rraResult.receiptNumber,
    });

  } catch (error) {
    console.error('[confirmOrder] Error:', error);
    return res.status(500).json({
      error: 'Server error. Please try again.',
    });
  }
}

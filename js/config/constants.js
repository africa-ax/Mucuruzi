// ============================================================
//  MUCURUZI — Constants
//  Single source of truth for all fixed values in the app.
// ============================================================

// ── User Roles ───────────────────────────────────────────────
const ROLES = {
  MANUFACTURER: 'manufacturer',
  DISTRIBUTOR:  'distributor',
  RETAILER:     'retailer',
  EXPORTER:     'exporter',   // buys locally, sells internationally, zero-rated VAT
  BUYER:        'buyer',
};

const ROLE_LABELS = {
  manufacturer: 'Manufacturer',
  distributor:  'Distributor',
  retailer:     'Retailer',
  exporter:     'Exporter',
  buyer:        'Buyer',
};

// Manufacturer business sub-types (stored on user profile)
// Both treated as role: manufacturer — only affects stock source label
const BUSINESS_TYPES = {
  PRODUCER:  'producer',   // makes goods locally  → 🏭 Produced
  IMPORTER:  'importer',   // brings goods from outside Rwanda → 🚢 Imported
};

// Source labels for stock cards
const STOCK_SOURCE_LABELS = {
  produced:  '🏭 Produced',
  imported:  '🚢 Imported',
  purchased: '📦 Purchased',
};

// What each role can do
// Exporter CANNOT sell on domestic marketplace
const ROLE_CAN_SELL = [ROLES.MANUFACTURER, ROLES.DISTRIBUTOR, ROLES.RETAILER];
const ROLE_CAN_BUY  = [ROLES.DISTRIBUTOR, ROLES.RETAILER, ROLES.EXPORTER, ROLES.BUYER];

// Roles that need TIN + SDC
const ROLE_NEEDS_TIN = [ROLES.MANUFACTURER, ROLES.DISTRIBUTOR, ROLES.RETAILER, ROLES.EXPORTER];

// ── VAT ──────────────────────────────────────────────────────
const VAT = {
  RATE:         0.18,
  RATE_PERCENT: 18,
  LABEL:        'VAT (18%)',
};

// ── RRA Tax Grades ───────────────────────────────────────────
const TAX_GRADES = {
  A: { code: 'A', label: 'Standard Rate', vatRate: 0.18, description: 'Standard VAT 18%' },
  B: { code: 'B', label: 'Zero Rated',    vatRate: 0,    description: 'Zero-rated (exports, basic foods)' },
  C: { code: 'C', label: 'Exempt',        vatRate: 0,    description: 'VAT exempt goods/services' },
  D: { code: 'D', label: 'Non-VAT',       vatRate: 0,    description: 'Outside VAT scope' },
};

// ── Units of Measure ─────────────────────────────────────────
const UNITS = {
  KG:'KG', G:'G', L:'L', ML:'ML', PCS:'PCS',
  BOX:'BOX', PACK:'PACK', DOZEN:'DOZEN', BAG:'BAG',
  CRATE:'CRATE', PAIR:'PAIR', SET:'SET', MTR:'MTR', CM:'CM',
};

const UNIT_LIST = Object.values(UNITS);

// ── Stock Types ──────────────────────────────────────────────
const STOCK_TYPES = {
  INVENTORY:    'inventory',
  RAW_MATERIAL: 'rawMaterial',
};

// Manufacturer and Exporter buying → rawMaterial
// Everyone else → inventory
const getStockType = (buyerRole) => {
  return buyerRole === ROLES.MANUFACTURER
    ? STOCK_TYPES.RAW_MATERIAL
    : STOCK_TYPES.INVENTORY;
};

// ── Order Statuses ───────────────────────────────────────────
const ORDER_STATUS = {
  PENDING:   'pending',
  CONFIRMED: 'confirmed',
  REJECTED:  'rejected',
};

const ORDER_STATUS_LABELS = {
  pending:   'Pending',
  confirmed: 'Confirmed',
  rejected:  'Rejected',
};

// ── Invoice ──────────────────────────────────────────────────
const INVOICE = {
  PREFIX:    'INV',
  EBM_LABEL: 'EBM Compliant Invoice',
  CURRENCY:  'RWF',
  COUNTRY:   'Rwanda',
};

// ── RRA ──────────────────────────────────────────────────────
const RRA = {
  SANDBOX_URL:          'https://sandbox.rra.gov.rw',
  PURCHASE_CODE_PREFIX: 'PC',
  SIGNATURE_PREFIX:     'RRA-SIG',
  QR_BASE_URL:          'https://verify.rra.gov.rw/invoice/',
};

// ── Pagination ───────────────────────────────────────────────
const PAGINATION = {
  DEFAULT_LIMIT:    20,
  MARKETPLACE_LIMIT: 24,
};

// ── App Info ─────────────────────────────────────────────────
const APP = {
  NAME:    'Mucuruzi',
  TAGLINE: "Rwanda's Digital Supply Chain",
  VERSION: '1.0.0',
  SUPPORT: 'support@mucuruzi.rw',
};

// ── Menu Config ──────────────────────────────────────────────
const MENU_ITEMS = {
  manufacturer: [
    { id: 'dashboard',     label: 'Dashboard',     icon: '◈' },
    { id: 'products',      label: 'My Products',   icon: '⬡' },
    { id: 'inventory',     label: 'Inventory',     icon: '📦' },
    { id: 'raw-materials', label: 'Raw Materials', icon: '◎' },
    { id: 'orders',        label: 'Orders',        icon: '◫' },
    { id: 'invoices',      label: 'Invoices',      icon: '◻' },
    { id: 'marketplace',   label: 'Marketplace',   icon: '⊞' },
    { id: 'profile',       label: 'Profile',       icon: '◯' },
  ],
  distributor: [
    { id: 'dashboard',   label: 'Dashboard',   icon: '◈' },
    { id: 'inventory',   label: 'Inventory',   icon: '⬡' },
    { id: 'orders',      label: 'Orders',      icon: '◫' },
    { id: 'invoices',    label: 'Invoices',    icon: '◻' },
    { id: 'marketplace', label: 'Marketplace', icon: '⊞' },
    { id: 'profile',     label: 'Profile',     icon: '◯' },
  ],
  retailer: [
    { id: 'dashboard',   label: 'Dashboard',   icon: '◈' },
    { id: 'inventory',   label: 'Inventory',   icon: '⬡' },
    { id: 'walkin',      label: 'Walk-in Sale', icon: '⊕' },
    { id: 'orders',      label: 'Orders',      icon: '◫' },
    { id: 'invoices',    label: 'Receipts',    icon: '◻' },
    { id: 'marketplace', label: 'Marketplace', icon: '⊞' },
    { id: 'profile',     label: 'Profile',     icon: '◯' },
  ],
  exporter: [
    { id: 'dashboard',   label: 'Dashboard',   icon: '◈' },
    { id: 'inventory',   label: 'Inventory',   icon: '📦' },
    { id: 'orders',      label: 'Orders',      icon: '◫' },
    { id: 'invoices',    label: 'Invoices',    icon: '◻' },
    { id: 'marketplace', label: 'Browse Market', icon: '⊞' },
    { id: 'profile',     label: 'Profile',     icon: '◯' },
  ],
  buyer: [
    { id: 'dashboard',   label: 'Dashboard',   icon: '◈' },
    { id: 'orders',      label: 'My Orders',   icon: '◫' },
    { id: 'invoices',    label: 'My Receipts', icon: '◻' },
    { id: 'marketplace', label: 'Marketplace', icon: '⊞' },
    { id: 'profile',     label: 'Profile',     icon: '◯' },
  ],
};

// ── Price Helpers ────────────────────────────────────────────
const Price = {
  round: (value) => parseFloat(parseFloat(value).toFixed(2)),

  calcVAT: (subtotal, taxGrade = 'A') => {
    const grade = TAX_GRADES[taxGrade] || TAX_GRADES.A;
    return Price.round(subtotal * grade.vatRate);
  },

  calcTotal: (subtotal, taxGrade = 'A') => {
    return Price.round(subtotal + Price.calcVAT(subtotal, taxGrade));
  },

  format: (value) => {
    const num = parseFloat(value) || 0;
    return num.toLocaleString('en-RW') + ' RWF';
  },
};

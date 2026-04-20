// ============================================================
//  MUCURUZI — Constants
//  Single source of truth for all fixed values in the app.
//  Never hardcode these anywhere else.
// ============================================================

// ── User Roles ───────────────────────────────────────────────
const ROLES = {
  MANUFACTURER: 'manufacturer',
  DISTRIBUTOR:  'distributor',
  RETAILER:     'retailer',
  BUYER:        'buyer',
};

const ROLE_LABELS = {
  manufacturer: 'Manufacturer',
  distributor:  'Distributor',
  retailer:     'Retailer',
  buyer:        'Buyer',
};

// What each role can do — used in UI and service guards
const ROLE_CAN_SELL = [ROLES.MANUFACTURER, ROLES.DISTRIBUTOR, ROLES.RETAILER];
const ROLE_CAN_BUY  = [ROLES.DISTRIBUTOR, ROLES.RETAILER, ROLES.BUYER];

// ── VAT ──────────────────────────────────────────────────────
const VAT = {
  RATE:         0.18,          // 18% standard Rwanda VAT
  RATE_PERCENT: 18,            // display only
  LABEL:        'VAT (18%)',
};

// ── RRA Tax Grades ───────────────────────────────────────────
// Grade determines VAT applicability per RRA classification
const TAX_GRADES = {
  A: { code: 'A', label: 'Standard Rate',  vatRate: 0.18,  description: 'Standard VAT 18%' },
  B: { code: 'B', label: 'Zero Rated',     vatRate: 0,     description: 'Zero-rated goods (exports, basic foods)' },
  C: { code: 'C', label: 'Exempt',         vatRate: 0,     description: 'VAT exempt goods/services' },
  D: { code: 'D', label: 'Non-VAT',        vatRate: 0,     description: 'Outside VAT scope' },
};

// ── Units of Measure (RRA standard uppercase) ────────────────
const UNITS = {
  KG:    'KG',
  G:     'G',
  L:     'L',
  ML:    'ML',
  PCS:   'PCS',
  BOX:   'BOX',
  PACK:  'PACK',
  DOZEN: 'DOZEN',
  BAG:   'BAG',
  CRATE: 'CRATE',
  PAIR:  'PAIR',
  SET:   'SET',
  MTR:   'MTR',
  CM:    'CM',
};

const UNIT_LIST = Object.values(UNITS);

// ── Stock Types ──────────────────────────────────────────────
const STOCK_TYPES = {
  INVENTORY:    'inventory',     // all roles except manufacturer raw input
  RAW_MATERIAL: 'rawMaterial',   // manufacturer purchasing inputs
};

// Rule: if buyer is Manufacturer → stock goes to rawMaterial
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
  PREFIX:     'INV',
  EBM_LABEL:  'EBM Compliant Invoice',
  CURRENCY:   'RWF',
  COUNTRY:    'Rwanda',
};

// ── RRA Simulation ──────────────────────────────────────────
const RRA = {
  SANDBOX_URL:    'https://sandbox.rra.gov.rw',  // placeholder
  PURCHASE_CODE_PREFIX: 'PC',
  SIGNATURE_PREFIX:     'RRA-SIG',
  QR_BASE_URL:          'https://verify.rra.gov.rw/invoice/',
};

// ── Pagination ───────────────────────────────────────────────
const PAGINATION = {
  DEFAULT_LIMIT: 20,
  MARKETPLACE_LIMIT: 24,
};

// ── App Info ─────────────────────────────────────────────────
const APP = {
  NAME:        'Mucuruzi',
  TAGLINE:     "Rwanda's Digital Supply Chain",
  VERSION:     '1.0.0',
  SUPPORT:     'support@mucuruzi.rw',
};

// ── Menu Config (role-based sidebar items) ───────────────────
const MENU_ITEMS = {
  manufacturer: [
    { id: 'dashboard',    label: 'Dashboard',      icon: '◈' },
    { id: 'products',     label: 'My Products',    icon: '⬡' },
    { id: 'raw-materials',label: 'Raw Materials',  icon: '◎' },
    { id: 'orders',       label: 'Orders',         icon: '◫' },
    { id: 'invoices',     label: 'Invoices',       icon: '◻' },
    { id: 'marketplace',  label: 'Marketplace',    icon: '⊞' },
    { id: 'profile',      label: 'Profile',        icon: '◯' },
  ],
  distributor: [
    { id: 'dashboard',    label: 'Dashboard',      icon: '◈' },
    { id: 'inventory',    label: 'Inventory',      icon: '⬡' },
    { id: 'orders',       label: 'Orders',         icon: '◫' },
    { id: 'invoices',     label: 'Invoices',       icon: '◻' },
    { id: 'marketplace',  label: 'Marketplace',    icon: '⊞' },
    { id: 'profile',      label: 'Profile',        icon: '◯' },
  ],
  retailer: [
    { id: 'dashboard',    label: 'Dashboard',      icon: '◈' },
    { id: 'inventory',    label: 'Inventory',      icon: '⬡' },
    { id: 'walkin',       label: 'Walk-in Sale',   icon: '⊕' },
    { id: 'orders',       label: 'Orders',         icon: '◫' },
    { id: 'invoices',     label: 'Receipts',       icon: '◻' },
    { id: 'marketplace',  label: 'Marketplace',    icon: '⊞' },
    { id: 'profile',      label: 'Profile',        icon: '◯' },
  ],
  buyer: [
    { id: 'dashboard',    label: 'Dashboard',      icon: '◈' },
    { id: 'orders',       label: 'My Orders',      icon: '◫' },
    { id: 'invoices',     label: 'My Receipts',    icon: '◻' },
    { id: 'marketplace',  label: 'Marketplace',    icon: '⊞' },
    { id: 'profile',      label: 'Profile',        icon: '◯' },
  ],
};

// ── Price Helpers ────────────────────────────────────────────
// ALWAYS use these — never raw arithmetic on prices
const Price = {
  // Round to 2 decimal places safely
  round: (value) => parseFloat(parseFloat(value).toFixed(2)),

  // Calculate VAT amount for a given taxGrade and subtotal
  calcVAT: (subtotal, taxGrade = 'A') => {
    const grade = TAX_GRADES[taxGrade] || TAX_GRADES.A;
    return Price.round(subtotal * grade.vatRate);
  },

  // Calculate total including VAT
  calcTotal: (subtotal, taxGrade = 'A') => {
    return Price.round(subtotal + Price.calcVAT(subtotal, taxGrade));
  },

  // Format as RWF currency string
  format: (value) => {
    const num = parseFloat(value) || 0;
    return num.toLocaleString('en-RW') + ' RWF';
  },
};

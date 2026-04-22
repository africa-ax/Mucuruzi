// ============================================================
//  MUCURUZI — formatters.js
//  Pure functions for formatting data for display.
//  Never modify data — only format for presentation.
// ============================================================

const Formatters = (() => {

  // ── Currency ─────────────────────────────────────────────────
  const formatCurrency = (amount) => {
    const num = parseFloat(amount) || 0;
    return num.toLocaleString('en-RW', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }) + ' RWF';
  };

  // ── Date ─────────────────────────────────────────────────────
  const formatDate = (timestamp) => {
    const date = _toDate(timestamp);
    if (!date) return '—';
    return date.toLocaleDateString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric',
    });
  };

  const formatDateTime = (timestamp) => {
    const date = _toDate(timestamp);
    if (!date) return '—';
    return date.toLocaleDateString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric',
    }) + ', ' + date.toLocaleTimeString('en-GB', {
      hour: '2-digit', minute: '2-digit',
    });
  };

  const timeAgo = (timestamp) => {
    const date = _toDate(timestamp);
    if (!date) return '—';
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
    if (seconds < 60)    return 'just now';
    if (seconds < 3600)  return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
    return formatDate(timestamp);
  };

  // ── Numbers ───────────────────────────────────────────────────
  const formatNumber = (value) => {
    const num = parseFloat(value) || 0;
    return num.toLocaleString('en-RW', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  // ── Labels ────────────────────────────────────────────────────
  const formatRole       = (role)   => ROLE_LABELS[role]         || role   || '—';
  const formatStatus     = (status) => ORDER_STATUS_LABELS[status]|| status || '—';
  const formatStockType  = (type)   => type === STOCK_TYPES.RAW_MATERIAL ? 'Raw Material' : 'Inventory';

  const formatTaxGrade = (grade) => {
    const g = TAX_GRADES[grade];
    return g ? `Grade ${grade} — ${g.label}` : (grade || '—');
  };

  const formatReturnStatus = (status) => {
    const map = {
      requested: 'Return Requested',
      approved:  'Return Approved',
      rejected:  'Return Rejected',
    };
    return map[status] || '—';
  };

  // ── Private ───────────────────────────────────────────────────
  const _toDate = (ts) => {
    if (!ts) return null;
    if (ts instanceof Date) return ts;
    if (ts.toDate) return ts.toDate();
    if (typeof ts === 'string' || typeof ts === 'number') return new Date(ts);
    return null;
  };

  return {
    formatCurrency, formatDate, formatDateTime, timeAgo,
    formatNumber, formatRole, formatStatus,
    formatStockType, formatTaxGrade, formatReturnStatus,
  };

})();

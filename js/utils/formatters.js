// ============================================================
//  MUCURUZI — formatters.js (stub — full version coming later)
// ============================================================
const Formatters = {
  currency: (value) => {
    const num = parseFloat(value) || 0;
    return num.toLocaleString('en-RW') + ' RWF';
  },
  date: (timestamp) => {
    if (!timestamp) return '—';
    const d = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return d.toLocaleDateString('en-RW', { day: '2-digit', month: 'short', year: 'numeric' });
  },
  datetime: (timestamp) => {
    if (!timestamp) return '—';
    const d = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return d.toLocaleString('en-RW');
  },
};
  

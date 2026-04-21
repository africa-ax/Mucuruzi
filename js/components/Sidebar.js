// ============================================================
//  MUCURUZI — Sidebar.js (stub — full version coming later)
// ============================================================
const Sidebar = {
  render: (user) => console.log('[Sidebar] render for:', user?.role),
  hide:   ()     => {
    const el = document.getElementById('sidebar');
    if (el) el.classList.add('hidden');
  },
};
      

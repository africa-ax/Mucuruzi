// ============================================================
//  MUCURUZI — Navbar.js (stub — full version coming later)
// ============================================================
const Navbar = {
  render: (user) => console.log('[Navbar] render for:', user?.role),
  hide:   ()     => {
    const el = document.getElementById('navbar');
    if (el) el.classList.add('hidden');
  },
};

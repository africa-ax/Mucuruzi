// ============================================================
//  MUCURUZI — app.js
//  Entry point. Boots the app, listens to auth state,
//  shows login screen or dashboard based on auth status.
// ============================================================

// Stub view objects for files not yet built
// These prevent crashes until we build each view in later phases
const DashboardView      = { show: (u) => { document.getElementById('app-root').innerHTML = `<div style="padding:2rem;color:var(--color-text)"><h2>Welcome, ${u.businessName}</h2><p style="color:var(--color-text-muted);margin-top:.5rem">Role: ${u.role} — Dashboard coming in next phase.</p></div>`; } };
const ProductListView    = { show: () => {} };
const ProductFormView    = { show: () => {} };
const InventoryView      = { show: () => {} };
const RawMaterialsView   = { show: () => {} };
const OrderListView      = { show: () => {} };
const OrderFormView      = { show: () => {} };
const OrderDetailView    = { show: () => {} };
const WalkInSaleView     = { show: () => {} };
const InvoiceListView    = { show: () => {} };
const InvoiceView        = { show: () => {} };
const MarketplaceView    = { show: () => {} };
const BusinessProfileView= { show: () => {} };
const ProductDetailView  = { show: () => {} };
const ProfileView        = { show: () => {} };

// ── App State ────────────────────────────────────────────────
const App = {
  currentUser: null,
};

// ── Boot ─────────────────────────────────────────────────────
const bootApp = () => {
  const root   = document.getElementById('app-root');
  const loader = document.getElementById('app-loader');

  // Listen for Firebase auth state changes
  AuthService.onAuthStateChanged((userProfile) => {

    // Hide loader, show root
    if (loader) loader.classList.add('fade-out');
    if (root)   root.classList.remove('hidden');

    if (userProfile) {
      // User is logged in — save to app state
      App.currentUser = userProfile;
      console.log('[App] Logged in as:', userProfile.email, '|', userProfile.role);

      // Show dashboard (stub for now — full dashboard in next phase)
      DashboardView.show(userProfile);

    } else {
      // Not logged in — show login screen
      App.currentUser = null;
      console.log('[App] Not logged in — showing auth screen');
      AuthView.showLogin();
    }
  });
};

// ── Start ─────────────────────────────────────────────────────
// Wait for DOM to be ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootApp);
} else {
  bootApp();
}

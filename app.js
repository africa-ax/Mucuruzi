// ============================================================
//  MUCURUZI — app.js
//  Main entry point. First logic that runs after all files load.
//
//  Responsibilities:
//  1. Hide the boot loading screen
//  2. Start Firebase auth state listener
//  3. Route user to correct screen based on auth state
//  4. Wire up the router to render views
// ============================================================

// ── Global State ─────────────────────────────────────────────
// currentUser is available to all views and services
window.currentUser = null;

// ── Boot ──────────────────────────────────────────────────────
const App = (() => {

  /**
   * Hide the initial boot loader shown in index.html.
   */
  const _hideBootLoader = () => {
    const loader = document.getElementById('app-loader');
    const root   = document.getElementById('app-root');
    if (loader) loader.classList.add('fade-out');
    if (root)   root.classList.remove('hidden');
    setTimeout(() => { if (loader) loader.remove(); }, 500);
  };

  /**
   * Set up authenticated layout (navbar + sidebar).
   * Called every time a user is confirmed logged in.
   */
  const _setupLayout = (user) => {
    Navbar.render(user);
    Sidebar.render(user);
  };

  /**
   * Tear down authenticated layout.
   * Called when user logs out.
   */
  const _tearDownLayout = () => {
    Navbar.remove();
    Sidebar.remove();
  };

  /**
   * Render the correct view based on current route.
   */
  const _renderView = (route) => {
    const root = document.getElementById('app-root');
    if (!root) return;

    Navbar.setTitle(route.title);

    switch (route.view) {
      case 'auth':
        _tearDownLayout();
        const hash = window.location.hash;
        if (hash === '#register') AuthView.showRegister();
        else if (hash === '#forgot-password') AuthView.showForgotPassword();
        else AuthView.showLogin();
        break;

      case 'dashboard':
        DashboardView.render(window.currentUser, root);
        break;

      case 'products':
        ProductListView.render(window.currentUser, root);
        break;

      case 'raw-materials':
        RawMaterialsView.render(window.currentUser, root);
        break;

      case 'inventory':
        InventoryView.render(window.currentUser, root);
        break;

      case 'walkin':
        WalkInSaleView.render(window.currentUser, root);
        break;

      case 'orders':
        OrderListView.render(window.currentUser, root);
        break;

      case 'order-detail':
        OrderDetailView.render(window.currentUser, route.params, root);
        break;

      case 'invoices':
        InvoiceListView.render(window.currentUser, root);
        break;

      case 'invoice-detail':
        InvoiceView.render(window.currentUser, route.params, root);
        break;

      case 'marketplace':
        MarketplaceView.render(window.currentUser, root);
        break;

      case 'business-profile':
        BusinessProfileView.render(window.currentUser, route.params, root);
        break;

      case 'product-detail':
        ProductDetailView.render(window.currentUser, route.params, root);
        break;

      case 'profile':
        ProfileView.render(window.currentUser, root);
        break;

      case '404':
        root.innerHTML = `
          <div class="empty-state" style="padding-top: 80px;">
            <div class="empty-state-icon">404</div>
            <h2 class="empty-state-title">Page Not Found</h2>
            <p class="empty-state-text">The page you are looking for does not exist.</p>
            <button class="btn btn-primary" onclick="Router.navigate('#dashboard')">
              Go to Dashboard
            </button>
          </div>
        `;
        break;

      default:
        Router.navigate('#dashboard');
    }
  };

  /**
   * Initialize the app.
   * Called once when all scripts have loaded.
   */
  const init = () => {

    // ── Auth State Listener ──────────────────────────────────
    // This is the single source of truth for who is logged in.
    AuthService.onAuthStateChanged(async (user) => {

      _hideBootLoader();

      if (user) {
        // User is logged in
        window.currentUser = user;
        _setupLayout(user);

        // Wire router to view renderer — only once
        Router.onRouteChange(_renderView);
        Router.init();

      } else {
        // User is logged out
        window.currentUser = null;
        _tearDownLayout();

        // Show login — always
        Router.onRouteChange(_renderView);
        Router.init();
      }
    });
  };

  return { init };

})();

// ── Start ─────────────────────────────────────────────────────
// Wait for DOM to be fully ready before initializing
document.addEventListener('DOMContentLoaded', App.init);

// ============================================================
//  MUCURUZI — router.js
//  Simple hash-based client-side router.
//  No library needed — pure vanilla JS.
//
//  Usage:
//    Router.navigate('#dashboard')
//    Router.getCurrentRoute()
// ============================================================

const Router = (() => {

  // ── Route Definitions ─────────────────────────────────────────
  // Maps hash → {view, allowedRoles, title}
  const ROUTES = {
    '#login':         { view: 'auth',          allowedRoles: null,                                        title: 'Sign In' },
    '#register':      { view: 'auth',          allowedRoles: null,                                        title: 'Register' },
    '#dashboard':     { view: 'dashboard',     allowedRoles: Object.values(ROLES),                        title: 'Dashboard' },
    '#products':      { view: 'products',      allowedRoles: [ROLES.MANUFACTURER],                        title: 'My Products' },
    '#raw-materials': { view: 'raw-materials', allowedRoles: [ROLES.MANUFACTURER],                        title: 'Raw Materials' },
    '#inventory':     { view: 'inventory',     allowedRoles: [ROLES.DISTRIBUTOR, ROLES.RETAILER],         title: 'Inventory' },
    '#walkin':        { view: 'walkin',        allowedRoles: [ROLES.RETAILER],                            title: 'Walk-in Sale' },
    '#orders':        { view: 'orders',        allowedRoles: Object.values(ROLES),                        title: 'Orders' },
    '#invoices':      { view: 'invoices',      allowedRoles: Object.values(ROLES),                        title: 'Invoices' },
    '#marketplace':   { view: 'marketplace',   allowedRoles: Object.values(ROLES),                        title: 'Marketplace' },
    '#profile':       { view: 'profile',       allowedRoles: Object.values(ROLES),                        title: 'Profile' },
  };

  // Routes with dynamic params e.g. #order/ORD-001
  const DYNAMIC_ROUTES = [
    { pattern: /^#order\/(.+)$/,       view: 'order-detail',     title: 'Order Details' },
    { pattern: /^#invoice\/(.+)$/,     view: 'invoice-detail',   title: 'Invoice' },
    { pattern: /^#business\/(.+)$/,    view: 'business-profile', title: 'Business' },
    { pattern: /^#product-detail\/(.+)$/, view: 'product-detail', title: 'Product' },
  ];

  let _currentRoute = null;
  let _onRouteChange = null;

  // ── Navigate ──────────────────────────────────────────────────
  const navigate = (hash) => {
    window.location.hash = hash;
  };

  // ── Get Current Route ─────────────────────────────────────────
  const getCurrentRoute = () => _currentRoute;

  // ── On Route Change Callback ──────────────────────────────────
  const onRouteChange = (callback) => {
    _onRouteChange = callback;
  };

  // ── Resolve Route ─────────────────────────────────────────────
  const _resolveRoute = (hash) => {
    // Static routes
    if (ROUTES[hash]) return { ...ROUTES[hash], hash, params: null };

    // Dynamic routes
    for (const route of DYNAMIC_ROUTES) {
      const match = hash.match(route.pattern);
      if (match) {
        return {
          view:         route.view,
          title:        route.title,
          allowedRoles: Object.values(ROLES), // all logged-in roles
          hash,
          params:       match[1],
        };
      }
    }

    // Fallback
    return { view: '404', hash, title: 'Not Found', allowedRoles: null, params: null };
  };

  // ── Handle Hash Change ────────────────────────────────────────
  const _handleHashChange = () => {
    const hash = window.location.hash || '#login';
    const route = _resolveRoute(hash);
    const user  = window.currentUser;

    // Not logged in — only allow auth routes
    if (!user) {
      if (route.view !== 'auth') {
        navigate('#login');
        return;
      }
      _currentRoute = route;
      if (_onRouteChange) _onRouteChange(route);
      return;
    }

    // Logged in — redirect away from auth pages
    if (route.view === 'auth') {
      navigate('#dashboard');
      return;
    }

    // Check role permission
    if (route.allowedRoles && !route.allowedRoles.includes(user.role)) {
      navigate('#dashboard');
      return;
    }

    _currentRoute = route;

    // Update page title in navbar
    const titleEl = document.getElementById('navbar-title');
    if (titleEl) titleEl.textContent = route.title;

    // Update active sidebar item
    Sidebar.setActive(hash);

    if (_onRouteChange) _onRouteChange(route);
  };

  // ── Init ──────────────────────────────────────────────────────
  const init = () => {
    window.addEventListener('hashchange', _handleHashChange);
    _handleHashChange(); // run once on load
  };

  return { navigate, getCurrentRoute, onRouteChange, init };

})();

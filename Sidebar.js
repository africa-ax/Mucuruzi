// ============================================================
//  MUCURUZI — Sidebar.js
//  Role-based left navigation menu.
//  On mobile: hidden by default, slides in on hamburger tap.
//  On mobile: auto-closes when a menu item is tapped.
// ============================================================

const Sidebar = (() => {

  let _isOpen = false;

  /**
   * Render and inject the sidebar into the layout.
   * @param {Object} user - current user profile
   */
  const render = (user) => {
    const existing = document.getElementById('app-sidebar');
    if (existing) existing.remove();

    const items   = MENU_ITEMS[user.role] || [];
    const current = window.location.hash || '#dashboard';

    const sidebar = document.createElement('aside');
    sidebar.id        = 'app-sidebar';
    sidebar.className = 'sidebar';
    sidebar.innerHTML = `
      <!-- Sidebar Header -->
      <div class="sidebar-header">
        <div class="sidebar-user-avatar">
          ${user.photoURL
            ? `<img src="${user.photoURL}" alt="avatar" />`
            : `<span>${user.businessName.charAt(0).toUpperCase()}</span>`
          }
        </div>
        <div class="sidebar-user-info">
          <p class="sidebar-user-name">${user.businessName}</p>
          <span class="badge badge-${user.role}">${Formatters.formatRole(user.role)}</span>
        </div>
      </div>

      <div class="sidebar-divider"></div>

      <!-- Navigation Items -->
      <nav class="sidebar-nav">
        ${items.map(item => `
          <a href="${'#' + item.id}"
             class="sidebar-item ${current === '#' + item.id ? 'active' : ''}"
             data-route="#${item.id}"
             onclick="Sidebar._onItemClick(event)">
            <span class="sidebar-icon">${item.icon}</span>
            <span class="sidebar-label">${item.label}</span>
          </a>
        `).join('')}
      </nav>

      <div class="sidebar-footer">
        <button class="sidebar-logout" onclick="Sidebar._handleLogout()">
          <span>⎋</span>
          <span>Sign Out</span>
        </button>
      </div>
    `;

    // Insert before app-root
    const appRoot = document.getElementById('app-root');
    if (appRoot) {
      appRoot.parentNode.insertBefore(sidebar, appRoot);
    } else {
      document.body.appendChild(sidebar);
    }

    // Overlay for mobile
    _ensureOverlay();
  };

  /**
   * Set the active sidebar item based on current route.
   * @param {string} hash
   */
  const setActive = (hash) => {
    document.querySelectorAll('.sidebar-item').forEach(item => {
      item.classList.toggle('active', item.dataset.route === hash);
    });
  };

  /**
   * Toggle sidebar open/closed (mobile).
   */
  const toggle = () => {
    _isOpen ? _close() : _open();
  };

  const _open = () => {
    const sidebar  = document.getElementById('app-sidebar');
    const overlay  = document.getElementById('sidebar-overlay');
    if (sidebar) sidebar.classList.add('sidebar-open');
    if (overlay) overlay.classList.add('overlay-show');
    _isOpen = true;
  };

  const _close = () => {
    const sidebar  = document.getElementById('app-sidebar');
    const overlay  = document.getElementById('sidebar-overlay');
    if (sidebar) sidebar.classList.remove('sidebar-open');
    if (overlay) overlay.classList.remove('overlay-show');
    _isOpen = false;
  };

  /**
   * Called when a menu item is tapped.
   * On mobile: closes sidebar automatically after tap.
   */
  const _onItemClick = (e) => {
    const route = e.currentTarget.dataset.route;
    if (window.innerWidth <= 768) _close(); // Option A — auto close on mobile
    Router.navigate(route);
    e.preventDefault();
  };

  /**
   * Handle logout from sidebar.
   */
  const _handleLogout = async () => {
    Modal.confirm('Are you sure you want to sign out?', async () => {
      Loader.show('Signing out...');
      await AuthService.logout();
      Loader.hide();
    }, 'Sign Out', 'btn-danger');
  };

  /**
   * Create mobile overlay backdrop.
   */
  const _ensureOverlay = () => {
    if (document.getElementById('sidebar-overlay')) return;
    const overlay     = document.createElement('div');
    overlay.id        = 'sidebar-overlay';
    overlay.className = 'sidebar-overlay';
    overlay.addEventListener('click', _close);
    document.body.appendChild(overlay);
  };

  /**
   * Remove sidebar (auth screens).
   */
  const remove = () => {
    const sidebar = document.getElementById('app-sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    if (sidebar) sidebar.remove();
    if (overlay) overlay.remove();
  };

  return { render, setActive, toggle, remove, _onItemClick, _handleLogout };

})();

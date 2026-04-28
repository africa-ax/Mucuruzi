// ============================================================
//  MUCURUZI — Sidebar.js
//  Three responsive states:
//
//  Desktop (>1024px):
//    - Full 240px sidebar, always visible
//    - Shows logo, user info, labels, all items
//
//  Tablet (768-1024px):
//    - Collapsed 64px, icons only
//    - Tooltip on hover shows label
//    - No hamburger needed
//
//  Mobile (<768px):
//    - Hidden off-screen
//    - Hamburger in navbar toggles it
//    - Slides in as overlay with backdrop
//    - Auto-closes when item tapped (Option A)
// ============================================================

const Sidebar = (() => {

  let _isOpen = false;

  const render = (user) => {
    const existing = document.getElementById('app-sidebar');
    if (existing) existing.remove();

    const items   = MENU_ITEMS[user.role] || [];
    const current = window.location.hash || '#dashboard';

    const sidebar = document.createElement('aside');
    sidebar.id        = 'app-sidebar';
    sidebar.className = 'sidebar';

    sidebar.innerHTML = `
      <!-- Brand (replaces navbar logo on desktop/tablet) -->
      <div class="sidebar-brand" onclick="Router.navigate('#dashboard')"
        style="cursor:pointer">
        <div class="sidebar-brand-logo">M</div>
        <span class="sidebar-brand-name">${APP.NAME}</span>
      </div>

      <!-- User Section -->
      <div class="sidebar-user" onclick="Router.navigate('#profile')">
        <div class="sidebar-user-avatar">
          ${user.photoURL
            ? `<img src="${user.photoURL}" alt="avatar" />`
            : `<span>${user.businessName.charAt(0).toUpperCase()}</span>`
          }
        </div>
        <div class="sidebar-user-info">
          <p class="sidebar-user-name">${user.businessName}</p>
          <span class="badge badge-${user.role}" style="font-size:0.62rem">
            ${Formatters.formatRole(user.role)}
          </span>
        </div>
      </div>

      <!-- Navigation -->
      <nav class="sidebar-nav">
        ${items.map(item => `
          <a
            href="#${item.id}"
            class="sidebar-item ${current === '#' + item.id ? 'active' : ''}"
            data-route="#${item.id}"
            onclick="Sidebar._onItemClick(event)">
            <span class="sidebar-icon">${item.icon}</span>
            <span class="sidebar-label">${item.label}</span>
            <span class="sidebar-tooltip">${item.label}</span>
          </a>
        `).join('')}
      </nav>

      <!-- Footer -->
      <div class="sidebar-footer">
        <button class="sidebar-logout" onclick="Sidebar._handleLogout()">
          <span class="sidebar-icon">⎋</span>
          <span class="sidebar-label">Sign Out</span>
          <span class="sidebar-tooltip">Sign Out</span>
        </button>
      </div>
    `;

    document.body.appendChild(sidebar);
    _ensureOverlay();
  };

  const setActive = (hash) => {
    document.querySelectorAll('.sidebar-item').forEach(item => {
      item.classList.toggle('active', item.dataset.route === hash);
    });
  };

  const toggle = () => {
    _isOpen ? _close() : _open();
  };

  const _open = () => {
    const sidebar = document.getElementById('app-sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    if (sidebar) sidebar.classList.add('sidebar-open');
    if (overlay) overlay.classList.add('overlay-show');
    _isOpen = true;
    document.body.style.overflow = 'hidden';
  };

  const _close = () => {
    const sidebar = document.getElementById('app-sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    if (sidebar) sidebar.classList.remove('sidebar-open');
    if (overlay) overlay.classList.remove('overlay-show');
    _isOpen = false;
    document.body.style.overflow = '';
  };

  // Auto-close on mobile after tapping item (Option A)
  const _onItemClick = (e) => {
    const route = e.currentTarget.dataset.route;
    if (window.innerWidth < 768) _close();
    Router.navigate(route);
    e.preventDefault();
  };

  const _handleLogout = () => {
    Modal.danger(
      'Sign Out',
      'Are you sure you want to sign out of Mucuruzi?',
      async () => {
        Loader.show('Signing out...');
        await AuthService.logout();
        Loader.hide();
        window.currentUser = null;
        Navbar.remove();
        Sidebar.remove();
        Router.navigate('#login');
      },
      'Sign Out'
    );
  };

  const _ensureOverlay = () => {
    if (document.getElementById('sidebar-overlay')) return;
    const overlay     = document.createElement('div');
    overlay.id        = 'sidebar-overlay';
    overlay.className = 'sidebar-overlay';
    overlay.addEventListener('click', _close);
    document.body.appendChild(overlay);
  };

  const remove = () => {
    const sidebar = document.getElementById('app-sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    if (sidebar) sidebar.remove();
    if (overlay) overlay.remove();
    document.body.style.overflow = '';
  };

  return { render, setActive, toggle, remove, _onItemClick, _handleLogout };

})();

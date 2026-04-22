// ============================================================
//  MUCURUZI — Navbar.js
//  Fixed top navigation bar shown on all authenticated screens.
// ============================================================

const Navbar = (() => {

  /**
   * Render and inject the navbar into the layout.
   * @param {Object} user - current user profile
   */
  const render = (user) => {
    const existing = document.getElementById('app-navbar');
    if (existing) existing.remove();

    const nav = document.createElement('nav');
    nav.id        = 'app-navbar';
    nav.className = 'navbar';
    nav.innerHTML = `
      <div class="navbar-left">
        <button class="navbar-hamburger" id="sidebar-toggle" onclick="Sidebar.toggle()">
          <span></span><span></span><span></span>
        </button>
        <a class="navbar-brand" href="#dashboard">
          <div class="navbar-logo">M</div>
          <span class="navbar-brand-name">${APP.NAME}</span>
        </a>
      </div>

      <div class="navbar-center">
        <span id="navbar-title" class="navbar-title">Dashboard</span>
      </div>

      <div class="navbar-right">
        <div class="navbar-user">
          <div class="navbar-user-info">
            <span class="navbar-user-name">${user.businessName}</span>
            <span class="badge badge-${user.role}">${Formatters.formatRole(user.role)}</span>
          </div>
          <button class="navbar-avatar" onclick="Router.navigate('#profile')">
            ${user.photoURL
              ? `<img src="${user.photoURL}" alt="avatar" />`
              : `<span>${user.businessName.charAt(0).toUpperCase()}</span>`
            }
          </button>
        </div>
      </div>
    `;

    document.body.prepend(nav);
  };

  /**
   * Update the page title shown in center of navbar.
   * @param {string} title
   */
  const setTitle = (title) => {
    const el = document.getElementById('navbar-title');
    if (el) el.textContent = title;
  };

  /**
   * Remove navbar (shown on auth screens).
   */
  const remove = () => {
    const el = document.getElementById('app-navbar');
    if (el) el.remove();
  };

  return { render, setTitle, remove };

})();

// ============================================================
//  MUCURUZI — Navbar.js
//  Fixed top bar. Adjusts based on screen size.
//  Desktop/Tablet: no hamburger (sidebar always visible)
//  Mobile: hamburger toggles sidebar overlay
// ============================================================

const Navbar = (() => {

  const render = (user) => {
    const existing = document.getElementById('app-navbar');
    if (existing) existing.remove();

    const nav = document.createElement('nav');
    nav.id        = 'app-navbar';
    nav.className = 'navbar';
    nav.innerHTML = `
      <div class="navbar-left">
        <!-- Hamburger: only visible on mobile via CSS -->
        <button class="navbar-hamburger" id="sidebar-toggle"
          onclick="Sidebar.toggle()" aria-label="Toggle menu">
          <span></span><span></span><span></span>
        </button>
        <!-- Brand: visible on mobile only (sidebar has brand on desktop) -->
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
            <span class="badge badge-${user.role}">
              ${Formatters.formatRole(user.role)}
            </span>
          </div>
          <button class="navbar-avatar" onclick="Router.navigate('#profile')"
            title="${user.businessName}">
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

  const setTitle = (title) => {
    const el = document.getElementById('navbar-title');
    if (el) el.textContent = title;
  };

  const remove = () => {
    const el = document.getElementById('app-navbar');
    if (el) el.remove();
  };

  return { render, setTitle, remove };

})();

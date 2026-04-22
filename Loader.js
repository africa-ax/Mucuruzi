// ============================================================
//  MUCURUZI — Loader.js
//  Loading states for async operations.
// ============================================================

const Loader = (() => {

  /**
   * Show full screen loading overlay.
   * @param {string} message
   */
  const show = (message = 'Loading...') => {
    let overlay = document.getElementById('loader-overlay');

    if (!overlay) {
      overlay    = document.createElement('div');
      overlay.id = 'loader-overlay';
      overlay.className = 'loader-overlay';
      document.body.appendChild(overlay);
    }

    overlay.innerHTML = `
      <div class="loader-overlay-inner">
        <div class="loader-spinner"></div>
        <p class="loader-overlay-text">${message}</p>
      </div>
    `;

    overlay.classList.add('loader-overlay-show');
  };

  /**
   * Hide full screen loading overlay.
   */
  const hide = () => {
    const overlay = document.getElementById('loader-overlay');
    if (overlay) {
      overlay.classList.remove('loader-overlay-show');
      setTimeout(() => overlay.remove(), 300);
    }
  };

  /**
   * Set loading state on a button.
   * @param {string}  btnId
   * @param {boolean} loading
   * @param {string}  label    - text to show when not loading
   * @param {string}  loadingLabel - text to show when loading
   */
  const button = (btnId, loading, label = 'Submit', loadingLabel = 'Loading...') => {
    const btn = document.getElementById(btnId);
    if (!btn) return;

    btn.disabled = loading;
    btn.innerHTML = loading
      ? `<span class="btn-spinner"></span> ${loadingLabel}`
      : label;
  };

  return { show, hide, button };

})();

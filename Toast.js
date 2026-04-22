// ============================================================
//  MUCURUZI — Toast.js
//  Global notification system.
//  Shows small messages at bottom of screen.
//  Auto-dismisses after 3 seconds.
// ============================================================

const Toast = (() => {

  const _container = () => document.getElementById('toast-container');

  const _icons = {
    success: '✓',
    error:   '✕',
    warning: '⚠',
    info:    'ℹ',
  };

  /**
   * Show a toast notification.
   * @param {string} message
   * @param {string} type - 'success' | 'error' | 'warning' | 'info'
   * @param {number} duration - ms (default 3500)
   */
  const show = (message, type = 'info', duration = 3500) => {
    const container = _container();
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
      <span class="toast-icon">${_icons[type] || _icons.info}</span>
      <span class="toast-message">${message}</span>
      <button class="toast-close" onclick="this.parentElement.remove()">✕</button>
    `;

    container.appendChild(toast);

    // Animate in
    requestAnimationFrame(() => toast.classList.add('toast-show'));

    // Auto dismiss
    setTimeout(() => {
      toast.classList.remove('toast-show');
      toast.classList.add('toast-hide');
      setTimeout(() => toast.remove(), 300);
    }, duration);
  };

  const success = (message) => show(message, 'success');
  const error   = (message) => show(message, 'error', 5000);
  const warning = (message) => show(message, 'warning');
  const info    = (message) => show(message, 'info');

  return { show, success, error, warning, info };

})();

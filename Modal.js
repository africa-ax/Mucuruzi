// ============================================================
//  MUCURUZI — Modal.js
//  Reusable modal dialog wrapper.
//  Used for confirmations, rejections, return requests etc.
// ============================================================

const Modal = (() => {

  const _container = () => document.getElementById('modal-container');

  /**
   * Show a modal dialog.
   *
   * @param {Object} options
   * @param {string}   options.title
   * @param {string}   options.body        - HTML string for modal body
   * @param {string}   [options.confirmText]  - default "Confirm"
   * @param {string}   [options.cancelText]   - default "Cancel"
   * @param {string}   [options.confirmClass] - CSS class for confirm btn, default 'btn-primary'
   * @param {Function} [options.onConfirm]
   * @param {Function} [options.onCancel]
   * @param {boolean}  [options.hideCancel]   - hide cancel button
   */
  const show = (options) => {
    const {
      title,
      body         = '',
      confirmText  = 'Confirm',
      cancelText   = 'Cancel',
      confirmClass = 'btn-primary',
      onConfirm    = null,
      onCancel     = null,
      hideCancel   = false,
    } = options;

    const container = _container();
    if (!container) return;

    container.innerHTML = `
      <div class="modal-overlay" id="modal-overlay">
        <div class="modal-box">
          <div class="modal-header">
            <h3 class="modal-title">${title}</h3>
            <button class="modal-close-btn" onclick="Modal.close()">✕</button>
          </div>
          <div class="modal-body">
            ${body}
          </div>
          <div class="modal-footer">
            ${!hideCancel ? `<button class="btn btn-secondary" id="modal-cancel">${cancelText}</button>` : ''}
            <button class="btn ${confirmClass}" id="modal-confirm">${confirmText}</button>
          </div>
        </div>
      </div>
    `;

    // Show with animation
    requestAnimationFrame(() => {
      const overlay = document.getElementById('modal-overlay');
      if (overlay) overlay.classList.add('modal-visible');
    });

    // Confirm button
    const confirmBtn = document.getElementById('modal-confirm');
    if (confirmBtn && onConfirm) {
      confirmBtn.addEventListener('click', () => {
        onConfirm();
        close();
      });
    }

    // Cancel button
    const cancelBtn = document.getElementById('modal-cancel');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => {
        if (onCancel) onCancel();
        close();
      });
    }

    // Backdrop click closes
    const overlay = document.getElementById('modal-overlay');
    if (overlay) {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) close();
      });
    }
  };

  /**
   * Close the modal.
   */
  const close = () => {
    const overlay = document.getElementById('modal-overlay');
    if (overlay) {
      overlay.classList.remove('modal-visible');
      setTimeout(() => {
        const container = _container();
        if (container) container.innerHTML = '';
      }, 250);
    }
  };

  /**
   * Shortcut: simple confirm dialog.
   */
  const confirm = (message, onConfirm, confirmText = 'Confirm', confirmClass = 'btn-primary') => {
    show({
      title:        'Confirm Action',
      body:         `<p>${message}</p>`,
      confirmText,
      confirmClass,
      onConfirm,
    });
  };

  /**
   * Shortcut: danger confirm (red button).
   */
  const danger = (title, message, onConfirm, confirmText = 'Delete') => {
    show({
      title,
      body:         `<p>${message}</p>`,
      confirmText,
      confirmClass: 'btn-danger',
      onConfirm,
    });
  };

  return { show, close, confirm, danger };

})();

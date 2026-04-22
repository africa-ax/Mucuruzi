// ============================================================
//  MUCURUZI — QRCode.js
//  Renders the RRA verification QR code on invoices.
//  Uses qrcode.js from CDN (loaded in index.html).
//  Falls back to plain URL text if library not available.
// ============================================================

const QRCodeRenderer = (() => {

  /**
   * Render a QR code into a container element.
   *
   * @param {string} containerId  - DOM element id to render into
   * @param {string} url          - the RRA verify URL to encode
   * @param {number} size         - pixel size (default 140)
   */
  const render = (containerId, url, size = 140) => {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = '';

    // Use qrcode.js if available (loaded via CDN in index.html)
    if (typeof QRCode !== 'undefined') {
      new QRCode(container, {
        text:            url,
        width:           size,
        height:          size,
        colorDark:       '#0a1628',
        colorLight:      '#ffffff',
        correctLevel:    QRCode.CorrectLevel.M,
      });
    } else {
      // Fallback: show URL as text with a border
      container.innerHTML = `
        <div class="qr-fallback">
          <p class="qr-fallback-label">Scan to verify</p>
          <a href="${url}" target="_blank" class="qr-fallback-url">${url}</a>
        </div>
      `;
    }
  };

  return { render };

})();

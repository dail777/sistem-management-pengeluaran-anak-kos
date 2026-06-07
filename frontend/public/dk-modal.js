// ============================================================
// Dompetku — Custom Confirm / Alert modal (replaces native alert/confirm)
// Exposes: window.dkConfirm({title, message, confirmText, cancelText, variant})
//          window.dkAlert({title, message, variant})
// Both return a Promise<boolean> (true on confirm/ok, false on cancel/dismiss).
// ============================================================
(function () {
  if (window.dkConfirm) return;

  function ensureRoot() {
    let root = document.getElementById("dk-modal-root");
    if (root) return root;
    root = document.createElement("div");
    root.id = "dk-modal-root";
    document.body.appendChild(root);
    return root;
  }

  function escapeHtml(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[c]));
  }

  function open(opts) {
    const {
      title = "Konfirmasi",
      message = "",
      confirmText = "Lanjutkan",
      cancelText = "Batal",
      variant = "primary", // primary | danger | warning
      hideCancel = false,
    } = opts || {};

    const root = ensureRoot();
    const id = "dk-cm-" + Date.now() + Math.random().toString(36).slice(2, 6);
    const variantClass = variant === "danger"
      ? "dk-cm-danger"
      : variant === "warning"
      ? "dk-cm-warning"
      : "dk-cm-primary";

    const html = `
      <div class="dk-cm-overlay" id="${id}" data-testid="dk-confirm-modal">
        <div class="dk-cm-box ${variantClass}" role="dialog" aria-modal="true">
          <div class="dk-cm-icon">
            <i class="ti ${
              variant === "danger" ? "ti-trash"
              : variant === "warning" ? "ti-alert-triangle"
              : "ti-help-circle"
            }"></i>
          </div>
          <div class="dk-cm-title" data-testid="dk-confirm-title">${escapeHtml(title)}</div>
          <div class="dk-cm-message" data-testid="dk-confirm-message">${escapeHtml(message).replace(/\n/g, "<br>")}</div>
          <div class="dk-cm-actions">
            ${hideCancel ? "" : `<button type="button" class="dk-cm-btn dk-cm-btn-cancel" data-testid="dk-confirm-cancel">${escapeHtml(cancelText)}</button>`}
            <button type="button" class="dk-cm-btn dk-cm-btn-confirm" data-testid="dk-confirm-ok">${escapeHtml(confirmText)}</button>
          </div>
        </div>
      </div>
    `;
    const wrap = document.createElement("div");
    wrap.innerHTML = html.trim();
    const overlay = wrap.firstChild;
    root.appendChild(overlay);

    return new Promise((resolve) => {
      function close(result) {
        overlay.classList.add("dk-cm-closing");
        setTimeout(() => {
          if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
          resolve(result);
        }, 140);
      }
      overlay.querySelector(".dk-cm-btn-confirm").addEventListener("click", () => close(true));
      const cancelBtn = overlay.querySelector(".dk-cm-btn-cancel");
      if (cancelBtn) cancelBtn.addEventListener("click", () => close(false));
      overlay.addEventListener("click", (e) => {
        if (e.target === overlay) close(false);
      });
      function escHandler(e) {
        if (e.key === "Escape") { close(false); document.removeEventListener("keydown", escHandler); }
        if (e.key === "Enter")  { close(true);  document.removeEventListener("keydown", escHandler); }
      }
      document.addEventListener("keydown", escHandler);
      // Focus confirm button for keyboard users
      setTimeout(() => {
        const c = overlay.querySelector(".dk-cm-btn-confirm");
        if (c) c.focus();
      }, 50);
    });
  }

  window.dkConfirm = (opts) => open({ ...opts });
  window.dkAlert = (opts) => open({
    cancelText: "",
    hideCancel: true,
    confirmText: "OK",
    variant: "warning",
    ...opts,
  });
})();

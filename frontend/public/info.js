// ============================================================
// Dompetku Info Pages — Tentang / Support / Bantuan modals
// + token refresh timer (sliding session, never expires while active)
// ============================================================
(function () {
  if (typeof window.DK_InfoBoot !== "undefined") return;

  const API_BASE =
    (window.REACT_APP_BACKEND_URL || window.location.origin).replace(/\/$/, "") +
    "/api";

  function getToken() {
    return sessionStorage.getItem("dk_auth_token") ||
      localStorage.getItem("dk_auth_token");
  }
  function setToken(t) {
    if (localStorage.getItem("dk_auth_token")) localStorage.setItem("dk_auth_token", t);
    else sessionStorage.setItem("dk_auth_token", t);
  }

  // ===== Token refresh (every 30 min, also on page focus if token > 6h old) =====
  let lastRefresh = Date.now();
  async function doRefresh() {
    const token = getToken();
    if (!token) return;
    try {
      const res = await fetch(API_BASE + "/auth/refresh", {
        method: "POST",
        headers: { Authorization: "Bearer " + token },
      });
      if (!res.ok) return;
      const data = await res.json();
      if (data.access_token) {
        setToken(data.access_token);
        lastRefresh = Date.now();
      }
    } catch (e) {
      // silent
    }
  }
  setInterval(doRefresh, 30 * 60 * 1000); // every 30 min
  window.addEventListener("focus", () => {
    if (Date.now() - lastRefresh > 6 * 60 * 60 * 1000) doRefresh();
  });

  // ===== Info pages =====
  const INFO_IDS = ["modal-tentang", "modal-support", "modal-bantuan"];

  function closeAllInfoModals() {
    INFO_IDS.forEach((id) => {
      const m = document.getElementById(id);
      if (m) m.style.display = "none";
    });
  }
  function openModal(id) {
    // Close any other info modal first so only one is visible at a time
    closeAllInfoModals();
    const m = document.getElementById(id);
    if (m) m.style.display = "flex";
  }
  function closeModal(id) {
    const m = document.getElementById(id);
    if (m) m.style.display = "none";
  }

  function setup() {
    document.querySelectorAll("[data-info-open]").forEach((btn) => {
      btn.addEventListener("click", () => openModal(btn.dataset.infoOpen));
    });
    document.querySelectorAll("[data-info-close]").forEach((btn) => {
      btn.addEventListener("click", () => closeModal(btn.dataset.infoClose));
    });
    document.querySelectorAll(".info-modal").forEach((m) => {
      m.addEventListener("click", (e) => {
        if (e.target === m) m.style.display = "none";
      });
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", setup);
  } else {
    setup();
  }

  window.DK_InfoBoot = true;
})();

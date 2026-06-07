// ============================================================
// Dompetku Auth Layer
// - Login & Register UI (modal)
// - JWT stored in sessionStorage
// - Fetches encrypted user data from backend → hydrates localStorage
// - Intercepts localStorage writes for dk_* keys to sync to backend
// ============================================================
(function () {
  const API_BASE =
    (window.REACT_APP_BACKEND_URL || window.location.origin).replace(/\/$/, "") +
    "/api";

  const TOKEN_KEY = "dk_auth_token";
  const USER_KEY = "dk_auth_user";
  const DATA_KEYS = ["dk_incomes", "dk_expenses", "dk_budgets", "dk_targets"];

  // -------- Token helpers --------
  function getToken() {
    return sessionStorage.getItem(TOKEN_KEY) || localStorage.getItem(TOKEN_KEY);
  }
  function setToken(t, remember) {
    if (remember) localStorage.setItem(TOKEN_KEY, t);
    else sessionStorage.setItem(TOKEN_KEY, t);
  }
  function clearToken() {
    sessionStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(USER_KEY);
  }
  function getUser() {
    try {
      return JSON.parse(sessionStorage.getItem(USER_KEY) || "null");
    } catch {
      return null;
    }
  }
  function setUser(u) {
    sessionStorage.setItem(USER_KEY, JSON.stringify(u));
  }

  async function api(path, opts = {}) {
    const headers = Object.assign(
      { "Content-Type": "application/json" },
      opts.headers || {}
    );
    const token = getToken();
    if (token) headers["Authorization"] = "Bearer " + token;
    const res = await fetch(API_BASE + path, { ...opts, headers });
    let body = null;
    try {
      body = await res.json();
    } catch (e) {}
    if (!res.ok) {
      const msg = (body && (body.detail || body.message)) || "Request failed";
      throw new Error(typeof msg === "string" ? msg : JSON.stringify(msg));
    }
    return body;
  }

  // -------- Backend sync (debounced) --------
  let syncTimer = null;
  let syncing = false;
  function scheduleSync() {
    if (!getToken()) return;
    clearTimeout(syncTimer);
    syncTimer = setTimeout(doSync, 350);
  }
  async function doSync() {
    if (syncing) return;
    syncing = true;
    setSyncIndicator("syncing");
    try {
      const payload = {
        incomes: JSON.parse(localStorage.getItem("dk_incomes") || "[]"),
        expenses: JSON.parse(localStorage.getItem("dk_expenses") || "[]"),
        budgets: JSON.parse(localStorage.getItem("dk_budgets") || "[]"),
        targets: JSON.parse(localStorage.getItem("dk_targets") || "[]"),
      };
      await api("/data", { method: "PUT", body: JSON.stringify(payload) });
      setSyncIndicator("ok");
    } catch (e) {
      console.error("Sync failed", e);
      setSyncIndicator("error");
    } finally {
      syncing = false;
    }
  }

  // Intercept localStorage.setItem for dk_* keys
  const _origSetItem = localStorage.setItem.bind(localStorage);
  localStorage.setItem = function (k, v) {
    _origSetItem(k, v);
    if (DATA_KEYS.includes(k)) scheduleSync();
  };

  function setSyncIndicator(state) {
    const el = document.getElementById("dk-sync-indicator");
    if (!el) return;
    el.classList.remove("ok", "syncing", "error");
    el.classList.add(state);
    if (state === "syncing") el.title = "Menyinkronkan ke server…";
    else if (state === "ok") el.title = "Tersimpan & terenkripsi di server";
    else el.title = "Gagal menyimpan — coba lagi";
  }

  // -------- Hydrate localStorage from backend --------
  async function hydrateFromBackend() {
    const data = await api("/data", { method: "GET" });
    // Use original setItem (no need to re-sync)
    _origSetItem("dk_incomes", JSON.stringify(data.incomes || []));
    _origSetItem("dk_expenses", JSON.stringify(data.expenses || []));
    _origSetItem("dk_budgets", JSON.stringify(data.budgets || []));
    _origSetItem("dk_targets", JSON.stringify(data.targets || []));
  }

  // -------- UI: auth screen --------
  const authScreen = () => document.getElementById("dk-auth-screen");
  const appWrap = () => document.querySelector(".app-main");
  const bottomNav = () => document.querySelector(".bottom-nav");
  const sidebarNav = () => document.querySelector(".sidebar-nav");

  function showAuthScreen() {
    if (authScreen()) authScreen().style.display = "flex";
    document.body.classList.add("dk-no-auth");
  }
  function hideAuthScreen() {
    if (authScreen()) authScreen().style.display = "none";
    document.body.classList.remove("dk-no-auth");
  }

  function setAuthError(msg) {
    const el = document.getElementById("dk-auth-error");
    if (!el) return;
    el.textContent = msg || "";
    el.style.display = msg ? "block" : "none";
  }
  function setAuthLoading(loading) {
    const btn = document.getElementById("dk-auth-submit");
    if (!btn) return;
    btn.disabled = !!loading;
    btn.dataset.loading = loading ? "1" : "0";
  }

  let authMode = "login"; // or "register"

  function renderAuthMode() {
    const t = document.getElementById("dk-auth-title");
    const sub = document.getElementById("dk-auth-sub");
    const emailField = document.getElementById("dk-auth-email-field");
    const btn = document.getElementById("dk-auth-submit");
    const toggle = document.getElementById("dk-auth-toggle");
    if (authMode === "login") {
      t.textContent = "Masuk ke Dompetku";
      sub.textContent = "Catatan keuanganmu, terenkripsi & aman.";
      emailField.style.display = "none";
      btn.textContent = "Masuk";
      toggle.innerHTML =
        'Belum punya akun? <a href="#" id="dk-auth-toggle-link">Daftar di sini</a>';
    } else {
      t.textContent = "Buat Akun Baru";
      sub.textContent = "Datamu akan dienkripsi AES-256 di server.";
      emailField.style.display = "";
      btn.textContent = "Daftar";
      toggle.innerHTML =
        'Sudah punya akun? <a href="#" id="dk-auth-toggle-link">Masuk</a>';
    }
    setAuthError("");
    document
      .getElementById("dk-auth-toggle-link")
      .addEventListener("click", (e) => {
        e.preventDefault();
        authMode = authMode === "login" ? "register" : "login";
        renderAuthMode();
      });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setAuthError("");
    setAuthLoading(true);
    const username = document.getElementById("dk-auth-username").value.trim();
    const password = document.getElementById("dk-auth-password").value;
    const email = document.getElementById("dk-auth-email").value.trim();
    const remember = document.getElementById("dk-auth-remember").checked;
    try {
      if (!username || !password) throw new Error("Isi username dan password");
      if (authMode === "register" && password.length < 6)
        throw new Error("Password minimal 6 karakter");
      const path = authMode === "login" ? "/auth/login" : "/auth/register";
      const body =
        authMode === "login"
          ? { username, password }
          : { username, password, email: email || undefined };
      const res = await api(path, {
        method: "POST",
        body: JSON.stringify(body),
      });
      setToken(res.access_token, remember);
      setUser(res.user);
      await hydrateFromBackend();
      finishLogin();
    } catch (err) {
      setAuthError(err.message || "Terjadi kesalahan");
    } finally {
      setAuthLoading(false);
    }
  }

  function showUserBadge() {
    const user = getUser();
    const el = document.getElementById("dk-user-badge");
    const nameEl = document.getElementById("dk-user-name");
    if (el) el.style.display = user ? "flex" : "none";
    if (nameEl && user) nameEl.textContent = user.username;
  }

  function finishLogin() {
    hideAuthScreen();
    showUserBadge();
    if (!window.__dompetkuStarted) {
      window.__dompetkuStarted = true;
      // Load original app script
      const s = document.createElement("script");
      s.src = "script.js";
      s.onload = () => {
        if (typeof window.__dompetkuInit === "function")
          window.__dompetkuInit();
      };
      document.body.appendChild(s);
    } else if (typeof window.__dompetkuInit === "function") {
      // re-init after re-login
      window.location.reload();
    }
  }

  function logout() {
    if (!confirm("Keluar dari akun?")) return;
    // Clear local cache, but data is safe on server
    DATA_KEYS.forEach((k) => _origSetItem(k, "[]"));
    clearToken();
    window.location.reload();
  }

  // -------- Boot --------
  async function boot() {
    renderAuthMode();
    document
      .getElementById("dk-auth-form")
      .addEventListener("submit", handleSubmit);
    document
      .getElementById("dk-logout-btn")
      .addEventListener("click", logout);

    const token = getToken();
    if (!token) {
      showAuthScreen();
      return;
    }
    try {
      // verify token by fetching /auth/me, then hydrate data
      const u = await api("/auth/me");
      setUser(u);
      await hydrateFromBackend();
      finishLogin();
    } catch (e) {
      console.warn("Auto-login failed:", e.message);
      clearToken();
      showAuthScreen();
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();

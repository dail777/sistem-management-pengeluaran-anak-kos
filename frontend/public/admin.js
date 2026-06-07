// ============================================================
// Dompetku Admin Dashboard
// Loaded only when logged-in user.is_admin === true.
// ============================================================
(function () {
  if (typeof window.DK_AdminBoot !== "undefined") return;

  const API_BASE =
    "sistem-management-pengeluaran-anak-kos-production.up.railway.app/api";

  function getToken() {
    return sessionStorage.getItem("dk_auth_token") ||
      localStorage.getItem("dk_auth_token");
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
    try { body = await res.json(); } catch (e) {}
    if (!res.ok) {
      let msg = body && (body.detail || body.message);
      if (Array.isArray(msg)) msg = msg.map((e) => e.msg || e).join(", ");
      if (!msg) msg = `Permintaan gagal (${res.status})`;
      throw new Error(msg);
    }
    return body;
  }

  let users = [];
  let total = 0;

  function render() {
    const grid = document.getElementById("admin-user-grid");
    const totalEl = document.getElementById("admin-total-users");
    const countLabel = document.getElementById("admin-result-count");
    if (totalEl) totalEl.textContent = total;
    if (countLabel) countLabel.textContent = users.length;
    if (!grid) return;
    if (users.length === 0) {
      grid.innerHTML = `<div class="admin-empty"><i class="ti ti-users-off"></i><div>Tidak ada user yang cocok</div></div>`;
      return;
    }
    grid.innerHTML = users
      .map(
        (u) => `
        <div class="admin-user-card" data-testid="admin-user-row">
          <div class="admin-user-avatar"><i class="ti ti-user"></i></div>
          <div class="admin-user-info">
            <div class="admin-user-name" data-testid="admin-user-username">${escapeHtml(u.username)}</div>
            <div class="admin-user-email">${escapeHtml(u.email || "tanpa email")}</div>
            <div class="admin-user-meta">
              <span class="admin-pill"><i class="ti ti-calendar"></i> ${fmtDate(u.created_at)}</span>
              <span class="admin-pill admin-pill-id"><i class="ti ti-id"></i> ${u.id.slice(0, 8)}</span>
            </div>
          </div>
          <div class="admin-user-actions">
            <button class="btn-primary btn-sm" data-action="change-password" data-id="${u.id}" data-username="${escapeHtml(u.username)}" data-testid="admin-change-pw-btn">
              <i class="ti ti-key"></i> Ganti Password
            </button>
            <button class="btn-danger btn-sm" data-action="delete-user" data-id="${u.id}" data-username="${escapeHtml(u.username)}" data-testid="admin-delete-user-btn">
              <i class="ti ti-trash"></i> Hapus
            </button>
          </div>
        </div>
      `
      )
      .join("");

    grid.querySelectorAll('[data-action="change-password"]').forEach((btn) => {
      btn.addEventListener("click", () => openChangePassword(btn.dataset.id, btn.dataset.username));
    });
    grid.querySelectorAll('[data-action="delete-user"]').forEach((btn) => {
      btn.addEventListener("click", () => deleteUser(btn.dataset.id, btn.dataset.username));
    });
  }

  function escapeHtml(s) {
    return String(s || "").replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[c]));
  }
  function fmtDate(iso) {
    if (!iso) return "—";
    try {
      const d = new Date(iso);
      return d.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
    } catch (e) { return iso; }
  }

  async function refresh(q = "") {
    try {
      const data = await api(`/admin/users${q ? `?q=${encodeURIComponent(q)}` : ""}`);
      users = data.users || [];
      total = data.total ?? users.length;
      render();
    } catch (e) {
      console.error(e);
      if (window.dkAlert) {
        await window.dkAlert({ title: "Gagal memuat data", message: e.message, variant: "danger" });
      } else {
        alert("Gagal memuat data: " + e.message);
      }
    }
  }

  function openChangePassword(uid, username, isSelf = false) {
    const modal = document.getElementById("admin-pw-modal");
    document.getElementById("admin-pw-target").textContent = username;
    document.getElementById("admin-pw-new").value = "";
    document.getElementById("admin-pw-error").style.display = "none";
    modal.dataset.uid = uid;
    modal.dataset.self = isSelf ? "1" : "0";
    modal.style.display = "flex";
    setTimeout(() => document.getElementById("admin-pw-new").focus(), 100);
  }

  function closeChangePassword() {
    document.getElementById("admin-pw-modal").style.display = "none";
  }

  async function submitChangePassword(e) {
    e.preventDefault();
    const modal = document.getElementById("admin-pw-modal");
    const uid = modal.dataset.uid;
    const isSelf = modal.dataset.self === "1";
    const username = document.getElementById("admin-pw-target").textContent || "user";
    const newPassword = document.getElementById("admin-pw-new").value;
    const errEl = document.getElementById("admin-pw-error");
    errEl.style.display = "none";
    if (!newPassword || newPassword.length < 6) {
      errEl.textContent = "Password minimal 6 karakter";
      errEl.style.display = "block";
      return;
    }
    // Confirm dialog before applying
    const ok = window.dkConfirm
      ? await window.dkConfirm({
          title: isSelf ? "Ganti password admin?" : "Ganti password user?",
          message: isSelf
            ? `Password akun admin akan diperbarui. Pastikan kamu mengingatnya — tanpa password ini kamu tidak bisa masuk lagi.`
            : `Password untuk "${username}" akan diperbarui. User harus login ulang dengan password baru.`,
          confirmText: "Ya, ganti",
          cancelText: "Batal",
          variant: "warning",
        })
      : confirm("Yakin ganti password?");
    if (!ok) return;
    try {
      const endpoint = isSelf
        ? "/admin/me/password"
        : `/admin/users/${uid}/password`;
      await api(endpoint, {
        method: "POST",
        body: JSON.stringify({ new_password: newPassword }),
      });
      closeChangePassword();
      showAdminToast(
        isSelf
          ? "Password admin berhasil diubah ✓"
          : "Password berhasil diubah ✓"
      );
    } catch (e) {
      errEl.textContent = e.message;
      errEl.style.display = "block";
    }
  }

  async function deleteUser(uid, username) {
    const ok = window.dkConfirm
      ? await window.dkConfirm({
          title: `Hapus akun "${username}"?`,
          message:
            "Seluruh data finansial user ini (pemasukan, pengeluaran, budget, target) akan dihapus permanen. Aksi ini TIDAK dapat dibatalkan.",
          confirmText: "Ya, hapus",
          cancelText: "Batal",
          variant: "danger",
        })
      : confirm(`Hapus akun "${username}"?`);
    if (!ok) return;
    try {
      await api(`/admin/users/${uid}`, { method: "DELETE" });
      showAdminToast(`Akun "${username}" berhasil dihapus`);
      const search = document.getElementById("admin-search-input");
      refresh(search ? search.value : "");
    } catch (e) {
      if (window.dkAlert) {
        await window.dkAlert({ title: "Gagal menghapus", message: e.message, variant: "danger" });
      } else {
        alert("Gagal menghapus: " + e.message);
      }
    }
  }

  function showAdminToast(msg) {
    let t = document.getElementById("admin-toast");
    if (!t) {
      t = document.createElement("div");
      t.id = "admin-toast";
      t.className = "admin-toast";
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.classList.add("show");
    setTimeout(() => t.classList.remove("show"), 2200);
  }

  window.DK_AdminBoot = function () {
    document.getElementById("admin-dashboard").style.display = "block";
    document.body.classList.add("dk-admin-mode");

    const search = document.getElementById("admin-search-input");
    let timer;
    search.addEventListener("input", () => {
      clearTimeout(timer);
      timer = setTimeout(() => refresh(search.value), 250);
    });

    document.getElementById("admin-refresh-btn").addEventListener("click", () => {
      search.value = "";
      refresh();
    });

    document.getElementById("admin-pw-form").addEventListener("submit", submitChangePassword);
    document.getElementById("admin-pw-close").addEventListener("click", closeChangePassword);
    document.getElementById("admin-pw-cancel").addEventListener("click", closeChangePassword);
    document.getElementById("admin-pw-modal").addEventListener("click", (e) => {
      if (e.target.id === "admin-pw-modal") closeChangePassword();
    });

    const selfBtn = document.getElementById("admin-self-pw-btn");
    if (selfBtn) {
      selfBtn.addEventListener("click", () => {
        const user = JSON.parse(
          sessionStorage.getItem("dk_auth_user") ||
            localStorage.getItem("dk_auth_user") ||
            "{}"
        );
        openChangePassword(user.id || "self", user.username || "admin", true);
      });
    }

    refresh();
  };
})();

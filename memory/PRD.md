# Dompetku — PRD

## Original Problem Statement
> tambahkan fitur login dan register dan data base berbasis json, semua data yang perlu masuk di database masukkan ke database seperti akun, pemasukan, pengeluaran, budget, target menabung, sisa keuangan dan lain lainnya. dan data data tersebut yang ada di json diencryptsi agar tidak dapat diubah oleh orang dengan mudah

## User Choices (Indonesian, verbatim)
- Arsitektur: **(b)** Tetap vanilla HTML/CSS/JS, tambah backend FastAPI ringan untuk auth + file JSON ter-enkripsi.
- Enkripsi: **(a)** AES-256 simetris (AES-256-GCM).
- Autentikasi: JWT-based custom auth (7-day sliding via `/api/auth/refresh`).
- Format JSON: Dipisah per user (`/app/backend/data/users/{user_id}.json.enc`).
- Admin: `admin` / `admin123` (seeded di startup, terpisah dari data finansial).

## Architecture
- **Frontend**: vanilla HTML/CSS/JS di `/app/frontend/public/`
  - `index.html`, `style.css`, `script.js`, `auth.js`, `admin.js`, `info.js`, **`dk-modal.js`** (custom confirm/alert).
- **Backend**: FastAPI di `/app/backend/server.py`
  - Auth: `/api/auth/register|login|refresh|me`
  - Data: `/api/data` (GET/PUT)
  - Admin: `/api/admin/users`, `/api/admin/users/{uid}/password`, `/api/admin/me/password`, `DELETE /api/admin/users/{uid}`
  - AES-256-GCM (`cryptography.hazmat.primitives.ciphers.aead.AESGCM`).
  - Password: bcrypt. JWT: HS256.

## Implemented Features

### Iteration 1 (2026-06-07)
- [x] Login/Register UI Indonesia + JWT (7d) + AES-256-GCM at-rest
- [x] Per-user encrypted data file
- [x] Hydrate + debounced auto-sync localStorage ↔ backend

### Iteration 2 (2026-06-07)
- [x] `/api/auth/refresh` sliding 7-day
- [x] Admin Dashboard (list, search, change-pw)
- [x] Info menu (Tentang/Support/Bantuan) + dev IG cards + QRIS placeholder
- [x] Saving target validasi budget bulanan

### Iteration 3 (2026-06-07)
- [x] Admin DELETE user (+ file enkripsi terhapus)
- [x] Admin ganti password sendiri
- [x] Modal "Lupa Password" di login (5 IG developer)
- [x] Format expense menabung = `menabung - nama target`
- [x] Setor: warning saat tidak ada budget

### Iteration 4 (2026-06-07) — current
- [x] **Custom-designed confirm/alert modal** (`dk-modal.js`) — replace SEMUA native `alert()`/`confirm()` (logout, target delete, expense delete, setor 4 branches, tx form validation, admin delete, admin change-pw, admin self-pw).
- [x] **Konfirmasi tambahan** untuk Admin: Hapus User (danger variant) + Ganti Password User/Admin (warning variant) — 2-step (form submit → confirm).
- [x] **Desktop layout polish** — sidebar visible di kiri, bottom-nav hidden, `.app-main` centered (max-width 800px, justify-self center), `body.dk-admin-mode` jadi `display: block` + `.admin-dashboard` centered (max-width 1100px). No horizontal overflow.
- [x] **Info modals exclusivity** — `closeAllInfoModals()` dipanggil sebelum buka modal Tentang/Support/Bantuan.
- [x] **Info modals z-index BEHIND action modals** — info: 150, action (tx/setor/add-target/history/admin-pw): 300, dk-cm-overlay: 9800, modal-forgot: 9500, auth: 9000.
- [x] **Setor menabung kurangi budget total** — `budgets[].amount -= nominal` saat setor; menabung di-EXCLUDE dari `Terpakai` budget calc untuk hindari double-count.
- [x] **Warning saat setor === sisa budget** — dk-confirm warning variant: "Pemasukan & budget akan habis!" dengan tombol Lanjutkan/Batal.

## Testing Status
- Backend pytest: **47/47 PASS** (`/app/backend/tests/`)
- Frontend testing_agent_v3: **~95%** PASS (iteration_4.json) — semua flow utama E2E verified.
- Reports: `/app/test_reports/iteration_{1..4}.json`

## Test Credentials
- See `/app/memory/test_credentials.md` (admin/admin123).

## Backlog
- P2: asyncio.Lock pada file writes (race kondisi multi-write)
- P2: Export/import data ter-enkripsi dari profile
- P2: Multi-device sync conflict resolution
- P2: Audit log untuk aksi admin (ganti pw / delete user)
- P2: Statistik perbandingan bulan-ke-bulan (grafik + insight)

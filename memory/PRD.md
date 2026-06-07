# Dompetku — PRD

## Original Problem Statement
> tambahkan fitur login dan register dan data base berbasis json, semua data yang perlu masuk di database masukkan ke database seperti akun, pemasukan, pengeluaran, budget, target menabung, sisa keuangan dan lain lainnya. dan data data tersebut yang ada di json diencryptsi agar tidak dapat diubah oleh orang dengan mudah

## User Choices (Indonesian, verbatim)
- Arsitektur: **(b)** Tetap vanilla HTML/CSS/JS, tambah backend FastAPI ringan untuk auth + file JSON ter-enkripsi.
- Enkripsi: **(a)** AES-256 simetris (implemented as AES-256-GCM).
- Autentikasi: **(a)** JWT-based custom auth (username + email opsional + password) — 7-day sliding via `/api/auth/refresh`.
- Format JSON: **Dipisah per user** (`/app/backend/data/users/{user_id}.json.enc`).
- Admin: `admin` / `admin123` (seeded at startup, separate from financial data).

## Architecture
- **Frontend**: vanilla HTML/CSS/JS at `/app/frontend/public/` (`index.html`, `style.css`, `script.js`, `auth.js`, `admin.js`, `info.js`).
- **Backend**: FastAPI in `/app/backend/server.py`
  - Auth: `/api/auth/register|login|refresh|me`
  - Data: `/api/data` (GET/PUT)
  - Admin: `/api/admin/users` (list+search), `/api/admin/users/{uid}/password`, `/api/admin/me/password`, `DELETE /api/admin/users/{uid}`
  - AES-256-GCM via `cryptography.hazmat.primitives.ciphers.aead.AESGCM` (12-byte nonce + base64 storage).
  - Passwords hashed with bcrypt. JWT HS256.

## Implemented Features
### Iteration 1 (2026-06-07)
- [x] Login/Register UI (Indonesian) + JWT (7-day) + AES-256-GCM at-rest
- [x] Per-user encrypted data file (incomes/expenses/budgets/targets)
- [x] Auto-hydrate + debounced auto-sync localStorage ↔ backend
- [x] Sync status indicator, Logout, Ingat saya

### Iteration 2 (2026-06-07)
- [x] `/api/auth/refresh` sliding 7-day session
- [x] Admin Dashboard (list, search, change-password)
- [x] Top-right info menu (Tentang / Support / Bantuan modals with 5 developer Insta cards + QRIS placeholder)
- [x] Saving target (menabung) deduction validates against monthly budget

### Iteration 3 (2026-06-07)
- [x] Admin can DELETE users (also removes encrypted data file)
- [x] Admin can change own password (`POST /api/admin/me/password`)
- [x] Forgot Password popup on login screen (`Hubungi developer untuk mengganti password :` + 5 dev IG placeholders)
- [x] Expense label format `menabung - nama target` (lowercase, dash separator, no duplicate "Menabung", no parentheses) on Dashboard recent + Semua Pengeluaran list
- [x] Setor flow now warns when no monthly budget is set (`Belum ada budget bulan ini...`) before proceeding

## Testing
- 47/47 pytest backend tests PASS (3 test suites under `/app/backend/tests/`)
- Frontend e2e via testing_agent_v3: admin flow, forgot-modal, hydration, label format — all PASS
- Reports: `/app/test_reports/iteration_1.json`, `/app/test_reports/iteration_2.json`

## Test Credentials
See `/app/memory/test_credentials.md` (admin / admin123).

## Backlog
- P2: asyncio.Lock around file writes (concurrent write races)
- P2: Export/import encrypted data file from user profile
- P2: Multi-device sync conflict resolution
- P2: Replace native `alert()` / `confirm()` with on-brand custom modals
- P2: Audit log for admin actions (password changes / deletions)
- P2: data-testid on per-target Setor button for tighter E2E selectors

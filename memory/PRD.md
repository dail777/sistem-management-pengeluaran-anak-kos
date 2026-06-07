# Dompetku — PRD

## Original Problem Statement
> tambahkan fitur login dan register dan data base berbasis json, semua data yang perlu masuk di database masukkan ke database seperti akun, pemasukan, pengeluaran, budget, target menabung, sisa keuangan dan lain lainnya. dan data data tersebut yang ada di json diencryptsi agar tidak dapat diubah oleh orang dengan mudah

## User Choices (Indonesian, verbatim)
- Arsitektur: **(b)** Tetap vanilla HTML/CSS/JS, tambah backend FastAPI ringan untuk auth + file JSON ter-enkripsi. Tampilan & kode UI tetap sama.
- Enkripsi: **(a)** AES-256 simetris (implemented as AES-256-GCM).
- Autentikasi: **(a)** JWT-based custom auth (username + email opsional + password).
- Format JSON: **Dipisah per user** (`/app/backend/data/users/{user_id}.json.enc`).

## Architecture
- **Frontend**: vanilla HTML/CSS/JS at `/app/frontend/public/` (`index.html`, `style.css`, `script.js`, `auth.js`).
  - `script.js` is the user's original Dompetku app, wrapped as `window.__dompetkuInit`.
  - `auth.js` handles login/register UI, JWT storage, and bidirectional sync between localStorage and backend.
  - `localStorage.setItem('dk_*', ...)` is intercepted to debounce-push the full data dict to `PUT /api/data`.
  - CRA dev server still serves it from port 3000 (supervisor-managed); React `src/index.js` is a no-op.
- **Backend**: FastAPI in `/app/backend/server.py`
  - `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me`
  - `GET /api/data`, `PUT /api/data` (Bearer-token protected)
  - JWT signed with `JWT_SECRET` (HS256, 7-day expiry)
  - Passwords hashed with bcrypt
  - User registry: `/app/backend/data/users.json.enc`
  - Per-user data: `/app/backend/data/users/{uid}.json.enc`
  - Encryption: AES-256-GCM via `cryptography.hazmat.primitives.ciphers.aead.AESGCM` with 12-byte random nonce, base64-encoded on disk. Master key in `AES_KEY` env (base64 32 bytes).

## Implemented Features (2026-06-07)
- [x] Login & Register UI (Indonesian, modal-less full-screen card)
- [x] JWT issuance + 7-day expiry, Bearer-token auth, /me verification
- [x] AES-256-GCM encryption-at-rest for users registry AND per-user data
- [x] Per-user data file (incomes, expenses, budgets, targets)
- [x] Auto-hydrate localStorage from backend on login
- [x] Auto-sync localStorage → backend on every write (debounced 350ms)
- [x] Sync status indicator (green ✓ / yellow … / red ✗)
- [x] Logout with confirm
- [x] "Ingat saya" remember-me (localStorage vs sessionStorage token)
- [x] Friendly Indonesian error messages mapped from HTTP status
- [x] Duplicate username/email rejection
- [x] Bcrypt password hashing
- [x] User-to-user data isolation (verified by tests)

## Backlog
- P1: Refresh-token / token rotation
- P1: Password change & forgot-password flow (with email integration)
- P2: Add asyncio.Lock around file writes to prevent race conditions at scale
- P2: Optional client-side AES wrapping before send (zero-knowledge mode)
- P2: Export/import encrypted data file from user profile
- P2: Multi-device sync conflict resolution

## Test Credentials
See `/app/memory/test_credentials.md`.

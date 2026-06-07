# Dompetku — Deployment Guide

Panduan lengkap untuk deploy **Dompetku** ke GitHub (source code) dan Railway (backend), serta hosting frontend.

> Stack: FastAPI + AES-256-GCM + JWT (backend) · Vanilla HTML/CSS/JS (frontend) · file-based encrypted JSON storage.

---

## ❶ Generate Secret Keys (WAJIB sebelum deploy)

Jalankan di terminal mana saja yang punya Python 3:

```bash
python3 -c "import secrets,base64; print('AES_KEY=' + base64.b64encode(secrets.token_bytes(32)).decode()); print('JWT_SECRET=' + secrets.token_hex(32))"
```

Contoh output (JANGAN pakai contoh ini, generate sendiri!):
```
AES_KEY=PkvHzX27o12B7ANW1FCsEkMV/kb8wAvo8d+ZUfF82IA=
JWT_SECRET=91e6d327847cde277efa512aa9c2436ae4537e357e86acbbaaf7b469b78ae0f0
```

⚠️ **PENTING**:
- Simpan `AES_KEY` dengan baik. Jika hilang, **semua data user terenkripsi tidak bisa dibuka lagi**.
- `JWT_SECRET` boleh diganti kapan saja (cuma membuat semua session logout).
- **JANGAN commit `.env` ke GitHub**.

---

## ❷ Persiapan Repo GitHub

1. **Pastikan `.gitignore` sudah benar** (root project):

```gitignore
# secrets
.env
backend/.env
frontend/.env
*.env.local

# user data (encrypted JSON files)
backend/data/

# python
__pycache__/
*.pyc
.pytest_cache/

# node
node_modules/
frontend/build/

# OS
.DS_Store
Thumbs.db
```

2. **Buat `backend/.env.example`** (template untuk Railway):

```env
AES_KEY=
JWT_SECRET=
DATA_DIR=/data
CORS_ORIGINS=https://your-frontend-domain.com,http://localhost:3000
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin123
PORT=8001
```

3. **Push ke GitHub** — pakai fitur **"Save to GitHub"** di chat input Emergent (paling mudah).
   Manual alternatif:
   ```bash
   cd /app
   git init
   git add .
   git commit -m "initial: Dompetku"
   git remote add origin https://github.com/<username>/dompetku.git
   git push -u origin main
   ```

---

## ❸ Deploy Backend ke Railway

### 3.1 Konfigurasi Railway

1. Buka **railway.app** → New Project → **Deploy from GitHub repo** → pilih repo dompetku.
2. Railway akan auto-detect Python. **Override root directory** ke `backend/`:
   - Settings → Service → **Root Directory** = `backend`
3. **Start Command** (Settings → Deploy):
   ```bash
   uvicorn server:app --host 0.0.0.0 --port $PORT
   ```
4. **Build Command** (kosongkan; Railway pakai `pip install -r requirements.txt` otomatis).

### 3.2 Tambahkan Persistent Volume (PENTING)

File JSON terenkripsi harus persisten across deploys:

1. Service → **Volumes** → New Volume.
2. **Mount Path**: `/data`
3. **Size**: 1 GB cukup untuk ribuan user.

### 3.3 Environment Variables

Service → **Variables** → tambah satu-per-satu:

| Variable | Value | Catatan |
|---|---|---|
| `AES_KEY` | (hasil generate di langkah ❶) | **Backup di password manager!** |
| `JWT_SECRET` | (hasil generate di langkah ❶) | Random 64-char hex |
| `DATA_DIR` | `/data` | Path volume di langkah 3.2 |
| `CORS_ORIGINS` | `https://your-frontend.vercel.app,https://username.github.io` | Pisah koma, tanpa trailing slash |
| `PORT` | `8001` | Railway suntik sendiri lewat `$PORT`, biarkan kosong / auto |
| `ADMIN_USERNAME` *(opsional)* | `admin` | Default `admin` |
| `ADMIN_PASSWORD` *(opsional)* | `admin123` | **Wajib ganti setelah deploy lewat UI** |

### 3.4 Deploy & Test

- Klik **Deploy**. Tunggu build selesai (1-2 menit).
- Railway kasih URL publik, contoh: `https://dompetku-backend.up.railway.app`.
- Test:
  ```bash
  curl https://dompetku-backend.up.railway.app/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"username":"admin","password":"admin123"}'
  ```
- Login pertama kali via UI ke admin, lalu **GANTI PASSWORD ADMIN** lewat menu "Ganti Password Saya".

---

## ❹ Deploy Frontend (3 pilihan)

Frontend ini **vanilla HTML/CSS/JS** di `frontend/public/`. Tapi karena pakai placeholder `%PUBLIC_URL%` (CRA), perlu build dulu:

```bash
cd frontend
yarn install
REACT_APP_BACKEND_URL=https://dompetku-backend.up.railway.app yarn build
# Hasil build ada di frontend/build/
```

### Pilihan A: **Vercel** (paling gampang) ⭐

1. Sign up di vercel.com → New Project → Import repo GitHub.
2. **Root Directory**: `frontend`
3. **Framework Preset**: Create React App
4. **Environment Variables**:
   - `REACT_APP_BACKEND_URL` = `https://dompetku-backend.up.railway.app`
5. Deploy → dapat URL `https://your-app.vercel.app`.
6. **Balik ke Railway → update `CORS_ORIGINS`** = URL Vercel di atas.

### Pilihan B: **GitHub Pages**

1. Di `frontend/package.json` tambahkan:
   ```json
   "homepage": "https://<username>.github.io/dompetku"
   ```
2. Install gh-pages:
   ```bash
   cd frontend
   yarn add -D gh-pages
   ```
3. Tambah script:
   ```json
   "predeploy": "REACT_APP_BACKEND_URL=https://dompetku-backend.up.railway.app yarn build",
   "deploy": "gh-pages -d build"
   ```
4. Jalankan: `yarn deploy`
5. Update `CORS_ORIGINS` di Railway dengan URL GitHub Pages.

### Pilihan C: **Railway juga (1 platform)**

1. Di Railway project yg sama → **+ New** → **Empty Service**.
2. Connect ke repo yang sama, **Root Directory** = `frontend`.
3. **Build Command**: `yarn install && yarn build`
4. **Start Command**: `npx serve -s build -p $PORT`
5. **Env**: `REACT_APP_BACKEND_URL` = URL backend Railway.

---

## ❺ Checklist Pasca-Deploy

- [ ] Login `admin` / `admin123` berhasil
- [ ] **Ganti password admin** lewat menu Hamburger → Profil
- [ ] Coba register user baru → data tersimpan
- [ ] Cek di Railway → Volumes → `/data/users/` ada file `.json.enc`
- [ ] Reload browser → data masih ada (proof of persistence)
- [ ] CORS tidak error di browser console
- [ ] HTTPS aktif (otomatis dari Railway & Vercel)
- [ ] **Backup `AES_KEY` di password manager**

---

## ❻ Troubleshooting

| Issue | Solusi |
|---|---|
| **CORS error** di browser | Tambah origin frontend ke `CORS_ORIGINS` di Railway, redeploy. |
| **502/503 Railway** saat boot | Cek logs Railway: biasanya `DATA_DIR` belum di-mount → set ke `/data` setelah buat volume. |
| **`AES_KEY` invalid** | Pastikan persis hasil `base64(32 bytes)`, **tanpa spasi/quote**. Generate ulang kalau ragu. |
| **Data hilang setelah redeploy** | Volume belum di-mount. Tambahkan persistent volume ke `/data`. |
| **Login gagal padahal password benar** | `JWT_SECRET` ganti-ganti? Setiap kali ganti = semua session invalid. Set sekali & pertahankan. |
| **502 Frontend** | Cek `REACT_APP_BACKEND_URL` di env Vercel/Railway frontend benar. |

---

## ❼ Biaya Estimasi (per bulan)

- **Railway**: $5 hobby plan + ~$1 untuk volume 1GB (cukup untuk <500 user).
- **Vercel**: Free (hobby) — unlimited bandwidth utk personal use.
- **GitHub Pages**: Free.
- **Total minimum**: ~$5-6/bulan kalau pakai Railway+Vercel.

---

**Selesai!** 🚀 Kalau ada error tertentu, kirim screenshot/log nya — saya bantu debug.

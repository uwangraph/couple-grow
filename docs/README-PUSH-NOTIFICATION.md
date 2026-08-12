# 📱 Panduan Push Notification (FCM) — CoupleGrow

Aplikasi Android CoupleGrow memakai **Firebase Cloud Messaging (FCM)** untuk push notification
agar notif muncul di HP **tanpa harus membuka aplikasi**.

Dokumen ini adalah **panduan langkah-demi-langkah untuk menyiapkan sisi Firebase** yang harus
dilakukan manual (karena butuh login Google). Bagian kode (plugin & backend) sudah saya siapkan
di tempat terpisah.

---

## 📌 Ringkasan Arsitektur

```
[HP Android] --register token--> Backend (Cloudflare Worker)
                                     │
[Pasangan membuat transaksi dkk.] -> notifyPartner()
                                     │  kirim FCM push
                                     ▼
                              Firebase Cloud Messaging
                                     │
                                     ▼
                              [HP pasangan] → muncul notif
```

- Setiap kali pasangan melakukan aksi (transaksi, tabungan, budget, wishlist, catatan),
  **notifikasi in-app** dibuat **dan** **push FCM** dikirim ke perangkat pasangan.
- Push dikirim ke **token perangkat** yang disimpan di tabel `push_tokens` backend.

---

## 🔥 Bagian 1 — Buat Project Firebase

1. Buka **https://console.firebase.google.com/** dan login dengan akun Google.
2. Klik **"Buat project"** / **"Add project"**.
   - Nama project: mis. **CoupleGrow**
   - Google Analytics: **Tidak perlu** (opsional, boleh mati).
   - Klik **"Buat project"** lalu tunggu selesai.

---

## 📱 Bagian 2 — Daftarkan Aplikasi Android

1. Di Firebase Console project baru, klik ikon **Android** (platform) **"+ Add app"**.
2. Isi:
   - **Android package name**: `com.couplegrow.app`
     (harus PERSIS sama dengan `appId` di `frontend/capacitor.config.ts` / AndroidManifest)
   - **App nickname**: `CoupleGrow` (bebas)
   - **Debug signing certificate**: boleh **kosong / lewati**.
3. Klik **"Register app"**.

---

## ⬇️ Bagian 3 — Unduh `google-services.json`

1. Pada langkah "Download config file", klik **"Download google-services.json"**.
   - File ini berisi konfigurasi Firebase Android-specific.
2. Simpan file ke lokasi berikut:
   ```
   frontend/android/app/google-services.json
   ```
   > ⚠️ Pastikan nama file dan lokasinya **tepat**. Build Android sudah menyiapkan
   > plugin Google Services yang otomatis memuat file ini jika ada.
3. Lanjutkan (lewati langkah tambahan di console).

---

## 🔑 Bagian 4 — Buat Service Account (untuk backend kirim push)

Backend perlu **service account** untuk mengirim pesan ke FCM (HTTP v1 API).

1. Di Firebase Console, buka **Project settings** (ikon ⚙️ → **Project settings**).
2. Buka tab **"Service accounts"**.
3. Klik **"Generate new private key"** → **"Generate key"**.
   - Ini mengunduh file JSON seperti:
     ```json
     {
       "type": "service_account",
       "project_id": "couplegrow-xxxxx",
       "private_key_id": "...",
       "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",
       "client_email": "firebase-adminsdk-xxxxx@couplegrow-xxxxx.iam.gserviceaccount.com",
       ...
     }
     ```
4. **Simpan file ini di tempat RAHASIA** (jangan commit ke git!). Ini seperti password.

> ⚠️ Isi file ini nanti dijadikan secret backend Cloudflare dengan nama `FIREBASE_SERVICE_ACCOUNT`
> (petunjuk lengkap ada di bagian 6 / panduan backend).

---

## 🔔 Bagian 5 — (Kode siap) Apa yang sudah disiapkan

Kode berikut **sudah/sedang disiapkan** di repo dan tinggal dideploy:

| Bagian | Status | Lokasi |
|--------|--------|--------|
| Plugin `@capacitor/push-notifications` | Frontend | `frontend/package.json` |
| Registrasi token FCM di perangkat | Frontend | `frontend/src/` |
| Endpoint simpan token `POST /push/token` | Backend | `backend/src/index.ts` |
| Tabel `push_tokens` | Backend | auto-migrasi |
| Kirim FCM push di `notifyPartner()` | Backend | `backend/src/index.ts` |

---

## 🚀 Bagian 6 — Setelah selesai Bagian 1–4

Setelah Anda mengunduh kedua file di atas, langkah berikutnya :

1. Taruh `google-services.json` di `frontend/android/app/google-services.json`
   (dokumen ini, Bagian 3).

2. Pasang service account sebagai secret backend:
   ```bash
   cd backend
   cat /path/ke/firebase-service-account.json | npx wrangler secret put FIREBASE_SERVICE_ACCOUNT
   ```
   > Ini adalah secret (nilai rahasia). Jangan commit ke git.
   > Gunakan nama persis `FIREBASE_SERVICE_ACCOUNT`.

3. Deploy backend agar endpoint & push aktif:
   ```bash
   cd backend
   npx wrangler deploy
   ```

4. Bangun APK rilis (dari root proyek):
   ```bash
   ./release.sh --no-deploy   # build release & siapkan file APK (tanpa deploy)
   cd backend && npx wrangler deploy   # lalu deploy backend
   ```
   > Atau langsung `./release.sh` yang build + update file + deploy sekaligus.

---

## 🧪 Bagian 7 — Cara Menguji

1. Install APK hasil build di **2 perangkat** (atau emulator) — satu untuk kamu, satu untuk pasangan.
2. Buka aplikasi di kedua perangkat, **login** di masing-masing.
   - Saat login, perangkat otomatis mendaftarkan token FCM ke backend (`POST /push/token`).
3. Di HP kamu, buat **transaksi baru** (atau aksi lain yang memicu notif pasangan).
4. Di HP pasangan, notif harus muncul **tanpa membuka aplikasi** 🔔.

---

## 🚀 Bagian 8 — Rilis Versi Baru (Otomatis)

Nama file APK mengikuti versi secara **otomatis** via skrip `release.sh` di root proyek.

**Langkah:** ubah versi di `frontend/android/app/build.gradle`:
```gradle
versionCode 2        // naikkan setiap rilis
versionName "1.1"    // nama versi baru
```

Lalu jalankan:
```bash
./release.sh            # build + update file + deploy backend
# atau
./release.sh --no-deploy  # hanya build & update file (deploy manual nanti)
```

Skrip ini akan otomatis:
1. Baca `versionName` & `versionCode` dari `build.gradle`
2. Build frontend + APK release (signed)
3. Buat file **`CoupleGrow-v<versi>.apk`** (nama mengikuti versi)
4. Update `app-version.json` (versionName, versionCode, downloadUrl)
5. Salin ke `frontend/static/` & `release/`
6. Deploy backend → halaman login otomatis menampilkan **"Download APK v<versi>"**

---

## ❓ Troubleshooting

| Gejala | Penyebab | Solusi |
|--------|----------|--------|
| Notif tidak muncul sama sekali | `google-services.json` belum ada / salah package name | Pastikan package name `com.couplegrow.app`; taruh file di lokasi yang benar |
| Notif tidak muncul, tidak ada error | `FIREBASE_SERVICE_ACCOUNT` belum di-set / salah format | Set secret & deploy ulang backend |
| Build gagal soal Firebase | Dependency/version mismatch | `cd android && ./gradlew clean` lalu build ulang |
| Token FCM kedaluwarsa | Aplikasi di-uninstall / di-reset | Token otomatis dihapus backend saat FCM balas "UNREGISTERED" |

---
*Dokumen lengkap. Kode sisi frontend & backend sudah disiapkan dan tinggal dideploy setelah file Firebase diunduh.*

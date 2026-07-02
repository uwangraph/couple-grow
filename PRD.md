# 📄 PRD - CoupleGrow (Revisi)

## Aplikasi Couple: Dompet + Tabungan + Chat + Notes

---

## 1. 🎯 Ringkasan Produk

| Aspek                         | Deskripsi                                                                                                      |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------- |
| **Nama Aplikasi**             | CoupleGrow                                                                                                     |
| **Tagline**                   | _"Tumbuh bersama, dari sekarang"_                                                                              |
| **Platform**                  | Android (APK) via Capacitor + SvelteKit                                                                        |
| **Target Pengguna**           | Pasangan (pacaran, tunangan, suami-istri)                                                                      |
| **Masalah yang Diselesaikan** | Pasangan kesulitan mengelola keuangan bersama, berbagi catatan, dan berkomunikasi dalam satu aplikasi terpusat |
| **Value Proposition**         | Semua kebutuhan keuangan & komunikasi pasangan dalam satu "ruang" privat: uang, catatan, dan chat              |

---

## 2. 👥 Persona Pengguna

### Persona 1: Andi (25 tahun)

| Atribut        | Deskripsi                                                                    |
| -------------- | ---------------------------------------------------------------------------- |
| **Status**     | Bekerja, tinggal bersama pacar                                               |
| **Kebutuhan**  | Ingin catat pengeluaran bersama (makan, listrik, belanja) dan nabung liburan |
| **Pain point** | Sering lupa siapa bayar apa, chat terpisah di WA                             |

### Persona 2: Sari (24 tahun)

| Atribut        | Deskripsi                                                       |
| -------------- | --------------------------------------------------------------- |
| **Status**     | Mahasiswa, LDR dengan pacar                                     |
| **Kebutuhan**  | Ingin punya catatan wishlist bareng dan ngatur keuangan bersama |
| **Pain point** | Aplikasi keuangan dan chat terpisah, ribet bolak-balik          |

---

## 3. 🎨 Desain & UX

### Warna CoupleGrow (Biru & Ungu)

| Peran          | Warna         | Kode Hex  |
| -------------- | ------------- | --------- |
| **Primary**    | Sky Blue      | `#0C8CE9` |
| **Secondary**  | Bright Purple | `#7C3AED` |
| **Accent**     | Lavender Mist | `#D8B4FE` |
| **Background** | Soft Sky Blue | `#F0F4FF` |
| **Text**       | Dark Navy     | `#1E293B` |
| **Success**    | Emerald Green | `#10B981` |
| **Warning**    | Rose Red      | `#F43F5E` |

### Visual Palet

```
┌─────────────────────────────────────────────────────┐
│  🎨 CoupleGrow Color Palette                        │
├─────────────────────────────────────────────────────┤
│                                                     │
│  ████  #0C8CE9      Sky Blue (Primary)              │
│  ████  #7C3AED      Bright Purple (Secondary)       │
│  ████  #D8B4FE      Lavender Mist (Accent)          │
│  ████  #F0F4FF      Soft Sky Blue (Background)      │
│  ████  #1E293B      Dark Navy (Text)                │
│  ████  #10B981      Emerald Green (Success)         │
│  ████  #F43F5E      Rose Red (Warning)              │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### Tipografi

| Elemen    | Font  | Ukuran | Berat    |
| --------- | ----- | ------ | -------- |
| Header    | Inter | 24px   | Bold     |
| Subheader | Inter | 18px   | SemiBold |
| Body      | Inter | 14px   | Regular  |
| Caption   | Inter | 12px   | Light    |

### Navigasi (Bottom Tab Bar - 4 Tab)

| Tab | Ikon | Fungsi         |
| --- | ---- | -------------- |
| 1   | 💬   | Chat           |
| 2   | 📝   | Notes & Folder |
| 3   | 👛   | Dompet         |
| 4   | 🏦   | Tabungan       |

### Layout Dashboard (Home)

```
┌─────────────────────────────────────────────────┐
│ ┌─────────────────────────────────────────────┐ │
│ │ 👫 Halo, Andi & Sari                         │ │
│ │ 💰 Saldo Dompet: Rp 1.250.000                │ │
│ │ 🏦 Total Tabungan: Rp 8.750.000              │ │
│ └─────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────┤
│  [💬]     [📝]     [👛]     [🏦]               │
├─────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────┐ │
│ │ 🏦 PROGRESS TABUNGAN AKTIF                   │ │
│ │                                              │ │
│ │ • Liburan Bali                               │ │
│ │   ████████████████░░░░ 65%                   │ │
│ │   Rp 6.500.000 / Rp 10.000.000              │ │
│ │                                              │ │
│ │ • Nikah                                      │ │
│ │   ████████░░░░░░░░░░░░ 40%                   │ │
│ │   Rp 4.000.000 / Rp 10.000.000              │ │
│ └─────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────┐ │
│ │ 💬 CHAT TERBARU                              │ │
│ │ • Sari: "transfer ke tabungan ya"           │ │
│ │ • Andi: "udah, cek aja"                     │ │
│ └─────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────┐ │
│ │ 📝 NOTES HARI INI                            │ │
│ │ • [ ] Beli telur                             │ │
│ │ • [x] Bayar listrik                          │ │
│ │ • [ ] Beli susu                              │ │
│ └─────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────┘
```

---

## 4. 📱 Fitur Utama (Prioritas)

### 🔴 P0 (Wajib Ada - MVP)

| No  | Fitur                 | Deskripsi Singkat                                                     |
| --- | --------------------- | --------------------------------------------------------------------- |
| 1   | **Akun & Login**      | Registrasi email/password, login, logout                              |
| 2   | **Pasangan (Couple)** | Kirim undangan kode (6 digit), terima undangan, lihat profil pasangan |
| 3   | **Dompet Bersama**    | Catat pemasukan/pengeluaran, lihat saldo, filter kategori             |
| 4   | **Tabungan**          | Buat target tabungan, lihat progress, transfer dari dompet            |
| 5   | **Chat**              | Kirim pesan teks, lihat riwayat chat real-time                        |
| 6   | **Notes**             | Buat catatan teks sederhana, edit, hapus                              |

### 🟡 P1 (Penting - Setelah MVP)

| No  | Fitur                  | Deskripsi Singkat                                                |
| --- | ---------------------- | ---------------------------------------------------------------- |
| 7   | **Folder Notes**       | Buat folder, pindahkan note antar folder, shared/private folder  |
| 8   | **Chat per Tabungan**  | Diskusi khusus untuk setiap target tabungan                      |
| 9   | **Notifikasi Push**    | Terima notifikasi saat ada chat, transaksi, atau pasangan nabung |
| 10  | **Grafik & Statistik** | Grafik pengeluaran per minggu/bulan, kategori terbesar           |
| 11  | **Checklist di Notes** | Buat checklist dengan centang (✅) di dalam note                 |

### 🟢 P2 (Nice to Have - Future)

| No  | Fitur                          | Deskripsi Singkat                                   |
| --- | ------------------------------ | --------------------------------------------------- |
| 12  | **Lampiran Foto**              | Upload foto bukti transaksi, foto di chat           |
| 13  | **Multiple Tabungan Otomatis** | Autodebit dari dompet ke tabungan tiap bulan        |
| 14  | **Export Data**                | Export transaksi & notes ke PDF/Excel               |
| 15  | **Private Folder PIN**         | Folder pribadi dengan kunci PIN/fingerprint         |
| 16  | **Integrasi Chat ke Dompet**   | Chat berisi nominal muncul tombol "catat ke dompet" |

---

## 5. 📐 Alur Pengguna (User Flow)

### Alur Registrasi & Berpasangan

```
Buka Aplikasi
      ↓
Halaman Login/Register
      ↓
Register (email, password, nama)
      ↓
Buat Kode Undangan  ←→  Masukkan Kode Undangan
(Andi membuat kode)     (Sari memasukkan kode Andi)
      ↓
Keduanya terhubung sebagai pasangan
      ↓
Masuk ke Dashboard CoupleGrow
```

### Alur Catat Pengeluaran

```
Buka Tab Dompet
      ↓
Klik Tombol "+"
      ↓
Pilih "Pengeluaran"
      ↓
Isi: nominal (Rp), kategori, catatan opsional
      ↓
Klik "Simpan"
      ↓
Saldo berkurang, muncul di riwayat
      ↓
Pasangan dapat notifikasi
```

### Alur Buat Tabungan & Nabung

```
Buka Tab Tabungan
      ↓
Klik "Buat Tabungan Baru"
      ↓
Isi: nama tabungan, target nominal, deadline
      ↓
Tabungan muncul di daftar
      ↓
Klik "Top Up" pada tabungan
      ↓
Pilih nominal (dari dompet)
      ↓
Saldo dompet berkurang, tabungan bertambah
      ↓
Progress bar update
      ↓
Pasangan dapat notifikasi
```

### Alur Chat

```
Buka Tab Chat
      ↓
Pilih chat room (global atau per tabungan)
      ↓
Ketik pesan
      ↓
Kirim → real-time ke pasangan
```

### Alur Notes

```
Buka Tab Notes
      ↓
Buat folder baru (opsional)
      ↓
Buat note dalam folder
      ↓
Isi teks atau checklist
      ↓
Edit / hapus note
```

---

## 6. 🗂️ Struktur Data (Database D1)

### Tabel `users`

```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  partner_id TEXT,
  avatar TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (partner_id) REFERENCES users(id)
);
```

### Tabel `invites`

```sql
CREATE TABLE invites (
  id TEXT PRIMARY KEY,
  from_user_id TEXT NOT NULL,
  code TEXT UNIQUE NOT NULL,
  is_used BOOLEAN DEFAULT 0,
  expires_at DATETIME NOT NULL,
  FOREIGN KEY (from_user_id) REFERENCES users(id)
);
```

### Tabel `transactions`

```sql
CREATE TABLE transactions (
  id INTEGER PRIMARY KEY,
  user_id TEXT NOT NULL,
  couple_id TEXT NOT NULL,
  amount INTEGER NOT NULL,
  type TEXT CHECK(type IN ('income', 'expense')) NOT NULL,
  category TEXT NOT NULL,
  note TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

### Tabel `savings`

```sql
CREATE TABLE savings (
  id INTEGER PRIMARY KEY,
  couple_id TEXT NOT NULL,
  name TEXT NOT NULL,
  target_amount INTEGER NOT NULL,
  current_amount INTEGER DEFAULT 0,
  deadline DATE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### Tabel `folders`

```sql
CREATE TABLE folders (
  id INTEGER PRIMARY KEY,
  couple_id TEXT NOT NULL,
  name TEXT NOT NULL,
  is_private BOOLEAN DEFAULT 0,
  parent_folder_id INTEGER,
  linked_saving_id INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (parent_folder_id) REFERENCES folders(id),
  FOREIGN KEY (linked_saving_id) REFERENCES savings(id)
);
```

### Tabel `notes`

```sql
CREATE TABLE notes (
  id INTEGER PRIMARY KEY,
  folder_id INTEGER NOT NULL,
  title TEXT,
  content TEXT,
  checklist JSON, -- array of {text: string, is_done: boolean}
  deadline DATE,
  is_done BOOLEAN DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (folder_id) REFERENCES folders(id)
);
```

### Tabel `chat_rooms`

```sql
CREATE TABLE chat_rooms (
  id INTEGER PRIMARY KEY,
  couple_id TEXT NOT NULL,
  saving_id INTEGER, -- NULL untuk global chat
  name TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (saving_id) REFERENCES savings(id)
);
```

### Tabel `messages`

```sql
CREATE TABLE messages (
  id INTEGER PRIMARY KEY,
  room_id INTEGER NOT NULL,
  sender_id TEXT NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (room_id) REFERENCES chat_rooms(id),
  FOREIGN KEY (sender_id) REFERENCES users(id)
);
```

---

## 7. 🔌 API Endpoints (Cloudflare Workers)

### Auth

| Method | Endpoint         | Deskripsi               |
| ------ | ---------------- | ----------------------- |
| POST   | `/auth/register` | Registrasi user baru    |
| POST   | `/auth/login`    | Login, return JWT token |
| GET    | `/auth/me`       | Get current user info   |

### Partner

| Method | Endpoint           | Deskripsi              |
| ------ | ------------------ | ---------------------- |
| POST   | `/partner/invite`  | Generate kode undangan |
| POST   | `/partner/connect` | Hubungkan dengan kode  |
| GET    | `/partner/status`  | Dapatkan data pasangan |

### Transactions

| Method | Endpoint                | Deskripsi                                        |
| ------ | ----------------------- | ------------------------------------------------ |
| POST   | `/transactions`         | Tambah transaksi (income/expense)                |
| GET    | `/transactions`         | Dapatkan semua transaksi                         |
| GET    | `/transactions/summary` | Dapatkan ringkasan (saldo, total income/expense) |

### Savings

| Method | Endpoint                | Deskripsi                   |
| ------ | ----------------------- | --------------------------- |
| GET    | `/savings`              | Dapatkan semua tabungan     |
| POST   | `/savings`              | Buat tabungan baru          |
| POST   | `/savings/:id/topup`    | Top up tabungan dari dompet |
| GET    | `/savings/:id/progress` | Dapatkan progress tabungan  |

### Folders

| Method | Endpoint       | Deskripsi             |
| ------ | -------------- | --------------------- |
| GET    | `/folders`     | Dapatkan semua folder |
| POST   | `/folders`     | Buat folder baru      |
| PUT    | `/folders/:id` | Update folder         |
| DELETE | `/folders/:id` | Hapus folder          |

### Notes

| Method | Endpoint               | Deskripsi                        |
| ------ | ---------------------- | -------------------------------- |
| GET    | `/notes`               | Dapatkan semua notes (by folder) |
| POST   | `/notes`               | Buat note baru                   |
| PUT    | `/notes/:id`           | Update note                      |
| DELETE | `/notes/:id`           | Hapus note                       |
| PATCH  | `/notes/:id/checklist` | Update checklist item            |

### Chat

| Method | Endpoint                   | Deskripsi                              |
| ------ | -------------------------- | -------------------------------------- |
| GET    | `/chat/rooms`              | Dapatkan semua chat room               |
| GET    | `/chat/rooms/:id/messages` | Dapatkan pesan dalam room              |
| POST   | `/chat/rooms/:id/messages` | Kirim pesan (WebSocket untuk realtime) |

---

## 8. 🔌 WebSocket Events (Durable Objects)

| Event             | Direction       | Deskripsi                                 |
| ----------------- | --------------- | ----------------------------------------- |
| `message:send`    | Client → Server | Kirim pesan baru                          |
| `message:receive` | Server → Client | Terima pesan baru (broadcast ke pasangan) |
| `typing:start`    | Client → Server | Pasangan mulai mengetik                   |
| `typing:end`      | Client → Server | Pasangan berhenti mengetik                |
| `transaction:new` | Server → Client | Ada transaksi baru dari pasangan          |
| `saving:update`   | Server → Client | Ada update tabungan dari pasangan         |

---

## 9. ⏰ Cron Jobs (Notifikasi Otomatis)

| Cron          | Task                                                           |
| ------------- | -------------------------------------------------------------- |
| `0 20 * * *`  | Reminder catat pengeluaran hari ini (jika belum ada transaksi) |
| `0 9 1 * *`   | Reminder deadline tabungan bulan ini                           |
| `*/5 * * * *` | Cek pesan belum dibaca → notifikasi push                       |

---

## 10. ⚙️ Tech Stack (Final)

| Layer                     | Pilihan                                 |
| ------------------------- | --------------------------------------- |
| **Frontend**              | Svelte 5 + SvelteKit                    |
| **Styling**               | TailwindCSS (dengan warna custom)       |
| **Mobile Wrapper**        | Capacitor (build APK)                   |
| **Backend API**           | Hono.js on Cloudflare Workers           |
| **Database**              | Cloudflare D1 (SQLite)                  |
| **Realtime Chat**         | Cloudflare Durable Objects + WebSockets |
| **Auth**                  | JWT (manual di Worker)                  |
| **File Storage (Future)** | Cloudflare R2 (untuk foto)              |
| **Deployment**            | `wrangler` + Cloudflare Pages           |

---

## 11. 📱 PWA + Capacitor

| Aspek               | Deskripsi                                                    |
| ------------------- | ------------------------------------------------------------ |
| **PWA Manifest**    | Bisa install ke HP via browser (Chrome → Add to Home Screen) |
| **Capacitor Build** | `npx cap add android` → menghasilkan APK untuk Play Store    |
| **Minimum Android** | 10 (API 29)                                                  |
| **Permissions**     | Notifikasi                                                   |

---

## 12. ✅ Kriteria Sukses MVP

| ID   | Kriteria                                                          | Target  |
| ---- | ----------------------------------------------------------------- | ------- |
| AC1  | Registrasi & login berhasil                                       | ✅      |
| AC2  | 2 user bisa terhubung sebagai pasangan dengan kode undangan       | ✅      |
| AC3  | Catat pemasukan → saldo bertambah                                 | ✅      |
| AC4  | Catat pengeluaran → saldo berkurang                               | ✅      |
| AC5  | Buat tabungan baru → muncul di daftar                             | ✅      |
| AC6  | Top up tabungan dari dompet → saldo berkurang, tabungan bertambah | ✅      |
| AC7  | Progress bar tabungan update sesuai persentase                    | ✅      |
| AC8  | Kirim pesan teks ke pasangan → real-time                          | ✅      |
| AC9  | Buat folder notes                                                 | ✅      |
| AC10 | Buat note dalam folder (teks biasa)                               | ✅      |
| AC11 | Edit & hapus note                                                 | ✅      |
| AC12 | Notifikasi push untuk chat & transaksi                            | ✅ (P1) |
| AC13 | Checklist di notes                                                | ✅ (P1) |
| AC14 | APK bisa diinstall & running di Android                           | ✅      |
| AC15 | Crash rate < 1%                                                   | ✅      |

---

## 13. 📅 Timeline Estimasi (MVP - 3 Minggu)

| Minggu       | Fokus          | Fitur                                                                     |
| ------------ | -------------- | ------------------------------------------------------------------------- |
| **Minggu 1** | Setup & Auth   | Project SvelteKit, Cloudflare Workers, D1, login/register, couple pairing |
| **Minggu 2** | Core Features  | Dompet, Tabungan, Chat dasar (WebSocket)                                  |
| **Minggu 3** | Notes & Polish | Folder, Notes, notifikasi, testing, bug fix, build APK                    |

---

## 14. 🚫 Out of Scope (V1)

- ❌ Koneksi ke bank asli (input manual semua)
- ❌ Panggilan suara/video
- ❌ Multiple pasangan (hanya berdua)
- ❌ Versi web terpisah (bisa dari PWA)
- ❌ Lokasi & Geofencing (dihapus sesuai permintaan)
- ❌ Lampiran foto

---

## 15. 🎨 CoupleGrow vs CoupleCare (Warna Berpasangan)

| Aplikasi       | Warna Utama               | Kode Hex              |
| -------------- | ------------------------- | --------------------- |
| **CoupleGrow** | Soft Blue + Soft Lavender | `#6C91D1` + `#A28BDF` |
| **CoupleCare** | Soft Peach + Coral        | `#FFB8A3` + `#FFA3A3` |

---

## 📎 Lampiran: Glossary

| Istilah         | Arti                                                            |
| --------------- | --------------------------------------------------------------- |
| MVP             | Minimum Viable Product (versi paling sederhana yang bisa rilis) |
| P0/P1/P2        | Prioritas fitur (P0 paling penting)                             |
| Durable Objects | Teknologi Cloudflare untuk koneksi realtime (WebSocket)         |
| JWT             | JSON Web Token (untuk autentikasi)                              |

# 📄 PRD — CoupleGrow

## Aplikasi Pasangan: Dompet + Tabungan + Chat + Catatan

> Dokumen ini menggambarkan produk **sebagaimana yang sudah dibangun**, bukan rencana aspiratif.
> Bagian yang belum ada ditandai eksplisit di [§11 Belum Dibangun](#11--belum-dibangun).

---

## 1. 🎯 Ringkasan Produk

| Aspek                         | Deskripsi                                                                                             |
| ----------------------------- | ----------------------------------------------------------------------------------------------------- |
| **Nama Aplikasi**             | CoupleGrow                                                                                            |
| **Tagline**                   | _"Tumbuh bersama, dari sekarang"_                                                                     |
| **Platform**                  | Web (PWA) + Android (APK) via Capacitor                                                               |
| **Target Pengguna**           | Pasangan (pacaran, tunangan, suami-istri)                                                             |
| **Masalah**                   | Keuangan bersama, catatan, dan komunikasi pasangan tersebar di banyak aplikasi                        |
| **Value Proposition**         | Satu ruang privat berdua: uang, rencana, catatan, dan obrolan — semuanya tersinkron real-time         |
| **Model Ruang**               | Satu akun = satu pasangan. Semua data diikat ke `couple_id` yang dibentuk dari pasangan user id       |

---

## 2. 👥 Persona Pengguna

### Persona 1 — Andi (25)

| Atribut        | Deskripsi                                                                     |
| -------------- | ----------------------------------------------------------------------------- |
| **Status**     | Bekerja, tinggal bersama pasangan                                             |
| **Kebutuhan**  | Catat pengeluaran bersama (makan, listrik, belanja) dan nabung untuk liburan  |
| **Pain point** | Lupa siapa bayar apa; diskusi soal uang tenggelam di chat umum                 |

### Persona 2 — Sari (24)

| Atribut        | Deskripsi                                                        |
| -------------- | ---------------------------------------------------------------- |
| **Status**     | Mahasiswa, LDR                                                   |
| **Kebutuhan**  | Wishlist bareng, target tabungan bersama, komunikasi harian      |
| **Pain point** | Bolak-balik antara aplikasi keuangan, notes, dan chat            |

---

## 3. 🏗️ Arsitektur

| Lapisan          | Teknologi                                                                  |
| ---------------- | -------------------------------------------------------------------------- |
| **Frontend**     | SvelteKit 2 + Svelte 5 (runes), `adapter-static`, Tailwind 4 + CSS scoped   |
| **Mobile shell** | Capacitor 8 (Android), Push Notifications plugin                           |
| **Backend**      | Cloudflare Workers + Hono                                                  |
| **Database**     | Cloudflare D1 (SQLite)                                                     |
| **Realtime**     | Durable Object `ChatRoom` (WebSocket Hibernation API)                      |
| **Object store** | Cloudflare R2 (avatar, lampiran chat) diakses lewat proxy `/r2/*`          |
| **Auth**         | JWT (HS256) via `hono/jwt`, disimpan di client                             |
| **Push**         | Firebase Cloud Messaging (service account di secret Worker)                |
| **Email**        | Resend (reset password)                                                    |
| **Editor**       | TipTap 2 (rich text) + spreadsheet kustom untuk catatan                    |

**Satu Worker melayani API + aset statis.** Frontend di-build ke `frontend/build` lalu di-serve
lewat binding `ASSETS`; rute API diprioritaskan sebelum fallback ke aset.

### Identitas Pasangan

`couple_id` = dua user id diurutkan lalu digabung: `[id_a, id_b].sort().join('_')`.
Semua query domain difilter dengan `couple_id`, sehingga tidak ada data yang bocor antar pasangan.

---

## 4. 🎨 Desain & UX

### Palet

Biru brand **`#2196F3`**. Ramp clay-nya dibangun dari warna itu, sementara
warna pendukung diambil dari logo (dua daun membentuk hati).

| Peran                    | Nama            | Kode Hex  | Catatan                          |
| ------------------------ | --------------- | --------- | -------------------------------- |
| **Brand / Primary**      | Brand Blue      | `#2196F3` | Warna inti seluruh aplikasi      |
| **Primary Dark**         | Deep Blue       | `#1976D2` | Stop bawah gradien clay          |
| **Primary Light**        | Light Blue      | `#64B5F6` | Stop atas gradien clay           |
| **Ubin nada kedua**      | Ocean Blue      | `#1565C0` | Membedakan ubin sejenis          |
| **Secondary / Aksen**    | Sky             | `#4FC3F7` | Turunan daun kiri logo           |
| **Surface Biru Lembut**  | Ice Blue        | `#D2E9FB` | Isian kartu bertinta             |
| **Background**           | Pale Blue       | `#EAF4FE` | Latar gradien aplikasi           |
| **Surface**              | White           | `#FFFFFF` | Kartu clay                       |
| **Text**                 | Dark Navy       | `#1F2937` | —                                |
| **Muted**                | Slate           | `#64748B` | —                                |
| **Positif**              | Muted Teal      | `#4FBFA3` | Pemasukan — sengaja diredam      |
| **Peringatan**           | Muted Rose      | `#EF7C97` | Pengeluaran — sengaja diredam    |

**Gradien clay** — `linear-gradient(145deg, #64B5F6 0%, #2196F3 55%, #1976D2 100%)`
untuk ubin ikon dan tombol utama.

**Nada bayangan** — drop shadow memakai `rgba(21, 101, 192, …)` dan bayangan
dalam `rgba(13, 71, 161, …)`, bukan abu-abu netral. Inilah yang membuat
permukaan clay terasa menyatu dengan warna brand.

> Hijau dan rose hanya dipakai sebagai penanda pemasukan/pengeluaran, dengan
> saturasi yang diturunkan agar tidak melawan biru.

### Tipografi

| Elemen    | Font   | Ukuran | Berat |
| --------- | ------ | ------ | ----- |
| Header    | Nunito | 22–24px| 900   |
| Subheader | Nunito | 16–18px| 800   |
| Body      | Nunito | 14px   | 600   |
| Caption   | Nunito | 10–12px| 700   |

### Prinsip UI

- **Kartu lembut** — radius besar (14–22px), bayangan halus, tanpa garis tajam.
- **Tombol "tebal"** — bayangan bawah solid yang mengecil saat ditekan (efek tombol fisik).
- **Bahasa Indonesia** di seluruh label, pesan error, dan toast.
- **Atribusi berpasangan** — setiap entitas menyimpan `created_by` / `updated_by` agar terlihat siapa yang mengubah apa.

### Navigasi

Bottom tab bar: **Home · Dompet · Tabungan · Catatan · Chat**, dengan halaman sekunder
Analitik, Budget, Wishlist, Notifikasi, dan Profil.

---

## 5. 🔐 Onboarding & Pasangan

```
Register (email, nama, password)
      ↓
Login → JWT
      ↓
Belum punya pasangan?
      ├── Buat kode undangan  → bagikan ke pasangan
      └── Masukkan kode undangan → terhubung
      ↓
couple_id terbentuk → semua fitur bersama aktif
```

| Aturan                                                                                     |
| ------------------------------------------------------------------------------------------ |
| Kode undangan sekali pakai dan punya masa berlaku (`invites.expires_at`)                    |
| Semua endpoint domain menolak request bila `partner_id` belum ada (`No partner connected`)  |
| Putus koneksi pasangan tersedia lewat `DELETE /partner/disconnect`                          |
| Reset password lewat kode yang dikirim ke email (Resend), tabel `password_resets`            |

---

## 6. 💰 Modul Keuangan

### 6.1 Dompet (Transaksi)

| Kemampuan                                                             |
| --------------------------------------------------------------------- |
| Catat pemasukan & pengeluaran dengan kategori dan catatan             |
| Edit & hapus transaksi                                                |
| Saldo dan ringkasan bulanan                                           |
| **Split bill** — bagi satu transaksi ke dua orang, tandai lunas       |

### 6.2 Tabungan

| Kemampuan                                                                       |
| -------------------------------------------------------------------------------- |
| Buat target tabungan (nama, nominal target, deadline)                            |
| Top up & tarik dana, progress bar otomatis                                       |
| **Riwayat aktivitas** per tabungan (`saving_activities`): topup, tarik, milestone |
| **Kontribusi per orang** — siapa menyetor berapa                                 |
| **Chat khusus per tabungan** — setiap tabungan punya room chat sendiri            |

### 6.3 Budget

Batas pengeluaran per kategori per bulan (`budgets`, unik per `couple_id + kategori + periode`),
dibandingkan dengan realisasi transaksi bulan berjalan.

### 6.4 Analitik

| Laporan                    | Endpoint                        |
| -------------------------- | ------------------------------- |
| Pola pengeluaran           | `/analytics/spending-pattern`   |
| Rincian per kategori       | `/analytics/category-breakdown` |
| Perbandingan antar bulan   | `/analytics/compare-months`     |
| Kecepatan menabung         | `/analytics/savings-velocity`   |

### 6.5 Wishlist

Daftar keinginan bersama: nama, deskripsi, estimasi harga, prioritas, gambar,
dan **tautan ke tabungan** sehingga wishlist bisa langsung jadi target menabung.

---

## 7. 📝 Modul Catatan

| Kemampuan                                                                    |
| ----------------------------------------------------------------------------- |
| Folder bersarang, opsi folder privat, folder bisa ditautkan ke tabungan       |
| **Rich text editor** (TipTap): heading, list, warna, highlight, tabel         |
| **Spreadsheet** dengan formula ala Excel                                      |
| Checklist, deadline, dan status selesai                                       |
| Atribusi `created_by` / `updated_by` per catatan                              |

---

## 8. 💬 Modul Chat

Chat adalah fitur terdalam di aplikasi ini dan dirancang setara aplikasi chat modern.

### 8.1 Struktur Room

| Room               | Keterangan                                              |
| ------------------ | -------------------------------------------------------- |
| **Chat Global**    | Satu room utama per pasangan (`saving_id IS NULL`)       |
| **Chat Tabungan**  | Satu room per tabungan, dibuat otomatis saat pesan pertama |

Setiap room dilayani satu instance Durable Object dengan nama `{couple_id}:{saving_id|global}`.

### 8.2 Realtime

| Aspek                | Implementasi                                                                    |
| -------------------- | -------------------------------------------------------------------------------- |
| **Transport**        | WebSocket ke `/chat/ws?token=&saving_id=`                                       |
| **Hibernation-safe** | Identitas sesi disimpan di `serializeAttachment()`, broadcast via `getWebSockets()` |
| **Otentikasi**       | JWT diverifikasi di Worker, `X-User-Id` / `X-Couple-Id` diteruskan ke DO         |
| **Sender tepercaya** | `sender_id` selalu diambil dari sesi, tidak pernah dari payload klien            |
| **Reconnect**        | Backoff eksponensial + refetch riwayat agar pesan yang terlewat ikut masuk       |

### 8.3 Jenis Pesan

`text` · `image` · `audio` (voice note) · `file` (PDF/Word)

### 8.4 Fitur Pesan

| Fitur                    | Detail                                                                     |
| ------------------------ | -------------------------------------------------------------------------- |
| **Balas**                | Lewat menu konteks atau swipe kanan pada bubble                            |
| **Edit**                 | Hanya pesan sendiri, ditandai "diperbarui"                                 |
| **Hapus**                | Hanya pesan sendiri, bubble jadi "Pesan ini telah dihapus"                  |
| **Reaksi emoji**         | Satu reaksi per orang, badge menempel di sudut bawah bubble                |
| **Sematkan**             | Satu pesan tersemat per room, dengan durasi 24 jam / 7 hari / 30 hari      |
| **Bintangi**             | Penanda pribadi, dikecualikan dari "bersihkan chat"                        |
| **Teruskan**             | Ke chat global atau chat tabungan lain, dengan badge "Diteruskan"          |
| **Salin**                | Hanya untuk pesan yang punya teks                                          |
| **Status baca**          | 1 centang (mengirim) → 2 centang (terkirim) → 2 centang biru (dibaca)      |
| **Indikator mengetik**   | Event `typing` dengan throttle 2 detik dan auto-stop                        |

### 8.5 Komposer

| Fitur                    | Detail                                                                       |
| ------------------------ | ----------------------------------------------------------------------------- |
| **Emoji picker**         | 7 kategori dengan tab: wajah, hewan, makanan, aktivitas, perjalanan, benda, simbol |
| **Menu lampiran**        | Foto · Dokumen · Kamera                                                      |
| **Multi-lampiran**       | Sampai 10 file; teks yang diketik menjadi caption lampiran pertama            |
| **Kamera dalam aplikasi**| Ganti kamera depan/belakang, hasil kamera depan dicermin dengan benar         |
| **Voice note**           | Timer + waveform live saat merekam, lalu pratinjau putar/jeda/hapus sebelum kirim |
| **Batas unggah**         | 15 MB per file; gambar, audio, PDF, DOC/DOCX                                 |

### 8.6 Riwayat & Privasi

| Fitur                  | Detail                                                                                 |
| ---------------------- | ---------------------------------------------------------------------------------------- |
| **Pagination**         | 40 pesan per halaman, muat otomatis saat menggulir ke atas, posisi baca dipertahankan   |
| **Bersihkan chat**     | Per pengguna (`chat_clears.cleared_at`) — pasangan tetap memiliki riwayatnya            |
| **Lepas semua bintang**| Satu aksi untuk seluruh room                                                            |
| **Panel info room**    | Jumlah foto/file/berbintang, grid media, daftar pesan berbintang dengan loncat ke pesan |

### 8.7 Pengiriman Optimistik

Pesan langsung muncul dengan `client_id` unik dan status "mengirim". Server meng-echo
`client_id` bersama pesan yang tersimpan, sehingga placeholder diganti secara pasti — bukan
dengan menebak dari kecocokan teks. Bila unggahan gagal, placeholder dibuang dan draft
dikembalikan ke komposer agar bisa dikirim ulang.

---

## 9. 🔔 Notifikasi

| Jalur                | Detail                                                                 |
| -------------------- | ----------------------------------------------------------------------- |
| **In-app**           | Tabel `notifications`, halaman daftar, tandai dibaca satuan / semua     |
| **Push (FCM)**       | Token perangkat di `push_tokens`, dikirim ke semua perangkat pasangan   |
| **Pemicu**           | Aktivitas pasangan: transaksi, top up tabungan, catatan, wishlist       |
| **Toleran gagal**    | Kegagalan push tidak pernah menggagalkan operasi utama                  |

---

## 10. 🗂️ Struktur Data (D1)

| Tabel                | Isi                                                                       |
| -------------------- | -------------------------------------------------------------------------- |
| `users`              | Akun, `partner_id`, avatar, profil (ulang tahun, anniversary, bio, telepon) |
| `invites`            | Kode undangan pasangan, sekali pakai, ada masa berlaku                    |
| `password_resets`    | Kode reset password                                                       |
| `transactions`       | Pemasukan & pengeluaran per `couple_id`                                   |
| `transaction_splits` | Pembagian satu transaksi ke tiap orang + status lunas                     |
| `savings`            | Target tabungan                                                           |
| `saving_activities`  | Log aktivitas tabungan (topup, tarik, dibuat, milestone)                  |
| `budgets`            | Batas per kategori per bulan                                              |
| `wishlists`          | Keinginan bersama, bisa tertaut ke tabungan                               |
| `folders`            | Folder catatan, bersarang, bisa privat                                    |
| `notes`              | Catatan (rich text / spreadsheet / checklist)                             |
| `chat_rooms`         | Room global & per tabungan                                                |
| `messages`           | Pesan + `metadata` JSON, reaksi, sematan, bintang, status baca            |
| `chat_clears`        | Batas "bersihkan chat" per pengguna per room                              |
| `notifications`      | Notifikasi in-app                                                         |
| `push_tokens`        | Token FCM per perangkat                                                   |

**Migrasi kompatibilitas** dijalankan otomatis di middleware (`ALTER TABLE ... ADD COLUMN`
yang aman diulang), sehingga database lama ikut terbarui tanpa langkah manual.

---

## 11. 🚧 Belum Dibangun

Fitur berikut **belum ada** dan disebut di sini supaya tidak dianggap tersedia:

| Fitur                       | Catatan                                                              |
| --------------------------- | --------------------------------------------------------------------- |
| Panggilan suara/video       | Perlu signaling lewat Durable Object dan TURN server                  |
| Berbagi lokasi & live location | Perlu tabel baru, proxy geocoding, dan peta                        |
| Polling di chat             | Perlu tabel `poll_votes` dan event voting di DO                       |
| Pencarian pesan             | Belum ada indeks pencarian                                            |
| Mode gelap                  | Palet saat ini hanya terang                                           |
| Ekspor data                 | Belum ada ekspor CSV/PDF untuk transaksi maupun chat                  |

---

## 12. ✅ Kriteria Kualitas

| Aspek           | Standar                                                                          |
| --------------- | --------------------------------------------------------------------------------- |
| **Type check**  | `npm run check` harus 0 error                                                    |
| **Build**       | `npm run build` (frontend) dan `wrangler deploy --dry-run` (backend) harus sukses |
| **Otorisasi**   | Setiap endpoint domain memverifikasi `couple_id`, bukan hanya JWT valid           |
| **Realtime**    | Semua state DO harus selamat dari hibernasi                                       |
| **Bahasa**      | Seluruh teks yang dilihat pengguna dalam Bahasa Indonesia                         |
| **Kegagalan**   | Operasi gagal harus mengembalikan state UI, bukan meninggalkan sisa optimistik    |

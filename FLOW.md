# Alur Penggunaan (User Flow) Aplikasi CoupleGrow

Berikut adalah gambaran singkat *User Flow* dari aplikasi CoupleGrow untuk pengguna dari awal membuka aplikasi hingga menggunakan fitur utamanya.

```mermaid
graph TD
    A[Buka Aplikasi] --> B{Sudah punya akun?}
    B -- Belum --> C[Halaman Register]
    C --> D[Registrasi Akun Baru]
    D --> E[Halaman Login]
    B -- Sudah --> E[Halaman Login]
    E --> F{Sudah punya pasangan?}
    
    F -- Belum --> G[Halaman Hubungkan Pasangan]
    G --> H[Generate Kode 6-Digit]
    G --> I[Masukkan Kode Pasangan]
    H -. Berikan ke pasangan .-> J[Pasangan Terhubung!]
    I -. Validasi berhasil .-> J
    
    F -- Sudah --> J
    J --> K[Main App Layout / Dashboard]

    K --> L((Dompet Bersama))
    K --> M((Tabungan Bersama))
    K --> N((Catatan & Checklist))
    K --> O((Obrolan / Chat))

    %% Detail Dompet
    L --> L1[Lihat Saldo & Riwayat Transaksi]
    L --> L2[Tambah Pemasukan / Pengeluaran]
    L --> L3[Lihat Grafik Statistik & Kategori]

    %% Detail Tabungan
    M --> M1[Lihat Target & Progress Tabungan]
    M --> M2[Top-up / Tarik Tabungan]
    M --> M3[Masuk ke Chat Khusus Tabungan]

    %% Detail Notes
    N --> N1[Buat & Lihat Folder]
    N --> N2[Buat Catatan Baru]
    N --> N3[Edit Mode Teks / Checklist]

    %% Detail Chat
    O --> O1[Chat Global Real-time]
    O --> O2[Terima Notifikasi Pesan Baru]
```

## Deskripsi Alur

1. **Autentikasi (Login/Register):** 
   Pengguna pertama kali wajib mendaftar atau masuk menggunakan Email dan Password.

2. **Proses Pairing (Mencari Pasangan):** 
   Jika pengguna belum memiliki pasangan (*partner_id* masih kosong), mereka akan langsung diarahkan ke halaman "Hubungkan Pasangan". Di sini, pengguna A bisa mem-generate kode 6-digit dan memberikannya kepada pengguna B. Pengguna B memasukkan kode tersebut untuk menautkan kedua akun.

3. **Eksplorasi Fitur Utama (Tab Navigation):**
   Setelah terhubung, pengguna masuk ke menu utama dengan navigasi bawah yang elegan:
   - 👛 **Dompet:** Pusat pencatatan keuangan harian. Pengguna bisa mencatat uang masuk dan keluar, serta melihat statistik (grafik batang) pengeluaran bulanan.
   - 🏦 **Tabungan:** Tempat membuat target menabung (misal: "Beli Rumah"). Setiap tabungan dilengkapi *progress bar* dan juga ruangan **Diskusi (Chat)** tersendiri khusus membahas tabungan tersebut.
   - 📝 **Notes:** Tempat menyimpan catatan penting atau to-do list berdua (belanjaan bulanan, itinerary liburan). Mendukung mode *Checklist* yang bisa dicentang.
   - 💬 **Chat:** Ruang obrolan utama (*Global Chat*) secara *real-time* berbasis WebSocket, lengkap dengan *toast notification* apabila ada pesan masuk baru.

Alur ini dirancang sangat simpel dan fokus pada keterbukaan finansial serta komunikasi yang mulus untuk pasangan.

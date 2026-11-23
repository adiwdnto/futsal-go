# Futsal Go

Direktori lapangan futsal, mini-soccer, dan sepakbola untuk Pangkalpinang, dengan peta, akun user/admin, pengaturan ketersediaan, dan booking instan tanpa pembayaran online.

## Prasyarat

- Node.js 18 atau lebih baru dan npm.
- MySQL 8.0.16 atau lebih baru (dump menggunakan SRID 4326 dan collation MySQL 8).
- File dump `db_futsal_pangkalpinang.sql` yang diberikan.

## Menyiapkan database

1. Buat database `db_futsal_pangkalpinang` jika belum ada:

   ```sql
   CREATE DATABASE db_futsal_pangkalpinang
     CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
   ```

2. Import dump awal melalui phpMyAdmin/klien MySQL. Contoh jika `mysql` sudah ada di `PATH`:

   ```powershell
   mysql -u root -p db_futsal_pangkalpinang < "$HOME\Downloads\db_futsal_pangkalpinang.sql"
   ```

3. Jalankan migrasi **satu kali**:

   ```powershell
   mysql -u root -p db_futsal_pangkalpinang < .\backend\database\migrations\001_booking_and_sports.sql
   ```

   Migrasi mempertahankan tabel dan data dump, menambahkan jenis olahraga, deskripsi/foto/status, jadwal mingguan, penutupan sementara, dan booking. Jadwal awal dibuat dari jam operasional lama untuk setiap hari. Data lapangan lama dengan `created_by = NULL` akan dimiliki oleh admin awal pada langkah berikutnya.

## Menjalankan backend

Buka terminal pertama di `backend`:

```powershell
cd C:\laragon\www\futsal-go\backend
Copy-Item .env.example .env
npm install
```

Isi pengaturan database pada `backend\.env`. Ganti `JWT_SECRET` dengan string acak sekurang-kurangnya 32 karakter. Buat admin awal dengan kredensial yang Anda tentukan sendiri (password minimal 12 karakter):

```powershell
$env:ADMIN_NAME = "Admin Lapangan"
$env:ADMIN_EMAIL = "admin@example.com"
$env:ADMIN_PASSWORD = "ganti-dengan-password-acak-minimal-12-karakter"
npm run bootstrap-admin
```

Perintah bootstrap membuat akun admin ber-password hash, menolak mempromosikan akun user yang sudah ada, dan menyerahkan lapangan tanpa pemilik kepada admin tersebut. Jangan menyimpan kredensial bootstrap di source code.

Jalankan API:

```powershell
npm start
```

API tersedia di `http://localhost:4000`.

## Menjalankan frontend

Buka terminal kedua di `frontend`:

```powershell
cd C:\laragon\www\futsal-go\frontend
npm install
npm run dev
```

Buka URL yang ditampilkan Vite (default `http://localhost:5173`). Vite meneruskan request `/api` ke backend lokal. Peta memakai tile OpenStreetMap melalui Leaflet; koneksi internet diperlukan untuk memuat tile.

## Fitur

- Pengunjung: peta dan katalog, pencarian nama/alamat, filter olahraga/fasilitas, detail, harga, lokasi, dan kontak.
- Pengguna: registrasi/login, memilih slot tersedia, booking langsung terkonfirmasi tanpa pembayaran online, dan riwayat booking.
- Admin: mengelola lapangan miliknya, fasilitas pilihan, jam/slot mingguan, penutupan sementara, booking, serta pengaturan profil akun.
- Setiap endpoint admin membatasi lapangan, jadwal, penutupan, dan booking ke admin yang sedang login; ID pemilik tidak diterima dari request browser. Fasilitas merupakan katalog bersama yang hanya dapat dipilih.
- Semua waktu operasional dan booking menggunakan waktu lokal Pangkalpinang (WIB).

## Pemeriksaan

```powershell
cd C:\laragon\www\futsal-go\backend
npm run check
```

```powershell
cd C:\laragon\www\futsal-go\frontend
npm run build
```

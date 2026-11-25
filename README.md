# Futsal Go

Direktori lapangan futsal, mini-soccer, dan sepakbola untuk Pangkalpinang, dengan peta, akun user/admin, pengaturan ketersediaan, dan booking instan tanpa pembayaran online.

## Prasyarat

- Node.js 18 atau lebih baru dan npm.
- MySQL 8.0.16 atau lebih baru (mendukung SRID 4326 dan collation MySQL 8).

## Menyiapkan database

Database final beserta data venue awal tersedia di
[`backend/database/db_futsal_pangkalpinang.sql`](backend/database/db_futsal_pangkalpinang.sql).
File ini membuat skema lengkap dan menambahkan venue publik yang dapat diverifikasi.
Impor file tersebut **hanya untuk database baru**; jangan impor ulang ke database yang sudah berisi akun, booking, atau data operasional.

Jika `mysql` tersedia di `PATH`:

```powershell
cmd /c "mysql -u root -p < .\backend\database\db_futsal_pangkalpinang.sql"
```

File SQL tidak berisi akun pengguna, hash password, atau booking. Buat akun admin awal setelah impor sesuai langkah bootstrap di bawah. Harga atau jadwal yang tidak dapat diverifikasi tidak diisi; venue baru belum dapat dibooking sampai admin mengatur harga dan jadwalnya. Data venue contoh lama yang masih memiliki booking tetap disimpan, tetapi tidak dipublikasikan.

### Data venue dan sumber

Data lokasi diperiksa pada Google Maps dan disilang-periksa dengan direktori/pengelola publik pada 25 November 2026. Tarif per jam dan jadwal hanya diisi bila sumber menyatakan nilainya dengan jelas; tarif per sesi atau tarif dalam rentang tidak dikonversi menjadi angka per jam.

| Venue | Jenis | Sumber |
| --- | --- | --- |
| Executive Futsal | Futsal | [Google Maps](https://www.google.com/maps/search/?api=1&query=Executive+Futsal+Pangkalpinang), [IDN Times](https://sumsel.idntimes.com/travel/destination/3-rekomendasi-sewa-lapangan-futsal-di-kota-pangkalpinang-c1c2-01-pj4sw-x9klg8), [Cybo](https://www.cybo.com/ID-biz/executive-futsal-badminton) |
| Futsal CitraLand Botanical | Futsal | [Google Maps](https://www.google.com/maps/search/?api=1&query=Futsal+CitraLand+Botanical+Pangkalpinang), [AYO Indonesia](https://ayo.co.id/v/futsal-citraland-botanical) |
| GWK Futsal Arena | Futsal | [Google Maps](https://www.google.com/maps/search/?api=1&query=GWK+Futsal+Arena+Pangkalpinang), [IDN Times](https://sumsel.idntimes.com/travel/destination/3-rekomendasi-sewa-lapangan-futsal-di-kota-pangkalpinang-c1c2-01-pj4sw-x9klg8), [Yandex Maps](https://yandex.com/maps/org/gwk_futsal_arena/59201304023/) |
| Minisoccer ATO Arena | Mini-soccer | [Google Maps](https://www.google.com/maps/search/?api=1&query=Minisoccer+ATO+Arena+Pangkalpinang), [Sporto](https://sporto.id/) |
| Waka Waka 88 Futsal dan Cafe | Futsal | [Google Maps](https://www.google.com/maps/search/?api=1&query=Waka+Waka+88+Futsal+Pangkalpinang), [IDN Times](https://sumsel.idntimes.com/travel/destination/3-rekomendasi-sewa-lapangan-futsal-di-kota-pangkalpinang-c1c2-01-pj4sw-x9klg8), [Restaurant Guru](https://restaurantguru.com/Waka-Waka-88-Futsal-dan-Cafe-Pangkal-Pinang) |

Belum ditemukan listing sewa lapangan sepakbola ukuran penuh yang dapat diverifikasi dari sumber publik yang diperiksa, jadi kategori sepakbola belum diisi. Tarif di listing AYO untuk CitraLand dinyatakan per sesi, sedangkan tarif Executive/GWK yang ditemukan berupa rentang atau informasi lama; kolom harga per jam sengaja dibiarkan kosong. Konfirmasi harga, jadwal, dan ketersediaan langsung kepada venue sebelum melakukan booking.

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

- Pengunjung: peta dan katalog, pencarian nama/alamat, filter olahraga/fasilitas, detail, harga, lokasi, dan kontak. Harga yang belum diverifikasi ditampilkan sebagai “Harga belum dikonfirmasi”, bukan Rp0.
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

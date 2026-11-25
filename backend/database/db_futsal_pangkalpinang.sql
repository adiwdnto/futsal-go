CREATE DATABASE IF NOT EXISTS db_futsal_pangkalpinang
  CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
USE db_futsal_pangkalpinang;

CREATE TABLE IF NOT EXISTS users (
  user_id INT NOT NULL AUTO_INCREMENT,
  full_name VARCHAR(100) NOT NULL,
  email VARCHAR(100) NOT NULL,
  password VARCHAR(255) NOT NULL,
  role ENUM('admin', 'user') DEFAULT 'user',
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id),
  UNIQUE KEY email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS facilities (
  facility_id INT NOT NULL AUTO_INCREMENT,
  facility_name VARCHAR(100) NOT NULL,
  PRIMARY KEY (facility_id),
  UNIQUE KEY facility_name (facility_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS futsal_fields (
  field_id INT NOT NULL AUTO_INCREMENT,
  created_by INT DEFAULT NULL,
  field_name VARCHAR(150) NOT NULL,
  sport_type ENUM('futsal', 'mini_soccer', 'soccer') NOT NULL DEFAULT 'futsal',
  address TEXT NOT NULL,
  description TEXT,
  photo_url VARCHAR(1000) DEFAULT NULL,
  phone_number VARCHAR(20) DEFAULT NULL,
  price_per_hour DECIMAL(12,2) DEFAULT NULL,
  opening_time TIME DEFAULT NULL,
  closing_time TIME DEFAULT NULL,
  location POINT NOT NULL SRID 4326,
  is_published TINYINT(1) NOT NULL DEFAULT '1',
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (field_id),
  SPATIAL KEY idx_location (location),
  KEY fk_futsal_user (created_by),
  KEY idx_field_owner (created_by, field_id),
  KEY idx_field_publication_sport (is_published, sport_type),
  CONSTRAINT fk_futsal_user FOREIGN KEY (created_by)
    REFERENCES users (user_id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS field_schedules (
  schedule_id INT NOT NULL AUTO_INCREMENT,
  field_id INT NOT NULL,
  day_of_week TINYINT UNSIGNED NOT NULL,
  opening_time TIME NOT NULL,
  closing_time TIME NOT NULL,
  slot_minutes SMALLINT UNSIGNED NOT NULL DEFAULT '60',
  PRIMARY KEY (schedule_id),
  UNIQUE KEY uq_field_schedule_day (field_id, day_of_week),
  CONSTRAINT chk_schedule_day CHECK (day_of_week BETWEEN 0 AND 6),
  CONSTRAINT chk_schedule_times CHECK (opening_time < closing_time),
  CONSTRAINT chk_schedule_slot CHECK (slot_minutes BETWEEN 15 AND 240),
  CONSTRAINT fk_schedule_field FOREIGN KEY (field_id)
    REFERENCES futsal_fields (field_id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS field_blackouts (
  blackout_id INT NOT NULL AUTO_INCREMENT,
  field_id INT NOT NULL,
  starts_at DATETIME NOT NULL,
  ends_at DATETIME NOT NULL,
  reason VARCHAR(255) DEFAULT NULL,
  PRIMARY KEY (blackout_id),
  KEY idx_blackout_field_time (field_id, starts_at, ends_at),
  CONSTRAINT chk_blackout_times CHECK (starts_at < ends_at),
  CONSTRAINT fk_blackout_field FOREIGN KEY (field_id)
    REFERENCES futsal_fields (field_id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS field_facilities (
  field_id INT NOT NULL,
  facility_id INT NOT NULL,
  PRIMARY KEY (field_id, facility_id),
  KEY fk_facility (facility_id),
  CONSTRAINT fk_facility FOREIGN KEY (facility_id)
    REFERENCES facilities (facility_id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_field FOREIGN KEY (field_id)
    REFERENCES futsal_fields (field_id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS bookings (
  booking_id BIGINT NOT NULL AUTO_INCREMENT,
  field_id INT NOT NULL,
  user_id INT NOT NULL,
  starts_at DATETIME NOT NULL,
  ends_at DATETIME NOT NULL,
  price_total DECIMAL(12,2) NOT NULL,
  status ENUM('confirmed', 'cancelled') NOT NULL DEFAULT 'confirmed',
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  cancelled_at DATETIME DEFAULT NULL,
  PRIMARY KEY (booking_id),
  KEY idx_booking_field_time (field_id, status, starts_at, ends_at),
  KEY idx_booking_user_time (user_id, starts_at),
  CONSTRAINT chk_booking_times CHECK (starts_at < ends_at),
  CONSTRAINT fk_booking_field FOREIGN KEY (field_id)
    REFERENCES futsal_fields (field_id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_booking_user FOREIGN KEY (user_id)
    REFERENCES users (user_id) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

INSERT IGNORE INTO facilities (facility_name) VALUES
  ('Toilet'),
  ('Parkir'),
  ('Mushola'),
  ('Kantin'),
  ('Ruang Ganti');

-- Google Maps: https://www.google.com/maps/search/?api=1&query=Executive+Futsal+Pangkalpinang
-- IDN Times reports futsal rental and Cybo lists the public contact.
INSERT INTO futsal_fields
  (field_name, sport_type, address, description, phone_number, location, is_published)
SELECT
  'Executive Futsal', 'futsal',
  'Jalan Basuki Rachmad Ujunu III, Sriwijaya, Kec. Bukitintan, Kota Pangkal Pinang, Kepulauan Bangka Belitung 33684',
  'Tarif dan jadwal terbaru perlu dikonfirmasi langsung kepada pengelola.',
  '0819-9538-1987',
  ST_GeomFromText('POINT(106.1111558 -2.1513545)', 4326, 'axis-order=long-lat'),
  1
WHERE NOT EXISTS (
  SELECT 1 FROM futsal_fields WHERE field_name = 'Executive Futsal'
);

-- Google Maps: https://www.google.com/maps/search/?api=1&query=Futsal+CitraLand+Botanical+Pangkalpinang
-- AYO Indonesia lists the venue at Rp75,000 per session with no stated session length.
INSERT INTO futsal_fields
  (field_name, sport_type, address, description, location, is_published)
SELECT
  'Futsal CitraLand Botanical', 'futsal',
  'CitraLand Botanical City, Jl. Alexander Ketapang, Bacang, Bukitintan, Pangkalpinang, Kepulauan Bangka Belitung 33148',
  'AYO Indonesia mencantumkan harga mulai Rp75.000 per sesi. Durasi sesi tidak disebutkan, jadi harga per jam dan jadwal booking belum diisi.',
  ST_GeomFromText('POINT(106.1496016 -2.1289753)', 4326, 'axis-order=long-lat'),
  1
WHERE NOT EXISTS (
  SELECT 1 FROM futsal_fields WHERE field_name = 'Futsal CitraLand Botanical'
);

-- Google Maps: https://www.google.com/maps/search/?api=1&query=GWK+Futsal+Arena+Pangkalpinang
-- Yandex Maps lists the public contact and IDN Times reports futsal rental.
INSERT INTO futsal_fields
  (field_name, sport_type, address, description, phone_number, location, is_published)
SELECT
  'GWK Futsal Arena', 'futsal',
  'Jalan Padat Karya, Selindung, Kec. Gabek, Kota Pangkal Pinang, Kepulauan Bangka Belitung 33111',
  'Tarif dan jadwal terbaru perlu dikonfirmasi langsung kepada pengelola.',
  '+62 821-8123-7533',
  ST_GeomFromText('POINT(106.108402 -2.0864605)', 4326, 'axis-order=long-lat'),
  1
WHERE NOT EXISTS (
  SELECT 1 FROM futsal_fields WHERE field_name = 'GWK Futsal Arena'
);

-- Google Maps: https://www.google.com/maps/search/?api=1&query=Minisoccer+ATO+Arena+Pangkalpinang
-- Sporto currently lists Ato Arena. Confirm rental terms and availability with the venue.
INSERT INTO futsal_fields
  (field_name, sport_type, address, description, location, is_published)
SELECT
  'Minisoccer ATO Arena', 'mini_soccer',
  'W423+X5P, Selindung, Kec. Gabek, Kota Pangkal Pinang, Kepulauan Bangka Belitung 33172',
  'Tarif sewa per jam, jadwal lapangan, dan nomor kontak belum terverifikasi.',
  ST_GeomFromText('POINT(106.102944 -2.0975285)', 4326, 'axis-order=long-lat'),
  1
WHERE NOT EXISTS (
  SELECT 1 FROM futsal_fields WHERE field_name = 'Minisoccer ATO Arena'
);

-- Google Maps: https://www.google.com/maps/search/?api=1&query=Waka+Waka+88+Futsal+Pangkalpinang
-- Restaurant Guru and IDN Times identify the business as a futsal rental venue.
INSERT INTO futsal_fields
  (field_name, sport_type, address, description, phone_number, location, is_published)
SELECT
  'Waka Waka 88 Futsal dan Cafe', 'futsal',
  'Jl. Senopati No.88, Kacang Pedang, Kec. Gerunggang, Kota Pangkal Pinang, Kepulauan Bangka Belitung 33684',
  'Tarif dan jadwal terbaru perlu dikonfirmasi langsung kepada pengelola.',
  '+62 821-8035-4106',
  ST_GeomFromText('POINT(106.0990939 -2.1281706)', 4326, 'axis-order=long-lat'),
  1
WHERE NOT EXISTS (
  SELECT 1 FROM futsal_fields WHERE field_name = 'Waka Waka 88 Futsal dan Cafe'
);

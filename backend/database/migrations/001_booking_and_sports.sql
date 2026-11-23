USE db_futsal_pangkalpinang;

ALTER TABLE futsal_fields
  ADD COLUMN sport_type ENUM('futsal', 'mini_soccer', 'soccer') NOT NULL DEFAULT 'futsal' AFTER field_name,
  ADD COLUMN description TEXT NULL AFTER address,
  ADD COLUMN photo_url VARCHAR(1000) NULL AFTER description,
  ADD COLUMN is_published TINYINT(1) NOT NULL DEFAULT 1 AFTER location,
  ADD KEY idx_field_owner (created_by, field_id),
  ADD KEY idx_field_publication_sport (is_published, sport_type);

CREATE TABLE field_schedules (
  schedule_id INT NOT NULL AUTO_INCREMENT,
  field_id INT NOT NULL,
  day_of_week TINYINT UNSIGNED NOT NULL,
  opening_time TIME NOT NULL,
  closing_time TIME NOT NULL,
  slot_minutes SMALLINT UNSIGNED NOT NULL DEFAULT 60,
  PRIMARY KEY (schedule_id),
  UNIQUE KEY uq_field_schedule_day (field_id, day_of_week),
  CONSTRAINT chk_schedule_day CHECK (day_of_week BETWEEN 0 AND 6),
  CONSTRAINT chk_schedule_times CHECK (opening_time < closing_time),
  CONSTRAINT chk_schedule_slot CHECK (slot_minutes BETWEEN 15 AND 240),
  CONSTRAINT fk_schedule_field FOREIGN KEY (field_id)
    REFERENCES futsal_fields (field_id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE field_blackouts (
  blackout_id INT NOT NULL AUTO_INCREMENT,
  field_id INT NOT NULL,
  starts_at DATETIME NOT NULL,
  ends_at DATETIME NOT NULL,
  reason VARCHAR(255) NULL,
  PRIMARY KEY (blackout_id),
  KEY idx_blackout_field_time (field_id, starts_at, ends_at),
  CONSTRAINT chk_blackout_times CHECK (starts_at < ends_at),
  CONSTRAINT fk_blackout_field FOREIGN KEY (field_id)
    REFERENCES futsal_fields (field_id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE bookings (
  booking_id BIGINT NOT NULL AUTO_INCREMENT,
  field_id INT NOT NULL,
  user_id INT NOT NULL,
  starts_at DATETIME NOT NULL,
  ends_at DATETIME NOT NULL,
  price_total DECIMAL(12,2) NOT NULL,
  status ENUM('confirmed', 'cancelled') NOT NULL DEFAULT 'confirmed',
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  cancelled_at DATETIME NULL,
  PRIMARY KEY (booking_id),
  KEY idx_booking_field_time (field_id, status, starts_at, ends_at),
  KEY idx_booking_user_time (user_id, starts_at),
  CONSTRAINT chk_booking_times CHECK (starts_at < ends_at),
  CONSTRAINT fk_booking_field FOREIGN KEY (field_id)
    REFERENCES futsal_fields (field_id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_booking_user FOREIGN KEY (user_id)
    REFERENCES users (user_id) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

INSERT INTO field_schedules (field_id, day_of_week, opening_time, closing_time, slot_minutes)
SELECT f.field_id, days.day_of_week, f.opening_time, f.closing_time, 60
FROM futsal_fields AS f
CROSS JOIN (
  SELECT 0 AS day_of_week UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL
  SELECT 3 UNION ALL SELECT 4 UNION ALL SELECT 5 UNION ALL SELECT 6
) AS days
WHERE f.opening_time IS NOT NULL
  AND f.closing_time IS NOT NULL
  AND f.opening_time < f.closing_time;

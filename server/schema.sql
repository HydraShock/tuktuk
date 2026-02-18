CREATE TABLE IF NOT EXISTS booking_intents (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  booking_date DATE NOT NULL,
  time_slot VARCHAR(40) NOT NULL,
  guests TINYINT UNSIGNED NOT NULL,
  tour_id VARCHAR(40) NULL,
  status ENUM('pending', 'confirmed', 'expired', 'cancelled') NOT NULL DEFAULT 'pending',
  payment_provider VARCHAR(32) NULL,
  payment_reference VARCHAR(128) NULL,
  expires_at DATETIME NOT NULL,
  confirmed_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_intents_slot (booking_date, time_slot, status),
  INDEX idx_intents_expires (expires_at)
);

CREATE TABLE IF NOT EXISTS appointments (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  booking_date DATE NOT NULL,
  time_slot VARCHAR(40) NOT NULL,
  guests TINYINT UNSIGNED NOT NULL,
  tour_id VARCHAR(40) NULL,
  payment_provider VARCHAR(32) NOT NULL,
  payment_reference VARCHAR(128) NULL,
  status ENUM('confirmed', 'cancelled') NOT NULL DEFAULT 'confirmed',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_appointments_slot (booking_date, time_slot, status)
);

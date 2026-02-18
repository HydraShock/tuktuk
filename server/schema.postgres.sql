-- PostgreSQL schema + operational queries for booking flow
-- Flow:
-- 1) insert in booking_intents (buffer)
-- 2) ONLY after payment success, move to appointments in one transaction

BEGIN;

CREATE TABLE IF NOT EXISTS booking_intents (
  id BIGSERIAL PRIMARY KEY,
  booking_date DATE NOT NULL,
  time_slot VARCHAR(40) NOT NULL,
  guests SMALLINT NOT NULL CHECK (guests BETWEEN 1 AND 8),
  tour_id VARCHAR(40),
  unit_price_cents INTEGER,
  total_price_cents INTEGER,
  customer_first_name VARCHAR(80),
  customer_last_name VARCHAR(80),
  customer_phone VARCHAR(40),
  customer_email VARCHAR(160),
  status VARCHAR(16) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'confirmed', 'expired', 'cancelled')),
  payment_provider VARCHAR(32),
  payment_reference VARCHAR(128),
  expires_at TIMESTAMPTZ NOT NULL,
  confirmed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS appointments (
  id BIGSERIAL PRIMARY KEY,
  booking_date DATE NOT NULL,
  time_slot VARCHAR(40) NOT NULL,
  guests SMALLINT NOT NULL CHECK (guests BETWEEN 1 AND 8),
  tour_id VARCHAR(40),
  unit_price_cents INTEGER,
  total_price_cents INTEGER,
  customer_first_name VARCHAR(80),
  customer_last_name VARCHAR(80),
  customer_phone VARCHAR(40),
  customer_email VARCHAR(160),
  payment_provider VARCHAR(32) NOT NULL,
  payment_reference VARCHAR(128),
  status VARCHAR(16) NOT NULL DEFAULT 'confirmed'
    CHECK (status IN ('confirmed', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Backward-compatible migration for existing tables
ALTER TABLE booking_intents
  ADD COLUMN IF NOT EXISTS unit_price_cents INTEGER,
  ADD COLUMN IF NOT EXISTS total_price_cents INTEGER,
  ADD COLUMN IF NOT EXISTS customer_first_name VARCHAR(80),
  ADD COLUMN IF NOT EXISTS customer_last_name VARCHAR(80),
  ADD COLUMN IF NOT EXISTS customer_phone VARCHAR(40),
  ADD COLUMN IF NOT EXISTS customer_email VARCHAR(160);

ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS unit_price_cents INTEGER,
  ADD COLUMN IF NOT EXISTS total_price_cents INTEGER,
  ADD COLUMN IF NOT EXISTS customer_first_name VARCHAR(80),
  ADD COLUMN IF NOT EXISTS customer_last_name VARCHAR(80),
  ADD COLUMN IF NOT EXISTS customer_phone VARCHAR(40),
  ADD COLUMN IF NOT EXISTS customer_email VARCHAR(160);

CREATE INDEX IF NOT EXISTS idx_intents_slot
  ON booking_intents (booking_date, time_slot, status);

CREATE INDEX IF NOT EXISTS idx_intents_expires
  ON booking_intents (expires_at);

CREATE INDEX IF NOT EXISTS idx_appointments_slot
  ON appointments (booking_date, time_slot, status);

-- Keep updated_at current on updates
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_booking_intents_updated_at ON booking_intents;
CREATE TRIGGER trg_booking_intents_updated_at
BEFORE UPDATE ON booking_intents
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_appointments_updated_at ON appointments;
CREATE TRIGGER trg_appointments_updated_at
BEFORE UPDATE ON appointments
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMIT;

-- -------------------------------------------------------------------
-- QUERY 1: availability per slot for one month (YYYY-MM)
-- params:
--   $1 = from_date (DATE, e.g. 2026-02-01)
--   $2 = to_date   (DATE, e.g. 2026-03-01)
-- -------------------------------------------------------------------
/*
SELECT booking_date, time_slot, COUNT(*) AS total
FROM appointments
WHERE booking_date >= $1
  AND booking_date < $2
  AND status = 'confirmed'
GROUP BY booking_date, time_slot;

SELECT booking_date, time_slot, COUNT(*) AS total
FROM booking_intents
WHERE booking_date >= $1
  AND booking_date < $2
  AND status = 'pending'
  AND expires_at > NOW()
GROUP BY booking_date, time_slot;
*/

-- -------------------------------------------------------------------
-- QUERY 2: create booking intent (buffer), ONLY if slot has capacity
-- params:
--   $1 = booking_date (DATE)
--   $2 = time_slot (TEXT)
--   $3 = booking_date (DATE)
--   $4 = time_slot (TEXT)
--   $5 = booking_date (DATE)
--   $6 = time_slot (TEXT)
--   $7 = guests (INT)
--   $8 = tour_id (TEXT | NULL)
--   $9 = pending_minutes (INT, e.g. 15)
--  $10 = max_bookings_per_slot (INT, e.g. 4)
-- -------------------------------------------------------------------
/*
WITH slot_counts AS (
  SELECT
    (SELECT COUNT(*) FROM appointments
      WHERE booking_date = $1 AND time_slot = $2 AND status = 'confirmed') AS booked,
    (SELECT COUNT(*) FROM booking_intents
      WHERE booking_date = $3 AND time_slot = $4 AND status = 'pending' AND expires_at > NOW()) AS reserved
),
inserted AS (
  INSERT INTO booking_intents (
    booking_date, time_slot, guests, tour_id, status, expires_at
  )
  SELECT
    $5, $6, $7, $8, 'pending', NOW() + make_interval(mins => $9)
  FROM slot_counts
  WHERE (booked + reserved) < $10
  RETURNING id, expires_at
)
SELECT * FROM inserted;
*/

-- -------------------------------------------------------------------
-- QUERY 3: confirm booking after successful payment (transaction)
-- params:
--   $1 = intent_id (BIGINT)
--   $2 = payment_provider (TEXT, e.g. 'paypal')
--   $3 = payment_reference (TEXT | NULL)
--   $4 = max_bookings_per_slot (INT)
-- -------------------------------------------------------------------
/*
BEGIN;

-- lock intent
SELECT id, booking_date, time_slot, guests, tour_id, status, expires_at
FROM booking_intents
WHERE id = $1
FOR UPDATE;

-- app-side checks required after SELECT:
-- 1) row exists
-- 2) status = 'pending'
-- 3) expires_at > NOW()

-- lock slot by checking confirmed count in transaction
SELECT COUNT(*) AS booked
FROM appointments
WHERE booking_date = (SELECT booking_date FROM booking_intents WHERE id = $1)
  AND time_slot = (SELECT time_slot FROM booking_intents WHERE id = $1)
  AND status = 'confirmed';

-- if booked >= $4 => ROLLBACK

INSERT INTO appointments (
  booking_date, time_slot, guests, tour_id, payment_provider, payment_reference, status
)
SELECT booking_date, time_slot, guests, tour_id, $2, $3, 'confirmed'
FROM booking_intents
WHERE id = $1
RETURNING id;

UPDATE booking_intents
SET status = 'confirmed',
    payment_provider = $2,
    payment_reference = $3,
    confirmed_at = NOW()
WHERE id = $1;

COMMIT;
*/

-- -------------------------------------------------------------------
-- QUERY 4: expire stale intents (run periodically via cron/job)
-- -------------------------------------------------------------------
/*
UPDATE booking_intents
SET status = 'expired'
WHERE status = 'pending'
  AND expires_at <= NOW();
*/

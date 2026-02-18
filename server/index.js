const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { Pool } = require('pg');

dotenv.config();

const app = express();
const port = Number(process.env.PORT || 4000);
const frontendOriginRaw = process.env.FRONTEND_ORIGIN || '*';
const maxBookingsPerSlot = Number(process.env.MAX_BOOKINGS_PER_SLOT || 1);
const pendingIntentMinutes = Number(process.env.PENDING_INTENT_MINUTES || 15);
const defaultPaymentMode = process.env.NODE_ENV === 'production' ? 'paypal' : 'mock';
const paymentMode = String(process.env.PAYMENT_MODE || defaultPaymentMode).trim().toLowerCase();
const paymentProvidersByMode = {
  mock: ['mock', 'paypal'],
  paypal: ['paypal'],
};
const allowedPaymentProviders = paymentProvidersByMode[paymentMode] || paymentProvidersByMode[defaultPaymentMode];
const fixedAvailabilitySlots = ['10:00', '14:00', '18:00'];
const fixedAvailabilitySlotCapacity = 1;
const slotLabels = (process.env.SLOT_LABELS || '09:00 - 11:30,11:45 - 14:20,15:00 - 17:30')
  .split(',')
  .map((slot) => slot.trim())
  .filter(Boolean);

const pool = new Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 5432),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  max: Number(process.env.DB_POOL_SIZE || 10),
});

const allowedOrigins = frontendOriginRaw
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const corsOptions = {
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes('*')) {
      callback(null, true);
      return;
    }
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
      return;
    }
    callback(new Error('Origin non consentita da CORS.'));
  },
};

app.use(cors(corsOptions));
app.use(express.json());

function isValidDateKey(input) {
  return /^\d{4}-\d{2}-\d{2}$/.test(input);
}

function isValidMonthKey(input) {
  return /^\d{4}-\d{2}$/.test(input);
}

function getMonthBounds(monthKey) {
  const [yearRaw, monthRaw] = monthKey.split('-');
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const fromDate = new Date(year, month - 1, 1);
  const toDate = new Date(year, month, 1);
  const from = `${yearRaw}-${monthRaw}-01`;
  const to = `${toDate.getFullYear()}-${String(toDate.getMonth() + 1).padStart(2, '0')}-01`;
  const daysInMonth = new Date(year, month, 0).getDate();
  return { fromDate, toDate, from, to, daysInMonth, yearRaw, monthRaw };
}

function buildEmptyAvailability(monthKey) {
  const { daysInMonth, yearRaw, monthRaw } = getMonthBounds(monthKey);
  const days = {};
  for (let day = 1; day <= daysInMonth; day += 1) {
    const dayKey = `${yearRaw}-${monthRaw}-${String(day).padStart(2, '0')}`;
    const slots = {};
    slotLabels.forEach((slot) => {
      slots[slot] = { available: true, booked: 0, reserved: 0, capacity: maxBookingsPerSlot };
    });
    days[dayKey] = { allSlotsFull: false, slots };
  }
  return days;
}

function parseIsoDateOnly(value) {
  if (!isValidDateKey(value || '')) {
    return null;
  }
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year
    || date.getUTCMonth() + 1 !== month
    || date.getUTCDate() !== day
  ) {
    return null;
  }
  return date;
}

function formatIsoDateOnlyUtc(date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function isSupportedPaymentProvider(providerRaw) {
  const provider = String(providerRaw || '').trim().toLowerCase();
  return allowedPaymentProviders.includes(provider);
}

async function getRangeAvailability(fromDate, toDate) {
  const fromKey = formatIsoDateOnlyUtc(fromDate);
  const toKey = formatIsoDateOnlyUtc(toDate);

  // One aggregated scan over confirmed appointments and non-expired pending intents.
  const occupancyResult = await pool.query(
    `
      SELECT booking_date::text AS day_key, time_slot, COUNT(*)::int AS occupied
      FROM (
        SELECT booking_date, time_slot
        FROM appointments
        WHERE booking_date >= $1::date
          AND booking_date < $2::date
          AND status = 'confirmed'

        UNION ALL

        SELECT booking_date, time_slot
        FROM booking_intents
        WHERE booking_date >= $1::date
          AND booking_date < $2::date
          AND status = 'pending'
          AND expires_at > NOW()
      ) AS occupied_rows
      WHERE time_slot = ANY($3::text[])
      GROUP BY booking_date, time_slot
    `,
    [fromKey, toKey, fixedAvailabilitySlots]
  );

  const availability = {};

  for (
    let cursor = new Date(fromDate.getTime());
    cursor < toDate;
    cursor = new Date(cursor.getTime() + 24 * 60 * 60 * 1000)
  ) {
    const dayKey = formatIsoDateOnlyUtc(cursor);
    const slots = {};
    fixedAvailabilitySlots.forEach((slot) => {
      slots[slot] = 'available';
    });
    availability[dayKey] = {
      dayStatus: 'available',
      slots,
    };
  }

  occupancyResult.rows.forEach((row) => {
    const dayKey = row.day_key;
    if (!availability[dayKey] || !availability[dayKey].slots[row.time_slot]) {
      return;
    }
    const occupied = Number(row.occupied || 0);
    availability[dayKey].slots[row.time_slot] = occupied >= fixedAvailabilitySlotCapacity ? 'full' : 'available';
  });

  Object.values(availability).forEach((day) => {
    const allSlotsFull = fixedAvailabilitySlots.every((slot) => day.slots[slot] === 'full');
    day.dayStatus = allSlotsFull ? 'full' : 'available';
  });

  return availability;
}

app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ ok: false, message: 'Database non raggiungibile.' });
  }
});

app.get('/api/payment-config', (req, res) => {
  res.json({
    mode: paymentMode,
    providers: allowedPaymentProviders,
  });
});

app.get('/api/availability', async (req, res) => {
  const { month } = req.query;
  if (!isValidMonthKey(month || '')) {
    res.status(400).json({ message: 'Parametro month non valido. Usa YYYY-MM.' });
    return;
  }

  const { from, to } = getMonthBounds(month);
  const days = buildEmptyAvailability(month);

  try {
    const bookedResult = await pool.query(
      `
        SELECT booking_date::text AS day_key, time_slot, COUNT(*) AS total
        FROM appointments
        WHERE booking_date >= $1 AND booking_date < $2 AND status = 'confirmed'
        GROUP BY booking_date, time_slot
      `,
      [from, to]
    );

    const reservedResult = await pool.query(
      `
        SELECT booking_date::text AS day_key, time_slot, COUNT(*) AS total
        FROM booking_intents
        WHERE booking_date >= $1 AND booking_date < $2 AND status = 'pending' AND expires_at > NOW()
        GROUP BY booking_date, time_slot
      `,
      [from, to]
    );

    bookedResult.rows.forEach((row) => {
      const dayKey = row.day_key;
      const slot = row.time_slot;
      if (!days[dayKey] || !days[dayKey].slots[slot]) {
        return;
      }
      days[dayKey].slots[slot].booked = Number(row.total);
    });

    reservedResult.rows.forEach((row) => {
      const dayKey = row.day_key;
      const slot = row.time_slot;
      if (!days[dayKey] || !days[dayKey].slots[slot]) {
        return;
      }
      days[dayKey].slots[slot].reserved = Number(row.total);
    });

    Object.values(days).forEach((day) => {
      let allSlotsFull = true;
      slotLabels.forEach((slot) => {
        const slotData = day.slots[slot];
        const available = slotData.booked + slotData.reserved < maxBookingsPerSlot;
        slotData.available = available;
        if (available) {
          allSlotsFull = false;
        }
      });
      day.allSlotsFull = allSlotsFull;
    });

    res.json({ month, days });
  } catch (error) {
    res.status(500).json({ message: 'Errore durante il calcolo disponibilita.' });
  }
});

app.get('/api/availability/range', async (req, res) => {
  const fromDateRaw = String(req.query.from_date || '');
  const toDateRaw = String(req.query.to_date || '');
  const fromDate = parseIsoDateOnly(fromDateRaw);
  const toDate = parseIsoDateOnly(toDateRaw);

  if (!fromDate || !toDate) {
    res.status(400).json({
      message: 'Parametri non validi. Usa from_date e to_date in formato YYYY-MM-DD.',
    });
    return;
  }

  if (fromDate >= toDate) {
    res.status(400).json({
      message: 'Intervallo non valido: from_date deve essere precedente a to_date.',
    });
    return;
  }

  const maxRangeDays = 366;
  const rangeDays = Math.floor((toDate.getTime() - fromDate.getTime()) / (24 * 60 * 60 * 1000));
  if (rangeDays > maxRangeDays) {
    res.status(400).json({
      message: `Intervallo troppo grande. Massimo ${maxRangeDays} giorni.`,
    });
    return;
  }

  try {
    const availability = await getRangeAvailability(fromDate, toDate);
    res.json(availability);
  } catch (error) {
    res.status(500).json({ message: 'Errore durante il calcolo disponibilita range.' });
  }
});

app.post('/api/booking-intents', async (req, res) => {
  const { date, timeSlot, guests, tourId } = req.body || {};
  if (!isValidDateKey(date || '')) {
    res.status(400).json({ message: 'Data non valida. Usa YYYY-MM-DD.' });
    return;
  }
  if (!slotLabels.includes(timeSlot)) {
    res.status(400).json({ message: 'Fascia oraria non valida.' });
    return;
  }
  const guestsNumber = Number(guests || 0);
  if (!Number.isInteger(guestsNumber) || guestsNumber < 1 || guestsNumber > 8) {
    res.status(400).json({ message: 'Numero ospiti non valido.' });
    return;
  }

  const dayDate = new Date(`${date}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (dayDate < today) {
    res.status(400).json({ message: 'Non puoi prenotare nel passato.' });
    return;
  }

  try {
    const countsResult = await pool.query(
      `
        SELECT
          (SELECT COUNT(*) FROM appointments WHERE booking_date = $1 AND time_slot = $2 AND status = 'confirmed') AS booked,
          (SELECT COUNT(*) FROM booking_intents WHERE booking_date = $3 AND time_slot = $4 AND status = 'pending' AND expires_at > NOW()) AS reserved
      `,
      [date, timeSlot, date, timeSlot]
    );

    const booked = Number(countsResult.rows[0].booked || 0);
    const reserved = Number(countsResult.rows[0].reserved || 0);
    if (booked + reserved >= maxBookingsPerSlot) {
      res.status(409).json({ message: 'Fascia oraria esaurita.' });
      return;
    }

    const insertResult = await pool.query(
      `
        INSERT INTO booking_intents (booking_date, time_slot, guests, tour_id, status, expires_at)
        VALUES ($1, $2, $3, $4, 'pending', NOW() + ($5::text || ' minutes')::interval)
        RETURNING id, expires_at
      `,
      [date, timeSlot, guestsNumber, tourId || null, pendingIntentMinutes]
    );

    const intentId = insertResult.rows[0].id;
    const expiresAt = insertResult.rows[0].expires_at;

    res.status(201).json({
      intentId,
      expiresAt,
      status: 'pending',
    });
  } catch (error) {
    res.status(500).json({ message: 'Errore durante la creazione del buffer prenotazione.' });
  }
});

app.post('/api/booking-intents/expire', async (req, res) => {
  try {
    const result = await pool.query(
      `
        UPDATE booking_intents
        SET status = 'expired'
        WHERE status = 'pending'
          AND expires_at <= NOW()
      `
    );
    res.json({ expiredIntents: result.rowCount || 0 });
  } catch (error) {
    res.status(500).json({ message: 'Errore durante la scadenza intent.' });
  }
});

app.post('/api/bookings/confirm', async (req, res) => {
  const { intentId, paymentProvider, paymentReference } = req.body || {};
  const normalizedPaymentProvider = String(paymentProvider || '').trim().toLowerCase();
  if (!intentId) {
    res.status(400).json({ message: 'Intent ID mancante.' });
    return;
  }
  if (!isSupportedPaymentProvider(normalizedPaymentProvider)) {
    res.status(400).json({ message: 'Metodo di pagamento non supportato per la modalita corrente.' });
    return;
  }
  const normalizedPaymentReference = paymentReference
    ? String(paymentReference).trim()
    : `${normalizedPaymentProvider.toUpperCase()}_${Date.now()}`;

  const connection = await pool.connect();
  try {
    await connection.query('BEGIN');

    const intentResult = await connection.query(
      `
        SELECT id, booking_date, time_slot, guests, tour_id, status, expires_at
        FROM booking_intents
        WHERE id = $1
        FOR UPDATE
      `,
      [intentId]
    );

    if (!intentResult.rows.length) {
      await connection.query('ROLLBACK');
      res.status(404).json({ message: 'Prenotazione buffer non trovata.' });
      return;
    }

    const intent = intentResult.rows[0];
    if (intent.status !== 'pending') {
      await connection.query('ROLLBACK');
      res.status(409).json({ message: 'Intent gia processato.' });
      return;
    }

    const expired = new Date(intent.expires_at).getTime() <= Date.now();
    if (expired) {
      await connection.query(
        'UPDATE booking_intents SET status = $1 WHERE id = $2',
        ['expired', intent.id]
      );
      await connection.query('COMMIT');
      res.status(409).json({ message: 'Intent scaduto, riprova.' });
      return;
    }

    const slotResult = await connection.query(
      `
        SELECT COUNT(*) AS booked
        FROM appointments
        WHERE booking_date = $1 AND time_slot = $2 AND status = 'confirmed'
      `,
      [intent.booking_date, intent.time_slot]
    );

    if (Number(slotResult.rows[0].booked || 0) >= maxBookingsPerSlot) {
      await connection.query('ROLLBACK');
      res.status(409).json({ message: 'Fascia oraria non piu disponibile.' });
      return;
    }

    const insertResult = await connection.query(
      `
        INSERT INTO appointments (
          booking_date,
          time_slot,
          guests,
          tour_id,
          payment_provider,
          payment_reference,
          status
        )
        VALUES ($1, $2, $3, $4, $5, $6, 'confirmed')
        RETURNING id
      `,
      [
        intent.booking_date,
        intent.time_slot,
        intent.guests,
        intent.tour_id,
        normalizedPaymentProvider,
        normalizedPaymentReference || null,
      ]
    );

    await connection.query(
      `
        UPDATE booking_intents
        SET status = 'confirmed', payment_provider = $1, payment_reference = $2, confirmed_at = NOW()
        WHERE id = $3
      `,
      [normalizedPaymentProvider, normalizedPaymentReference || null, intent.id]
    );

    await connection.query('COMMIT');
    res.status(201).json({ bookingId: insertResult.rows[0].id, message: 'Prenotazione confermata.' });
  } catch (error) {
    await connection.query('ROLLBACK');
    res.status(500).json({ message: 'Errore durante la conferma prenotazione.' });
  } finally {
    connection.release();
  }
});

app.listen(port, () => {
  console.log(`Booking API attiva su http://localhost:${port}`);
});

const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const mysql = require('mysql2/promise');

dotenv.config();

const app = express();
const port = Number(process.env.PORT || 4000);
const frontendOrigin = process.env.FRONTEND_ORIGIN || '*';
const maxBookingsPerSlot = Number(process.env.MAX_BOOKINGS_PER_SLOT || 4);
const pendingIntentMinutes = Number(process.env.PENDING_INTENT_MINUTES || 15);
const slotLabels = (process.env.SLOT_LABELS || '09:00 - 11:30,11:45 - 14:20,15:00 - 17:30')
  .split(',')
  .map((slot) => slot.trim())
  .filter(Boolean);

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: Number(process.env.DB_POOL_SIZE || 10),
  queueLimit: 0,
});

app.use(cors({ origin: frontendOrigin === '*' ? true : frontendOrigin }));
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

function normalizeDateKey(rawValue) {
  if (rawValue instanceof Date) {
    return rawValue.toISOString().slice(0, 10);
  }
  return String(rawValue).slice(0, 10);
}

app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ ok: false, message: 'Database non raggiungibile.' });
  }
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
    const [bookedRows] = await pool.query(
      `
        SELECT booking_date, time_slot, COUNT(*) AS total
        FROM appointments
        WHERE booking_date >= ? AND booking_date < ? AND status = 'confirmed'
        GROUP BY booking_date, time_slot
      `,
      [from, to]
    );

    const [reservedRows] = await pool.query(
      `
        SELECT booking_date, time_slot, COUNT(*) AS total
        FROM booking_intents
        WHERE booking_date >= ? AND booking_date < ? AND status = 'pending' AND expires_at > UTC_TIMESTAMP()
        GROUP BY booking_date, time_slot
      `,
      [from, to]
    );

    bookedRows.forEach((row) => {
      const dayKey = normalizeDateKey(row.booking_date);
      const slot = row.time_slot;
      if (!days[dayKey] || !days[dayKey].slots[slot]) {
        return;
      }
      days[dayKey].slots[slot].booked = Number(row.total);
    });

    reservedRows.forEach((row) => {
      const dayKey = normalizeDateKey(row.booking_date);
      const slot = row.time_slot;
      if (!days[dayKey] || !days[dayKey].slots[slot]) {
        return;
      }
      days[dayKey].slots[slot].reserved = Number(row.total);
    });

    Object.values(days).forEach((day) => {
      day.allSlotsFull = slotLabels.every((slot) => {
        const slotData = day.slots[slot];
        const available = slotData.booked + slotData.reserved < maxBookingsPerSlot;
        slotData.available = available;
        return !available;
      });
    });

    res.json({ month, days });
  } catch (error) {
    res.status(500).json({ message: 'Errore durante il calcolo disponibilita.' });
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
    const [rows] = await pool.query(
      `
        SELECT
          (SELECT COUNT(*) FROM appointments WHERE booking_date = ? AND time_slot = ? AND status = 'confirmed') AS booked,
          (SELECT COUNT(*) FROM booking_intents WHERE booking_date = ? AND time_slot = ? AND status = 'pending' AND expires_at > UTC_TIMESTAMP()) AS reserved
      `,
      [date, timeSlot, date, timeSlot]
    );

    const booked = Number(rows[0].booked || 0);
    const reserved = Number(rows[0].reserved || 0);
    if (booked + reserved >= maxBookingsPerSlot) {
      res.status(409).json({ message: 'Fascia oraria esaurita.' });
      return;
    }

    const [insertResult] = await pool.query(
      `
        INSERT INTO booking_intents (booking_date, time_slot, guests, tour_id, status, expires_at)
        VALUES (?, ?, ?, ?, 'pending', DATE_ADD(UTC_TIMESTAMP(), INTERVAL ? MINUTE))
      `,
      [date, timeSlot, guestsNumber, tourId || null, pendingIntentMinutes]
    );

    const intentId = insertResult.insertId;
    const [intentRows] = await pool.query(
      'SELECT id, expires_at FROM booking_intents WHERE id = ?',
      [intentId]
    );

    res.status(201).json({
      intentId,
      expiresAt: intentRows[0].expires_at,
      status: 'pending',
    });
  } catch (error) {
    res.status(500).json({ message: 'Errore durante la creazione del buffer prenotazione.' });
  }
});

app.post('/api/bookings/confirm', async (req, res) => {
  const { intentId, paymentProvider, paymentReference } = req.body || {};
  if (!intentId) {
    res.status(400).json({ message: 'Intent ID mancante.' });
    return;
  }
  if (paymentProvider !== 'paypal') {
    res.status(400).json({ message: 'Metodo di pagamento non supportato.' });
    return;
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [intentRows] = await connection.query(
      `
        SELECT id, booking_date, time_slot, guests, tour_id, status, expires_at
        FROM booking_intents
        WHERE id = ?
        FOR UPDATE
      `,
      [intentId]
    );

    if (!intentRows.length) {
      await connection.rollback();
      res.status(404).json({ message: 'Prenotazione buffer non trovata.' });
      return;
    }

    const intent = intentRows[0];
    if (intent.status !== 'pending') {
      await connection.rollback();
      res.status(409).json({ message: 'Intent gia processato.' });
      return;
    }

    const expired = new Date(intent.expires_at).getTime() <= Date.now();
    if (expired) {
      await connection.query(
        'UPDATE booking_intents SET status = ? WHERE id = ?',
        ['expired', intent.id]
      );
      await connection.commit();
      res.status(409).json({ message: 'Intent scaduto, riprova.' });
      return;
    }

    const [slotRows] = await connection.query(
      `
        SELECT COUNT(*) AS booked
        FROM appointments
        WHERE booking_date = ? AND time_slot = ? AND status = 'confirmed'
      `,
      [intent.booking_date, intent.time_slot]
    );

    if (Number(slotRows[0].booked || 0) >= maxBookingsPerSlot) {
      await connection.rollback();
      res.status(409).json({ message: 'Fascia oraria non piu disponibile.' });
      return;
    }

    const [insertResult] = await connection.query(
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
        VALUES (?, ?, ?, ?, ?, ?, 'confirmed')
      `,
      [
        intent.booking_date,
        intent.time_slot,
        intent.guests,
        intent.tour_id,
        paymentProvider,
        paymentReference || null,
      ]
    );

    await connection.query(
      `
        UPDATE booking_intents
        SET status = 'confirmed', payment_provider = ?, payment_reference = ?, confirmed_at = UTC_TIMESTAMP()
        WHERE id = ?
      `,
      [paymentProvider, paymentReference || null, intent.id]
    );

    await connection.commit();
    res.status(201).json({ bookingId: insertResult.insertId, message: 'Prenotazione confermata.' });
  } catch (error) {
    await connection.rollback();
    res.status(500).json({ message: 'Errore durante la conferma prenotazione.' });
  } finally {
    connection.release();
  }
});

app.listen(port, () => {
  console.log(`Booking API attiva su http://localhost:${port}`);
});

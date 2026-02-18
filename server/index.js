const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const crypto = require('crypto');
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
const tourPriceByIdCents = {
  'roma-mangia-prega-ama': 7900,
  'when-in-rome': 14900,
};
const tourPriceByIdJson = JSON.stringify(tourPriceByIdCents);
const tourLabelById = {
  'roma-mangia-prega-ama': 'Classic Rome Tour',
  'when-in-rome': 'When In Rome Tour',
};
const maxSafeIntegerBigInt = BigInt(Number.MAX_SAFE_INTEGER);
const adminEmail = String(process.env.ADMIN_EMAIL || '').trim().toLowerCase();
const adminPasswordHash = String(process.env.ADMIN_PASSWORD_HASH || '').trim();
const adminLegacyPassword = String(process.env.ADMIN_PASSWORD || '').trim();
const adminTokenTtlMinutes = Number(process.env.ADMIN_TOKEN_TTL_MINUTES || 480);
const adminLoginWindowMs = Math.max(60 * 1000, Number(process.env.ADMIN_LOGIN_WINDOW_SECONDS || 900) * 1000);
const adminLoginMaxAttemptsPerIp = Math.max(3, Number(process.env.ADMIN_LOGIN_MAX_ATTEMPTS_PER_IP || 25));
const adminLoginMaxAttemptsPerEmail = Math.max(3, Number(process.env.ADMIN_LOGIN_MAX_ATTEMPTS_PER_EMAIL || 8));
const adminLoginBaseLockMs = Math.max(30 * 1000, Number(process.env.ADMIN_LOGIN_LOCK_MINUTES || 30) * 60 * 1000);
const adminSessions = new Map();
const adminLoginAttemptsByIp = new Map();
const adminLoginAttemptsByEmail = new Map();

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

function resolveTourPriceCents(tourIdRaw) {
  const tourId = String(tourIdRaw || '').trim();
  const price = tourPriceByIdCents[tourId];
  return Number.isInteger(price) && price >= 0 ? price : null;
}

function centsToEur(cents) {
  return Number((cents / 100).toFixed(2));
}

function parseIntegerLikeToBigInt(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  if (typeof value === 'bigint') {
    return value;
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || !Number.isInteger(value)) {
      return null;
    }
    return BigInt(value);
  }
  const raw = String(value).trim();
  if (!/^-?\d+$/.test(raw)) {
    return null;
  }
  return BigInt(raw);
}

function bigIntToSafeNumber(value, fieldName) {
  if (value > maxSafeIntegerBigInt || value < -maxSafeIntegerBigInt) {
    throw new Error(`Overflow numerico su ${fieldName}.`);
  }
  return Number(value);
}

function resolveEffectiveAmountCents(row) {
  const guests = parseIntegerLikeToBigInt(row.guests);
  const safeGuests = guests !== null && guests > 0n ? guests : 0n;

  const totalPriceCents = parseIntegerLikeToBigInt(row.total_price_cents);
  if (totalPriceCents !== null && totalPriceCents >= 0n) {
    return totalPriceCents;
  }

  const unitPriceCents = parseIntegerLikeToBigInt(row.unit_price_cents);
  if (unitPriceCents !== null && unitPriceCents >= 0n) {
    return unitPriceCents * safeGuests;
  }

  const fallbackUnitPriceCents = resolveTourPriceCents(row.tour_id);
  if (Number.isInteger(fallbackUnitPriceCents) && fallbackUnitPriceCents >= 0) {
    return BigInt(fallbackUnitPriceCents) * safeGuests;
  }

  return 0n;
}

function buildEffectiveRevenueSql(alias, tourPriceMapPlaceholder) {
  return `
    CASE
      WHEN ${alias}.total_price_cents IS NOT NULL THEN ${alias}.total_price_cents::bigint
      WHEN ${alias}.unit_price_cents IS NOT NULL THEN ${alias}.unit_price_cents::bigint * ${alias}.guests::bigint
      ELSE COALESCE((${tourPriceMapPlaceholder}::jsonb ->> COALESCE(${alias}.tour_id, ''))::bigint, 0)::bigint * ${alias}.guests::bigint
    END
  `;
}

function resolveTourLabel(tourIdRaw) {
  const tourId = String(tourIdRaw || '').trim();
  if (!tourId) {
    return 'Tour non specificato';
  }
  if (tourLabelById[tourId]) {
    return tourLabelById[tourId];
  }
  return tourId
    .split('-')
    .filter(Boolean)
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
    .join(' ');
}

function createAdminSession(email) {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = Date.now() + adminTokenTtlMinutes * 60 * 1000;
  adminSessions.set(token, { email, expiresAt });
  return { token, email, expiresAt };
}

function getAdminSession(tokenRaw) {
  const token = String(tokenRaw || '').trim();
  if (!token) {
    return null;
  }
  const session = adminSessions.get(token);
  if (!session) {
    return null;
  }
  if (session.expiresAt <= Date.now()) {
    adminSessions.delete(token);
    return null;
  }
  return { token, ...session };
}

function purgeExpiredAdminSessions() {
  const now = Date.now();
  adminSessions.forEach((session, token) => {
    if (session.expiresAt <= now) {
      adminSessions.delete(token);
    }
  });
}

function safeTimingEqualText(left, right) {
  const leftBuffer = Buffer.from(String(left || ''));
  const rightBuffer = Buffer.from(String(right || ''));
  const maxLength = Math.max(leftBuffer.length, rightBuffer.length, 1);
  const paddedLeft = Buffer.alloc(maxLength);
  const paddedRight = Buffer.alloc(maxLength);
  leftBuffer.copy(paddedLeft);
  rightBuffer.copy(paddedRight);
  const equal = crypto.timingSafeEqual(paddedLeft, paddedRight);
  return equal && leftBuffer.length === rightBuffer.length;
}

function verifyScryptPassword(password, encodedHash) {
  try {
    const [algorithm, saltHex, hashHex] = String(encodedHash || '').split('$');
    if (algorithm !== 'scrypt' || !saltHex || !hashHex) {
      return false;
    }
    if (!/^[0-9a-f]+$/i.test(saltHex) || !/^[0-9a-f]+$/i.test(hashHex)) {
      return false;
    }
    if (saltHex.length % 2 !== 0 || hashHex.length % 2 !== 0) {
      return false;
    }
    const salt = Buffer.from(saltHex, 'hex');
    const expectedHash = Buffer.from(hashHex, 'hex');
    const derivedHash = crypto.scryptSync(String(password || ''), salt, expectedHash.length);
    return crypto.timingSafeEqual(derivedHash, expectedHash);
  } catch (error) {
    return false;
  }
}

function verifyAdminPassword(password) {
  if (adminPasswordHash) {
    return verifyScryptPassword(password, adminPasswordHash);
  }
  if (adminLegacyPassword) {
    return safeTimingEqualText(password, adminLegacyPassword);
  }
  return false;
}

function isAdminAuthConfigured() {
  return Boolean(adminEmail && (adminPasswordHash || adminLegacyPassword));
}

function getClientIp(req) {
  const forwarded = String(req.headers['x-forwarded-for'] || '').trim();
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  return String(req.ip || req.socket?.remoteAddress || 'unknown').trim();
}

function getOrCreateLoginAttemptBucket(store, key) {
  const normalizedKey = String(key || 'unknown').trim() || 'unknown';
  if (!store.has(normalizedKey)) {
    store.set(normalizedKey, {
      failures: [],
      lockUntil: 0,
      lockLevel: 0,
      lastSeenAt: Date.now(),
    });
  }
  return store.get(normalizedKey);
}

function pruneLoginAttemptBucket(bucket, now) {
  bucket.failures = bucket.failures.filter((at) => now - at <= adminLoginWindowMs);
  if (bucket.lockUntil && bucket.lockUntil <= now) {
    bucket.lockUntil = 0;
    bucket.lockLevel = 0;
  }
  bucket.lastSeenAt = now;
}

function getBucketRemainingLockMs(bucket, now) {
  pruneLoginAttemptBucket(bucket, now);
  return Math.max(0, Number(bucket.lockUntil || 0) - now);
}

function registerLoginFailure(bucket, maxAttempts, now) {
  pruneLoginAttemptBucket(bucket, now);
  bucket.failures.push(now);
  if (bucket.failures.length >= maxAttempts) {
    bucket.lockLevel = Math.min(bucket.lockLevel + 1, 6);
    const multiplier = 2 ** (bucket.lockLevel - 1);
    bucket.lockUntil = now + adminLoginBaseLockMs * multiplier;
    bucket.failures = [];
  }
  bucket.lastSeenAt = now;
}

function clearLoginFailures(bucket) {
  bucket.failures = [];
  bucket.lockUntil = 0;
  bucket.lockLevel = 0;
  bucket.lastSeenAt = Date.now();
}

function cleanupLoginAttemptStore(store) {
  const now = Date.now();
  const retentionMs = Math.max(adminLoginWindowMs * 6, adminLoginBaseLockMs * 2);
  store.forEach((bucket, key) => {
    pruneLoginAttemptBucket(bucket, now);
    const idleMs = now - Number(bucket.lastSeenAt || now);
    const isActive = bucket.failures.length > 0 || Number(bucket.lockUntil || 0) > now;
    if (!isActive && idleMs > retentionMs) {
      store.delete(key);
    }
  });
}

function cleanupAdminSecurityState() {
  purgeExpiredAdminSessions();
  cleanupLoginAttemptStore(adminLoginAttemptsByIp);
  cleanupLoginAttemptStore(adminLoginAttemptsByEmail);
}

function readAdminBearerToken(req) {
  const header = String(req.headers.authorization || '');
  if (!header.toLowerCase().startsWith('bearer ')) {
    return '';
  }
  return header.slice(7).trim();
}

function requireAdminAuth(req, res, next) {
  const token = readAdminBearerToken(req);
  const session = getAdminSession(token);
  if (!session) {
    res.status(401).json({ message: 'Sessione admin non valida o scaduta.' });
    return;
  }
  req.adminSession = session;
  next();
}

const adminSessionGcInterval = setInterval(cleanupAdminSecurityState, 5 * 60 * 1000);
adminSessionGcInterval.unref();

function sanitizeCustomerField(value, maxLength) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, maxLength);
}

function isValidCustomerEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidCustomerPhone(phone) {
  return /^[0-9+\s().-]{6,25}$/.test(phone);
}

async function ensureCustomerColumns() {
  await pool.query(
    `
      ALTER TABLE IF EXISTS booking_intents
      ADD COLUMN IF NOT EXISTS customer_first_name VARCHAR(80),
      ADD COLUMN IF NOT EXISTS customer_last_name VARCHAR(80),
      ADD COLUMN IF NOT EXISTS customer_phone VARCHAR(40),
      ADD COLUMN IF NOT EXISTS customer_email VARCHAR(160)
    `
  );

  await pool.query(
    `
      ALTER TABLE IF EXISTS appointments
      ADD COLUMN IF NOT EXISTS customer_first_name VARCHAR(80),
      ADD COLUMN IF NOT EXISTS customer_last_name VARCHAR(80),
      ADD COLUMN IF NOT EXISTS customer_phone VARCHAR(40),
      ADD COLUMN IF NOT EXISTS customer_email VARCHAR(160)
    `
  );
}

async function ensurePricingColumns() {
  await pool.query(
    `
      ALTER TABLE IF EXISTS booking_intents
      ADD COLUMN IF NOT EXISTS unit_price_cents INTEGER,
      ADD COLUMN IF NOT EXISTS total_price_cents INTEGER
    `
  );

  await pool.query(
    `
      ALTER TABLE IF EXISTS appointments
      ADD COLUMN IF NOT EXISTS unit_price_cents INTEGER,
      ADD COLUMN IF NOT EXISTS total_price_cents INTEGER
    `
  );
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

app.post('/api/admin/login', (req, res) => {
  if (!isAdminAuthConfigured()) {
    res.status(503).json({ message: 'Autenticazione admin non configurata.' });
    return;
  }

  const email = sanitizeCustomerField(req.body?.email, 160).toLowerCase();
  const password = String(req.body?.password || '');
  const now = Date.now();

  const ipKey = getClientIp(req);
  const emailKey = email || '__missing__';
  const ipBucket = getOrCreateLoginAttemptBucket(adminLoginAttemptsByIp, ipKey);
  const emailBucket = getOrCreateLoginAttemptBucket(adminLoginAttemptsByEmail, emailKey);

  const lockRemainingMs = Math.max(
    getBucketRemainingLockMs(ipBucket, now),
    getBucketRemainingLockMs(emailBucket, now)
  );
  if (lockRemainingMs > 0) {
    const retryAfterSeconds = Math.ceil(lockRemainingMs / 1000);
    res.set('Retry-After', String(retryAfterSeconds));
    res.status(429).json({
      message: `Troppi tentativi di accesso. Riprova tra ${retryAfterSeconds} secondi.`,
    });
    return;
  }

  if (!email || !password) {
    registerLoginFailure(ipBucket, adminLoginMaxAttemptsPerIp, now);
    registerLoginFailure(emailBucket, adminLoginMaxAttemptsPerEmail, now);
    res.status(400).json({ message: 'Email e password sono obbligatori.' });
    return;
  }

  const validCredentials = safeTimingEqualText(email, adminEmail) && verifyAdminPassword(password);
  if (!validCredentials) {
    registerLoginFailure(ipBucket, adminLoginMaxAttemptsPerIp, now);
    registerLoginFailure(emailBucket, adminLoginMaxAttemptsPerEmail, now);

    const lockAfterFailureMs = Math.max(
      getBucketRemainingLockMs(ipBucket, now),
      getBucketRemainingLockMs(emailBucket, now)
    );
    if (lockAfterFailureMs > 0) {
      res.set('Retry-After', String(Math.ceil(lockAfterFailureMs / 1000)));
    }

    res.status(401).json({ message: 'Credenziali non valide.' });
    return;
  }

  clearLoginFailures(ipBucket);
  clearLoginFailures(emailBucket);

  const session = createAdminSession(adminEmail);
  res.json({
    token: session.token,
    email: session.email,
    expiresAt: new Date(session.expiresAt).toISOString(),
  });
});

app.get('/api/admin/me', requireAdminAuth, (req, res) => {
  res.json({
    email: req.adminSession.email,
    expiresAt: new Date(req.adminSession.expiresAt).toISOString(),
  });
});

app.post('/api/admin/logout', requireAdminAuth, (req, res) => {
  adminSessions.delete(req.adminSession.token);
  res.json({ ok: true });
});

app.get('/api/admin/appointments', requireAdminAuth, async (req, res) => {
  const pageRaw = Number(req.query.page || 1);
  const pageSizeRaw = Number(req.query.pageSize || 8);
  const page = Number.isInteger(pageRaw) && pageRaw > 0 ? pageRaw : 1;
  const pageSize = Number.isInteger(pageSizeRaw)
    ? Math.min(Math.max(pageSizeRaw, 1), 50)
    : 8;
  const offset = (page - 1) * pageSize;
  const search = sanitizeCustomerField(req.query.search, 120);

  const filters = [];
  const params = [];
  if (search) {
    params.push(`%${search}%`);
    const searchPlaceholder = `$${params.length}`;
    filters.push(`
      (
        CONCAT_WS(' ', customer_first_name, customer_last_name) ILIKE ${searchPlaceholder}
        OR COALESCE(tour_id, '') ILIKE ${searchPlaceholder}
        OR id::text ILIKE ${searchPlaceholder}
      )
    `);
  }
  const whereClause = filters.length ? `WHERE ${filters.join(' AND ')}` : '';

  try {
    const countResult = await pool.query(
      `SELECT COUNT(*)::int AS total FROM appointments ${whereClause}`,
      params
    );

    const rowsParams = [...params, pageSize, offset];
    const rowsResult = await pool.query(
      `
        SELECT
          id,
          ('BK-' || LPAD(id::text, 3, '0')) AS booking_code,
          booking_date::text AS booking_date,
          time_slot,
          guests,
          tour_id,
          customer_first_name,
          customer_last_name,
          customer_phone,
          customer_email,
          status,
          payment_provider,
          payment_reference,
          unit_price_cents,
          total_price_cents,
          created_at,
          CASE
            WHEN status = 'cancelled' THEN 'refunded'
            WHEN COALESCE(payment_reference, '') = '' THEN 'pending'
            ELSE 'paid'
          END AS payment_status
        FROM appointments
        ${whereClause}
        ORDER BY booking_date DESC, created_at DESC
        LIMIT $${rowsParams.length - 1}
        OFFSET $${rowsParams.length}
      `,
      rowsParams
    );

    const rows = rowsResult.rows.map((row) => {
      const amountCentsBigInt = resolveEffectiveAmountCents(row);
      const amountCents = bigIntToSafeNumber(amountCentsBigInt, 'appointments.amountCents');
      return {
        id: Number(row.id),
        bookingCode: row.booking_code,
        customerName: `${sanitizeCustomerField(row.customer_first_name, 80)} ${sanitizeCustomerField(row.customer_last_name, 80)}`.trim() || 'N/D',
        customerPhone: sanitizeCustomerField(row.customer_phone, 40),
        customerEmail: sanitizeCustomerField(row.customer_email, 160).toLowerCase(),
        tourType: resolveTourLabel(row.tour_id),
        date: row.booking_date,
        time: row.time_slot,
        guests: Number(row.guests || 0),
        status: row.status,
        paymentStatus: row.payment_status,
        paymentProvider: row.payment_provider || '',
        amountCents,
        amountEur: centsToEur(amountCents),
        createdAt: row.created_at,
      };
    });

    res.json({
      page,
      pageSize,
      total: Number(countResult.rows[0].total || 0),
      rows,
    });
  } catch (error) {
    res.status(500).json({ message: 'Errore nel caricamento appuntamenti admin.' });
  }
});

app.delete('/api/admin/appointments/:id', requireAdminAuth, async (req, res) => {
  const idRaw = Number(req.params.id);
  const id = Number.isInteger(idRaw) && idRaw > 0 ? idRaw : 0;
  if (!id) {
    res.status(400).json({ message: 'ID prenotazione non valido.' });
    return;
  }

  try {
    const result = await pool.query(
      `
        DELETE FROM appointments
        WHERE id = $1
        RETURNING id
      `,
      [id]
    );

    if (!result.rows.length) {
      res.status(404).json({ message: 'Prenotazione non trovata.' });
      return;
    }

    res.json({
      ok: true,
      deletedId: Number(result.rows[0].id),
    });
  } catch (error) {
    res.status(500).json({ message: 'Errore durante l\'eliminazione della prenotazione.' });
  }
});

app.get('/api/admin/dashboard', requireAdminAuth, async (req, res) => {
  const monthQuery = sanitizeCustomerField(req.query.month, 7);
  const defaultMonth = new Date().toISOString().slice(0, 7);
  const monthKey = isValidMonthKey(monthQuery) ? monthQuery : defaultMonth;
  const { from, to, yearRaw, monthRaw } = getMonthBounds(monthKey);
  const effectiveRevenueSql = buildEffectiveRevenueSql('a', '$1');

  try {
    const statsResult = await pool.query(
      `
        SELECT
          (SELECT COUNT(*)::int FROM appointments WHERE status = 'confirmed') AS total_appointments,
          (SELECT COUNT(*)::int FROM appointments WHERE booking_date = CURRENT_DATE AND status = 'confirmed') AS todays_bookings,
          (
            SELECT COALESCE(SUM(${effectiveRevenueSql}), 0)::bigint
            FROM appointments a
            WHERE a.status = 'confirmed'
              AND booking_date >= DATE_TRUNC('month', CURRENT_DATE)::date
              AND booking_date < (DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month')::date
          ) AS revenue_monthly_cents,
          (
            SELECT COALESCE(SUM(${effectiveRevenueSql}), 0)::bigint
            FROM appointments a
            WHERE a.status = 'confirmed'
              AND booking_date >= (DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '1 month')::date
              AND booking_date < DATE_TRUNC('month', CURRENT_DATE)::date
          ) AS revenue_previous_month_cents,
          (
            SELECT COUNT(DISTINCT tour_id)::int
            FROM appointments
            WHERE status = 'confirmed'
              AND tour_id IS NOT NULL
              AND tour_id <> ''
          ) AS active_tours
      `,
      [tourPriceByIdJson]
    );

    const revenueSeriesResult = await pool.query(
      `
        SELECT
          month_index,
          COALESCE(SUM(${effectiveRevenueSql}), 0)::bigint AS revenue_cents
        FROM GENERATE_SERIES(1, 12) AS months(month_index)
        LEFT JOIN appointments a
          ON EXTRACT(MONTH FROM a.booking_date) = months.month_index
         AND EXTRACT(YEAR FROM a.booking_date) = EXTRACT(YEAR FROM CURRENT_DATE)
         AND a.status = 'confirmed'
        GROUP BY month_index
        ORDER BY month_index
      `,
      [tourPriceByIdJson]
    );

    const calendarResult = await pool.query(
      `
        SELECT booking_date::text AS day_key, COUNT(*)::int AS total
        FROM (
          SELECT booking_date
          FROM appointments
          WHERE booking_date >= $1::date
            AND booking_date < $2::date
            AND status = 'confirmed'

          UNION ALL

          SELECT booking_date
          FROM booking_intents
          WHERE booking_date >= $1::date
            AND booking_date < $2::date
            AND status = 'pending'
            AND expires_at > NOW()
        ) AS calendar_rows
        GROUP BY booking_date
        ORDER BY booking_date
      `,
      [from, to]
    );

    const activityResult = await pool.query(
      `
        SELECT
          id,
          guests,
          tour_id,
          unit_price_cents,
          total_price_cents,
          customer_first_name,
          customer_last_name,
          status,
          payment_reference,
          created_at
        FROM appointments
        ORDER BY created_at DESC
        LIMIT 8
      `
    );

    const statsRow = statsResult.rows[0] || {};
    const revenueMonthlyCentsBigInt = parseIntegerLikeToBigInt(statsRow.revenue_monthly_cents) || 0n;
    const revenuePreviousMonthCentsBigInt = parseIntegerLikeToBigInt(statsRow.revenue_previous_month_cents) || 0n;
    const revenueMonthlyCents = bigIntToSafeNumber(revenueMonthlyCentsBigInt, 'dashboard.revenueMonthlyCents');
    const revenuePreviousMonthCents = bigIntToSafeNumber(revenuePreviousMonthCentsBigInt, 'dashboard.revenuePreviousMonthCents');
    const revenueGrowthPercent = revenuePreviousMonthCents > 0
      ? Number((((revenueMonthlyCents - revenuePreviousMonthCents) / revenuePreviousMonthCents) * 100).toFixed(1))
      : (revenueMonthlyCents > 0 ? 100 : 0);

    const revenueSeries = revenueSeriesResult.rows.map((row) => {
      const revenueCentsBigInt = parseIntegerLikeToBigInt(row.revenue_cents) || 0n;
      const revenueCents = bigIntToSafeNumber(revenueCentsBigInt, 'dashboard.revenueSeries.revenueCents');
      return {
        month: Number(row.month_index),
        revenueCents,
        revenueEur: centsToEur(revenueCents),
      };
    });

    const bookedDays = calendarResult.rows.map((row) => ({
      day: row.day_key,
      total: Number(row.total || 0),
    }));

    const recentActivity = activityResult.rows.map((row) => {
      const fullName = `${sanitizeCustomerField(row.customer_first_name, 80)} ${sanitizeCustomerField(row.customer_last_name, 80)}`.trim() || 'Cliente';
      const amountCentsBigInt = resolveEffectiveAmountCents(row);
      const amountCents = bigIntToSafeNumber(amountCentsBigInt, 'dashboard.recentActivity.amountCents');
      const amountEur = centsToEur(amountCents);
      if (row.status === 'cancelled') {
        return {
          type: 'cancelled',
          message: `Prenotazione annullata da ${fullName}`,
          at: row.created_at,
        };
      }
      if (row.payment_reference) {
        return {
          type: 'payment',
          message: `Pagamento ricevuto - EUR ${amountEur} da ${fullName}`,
          at: row.created_at,
        };
      }
      return {
        type: 'booking',
        message: `Nuova prenotazione da ${fullName}`,
        at: row.created_at,
      };
    });

    res.json({
      month: monthKey,
      stats: {
        totalAppointments: Number(statsRow.total_appointments || 0),
        todaysBookings: Number(statsRow.todays_bookings || 0),
        revenueMonthlyCents,
        revenueMonthlyEur: centsToEur(revenueMonthlyCents),
        revenueGrowthPercent,
        activeTours: Number(statsRow.active_tours || 0),
      },
      revenueSeries,
      calendar: {
        year: Number(yearRaw),
        month: Number(monthRaw),
        bookedDays,
      },
      recentActivity,
    });
  } catch (error) {
    res.status(500).json({ message: 'Errore nel caricamento dashboard admin.' });
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
  const {
    date,
    timeSlot,
    guests,
    tourId,
    firstName,
    lastName,
    phone,
    email,
  } = req.body || {};

  const customerFirstName = sanitizeCustomerField(firstName, 80);
  const customerLastName = sanitizeCustomerField(lastName, 80);
  const customerPhone = sanitizeCustomerField(phone, 40);
  const customerEmail = sanitizeCustomerField(email, 160).toLowerCase();
  const normalizedTourId = sanitizeCustomerField(tourId, 40);

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
  if (!normalizedTourId) {
    res.status(400).json({ message: 'Tour non valido.' });
    return;
  }
  const unitPriceCents = resolveTourPriceCents(normalizedTourId);
  if (unitPriceCents === null) {
    res.status(400).json({ message: 'Prezzo tour non configurato.' });
    return;
  }
  const totalPriceCents = unitPriceCents * guestsNumber;
  if (customerFirstName.length < 2 || customerLastName.length < 2) {
    res.status(400).json({ message: 'Nome o cognome non valido.' });
    return;
  }
  if (!isValidCustomerPhone(customerPhone)) {
    res.status(400).json({ message: 'Numero di cellulare non valido.' });
    return;
  }
  if (!isValidCustomerEmail(customerEmail)) {
    res.status(400).json({ message: 'Email non valida.' });
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
        INSERT INTO booking_intents (
          booking_date,
          time_slot,
          guests,
          tour_id,
          unit_price_cents,
          total_price_cents,
          customer_first_name,
          customer_last_name,
          customer_phone,
          customer_email,
          status,
          expires_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'pending', NOW() + ($11::text || ' minutes')::interval)
        RETURNING id, expires_at
      `,
      [
        date,
        timeSlot,
        guestsNumber,
        normalizedTourId,
        unitPriceCents,
        totalPriceCents,
        customerFirstName,
        customerLastName,
        customerPhone,
        customerEmail,
        pendingIntentMinutes,
      ]
    );

    const intentId = insertResult.rows[0].id;
    const expiresAt = insertResult.rows[0].expires_at;

    res.status(201).json({
      intentId,
      expiresAt,
      guests: guestsNumber,
      unitPriceCents,
      totalPriceCents,
      totalPriceEur: centsToEur(totalPriceCents),
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
        SELECT
          id,
          booking_date,
          time_slot,
          guests,
          tour_id,
          unit_price_cents,
          total_price_cents,
          customer_first_name,
          customer_last_name,
          customer_phone,
          customer_email,
          status,
          expires_at
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

    let unitPriceCents = Number(intent.unit_price_cents);
    if (!Number.isInteger(unitPriceCents) || unitPriceCents < 0) {
      const resolvedUnitPrice = resolveTourPriceCents(intent.tour_id);
      if (resolvedUnitPrice === null) {
        await connection.query('ROLLBACK');
        res.status(409).json({ message: 'Prezzo tour non disponibile per la conferma.' });
        return;
      }
      unitPriceCents = resolvedUnitPrice;
    }
    const guestsNumber = Number(intent.guests || 0);
    let totalPriceCents = Number(intent.total_price_cents);
    if (!Number.isInteger(totalPriceCents) || totalPriceCents < 0) {
      totalPriceCents = unitPriceCents * guestsNumber;
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
          unit_price_cents,
          total_price_cents,
          customer_first_name,
          customer_last_name,
          customer_phone,
          customer_email,
          payment_provider,
          payment_reference,
          status
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'confirmed')
        RETURNING id
      `,
      [
        intent.booking_date,
        intent.time_slot,
        guestsNumber,
        intent.tour_id,
        unitPriceCents,
        totalPriceCents,
        intent.customer_first_name,
        intent.customer_last_name,
        intent.customer_phone,
        intent.customer_email,
        normalizedPaymentProvider,
        normalizedPaymentReference || null,
      ]
    );

    await connection.query(
      `
        UPDATE booking_intents
        SET
          status = 'confirmed',
          unit_price_cents = $1,
          total_price_cents = $2,
          payment_provider = $3,
          payment_reference = $4,
          confirmed_at = NOW()
        WHERE id = $5
      `,
      [
        unitPriceCents,
        totalPriceCents,
        normalizedPaymentProvider,
        normalizedPaymentReference || null,
        intent.id,
      ]
    );

    await connection.query('COMMIT');
    res.status(201).json({
      bookingId: insertResult.rows[0].id,
      guests: guestsNumber,
      totalPriceCents,
      totalPriceEur: centsToEur(totalPriceCents),
      message: 'Prenotazione confermata.',
    });
  } catch (error) {
    await connection.query('ROLLBACK');
    res.status(500).json({ message: 'Errore durante la conferma prenotazione.' });
  } finally {
    connection.release();
  }
});

async function startServer() {
  try {
    if (!isAdminAuthConfigured()) {
      throw new Error('Config admin mancante: imposta ADMIN_EMAIL e ADMIN_PASSWORD_HASH.');
    }
    if (adminLegacyPassword && !adminPasswordHash) {
      console.warn('Admin auth: stai usando ADMIN_PASSWORD in chiaro. Usa ADMIN_PASSWORD_HASH.');
    }

    await ensureCustomerColumns();
    await ensurePricingColumns();
    app.listen(port, () => {
      console.log(`Booking API attiva su http://localhost:${port}`);
    });
  } catch (error) {
    console.error('Impossibile avviare Booking API:', error.message);
    process.exit(1);
  }
}

startServer();

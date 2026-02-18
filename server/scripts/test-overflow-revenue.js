const { Pool } = require('pg');
const dotenv = require('dotenv');

dotenv.config();

const tourPriceByIdCents = {
  'roma-mangia-prega-ama': 7900,
  'when-in-rome': 14900,
};
const tourPriceByIdJson = JSON.stringify(tourPriceByIdCents);
const maxSafeIntegerBigInt = BigInt(Number.MAX_SAFE_INTEGER);
const apiBaseUrl = `http://localhost:${Number(process.env.PORT || 4000)}/api`;

function parseIntegerLikeToBigInt(value) {
  if (value === null || value === undefined || value === '') {
    return 0n;
  }
  if (typeof value === 'bigint') {
    return value;
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || !Number.isInteger(value)) {
      return 0n;
    }
    return BigInt(value);
  }
  const raw = String(value).trim();
  if (!/^-?\d+$/.test(raw)) {
    return 0n;
  }
  return BigInt(raw);
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

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, options);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`${url} -> HTTP ${response.status} (${payload.message || 'unknown error'})`);
  }
  return payload;
}

async function run() {
  const adminLoginEmail = String(process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const adminLoginPassword = String(process.env.ADMIN_LOGIN_PASSWORD || '').trim();
  if (!adminLoginEmail || !adminLoginPassword) {
    throw new Error('Imposta ADMIN_EMAIL e ADMIN_LOGIN_PASSWORD per eseguire il test API admin.');
  }

  const pool = new Pool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 5432),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  try {
    await pool.query('SELECT 1');

    const effectiveRevenueSql = buildEffectiveRevenueSql('a', '$1');

    const overflowSummaryResult = await pool.query(
      `
        WITH revenue_rows AS (
          SELECT ${effectiveRevenueSql} AS effective_cents
          FROM appointments a
          WHERE a.status = 'confirmed'
        )
        SELECT
          COUNT(*)::int AS total_rows,
          COALESCE(SUM(effective_cents), 0)::bigint AS total_cents,
          COALESCE(MAX(effective_cents), 0)::bigint AS max_row_cents,
          COALESCE(MIN(effective_cents), 0)::bigint AS min_row_cents
        FROM revenue_rows
      `,
      [tourPriceByIdJson]
    );

    const overflowRow = overflowSummaryResult.rows[0] || {};
    const totalCents = parseIntegerLikeToBigInt(overflowRow.total_cents);
    const maxRowCents = parseIntegerLikeToBigInt(overflowRow.max_row_cents);
    const minRowCents = parseIntegerLikeToBigInt(overflowRow.min_row_cents);

    assert(totalCents <= maxSafeIntegerBigInt && totalCents >= -maxSafeIntegerBigInt,
      'Overflow rischio: SUM(revenue) supera Number.MAX_SAFE_INTEGER');
    assert(maxRowCents <= maxSafeIntegerBigInt && maxRowCents >= -maxSafeIntegerBigInt,
      'Overflow rischio: revenue record singolo supera Number.MAX_SAFE_INTEGER');
    assert(minRowCents <= maxSafeIntegerBigInt && minRowCents >= -maxSafeIntegerBigInt,
      'Overflow rischio: revenue record singolo (negativo) supera Number.MAX_SAFE_INTEGER');

    const monthlyStatsResult = await pool.query(
      `
        SELECT
          (
            SELECT COALESCE(SUM(${effectiveRevenueSql}), 0)::bigint
            FROM appointments a
            WHERE a.status = 'confirmed'
              AND a.booking_date >= DATE_TRUNC('month', CURRENT_DATE)::date
              AND a.booking_date < (DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month')::date
          ) AS current_month_cents,
          (
            SELECT COALESCE(SUM(${effectiveRevenueSql}), 0)::bigint
            FROM appointments a
            WHERE a.status = 'confirmed'
              AND a.booking_date >= (DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '1 month')::date
              AND a.booking_date < DATE_TRUNC('month', CURRENT_DATE)::date
          ) AS previous_month_cents
      `,
      [tourPriceByIdJson]
    );
    const monthlyStats = monthlyStatsResult.rows[0] || {};
    const dbCurrentMonthCents = parseIntegerLikeToBigInt(monthlyStats.current_month_cents);
    const dbPreviousMonthCents = parseIntegerLikeToBigInt(monthlyStats.previous_month_cents);

    const yearlySeriesResult = await pool.query(
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

    const loginPayload = await requestJson(`${apiBaseUrl}/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: adminLoginEmail,
        password: adminLoginPassword,
      }),
    });

    const dashboardPayload = await requestJson(`${apiBaseUrl}/admin/dashboard`, {
      headers: {
        Authorization: `Bearer ${loginPayload.token}`,
      },
    });

    const apiCurrentMonthCents = parseIntegerLikeToBigInt(dashboardPayload?.stats?.revenueMonthlyCents);
    assert(apiCurrentMonthCents === dbCurrentMonthCents,
      `Mismatch revenue month: API=${apiCurrentMonthCents} DB=${dbCurrentMonthCents}`);

    const dbSeriesByMonth = new Map(
      yearlySeriesResult.rows.map((row) => [
        Number(row.month_index),
        parseIntegerLikeToBigInt(row.revenue_cents),
      ])
    );

    const apiSeries = Array.isArray(dashboardPayload.revenueSeries) ? dashboardPayload.revenueSeries : [];
    assert(apiSeries.length === 12, `Serie revenue API non completa: attese 12 voci, trovate ${apiSeries.length}`);

    apiSeries.forEach((row) => {
      const month = Number(row.month);
      const apiValue = parseIntegerLikeToBigInt(row.revenueCents);
      const dbValue = dbSeriesByMonth.get(month) || 0n;
      assert(apiValue === dbValue, `Mismatch revenue series mese ${month}: API=${apiValue} DB=${dbValue}`);
    });

    console.log(JSON.stringify({
      ok: true,
      db: {
        totalRows: Number(overflowRow.total_rows || 0),
        totalCents: totalCents.toString(),
        maxRowCents: maxRowCents.toString(),
        minRowCents: minRowCents.toString(),
        currentMonthCents: dbCurrentMonthCents.toString(),
        previousMonthCents: dbPreviousMonthCents.toString(),
      },
      api: {
        currentMonthCents: apiCurrentMonthCents.toString(),
        seriesCount: apiSeries.length,
      },
      overflowGuard: {
        numberMaxSafeInteger: Number.MAX_SAFE_INTEGER,
        checked: true,
      },
    }));
  } finally {
    await pool.end();
  }
}

run().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});

import React, { useEffect, useMemo, useState } from 'react';
import {
  BarChart3,
  CalendarDays,
  CreditCard,
  LayoutDashboard,
  MapPinned,
  Settings,
  TrendingUp,
  Users,
  DollarSign,
  BellRing,
  CircleDollarSign,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import Sidebar from './components/Sidebar';
import Topbar from './components/Topbar';
import StatCard from './components/StatCard';
import AppointmentsTable from './components/AppointmentsTable';
import { deleteAdminAppointment, fetchAdminAppointments, fetchAdminDashboard } from './api';
import { useAdminAuth } from './AdminApp';

const pageSize = 8;
const monthLabels = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];
const weekdays = ['Lu', 'Ma', 'Me', 'Gi', 'Ve', 'Sa', 'Do'];

function toMonthKey(dateValue) {
  const year = dateValue.getFullYear();
  const month = String(dateValue.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

function shiftMonth(monthKey, offset) {
  const [yearRaw, monthRaw] = monthKey.split('-').map(Number);
  const date = new Date(yearRaw, monthRaw - 1 + offset, 1);
  return toMonthKey(date);
}

function formatCurrency(value) {
  return new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(value || 0);
}

function getRelativeTime(dateValue) {
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) {
    return 'ora';
  }
  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.max(1, Math.floor(diffMs / 60000));
  if (diffMinutes < 60) {
    return `${diffMinutes} min fa`;
  }
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours} ora${diffHours > 1 ? 'e' : ''} fa`;
  }
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} giorn${diffDays > 1 ? 'i' : 'o'} fa`;
}

function buildChartPaths(values, width, height, padding, domainMax = null) {
  const maxValue = Math.max(domainMax || 0, ...values, 1);
  const xStep = (width - padding * 2) / Math.max(values.length - 1, 1);
  const points = values.map((value, index) => {
    const x = padding + index * xStep;
    const y = height - padding - (value / maxValue) * (height - padding * 2);
    return { x, y };
  });

  const linePath = points
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
    .join(' ');

  const first = points[0] || { x: padding, y: height - padding };
  const last = points[points.length - 1] || first;
  const areaPath = `${linePath} L ${last.x.toFixed(2)} ${(height - padding).toFixed(2)} L ${first.x.toFixed(2)} ${(height - padding).toFixed(2)} Z`;

  return {
    linePath,
    areaPath,
    points,
    maxValue,
  };
}

function RevenueChart({ values }) {
  const width = 900;
  const height = 320;
  const padding = 36;
  const maxDataValue = useMemo(() => Math.max(...values, 0), [values]);

  const yTicks = useMemo(() => {
    if (maxDataValue <= 0) {
      return [0];
    }

    const targetSteps = 4;
    const rawStep = maxDataValue / targetSteps;
    const magnitude = 10 ** Math.floor(Math.log10(rawStep));
    const normalized = rawStep / magnitude;

    let niceNormalizedStep = 1;
    if (normalized <= 1) {
      niceNormalizedStep = 1;
    } else if (normalized <= 2) {
      niceNormalizedStep = 2;
    } else if (normalized <= 2.5) {
      niceNormalizedStep = 2.5;
    } else if (normalized <= 5) {
      niceNormalizedStep = 5;
    } else {
      niceNormalizedStep = 10;
    }

    const step = niceNormalizedStep * magnitude;
    const niceMax = Math.max(step, Math.ceil(maxDataValue / step) * step);
    const ticks = [];

    for (let value = niceMax; value >= 0; value -= step) {
      ticks.push(Number(value.toFixed(2)));
    }

    return ticks;
  }, [maxDataValue]);

  const yDomainMax = Math.max(yTicks[0] || 0, 1);
  const { linePath, areaPath } = useMemo(
    () => buildChartPaths(values, width, height, padding, yDomainMax),
    [values, yDomainMax]
  );

  const formatYAxisLabel = (value) => {
    if (value >= 1000) {
      const compact = value >= 10000 ? Math.round(value / 1000) : Number((value / 1000).toFixed(1));
      return `EUR ${compact}k`;
    }
    return `EUR ${Math.round(value)}`;
  };

  return (
    <div className="admin-revenue-chart-wrap">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Grafico ricavi" className="admin-revenue-chart">
        {yTicks.map((value) => {
          const y = height - padding - (value / yDomainMax) * (height - padding * 2);
          return (
            <g key={value}>
              <line x1={padding} y1={y} x2={width - padding} y2={y} className="admin-chart-grid-line" />
              <text x={padding - 10} y={y + 4} className="admin-chart-y-label">{formatYAxisLabel(value)}</text>
            </g>
          );
        })}

        <path d={areaPath} className="admin-chart-area" />
        <path d={linePath} className="admin-chart-line" />

        {monthLabels.map((label, index) => {
          const x = padding + (index * (width - padding * 2)) / 11;
          return (
            <text key={label} x={x} y={height - 10} className="admin-chart-x-label">{label}</text>
          );
        })}
      </svg>
    </div>
  );
}

function MiniCalendar({ monthKey, bookedDays, onPrev, onNext }) {
  const [yearRaw, monthRaw] = monthKey.split('-').map(Number);
  const monthDate = new Date(yearRaw, monthRaw - 1, 1);
  const monthTitle = monthDate.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' });
  const daysInMonth = new Date(yearRaw, monthRaw, 0).getDate();
  const startOffset = (monthDate.getDay() + 6) % 7;
  const todayKey = new Date().toISOString().slice(0, 10);
  const bookedMap = useMemo(() => {
    const map = new Map();
    bookedDays.forEach((day) => {
      map.set(day.day, day.total);
    });
    return map;
  }, [bookedDays]);

  const [selectedDay, setSelectedDay] = useState(() => todayKey.slice(0, 7) === monthKey ? todayKey : '');

  useEffect(() => {
    if (todayKey.slice(0, 7) === monthKey) {
      setSelectedDay(todayKey);
      return;
    }
    const firstBooked = bookedDays[0]?.day || '';
    setSelectedDay(firstBooked);
  }, [bookedDays, monthKey, todayKey]);

  const cells = [];
  for (let index = 0; index < startOffset; index += 1) {
    cells.push({ key: `empty-${index}`, empty: true });
  }
  for (let day = 1; day <= daysInMonth; day += 1) {
    const dayKey = `${yearRaw}-${String(monthRaw).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    cells.push({
      key: dayKey,
      day,
      dayKey,
      booked: bookedMap.get(dayKey) || 0,
      isToday: dayKey === todayKey,
      isSelected: dayKey === selectedDay,
    });
  }

  return (
    <section className="admin-panel admin-calendar-panel">
      <div className="admin-calendar-head">
        <h3>Calendario</h3>
        <div className="admin-calendar-nav">
          <button type="button" onClick={onPrev} aria-label="Mese precedente">&lt;</button>
          <strong>{monthTitle}</strong>
          <button type="button" onClick={onNext} aria-label="Mese successivo">&gt;</button>
        </div>
      </div>

      <div className="admin-calendar-weekdays">
        {weekdays.map((weekday) => <span key={weekday}>{weekday}</span>)}
      </div>

      <div className="admin-calendar-grid">
        {cells.map((cell) => {
          if (cell.empty) {
            return <span key={cell.key} className="admin-calendar-empty" aria-hidden="true" />;
          }

          return (
            <button
              key={cell.key}
              type="button"
              className={`admin-calendar-day ${cell.isSelected ? 'selected' : ''} ${cell.booked ? 'booked' : ''}`}
              onClick={() => setSelectedDay(cell.dayKey)}
            >
              <span>{cell.day}</span>
              {cell.booked ? <i aria-hidden="true" /> : null}
            </button>
          );
        })}
      </div>

      <div className="admin-calendar-legend">
        <span><i className="today" />Prenotato</span>
      </div>
    </section>
  );
}

function RecentActivity({ rows }) {
  const iconByType = {
    booking: <CheckCircle2 size={17} />,
    payment: <CircleDollarSign size={17} />,
    cancelled: <XCircle size={17} />,
  };

  return (
    <section className="admin-panel admin-activity-panel">
      <div className="admin-activity-head">
        <h3>Attività <span className="admin-gradient-word">Recente</span></h3>
        <button type="button">Vedi tutto</button>
      </div>

      <ul className="admin-activity-list">
        {rows.length ? rows.map((item, index) => (
          <li key={`${item.message}-${index}`}>
            <span className={`admin-activity-icon ${item.type}`}>{iconByType[item.type] || <BellRing size={16} />}</span>
            <div>
              <strong>{item.message}</strong>
              <small>{getRelativeTime(item.at)}</small>
            </div>
          </li>
        )) : <li className="admin-activity-empty">Nessuna attivita recente.</li>}
      </ul>
    </section>
  );
}

export default function Dashboard() {
  const { session, logout } = useAdminAuth();
  const [activeItem, setActiveItem] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [monthKey, setMonthKey] = useState(() => toMonthKey(new Date()));
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [deletingAppointmentId, setDeletingAppointmentId] = useState(null);

  const [dashboardState, setDashboardState] = useState({
    loading: true,
    error: '',
    stats: null,
    revenueSeries: [],
    calendar: { bookedDays: [] },
    recentActivity: [],
  });

  const [appointmentsState, setAppointmentsState] = useState({
    loading: true,
    error: '',
    rows: [],
    total: 0,
  });

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    let cancelled = false;

    const loadDashboard = async () => {
      try {
        setDashboardState((prev) => ({ ...prev, loading: true, error: '' }));
        const payload = await fetchAdminDashboard(session.token, monthKey);
        if (cancelled) {
          return;
        }
        setDashboardState({
          loading: false,
          error: '',
          stats: payload.stats,
          revenueSeries: payload.revenueSeries || [],
          calendar: payload.calendar || { bookedDays: [] },
          recentActivity: payload.recentActivity || [],
        });
      } catch (error) {
        if (!cancelled) {
          setDashboardState((prev) => ({ ...prev, loading: false, error: error.message || 'Errore cruscotto.' }));
        }
      }
    };

    loadDashboard();
    return () => {
      cancelled = true;
    };
  }, [monthKey, session.token]);

  useEffect(() => {
    let cancelled = false;

    const loadAppointments = async () => {
      try {
        setAppointmentsState((prev) => ({ ...prev, loading: true, error: '' }));
        const payload = await fetchAdminAppointments(session.token, {
          page,
          pageSize,
          search,
        });
        if (cancelled) {
          return;
        }
        setAppointmentsState({
          loading: false,
          error: '',
          rows: payload.rows || [],
          total: Number(payload.total || 0),
        });
      } catch (error) {
        if (!cancelled) {
          setAppointmentsState((prev) => ({ ...prev, loading: false, error: error.message || 'Errore appuntamenti.' }));
        }
      }
    };

    loadAppointments();
    return () => {
      cancelled = true;
    };
  }, [page, search, session.token]);

  const stats = dashboardState.stats || {
    totalAppointments: 0,
    todaysBookings: 0,
    revenueMonthlyEur: 0,
    revenueGrowthPercent: 0,
    activeTours: 0,
  };

  const revenueValues = dashboardState.revenueSeries.map((point) => point.revenueCents / 100);
  const annualRevenue = revenueValues.reduce((sum, value) => sum + value, 0);
  const averageMonth = annualRevenue / 12;

  const statCards = [
    {
      key: 'total',
      title: 'Appuntamenti Totali',
      value: stats.totalAppointments,
      badgeText: '+12.5%',
      icon: CalendarDays,
      variant: 'orange',
    },
    {
      key: 'today',
      title: 'Prenotazioni di Oggi',
      value: stats.todaysBookings,
      badgeText: `+${stats.todaysBookings}`,
      icon: TrendingUp,
      variant: 'red',
    },
    {
      key: 'revenue',
      title: 'Ricavi (Mensili)',
      value: formatCurrency(stats.revenueMonthlyEur),
      badgeText: `${stats.revenueGrowthPercent >= 0 ? '+' : ''}${stats.revenueGrowthPercent}%`,
      icon: DollarSign,
      variant: 'amber',
    },
    {
      key: 'tours',
      title: 'Tour Attivi',
      value: stats.activeTours,
      badgeText: '+2',
      icon: MapPinned,
      variant: 'wine',
    },
  ];

  const navItems = [
    { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { key: 'appointments', label: 'Appuntamenti', icon: CalendarDays },
    { key: 'tours', label: 'Tour', icon: MapPinned },
    { key: 'customers', label: 'Clienti', icon: Users },
    { key: 'payments', label: 'Pagamenti', icon: CreditCard },
    { key: 'analytics', label: 'Analisi', icon: BarChart3 },
    { key: 'settings', label: 'Impostazioni', icon: Settings },
  ];

  const handleDeleteAppointment = async (appointmentId) => {
    const canDelete = window.confirm('Vuoi eliminare definitivamente questa prenotazione?');
    if (!canDelete) {
      return;
    }

    const shouldGoPreviousPage = appointmentsState.rows.length === 1 && page > 1;

    try {
      setDeletingAppointmentId(appointmentId);
      await deleteAdminAppointment(session.token, appointmentId);
      if (shouldGoPreviousPage) {
        setPage((current) => Math.max(1, current - 1));
      } else {
        setAppointmentsState((prev) => ({
          ...prev,
          error: '',
          rows: prev.rows.filter((row) => row.id !== appointmentId),
          total: Math.max(0, Number(prev.total || 0) - 1),
        }));
      }
    } catch (error) {
      setAppointmentsState((prev) => ({
        ...prev,
        error: error.message || 'Errore durante eliminazione appuntamento.',
      }));
    } finally {
      setDeletingAppointmentId(null);
    }
  };

  return (
    <div className="admin-shell">
      <Sidebar
        items={navItems}
        activeItem={activeItem}
        onSelect={setActiveItem}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onLogout={logout}
      />

      <div className="admin-main">
        <Topbar
          searchValue={searchInput}
          onSearchChange={setSearchInput}
          onMenuClick={() => setSidebarOpen(true)}
          adminEmail={session.email}
        />

        <main className="admin-content">
          <section className="admin-headline">
            <h1>Dashboard</h1>
            <p>Bentornato! Ecco cosa sta succedendo oggi con i tuoi tour.</p>
          </section>

          {dashboardState.error ? <p className="admin-alert-error">{dashboardState.error}</p> : null}

          <section className="admin-stats-grid">
            {statCards.map((card) => (
              <StatCard key={card.key} {...card} />
            ))}
          </section>

          <section className="admin-panel admin-appointments-panel">
            <div className="admin-panel-head">
              <div>
                <h2>Appuntamenti <span className="admin-gradient-word">Recenti</span></h2>
                <p>Gestisci e monitora tutte le prenotazioni dei tour</p>
              </div>
            </div>

            {appointmentsState.error ? <p className="admin-alert-error">{appointmentsState.error}</p> : null}
            {appointmentsState.loading ? <p className="admin-loading">Caricamento appuntamenti...</p> : null}

            <AppointmentsTable
              rows={appointmentsState.rows}
              page={page}
              pageSize={pageSize}
              total={appointmentsState.total}
              onPageChange={setPage}
              onDelete={handleDeleteAppointment}
              deletingId={deletingAppointmentId}
            />
          </section>

          <section className="admin-lower-grid">
            <article className="admin-panel admin-revenue-panel">
              <div className="admin-panel-head revenue">
                <div>
                  <h2>Panoramica <span className="admin-gradient-word">Ricavi</span></h2>
                  <p>Entrate mensili dai tour</p>
                </div>
                <div className="admin-year-switch">
                  <button type="button" className="active">Quest'anno</button>
                  <button type="button">Anno scorso</button>
                </div>
              </div>

              <RevenueChart values={revenueValues.length ? revenueValues : new Array(12).fill(0)} />

              <div className="admin-revenue-foot">
                <div>
                  <small>Ricavo Totale</small>
                  <strong>{formatCurrency(annualRevenue)}</strong>
                </div>
                <div>
                  <small>Media/Mese</small>
                  <strong>{formatCurrency(averageMonth)}</strong>
                </div>
                <div>
                  <small>Crescita</small>
                  <strong className={stats.revenueGrowthPercent >= 0 ? 'positive' : 'negative'}>
                    {stats.revenueGrowthPercent >= 0 ? '+' : ''}{stats.revenueGrowthPercent}%
                  </strong>
                </div>
              </div>
            </article>

            <div className="admin-side-stack">
              <MiniCalendar
                monthKey={monthKey}
                bookedDays={dashboardState.calendar.bookedDays || []}
                onPrev={() => setMonthKey((current) => shiftMonth(current, -1))}
                onNext={() => setMonthKey((current) => shiftMonth(current, 1))}
              />
              <RecentActivity rows={dashboardState.recentActivity || []} />
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}

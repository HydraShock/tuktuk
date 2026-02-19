import React, { useEffect, useMemo, useRef, useState } from 'react';
import './App.css';
import { BackgroundGradientAnimation } from './ui/background-gradient-animation';
import { BackgroundGradient } from './components/ui/background-gradient.jsx';

const heroRomeImages = [
  'https://images.unsplash.com/photo-1552832230-c0197dd311b5?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1525874684015-58379d421a52?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1529260830199-42c24126f198?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1529154036614-a60975f5c760?auto=format&fit=crop&w=900&q=80',
];

const tours = [
  {
    id: 'classico',
    title: 'Roma \n Da Romano',
    price: 89,
    duration: '3 ore',
    capacity: '1-4 persone',
    rating: 4.9,
    description: 'Esplora i monumenti piu iconici di Roma',
    stops: ['Colosseo', 'Foro Romano', 'Palatino'],
    image:
      'https://images.unsplash.com/photo-1552832230-c0197dd311b5?auto=format&fit=crop&w=1200&q=80',
  },
  {
    id: 'completo',
    title: 'Roma Mangia Prega Ama',
    price: 149,
    duration: '5 ore',
    capacity: '1-4 persone',
    rating: 5.0,
    popular: true,
    description: "L'esperienza definitiva della citta eterna",
    stops: ['Vaticano', 'Colosseo', 'Centro Storico', 'Trastevere'],
    image:
      'https://images.unsplash.com/photo-1529260830199-42c24126f198?auto=format&fit=crop&w=1200&q=80',
  },
];

const availableTimes = [
  '09:00 - 11:30',
  '11:45 - 14:20',
  '15:00 - 17:30',
];
const bookingTourOptions = [
  {
    id: 'roma-mangia-prega-ama',
    title: 'Roma tour mangia prega ama',
    price: 79,
    rating: 4.8,
    duration: '2.5 ore',
    capacity: '1-4 persone',
    description: 'Tra vicoli iconici, sapori romani e scorci indimenticabili.',
    stops: ['Fontana di Trevi', 'Piazza di Spagna', 'Pantheon'],
    image:
      'https://images.unsplash.com/photo-1531572753322-ad063cecc140?auto=format&fit=crop&w=1200&q=80',
  },
  {
    id: 'when-in-rome',
    title: 'When in Rome do as the Romans do',
    price: 149,
    rating: 5.0,
    duration: '5 ore',
    capacity: '1-4 persone',
    popular: true,
    description: "L'esperienza completa per vivere Roma come un locale.",
    stops: ['Vaticano', 'Colosseo', 'Centro Storico', 'Trastevere'],
    image:
      'https://images.unsplash.com/photo-1529260830199-42c24126f198?auto=format&fit=crop&w=1200&q=80',
  },
];

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:4000/api';
const PAYMENT_MODE = (process.env.REACT_APP_PAYMENT_MODE || 'mock').toLowerCase();
const CHECKOUT_PROVIDER = PAYMENT_MODE === 'paypal' ? 'paypal' : 'mock';

function toDateKey(dateValue) {
  const year = dateValue.getFullYear();
  const month = String(dateValue.getMonth() + 1).padStart(2, '0');
  const day = String(dateValue.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function toMonthKey(dateValue) {
  const year = dateValue.getFullYear();
  const month = String(dateValue.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

function sanitizeCustomerText(value, maxLength) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, maxLength);
}

function isValidCustomerEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isValidCustomerPhone(value) {
  return /^[0-9+\s().-]{6,25}$/.test(value);
}

const galleryImages = [
  'https://images.unsplash.com/photo-1552832230-c0197dd311b5?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1529154036614-a60975f5c760?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1529260830199-42c24126f198?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1531572753322-ad063cecc140?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1515542622106-78bda8ba0e5b?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1555992336-fb0d29498b13?auto=format&fit=crop&w=1200&q=80',
];

function TourShowcaseCard({ tour, onBook }) {
  return (
    <article className={`tour-showcase-card ${tour.popular ? 'popular' : ''}`}>
      {tour.popular ? <span className="popular-badge">{"PI\u00D9 POPOLARE"}</span> : null}
      <div className="tour-image-wrap">
        <img src={tour.image} alt={tour.title} />
        <span className="tour-rating">
          <span className="rating-star">{"\u2605"}</span>
          {tour.rating}
        </span>
      </div>

      <div className="tour-body">
        <h3>{tour.title}</h3>
        <p>{tour.description}</p>

        <div className="tour-tags">
          {tour.stops.map((stop) => (
            <span key={stop}>{stop}</span>
          ))}
        </div>

        <div className="tour-meta">
          <span>
            <i>{"\u25F7"}</i> {tour.duration}
          </span>
          <span>
            <i>{"\u{1F465}"}</i> {tour.capacity}
          </span>
        </div>

        <div className="tour-divider" />

        <div className="tour-footer-row">
          <div>
            <small>A partire da</small>
            <strong>{"\u20AC"}{tour.price}</strong>
          </div>
          <button type="button" onClick={() => onBook(tour.id)}>
            Prenota <span>{"\u2192"}</span>
          </button>
        </div>
      </div>
    </article>
  );
}

function App() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [date, setDate] = useState(new Date());
  const [timeSlot, setTimeSlot] = useState('');
  const [tourId, setTourId] = useState('');
  const [people, setPeople] = useState('2');
  const [customerFirstName, setCustomerFirstName] = useState('');
  const [customerLastName, setCustomerLastName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerFormError, setCustomerFormError] = useState('');
  const [currentStep, setCurrentStep] = useState(1);
  const [calendarMonth, setCalendarMonth] = useState(() => new Date(date.getFullYear(), date.getMonth(), 1));
  const [stepMotion, setStepMotion] = useState('idle');
  const [availabilityByDate, setAvailabilityByDate] = useState({});
  const [availabilityError, setAvailabilityError] = useState('');
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [availabilityRetryTick, setAvailabilityRetryTick] = useState(0);
  const [isPaying, setIsPaying] = useState(false);
  const transitionTimersRef = useRef([]);

  const selectedTour = useMemo(
    () => bookingTourOptions.find((tour) => tour.id === tourId),
    [tourId]
  );

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 18);
    };

    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth > 720) {
        setMenuOpen(false);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const todayStart = useMemo(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }, []);

  const selectedDateKey = useMemo(() => toDateKey(date), [date]);
  const customerData = useMemo(
    () => ({
      firstName: sanitizeCustomerText(customerFirstName, 80),
      lastName: sanitizeCustomerText(customerLastName, 80),
      phone: sanitizeCustomerText(customerPhone, 40),
      email: sanitizeCustomerText(customerEmail, 160).toLowerCase(),
    }),
    [customerEmail, customerFirstName, customerLastName, customerPhone]
  );
  const customerDataReady = useMemo(
    () => (
      customerData.firstName.length >= 2
      && customerData.lastName.length >= 2
      && isValidCustomerPhone(customerData.phone)
      && isValidCustomerEmail(customerData.email)
    ),
    [customerData]
  );
  const bookingReady = Boolean(date && timeSlot && tourId && customerDataReady);
  const guests = Number(people);
  const weekdays = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];
  const selectedDateLabel = useMemo(
    () =>
      date.toLocaleDateString('it-IT', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      }),
    [date]
  );
  const selectedDateLong = useMemo(
    () =>
      date.toLocaleDateString('it-IT', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }),
    [date]
  );

  const monthTitle = useMemo(
    () => calendarMonth.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' }),
    [calendarMonth]
  );
  const monthKey = useMemo(() => toMonthKey(calendarMonth), [calendarMonth]);
  const selectedDayAvailability = availabilityByDate[selectedDateKey];

  const calendarDays = useMemo(() => {
    const monthStart = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1);
    const nextMonthStart = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1);
    const daysInMonth = Math.round((nextMonthStart - monthStart) / 86400000);
    const startOffset = (monthStart.getDay() + 6) % 7;
    const cells = Array.from({ length: startOffset + daysInMonth }, (_, index) => {
      if (index < startOffset) {
        return { key: `empty-${index}`, empty: true };
      }
      const dayNumber = index - startOffset + 1;
      const value = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), dayNumber);
      const isPast = value < todayStart;
      const dayKey = toDateKey(value);
      const dayAvailability = availabilityByDate[dayKey];
      const isSelected =
        value.getFullYear() === date.getFullYear() &&
        value.getMonth() === date.getMonth() &&
        value.getDate() === date.getDate();
      const isToday =
        value.getFullYear() === todayStart.getFullYear() &&
        value.getMonth() === todayStart.getMonth() &&
        value.getDate() === todayStart.getDate();
      const blockedByAvailability = dayAvailability
        ? dayAvailability.allSlotsFull
        : (availabilityLoading || Boolean(availabilityError));
      return {
        key: value.toISOString(),
        value,
        dayKey,
        dayNumber,
        isPast,
        isSelected,
        isToday,
        blockedByAvailability,
      };
    });

    const missing = (7 - (cells.length % 7)) % 7;
    return [...cells, ...Array.from({ length: missing }, (_, idx) => ({ key: `tail-${idx}`, empty: true }))];
  }, [availabilityByDate, availabilityError, availabilityLoading, calendarMonth, date, todayStart]);

  useEffect(() => {
    let cancelled = false;

    const loadAvailability = async () => {
      try {
        setAvailabilityLoading(true);
        const response = await fetch(`${API_BASE_URL}/availability?month=${monthKey}`);
        if (!response.ok) {
          throw new Error('Impossibile caricare disponibilita');
        }
        const payload = await response.json();
        if (!cancelled) {
          setAvailabilityError('');
          setAvailabilityByDate(payload.days || {});
        }
      } catch (error) {
        if (!cancelled) {
          setAvailabilityError('Disponibilita temporaneamente non raggiungibile. Riprovo tra pochi secondi.');
        }
      } finally {
        if (!cancelled) {
          setAvailabilityLoading(false);
        }
      }
    };

    loadAvailability();
    return () => {
      cancelled = true;
    };
  }, [monthKey, availabilityRetryTick]);

  useEffect(() => {
    if (!availabilityError) {
      return undefined;
    }
    const retryTimer = window.setTimeout(() => {
      setAvailabilityRetryTick((current) => current + 1);
    }, 2500);
    return () => {
      window.clearTimeout(retryTimer);
    };
  }, [availabilityError]);

  useEffect(() => {
    const selectedSlotStatus = selectedDayAvailability?.slots?.[timeSlot];
    if (timeSlot && selectedSlotStatus && !selectedSlotStatus.available) {
      setTimeSlot('');
    }
  }, [selectedDayAvailability, timeSlot]);

  useEffect(() => {
    return () => {
      transitionTimersRef.current.forEach((id) => window.clearTimeout(id));
    };
  }, []);

  useEffect(() => {
    if (!customerFormError) {
      return;
    }
    if (customerDataReady && Number.isInteger(guests) && guests >= 1 && guests <= 8) {
      setCustomerFormError('');
    }
  }, [customerDataReady, customerFormError, guests]);

  const bookingPayload = {
    tourId,
    tourName: selectedTour?.title || '',
    date: selectedDateKey,
    time: timeSlot,
    people,
    customer: customerData,
    amount: selectedTour?.price || 0,
    currency: 'EUR',
  };

  const clearStepTimers = () => {
    transitionTimersRef.current.forEach((id) => window.clearTimeout(id));
    transitionTimersRef.current = [];
  };

  const transitionToStep = (nextStep, direction) => {
    clearStepTimers();
    setStepMotion(direction === 'forward' ? 'out-left' : 'out-right');
    const outTimer = window.setTimeout(() => {
      setCurrentStep(nextStep);
      setStepMotion(direction === 'forward' ? 'in-left' : 'in-right');
      const inTimer = window.setTimeout(() => {
        setStepMotion('idle');
      }, 280);
      transitionTimersRef.current.push(inTimer);
    }, 170);
    transitionTimersRef.current.push(outTimer);
  };

  const validateCustomerStep = () => {
    if (customerData.firstName.length < 2) {
      setCustomerFormError('Inserisci un nome valido (almeno 2 caratteri).');
      return false;
    }
    if (customerData.lastName.length < 2) {
      setCustomerFormError('Inserisci un cognome valido (almeno 2 caratteri).');
      return false;
    }
    if (!isValidCustomerPhone(customerData.phone)) {
      setCustomerFormError('Inserisci un numero di cellulare valido.');
      return false;
    }
    if (!isValidCustomerEmail(customerData.email)) {
      setCustomerFormError('Inserisci un indirizzo email valido.');
      return false;
    }
    if (!Number.isInteger(guests) || guests < 1 || guests > 8) {
      setCustomerFormError('Numero ospiti non valido.');
      return false;
    }
    setCustomerFormError('');
    return true;
  };

  const goToTimeStep = () => {
    if (!date) {
      window.alert('Seleziona una data prima di continuare.');
      return;
    }
    if (!selectedDayAvailability) {
      window.alert('Disponibilita non ancora caricata. Attendi un attimo e riprova.');
      return;
    }
    transitionToStep(2, 'forward');
  };

  const goToTourStep = () => {
    if (!selectedDayAvailability) {
      window.alert('Disponibilita non ancora caricata. Attendi un attimo e riprova.');
      return;
    }
    const slotAvailability = selectedDayAvailability?.slots?.[timeSlot];
    if (!timeSlot || !slotAvailability || !slotAvailability.available) {
      window.alert('Seleziona un orario disponibile prima di continuare.');
      return;
    }
    transitionToStep(3, 'forward');
  };

  const goToCustomerStep = () => {
    if (!tourId) {
      window.alert('Seleziona un tour prima di continuare.');
      return;
    }
    transitionToStep(4, 'forward');
  };

  const goToConfirmStep = () => {
    if (!validateCustomerStep()) {
      window.alert('Completa correttamente i dati cliente prima di continuare.');
      return;
    }
    transitionToStep(5, 'forward');
  };

  const goToPaymentStep = () => {
    if (!bookingReady) {
      window.alert('Completa data, orario, tour e dati cliente prima di andare al pagamento.');
      return;
    }
    transitionToStep(6, 'forward');
  };

  const startCheckout = () => {
    if (!validateCustomerStep()) {
      window.alert('Completa correttamente i dati cliente prima del pagamento.');
      return;
    }
    if (!bookingReady) {
      window.alert('Completa prima i dati della prenotazione.');
      return;
    }

    const selectedSlotStatus = selectedDayAvailability?.slots?.[timeSlot];
    if (selectedSlotStatus && !selectedSlotStatus.available) {
      window.alert('Lo slot selezionato non e piu disponibile. Scegline un altro.');
      return;
    }

    const pay = async () => {
      try {
        setIsPaying(true);

        const intentResponse = await fetch(`${API_BASE_URL}/booking-intents`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            date: bookingPayload.date,
            timeSlot: bookingPayload.time,
            guests: Number(bookingPayload.people),
            tourId: bookingPayload.tourId || null,
            firstName: bookingPayload.customer.firstName,
            lastName: bookingPayload.customer.lastName,
            phone: bookingPayload.customer.phone,
            email: bookingPayload.customer.email,
          }),
        });

        const intentPayload = await intentResponse.json();
        if (!intentResponse.ok) {
          throw new Error(intentPayload.message || 'Impossibile creare la prenotazione.');
        }

        const paymentReference = `${CHECKOUT_PROVIDER.toUpperCase()}_${Date.now()}`;
        const confirmResponse = await fetch(`${API_BASE_URL}/bookings/confirm`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            intentId: intentPayload.intentId,
            paymentProvider: CHECKOUT_PROVIDER,
            paymentReference,
          }),
        });

        const confirmPayload = await confirmResponse.json();
        if (!confirmResponse.ok) {
          throw new Error(confirmPayload.message || 'Pagamento non completato.');
        }

        window.alert('Pagamento completato e appuntamento inserito nel database.');
        setCurrentStep(1);
        setStepMotion('idle');
        setTimeSlot('');

        const refresh = await fetch(`${API_BASE_URL}/availability?month=${monthKey}`);
        if (refresh.ok) {
          const refreshedData = await refresh.json();
          setAvailabilityByDate(refreshedData.days || {});
        }
      } catch (error) {
        window.alert(error.message || 'Errore durante il pagamento.');
      } finally {
        setIsPaying(false);
      }
    };

    pay();
  };

  return (
    <div className="page">
      <header className={`topbar ${isScrolled ? 'scrolled' : ''}`}>
        <div className="topbar-head">
          <div className="brand">
            <span className="brand-icon">{"\u{1F6FA}"}</span>
            <div>
              <strong>RomeInOut</strong>
            </div>
          </div>
        </div>
        <nav className={`top-nav ${menuOpen ? 'open' : ''}`}>
          <a href="#tour" onClick={() => setMenuOpen(false)}>
            Tour
          </a>
          <a href="#tour" onClick={() => setMenuOpen(false)}>
            Esperienze
          </a>
          <a href="#galleria" onClick={() => setMenuOpen(false)}>
            Galleria
          </a>
          <a href="#contatti" onClick={() => setMenuOpen(false)}>
            Contatti
          </a>
          <a href="#prenota" className="cta-small" onClick={() => setMenuOpen(false)}>
            Prenota Ora
          </a>
          <button type="button" className="nav-menu-icon" aria-label="Menu rapido">
            {"\u2261"}
          </button>
        </nav>
        <button
          type="button"
          className={`menu-toggle ${menuOpen ? 'open' : ''}`}
          onClick={() => setMenuOpen((open) => !open)}
          aria-label={menuOpen ? 'Chiudi menu' : 'Apri menu'}
          aria-expanded={menuOpen}
        >
          <span />
          <span />
          <span />
        </button>
      </header>

      <section className="hero" id="home">
        <div className="hero-overlay" />
        <div className="hero-content hero-layout">
          <div className="hero-media-grid" aria-label="Foto di Roma">
            {heroRomeImages.map((image, index) => (
              <figure
                key={image}
                className={`hero-media-card hero-media-card-${index + 1}`}
                onMouseMove={(event) => {
                  const rect = event.currentTarget.getBoundingClientRect();
                  const x = event.clientX - rect.left;
                  const y = event.clientY - rect.top;
                  const rotateY = ((x / rect.width) * 2 - 1) * 8;
                  const rotateX = -((y / rect.height) * 2 - 1) * 8;
                  event.currentTarget.style.setProperty('--hero-rx', `${rotateX.toFixed(2)}deg`);
                  event.currentTarget.style.setProperty('--hero-ry', `${rotateY.toFixed(2)}deg`);
                }}
                onMouseLeave={(event) => {
                  event.currentTarget.style.setProperty('--hero-rx', '0deg');
                  event.currentTarget.style.setProperty('--hero-ry', '0deg');
                }}
              >
                <img src={image} alt={`Roma scorcio ${index + 1}`} />
              </figure>
            ))}
          </div>
          <div className="hero-copy">
            <h1>
              Roma Tuk Tuk
              <br />
              <span>Tours</span>
            </h1>
            <h2>Vivi Roma in modo unico</h2>
            <p>
              Scopri la citta in modo comodo, panoramico e senza stress.
            </p>
            <div className="hero-actions">
              <a href="#prenota" className="hero-cta">
                Prenota Ora <span>{"\u2192"}</span>
              </a>
              <a href="#tour" className="hero-cta hero-cta-alt">
                {"\u29BF"} Scopri i tour
              </a>
            </div>
            <div className="hero-stats">
              <div>
                <strong>10K+</strong>
                <small>Turisti Felici</small>
              </div>
              <div>
                <strong>15+</strong>
                <small>Tour Disponibili</small>
              </div>
              <div>
                <strong>4.9{"\u2605"}</strong>
                <small>Valutazione Media</small>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="tours" id="tour">
        <h2>
          I Nostri <span>Tour</span>
        </h2>
        <p className="section-subtitle">
          Scegli l&#39;esperienza perfetta per te e scopri Roma come mai prima d&#39;ora
        </p>

        <div className="tour-grid">
          {tours.map((tour) => (
            <TourShowcaseCard
              key={tour.id}
              tour={tour}
              onBook={() => {
                setTourId('');
                setCurrentStep(1);
                document.getElementById('prenota')?.scrollIntoView({ behavior: 'smooth' });
              }}
            />
          ))}
        </div>
      </section>

      <section className="booking" id="prenota">
        <div className="booking-head-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none">
            <rect x="3.8" y="5.2" width="16.4" height="14.6" rx="2.5" stroke="currentColor" strokeWidth="2" />
            <path d="M3.8 9.4H20.2" stroke="currentColor" strokeWidth="2" />
            <path d="M8 3.1V6.3M16 3.1V6.3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <path d="M8 12.3H9.9M11.3 12.3H13.2M14.8 12.3H16.7M8 15.6H9.9M11.3 15.6H13.2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </div>

        <h2>
          Prenota il Tuo <span>Tour</span>
        </h2>
        <p>Scegli la data e l'orario perfetto per la tua esperienza indimenticabile a Roma</p>

        <ol className="booking-steps">
          {[1, 2, 3, 4, 5, 6].map((step, index) => (
            <React.Fragment key={step}>
              {index > 0 ? <li className={`booking-step-line ${currentStep >= step ? 'active' : ''}`} /> : null}
              <li className={`booking-step-dot ${currentStep >= step ? 'active' : ''}`}>{step}</li>
            </React.Fragment>
          ))}
        </ol>

        <div className={`booking-stage ${stepMotion !== 'idle' ? `booking-stage-${stepMotion}` : ''}`}>
          {currentStep === 1 ? (
            <div className="booking-stage-panel">
              <div className="booking-month-row">
                <button
                  type="button"
                  className="booking-month-arrow"
                  onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1))}
                >
                  {"\u2039"}
                </button>
                <h3>{monthTitle}</h3>
                <button
                  type="button"
                  className="booking-month-arrow"
                  onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1))}
                >
                  {"\u203A"}
                </button>
              </div>

              <div className="booking-calendar-card">
                <div className="booking-calendar-weekdays">
                  {weekdays.map((weekday) => (
                    <span key={weekday}>{weekday}</span>
                  ))}
                </div>

                <div className="booking-calendar-grid">
                  {calendarDays.map((cell) => {
                    if (cell.empty) {
                      return <span key={cell.key} className="booking-day-empty" aria-hidden="true" />;
                    }
                    return (
                      <button
                        type="button"
                        key={cell.key}
                        disabled={cell.isPast || cell.blockedByAvailability}
                        className={`booking-day ${cell.isPast ? 'past' : ''} ${cell.blockedByAvailability ? 'full' : ''} ${cell.isToday ? 'current' : ''} ${cell.isSelected ? 'selected' : ''}`}
                        onClick={() => {
                          setDate(cell.value);
                          setCalendarMonth(new Date(cell.value.getFullYear(), cell.value.getMonth(), 1));
                        }}
                      >
                        {cell.dayNumber}
                      </button>
                    );
                  })}
                </div>
              </div>

              <button type="button" className="booking-primary-cta" onClick={goToTimeStep}>
                Avanti
              </button>
            </div>
          ) : null}

          {currentStep === 2 ? (
            <div className="booking-stage-panel">
              <div className="booking-selected-date">
                <span aria-hidden="true">{"\u{1F4C5}"}</span>
                <strong>{selectedDateLabel}</strong>
              </div>

                <div className="booking-time-card">
                  <h3 className="booking-strong-title">
                    Scegli la <span>Fascia Oraria</span>
                  </h3>
                <div className="booking-time-grid">
                  {availableTimes.map((time) => {
                    const slotAvailability = selectedDayAvailability?.slots?.[time];
                    const slotUnavailable = !slotAvailability || !slotAvailability.available;
                    return (
                      <button
                        type="button"
                        key={time}
                        disabled={slotUnavailable}
                        className={`booking-time-slot ${timeSlot === time ? 'selected' : ''} ${slotUnavailable ? 'unavailable' : ''}`}
                        onClick={() => setTimeSlot(time)}
                      >
                        {time}
                      </button>
                    );
                  })}
                </div>
                {availabilityLoading ? <p className="booking-availability-error">Aggiornamento disponibilita in corso...</p> : null}
                {availabilityError ? <p className="booking-availability-error">{availabilityError}</p> : null}
              </div>

              <div className="booking-nav-row">
                <button type="button" className="booking-ghost-btn" onClick={() => transitionToStep(1, 'backward')}>
                  Indietro
                </button>
                <button type="button" className="booking-primary-cta" onClick={goToTourStep}>
                  Avanti
                </button>
              </div>
            </div>
          ) : null}

          {currentStep === 3 ? (
            <div className="booking-stage-panel">
              <div className="booking-tour-card">
                <h3 className="booking-strong-title">
                  Scegli il <span>Tour</span>
                </h3>
                <div className="booking-tour-grid">
                  {bookingTourOptions.map((tour) => (
                    <BackgroundGradient
                      key={tour.id}
                      containerClassName={`booking-tour-gradient ${tourId === tour.id ? 'selected' : ''}`}
                      className="booking-tour-gradient-content"
                    >
                      <button
                        type="button"
                        className={`booking-tour-option ${tourId === tour.id ? 'selected' : ''}`}
                        onClick={() => setTourId(tour.id)}
                      >
                        {tour.popular ? <span className="booking-tour-popular">{"PI\u00D9 POPOLARE"}</span> : null}
                        <div className="booking-tour-media">
                          <img src={tour.image} alt={tour.title} />
                          <span className="booking-tour-rating">
                            <span>{"\u2605"}</span>
                            {tour.rating}
                          </span>
                        </div>

                        <div className="booking-tour-content">
                          <span className="booking-tour-name">{tour.title}</span>
                          <p>{tour.description}</p>
                          <div className="booking-tour-tags">
                            {tour.stops.map((stop) => (
                              <span key={stop}>{stop}</span>
                            ))}
                          </div>
                          <div className="booking-tour-meta">
                            <span>{"\u25F7"} {tour.duration}</span>
                            <span>{"\u{1F465}"} {tour.capacity}</span>
                          </div>
                          <strong>EUR {tour.price}</strong>
                        </div>
                      </button>
                    </BackgroundGradient>
                  ))}
                </div>
              </div>

              <div className="booking-nav-row">
                <button type="button" className="booking-ghost-btn" onClick={() => transitionToStep(2, 'backward')}>
                  Indietro
                </button>
                <button type="button" className="booking-primary-cta" onClick={goToCustomerStep}>
                  Avanti
                </button>
              </div>
            </div>
          ) : null}

          {currentStep === 4 ? (
            <div className="booking-stage-panel">
              <div className="booking-customer-card">
                <div className="booking-confirm-icon" aria-hidden="true">
                  <span className="booking-confirm-icon-core">
                    <svg viewBox="0 0 24 24" fill="none">
                      <rect x="4.2" y="4.2" width="15.6" height="15.6" rx="3.4" stroke="currentColor" strokeWidth="2.2" />
                      <path d="M8.2 15.6V14.8C8.2 13.4 9.3 12.3 10.7 12.3H13.3C14.7 12.3 15.8 13.4 15.8 14.8V15.6" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" />
                      <circle cx="12" cy="9" r="2.1" stroke="currentColor" strokeWidth="2.1" />
                    </svg>
                  </span>
                </div>
                <h3 className="booking-strong-title">
                  INSERISCI I TUOI <span>DATI</span>
                </h3>
                <p>Aggiungi i dati del cliente e il numero ospiti prima della conferma.</p>

                <div className="booking-customer-grid">
                  <label className="booking-customer-field">
                    <span>Nome</span>
                    <input
                      type="text"
                      value={customerFirstName}
                      onChange={(event) => setCustomerFirstName(event.target.value)}
                      placeholder="Mario"
                      autoComplete="given-name"
                    />
                  </label>
                  <label className="booking-customer-field">
                    <span>Cognome</span>
                    <input
                      type="text"
                      value={customerLastName}
                      onChange={(event) => setCustomerLastName(event.target.value)}
                      placeholder="Rossi"
                      autoComplete="family-name"
                    />
                  </label>
                  <label className="booking-customer-field">
                    <span>Cellulare</span>
                    <input
                      type="tel"
                      value={customerPhone}
                      onChange={(event) => setCustomerPhone(event.target.value)}
                      placeholder="+39 333 123 4567"
                      autoComplete="tel"
                    />
                  </label>
                  <label className="booking-customer-field">
                    <span>Email</span>
                    <input
                      type="email"
                      value={customerEmail}
                      onChange={(event) => setCustomerEmail(event.target.value)}
                      placeholder="cliente@email.com"
                      autoComplete="email"
                    />
                  </label>
                </div>

                <div className="booking-confirm-row booking-guests-row">
                  <div className="icon">{"\u{1F465}"}</div>
                  <div>
                    <small>
                      Numero Ospiti <span className="booking-inline-gradient">(18+)</span>
                    </small>
                    <div className="booking-guests">
                      <button type="button" onClick={() => setPeople(String(Math.max(1, guests - 1)))}>
                        {"\u2212"}
                      </button>
                      <strong>{people}</strong>
                      <button type="button" onClick={() => setPeople(String(Math.min(8, guests + 1)))}>
                        +
                      </button>
                    </div>
                    <small className="booking-guests-note">I bambini non pagano.</small>
                  </div>
                </div>

                {customerFormError ? <p className="booking-customer-error">{customerFormError}</p> : null}
              </div>

              <div className="booking-nav-row">
                <button type="button" className="booking-ghost-btn" onClick={() => transitionToStep(3, 'backward')}>
                  Indietro
                </button>
                <button type="button" className="booking-primary-cta" onClick={goToConfirmStep}>
                  Avanti
                </button>
              </div>
            </div>
          ) : null}

          {currentStep === 5 ? (
            <div className="booking-stage-panel">
              <div className="booking-confirm-card">
                <div className="booking-confirm-icon" aria-hidden="true">
                  <span className="booking-confirm-icon-core">
                    <svg viewBox="0 0 24 24" fill="none">
                      <path d="M5.5 12.8L10.1 17.2L18.6 7.8" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                </div>
                <h3 className="booking-strong-title">
                  Conferma la tua <span>Prenotazione</span>
                </h3>
                <p>Rivedi i dettagli prima del pagamento.</p>

                <div className="booking-confirm-row">
                  <div className="icon">{"\u{1F4C5}"}</div>
                  <div>
                    <small>Data</small>
                    <strong>{selectedDateLong}</strong>
                  </div>
                </div>

                <div className="booking-confirm-row">
                  <div className="icon">{"\u25F7"}</div>
                  <div>
                    <small>Orario</small>
                    <strong>{timeSlot || '-'}</strong>
                  </div>
                </div>

                <div className="booking-confirm-row">
                  <div className="icon">{"\u{1F464}"}</div>
                  <div>
                    <small>Cliente</small>
                    <strong>{`${customerData.firstName} ${customerData.lastName}`}</strong>
                  </div>
                </div>

                <div className="booking-confirm-row">
                  <div className="icon">{"\u260E"}</div>
                  <div>
                    <small>Contatti</small>
                    <strong>{customerData.phone}</strong>
                    <small>{customerData.email}</small>
                  </div>
                </div>

                {selectedTour ? (
                  <div className="booking-confirm-row">
                    <div className="icon">{"\u{1F695}"}</div>
                    <div>
                      <small>Tour</small>
                      <strong>{selectedTour.title}</strong>
                    </div>
                  </div>
                ) : null}

                {selectedTour ? (
                  <div className="booking-confirm-row">
                    <div className="icon">{"\u20AC"}</div>
                    <div>
                      <small>Prezzo Totale ({people} ospiti)</small>
                      <strong>EUR {selectedTour.price * Number(people)}</strong>
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="booking-nav-row">
                <button type="button" className="booking-ghost-btn" onClick={() => transitionToStep(4, 'backward')}>
                  Indietro
                </button>
                <button type="button" className="booking-primary-cta" onClick={goToPaymentStep}>
                  Procedi al Pagamento
                </button>
              </div>
            </div>
          ) : null}

          {currentStep === 6 ? (
            <div className="booking-stage-panel">
              <div className="booking-payment-card">
                <div className="booking-payment-icon" aria-hidden="true">
                  <span>P</span>
                </div>
                <h3>Pagamento</h3>
                <p>Seleziona il metodo di pagamento per completare la prenotazione.</p>

                <button type="button" className="booking-paypal-method">
                  <span className="pp-badge">{CHECKOUT_PROVIDER === 'mock' ? 'TEST' : 'PayPal'}</span>
                  <strong>
                    {CHECKOUT_PROVIDER === 'mock'
                      ? 'Pagamento simulato (ambiente test)'
                      : 'Paga in sicurezza con PayPal'}
                  </strong>
                  <small>
                    Totale: EUR {selectedTour ? selectedTour.price * Number(people) : 0}
                  </small>
                </button>
              </div>

              <div className="booking-nav-row">
                <button type="button" className="booking-ghost-btn" onClick={() => transitionToStep(5, 'backward')}>
                  Indietro
                </button>
                <button
                  type="button"
                  className="booking-primary-cta booking-paypal-btn"
                  onClick={startCheckout}
                  disabled={isPaying}
                >
                  {isPaying ? 'Pagamento in corso...' : (CHECKOUT_PROVIDER === 'mock' ? 'Conferma Pagamento Test' : 'Paga con PayPal')}
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </section>

      <section className="gallery-showcase" id="galleria">
        <h2>
          La Nostra <span>Galleria</span>
        </h2>
        <p>Scopri la bellezza di Roma attraverso gli occhi dei nostri tour</p>

        <div className="gallery-grid">
          {galleryImages.map((image, index) => (
            <figure key={image} className="gallery-card">
              <img src={image} alt={`Galleria Roma ${index + 1}`} loading="lazy" />
            </figure>
          ))}
        </div>
      </section>

      <section className="footer-cta">
          <BackgroundGradientAnimation className="gradient-demo-bg">
            <div className="gradient-demo-overlay">
              <div className="ready-roma-content">
                <div className="ready-roma-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" role="img">
                    <rect x="3.5" y="4.5" width="17" height="16" rx="2.5" stroke="currentColor" strokeWidth="2" />
                    <path d="M3.5 9.5H20.5" stroke="currentColor" strokeWidth="2" />
                    <path d="M8 2.5V6.5M16 2.5V6.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    <path d="M7.5 13.5H9.5M11 13.5H13M14.5 13.5H16.5M7.5 17H9.5M11 17H13M14.5 17H16.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                  </svg>
                </div>

                <h2>Pronto a Vivere Roma?</h2>
                <p className="ready-roma-lead">
                  Prenota ora il tuo tour in tuk tuk e scopri la magia della citta eterna
                </p>

                <div className="ready-roma-actions">
                  <a href="#prenota" className="ready-btn ready-btn-primary">
                    <span className="ready-btn-icon" aria-hidden="true">
                      <svg viewBox="0 0 24 24" fill="none">
                        <path d="M4 8l8-4 8 4-8 4-8-4zM8 10v7l8 4v-7" stroke="currentColor" strokeWidth="2" />
                        <path d="M4 8v7l4 2" stroke="currentColor" strokeWidth="2" />
                      </svg>
                    </span>
                    Prenota il Tuo Tour                  </a>
                  <a href="tel:+390612345678" className="ready-btn ready-btn-ghost">
                    <span className="ready-btn-icon" aria-hidden="true">
                      <svg viewBox="0 0 24 24" fill="none">
                        <path d="M6.8 4.5l2.7 3.8c.4.5.3 1.1-.1 1.6l-1.2 1.2a13.1 13.1 0 0 0 4.7 4.7l1.2-1.2c.4-.4 1.1-.5 1.6-.1l3.8 2.7c.6.4.7 1.2.2 1.8l-1.7 1.7c-.5.5-1.2.7-1.9.5-2.7-.7-5.6-2.4-8.2-5s-4.3-5.5-5-8.2c-.2-.7 0-1.4.5-1.9L5 4.3c.6-.5 1.4-.4 1.8.2z" stroke="currentColor" strokeWidth="1.8" />
                      </svg>
                    </span>
                    Chiama Ora
                  </a>
                </div>

                <div className="ready-roma-contacts">
                  <a href="tel:+39 375 605 1114" className="ready-contact ready-contact-left">
                    <span className="ready-contact-icon" aria-hidden="true">
                      <svg viewBox="0 0 24 24" fill="none">
                        <path d="M6.8 4.5l2.7 3.8c.4.5.3 1.1-.1 1.6l-1.2 1.2a13.1 13.1 0 0 0 4.7 4.7l1.2-1.2c.4-.4 1.1-.5 1.6-.1l3.8 2.7c.6.4.7 1.2.2 1.8l-1.7 1.7c-.5.5-1.2.7-1.9.5-2.7-.7-5.6-2.4-8.2-5s-4.3-5.5-5-8.2c-.2-.7 0-1.4.5-1.9L5 4.3c.6-.5 1.4-.4 1.8.2z" stroke="currentColor" strokeWidth="1.8" />
                      </svg>
                    </span>
                    <span>
                      <span className="ready-contact-label">Telefono</span>
                      <strong>+39 375 605 1114</strong>
                    </span>
                  </a>
                  <a href="mailto:info@tuktukroma.it" className="ready-contact ready-contact-right">
                    <span className="ready-contact-icon" aria-hidden="true">
                      <svg viewBox="0 0 24 24" fill="none">
                        <rect x="3.5" y="5.5" width="17" height="13" rx="2.5" stroke="currentColor" strokeWidth="2" />
                        <path d="M4 7l8 6 8-6" stroke="currentColor" strokeWidth="2" />
                      </svg>
                    </span>
                    <span>
                      <span className="ready-contact-label">Email</span>
                      <strong>info@tuktukroma.it</strong>
                    </span>
                  </a>
                </div>
              </div>
            </div>
          </BackgroundGradientAnimation>
      </section>

        <section className="footer-map-section" aria-labelledby="footer-map-title">
          <aside className="footer-map-float footer-map-float-rating" aria-label="Tour rating">
            <span className="footer-map-float-icon">
              <svg viewBox="0 0 24 24" fill="none">
                <path d="M12 3.8l2.1 4.3 4.8.7-3.5 3.4.8 4.8L12 15.6 7.7 17l.8-4.8L5 8.8l4.8-.7L12 3.8z" fill="currentColor" />
              </svg>
            </span>
            <div>
              <strong>4.9/5</strong>
              <small>2.4k+ Reviews</small>
            </div>
          </aside>

          <aside className="footer-map-float footer-map-float-tourists" aria-label="Happy tourists">
            <span className="footer-map-float-icon green">
              <svg viewBox="0 0 24 24" fill="none">
                <path d="M7 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm10 0a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM4 19c0-2.2 1.8-4 4-4h2c2.2 0 4 1.8 4 4M12 19c0-2.2 1.8-4 4-4h0.8c1.8 0 3.2 1.4 3.2 3.2V19" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </span>
            <div>
              <strong>15k+</strong>
              <small>Happy Tourists</small>
            </div>
          </aside>

        

          <div className="footer-map-head">
            <h3 id="footer-map-title">
              Dove <span>Siamo</span>?
            </h3>
            <p>Venite a trovarci! Siamo aperti dalle 7:00 alle 23:00</p>
          </div>

          <div className="footer-map-shell">
            <iframe
              title="Mappa sede Tuk Tuk Roma - Via Cavour 134"
              src="https://maps.google.com/maps?q=Via%20Cavour%20134%2C%20Roma&t=&z=16&ie=UTF8&iwloc=&output=embed"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />

            <div className="footer-map-tour-card" aria-label="Tour details">
              <div className="footer-map-tour-card-head">
                <span className="footer-map-tour-icon">
                  <svg viewBox="0 0 24 24" fill="none">
                    <path d="M5 16V9.5c0-1.4 1.1-2.5 2.5-2.5h9c1.4 0 2.5 1.1 2.5 2.5V16" stroke="currentColor" strokeWidth="1.9" />
                    <circle cx="8.5" cy="16.5" r="1.5" fill="currentColor" />
                    <circle cx="15.5" cy="16.5" r="1.5" fill="currentColor" />
                    <path d="M3 12h18" stroke="currentColor" strokeWidth="1.6" />
                  </svg>
                </span>
                <div>
                  <strong>Tour Details</strong>
                  <small>Premium Experience</small>
                </div>
              </div>

              <div className="footer-map-tour-list">
                <p><span>Duration</span><strong>2 hours</strong></p>
                <p><span>Stops</span><strong>4 Landmarks</strong></p>
                <p><span>Price</span><strong>€120 <em>/ tour</em></strong></p>
              </div>
            </div>

            
            <a className="footer-map-cta" href="#prenota">
              <span>Book This Tour</span>
              <span className="footer-map-cta-icon">
                <svg viewBox="0 0 24 24" fill="none">
                  <path d="M5 16V9.5c0-1.4 1.1-2.5 2.5-2.5h9c1.4 0 2.5 1.1 2.5 2.5V16" stroke="currentColor" strokeWidth="2" />
                  <circle cx="8.5" cy="16.5" r="1.5" fill="currentColor" />
                  <circle cx="15.5" cy="16.5" r="1.5" fill="currentColor" />
                </svg>
              </span>
            </a>

            <div className="footer-map-dots" aria-hidden="true">
              <span className="active" />
              <span />
              <span />
            </div>
          </div>

          <div className="footer-map-benefits" aria-label="Tour benefits">
            <span>
              <i>✓</i> Cancellazione Gratuita
            </span>
            <span>
              <i>◎</i> Esperienza Personalizzata
            </span>
            <span>
              <i>↗</i> Miglior Prezzo Garantito
            </span>
          </div>
        </section>



      <footer id="contatti" className="footer">
        <section className="footer-main">
          <div className="footer-grid">
            <div className="footer-col">
              <div className="footer-brand">
                <span className="footer-brand-icon">TT</span>
                <strong>RomeInOut</strong>
              </div>
              <p>
                Scopri Roma in modo unico e indimenticabile con i nostri tour in tuk tuk. Esperienza,
                professionalita e passione.
              </p>
              <div className="footer-social" aria-label="Social links">
                <a href="#home" aria-label="Facebook">
                  Fb
                </a>
                <a href="#home" aria-label="Instagram">
                  Ig
                </a>
                <a href="#home" aria-label="Twitter">
                  Tw
                </a>
                <a href="#home" aria-label="YouTube">
                  Yt
                </a>
              </div>
            </div>

            <div className="footer-col">
              <h4>Link Veloci</h4>
              <ul>
                <li>Tour Classico</li>
                <li>Tour Panoramico</li>
                <li>Tour Completo</li>
                <li>Galleria</li>
                <li>Contatti</li>
              </ul>
            </div>

            <div className="footer-col">
              <h4>Contatti</h4>
              <ul>
                <li>Via Cavour 134</li>
                <li>00184 Roma, Italia</li>
                <li>+39 375 605 1114</li>
                <li>info@tuktukroma.it</li>
              </ul>
            </div>

            <div className="footer-col">
              <h4>Orari di Apertura</h4>
              <ul className="hours">
                <li>
                  <span>Lun - Ven</span>
                  <strong>07:00 - 23:00</strong>
                </li>
                <li>
                  <span>Sabato</span>
                  <strong>07:00 - 23:00</strong>
                </li>
                <li>
                  <span>Domenica</span>
                  <strong>07:00 - 23:00</strong>
                </li>
              </ul>
             
            </div>
          </div>

          <div className="footer-bottom">
            <p>{"\u00A9"} 2026 Tuk Tuk Roma Tours. Tutti i diritti riservati.</p>
            <div className="footer-links">
              <a href="#home">Privacy Policy</a>
              <a href="#home">Termini e Condizioni</a>
              <a href="#home">Cookie Policy</a>
            </div>
          </div>
        </section>
      </footer>
    </div>
  );
}

export default App;


  

import React, { useEffect, useMemo, useState } from 'react';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import './App.css';

const heroRomeImages = [
  'https://images.unsplash.com/photo-1552832230-c0197dd311b5?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1525874684015-58379d421a52?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1529260830199-42c24126f198?auto=format&fit=crop&w=900&q=80',
  'https://images.unsplash.com/photo-1529154036614-a60975f5c760?auto=format&fit=crop&w=900&q=80',
];

const tours = [
  {
    id: 'classico',
    title: 'Tour Classico',
    price: 89,
    duration: '3 ore',
    capacity: '1-4 persone',
    rating: 4.9,
    description: 'Esplora i monumenti più iconici di Roma',
    stops: ['Colosseo', 'Foro Romano', 'Palatino'],
    image:
      'https://images.unsplash.com/photo-1552832230-c0197dd311b5?auto=format&fit=crop&w=1200&q=80',
  },
  {
    id: 'panoramico',
    title: 'Tour Panoramico',
    price: 79,
    duration: '2.5 ore',
    capacity: '1-4 persone',
    rating: 4.8,
    description: 'Vista mozzafiato dei luoghi più belli',
    stops: ['Fontana di Trevi', 'Piazza di Spagna', 'Pantheon'],
    image:
      'https://images.unsplash.com/photo-1531572753322-ad063cecc140?auto=format&fit=crop&w=1200&q=80',
  },
  {
    id: 'completo',
    title: 'Tour Completo',
    price: 149,
    duration: '5 ore',
    capacity: '1-4 persone',
    rating: 5.0,
    popular: true,
    description: "L'esperienza definitiva della città eterna",
    stops: ['Vaticano', 'Colosseo', 'Centro Storico', 'Trastevere'],
    image:
      'https://images.unsplash.com/photo-1529260830199-42c24126f198?auto=format&fit=crop&w=1200&q=80',
  },
];

const availableTimes = ['09:00', '10:00', '11:00', '12:00', '14:00', '15:00', '16:00', '17:00'];
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
      {tour.popular ? <span className="popular-badge">PIÙ POPOLARE</span> : null}
      <div className="tour-image-wrap">
        <img src={tour.image} alt={tour.title} />
        <span className="tour-rating">
          <span className="rating-star">★</span>
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
            <i>◷</i> {tour.duration}
          </span>
          <span>
            <i>👥</i> {tour.capacity}
          </span>
        </div>

        <div className="tour-divider" />

        <div className="tour-footer-row">
          <div>
            <small>A partire da</small>
            <strong>€{tour.price}</strong>
          </div>
          <button type="button" onClick={() => onBook(tour.id)}>
            Prenota <span>→</span>
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
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [note, setNote] = useState('');
  const [currentStep, setCurrentStep] = useState(1);

  const selectedTour = useMemo(() => tours.find((tour) => tour.id === tourId), [tourId]);

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

  const bookingReady = Boolean(date && timeSlot && tourId);
  const customerReady = Boolean(name.trim() && email.trim() && phone.trim());

  const bookingPayload = {
    tourId,
    tourName: selectedTour?.title || '',
    date: date.toISOString().split('T')[0],
    time: timeSlot,
    people,
    customer: { name, email, phone, note },
    amount: selectedTour?.price || 0,
    currency: 'EUR',
  };

  const goToDetails = () => {
    if (!bookingReady) {
      window.alert('Seleziona data, orario e tour prima di continuare.');
      return;
    }
    setCurrentStep(2);
  };

  const startPaypalCheckout = () => {
    if (!bookingReady) {
      window.alert('Completa prima i dettagli della prenotazione.');
      return;
    }

    setCurrentStep(3);

    // Placeholder pronto per integrazione PayPal SDK / backend create-order endpoint
    console.log('PAYPAL_CHECKOUT_PAYLOAD', bookingPayload);
    window.alert('Placeholder PayPal: collega qui il bottone PayPal e la creazione ordine.');
  };

  const submitBooking = () => {
    if (!bookingReady || !customerReady) {
      window.alert('Completa tutti i campi obbligatori prima dell\'invio.');
      return;
    }

    setCurrentStep(4);

    // Placeholder pronto per invio prenotazione a backend (email, CRM o DB)
    console.log('BOOKING_SUBMIT_PAYLOAD', bookingPayload);
    window.alert('Prenotazione inviata (demo). Collega qui la tua API di invio.');
  };

  return (
    <div className="page">
      <header className={`topbar ${isScrolled ? 'scrolled' : ''}`}>
        <div className="topbar-head">
          <div className="brand">
            <span className="brand-icon">R</span>
            <div>
              <strong>Roma TukTuk</strong>
              <small>Tours</small>
            </div>
          </div>
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
        </div>
        <nav className={`top-nav ${menuOpen ? 'open' : ''}`}>
          <a href="#tour" onClick={() => setMenuOpen(false)}>
            Tour
          </a>
          <a href="#prenota" onClick={() => setMenuOpen(false)}>
            Prenota
          </a>
          <a href="#contatti" onClick={() => setMenuOpen(false)}>
            Contatti
          </a>
          <a href="#prenota" className="cta-small" onClick={() => setMenuOpen(false)}>
            Prenota Ora
          </a>
        </nav>
      </header>

      <section className="hero" id="home">
        <div className="hero-overlay" />
        <div className="hero-content hero-layout">
          <div className="hero-media-grid" aria-label="Foto di Roma">
            {heroRomeImages.map((image, index) => (
              <figure key={image} className={`hero-media-card hero-media-card-${index + 1}`}>
                <img src={image} alt={`Roma scorcio ${index + 1}`} />
              </figure>
            ))}
          </div>
          <div className="hero-copy">
            <p className="rating">Tour privati nel centro storico</p>
            <h1>Roma Golf cart \u00E8 il nuovo tour a Roma con golf cart o tuk tuk</h1>
            <p>
              Scegli il tuo itinerario e vivi la citta in modo comodo, panoramico e senza stress.
            </p>
            <a href="#prenota" className="hero-cta">
              Prenota il tuo tour
            </a>
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
              onBook={(id) => {
                setTourId(id);
                setCurrentStep(1);
                document.getElementById('prenota')?.scrollIntoView({ behavior: 'smooth' });
              }}
            />
          ))}
        </div>
      </section>

      <section className="booking" id="prenota">
        <h2>Prenota il tuo tour</h2>
        <p>Scegli data, orario e tour. Pagamento PayPal pronto da integrare.</p>

        <ol className="steps">
          <li className={currentStep >= 1 ? 'active' : ''}>Scegli</li>
          <li className={currentStep >= 2 ? 'active' : ''}>Dati</li>
          <li className={currentStep >= 3 ? 'active' : ''}>Paga</li>
          <li className={currentStep >= 4 ? 'active' : ''}>Confermato</li>
        </ol>

        <div className="booking-panel">
          <div className="panel-left">
            <h3>Seleziona una data</h3>
            <Calendar
              locale="it-IT"
              onChange={setDate}
              value={date}
              minDate={todayStart}
              className="custom-calendar"
              formatShortWeekday={(_, dateValue) =>
                dateValue.toLocaleDateString('it-IT', { weekday: 'short' }).slice(0, 2)
              }
            />
          </div>

          <div className="panel-right">
            <h3>Seleziona un orario</h3>
            <div className="time-grid">
              {availableTimes.map((time) => (
                <button
                  type="button"
                  key={time}
                  className={timeSlot === time ? 'slot active' : 'slot'}
                  onClick={() => setTimeSlot(time)}
                >
                  {time}
                </button>
              ))}
            </div>

            <label>
              Scegli il tour
              <select value={tourId} onChange={(event) => setTourId(event.target.value)}>
                <option value="">Seleziona un tour</option>
                {tours.map((tour) => (
                  <option key={tour.id} value={tour.id}>
                    {tour.title} - EUR {tour.price}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Numero di persone
              <select value={people} onChange={(event) => setPeople(event.target.value)}>
                <option value="1">1 persona</option>
                <option value="2">2 persone</option>
                <option value="3">3 persone</option>
                <option value="4">4 persone</option>
              </select>
            </label>

            <button type="button" className="continue-btn" onClick={goToDetails}>
              Continua
            </button>
          </div>
        </div>

        <div className="details-grid">
          <form
            className="customer-form"
            onSubmit={(event) => {
              event.preventDefault();
              submitBooking();
            }}
          >
            <h3>Dati cliente</h3>
            <label>
              Nome e cognome
              <input value={name} onChange={(event) => setName(event.target.value)} required />
            </label>
            <label>
              Email
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </label>
            <label>
              Telefono
              <input value={phone} onChange={(event) => setPhone(event.target.value)} required />
            </label>
            <label>
              Note (opzionale)
              <textarea value={note} onChange={(event) => setNote(event.target.value)} rows="3" />
            </label>

            <div className="actions">
              <button type="button" className="paypal-btn" onClick={startPaypalCheckout}>
                Paga con PayPal (placeholder)
              </button>
              <button type="submit" className="send-btn">
                Invia prenotazione
              </button>
            </div>
          </form>

          <aside className="summary">
            <h3>Riepilogo</h3>
            <p>
              <strong>Data:</strong>{' '}
              {date.toLocaleDateString('it-IT', {
                day: '2-digit',
                month: 'long',
                year: 'numeric',
              })}
            </p>
            <p>
              <strong>Orario:</strong> {timeSlot || '-'}
            </p>
            <p>
              <strong>Tour:</strong> {selectedTour?.title || '-'}
            </p>
            <p>
              <strong>Persone:</strong> {people}
            </p>
            <p>
              <strong>Totale:</strong> EUR {selectedTour ? selectedTour.price * Number(people) : 0}
            </p>
            <small>
              Stato: {bookingReady ? 'configurazione completa' : 'mancano data/orario/tour'}
            </small>
          </aside>
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

      <footer id="contatti" className="footer">
        <section className="footer-cta">
          <div className="footer-cta-icon" aria-hidden="true">
            📅
          </div>
          <h2>Pronto a Vivere Roma?</h2>
          <p className="footer-cta-lead">
            Prenota ora il tuo tour in tuk tuk e scopri la magia della citta eterna in un modo
            completamente nuovo
          </p>

          <div className="footer-cta-actions">
            <a href="#prenota" className="footer-cta-primary">
              <span className="cta-btn-icon" aria-hidden="true">
                📅
              </span>
              <span>Prenota il Tuo Tour</span>
              <span className="cta-btn-arrow" aria-hidden="true">
                →
              </span>
            </a>
            <a href="tel:+390612345678" className="footer-cta-secondary">
              <span className="cta-btn-icon" aria-hidden="true">
                📞
              </span>
              <span>Chiamaci Ora</span>
            </a>
          </div>

          <div className="footer-cta-contacts">
            <p className="footer-cta-phone">
              <span>Telefono</span>
              <strong>+39 06 1234 5678</strong>
            </p>
            <p className="footer-cta-mail">
              <span>Email</span>
              <strong>info@tuktukroma.it</strong>
            </p>
          </div>
        </section>

        <section className="footer-main">
          <div className="footer-grid">
            <div className="footer-col">
              <div className="footer-brand">
                <span className="footer-brand-icon">TT</span>
                <strong>Tuk Tuk Roma</strong>
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
                <li>Via del Colosseo, 1</li>
                <li>00184 Roma, Italia</li>
                <li>+39 06 1234 5678</li>
                <li>info@tuktukroma.it</li>
              </ul>
            </div>

            <div className="footer-col">
              <h4>Orari di Apertura</h4>
              <ul className="hours">
                <li>
                  <span>Lun - Ven</span>
                  <strong>09:00 - 20:00</strong>
                </li>
                <li>
                  <span>Sabato</span>
                  <strong>09:00 - 22:00</strong>
                </li>
                <li>
                  <span>Domenica</span>
                  <strong>10:00 - 20:00</strong>
                </li>
              </ul>
              <p className="footer-offer">Offerta Speciale: Prenota oggi e ricevi il 15% di sconto!</p>
            </div>
          </div>

          <div className="footer-bottom">
            <p>© 2026 Tuk Tuk Roma Tours. Tutti i diritti riservati.</p>
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

import React, { useEffect, useState } from 'react';
import { Trash2 } from 'lucide-react';
import Badge from './Badge';

function formatDate(dateValue) {
  const date = new Date(`${dateValue}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    return dateValue;
  }
  return date.toISOString().slice(0, 10);
}

function formatTime(slot) {
  const start = String(slot || '').split('-')[0]?.trim();
  if (!start) {
    return slot;
  }
  const [hourRaw, minuteRaw] = start.split(':');
  const hour = Number(hourRaw);
  const minute = Number(minuteRaw);
  if (!Number.isInteger(hour) || !Number.isInteger(minute)) {
    return slot;
  }
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

export default function AppointmentsTable({
  rows,
  page,
  pageSize,
  total,
  onPageChange,
  onDelete,
  deletingId,
}) {
  const [expandedRowId, setExpandedRowId] = useState(null);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const startIndex = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const endIndex = Math.min(page * pageSize, total);

  const pageButtons = [];
  for (let value = 1; value <= Math.min(totalPages, 3); value += 1) {
    pageButtons.push(value);
  }

  useEffect(() => {
    if (!rows.some((row) => row.id === expandedRowId)) {
      setExpandedRowId(null);
    }
  }, [expandedRowId, rows]);

  const toggleRowDetails = (rowId) => {
    setExpandedRowId((current) => (current === rowId ? null : rowId));
  };

  return (
    <div className="admin-table-wrap">
      <table className="admin-appointments-table">
        <thead>
          <tr>
            <th>ID Prenotazione</th>
            <th>Nome Cliente</th>
            <th>Tipo Tour</th>
            <th>Data</th>
            <th>Orario</th>
            <th>Ospiti</th>
            <th>Stato</th>
            <th>Pagamento</th>
            <th>Azioni</th>
          </tr>
        </thead>
        <tbody>
          {rows.length ? rows.map((row) => {
            const detailsOpen = expandedRowId === row.id;

            return (
              <React.Fragment key={row.id}>
                <tr
                  className={`admin-data-row ${detailsOpen ? 'expanded' : ''}`}
                  onClick={() => toggleRowDetails(row.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      toggleRowDetails(row.id);
                    }
                  }}
                  aria-expanded={detailsOpen}
                >
                  <td>{row.bookingCode}</td>
                  <td>{row.customerName}</td>
                  <td>{row.tourType}</td>
                  <td>{formatDate(row.date)}</td>
                  <td>{formatTime(row.time)}</td>
                  <td>{row.guests}</td>
                  <td><Badge kind="status" value={row.status} /></td>
                  <td><Badge kind="payment" value={row.paymentStatus} /></td>
                  <td>
                    <div className="admin-actions-cell">
                      <button
                        type="button"
                        aria-label="Elimina prenotazione"
                        onClick={(event) => {
                          event.stopPropagation();
                          onDelete?.(row.id);
                        }}
                        disabled={deletingId === row.id}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
                <tr className={`admin-row-details ${detailsOpen ? 'open' : ''}`} aria-hidden={!detailsOpen}>
                  <td colSpan={9}>
                    <div className={`admin-row-details-inner ${detailsOpen ? 'bounce-in' : ''}`}>
                      <div className="admin-row-contact-grid">
                        <div className="admin-row-contact-card">
                          <small>Telefono</small>
                          <strong>{row.customerPhone || 'N/D'}</strong>
                        </div>
                        <div className="admin-row-contact-card">
                          <small>Email</small>
                          {row.customerEmail ? (
                            <a href={`mailto:${row.customerEmail}`}>{row.customerEmail}</a>
                          ) : (
                            <strong>N/D</strong>
                          )}
                        </div>
                      </div>
                    </div>
                  </td>
                </tr>
              </React.Fragment>
            );
          }) : (
            <tr>
              <td colSpan={9} className="admin-empty-cell">Nessuna prenotazione trovata.</td>
            </tr>
          )}
        </tbody>
      </table>

      <div className="admin-table-footer">
        <small>Visualizzati {startIndex}-{endIndex} di {total} risultati</small>
        <div className="admin-pagination">
          <button type="button" onClick={() => onPageChange(Math.max(1, page - 1))} disabled={page <= 1}>Precedente</button>
          {pageButtons.map((value) => (
            <button
              key={value}
              type="button"
              className={value === page ? 'active' : ''}
              onClick={() => onPageChange(value)}
            >
              {value}
            </button>
          ))}
          <button type="button" onClick={() => onPageChange(Math.min(totalPages, page + 1))} disabled={page >= totalPages}>Successiva</button>
        </div>
      </div>
    </div>
  );
}

import React from 'react';

function normalize(value) {
  return String(value || '').trim().toLowerCase();
}

const labelByValue = {
  confirmed: 'Confermata',
  pending: 'In attesa',
  cancelled: 'Annullata',
  paid: 'Pagato',
  refunded: 'Rimborsato',
};

export default function Badge({ kind = 'status', value }) {
  const normalized = normalize(value);
  const className = `admin-badge ${kind === 'payment' ? 'payment' : 'status'} ${normalized}`;
  return <span className={className}>{labelByValue[normalized] || value}</span>;
}

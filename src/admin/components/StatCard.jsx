import React from 'react';

export default function StatCard({ title, value, badgeText, icon: Icon, variant }) {
  return (
    <article className={`admin-stat-card ${variant}`}>
      <div className="admin-stat-icon-wrap">
        <div className="admin-stat-icon-bg">{Icon ? <Icon size={20} strokeWidth={2.3} /> : null}</div>
      </div>
      <span className="admin-stat-badge">{badgeText}</span>
      <h4>{title}</h4>
      <strong>{value}</strong>
      <span className="admin-stat-orb admin-stat-orb-right" aria-hidden="true" />
      <span className="admin-stat-orb admin-stat-orb-left" aria-hidden="true" />
    </article>
  );
}

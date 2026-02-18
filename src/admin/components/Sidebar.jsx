import React from 'react';
import { LifeBuoy, LogOut, MapPin, X } from 'lucide-react';

export default function Sidebar({
  items,
  activeItem,
  onSelect,
  open,
  onClose,
  onLogout,
}) {
  return (
    <>
      <aside className={`admin-sidebar ${open ? 'open' : ''}`}>
        <div className="admin-sidebar-head">
          <div className="admin-logo-wrap">
            <span className="admin-logo-pin"><MapPin size={17} /></span>
            <div>
              <strong>Hydra</strong>
              <small>Dashboard</small>
            </div>
          </div>
          <button type="button" className="admin-sidebar-close" onClick={onClose} aria-label="Chiudi menu">
            <X size={18} />
          </button>
        </div>

        <nav className="admin-sidebar-nav" aria-label="Navigazione admin">
          {items.map((item) => {
            const Icon = item.icon;
            const active = activeItem === item.key;
            return (
              <button
                key={item.key}
                type="button"
                className={`admin-nav-item ${active ? 'active' : ''}`}
                onClick={() => onSelect(item.key)}
              >
                <Icon size={17} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="admin-sidebar-bottom">
          <button type="button" className="admin-nav-item admin-logout" onClick={onLogout}>
            <LogOut size={17} />
            <span>Esci</span>
          </button>

          <div className="admin-support-card">
            <small>Hai bisogno di aiuto?</small>
            <a
              className="admin-support-link"
              href="https://wa.me/393421872127"
              target="_blank"
              rel="noreferrer"
            >
              <LifeBuoy size={15} /> Centro supporto ->
            </a>
          </div>
        </div>
      </aside>

      {open ? <button type="button" className="admin-sidebar-overlay" onClick={onClose} aria-label="Chiudi sidebar" /> : null}
    </>
  );
}

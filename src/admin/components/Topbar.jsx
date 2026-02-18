import React, { useState } from 'react';
import { Bell, Menu, Search } from 'lucide-react';

export default function Topbar({
  searchValue,
  onSearchChange,
  onMenuClick,
  adminEmail,
}) {
  const [showBellMessage, setShowBellMessage] = useState(false);

  return (
    <header className="admin-topbar">
      <button type="button" className="admin-mobile-menu" onClick={onMenuClick} aria-label="Apri menu admin">
        <Menu size={22} />
      </button>

      <label className="admin-search-wrap" htmlFor="admin-search">
        <Search size={18} />
        <input
          id="admin-search"
          type="search"
          placeholder="Cerca prenotazioni, clienti, tour..."
          value={searchValue}
          onChange={(event) => onSearchChange(event.target.value)}
        />
      </label>

      <div className="admin-topbar-right">
        <div className="admin-bell-wrap">
          <button
            type="button"
            className="admin-bell-btn"
            aria-label="Notifiche"
            aria-expanded={showBellMessage}
            onClick={() => setShowBellMessage((current) => !current)}
          >
            <Bell size={18} />
            <span className="admin-bell-dot" />
          </button>
          {showBellMessage ? (
            <div className="admin-bell-message" role="status" aria-live="polite">
              non so che mettece
            </div>
          ) : null}
        </div>

        <div className="admin-user-chip">
          <div className="admin-user-meta">
            <small>Utente Admin</small>
            <strong>{adminEmail || 'admin@tuktukroma.com'}</strong>
          </div>
          <span className="admin-avatar">AU</span>
        </div>
      </div>
    </header>
  );
}

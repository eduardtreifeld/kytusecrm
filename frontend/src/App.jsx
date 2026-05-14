import { useState, useEffect } from 'react';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import NewCall from './pages/NewCall';
import NewActivity from './pages/NewActivity';
import Calendar from './pages/Calendar';
import './index.css';

export default function App() {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('crm_user')); } catch { return null; }
  });
  const [tab, setTab] = useState('dashboard');
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('crm_theme') === 'dark');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light');
    localStorage.setItem('crm_theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

  function handleLogin(u) { setUser(u); setTab('dashboard'); }
  function handleLogout() { localStorage.removeItem('crm_token'); localStorage.removeItem('crm_user'); setUser(null); }
  function handleSaved() { setTab('dashboard'); }

  if (!user) return <div className="app"><Login onLogin={handleLogin} /></div>;

  return (
    <div className="app">
      <div className="nav">
        <div className="nav-logo">
          <img src="/logo.png" alt="Terminal" style={{ height: 28, width: 28, objectFit: 'contain', filter: 'brightness(0) invert(1)' }} />
          TERMINAL CRM
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span className="nav-user">{user.full_name}</span>
          <button className="btn btn-sm" style={{ fontSize: 16, padding: '5px 10px', background: 'transparent', border: '1px solid rgba(255,255,255,0.2)', color: '#fff' }}
            onClick={() => setDarkMode(d => !d)} title={darkMode ? 'Hele teema' : 'Tume teema'}>
            {darkMode ? '☀️' : '🌙'}
          </button>
          <button className="btn btn-sm" style={{ color: '#fff', background: 'transparent', border: '1px solid rgba(255,255,255,0.2)' }} onClick={handleLogout}>Välju</button>
        </div>
      </div>

      {tab !== 'new-call' && tab !== 'new-activity' && (
        <div className="tabs">
          <div className={`tab${tab === 'dashboard' ? ' active' : ''}`} onClick={() => setTab('dashboard')}>Avaleht</div>
          <div className={`tab${tab === 'new-call' ? ' active' : ''}`} onClick={() => setTab('new-call')}>+ Uus kõne</div>
          <div className={`tab${tab === 'new-activity' ? ' active' : ''}`} onClick={() => setTab('new-activity')}>+ Uus tegevus</div>
          <div className={`tab${tab === 'calendar' ? ' active' : ''}`} onClick={() => setTab('calendar')}>Kalender</div>
        </div>
      )}

      {tab === 'dashboard' && <Dashboard onNewCall={() => setTab('new-call')} onNewActivity={() => setTab('new-activity')} />}
      {tab === 'new-call' && <NewCall onSaved={handleSaved} onCancel={() => setTab('dashboard')} />}
      {tab === 'new-activity' && <NewActivity onSaved={handleSaved} onCancel={() => setTab('dashboard')} />}
      {tab === 'calendar' && <Calendar />}
    </div>
  );
}

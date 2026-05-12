import { useState, useEffect } from 'react';
import { api } from '../services/api';

function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('et-EE') + ' ' + d.toLocaleTimeString('et-EE', { hour: '2-digit', minute: '2-digit' });
}

function statusBadge(status, followup) {
  if (followup) return <span className="badge badge-amber">Järelkõne</span>;
  if (status === 'deal') return <span className="badge badge-green">Leping</span>;
  return <span className="badge badge-blue">Logitud</span>;
}

export default function Dashboard({ onNewCall }) {
  const [calls, setCalls] = useState([]);
  const [stats, setStats] = useState({ calls_today: 0, followups: 0, firms: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.getCalls(), api.getStats()]).then(([c, s]) => {
      setCalls(c || []);
      setStats(s || {});
      setLoading(false);
    });
  }, []);

  if (loading) return <div className="empty"><span className="spinner" /> Laadin...</div>;

  return (
    <div className="section">
      <div className="stats">
        <div className="stat"><div className="stat-n">{stats.calls_today}</div><div className="stat-l">Kõnet täna</div></div>
        <div className="stat"><div className="stat-n">{stats.followups}</div><div className="stat-l">Järeltegevust</div></div>
        <div className="stat"><div className="stat-n">{stats.firms}</div><div className="stat-l">Firmat</div></div>
      </div>

      <div className="section-title">
        Viimased tegevused
        <button className="btn btn-sm btn-primary" onClick={onNewCall}>+ Uus kõne</button>
      </div>

      {calls.length === 0 ? (
        <div className="empty">
          <div style={{ fontSize: 32, marginBottom: 8 }}>📞</div>
          Ühtegi kõnet pole veel logitud.<br />
          <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={onNewCall}>Lisa esimene kõne</button>
        </div>
      ) : (
        <div className="card" style={{ padding: '4px 12px' }}>
          {calls.map(call => (
            <div className="activity" key={call.id}>
              <div className="avatar">{(call.company_name || 'F').substring(0, 2).toUpperCase()}</div>
              <div className="activity-body">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div className="activity-firm">{call.legal_name || call.company_name}</div>
                  {statusBadge(call.status, call.followup_date)}
                </div>
                <div className="activity-meta">{call.contact_name} · {formatDate(call.call_date)}</div>
                <div className="activity-comment">{call.comment}</div>
                {call.followup_date && (
                  <div className="followup-tag">
                    📅 Järelkõne: {new Date(call.followup_date).toLocaleDateString('et-EE')}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

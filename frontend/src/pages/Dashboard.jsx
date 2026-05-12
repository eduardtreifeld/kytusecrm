import { useState, useEffect } from 'react';
import { api } from '../services/api';

function formatDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('et-EE');
}

function formatDateTime(iso) {
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
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, minWidth: 700 }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #e8e8e8', textAlign: 'left' }}>
                <th style={{ padding: '8px 10px', color: '#888', fontWeight: 500 }}>Viimane kontakt</th>
                <th style={{ padding: '8px 10px', color: '#888', fontWeight: 500 }}>Järelkõne</th>
                <th style={{ padding: '8px 10px', color: '#888', fontWeight: 500 }}>Firma</th>
                <th style={{ padding: '8px 10px', color: '#888', fontWeight: 500 }}>Reg. kood</th>
                <th style={{ padding: '8px 10px', color: '#888', fontWeight: 500 }}>Maakond</th>
                <th style={{ padding: '8px 10px', color: '#888', fontWeight: 500 }}>Kontakt</th>
                <th style={{ padding: '8px 10px', color: '#888', fontWeight: 500 }}>Kommentaar</th>
                <th style={{ padding: '8px 10px', color: '#888', fontWeight: 500 }}>Staatus</th>
              </tr>
            </thead>
            <tbody>
              {calls.map(call => (
                <tr key={call.id} style={{ borderBottom: '1px solid #f0f0f0' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#f9f9f9'}
                  onMouseLeave={e => e.currentTarget.style.background = ''}
                >
                  <td style={{ padding: '10px', whiteSpace: 'nowrap' }}>{formatDate(call.call_date)}</td>
                  <td style={{ padding: '10px', whiteSpace: 'nowrap', color: call.followup_date ? '#856404' : '#888' }}>
                    {call.followup_date ? formatDate(call.followup_date) : '—'}
                  </td>
                  <td style={{ padding: '10px', fontWeight: 600, whiteSpace: 'nowrap' }}>
                    {call.legal_name || call.company_name || '—'}
                  </td>
                  <td style={{ padding: '10px', whiteSpace: 'nowrap', color: '#888' }}>
                    {call.reg_number || '—'}
                  </td>
                  <td style={{ padding: '10px', whiteSpace: 'nowrap' }}>
                    {call.address ? call.address.split(',')[0] : '—'}
                  </td>
                  <td style={{ padding: '10px', whiteSpace: 'nowrap' }}>
                    <div>{call.contact_name}</div>
                    <div style={{ color: '#888' }}>{call.contact_phone}</div>
                  </td>
                  <td style={{ padding: '10px', maxWidth: 250 }}>
                    <div style={{ overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                      {call.comment}
                    </div>
                  </td>
                  <td style={{ padding: '10px' }}>
                    {statusBadge(call.status, call.followup_date)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

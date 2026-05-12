import { useState, useEffect } from 'react';
import { api } from '../services/api';

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('et-EE');
}

function statusBadge(status, followup) {
  if (followup) return <span className="badge badge-amber">Järelkõne</span>;
  if (status === 'deal') return <span className="badge badge-green">Leping</span>;
  return <span className="badge badge-blue">Logitud</span>;
}

function EditModal({ call, onClose, onSaved, onDeleted }) {
  const [comment, setComment] = useState(call.comment || '');
  const [followupDate, setFollowupDate] = useState(
    call.followup_date ? call.followup_date.split('T')[0] : ''
  );
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      await fetch(`/api/calls/${call.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('crm_token')}`
        },
        body: JSON.stringify({ comment, followup_date: followupDate || null })
      });
      onSaved();
    } catch (e) {
      alert('Salvestamine ebaõnnestus');
    }
    setSaving(false);
  }

  async function handleDelete() {
    if (!confirm('Oled kindel et soovid selle kõne kustutada?')) return;
    setDeleting(true);
    try {
      await fetch(`/api/calls/${call.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('crm_token')}` }
      });
      onDeleted();
    } catch (e) {
      alert('Kustutamine ebaõnnestus');
    }
    setDeleting(false);
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-title">
          <span>{call.legal_name || call.company_name}</span>
          <button className="btn btn-sm" onClick={onClose}>✕</button>
        </div>

        <div style={{ background: '#f5f4f0', borderRadius: 8, padding: '12px 14px', marginBottom: 16, fontSize: 13 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 16px' }}>
            <div><span style={{ color: '#888' }}>Kontakt: </span>{call.contact_name}</div>
            <div><span style={{ color: '#888' }}>Tel: </span>{call.contact_phone}</div>
            <div><span style={{ color: '#888' }}>Reg. kood: </span>{call.reg_number || '—'}</div>
            <div><span style={{ color: '#888' }}>Kõne: </span>{formatDate(call.call_date)}</div>
            <div style={{ gridColumn: '1/-1' }}><span style={{ color: '#888' }}>Aadress: </span>{call.address || '—'}</div>
          </div>
        </div>

        <div className="field">
          <label>Kommentaar</label>
          <textarea value={comment} onChange={e => setComment(e.target.value)} rows={5} />
        </div>

        <div className="field">
          <label>Järelkõne kuupäev</label>
          <input type="date" value={followupDate} onChange={e => setFollowupDate(e.target.value)} />
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <button className="btn btn-danger" onClick={handleDelete} disabled={deleting}>
            {deleting ? '...' : '🗑 Kustuta'}
          </button>
          <div style={{ flex: 1 }} />
          <button className="btn" onClick={onClose}>Tühista</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Salvestab...' : '💾 Salvesta'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Dashboard({ onNewCall }) {
  const [calls, setCalls] = useState([]);
  const [stats, setStats] = useState({ calls_today: 0, followups: 0, firms: 0 });
  const [loading, setLoading] = useState(true);
  const [selectedCall, setSelectedCall] = useState(null);

  function loadData() {
    Promise.all([api.getCalls(), api.getStats()]).then(([c, s]) => {
      setCalls(c || []);
      setStats(s || {});
      setLoading(false);
    });
  }

  useEffect(() => { loadData(); }, []);

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
          Ühtegi kõnet pole veel logitud.
          <br />
          <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={onNewCall}>Lisa esimene kõne</button>
        </div>
      ) : (
        <div style={{ overflowX: 'auto', borderRadius: 10, border: '1px solid #e8e8e8' }}>
          <table className="calls-table">
            <thead>
              <tr>
                <th>Viimane kontakt</th>
                <th>Järelkõne</th>
                <th>Firma</th>
                <th>Reg. kood</th>
                <th>Maakond / Aadress</th>
                <th>Kontakt</th>
                <th>Kommentaar</th>
                <th>Staatus</th>
              </tr>
            </thead>
            <tbody>
              {calls.map(call => (
                <tr key={call.id} onClick={() => setSelectedCall(call)}>
                  <td className="nowrap">{formatDate(call.call_date)}</td>
                  <td className="nowrap" style={{ color: call.followup_date ? '#856404' : '#ccc' }}>
                    {formatDate(call.followup_date)}
                  </td>
                  <td style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{call.legal_name || call.company_name || '—'}</td>
                  <td className="nowrap" style={{ color: '#888' }}>{call.reg_number || '—'}</td>
                  <td style={{ maxWidth: 160, fontSize: 12, color: '#555' }}>
                    {call.address ? call.address.split(',').slice(0, 2).join(',') : '—'}
                  </td>
                  <td className="nowrap">
                    <div>{call.contact_name}</div>
                    <div style={{ color: '#888', fontSize: 12 }}>{call.contact_phone}</div>
                  </td>
                  <td style={{ maxWidth: 220 }}>
                    <div style={{ overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', fontSize: 12 }}>
                      {call.comment}
                    </div>
                  </td>
                  <td>{statusBadge(call.status, call.followup_date)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selectedCall && (
        <EditModal
          call={selectedCall}
          onClose={() => setSelectedCall(null)}
          onSaved={() => { setSelectedCall(null); loadData(); }}
          onDeleted={() => { setSelectedCall(null); loadData(); }}
        />
      )}
    </div>
  );
}

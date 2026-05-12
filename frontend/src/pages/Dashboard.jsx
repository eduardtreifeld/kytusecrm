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

function creditColor(score) {
  if (!score) return '#888';
  if (score >= 70) return '#1e7e34';
  if (score >= 40) return '#856404';
  return '#991b1b';
}

function creditBg(score) {
  if (!score) return '#f5f5f5';
  if (score >= 70) return '#e6f4ea';
  if (score >= 40) return '#fff3cd';
  return '#fee2e2';
}

function CreditCell({ call, onCreditDone }) {
  const [loading, setLoading] = useState(false);

  async function checkCredit(e) {
    e.stopPropagation();
    if (!call.company_id) return alert('Firma ID puudub');
    setLoading(true);
    try {
      await fetch(`/api/companies/credit/${call.company_id}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('crm_token')}` }
      });
      onCreditDone();
    } catch (err) {
      alert('Krediidikontroll ebaõnnestus');
    }
    setLoading(false);
  }

  if (call.credit_score) {
    return (
      <div
        style={{
          background: creditBg(call.credit_score),
          color: creditColor(call.credit_score),
          borderRadius: 6, padding: '4px 8px', fontSize: 11,
          fontWeight: 600, whiteSpace: 'nowrap', cursor: 'pointer'
        }}
        title={call.credit_summary}
        onClick={e => { e.stopPropagation(); }}
      >
        {call.credit_score}/100<br />
        <span style={{ fontWeight: 400 }}>€{call.credit_limit?.toLocaleString()} · {call.credit_days}p</span>
      </div>
    );
  }

  return (
    <button
      className="btn btn-sm"
      style={{ fontSize: 11, padding: '4px 8px', whiteSpace: 'nowrap' }}
      onClick={checkCredit}
      disabled={loading}
    >
      {loading ? <span className="spinner" /> : '🔍 Kontrolli'}
    </button>
  );
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
    } catch (e) { alert('Salvestamine ebaõnnestus'); }
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
    } catch (e) { alert('Kustutamine ebaõnnestus'); }
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
          {call.credit_score && (
            <div style={{ marginTop: 10, padding: '8px 10px', background: creditBg(call.credit_score), borderRadius: 6 }}>
              <strong style={{ color: creditColor(call.credit_score) }}>Krediidiskoor: {call.credit_score}/100</strong>
              <span style={{ color: '#555', marginLeft: 12 }}>Limiit: €{call.credit_limit?.toLocaleString()} · {call.credit_days} päeva</span>
              <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>{call.credit_summary}</div>
            </div>
          )}
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
                <th>Aadress</th>
                <th>Kontakt</th>
                <th>Krediit</th>
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
                  <td style={{ maxWidth: 150, fontSize: 12, color: '#555' }}>
                    {call.address ? call.address.split(',').slice(0, 2).join(',') : '—'}
                  </td>
                  <td className="nowrap">
                    <div>{call.contact_name}</div>
                    <div style={{ color: '#888', fontSize: 12 }}>{call.contact_phone}</div>
                  </td>
                  <td onClick={e => e.stopPropagation()}>
                    <CreditCell call={call} onCreditDone={loadData} />
                  </td>
                  <td style={{ maxWidth: 200 }}>
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

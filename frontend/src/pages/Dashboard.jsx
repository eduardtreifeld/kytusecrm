import { useState, useEffect, useRef } from 'react';
import { api } from '../services/api';

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('et-EE');
}

function formatDateTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('et-EE') + ' ' + d.toLocaleTimeString('et-EE', { hour: '2-digit', minute: '2-digit' });
}

function statusBadge(status, followup) {
  if (followup) return <span className="badge badge-amber">Järelkõne</span>;
  if (status === 'deal') return <span className="badge badge-green">Leping</span>;
  return <span className="badge badge-blue">Logitud</span>;
}

function creditColor(score) {
  if (!score) return '#888';
  if (score >= 70) return '#007a38';
  if (score >= 40) return '#7a6000';
  return '#991b1b';
}

function creditBg(score) {
  if (!score) return '#f5f5f5';
  if (score >= 70) return '#e6f9ef';
  if (score >= 40) return '#fff9cc';
  return '#fee2e2';
}

function CreditCell({ call, onCreditDone }) {
  const [loading, setLoading] = useState(false);

  async function checkCredit(e) {
    e.stopPropagation();
    if (!call.company_id) return;
    setLoading(true);
    try {
      await api.checkCredit(call.company_id);
      onCreditDone();
    } catch (err) {
      alert('Krediidikontroll ebaõnnestus');
    }
    setLoading(false);
  }

  if (call.credit_score) {
    return (
      <div
        style={{ background: creditBg(call.credit_score), color: creditColor(call.credit_score), borderRadius: 4, padding: '4px 8px', fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap', cursor: 'default' }}
        title={call.credit_summary}
        onClick={e => e.stopPropagation()}
      >
        {call.credit_score}/100<br />
        <span style={{ fontWeight: 400 }}>€{call.credit_limit?.toLocaleString()} · {call.credit_days}p</span>
      </div>
    );
  }

  return (
    <button className="btn btn-sm" style={{ fontSize: 11, whiteSpace: 'nowrap' }} onClick={checkCredit} disabled={loading}>
      {loading ? <span className="spinner" /> : '🔍 Kontrolli'}
    </button>
  );
}

function CardOrderModal({ call, onClose, onSaved }) {
  const [cardType, setCardType] = useState(null);
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleSave() {
    if (!cardType || !comment.trim()) return;
    setSaving(true);
    try {
      await fetch(`/api/calls/${call.id}/card`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('crm_token')}`
        },
        body: JSON.stringify({ card_type: cardType, comment: `KAARDI TELLIMUS [${cardType}]: ${comment}` })
      });
      setSaved(true);
      setTimeout(() => { onSaved(); onClose(); }, 1500);
    } catch (e) {
      alert('Salvestamine ebaõnnestus');
    }
    setSaving(false);
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 480 }}>
        <div className="modal-title">
          <span>Telli kaart — {call.legal_name || call.company_name}</span>
          <button className="btn btn-sm" onClick={onClose}>✕</button>
        </div>

        {saved ? (
          <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--teal-dark)' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
            <div style={{ fontWeight: 700, fontSize: 16, textTransform: 'uppercase' }}>Kaardi tellimus salvestatud!</div>
          </div>
        ) : (
          <>
            <div style={{ fontSize: 12, color: '#888', marginBottom: 16 }}>Vali kaardi tüüp:</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
              <div
                onClick={() => setCardType('SOODUSKAART')}
                style={{
                  border: `2px solid ${cardType === 'SOODUSKAART' ? 'var(--teal-dark)' : 'var(--border)'}`,
                  borderRadius: 8, padding: '20px 12px', cursor: 'pointer', textAlign: 'center',
                  background: cardType === 'SOODUSKAART' ? 'var(--bg)' : 'var(--white)', transition: 'all 0.15s'
                }}
              >
                <div style={{ fontSize: 32, marginBottom: 8 }}>🎫</div>
                <div style={{ fontWeight: 700, fontSize: 13, color: cardType === 'SOODUSKAART' ? 'var(--teal-dark)' : 'var(--dark)', textTransform: 'uppercase' }}>Sooduskaart</div>
                <div style={{ fontSize: 11, color: '#888', marginTop: 4 }}>Allahindlused tanklates</div>
              </div>
              <div
                onClick={() => setCardType('MAKSEKAART')}
                style={{
                  border: `2px solid ${cardType === 'MAKSEKAART' ? 'var(--teal-dark)' : 'var(--border)'}`,
                  borderRadius: 8, padding: '20px 12px', cursor: 'pointer', textAlign: 'center',
                  background: cardType === 'MAKSEKAART' ? 'var(--bg)' : 'var(--white)', transition: 'all 0.15s'
                }}
              >
                <div style={{ fontSize: 32, marginBottom: 8 }}>💳</div>
                <div style={{ fontWeight: 700, fontSize: 13, color: cardType === 'MAKSEKAART' ? 'var(--teal-dark)' : 'var(--dark)', textTransform: 'uppercase' }}>Maksekaart</div>
                <div style={{ fontSize: 11, color: '#888', marginTop: 4 }}>Krediit ja arveldus</div>
              </div>
            </div>

            {cardType && (
              <>
                <div style={{ background: 'var(--bg)', borderRadius: 6, padding: '8px 12px', marginBottom: 14, fontSize: 12, color: 'var(--teal-dark)', fontWeight: 600 }}>
                  Valitud: {cardType === 'SOODUSKAART' ? '🎫 Sooduskaart' : '💳 Maksekaart'}
                </div>
                <div className="field">
                  <label>Kommentaar (kaartide arv, kontakt, lisainfo)</label>
                  <textarea
                    value={comment}
                    onChange={e => setComment(e.target.value)}
                    placeholder={cardType === 'SOODUSKAART' ? 'nt. 2 sooduskaarti, kontakt Mart Tamm...' : 'nt. 3 maksekaart, limiit 5000€...'}
                    rows={4}
                  />
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn" onClick={onClose}>Tühista</button>
                  <button className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }}
                    onClick={handleSave} disabled={saving || !comment.trim()}>
                    {saving ? <><span className="spinner" />Salvestab...</> : '📨 Saada tellimus'}
                  </button>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function CompanyModal({ call, onClose, onSaved }) {
  const [history, setHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [rawComment, setRawComment] = useState('');
  const [contactName, setContactName] = useState(call.contact_name || '');
  const [contactPhone, setContactPhone] = useState(call.contact_phone || '');
  const [correcting, setCorrecting] = useState(false);
  const [aiComment, setAiComment] = useState('');
  const [followupDate, setFollowupDate] = useState('');
  const [saving, setSaving] = useState(false);
  const aiRef = useRef();
  const newContactRef = useRef();

  useEffect(() => {
    api.getCallsByCompany(call.company_id).then(data => {
      setHistory(data || []);
      setLoadingHistory(false);
    });
  }, [call.company_id]);

  function scrollToNew() {
    newContactRef.current?.scrollIntoView({ behavior: 'smooth' });
  }

  async function aiCorrect() {
    if (!rawComment.trim()) { alert('Palun kirjuta kommentaar!'); return; }
    setCorrecting(true);
    setAiComment('');
    setFollowupDate('');
    try {
      const res = await api.aiCorrect(rawComment, call.legal_name, contactName);
      if (res?.comment) {
        setAiComment(res.comment);
        if (res.followup_date) setFollowupDate(res.followup_date);
      }
    } catch (e) { alert('AI viga: ' + e.message); }
    setCorrecting(false);
  }

  async function saveNewCall() {
    const finalComment = aiRef.current?.innerText || aiComment || rawComment;
    if (!finalComment.trim()) return;
    setSaving(true);
    try {
      await api.saveCall({
        company_id: call.company_id,
        contact_name: contactName,
        contact_phone: contactPhone,
        comment: finalComment,
        raw_comment: rawComment,
        followup_date: followupDate || null,
        status: followupDate ? 'followup' : 'logged'
      });
      onSaved();
      onClose();
    } catch (e) { alert('Salvestamine ebaõnnestus'); }
    setSaving(false);
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 700 }}>
        <div className="modal-title">
          <span>{call.legal_name || call.company_name}</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-sm btn-primary" onClick={scrollToNew}>📞 Uus kontakt</button>
            <button className="btn btn-sm" onClick={onClose}>✕</button>
          </div>
        </div>

        <div style={{ background: 'var(--bg)', borderRadius: 8, padding: '12px 14px', marginBottom: 16, fontSize: 13 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 16px' }}>
            <div><span style={{ color: 'var(--teal-dark)', fontWeight: 700 }}>Reg. kood: </span>{call.reg_number || '—'}</div>
            <div><span style={{ color: 'var(--teal-dark)', fontWeight: 700 }}>Aadress: </span>{call.address || '—'}</div>
          </div>
          {call.credit_score && (
            <div style={{ marginTop: 8, padding: '6px 10px', background: creditBg(call.credit_score), borderRadius: 4, fontSize: 12 }}>
              <strong style={{ color: creditColor(call.credit_score) }}>Krediidiskoor: {call.credit_score}/100</strong>
              <span style={{ marginLeft: 10 }}>€{call.credit_limit?.toLocaleString()} · {call.credit_days} päeva</span>
              <div style={{ color: '#555', marginTop: 2 }}>{call.credit_summary}</div>
            </div>
          )}
        </div>

        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--teal-dark)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10, borderBottom: '2px solid var(--teal-dark)', paddingBottom: 6 }}>
            Kontaktide ajalugu ({history.length})
          </div>
          {loadingHistory ? (
            <div style={{ color: '#888', fontSize: 13 }}><span className="spinner" /> Laadin...</div>
          ) : history.length === 0 ? (
            <div style={{ color: '#888', fontSize: 13 }}>Ajalugu puudub.</div>
          ) : (
            <div style={{ maxHeight: 300, overflowY: 'auto' }}>
              {history.map((h, i) => (
                <div key={h.id} style={{ padding: '10px 12px', background: i % 2 === 0 ? 'var(--bg)' : 'var(--white)', borderRadius: 6, marginBottom: 6, borderLeft: '3px solid var(--teal-light)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--dark)' }}>
                      {h.contact_name} · {h.contact_phone}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--teal-dark)', whiteSpace: 'nowrap', marginLeft: 8, fontWeight: 600 }}>
                      📅 {formatDateTime(h.call_date)}
                    </div>
                  </div>
                  <div style={{ fontSize: 12, color: '#444', lineHeight: 1.5 }}>{h.comment}</div>
                  {h.followup_date && (
                    <div style={{ fontSize: 11, color: '#7a6000', marginTop: 4, fontWeight: 600 }}>
                      🔔 Järelkõne: {formatDate(h.followup_date)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div ref={newContactRef} style={{ borderTop: '2px solid var(--teal-dark)', paddingTop: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--teal-dark)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 12 }}>
            + Lisa uus kontakt
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
            <div className="field" style={{ marginBottom: 0 }}>
              <label>Kontakti nimi</label>
              <input value={contactName} onChange={e => setContactName(e.target.value)} placeholder="Nimi" />
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label>Telefon</label>
              <input value={contactPhone} onChange={e => setContactPhone(e.target.value)} placeholder="+372..." />
            </div>
          </div>
          <div className="field">
            <label>Kommentaar</label>
            <textarea value={rawComment} onChange={e => setRawComment(e.target.value)}
              placeholder="Kirjuta lühike kommentaar kõne kohta..." rows={3} />
          </div>
          <div style={{ marginBottom: 12 }}>
            <button className="btn" style={{ width: '100%', justifyContent: 'center' }}
              onClick={aiCorrect} disabled={correcting}>
              {correcting ? <><span className="spinner" />AI töötab...</> : '✨ AI korrektsioon'}
            </button>
          </div>
          {aiComment && (
            <>
              <div style={{ fontSize: 11, color: 'var(--teal-dark)', fontWeight: 700, marginBottom: 4, textTransform: 'uppercase' }}>AI korrigeeritud tekst:</div>
              <div className="ai-box" contentEditable suppressContentEditableWarning ref={aiRef}>{aiComment}</div>
              {followupDate && (
                <div className="followup-alert">
                  📅 <strong>Järeltegevus:</strong> {new Date(followupDate).toLocaleDateString('et-EE')} — lisatakse kalendrisse
                </div>
              )}
              <div className="field" style={{ marginTop: 8 }}>
                <label>Järelkõne kuupäev</label>
                <input type="date" value={followupDate} onChange={e => setFollowupDate(e.target.value)} />
              </div>
              <button className="btn btn-primary btn-block" onClick={saveNewCall} disabled={saving}>
                {saving ? <><span className="spinner" />Salvestab...</> : '💾 Salvesta kontakt'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Dashboard({ onNewCall }) {
  const [calls, setCalls] = useState([]);
  const [stats, setStats] = useState({ calls_today: 0, followups: 0, firms: 0 });
  const [loading, setLoading] = useState(true);
  const [companyCall, setCompanyCall] = useState(null);
  const [cardCall, setCardCall] = useState(null);

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
        <div style={{ overflowX: 'auto', borderRadius: 8, border: '1px solid var(--border)' }}>
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
                <th>Tegevused</th>
              </tr>
            </thead>
            <tbody>
              {calls.map(call => (
                <tr key={call.id} onClick={() => setCompanyCall(call)}>
                  <td className="nowrap">{formatDate(call.call_date)}</td>
                  <td className="nowrap" style={{ color: call.followup_date ? '#7a6000' : '#ccc', fontWeight: call.followup_date ? 700 : 400 }}>
                    {formatDate(call.followup_date)}
                  </td>
                  <td style={{ fontWeight: 700, whiteSpace: 'nowrap', color: 'var(--teal-dark)' }}>{call.legal_name || call.company_name || '—'}</td>
                  <td className="nowrap" style={{ color: '#888' }}>{call.reg_number || '—'}</td>
                  <td style={{ maxWidth: 150, fontSize: 12, color: '#555' }}>
                    {call.address ? call.address.split(',').slice(0, 2).join(',') : '—'}
                  </td>
                  <td className="nowrap">
                    <div style={{ fontWeight: 600 }}>{call.contact_name}</div>
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
                  <td onClick={e => e.stopPropagation()}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <button className="btn btn-sm btn-primary" style={{ whiteSpace: 'nowrap', fontSize: 11 }}
                        onClick={() => setCompanyCall(call)}>
                        📞 Uus kontakt
                      </button>
                      <button
                        className="btn btn-sm"
                        style={{
                          whiteSpace: 'nowrap', fontSize: 11,
                          background: call.card_ordered ? 'var(--green)' : 'var(--white)',
                          color: call.card_ordered ? 'var(--white)' : 'var(--teal-dark)',
                          borderColor: call.card_ordered ? 'var(--green)' : 'var(--teal-dark)',
                          fontWeight: 700
                        }}
                        onClick={() => !call.card_ordered && setCardCall(call)}
                        disabled={call.card_ordered}
                      >
                        {call.card_ordered ? '✅ Kaart tellitud' : '💳 Telli kaart'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {companyCall && (
        <CompanyModal
          call={companyCall}
          onClose={() => setCompanyCall(null)}
          onSaved={() => { setCompanyCall(null); loadData(); }}
        />
      )}

      {cardCall && (
        <CardOrderModal
          call={cardCall}
          onClose={() => { setCardCall(null); }}
          onSaved={() => { setCardCall(null); loadData(); }}
        />
      )}
    </div>
  );
}

import { useState, useRef } from 'react';
import { api } from '../services/api';

const ACTIVITY_TYPES = [
  { val: 'email', label: '📧 Email', icon: '📧' },
  { val: 'kohtumine', label: '🤝 Kohtumine', icon: '🤝' },
  { val: 'muu', label: '📌 Muu', icon: '📌' },
];

export default function NewActivity({ onSaved, onCancel }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [firmResults, setFirmResults] = useState([]);
  const [firm, setFirm] = useState(null);
  const [savedCompany, setSavedCompany] = useState(null);
  const [activityType, setActivityType] = useState(null);
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [rawComment, setRawComment] = useState('');
  const [correcting, setCorrecting] = useState(false);
  const [aiComment, setAiComment] = useState('');
  const [followupDate, setFollowupDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [step, setStep] = useState(1);
  const aiRef = useRef();

  async function searchFirm() {
    if (!searchQuery.trim()) return;
    setSearching(true);
    setFirm(null);
    setFirmResults([]);
    setSearchError('');
    try {
      const res = await api.searchCompany(searchQuery);
      if (res?.results?.length > 0) {
        setFirmResults(res.results);
      } else {
        setSearchError('Firmat ei leitud, proovi teise nimega.');
      }
    } catch (e) {
      setSearchError('Ühenduse viga, proovi uuesti.');
    }
    setSearching(false);
  }

  function selectFirm(f) {
    setFirm(f);
    setFirmResults([]);
  }

  async function goStep2() {
    if (!firm || !activityType) return;
    const saved = await api.saveCompany(firm);
    setSavedCompany(saved);
    setStep(2);
  }

  async function aiCorrect() {
    if (!rawComment.trim()) { alert('Palun kirjuta kommentaar!'); return; }
    setCorrecting(true);
    setAiComment('');
    setFollowupDate('');
    try {
      const res = await api.aiCorrect(rawComment, firm?.legal_name, contactName);
      if (res?.comment) {
        setAiComment(res.comment);
        if (res.followup_date) setFollowupDate(res.followup_date);
      }
    } catch (e) { alert('AI viga: ' + e.message); }
    setCorrecting(false);
  }

  async function saveActivity() {
    const finalComment = aiRef.current?.innerText || aiComment || rawComment;
    if (!finalComment.trim()) return;
    const typeLabel = ACTIVITY_TYPES.find(t => t.val === activityType)?.label || activityType;
    setSaving(true);
    try {
      await api.saveCall({
        company_id: savedCompany?.id,
        contact_name: contactName,
        contact_phone: contactPhone,
        comment: `[${typeLabel}] ${finalComment}`,
        raw_comment: rawComment,
        followup_date: followupDate || null,
        status: followupDate ? 'followup' : 'logged'
      });
      onSaved();
    } catch (e) { alert('Salvestamine ebaõnnestus'); }
    setSaving(false);
  }

  return (
    <div className="section" style={{ maxWidth: 600, margin: '0 auto' }}>
      {step === 1 && (
        <>
          <div className="step-header">Samm 1/2 — Firma ja tegevuse tüüp</div>

          <div style={{ marginBottom: 20 }}>
            <div className="field"><label>Tegevuse tüüp</label></div>
            <div style={{ display: 'flex', gap: 10 }}>
              {ACTIVITY_TYPES.map(t => (
                <div key={t.val} onClick={() => setActivityType(t.val)}
                  style={{
                    flex: 1, border: `2px solid ${activityType === t.val ? 'var(--teal-dark)' : 'var(--border)'}`,
                    borderRadius: 8, padding: '14px 10px', cursor: 'pointer', textAlign: 'center',
                    background: activityType === t.val ? 'var(--bg)' : 'var(--white)', transition: 'all 0.15s'
                  }}>
                  <div style={{ fontSize: 24, marginBottom: 4 }}>{t.icon}</div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: activityType === t.val ? 'var(--teal-dark)' : 'var(--dark)', textTransform: 'uppercase' }}>
                    {t.val.charAt(0).toUpperCase() + t.val.slice(1)}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="field">
            <label>Firma nimi</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && searchFirm()}
                placeholder="nt. Terminal, Alexela, Olerex..." style={{ flex: 1 }} />
              <button className="btn btn-sm" onClick={searchFirm} disabled={searching}>
                {searching ? <span className="spinner" /> : '🔍'}
              </button>
            </div>
          </div>

          {searching && <div style={{ fontSize: 12, color: '#888', marginBottom: 12 }}><span className="spinner" /> Otsib äriregistrist...</div>}
          {searchError && <div style={{ fontSize: 12, color: '#c0392b', marginBottom: 12 }}>{searchError}</div>}

          {firmResults.length > 0 && !firm && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 12, color: '#888', marginBottom: 6 }}>Vali firma:</div>
              {firmResults.map((f, i) => (
                <div key={i} className="firm-result" onClick={() => selectFirm(f)}>
                  <div className="firm-result-name">{f.legal_name}</div>
                  <div className="firm-result-sub">{f.reg_number && `Reg: ${f.reg_number}`}{f.address && ` · ${f.address}`}</div>
                </div>
              ))}
            </div>
          )}

          {firm && (
            <div className="card" style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <div style={{ fontWeight: 700 }}>{firm.legal_name}</div>
                <span className="badge badge-green">Valitud</span>
              </div>
              <table className="firm-table">
                {[['Reg. nr', firm.reg_number], ['Aadress', firm.address], ['Tegevusala', firm.sector]].map(([label, value]) => value ? (
                  <tr key={label}><td>{label}</td><td>{value}</td></tr>
                ) : null)}
              </table>
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button className="btn btn-block" onClick={onCancel}>Tühista</button>
            <button className="btn btn-primary btn-block" onClick={goStep2} disabled={!firm || !activityType}>
              Edasi →
            </button>
          </div>
        </>
      )}

      {step === 2 && (
        <>
          <div className="step-header">Samm 2/2 — Tegevuse detailid</div>

          <div className="card" style={{ marginBottom: 16, fontSize: 13 }}>
            <div style={{ fontWeight: 700, color: 'var(--teal-dark)' }}>{firm?.legal_name}</div>
            <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>
              {ACTIVITY_TYPES.find(t => t.val === activityType)?.label}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 4 }}>
            <div className="field" style={{ marginBottom: 0 }}>
              <label>Kontakti nimi</label>
              <input value={contactName} onChange={e => setContactName(e.target.value)} placeholder="Mart Tamm" />
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label>Telefon / Email</label>
              <input value={contactPhone} onChange={e => setContactPhone(e.target.value)} placeholder="+372 / email" />
            </div>
          </div>

          <div className="field" style={{ marginTop: 14 }}>
            <label>Kommentaar</label>
            <textarea value={rawComment} onChange={e => setRawComment(e.target.value)}
              placeholder="Kirjuta lühike kokkuvõte tegevuse kohta..." rows={4} />
          </div>

          <button className="btn" style={{ width: '100%', justifyContent: 'center', marginBottom: 14 }}
            onClick={aiCorrect} disabled={correcting}>
            {correcting ? <><span className="spinner" />AI töötab...</> : '✨ AI korrektsioon'}
          </button>

          {aiComment && (
            <>
              <div style={{ fontSize: 11, color: 'var(--teal-dark)', fontWeight: 700, marginBottom: 4, textTransform: 'uppercase' }}>AI korrigeeritud tekst:</div>
              <div className="ai-box" contentEditable suppressContentEditableWarning ref={aiRef}>{aiComment}</div>
              {followupDate && (
                <div className="followup-alert">
                  📅 <strong>Järeltegevus:</strong> {new Date(followupDate).toLocaleDateString('et-EE')} — lisatakse kalendrisse
                </div>
              )}
              <div className="field" style={{ marginTop: 10 }}>
                <label>Järeltegevuse kuupäev</label>
                <input type="date" value={followupDate} onChange={e => setFollowupDate(e.target.value)} />
              </div>
            </>
          )}

          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <butto

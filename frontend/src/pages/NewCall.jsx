import { useState, useRef } from 'react';
import { api } from '../services/api';

export default function NewCall({ onSaved, onCancel }) {
  const [step, setStep] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [firmResults, setFirmResults] = useState([]);
  const [firm, setFirm] = useState(null);
  const [savedCompany, setSavedCompany] = useState(null);
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [rawComment, setRawComment] = useState('');
  const [correcting, setCorrecting] = useState(false);
  const [aiComment, setAiComment] = useState('');
  const [followupDate, setFollowupDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [searchError, setSearchError] = useState('');
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
    if (!firm) return;
    const saved = await api.saveCompany(firm);
    setSavedCompany(saved);
    setStep(2);
  }

  async function aiCorrect() {
    if (!rawComment.trim()) {
      alert('Palun kirjuta esmalt kommentaar!');
      return;
    }
    setCorrecting(true);
    setAiComment('');
    setFollowupDate('');
    try {
      const res = await api.aiCorrect(rawComment, firm?.legal_name, contactName);
      if (res?.comment) {
        setAiComment(res.comment);
        if (res.followup_date) setFollowupDate(res.followup_date);
      } else {
        alert('AI vastus tuli tühjana. Proovi uuesti.');
      }
    } catch (e) {
      alert('Viga AI ühenduses: ' + e.message);
    }
    setCorrecting(false);
  }

  async function saveCall() {
    const finalComment = aiRef.current?.innerText || aiComment || rawComment;
    if (!finalComment.trim()) return;
    setSaving(true);
    try {
      await api.saveCall({
        company_id: savedCompany?.id,
        contact_name: contactName,
        contact_phone: contactPhone,
        comment: finalComment,
        raw_comment: rawComment,
        followup_date: followupDate || null,
        status: followupDate ? 'followup' : 'logged'
      });
      onSaved();
    } catch (e) {
      alert('Salvestamine ebaõnnestus: ' + e.message);
    }
    setSaving(false);
  }

  return (
    <div className="section">
      {step === 1 && (
        <>
          <div className="step-header">Samm 1/3 — Firma otsimine</div>
          <div className="field">
            <label>Firma nimi</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && searchFirm()}
                placeholder="nt. Terminal, Alexela, Olerex..."
                style={{ flex: 1 }}
              />
              <button className="btn btn-sm" onClick={searchFirm} disabled={searching}>
                {searching ? <span className="spinner" /> : '🔍'}
              </button>
            </div>
          </div>

          {searching && (
            <div style={{ fontSize: 12, color: '#888', marginBottom: 12 }}>
              <span className="spinner" /> Otsib äriregistrist...
            </div>
          )}

          {searchError && (
            <div style={{ fontSize: 12, color: '#c0392b', marginBottom: 12 }}>{searchError}</div>
          )}

          {firmResults.length > 0 && !firm && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 12, color: '#888', marginBottom: 6 }}>Vali firma:</div>
              {firmResults.map((f, i) => (
                <div key={i} className="firm-result" onClick={() => selectFirm(f)}>
                  <div className="firm-result-name">{f.legal_name}</div>
                  <div className="firm-result-sub">
                    {f.reg_number && `Reg: ${f.reg_number}`}{f.address && ` · ${f.address}`}
                  </div>
                </div>
              ))}
            </div>
          )}

          {firm && (
            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                <div style={{ fontWeight: 600 }}>{firm.legal_name}</div>
                <span className="badge badge-green">Valitud</span>
              </div>
              <table className="firm-table">
                {[
                  ['Reg. nr', firm.reg_number],
                  ['Aadress', firm.address],
                  ['Tegevusala', firm.sector],
                  ['E-post', firm.email],
                  ['Tel', firm.phone],
                ].map(([label, value]) => value ? (
                  <tr key={label}><td>{label}</td><td>{value}</td></tr>
                ) : null)}
              </table>
              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                <button className="btn btn-sm" onClick={() => { setFirm(null); setFirmResults([]); }}>← Muuda</button>
                <button className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }} onClick={goStep2}>
                  📞 Jätka kõne lisamisega →
                </button>
              </div>
            </div>
          )}

          <button className="btn btn-block" style={{ marginTop: 8 }} onClick={onCancel}>Tühista</button>
        </>
      )}

      {step === 2 && (
        <>
          <div className="step-header">Samm 2/3 — Kõne andmed</div>
          <div className="card" style={{ marginBottom: 14 }}>
            <div style={{ fontWeight: 600, fontSize: 14 }}>{firm?.legal_name}</div>
            <div style={{ fontSize: 12, color: '#888' }}>{firm?.sector}</div>
          </div>
          <div className="field">
            <label>Kontakti nimi</label>
            <input value={contactName} onChange={e => setContactName(e.target.value)} placeholder="Mart Tamm" />
          </div>
          <div className="field">
            <label>Telefoninumber</label>
            <input type="tel" value={contactPhone} onChange={e => setContactPhone(e.target.value)} placeholder="+372 5123 4567" />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn" onClick={() => setStep(1)}>← Tagasi</button>
            <button className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }} onClick={() => setStep(3)}>
              ✅ Kõne tehtud — lisa kommentaar
            </button>
          </div>
        </>
      )}

      {step === 3 && (
        <>
          <div className="step-header">Samm 3/3 — Kõne kokkuvõte</div>
          <div className="card" style={{ marginBottom: 14, fontSize: 13 }}>
            <strong>{firm?.legal_name}</strong> · {contactName} · {contactPhone}
          </div>
          <div className="field">
            <label>Sinu lühikommentaar</label>
            <textarea
              value={rawComment}
              onChange={e => setRawComment(e.target.value)}
              placeholder="nt. huvitatud diisel 50k liitrit, räägime uuesti 20 juunil..."
            />
          </div>
          <div style={{ marginBottom: 14 }}>
            <button
              className="btn"
              style={{ width: '100%', justifyContent: 'center' }}
              onClick={aiCorrect}
              disabled={correcting}
            >
              {correcting ? <><span className="spinner" />AI töötab...</> : '✨ AI korrektsioon'}
            </button>
          </div>

          {aiComment && (
            <>
              <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>
                AI korrigeeritud tekst (saad muuta):
              </div>
              <div
                className="ai-box"
                contentEditable
                suppressContentEditableWarning
                ref={aiRef}
              >
                {aiComment}
              </div>
              {followupDate && (
                <div className="followup-alert">
                  📅 <strong>Järeltegevus tuvastatud:</strong> {new Date(followupDate).toLocaleDateString('et-EE')} — lisatakse kalendrisse
                </div>
              )}
              <div className="field" style={{ marginTop: 10 }}>
                <label>Järelkõne kuupäev (muuda vajadusel)</label>
                <input
                  type="date"
                  value={followupDate}
                  onChange={e => setFollowupDate(e.target.value)}
                />
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <button className="btn" onClick={aiCorrect} disabled={correcting}>🔄 Uuesti</button>
                <button
                  className="btn btn-primary"
                  style={{ flex: 1, justifyContent: 'center' }}
                  onClick={saveCall}
                  disabled={saving}
                >
                  {saving ? <><span className="spinner" />Salvestab...</> : '💾 Salvesta kõne'}
                </button>
              </div>
            </>
          )}

          <button className="btn btn-block" style={{ marginTop: 10 }} onClick={() => setStep(2)}>
            ← Tagasi
          </button>
        </>
      )}
    </div>
  );
}

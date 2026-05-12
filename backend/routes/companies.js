const router = require('express').Router();
const db = require('../db');
const auth = require('../middleware/auth');

router.post('/search', auth, async (req, res) => {
  const { query } = req.body;
  if (!query) return res.status(400).json({ error: 'Otsingusõna puudub' });
  try {
    const ariregRes = await fetch('https://ariregister.rik.ee/est/api/autocomplete?q=' + encodeURIComponent(query) + '&lang=est');
    const ariregData = await ariregRes.json();
    console.log('Ariregister vastus:', JSON.stringify(ariregData).substring(0, 500));
    if (ariregData && ariregData.data && ariregData.data.length > 0) {
      const results = ariregData.data.slice(0, 5).map(function(item) {
        return {
          name: item.name || query,
          legal_name: item.name || query,
          reg_number: item.reg_code ? String(item.reg_code) : '',
          address: item.legal_address || '',
          sector: item.emtak_tekstiline || '',
          email: '',
          phone: '',
          website: ''
        };
      });
      return res.json({ results: results });
    }
    res.json({ results: [{ name: query, legal_name: query, reg_number: '', address: '', sector: '', email: '', phone: '', website: '' }] });
  } catch (err) {
    console.error('Firmaotsingu viga:', err);
    res.json({ results: [{ name: query, legal_name: query, reg_number: '', address: '', sector: '', email: '', phone: '', website: '' }] });
  }
});

router.post('/credit/:id', auth, async (req, res) => {
  const { id } = req.params;
  try {
    const compRes = await db.query('SELECT * FROM companies WHERE id=$1', [id]);
    const company = compRes.rows[0];
    if (!company) return res.status(404).json({ error: 'Firma ei leitud' });

    const regNum = company.reg_number;
    const firmName = company.legal_name;

    let ariregInfo = '';
    if (regNum) {
      try {
        const r = await fetch('https://ariregister.rik.ee/est/api/autocomplete?q=' + encodeURIComponent(regNum) + '&lang=est');
        const d = await r.json();
        if (d && d.data && d.data.length > 0) {
          ariregInfo = JSON.stringify(d.data[0]);
        }
      } catch(e) {
        console.log('Ariregister kredit viga:', e.message);
      }
    }

    const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5',
        max_tokens: 800,
        messages: [{
          role: 'user',
          content: 'Hinda Eesti firma krediidiriski vedelkutuste muugiks.\n\nFirma: ' + firmName + '\nRegistrikood: ' + (regNum || 'teadmata') + '\nAriregistri andmed: ' + (ariregInfo || 'puuduvad') + '\n\nTagasta AINULT see JSON, mitte midagi muud:\n{"score":65,"limit":5000,"days":14,"summary":"Luhike pohjendu eesti keeles."}\n\nSkoor 1-100: 80+ tugev, 50-79 keskmine, alla 50 risk. Kui andmed puuduvad: score=40, limit=1000, days=7.'
        }]
      })
    });

    const aiData = await aiRes.json();
    const text = (aiData.content && aiData.content[0] ? aiData.content[0].text : '').replace(/```json|```/g, '').trim();
    console.log('Krediidi AI tekst:', text.substring(0, 300));

    let credit = { score: 40, limit: 1000, days: 7, summary: 'Piiratud andmed, ettevaatlikkus soovitatav.' };
    try {
      const m = text.match(/\{[^{}]*"score"[^{}]*\}/);
      if (m) {
        const parsed = JSON.parse(m[0]);
        if (typeof parsed.score === 'number') {
          credit = {
            score: Math.min(100, Math.max(1, parsed.score)),
            limit: parsed.limit || 0,
            days: parsed.days || 7,
            summary: parsed.summary || 'Hinnang puudub.'
          };
        }
      }
    } catch (e) {
      console.log('JSON parse viga:', e.message);
    }

    await db.query(
      'UPDATE companies SET credit_score=$1, credit_limit=$2, credit_days=$3, credit_summary=$4, credit_checked_at=NOW() WHERE id=$5',
      [credit.score, credit.limit, credit.days, credit.summary, id]
    );

    res.json(credit);
  } catch (err) {
    console.error('Krediidikontroll viga:', err);
    res.status(500).json({ error: 'Krediidikontroll ebaohnestus' });
  }
});

router.post('/', auth, async (req, res) => {
  const { name, legal_name, reg_number, address, sector, email, phone, website } = req.body;
  try {
    const existing = await db.query('SELECT * FROM companies WHERE legal_name ILIKE $1', [legal_name]);
    if (existing.rows.length > 0) {
      return res.json(existing.rows[0]);
    }
    const result = await db.query(
      'INSERT INTO companies (name,legal_name,reg_number,address,sector,email,phone,website) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *',
      [name, legal_name, reg_number, address, sector, email, phone, website]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Firma salvestamine ebaohnestus' });
  }
});

router.get('/', auth, async (req, res) => {
  const result = await db.query('SELECT * FROM companies ORDER BY name');
  res.json(result.rows);
});

module.exports = router;

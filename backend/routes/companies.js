const router = require('express').Router();
const db = require('../db');
const auth = require('../middleware/auth');

router.post('/search', auth, async (req, res) => {
  const { query } = req.body;
  if (!query) return res.status(400).json({ error: 'Otsingusõna puudub' });
  try {
    const ariregRes = await fetch(`https://ariregister.rik.ee/est/api/autocomplete?q=${encodeURIComponent(query)}&lang=est`);
    const ariregData = await ariregRes.json();
    console.log('Ariregister vastus:', JSON.stringify(ariregData).substring(0, 500));
    if (ariregData?.data?.length > 0) {
      const results = ariregData.data.slice(0, 5).map(item => ({
        name: item.name || item.nimi || query,
        legal_name: item.name || item.nimi || query,
        reg_number: item.reg_code ? String(item.reg_code) : '',
        address: item.legal_address || item.aadress || '',
        sector: item.emtak_tekstiline || '',
        email: '',
        phone: '',
        website: ''
      }));
      return res.json({ results });
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

    // Kasutame web_search tööriista — AI otsib ise internetist
    const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5',
        max_tokens: 2000,
        tools: [{ type: 'web_search_20250305', name: 'web_search' }],
        messages: [{
          role: 'user',
          content: `Tee põhjalik krediidikontroll Eesti firmale vedelkütuste müügiks.

Firma: ${firmName}
Registrikood: ${regNum || 'teadmata'}

Otsi infot järgmistest allikatest:
1. inforegister.ee - finantsandmed, krediidiskoor, käive, kasum
2. ariregister.rik.ee - äriregistri andmed, asutamiskuupäev, staatus
3. emta.ee või maksuamet - maksuvõlad
4. äripäev, storybook, regia - lisainfo

Seejärel tagasta AINULT see JSON (mitte midagi muud, mitte markdown):
{
  "score": 75,
  "limit": 15000,
  "days": 30,
  "summary": "2-3 lause kokkuvõte eesti keeles mis põhjendab skoori",
  "details": {
    "age_years": 10,
    "turnover": 1000000,
    "profit": 50000,
    "employees": 10,
    "tax_debt": false,
    "court_cases": 0,
    "credit_rating": "usaldusväärne"
  }
}`
        }]
      })
    });

    const aiData = await aiRes.json();
    console.log('Krediidi AI raw:', JSON.stringify(aiData).substring(0, 1000));

    // Leia tekstiblokk vastusest
    const textBlock = aiData.content?.find(b => b.type === 'text');
    const text = (textBlock?.text || '').replace(/```json|```/g, '').trim();
    console.log('Krediidi AI tekst:', text);

    let credit = { score: 50, limit: 2000, days: 14, summary: 'Andmeid ei leitud.' };
    try {
      const m = text.match(/\{[\s\S]*\}/);
      if (m) {
        const parsed = JSON.parse(m[0]);
        credit = {
          score: parsed.score || 50,
          limit: parsed.limit || 2000,
          days: parsed.days || 14,
          summary: parsed.summary || 'Andmeid ei leitud.'
        };
      }
    } catch (e) {
      console.log('JSON parse viga:', e.message);
    }

    await db.query(
      `UPDATE companies SET credit_score=$1, credit_limit=$2, credit_days=$3, credit_summary=$4, credit_checked_at=NOW() WHERE id=$5`,
      [credit.score, credit.limit, credit.days, credit.summary, id]
    );

    res.json(credit);
  } catch (err) {
    console.error('Krediidikontroll viga:', err);
    res.status(500).json({ error: 'Krediidikontroll ebaõnnestus' });
  }
});

router.post('/', auth, async (req, res) => {
  const { name, legal_name, reg_number, address, sector, email, phone, website } = req.body;
  try {
    const existing = await db.query('SELECT * FROM companies WHERE legal_name ILIKE $1', [legal_name]);
    if (existing.rows.length > 0) return res.json(existing.rows[0]);
    const result = await db.query(
      'INSERT INTO companies (name,legal_name,reg_number,address,sector,email,phone,website) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *',
      [name, legal_name, reg_number, address, sector, email, phone, website]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Firma salvestamine ebaõnnestus' });
  }
});

router.get('/', auth, async (req, res) => {
  const result = await db.query('SELECT * FROM companies ORDER BY name');
  res.json(result.rows);
});

module.exports = router;

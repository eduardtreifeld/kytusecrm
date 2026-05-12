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
    let infoData = null;

    if (regNum) {
      try {
        const infoRes = await fetch(`https://www.inforegister.ee/en/${regNum}`, {
          headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        const html = await infoRes.text();
        infoData = html.substring(0, 8000);
      } catch (e) {
        console.log('Inforegister fetch viga:', e.message);
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
        max_tokens: 500,
        messages: [{
          role: 'user',
          content: `Sa oled krediidianalüütik. Hinda Eesti firma krediidiriski vedelkütuste müügiks.

Firma: ${company.legal_name}
Registrikood: ${regNum || 'teadmata'}
Aadress: ${company.address || 'teadmata'}
Tegevusala: ${company.sector || 'teadmata'}

${infoData ? `Avalik info firmast:\n${infoData}` : 'Avalikku finantsinfot ei leitud.'}

Tagasta AINULT see JSON, mitte midagi muud, mitte markdown koodiplokki, mitte backtick'e:
{"score":65,"limit":5000,"days":14,"summary":"Lühike põhjendus eesti keeles"}

Juhised skoori arvutamiseks:
- score: 1-100 (100=väga usaldusväärne, 1=väga riskantne)
- limit: soovitatav krediidilimiit eurodes (0-50000)
- days: maksetähtaeg päevades (0, 7, 14, 21, 30, 45, 60)
- Kahjumlik või madal reputatsioon: score alla 50, limit alla 2000, days 7
- Kasumlik ja pikaajaline: score üle 70, limit 5000-20000, days 30`
        }]
      })
    });

    const aiData = await aiRes.json();
    const text = (aiData.content?.[0]?.text || '').replace(/```json|```/g, '').trim();
    console.log('Krediidi AI vastus:', text);

    let credit = { score: 50, limit: 2000, days: 14, summary: 'Automaatne hinnang puudub.' };
    try {
      const m = text.match(/\{[\s\S]*\}/);
      if (m) credit = JSON.parse(m[0]);
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

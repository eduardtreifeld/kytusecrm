const router = require('express').Router();
const db = require('../db');
const auth = require('../middleware/auth');

router.post('/search', auth, async (req, res) => {
  const { query } = req.body;
  if (!query) return res.status(400).json({ error: 'Otsingusõna puudub' });

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 800,
        messages: [{
          role: 'user',
          content: `Sa oled Eesti äriregistri ekspert. Kasutaja otsib firmat: "${query}". Kui tead selle firma andmeid (nt Alexela, Olerex, Circle K, Neste, Rimi, Maxima, Selver vms tuntud Eesti firma), kasuta neid. Muidu täida mõistlikult. Tagasta AINULT JSON (mitte midagi muud, mitte markdown koodiplokki): {"name":"lühinimi","legal_name":"täis juriidiline nimi","reg_number":"registrikood või tühi","address":"aadress või tühi","sector":"tegevusala","email":"email või tühi","phone":"telefon või tühi","website":"veebileht või tühi"}`
        }]
      })
    });

    const data = await response.json();
    const text = data.content?.[0]?.text || '';

    let firmData = null;
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) firmData = JSON.parse(jsonMatch[0]);
    } catch { firmData = null; }

    if (!firmData) {
      firmData = { name: query, legal_name: query + ' OÜ', reg_number: '', address: '', sector: '', email: '', phone: '', website: '' };
    }

    res.json({ results: [firmData] });
  } catch (err) {
    console.error('Firmaotsingu viga:', err);
    res.json({ results: [{ name: query, legal_name: query + ' OÜ', reg_number: '', address: '', sector: '', email: '', phone: '', website: '' }] });
  }
});

router.post('/', auth, async (req, res) => {
  const { name, legal_name, reg_number, address, sector, email, phone, website } = req.body;
  try {
    const existing = await db.query(
      'SELECT * FROM companies WHERE legal_name ILIKE $1',
      [legal_name]
    );
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

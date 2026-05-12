const router = require('express').Router();
const db = require('../db');
const auth = require('../middleware/auth');

// AI-põhine firmaotsing
router.post('/search', auth, async (req, res) => {
  const { query } = req.body;
  if (!query) return res.status(400).json({ error: 'Otsingusõna puudub' });

  try {
    // Kutsume Anthropic API-t firma andmete otsimiseks
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        tools: [{ type: 'web_search_20250305', name: 'web_search' }],
        messages: [{
          role: 'user',
          content: `Otsi Eesti äriregistrist ja internetist järgmise firma andmed: "${query}".
Tagasta AINULT JSON formaadis (mitte midagi muud):
{
  "name": "lühinimi",
  "legal_name": "täis juriidiline nimi",
  "reg_number": "registrikood",
  "address": "täisaadress",
  "sector": "tegevusala",
  "email": "e-posti aadress",
  "phone": "telefoninumber",
  "website": "veebileht"
}
Kui mõni väli pole teada, kasuta null.`
        }]
      })
    });

    const data = await response.json();
    const text = data.content?.find(b => b.type === 'text')?.text || '';

    let firmData = null;
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) firmData = JSON.parse(jsonMatch[0]);
    } catch { firmData = null; }

    if (!firmData) {
      return res.json({ results: [], message: 'Firmat ei leitud' });
    }

    res.json({ results: [firmData] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Otsing ebaõnnestus' });
  }
});

// Salvesta firma andmebaasi
router.post('/', auth, async (req, res) => {
  const { name, legal_name, reg_number, address, sector, email, phone, website } = req.body;
  try {
    // Kontrolli kas firma on juba olemas
    const existing = await db.query(
      'SELECT * FROM companies WHERE reg_number = $1 OR legal_name ILIKE $2',
      [reg_number, legal_name]
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

// Kõik firmad
router.get('/', auth, async (req, res) => {
  const result = await db.query('SELECT * FROM companies ORDER BY name');
  res.json(result.rows);
});

module.exports = router;

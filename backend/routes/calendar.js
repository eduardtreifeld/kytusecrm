const router = require('express').Router();
const db = require('../db');
const auth = require('../middleware/auth');

router.post('/search', auth, async (req, res) => {
  const { query } = req.body;
  if (!query) return res.status(400).json({ error: 'Otsingusõna puudub' });

  try {
    // Eesti äriregistri avalik API
    const ariregUrl = `https://ariregister.rik.ee/est/api/autocomplete?q=${encodeURIComponent(query)}&lang=est`;
    const ariregRes = await fetch(ariregUrl);
    const ariregData = await ariregRes.json();

    if (ariregData?.data?.length > 0) {
      const results = ariregData.data.slice(0, 5).map(item => ({
        name: item.nimi,
        legal_name: item.nimi,
        reg_number: item.ariregistri_kood || '',
        address: item.aadress || '',
        sector: item.emtak_tekstiline || item.staatus || '',
        email: '',
        phone: '',
        website: ''
      }));
      return res.json({ results });
    }

    // Fallback: kui äriregister ei vasta, kasuta AI-t
    const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 500,
        messages: [{
          role: 'user',
          content: `Eesti firma otsing: "${query}". Tagasta AINULT JSON, mitte midagi muud: {"name":"${query}","legal_name":"${query}","reg_number":"","address":"","sector":"","email":"","phone":"","website":""}`
        }]
      })
    });
    const aiData = await aiRes.json();
    const text = aiData.content?.[0]?.text || '';
    let firmData = null;
    try {
      const m = text.match(/\{[\s\S]*\}/);
      if (m) firmData = JSON.parse(m[0]);
    } catch { firmData = null; }

    res.json({ results: [firmData || { name: query, legal_name: query, reg_number: '', address: '', sector: '', email: '', phone: '', website: '' }] });

  } catch (err) {
    console.error('Firmaotsingu viga:', err);
    res.json({ results: [{ name: query, legal_name: query, reg_number: '', address: '', sector: '', email: '', phone: '', website: '' }] });
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

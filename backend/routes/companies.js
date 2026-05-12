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

    if (ariregData?.length > 0) {
      const results = ariregData.slice(0, 5).map(item => ({
        name: item.name || item.nimi || item.company_name || item.arinimi || Object.values(item)[0] || query,
        legal_name: item.name || item.nimi || item.company_name || item.arinimi || query,
        reg_number: item.code || item.kood || item.ariregistri_kood || item.reg_code || '',
        address: item.address || item.aadress || '',
        sector: item.sector || item.tegevusala || item.emtak || '',
        email: '',
        phone: '',
        website: ''
      }));
      return res.json({ results });
    }

    if (ariregData?.data?.length > 0) {
      const results = ariregData.data.slice(0, 5).map(item => ({
        name: item.name || item.nimi || query,
        legal_name: item.name || item.nimi || query,
        reg_number: item.code || item.ariregistri_kood || '',
        address: item.aadress || item.address || '',
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

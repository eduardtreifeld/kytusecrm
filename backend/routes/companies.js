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

    const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5',
        max_tokens: 3000,
        tools: [{ type: 'web_search_20250305', name: 'web_search' }],
        messages: [{
          role: 'user',
          content: `Tee krediidikontroll Eesti firmale vedelkütuste müügiks. Otsi infot KOHUSTUSLIKULT järgmistest allikatest:
1. https://www.inforegister.ee/en/${regNum} - käive, kasum, töötajad, krediidilimiit
2. https://ariregister.rik.ee/est/company/${regNum} - äriregistri andmed
3. Otsi ka: "${firmName} ${regNum} krediidiskoor käive kasum"

Firma: ${firmName}
Registrikood: ${regNum || 'teadmata'}

Pärast otsimist tagasta AINULT see JSON objekt, mitte midagi muud, absoluutselt mitte mingit teksti väljaspool JSON-i:
{"score":75,"limit":15000,"days":30,"summary":"Firma käive 2024 oli X eurot, kasum Y eurot. Lühike põhjendus eesti keeles."}

Reeglid:
- score 1-100 (80+ roheline, 50-79 kollane, alla 50 punane)
- limit eurodes (0 kuni 50000)  
- days maksetähtaeg (0=ettemaks, 7, 14, 21, 30, 45, 60)
- summary PEAB mainima käivet ja kasumit kui need on leitavad
- Kui andmed puuduvad täielikult: score=35, limit=500, days=7, summary="Finantsandmed puuduvad, soovitatav ettemaks."
- KEELATUD: tagastada viga, selgitust, markdown-i või muud teksti peale JSON-i`
        }]
      })
    });

    const aiData = await aiRes.json();
    console.log('Krediidi raw:', JSON.stringify(aiData).substring(0, 800));

    // Otsi tekstiblokk — web_search puhul võib olla mitu content blokki
    let text = '';
    if (aiData.content) {
      for (const block of aiData.content) {
        if (block.type === 'text' && block.text) {
          text = block.text;
          break;
        }
      }
    }
    text = text.replace(/```json|```/g, '').trim();
    console.log('Krediidi tekst:', text.substring(0, 400));

    let credit = { score: 35, limit: 500, days: 7, summary: 'Finantsandmed puuduvad, soovitatav ettemaks.' };
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
      console.log('JSON parse viga:', e.message, 'Tekst oli:', text.substring(0, 200));
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

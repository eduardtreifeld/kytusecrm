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

    // Lae Inforegistri leht otse
    let infoHtml = '';
    if (regNum) {
      try {
        const infoRes = await fetch(`https://www.inforegister.ee/en/${regNum}`, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml',
            'Accept-Language': 'en-US,en;q=0.9'
          }
        });
        infoHtml = await infoRes.text();
        // Võta ainult relevantne osa
        infoHtml = infoHtml.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
                           .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
                           .replace(/<[^>]+>/g, ' ')
                           .replace(/\s+/g, ' ')
                           .substring(0, 6000);
        console.log('Inforegister HTML pikkus:', infoHtml.length);
      } catch (e) {
        console.log('Inforegister viga:', e.message);
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
        max_tokens: 1000,
        messages: [{
          role: 'user',
          content: `Sa oled krediidianalüütik Eesti vedelkütuste müügifirmas. Hinda kliendi krediidiriski.

Firma: ${firmName}
Registrikood: ${regNum || 'teadmata'}

Inforegistri andmed:
${infoHtml || 'Andmed puuduvad'}

Analüüsi järgmisi näitajaid kui need on olemas:
- Käive ja kasum (viimased aastad)
- Töötajate arv
- Maksuvõlg
- Kohtuasjad
- Firma vanus
- Inforegistri krediidilimiit ja maksetähtaeg
- Finantsreiting

Tagasta AINULT see JSON, mitte midagi muud:
{"score":75,"limit":15000,"days":30,"summary":"2-3 lause eestikeelne kokkuvõte mis mainib käivet, kasumit ja põhjendab skoori"}

Skoori juhised:
- 80-100: tugev firma, pikk ajalugu, kasulik, maksuvõlg puudub
- 50-79: keskmise riskiga, mõned puudujäägid
- 1-49: kõrge risk, ettemaks soovitatav
- limit: eurodes, lähtudes Inforegistri soovitusest või oma hinnangust
- days: 0=ettemaks, 7, 14, 21, 30, 45, 60`
        }]
      })
    });

    const aiData = await aiRes.json();
    const text = (aiData.content?.[0]?.text || '').replace(/```json|```/g, '').trim();
    console.log('Krediidi AI tekst:', text.substring(0, 300));

    let credit = { score: 45, limit: 500, days: 7, summary: 'Andmeid ei leitud, soovitatav ettemaks.' };
    try {
      const m = text.match(/\{[\s\S]*?\}/);
      if (m) {
        const parsed = JSON.parse(m[0]);
        if (parsed.score) {
          credit = {
            score: parsed.score,
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

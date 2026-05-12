const router = require('express').Router();
const db = require('../db');
const auth = require('../middleware/auth');

router.post('/ai-correct', auth, async (req, res) => {
  const { raw_comment, company_name, contact_name } = req.body;
  if (!raw_comment) return res.status(400).json({ error: 'Kommentaar puudub' });

  const today = new Date().toLocaleDateString('et-EE', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Europe/Tallinn'
  });
  const todayIso = new Date().toLocaleDateString('et-EE', { timeZone: 'Europe/Tallinn' });

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
        max_tokens: 1000,
        messages: [{
          role: 'user',
          content: `Sa oled CRM assistent vedelkütuste müügifirmas.
Täna on: ${today} (${todayIso})
Firma: ${company_name || 'Tundmatu'}
Kontakt: ${contact_name || 'Tundmatu'}
Müügimehe kommentaar: "${raw_comment}"

Tee järgmist:
1. Kirjuta professionaalne kokkuvõte eesti keeles (3-5 lauset). Säilita kõik faktid.
2. Kui tekstis on mainitud järelkontakti aeg (ka "homme", "ülehomme", "järgmine nädal", "kuu lõpus", konkreetne kuupäev vms), arvuta täpsed kuupäevad tänase kuupäeva põhjal ja lisa lõppu: JÄRELTEGEVUS: DD.MM.YYYY
3. Vasta AINULT parandatud tekstiga (+ võimalik JÄRELTEGEVUS rida), mitte midagi muud.`
        }]
      })
    });

    const data = await response.json();
    console.log('Anthropic vastus:', JSON.stringify(data).substring(0, 500));
    const text = data.content?.[0]?.text || '';
    const lines = text.split('\n');
    const followupLine = lines.find(l => l.startsWith('JÄRELTEGEVUS:'));
    const comment = lines.filter(l => !l.startsWith('JÄRELTEGEVUS:')).join('\n').trim();

    let followup_date = null;
    if (followupLine) {
      const dateStr = followupLine.replace('JÄRELTEGEVUS:', '').trim();
      const parts = dateStr.split('.');
      if (parts.length === 3) {
        followup_date = `${parts[2]}-${parts[1]}-${parts[0]}`;
      }
    }

    res.json({ comment, followup_date });
  } catch (err) {
    console.error('AI korrektsioon viga:', err);
    res.status(500).json({ error: 'AI korrektsioon ebaõnnestus' });
  }
});

router.post('/', auth, async (req, res) => {
  const { company_id, contact_name, contact_phone, comment, raw_comment, followup_date, status } = req.body;
  try {
    const result = await db.query(
      `INSERT INTO calls (user_id,company_id,contact_name,contact_phone,comment,raw_comment,followup_date,status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [req.user.id, company_id, contact_name, contact_phone, comment, raw_comment, followup_date || null, status || 'logged']
    );
    const call = result.rows[0];

    if (followup_date) {
      await db.query(
        `INSERT INTO calendar_events (user_id,call_id,title,event_date,description)
         VALUES ($1,$2,$3,$4,$5)`,
        [req.user.id, call.id, 'Järelkõne', followup_date, comment]
      );
    }

    res.json(call);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Kõne salvestamine ebaõnnestus' });
  }
});

router.get('/', auth, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT c.*, co.name as company_name, co.legal_name, co.sector
       FROM calls c
       LEFT JOIN companies co ON c.company_id = co.id
       WHERE c.user_id = $1
       ORDER BY c.call_date DESC
       LIMIT 100`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Päring ebaõnnestus' });
  }
});

router.get('/stats', auth, async (req, res) => {
  try {
    const [callsToday, followups, firms] = await Promise.all([
      db.query('SELECT COUNT(*) FROM calls WHERE user_id=$1 AND call_date::date=CURRENT_DATE', [req.user.id]),
      db.query('SELECT COUNT(*) FROM calls WHERE user_id=$1 AND followup_date IS NOT NULL', [req.user.id]),
      db.query('SELECT COUNT(DISTINCT company_id) FROM calls WHERE user_id=$1', [req.user.id])
    ]);
    res.json({
      calls_today: parseInt(callsToday.rows[0].count),
      followups: parseInt(followups.rows[0].count),
      firms: parseInt(firms.rows[0].count)
    });
  } catch (err) {
    res.status(500).json({ error: 'Statistika päring ebaõnnestus' });
  }
});

module.exports = router;

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
        model: 'claude-sonnet-4-5',
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
  const { company_id, contact_name, contact_phone, comment, raw_comment, followup_date, status, card_ordered, card_type } = req.body;
  try {
    const result = await db.query(
      `INSERT INTO calls (user_id,company_id,contact_name,contact_phone,comment,raw_comment,followup_date,status,card_ordered,card_type)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [req.user.id, company_id, contact_name, contact_phone, comment, raw_comment, followup_date || null, status || 'logged', card_ordered || false, card_type || null]
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

router.post('/:id/card', auth, async (req, res) => {
  const { card_type, comment } = req.body;
  try {
    await db.query(
      'UPDATE calls SET card_ordered=TRUE, card_type=$1 WHERE id=$2 AND user_id=$3',
      [card_type, req.params.id, req.user.id]
    );
    await db.query(
      `INSERT INTO calls (user_id,company_id,contact_name,contact_phone,comment,raw_comment,status,card_ordered,card_type)
       SELECT user_id,company_id,contact_name,contact_phone,$1,$1,'logged',TRUE,$2 FROM calls WHERE id=$3`,
      [comment, card_type, req.params.id]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Kaardi tellimus ebaõnnestus' });
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

router.get('/company/:company_id', auth, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT c.*, co.name as company_name, co.legal_name, co.sector,
              co.reg_number, co.address, co.credit_score, co.credit_limit,
              co.credit_days, co.credit_summary
       FROM calls c
       LEFT JOIN companies co ON c.company_id = co.id
       WHERE c.company_id = $1 AND c.user_id = $2
       ORDER BY c.call_date DESC`,
      [req.params.company_id, req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Päring ebaõnnestus' });
  }
});

router.get('/', auth, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT c.*, co.name as company_name, co.legal_name, co.sector,
              co.reg_number, co.address,
              co.credit_score, co.credit_limit, co.credit_days, co.credit_summary
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

router.put('/:id', auth, async (req, res) => {
  const { comment, followup_date } = req.body;
  try {
    await db.query(
      'UPDATE calls SET comment=$1, followup_date=$2 WHERE id=$3 AND user_id=$4',
      [comment, followup_date || null, req.params.id, req.user.id]
    );
    if (followup_date) {
      await db.query(
        `INSERT INTO calendar_events (user_id,call_id,title,event_date,description)
         VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT (call_id) DO UPDATE SET event_date=$4, description=$5`,
        [req.user.id, req.params.id, 'Järelkõne', followup_date, comment]
      );
    } else {
      await db.query('DELETE FROM calendar_events WHERE call_id=$1 AND user_id=$2', [req.params.id, req.user.id]);
    }
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Uuendamine ebaõnnestus' });
  }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    await db.query('DELETE FROM calendar_events WHERE call_id=$1 AND user_id=$2', [req.params.id, req.user.id]);
    await db.query('DELETE FROM calls WHERE id=$1 AND user_id=$2', [req.params.id, req.user.id]);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Kustutamine ebaõnnestus' });
  }
});

module.exports = router;

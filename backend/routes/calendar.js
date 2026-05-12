const router = require('express').Router();
const db = require('../db');
const auth = require('../middleware/auth');

router.get('/', auth, async (req, res) => {
  const { month, year } = req.query;
  try {
    const result = await db.query(
      `SELECT e.*, c.contact_name, co.name as company_name
       FROM calendar_events e
       LEFT JOIN calls c ON e.call_id = c.id
       LEFT JOIN companies co ON c.company_id = co.id
       WHERE e.user_id = $1
         AND EXTRACT(MONTH FROM e.event_date) = $2
         AND EXTRACT(YEAR FROM e.event_date) = $3
       ORDER BY e.event_date`,
      [req.user.id, month || new Date().getMonth() + 1, year || new Date().getFullYear()]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Kalendri päring ebaõnnestus' });
  }
});

router.get('/today', auth, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT e.*, co.name as company_name, c.contact_name
       FROM calendar_events e
       LEFT JOIN calls c ON e.call_id = c.id
       LEFT JOIN companies co ON c.company_id = co.id
       WHERE e.user_id = $1 AND e.event_date = CURRENT_DATE`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Päring ebaõnnestus' });
  }
});

module.exports = router;

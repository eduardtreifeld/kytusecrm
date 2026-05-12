const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');

// Sisselogimine
router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const result = await db.query(
      'SELECT * FROM users WHERE username = $1', [username]
    );
    const user = result.rows[0];
    if (!user || !await bcrypt.compare(password, user.password_hash)) {
      return res.status(401).json({ error: 'Vale kasutajanimi või parool' });
    }
    const token = jwt.sign(
      { id: user.id, username: user.username, full_name: user.full_name, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );
    res.json({ token, user: { id: user.id, username: user.username, full_name: user.full_name, role: user.role } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Serveri viga' });
  }
});

// Uue kasutaja lisamine (ainult admin)
router.post('/register', async (req, res) => {
  const { username, password, full_name, email } = req.body;
  try {
    const hash = await bcrypt.hash(password, 10);
    const result = await db.query(
      'INSERT INTO users (username, password_hash, full_name, email) VALUES ($1,$2,$3,$4) RETURNING id, username, full_name',
      [username, hash, full_name, email]
    );
    res.json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(400).json({ error: 'Kasutajanimi on juba olemas' });
    res.status(500).json({ error: 'Serveri viga' });
  }
});

module.exports = router;

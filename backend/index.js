require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { startCronJobs } = require('./services/cron');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// API marsruudid
app.use('/api/auth', require('./routes/auth'));
app.use('/api/companies', require('./routes/companies'));
app.use('/api/calls', require('./routes/calls'));
app.use('/api/calendar', require('./routes/calendar'));

// Tervise kontroll Railway jaoks
app.get('/health', (req, res) => res.json({ status: 'ok', time: new Date() }));

// Serveeri React frontendit (tootmiskeskkonnas)
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../frontend/dist')));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/dist/index.html'));
  });
}

// Käivita cron tööd
startCronJobs();

app.listen(PORT, () => {
  console.log(`KütuseCRM server käivitatud pordil ${PORT}`);
});

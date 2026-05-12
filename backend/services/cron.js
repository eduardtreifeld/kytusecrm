const cron = require('node-cron');
const nodemailer = require('nodemailer');
const db = require('../db');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

async function sendDailyReminders() {
  console.log('[Cron] Kontrollin tänaseid järeltegevusi...');
  try {
    // Leia kõik tänased kalendrisündmused koos kasutaja e-postiga
    const result = await db.query(`
      SELECT e.*, u.email, u.full_name,
             co.name as company_name, c.contact_name, c.contact_phone
      FROM calendar_events e
      JOIN users u ON e.user_id = u.id
      LEFT JOIN calls c ON e.call_id = c.id
      LEFT JOIN companies co ON c.company_id = co.id
      WHERE e.event_date = CURRENT_DATE
        AND e.reminder_sent = FALSE
    `);

    if (result.rows.length === 0) {
      console.log('[Cron] Tänaseid meeldetuletusi pole.');
      return;
    }

    // Grupeeri kasutaja järgi
    const byUser = {};
    result.rows.forEach(row => {
      if (!byUser[row.email]) byUser[row.email] = { name: row.full_name, events: [] };
      byUser[row.email].events.push(row);
    });

    // Saada iga kasutajale e-post
    for (const [email, data] of Object.entries(byUser)) {
      const eventList = data.events.map(e =>
        `• ${e.company_name || 'Firma'} — ${e.contact_name || 'Kontakt'} (${e.contact_phone || ''})\n  ${e.title}`
      ).join('\n');

      const mailOptions = {
        from: `KütuseCRM <${process.env.SMTP_USER}>`,
        to: email,
        subject: `⛽ Tänased järeltegevused — ${new Date().toLocaleDateString('et-EE')}`,
        text: `Tere, ${data.name}!\n\nTäna on sul ${data.events.length} järeltegevus${data.events.length > 1 ? 't' : ''}:\n\n${eventList}\n\nHead müüki!\nKütuseCRM`,
        html: `
          <div style="font-family:Arial,sans-serif;max-width:500px">
            <h2 style="color:#1a1a1a">⛽ Tänased järeltegevused</h2>
            <p>Tere, <strong>${data.name}</strong>!</p>
            <p>Täna on sul <strong>${data.events.length}</strong> järeltegevus${data.events.length > 1 ? 't' : ''}:</p>
            <div style="background:#f5f5f5;padding:16px;border-radius:8px;margin:16px 0">
              ${data.events.map(e => `
                <div style="margin-bottom:12px;padding-bottom:12px;border-bottom:1px solid #e0e0e0">
                  <strong>${e.company_name || 'Firma'}</strong><br>
                  ${e.contact_name || ''} ${e.contact_phone ? '· ' + e.contact_phone : ''}<br>
                  <span style="color:#666;font-size:14px">${e.title}</span>
                </div>
              `).join('')}
            </div>
            <p style="color:#888;font-size:13px">Head müüki! — KütuseCRM</p>
          </div>
        `
      };

      await transporter.sendMail(mailOptions);
      console.log(`[Cron] Meeldetuletus saadetud: ${email}`);
    }

    // Märgi meeldetuletused saadetud
    const ids = result.rows.map(r => r.id);
    await db.query(
      `UPDATE calendar_events SET reminder_sent=TRUE WHERE id=ANY($1)`,
      [ids]
    );

  } catch (err) {
    console.error('[Cron] Viga meeldetuletuste saatmisel:', err);
  }
}

function startCronJobs() {
  // Iga päev kell 07:30 Eesti aja järgi (UTC+3 = 04:30 UTC)
  cron.schedule('30 4 * * *', sendDailyReminders, {
    timezone: 'Europe/Tallinn'
  });
  console.log('[Cron] Meeldetuletuste ajastus käivitatud (07:30 EET)');
}

module.exports = { startCronJobs };

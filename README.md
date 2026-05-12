# ⛽ KütuseCRM — Paigaldusjuhend

## Failide struktuur
```
kutusecrm/
├── backend/          ← Node.js API server
│   ├── index.js      ← Peamine serveri fail
│   ├── schema.sql    ← Andmebaasi struktuur
│   ├── db.js         ← Andmebaasi ühendus
│   ├── routes/       ← API lõpp-punktid
│   └── services/     ← Cron meeldetuletused
├── frontend/         ← React kasutajaliides
│   └── src/
│       ├── pages/    ← Leheküljed
│       └── services/ ← API teenus
├── railway.toml      ← Railway seadistus
└── .gitignore
```

---

## 1. samm — GitHub

1. Mine https://github.com ja loo uus repositoorium nimega `kutusecrm`
2. Ära lisa README ega .gitignore (on juba olemas)
3. Laadi kõik failid üles:
```bash
git init
git add .
git commit -m "KütuseCRM esimene versioon"
git branch -M main
git remote add origin https://github.com/SINUNIMI/kutusecrm.git
git push -u origin main
```

---

## 2. samm — Railway PostgreSQL andmebaas

1. Mine https://railway.app → sinu projekt
2. Vajuta **"+ New Service"** → **"Database"** → **"PostgreSQL"**
3. Oodake kuni andmebaas käivitub (~30 sek)
4. Kliki andmebaasil → **"Query"** tab
5. Kopeeri sinna `backend/schema.sql` sisu ja käivita

---

## 3. samm — Railway veebirakendus

1. Samas projektis vajuta **"+ New Service"** → **"GitHub Repo"**
2. Vali `kutusecrm` repositoorium
3. Railway avastab automaatselt `railway.toml` ja teab kuidas ehitada

---

## 4. samm — Keskkonnamuutujad Railway's

Mine oma veebiteenuse juurde → **"Variables"** ja lisa:

| Muutuja | Väärtus |
|---------|---------|
| `DATABASE_URL` | (Railway annab automaatselt PostgreSQL URL) |
| `JWT_SECRET` | Genereeri: `openssl rand -hex 32` |
| `ANTHROPIC_API_KEY` | Su Anthropic API võti (https://console.anthropic.com) |
| `SMTP_HOST` | `smtp.gmail.com` |
| `SMTP_PORT` | `587` |
| `SMTP_USER` | Su Gmaili aadress |
| `SMTP_PASS` | Gmail rakenduse parool (mitte tavaparool!) |
| `NODE_ENV` | `production` |

### Gmail rakenduse parooli saamine:
1. Mine Google konto → Turvalisus → 2-astmeline kinnitamine (lülita sisse)
2. Otsi "Rakenduse paroolid" → Loo uus → Nimeta "KütuseCRM"
3. Kopeeri 16-kohaline parool → pane `SMTP_PASS` väärtuseks

### DATABASE_URL automaatne lisamine:
- Mine Railway → PostgreSQL teenus → **"Variables"**
- Kopeeri `DATABASE_URL` väärtus
- Lisa see oma veebiteenuse Variables alla

---

## 5. samm — Kasutajate loomine

Pärast deploy't mine Railway → veebiteenus → **"Shell"** ja käivita:

```bash
cd backend
node -e "
const bcrypt = require('bcryptjs');
const db = require('./db');
async function addUser() {
  const hash = await bcrypt.hash('PAROOL123', 10);
  await db.query(
    'INSERT INTO users (username, password_hash, full_name, email) VALUES (\$1,\$2,\$3,\$4)',
    ['margus', hash, 'Margus Tamm', 'margus@firma.ee']
  );
  console.log('Kasutaja lisatud!');
  process.exit(0);
}
addUser();
"
```

Korda iga müügimehe jaoks.

---

## 6. samm — Domeeni lisamine (hiljem)

1. Osta domeen (nt. firmanimi.ee) — Zoneis, Domainr jne
2. Railway → veebiteenus → **"Settings"** → **"Custom Domain"**
3. Lisa oma domeen ja kopeeri CNAME kirje oma domeenipakkujasse

---

## Kasutamine

- **Avaleht**: statistika + viimased kõned
- **+ Uus kõne**: 3-sammuline protsess — firma otsing → kontakt → AI kommentaar
- **Kalender**: järeltegevused kuupäeva järgi
- **Meeldetuletused**: automaatselt iga päev kell 07:30 e-postile

---

## Tulevased täiustused (plaanis)
- [ ] Admin vaade kõigi müügimeeste statistikaga
- [ ] Brauseri push-teavitused
- [ ] Firma detailvaade kõigi kõnede ajalooga
- [ ] Export Excelisse
- [ ] Mobiilirakendus (React Native)

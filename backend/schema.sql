-- KütuseCRM andmebaasi skeem
-- Käivita Railway PostgreSQL konsoolis

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(100) NOT NULL,
  email VARCHAR(150) UNIQUE NOT NULL,
  role VARCHAR(20) DEFAULT 'agent',
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS companies (
  id SERIAL PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  legal_name VARCHAR(200),
  reg_number VARCHAR(50),
  address TEXT,
  sector VARCHAR(200),
  email VARCHAR(150),
  phone VARCHAR(50),
  website VARCHAR(200),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS calls (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  company_id INTEGER REFERENCES companies(id),
  contact_name VARCHAR(100),
  contact_phone VARCHAR(50),
  comment TEXT,
  raw_comment TEXT,
  followup_date DATE,
  call_date TIMESTAMP DEFAULT NOW(),
  status VARCHAR(50) DEFAULT 'logged'
);

CREATE TABLE IF NOT EXISTS calendar_events (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  call_id INTEGER REFERENCES calls(id),
  title VARCHAR(200),
  event_date DATE NOT NULL,
  description TEXT,
  reminder_sent BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Vaikimisi admin kasutaja (parool: admin123 - muuda kohe!)
INSERT INTO users (username, password_hash, full_name, email, role)
VALUES ('admin', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Admin', 'admin@yourcompany.ee', 'admin')
ON CONFLICT DO NOTHING;

import { useState } from 'react';
import { api } from '../services/api';

export default function Login({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
    const res = await api.login(username, password);
    setLoading(false);
    if (res.token) {
      localStorage.setItem('crm_token', res.token);
      localStorage.setItem('crm_user', JSON.stringify(res.user));
      onLogin(res.user);
    } else {
      setError(res.error || 'Sisselogimine ebaõnnestus');
    }
  }

  return (
    <div className="login-wrap">
      <div className="login-logo">
        <div className="icon">⛽</div>
        <h1>KütuseCRM</h1>
        <p>Müügimeeskonna tööriist</p>
      </div>
      <form onSubmit={handleLogin}>
        <div className="field">
          <label>Kasutajanimi</label>
          <input value={username} onChange={e => setUsername(e.target.value)} placeholder="kasutajanimi" autoFocus />
        </div>
        <div className="field">
          <label>Parool</label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••" />
        </div>
        {error && <div style={{ color: '#c0392b', fontSize: 13, marginBottom: 12 }}>{error}</div>}
        <button className="btn btn-primary btn-block" type="submit" disabled={loading}>
          {loading ? <><span className="spinner" />Sisenen...</> : 'Sisene'}
        </button>
      </form>
    </div>
  );
}

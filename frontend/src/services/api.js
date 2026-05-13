const BASE = '/api';

function getToken() {
  return localStorage.getItem('crm_token');
}

function headers() {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${getToken()}`
  };
}

async function req(method, path, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: headers(),
    body: body ? JSON.stringify(body) : undefined
  });
  if (res.status === 401) {
    localStorage.removeItem('crm_token');
    window.location.href = '/';
    return;
  }
  return res.json();
}

export const api = {
  login: (username, password) =>
    fetch(BASE + '/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    }).then(r => r.json()),

  searchCompany: (query) => req('POST', '/companies/search', { query }),
  saveCompany: (data) => req('POST', '/companies', data),
  getCompanies: () => req('GET', '/companies'),
  checkCredit: (companyId) => req('POST', `/companies/credit/${companyId}`),

  aiCorrect: (raw_comment, company_name, contact_name) =>
    req('POST', '/calls/ai-correct', { raw_comment, company_name, contact_name }),
  saveCall: (data) => req('POST', '/calls', data),
  getCalls: () => req('GET', '/calls'),
  getCallsByCompany: (companyId) => req('GET', `/calls/company/${companyId}`),
  getStats: () => req('GET', '/calls/stats'),
  updateCall: (id, data) => req('PUT', `/calls/${id}`, data),
  deleteCall: (id) => req('DELETE', `/calls/${id}`),

  getCalendar: (month, year) => req('GET', `/calendar?month=${month}&year=${year}`),
};

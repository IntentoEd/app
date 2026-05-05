// Wrapper de fetch que adiciona automaticamente o Firebase ID token
// no header Authorization. Usar nos componentes pra chamar APIs protegidas.

import { auth } from './firebase';

async function getIdToken() {
  try {
    // Espera o Firebase resolver o auth state inicial (auth.currentUser pode
    // estar null transitoriamente no mount, antes do onAuthStateChanged).
    // Sem isso, primeiro apiFetch após page load vai sem Bearer e pega 401.
    await auth.authStateReady();
    const user = auth.currentUser;
    if (!user) return null;
    return await user.getIdToken(/* forceRefresh */ false);
  } catch (e) {
    console.warn('[api] getIdToken falhou:', e.message);
    return null;
  }
}

export async function apiFetch(url, options = {}) {
  const headers = { ...(options.headers || {}) };
  const token = await getIdToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return fetch(url, { ...options, headers });
}

// Helper conveniente pra POST em /api/mentor com uma `acao`.
// Auto-adiciona Content-Type, o Bearer, checa HTTP status e devolve data.
// - HTTP !2xx → joga Error('http_<status>') pra forçar tratamento no caller.
// - data.status === 'erro' → joga Error(data.mensagem) (mesmo tratamento do GAS).
// Use try/catch no caller. Pra checagens granulares, use apiFetch direto.
export async function callMentor(acao, body = {}) {
  const res = await apiFetch('/api/mentor', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ acao, ...body }),
  });
  if (!res.ok) {
    let detalhe = '';
    try { detalhe = (await res.json()).mensagem || ''; } catch {}
    throw new Error('http_' + res.status + (detalhe ? ': ' + detalhe : ''));
  }
  const data = await res.json();
  if (data && data.status === 'erro') {
    throw new Error(data.mensagem || 'erro_gas');
  }
  return data;
}

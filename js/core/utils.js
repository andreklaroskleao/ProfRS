export const ADMIN_UID = 'REPLACE_WITH_YOUR_FIREBASE_UID';

export function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}

export function formatDate(value, options = { day: '2-digit', month: 'short', year: 'numeric' }) {
  if (!value) return '—';
  const date = typeof value?.toDate === 'function' ? value.toDate() : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('pt-BR', options).format(date);
}

export function safeHttpsUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' ? url.href : null;
  } catch {
    return null;
  }
}

export function notify(message, type = 'success', duration = 4200) {
  const region = document.querySelector('#toast-region');
  if (!region) return;
  const toast = document.createElement('div');
  toast.className = `toast ${type === 'error' ? 'error' : type === 'info' ? 'info' : ''}`;
  toast.textContent = message;
  region.append(toast);
  window.setTimeout(() => toast.remove(), duration);
}

export function errorMessage(error) {
  const messages = {
    'auth/unauthorized-domain': 'Este domínio ainda não está autorizado no Firebase Authentication.',
    'auth/popup-closed-by-user': 'A janela de login foi fechada antes da conclusão.',
    'auth/popup-blocked': 'O navegador bloqueou a janela de login. Permita pop-ups e tente novamente.',
    'permission-denied': 'O Firebase recusou esta operação. Confira as regras e as permissões da sua conta.',
    'unavailable': 'O Firebase está temporariamente indisponível. Tente novamente em instantes.',
    'resource-exhausted': 'O limite de utilização do Firestore foi atingido. Tente novamente após a renovação da cota.',
    'failed-precondition': 'O Firestore precisa de configuração adicional para esta consulta. Confira os índices indicados no projeto.'
  };
  return messages[error?.code] || error?.message || 'Não foi possível concluir a operação. Confira sua conexão e tente novamente.';
}

export function asLines(value) {
  return String(value || '').split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
}


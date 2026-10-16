const pageTitles = {
  inicio: 'Painel inicial',
  jornada: 'Jornada e finanças',
  remuneracao: 'Consulta salarial',
  planejamento: 'Planejamento pedagógico',
  pei: 'Plano Educacional Individualizado',
  noticias: 'Notícias e documentos oficiais',
  admin: 'Administração master',
  privacidade: 'Privacidade e uso responsável'
};

export function setActiveNavigation(view) {
  document.querySelectorAll('[data-view]').forEach((button) => {
    button.classList.toggle('is-active', button.dataset.view === view);
  });
  document.querySelector('#topbar-title').textContent = pageTitles[view] || 'ProfRS';
}

export function showMainView(view) {
  document.querySelector('#welcome-view').hidden = true;
  document.querySelector('#public-view').hidden = true;
  document.querySelector('#app-view').hidden = false;
  setActiveNavigation(view);
  document.querySelector('#sidebar').classList.remove('is-open');
  document.querySelector('#mobile-menu').setAttribute('aria-expanded', 'false');
}

export function showWelcome() {
  document.querySelector('#welcome-view').hidden = false;
  document.querySelector('#public-view').hidden = true;
  document.querySelector('#app-view').hidden = true;
}

export function showPublic() {
  document.querySelector('#welcome-view').hidden = true;
  document.querySelector('#app-view').hidden = true;
  document.querySelector('#public-view').hidden = false;
}


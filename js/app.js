import { settleGoogleRedirect, signInWithGoogle, signOutUser, watchAuth } from './firebase/auth.js';
import { ensureUserProfile } from './firebase/firestore.js';
import { ADMIN_UID, errorMessage, notify, escapeHtml } from './core/utils.js';
import { showMainView, showPublic, showWelcome } from './core/router.js';
import { mountJornada } from './modules/jornada.js';
import { mountRemuneracao } from './modules/remuneracao.js';
import { mountPlanejamento } from './modules/planejamento.js';
import { mountPei } from './modules/pei.js';
import { mountNoticias } from './modules/noticias.js';
import { mountAdmin } from './modules/admin.js';

let currentUser = null;
let activeRoute = null;
const main = document.querySelector('#main-content');

function dashboardMarkup(user) {
  const firstName = (user.displayName || 'professor(a)').trim().split(/\s+/)[0];
  return `<section class="hero-panel"><p class="section-kicker">UM BOM DIA COMEÇA COM UM PLANO POSSÍVEL</p><h1>Olá, ${escapeHtml(firstName)}.</h1><p>Que bom ter você por aqui. Escolha uma ferramenta e siga no seu ritmo.</p></section><section class="dashboard-grid" aria-label="Módulos do ProfRS"><button class="module-card" data-view="jornada" type="button"><span class="module-card-icon">◷</span><span class="arrow" aria-hidden="true">↗</span><h3>Jornada e finanças</h3><p>Calcule limites de jornada e consulte referências remuneratórias.</p></button><button class="module-card" data-view="planejamento" type="button"><span class="module-card-icon">▤</span><span class="arrow" aria-hidden="true">↗</span><h3>Planejamento pedagógico</h3><p>Organize objetivos, conteúdos, estratégias e avaliação.</p></button><button class="module-card" data-view="pei" type="button"><span class="module-card-icon">◎</span><span class="arrow" aria-hidden="true">↗</span><h3>PEI</h3><p>Estruture objetivos e acompanhamentos com atenção à privacidade.</p></button><button class="module-card" data-view="noticias" type="button"><span class="module-card-icon">◫</span><span class="arrow" aria-hidden="true">↗</span><h3>Notícias e documentos</h3><p>Acesse notícias publicadas e referências de fontes informadas.</p></button></section><div class="notice-strip"><strong>Seus registros são privados.</strong> Planejamentos e PEIs ficam sob o UID da sua conta; evite inserir dados pessoais desnecessários.</div>`;
}

async function navigate(route, force = false) {
  if (!force && route === activeRoute) return;
  activeRoute = route;
  if (!currentUser) {
    if (route === 'remuneracao' || route === 'noticias') {
      showPublic();
      const root = document.querySelector('#public-content');
      try {
        if (route === 'remuneracao') await mountRemuneracao(root);
        else await mountNoticias(root, { publicPage: true });
      } catch (error) { root.innerHTML = `<div class="empty-state"><strong>Não foi possível abrir esta seção.</strong><p>${escapeHtml(errorMessage(error))}</p></div>`; }
      return;
    }
    showWelcome();
    return;
  }
  showMainView(route);
  if (route === 'inicio') { main.innerHTML = dashboardMarkup(currentUser); return; }
  if (route === 'jornada') { mountJornada(main); return; }
  if (route === 'remuneracao') { await mountRemuneracao(main); return; }
  if (route === 'planejamento') { await mountPlanejamento(main); return; }
  if (route === 'pei') { await mountPei(main); return; }
  if (route === 'noticias') { await mountNoticias(main); return; }
  if (route === 'admin') { await mountAdmin(main, currentUser, ADMIN_UID); return; }
  if (route === 'privacidade') { main.innerHTML = `<article class="privacy-page"><p class="section-kicker">PRIVACIDADE E USO RESPONSÁVEL</p><h1>Seus dados pedem cuidado.</h1><p>Planejamentos e PEIs são guardados na conta Firebase associada ao seu UID. As regras do Firestore restringem esses registros ao mesmo UID autenticado.</p><h2>Use o mínimo necessário</h2><ul><li>Prefira um código interno para identificar estudantes.</li><li>Não registre diagnósticos médicos detalhados ou informações que não sejam necessárias à finalidade pedagógica.</li><li>Não compartilhe sua sessão nem o acesso ao dispositivo.</li><li>Exclusão de um PEI no app remove o registro correspondente no Firestore.</li></ul><h2>Escopo da ferramenta</h2><p>O ProfRS é uma ferramenta de apoio independente. O usuário continua responsável por observar as normas institucionais e os cuidados aplicáveis à LGPD.</p><button class="button button-quiet" data-view="inicio" type="button">Voltar ao painel</button></article>`; }
}

document.addEventListener('click', async (event) => {
  if (event.target.closest('#privacy-link')) { event.preventDefault(); await navigate('privacidade', true); return; }
  const publicButton = event.target.closest('[data-public-view]');
  if (publicButton) { await navigate(publicButton.dataset.publicView, true); return; }
  if (event.target.closest('#public-back')) { activeRoute = null; showWelcome(); return; }
  const navButton = event.target.closest('[data-view]');
  if (navButton) { await navigate(navButton.dataset.view, true); return; }
  if (event.target.closest('#google-signin')) {
    const button = document.querySelector('#google-signin');
    button.disabled = true;
    try { await signInWithGoogle(); }
    catch (error) { notify(errorMessage(error), 'error', 6500); }
    finally { button.disabled = false; }
    return;
  }
  if (event.target.closest('#signout')) {
    try { await signOutUser(); activeRoute = null; notify('Você saiu da sua conta.'); }
    catch (error) { notify(errorMessage(error), 'error'); }
    return;
  }
  if (event.target.closest('#mobile-menu')) {
    const sidebar = document.querySelector('#sidebar');
    const button = document.querySelector('#mobile-menu');
    const isOpen = sidebar.classList.toggle('is-open');
    button.setAttribute('aria-expanded', String(isOpen));
    button.setAttribute('aria-label', isOpen ? 'Fechar menu' : 'Abrir menu');
  }
});

try { await settleGoogleRedirect(); } catch (error) { notify(errorMessage(error), 'error', 6500); }
watchAuth(async (user) => {
  currentUser = user;
  activeRoute = null;
  if (user) {
    document.querySelector('#user-name').textContent = user.displayName || user.email || 'Professor(a)';
    const avatar = document.querySelector('#user-avatar');
    if (user.photoURL) { avatar.src = user.photoURL; avatar.hidden = false; } else { avatar.hidden = true; }
    document.querySelector('#admin-nav').hidden = user.uid !== ADMIN_UID || ADMIN_UID === 'REPLACE_WITH_YOUR_FIREBASE_UID';
    try { await ensureUserProfile(user); } catch (error) { notify(`Sessão iniciada. O perfil não foi salvo: ${errorMessage(error)}`, 'error', 6500); }
    await navigate('inicio', true);
  } else {
    document.querySelector('#admin-nav').hidden = true;
    showWelcome();
  }
});

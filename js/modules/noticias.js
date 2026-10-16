import { getActiveLinks, getPublishedNews } from '../firebase/firestore.js';
import { escapeHtml, formatDate, safeHttpsUrl, errorMessage } from '../core/utils.js';

export async function mountNoticias(root, { publicPage = false } = {}) {
  root.innerHTML = `${publicPage ? '' : '<div class="page-heading"><div><p class="section-kicker">MÓDULO 4 · INFORMAÇÃO E REFERÊNCIAS</p><h1>Notícias e documentos</h1><p>Conteúdo cadastrado por administradores, com identificação da fonte original.</p></div></div>'}<section class="panel" style="margin-bottom:18px"><div class="panel-header"><div><h2>Notícias recentes</h2><p class="small muted" style="margin:5px 0 0">Confira sempre a publicação original no site da instituição.</p></div></div><div class="toolbar"><input id="news-search" type="search" placeholder="Buscar nas notícias carregadas" aria-label="Buscar nas notícias"><select id="news-category" aria-label="Filtrar por categoria"><option value="">Todas as categorias</option></select></div><div id="news-list"><p class="loading-state">Carregando notícias publicadas…</p></div><div class="form-actions"><button id="news-more" class="button button-quiet" type="button" hidden>Carregar mais notícias</button></div></section><section class="panel"><div class="panel-header"><div><h2>Links oficiais</h2><p class="small muted" style="margin:5px 0 0">Links cadastrados e revisados pelo administrador.</p></div></div><div id="official-links"><p class="loading-state">Carregando links…</p></div></section><p class="small muted" style="margin-top:15px">O ProfRS organiza referências e não representa os órgãos e entidades citados.</p>`;
  const newsRoot = root.querySelector('#news-list');
  const linksRoot = root.querySelector('#official-links');
  const moreButton = root.querySelector('#news-more');
  const categorySelect = root.querySelector('#news-category');
  let items = [];
  let cursor = null;
  let hasMore = false;

  const renderNews = () => {
    const term = root.querySelector('#news-search').value.trim().toLowerCase();
    const category = categorySelect.value;
    const filtered = items.filter((item) => (!category || item.category === category) && (!term || `${item.title || ''} ${item.summary || ''} ${item.content || ''} ${item.sourceName || ''}`.toLowerCase().includes(term)));
    if (!filtered.length) {
      newsRoot.innerHTML = `<div class="empty-state"><strong>${items.length ? 'Nenhuma notícia encontrada.' : 'Ainda não há notícias publicadas.'}</strong><p>${items.length ? 'Ajuste os filtros ou carregue mais itens.' : 'Quando o administrador publicar conteúdo, ele aparecerá neste espaço.'}</p></div>`;
    } else {
      newsRoot.innerHTML = `<div class="news-grid">${filtered.map((item) => {
        const source = safeHttpsUrl(item.sourceUrl);
        return `<article class="news-card"><span class="status-pill">${escapeHtml(item.category || 'Notícia')}</span><p class="news-date">${escapeHtml(formatDate(item.publishedAt))}${item.updatedAt ? ` · Atualizada ${escapeHtml(formatDate(item.updatedAt))}` : ''}</p><h3>${escapeHtml(item.title)}</h3><p class="summary">${escapeHtml(item.summary || '')}</p><details><summary class="small">Ler conteúdo</summary><div class="news-content small">${escapeHtml(item.content || '')}</div></details><p class="news-source">Fonte: ${escapeHtml(item.sourceName || 'não informada')}${source ? ` · <a href="${escapeHtml(source)}" target="_blank" rel="noopener noreferrer">publicação original ↗</a>` : ''}</p></article>`;
      }).join('')}</div>`;
    }
    moreButton.hidden = !hasMore;
  };

  const loadPage = async (next = false) => {
    moreButton.disabled = true;
    try {
      const page = await getPublishedNews({ cursor: next ? cursor : null, pageSize: 10 });
      items = next ? [...items, ...page.items] : page.items;
      cursor = page.cursor;
      hasMore = page.hasMore;
      const categories = [...new Set(items.map((item) => item.category).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
      const selected = categorySelect.value;
      categorySelect.innerHTML = '<option value="">Todas as categorias</option>' + categories.map((name) => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join('');
      categorySelect.value = selected;
      renderNews();
    } catch (error) {
      newsRoot.innerHTML = `<div class="empty-state"><strong>Não foi possível carregar as notícias.</strong><p>${escapeHtml(errorMessage(error))}</p></div>`;
      moreButton.hidden = true;
    } finally { moreButton.disabled = false; }
  };

  root.querySelector('#news-search').addEventListener('input', renderNews);
  categorySelect.addEventListener('change', renderNews);
  moreButton.addEventListener('click', () => loadPage(true));
  try {
    const links = await getActiveLinks(60);
    linksRoot.innerHTML = links.length ? `<div class="link-grid">${links.map((link) => {
      const url = safeHttpsUrl(link.url);
      return `<article class="official-link"><span class="status-pill">${escapeHtml(link.category || 'Referência')}</span><h3>${escapeHtml(link.title)}</h3><p>${escapeHtml(link.description || '')}</p><p class="record-meta">${escapeHtml(link.institution || '')}</p>${url ? `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">Abrir fonte ↗</a>` : '<span class="small muted">Link indisponível</span>'}</article>`;
    }).join('')}</div>` : '<div class="empty-state"><strong>Nenhum link cadastrado.</strong><p>Os links oficiais serão exibidos quando forem adicionados pelo administrador.</p></div>';
  } catch (error) {
    linksRoot.innerHTML = `<div class="empty-state"><strong>Não foi possível carregar os links.</strong><p>${escapeHtml(errorMessage(error))}</p></div>`;
  }
  await loadPage(false);
}

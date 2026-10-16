import { listAdminRecords, removeAdminRecord, saveAdminRecord } from '../firebase/firestore.js';
import { escapeHtml, formatDate, safeHttpsUrl, notify, errorMessage } from '../core/utils.js';
import { downloadCsv } from '../core/export.js';

const tabs = [
  ['news', 'Notícias'],
  ['officialLinks', 'Links oficiais'],
  ['salaryTables', 'Tabelas salariais']
];

const localDateTime = (value) => {
  if (!value) return '';
  const date = typeof value?.toDate === 'function' ? value.toDate() : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};

export async function mountAdmin(root, user, adminUid) {
  if (!adminUid || adminUid === 'REPLACE_WITH_YOUR_FIREBASE_UID' || user.uid !== adminUid) {
    root.innerHTML = `<div class="page-heading"><div><p class="section-kicker">ÁREA RESTRITA</p><h1>Administração master</h1></div></div><div class="notice-box">A administração está bloqueada até configurar o UID do proprietário em <code>js/core/utils.js</code> e em <code>firestore.rules</code>. Não use e-mail ou nome para definir privilégios.</div>`;
    return;
  }

  let activeTab = 'news';
  let records = [];
  let editId = null;
  root.innerHTML = `<div class="page-heading"><div><p class="section-kicker">ACESSO EXCLUSIVO AO UID MASTER</p><h1>Administração</h1><p>Cadastre e mantenha referências públicas. As regras do Firestore também validam cada gravação.</p></div></div><div class="admin-tabs" role="tablist" aria-label="Tipo de conteúdo">${tabs.map(([id, label], index) => `<button class="tab-button ${index === 0 ? 'is-active' : ''}" role="tab" aria-selected="${index === 0}" data-tab="${id}" type="button">${label}</button>`).join('')}</div><section class="panel"><div id="admin-form-area"></div></section><section class="panel" style="margin-top:17px"><div class="panel-header"><h2 id="admin-list-title">Notícias cadastradas</h2><div class="record-actions"><button id="admin-export" class="button button-secondary button-small" type="button" hidden>Exportar CSV</button><button id="admin-refresh" class="button button-quiet button-small" type="button">Atualizar lista</button></div></div><div id="admin-list" class="record-list"><p class="loading-state">Carregando conteúdo…</p></div></section>`;
  const formArea = root.querySelector('#admin-form-area');
  const list = root.querySelector('#admin-list');
  const listTitle = root.querySelector('#admin-list-title');

  const resetForm = () => { editId = null; renderForm(); };
  const renderForm = (record = {}) => {
    const newsForm = `<form id="admin-form"><div class="panel-header"><h2>${editId ? 'Editar notícia' : 'Cadastrar notícia'}</h2>${editId ? '<button class="button button-quiet button-small" type="button" data-cancel-edit>Cancelar edição</button>' : ''}</div><div class="field-grid"><div class="field"><label for="content-title">Título</label><input id="content-title" name="title" maxlength="180" required value="${escapeHtml(record.title || '')}"></div><div class="field"><label for="content-category">Categoria</label><input id="content-category" name="category" list="news-categories" maxlength="60" required value="${escapeHtml(record.category || '')}"><datalist id="news-categories"><option>SEDUC-RS</option><option>CPERS</option><option>Legislação</option><option>Calendário escolar</option><option>Orientações pedagógicas</option><option>Outros</option></datalist></div></div><div class="field"><label for="content-summary">Resumo</label><textarea id="content-summary" name="summary" maxlength="500" required>${escapeHtml(record.summary || '')}</textarea></div><div class="field"><label for="content-body">Conteúdo</label><textarea id="content-body" name="content" maxlength="12000" required>${escapeHtml(record.content || '')}</textarea></div><div class="field-grid"><div class="field"><label for="content-source">Fonte</label><input id="content-source" name="sourceName" maxlength="120" required value="${escapeHtml(record.sourceName || '')}"></div><div class="field"><label for="content-url">URL da fonte (HTTPS)</label><input id="content-url" name="sourceUrl" type="url" inputmode="url" placeholder="https://" required value="${escapeHtml(record.sourceUrl || '')}"></div><div class="field"><label for="content-status">Situação</label><select id="content-status" name="status"><option value="draft">Rascunho</option><option value="published">Publicada</option><option value="archived">Arquivada</option></select></div><div class="field"><label for="content-published">Data de publicação</label><input id="content-published" name="publishedAt" type="datetime-local" value="${escapeHtml(localDateTime(record.publishedAt) || localDateTime(new Date()))}"></div></div><div class="field"><span class="field-label">Prévia da notícia</span><div class="preview-box"><strong id="news-preview-title">${escapeHtml(record.title || 'Título da notícia')}</strong><p id="news-preview-summary" class="small muted">${escapeHtml(record.summary || 'O resumo será exibido aqui.')}</p><div id="news-preview-content" class="small">${escapeHtml(record.content || 'O conteúdo será exibido aqui.')}</div></div></div><div id="admin-message" aria-live="polite"></div><div class="form-actions"><button class="button button-primary" type="submit">Salvar notícia</button>${!editId ? '<button class="button button-quiet" type="reset">Limpar</button>' : ''}</div></form>`;
    const linkForm = `<form id="admin-form"><div class="panel-header"><h2>${editId ? 'Editar link oficial' : 'Cadastrar link oficial'}</h2>${editId ? '<button class="button button-quiet button-small" type="button" data-cancel-edit>Cancelar edição</button>' : ''}</div><div class="field-grid"><div class="field"><label for="link-title">Título</label><input id="link-title" name="title" maxlength="150" required value="${escapeHtml(record.title || '')}"></div><div class="field"><label for="link-institution">Instituição</label><input id="link-institution" name="institution" maxlength="120" required value="${escapeHtml(record.institution || '')}"></div><div class="field"><label for="link-category">Categoria</label><input id="link-category" name="category" maxlength="60" required placeholder="SEDUC-RS, BNCC, Legislação…" value="${escapeHtml(record.category || '')}"></div><div class="field"><label for="link-url">URL (HTTPS)</label><input id="link-url" name="url" type="url" inputmode="url" placeholder="https://" required value="${escapeHtml(record.url || '')}"></div><div class="field"><label for="link-order">Ordem de exibição</label><input id="link-order" name="order" type="number" min="0" max="9999" step="1" value="${escapeHtml(record.order ?? 0)}"></div><div class="field"><label for="link-active">Situação</label><select id="link-active" name="active"><option value="true">Ativo</option><option value="false">Inativo</option></select></div></div><div class="field"><label for="link-description">Descrição</label><textarea id="link-description" name="description" maxlength="500">${escapeHtml(record.description || '')}</textarea></div><div id="admin-message" aria-live="polite"></div><div class="form-actions"><button class="button button-primary" type="submit">Salvar link</button></div></form>`;
    const salaryForm = `<form id="admin-form"><div class="panel-header"><h2>${editId ? 'Editar referência salarial' : 'Cadastrar referência salarial'}</h2>${editId ? '<button class="button button-quiet button-small" type="button" data-cancel-edit>Cancelar edição</button>' : ''}</div><div class="field-grid three"><div class="field"><label for="salary-class">Classe ou nível</label><input id="salary-class" name="classLevel" maxlength="80" required value="${escapeHtml(record.classLevel || '')}"></div><div class="field"><label for="salary-reference">Referência</label><input id="salary-reference" name="reference" maxlength="80" required value="${escapeHtml(record.reference || '')}"></div><div class="field"><label for="salary-period">Vigência</label><input id="salary-period" name="effectivePeriod" maxlength="80" placeholder="Ex.: a partir de 01/2026" required value="${escapeHtml(record.effectivePeriod || '')}"></div><div class="field"><label for="salary-date">Data da vigência</label><input id="salary-date" name="effectiveAt" type="date" required value="${escapeHtml(String(record.effectiveAt || '').slice(0, 10))}"></div><div class="field"><label for="salary-hours">Carga horária semanal</label><input id="salary-hours" name="weeklyHours" type="number" min="1" max="80" step="1" required value="${escapeHtml(record.weeklyHours || '')}"></div><div class="field"><label for="salary-amount">Valor em reais</label><input id="salary-amount" name="amount" type="number" min="0" max="1000000" step="0.01" required value="${escapeHtml(record.amount ?? '')}"></div><div class="field"><label for="salary-type">Natureza do valor</label><select id="salary-type" name="amountType"><option>Subsídio</option><option>Vencimento básico</option><option>Remuneração bruta</option><option>Remuneração líquida</option></select></div><div class="field"><label for="salary-source">Fonte</label><input id="salary-source" name="sourceName" maxlength="120" required value="${escapeHtml(record.sourceName || '')}"></div><div class="field"><label for="salary-url">URL da fonte (HTTPS)</label><input id="salary-url" name="sourceUrl" type="url" inputmode="url" placeholder="https://" required value="${escapeHtml(record.sourceUrl || '')}"></div><div class="field"><label for="salary-status">Publicação</label><select id="salary-status" name="status"><option value="draft">Rascunho</option><option value="published">Publicado</option></select></div></div><div class="field"><label for="salary-notes">Observações</label><textarea id="salary-notes" name="notes" maxlength="1000">${escapeHtml(record.notes || '')}</textarea></div><div class="notice-box">Confirme que a fonte sustenta o valor, a carga horária e a natureza indicados antes de publicar.</div><div id="admin-message" aria-live="polite"></div><div class="form-actions"><button class="button button-primary" type="submit">Salvar referência</button></div></form>`;
    formArea.innerHTML = activeTab === 'news' ? newsForm : activeTab === 'officialLinks' ? linkForm : salaryForm;
    if (activeTab === 'news') {
      formArea.querySelector('[name="status"]').value = record.status || 'draft';
      ['title', 'summary', 'content'].forEach((name) => formArea.querySelector(`[name="${name}"]`).addEventListener('input', () => {
        formArea.querySelector(`#news-preview-${name === 'title' ? 'title' : name === 'summary' ? 'summary' : 'content'}`).textContent = formArea.querySelector(`[name="${name}"]`).value || (name === 'title' ? 'Título da notícia' : '');
      }));
    }
    if (activeTab === 'officialLinks') formArea.querySelector('[name="active"]').value = String(record.active ?? true);
    if (activeTab === 'salaryTables') {
      formArea.querySelector('[name="status"]').value = record.status || 'draft';
      formArea.querySelector('[name="amountType"]').value = record.amountType || 'Subsídio';
    }
    formArea.querySelector('#admin-form').addEventListener('reset', () => window.setTimeout(() => renderForm(), 0));
    formArea.querySelector('#admin-form').addEventListener('submit', submitForm);
  };

  async function submitForm(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());
    const message = form.querySelector('#admin-message');
    const button = form.querySelector('[type="submit"]');
    button.disabled = true;
    try {
      if (activeTab === 'news') {
        data.sourceUrl = safeHttpsUrl(data.sourceUrl);
        if (!data.sourceUrl) throw new Error('Informe uma URL de fonte que use HTTPS.');
        data.publishedAt = data.publishedAt ? new Date(data.publishedAt).toISOString() : new Date().toISOString();
      } else if (activeTab === 'officialLinks') {
        data.url = safeHttpsUrl(data.url);
        if (!data.url) throw new Error('Informe uma URL que use HTTPS.');
        data.active = data.active === 'true';
        data.order = Number(data.order);
      } else {
        data.sourceUrl = safeHttpsUrl(data.sourceUrl);
        if (!data.sourceUrl) throw new Error('Informe uma URL de fonte que use HTTPS.');
        data.amount = Number(data.amount);
        data.weeklyHours = Number(data.weeklyHours);
        data.effectiveAt = new Date(`${data.effectiveAt}T00:00:00`).toISOString();
      }
      await saveAdminRecord(activeTab, data, editId);
      notify(`${activeTab === 'news' ? 'Notícia' : activeTab === 'officialLinks' ? 'Link' : 'Referência salarial'} salva no Firestore.`);
      resetForm();
      await loadRecords();
    } catch (error) {
      message.innerHTML = `<p class="form-error" role="alert">${escapeHtml(errorMessage(error))} O formulário foi preservado; revise e tente novamente.</p>`;
    } finally { button.disabled = false; }
  }

  async function loadRecords() {
    const labels = { news: 'Notícias cadastradas', officialLinks: 'Links cadastrados', salaryTables: 'Referências salariais cadastradas' };
    listTitle.textContent = labels[activeTab];
    list.innerHTML = '<p class="loading-state">Carregando conteúdo…</p>';
    root.querySelector('#admin-export').hidden = true;
    try {
      records = await listAdminRecords(activeTab, 60);
      if (!records.length) { list.innerHTML = '<div class="empty-state"><strong>Nenhum item cadastrado.</strong><p>Use o formulário acima para adicionar o primeiro.</p></div>'; return; }
      root.querySelector('#admin-export').hidden = false;
      list.innerHTML = records.map((record) => {
        const title = record.title || `${record.classLevel || ''} · ${record.reference || ''}`;
        const detail = activeTab === 'news' ? `${record.category || ''} · ${record.sourceName || ''}` : activeTab === 'officialLinks' ? `${record.institution || ''} · ${record.category || ''}` : `${record.effectivePeriod || ''} · ${record.weeklyHours || ''}h · R$ ${record.amount ?? ''}`;
        const status = activeTab === 'news' || activeTab === 'salaryTables' ? record.status : record.active ? 'Ativo' : 'Inativo';
        return `<article class="record-card"><div style="display:flex;justify-content:space-between;gap:10px"><div><h3>${escapeHtml(title)}</h3><p>${escapeHtml(detail)}</p><p class="record-meta">${escapeHtml(status)} · Atualizado ${escapeHtml(formatDate(record.updatedAt))}</p></div><span class="status-pill ${status === 'published' || status === 'Ativo' ? 'success' : status === 'draft' ? 'warning' : ''}">${escapeHtml(status)}</span></div><div class="record-actions"><button class="button button-quiet button-small" data-action="edit" data-id="${escapeHtml(record.id)}" type="button">Editar</button><button class="button button-danger button-small" data-action="delete" data-id="${escapeHtml(record.id)}" type="button">Excluir</button></div></article>`;
      }).join('');
    } catch (error) { root.querySelector('#admin-export').hidden = true; list.innerHTML = `<div class="empty-state"><strong>Não foi possível carregar os itens.</strong><p>${escapeHtml(errorMessage(error))}</p></div>`; }
  }

  root.querySelector('#admin-export').addEventListener('click', () => {
    const exportDefinitions = {
      news: {
        filename: 'noticias-administrativas',
        headers: ['Título', 'Categoria', 'Fonte', 'URL da fonte', 'Data de publicação', 'Status', 'Resumo', 'Conteúdo'],
        rows: records.map((item) => [item.title, item.category, item.sourceName, item.sourceUrl, formatDate(item.publishedAt), item.status, item.summary, item.content])
      },
      officialLinks: {
        filename: 'links-oficiais',
        headers: ['Título', 'Categoria', 'Instituição / fonte', 'URL', 'Data de atualização', 'Status', 'Descrição', 'Ordem'],
        rows: records.map((item) => [item.title, item.category, item.institution, item.url, formatDate(item.updatedAt), item.active ? 'Ativo' : 'Inativo', item.description, item.order])
      },
      salaryTables: {
        filename: 'tabelas-remuneracao-administrativas',
        headers: ['Classe ou nível', 'Referência', 'Categoria', 'Valor', 'Carga horária semanal', 'Vigência', 'Data da vigência', 'Fonte', 'URL da fonte', 'Status', 'Observações'],
        rows: records.map((item) => [item.classLevel, item.reference, item.amountType, item.amount, item.weeklyHours, item.effectivePeriod, item.effectiveAt, item.sourceName, item.sourceUrl, item.status, item.notes])
      }
    };
    const definition = exportDefinitions[activeTab];
    try { downloadCsv(definition.filename, definition.headers, definition.rows); }
    catch (error) { notify(`Falha ao gerar CSV: ${errorMessage(error)}`, 'error'); }
  });

  root.querySelector('.admin-tabs').addEventListener('click', async (event) => {
    const tab = event.target.closest('[data-tab]');
    if (!tab) return;
    activeTab = tab.dataset.tab;
    editId = null;
    root.querySelectorAll('[data-tab]').forEach((button) => { const active = button === tab; button.classList.toggle('is-active', active); button.setAttribute('aria-selected', String(active)); });
    renderForm(); await loadRecords();
  });
  formArea.addEventListener('click', (event) => { if (event.target.closest('[data-cancel-edit]')) resetForm(); });
  list.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-action]');
    if (!button) return;
    const record = records.find((item) => item.id === button.dataset.id);
    if (!record) return;
    if (button.dataset.action === 'edit') { editId = record.id; renderForm(record); formArea.scrollIntoView({ behavior: 'smooth' }); }
    if (button.dataset.action === 'delete' && window.confirm(`Excluir “${record.title || record.reference || 'este registro'}”? Esta ação não pode ser desfeita.`)) {
      try { await removeAdminRecord(activeTab, record.id); notify('Registro excluído.'); await loadRecords(); }
      catch (error) { notify(errorMessage(error), 'error'); }
    }
  });
  root.querySelector('#admin-refresh').addEventListener('click', loadRecords);
  renderForm();
  await loadRecords();
}

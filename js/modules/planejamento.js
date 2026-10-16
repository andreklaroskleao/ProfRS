import { listUserRecords, removeUserRecord, saveUserRecord } from '../firebase/firestore.js';
import { asLines, escapeHtml, formatDate, notify, errorMessage } from '../core/utils.js';
import { downloadCsv, printElement } from '../core/export.js';

const fields = [
  ['title', 'Título', 'text', true],
  ['schoolYear', 'Ano letivo', 'number', true],
  ['educationStage', 'Etapa de ensino', 'text', true],
  ['grade', 'Ano ou série', 'text', true],
  ['subject', 'Componente curricular', 'text', true],
  ['schoolName', 'Escola (opcional)', 'text', false],
  ['className', 'Turma (opcional)', 'text', false],
  ['trimester', 'Trimestre ou período', 'text', false],
  ['startDate', 'Data inicial', 'date', false],
  ['endDate', 'Data final', 'date', false],
  ['generalObjectives', 'Objetivos de aprendizagem', 'textarea', false],
  ['selectedSkills', 'Habilidades curriculares (uma por linha; use código | descrição)', 'textarea', false],
  ['contents', 'Conteúdos', 'textarea', false],
  ['methodology', 'Metodologias', 'textarea', false],
  ['activities', 'Atividades', 'textarea', false],
  ['resourcesText', 'Recursos didáticos', 'textarea', false],
  ['assessmentCriteria', 'Estratégias e critérios de avaliação', 'textarea', false],
  ['observations', 'Observações', 'textarea', false]
];

function fieldMarkup([name, label, type, required], value = '') {
  const safeValue = escapeHtml(value ?? '');
  const labelHtml = `${escapeHtml(label)}${required ? ' <span aria-hidden="true">*</span>' : ''}`;
  if (type === 'textarea') return `<div class="field"><label for="plan-${name}">${labelHtml}</label><textarea id="plan-${name}" name="${name}" ${required ? 'required' : ''}>${safeValue}</textarea></div>`;
  return `<div class="field"><label for="plan-${name}">${labelHtml}</label><input id="plan-${name}" name="${name}" type="${type}" value="${safeValue}" ${required ? 'required' : ''} ${type === 'number' ? 'min="2000" max="2100" step="1"' : ''}></div>`;
}

function skillRecords(value) {
  return asLines(value).map((line) => {
    const [code, ...description] = line.split('|');
    return { curriculumSource: 'teacher-entry', code: code.trim(), description: description.join('|').trim() || code.trim(), isOfficial: false };
  });
}

export async function mountPlanejamento(root) {
  root.innerHTML = `
    <div class="page-heading"><div><p class="section-kicker">MÓDULO 2 · ORGANIZAÇÃO PEDAGÓGICA</p><h1>Planejamentos</h1><p>Crie planos anuais, trimestrais e semanais, vinculados à sua conta.</p></div><button id="new-plan" class="button button-primary" type="button">＋ Novo planejamento</button></div>
    <div class="notice-box" style="margin-bottom:16px">Os códigos da BNCC e do Referencial Curricular Gaúcho não foram preenchidos sem fonte verificável. Você pode relacionar habilidades próprias no formulário; elas serão identificadas como registros informados por você.</div>
    <section id="plan-editor" class="panel" hidden></section>
    <section id="plan-print" class="panel plan-print" hidden></section>
    <section class="panel"><div class="panel-header"><h2>Seus planejamentos</h2><button id="plan-export-filtered" class="button button-secondary button-small" type="button" hidden>Exportar lista filtrada CSV</button></div><div class="toolbar"><input id="plan-search" type="search" placeholder="Buscar por título" aria-label="Buscar por título"><select id="plan-filter-type" aria-label="Filtrar por tipo"><option value="">Todos os tipos</option><option value="annual">Anual</option><option value="trimester">Trimestral</option><option value="weekly">Semanal</option></select><input id="plan-filter-year" type="number" placeholder="Ano letivo" aria-label="Filtrar por ano letivo"><input id="plan-filter-subject" type="search" placeholder="Componente" aria-label="Filtrar por componente curricular"></div><div id="plan-list" class="record-list"><p class="loading-state">Carregando seus planejamentos…</p></div></section>`;

  let records = [];
  let visibleRecords = [];
  let editId = null;
  let skillCatalog = { meta: { version: 'indisponível', source: 'Catálogo não carregado', isOfficial: false }, skills: [] };
  try {
    const response = await fetch(new URL('../data/skills-demo.json', import.meta.url));
    if (response.ok) skillCatalog = await response.json();
  } catch { /* O formulário segue disponível sem catálogo local. */ }
  const list = root.querySelector('#plan-list');
  const editor = root.querySelector('#plan-editor');
  const filterInputs = ['#plan-search', '#plan-filter-type', '#plan-filter-year', '#plan-filter-subject'].map((selector) => root.querySelector(selector));

  const skillPickerMarkup = () => `<section id="skill-catalog-ui" class="panel" style="background:#fbfcfb;margin:14px 0"><div class="panel-header"><div><h3>Catálogo curricular local</h3><p class="small muted" style="margin:4px 0 0">Fonte: ${escapeHtml(skillCatalog.meta?.source || 'não informada')} · Versão ${escapeHtml(skillCatalog.meta?.version || '—')}${skillCatalog.meta?.isOfficial ? ' · marcado como oficial' : ' · catálogo não oficial'}</p></div></div><div id="skill-catalog-controls"></div><div id="skill-catalog-results" class="record-list" style="margin-top:10px"></div><p class="field-hint">A aplicação não confirma automaticamente a vigência do JSON. Registros oficiais exigem origem e versão verificáveis.</p></section>`;

  const optionMarkup = (label, id, options, selected) => `<div class="field"><label for="${id}">${label}</label><select id="${id}"><option value="">Todas</option>${options.map((value) => `<option value="${escapeHtml(value)}" ${selected === value ? 'selected' : ''}>${escapeHtml(value)}</option>`).join('')}</select></div>`;

  const renderList = () => {
    const [search, type, year, subject] = filterInputs.map((input) => input.value.trim().toLowerCase());
    const visible = records.filter((record) => (!search || record.title?.toLowerCase().includes(search)) && (!type || record.planType === type) && (!year || String(record.schoolYear) === year) && (!subject || record.subject?.toLowerCase().includes(subject)));
    visibleRecords = visible;
    root.querySelector('#plan-export-filtered').hidden = visible.length === 0;
    if (!visible.length) {
      list.innerHTML = `<div class="empty-state"><strong>${records.length ? 'Nenhum planejamento corresponde aos filtros.' : 'Seu espaço de planejamento está pronto.'}</strong><p>${records.length ? 'Ajuste a busca para ver outros itens.' : 'Crie um plano para registrar objetivos, conteúdos e estratégias.'}</p></div>`;
      return;
    }
    list.innerHTML = visible.map((record) => `<article class="record-card"><div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start"><div><h3>${escapeHtml(record.title)}</h3><p>${escapeHtml(record.subject || 'Componente não informado')} · ${escapeHtml(record.grade || 'Série não informada')} · ${escapeHtml(record.schoolYear || '')}</p><p class="record-meta">${({ annual: 'Anual', trimester: 'Trimestral', weekly: 'Semanal' }[record.planType] || 'Plano')} · Atualizado em ${escapeHtml(formatDate(record.updatedAt))}</p></div><span class="status-pill ${record.status === 'completed' ? 'success' : 'warning'}">${record.status === 'completed' ? 'Concluído' : 'Rascunho'}</span></div><div class="record-actions"><button class="button button-quiet button-small" data-action="edit" data-id="${escapeHtml(record.id)}" type="button">Editar</button><button class="button button-quiet button-small" data-action="duplicate" data-id="${escapeHtml(record.id)}" type="button">Duplicar</button><button class="button button-quiet button-small" data-action="print" data-id="${escapeHtml(record.id)}" type="button">Imprimir</button><button class="button button-quiet button-small" data-action="csv" data-id="${escapeHtml(record.id)}" type="button">Exportar CSV</button><button class="button button-danger button-small" data-action="delete" data-id="${escapeHtml(record.id)}" type="button">Excluir</button></div></article>`).join('');
  };

  const load = async () => {
    list.innerHTML = '<p class="loading-state">Carregando seus planejamentos…</p>';
    try { records = await listUserRecords('plans', 60); renderList(); }
    catch (error) { list.innerHTML = `<div class="empty-state"><strong>Não foi possível carregar os planejamentos.</strong><p>${escapeHtml(errorMessage(error))}</p></div>`; }
  };

  const openEditor = (record = {}) => {
    editId = record.id || null;
    editor.hidden = false;
    editor.innerHTML = `<div class="panel-header"><div><p class="section-kicker">${editId ? 'EDIÇÃO' : 'NOVO PLANO'}</p><h2>${editId ? 'Editar planejamento' : 'Criar planejamento'}</h2></div><button class="button button-quiet button-small" type="button" data-editor-close>Fechar</button></div><form id="plan-form"><div class="field-grid"><div class="field"><label for="plan-planType">Tipo de planejamento</label><select id="plan-planType" name="planType"><option value="annual">Anual</option><option value="trimester">Trimestral</option><option value="weekly">Semanal</option></select></div><div class="field"><label for="plan-status">Situação</label><select id="plan-status" name="status"><option value="draft">Rascunho</option><option value="completed">Concluído</option></select></div>${fields.slice(0, 10).map((field) => fieldMarkup(field, record[field[0]])).join('')}</div><div class="divider"></div><h3>Objetivos e desenvolvimento</h3>${fieldMarkup(fields[10], record.generalObjectives)}${skillPickerMarkup()}${fieldMarkup(fields[11], (record.selectedSkills || []).map((skill) => `${skill.code || ''} | ${skill.description || ''}`).join('\n'))}${fields.slice(12).map((field) => fieldMarkup(field, record[field[0]])).join('')}<p class="field-hint">As habilidades digitadas manualmente serão salvas como informadas pelo professor. Consulte a fonte curricular antes de tratá-las como oficiais.</p><div id="plan-form-message" aria-live="polite"></div><div class="form-actions"><button class="button button-primary" type="submit">Salvar planejamento</button><button class="button button-quiet" type="button" data-editor-close>Cancelar</button></div></form>`;
    editor.querySelector('[name="planType"]').value = record.planType || 'annual';
    editor.querySelector('[name="status"]').value = record.status || 'draft';
    const skillControls = editor.querySelector('#skill-catalog-controls');
    const skillResults = editor.querySelector('#skill-catalog-results');
    if (!skillCatalog.skills?.length) {
      skillControls.innerHTML = '<div class="empty-state"><strong>O catálogo está vazio.</strong><p>Nenhum código ou descrição oficial será sugerido. A estrutura JSON permite adicionar um conjunto verificado depois.</p></div>';
    } else {
      const selections = { stage: '', grade: '', area: '', subject: '', search: '' };
      const updateSkillOptions = () => {
        const stageRows = skillCatalog.skills.filter((item) => !selections.stage || item.stage === selections.stage);
        const gradeRows = stageRows.filter((item) => !selections.grade || item.grade === selections.grade);
        const areaRows = gradeRows.filter((item) => !selections.area || item.knowledgeArea === selections.area);
        const subjectRows = areaRows.filter((item) => !selections.subject || item.subject === selections.subject);
        const unique = (rows, key) => [...new Set(rows.map((row) => row[key]).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
        skillControls.innerHTML = `<div class="field-grid">${optionMarkup('Etapa de ensino', 'skill-stage', unique(skillCatalog.skills, 'stage'), selections.stage)}${optionMarkup('Ano ou série', 'skill-grade', unique(stageRows, 'grade'), selections.grade)}${optionMarkup('Área de conhecimento', 'skill-area', unique(gradeRows, 'knowledgeArea'), selections.area)}${optionMarkup('Componente curricular', 'skill-subject', unique(areaRows, 'subject'), selections.subject)}</div><div class="field"><label for="skill-search">Buscar por código ou descrição</label><input id="skill-search" type="search" placeholder="Ex.: código ou trecho da descrição" value="${escapeHtml(selections.search)}"></div>`;
        const term = selections.search.toLocaleLowerCase('pt-BR');
        const results = subjectRows.filter((item) => !term || `${item.code || ''} ${item.description || ''}`.toLocaleLowerCase('pt-BR').includes(term));
        skillResults.innerHTML = results.length ? results.map((item) => `<article class="record-card"><div style="display:flex;justify-content:space-between;gap:12px"><div><strong>${escapeHtml(item.code || 'Sem código')}</strong> <span class="status-pill">${item.isOfficial ? 'Fonte oficial declarada' : 'Demonstração / não oficial'}</span><p>${escapeHtml(item.description || '')}</p><p class="record-meta">${escapeHtml([item.stage, item.grade, item.knowledgeArea, item.subject, item.curriculumSource, item.version].filter(Boolean).join(' · '))}</p></div><button class="button button-secondary button-small" data-select-skill="${escapeHtml(skillCatalog.skills.indexOf(item))}" type="button">Adicionar</button></div></article>`).join('') : '<div class="empty-state"><strong>Nenhuma habilidade encontrada.</strong><p>Revise os filtros ou o texto de busca.</p></div>';
      };
      skillControls.addEventListener('change', (event) => {
        const key = { 'skill-stage': 'stage', 'skill-grade': 'grade', 'skill-area': 'area', 'skill-subject': 'subject' }[event.target.id];
        if (!key) return;
        selections[key] = event.target.value;
        if (key === 'stage') selections.grade = selections.area = selections.subject = '';
        if (key === 'grade') selections.area = selections.subject = '';
        if (key === 'area') selections.subject = '';
        updateSkillOptions();
      });
      skillControls.addEventListener('input', (event) => {
        if (event.target.id === 'skill-search') { selections.search = event.target.value; updateSkillOptions(); const input = skillControls.querySelector('#skill-search'); input.focus(); input.setSelectionRange(input.value.length, input.value.length); }
      });
      skillResults.addEventListener('click', (event) => {
        const button = event.target.closest('[data-select-skill]');
        if (!button) return;
        const item = skillCatalog.skills[Number(button.dataset.selectSkill)];
        const textarea = editor.querySelector('[name="selectedSkills"]');
        const entry = `${item.code || ''} | ${item.description || ''}`;
        const currentLines = asLines(textarea.value);
        if (!currentLines.includes(entry)) textarea.value = [...currentLines, entry].filter(Boolean).join('\n');
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
      });
      updateSkillOptions();
    }
    editor.scrollIntoView({ behavior: 'smooth', block: 'start' });
    editor.querySelector('[data-editor-close]').focus();
    editor.querySelector('#plan-form').addEventListener('submit', async (event) => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      const data = Object.fromEntries(form.entries());
      data.schoolYear = Number(data.schoolYear);
      data.selectedSkills = skillRecords(data.selectedSkills).map((entry) => {
        const catalogEntry = skillCatalog.skills?.find((skill) => skill.code === entry.code && skill.description === entry.description);
        return catalogEntry ? { ...catalogEntry, curriculumSource: catalogEntry.curriculumSource || skillCatalog.meta?.source || 'catálogo local', version: catalogEntry.version || skillCatalog.meta?.version || '', isOfficial: Boolean(catalogEntry.isOfficial && skillCatalog.meta?.isOfficial) } : entry;
      });
      data.status = data.status === 'completed' ? 'completed' : 'draft';
      const message = editor.querySelector('#plan-form-message');
      const button = event.currentTarget.querySelector('[type="submit"]');
      button.disabled = true;
      try {
        await saveUserRecord('plans', data, editId);
        notify('Planejamento salvo no Firestore.');
        editor.hidden = true;
        await load();
      } catch (error) {
        message.innerHTML = `<p class="form-error" role="alert">${escapeHtml(errorMessage(error))} Seus campos continuam preenchidos; você pode tentar novamente.</p>`;
      } finally { button.disabled = false; }
    });
  };

  root.querySelector('#new-plan').addEventListener('click', () => openEditor({ schoolYear: new Date().getFullYear() }));
  const planHeaders = ['Tipo', ...fields.map(([, label]) => label), 'Situação'];
  const planRow = (record) => [({ annual: 'Anual', trimester: 'Trimestral', weekly: 'Semanal' }[record.planType] || 'Plano'), ...fields.map(([key]) => key === 'selectedSkills' ? (record.selectedSkills || []).map((skill) => `${skill.code || ''} | ${skill.description || ''}`).join('\n') : (record[key] ?? '')), record.status === 'completed' ? 'Concluído' : 'Rascunho'];
  const safeFilePart = (value) => String(value || 'planejamento').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'planejamento';
  const exportPlan = (items, filename) => downloadCsv(filename, planHeaders, items.map(planRow));
  root.querySelector('#plan-export-filtered').addEventListener('click', () => {
    try { exportPlan(visibleRecords, 'planejamentos-filtrados'); }
    catch (error) { notify(`Falha ao gerar CSV: ${errorMessage(error)}`, 'error'); }
  });
  filterInputs.forEach((input) => input.addEventListener('input', renderList));
  editor.addEventListener('click', (event) => { if (event.target.closest('[data-editor-close]')) editor.hidden = true; });
  list.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-action]');
    if (!button) return;
    const record = records.find((entry) => entry.id === button.dataset.id);
    if (button.dataset.action === 'csv' && record) {
      try { exportPlan([record], safeFilePart(record.title)); }
      catch (error) { notify(`Falha ao gerar CSV: ${errorMessage(error)}`, 'error'); }
      return;
    }
    if (!record) return;
    if (button.dataset.action === 'edit') openEditor(record);
    if (button.dataset.action === 'duplicate') {
      try { const copy = { ...record, title: `Cópia de ${record.title}`, status: 'draft' }; delete copy.id; await saveUserRecord('plans', copy); notify('Cópia criada.'); await load(); }
      catch (error) { notify(errorMessage(error), 'error'); }
    }
    if (button.dataset.action === 'delete' && window.confirm(`Excluir o planejamento “${record.title}”? Esta ação não pode ser desfeita.`)) {
      try { await removeUserRecord('plans', record.id); notify('Planejamento excluído.'); await load(); }
      catch (error) { notify(errorMessage(error), 'error'); }
    }
    if (button.dataset.action === 'print') {
      const print = root.querySelector('#plan-print');
      const labels = fields.filter(([key]) => record[key]).map(([key, label]) => `<section class="print-section"><h3>${escapeHtml(label)}</h3><p>${escapeHtml(key === 'selectedSkills' ? (record[key] || []).map((skill) => `${skill.code} — ${skill.description}`).join('\n') : record[key])}</p></section>`).join('');
      print.innerHTML = `<div class="print-header"><strong>ProfRS · Planejamento pedagógico</strong><div>${escapeHtml(record.schoolName || '')} · ${escapeHtml(record.schoolYear || '')}</div></div><h2>${escapeHtml(record.title)}</h2><p>${escapeHtml(record.subject || '')} · ${escapeHtml(record.grade || '')} · ${escapeHtml(record.className || '')}</p>${labels}<p class="small muted">Ferramenta de apoio pedagógico. Adaptar às orientações da instituição.</p>`;
      try { printElement(print); }
      catch (error) { notify(`Falha ao abrir a impressão: ${errorMessage(error)}`, 'error'); }
    }
  });
  await load();
}

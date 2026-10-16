import { listUserRecords, removeUserRecord, saveUserRecord } from '../firebase/firestore.js';
import { escapeHtml, formatDate, notify, errorMessage } from '../core/utils.js';
import { downloadCsv, printElement } from '../core/export.js';

const steps = [
  { title: 'Identificação e contexto escolar', fields: [['studentReference', 'Código interno do estudante', true], ['educationStage', 'Etapa de ensino', false], ['grade', 'Ano ou série', false], ['className', 'Turma (se necessária)', false], ['context', 'Contexto educacional relevante', false]] },
  { title: 'Perfil de aprendizagem', fields: [['strengths', 'Potencialidades e interesses', false], ['barriers', 'Barreiras à aprendizagem', false], ['educationalNeeds', 'Necessidades educacionais', false], ['supports', 'Apoios necessários', false]] },
  { title: 'Objetivos', fields: [['generalObjectives', 'Objetivos gerais', false], ['specificObjectives', 'Objetivos específicos', false], ['priorities', 'Prioridades educacionais', false]] },
  { title: 'Flexibilização curricular', fields: [['curricularFlexibilizations', 'Adaptações e flexibilizações', false], ['strategies', 'Estratégias pedagógicas', false], ['resources', 'Recursos e apoios', false], ['activityAdjustments', 'Ajustes de atividades', false]] },
  { title: 'Organização trimestral', fields: [['trimesterPlans', 'Objetivos e atividades por trimestre', false], ['monitoringStrategies', 'Estratégias de acompanhamento', false], ['reviewCriteria', 'Critérios de revisão', false]] },
  { title: 'Avaliação', fields: [['assessmentCriteria', 'Critérios e instrumentos de avaliação', false], ['progressIndicators', 'Indicadores de progresso', false], ['assessmentStrategies', 'Estratégias de acompanhamento', false]] },
  { title: 'Acompanhamento', fields: [['progressRecords', 'Registros de evolução', false], ['observedDifficulties', 'Dificuldades observadas', false], ['necessaryAdjustments', 'Ajustes necessários', false], ['nextActions', 'Próximas ações', false]] },
  { title: 'Revisão', fields: [] }
];

const fieldLabel = (name) => steps.flatMap((step) => step.fields).find(([key]) => key === name)?.[1] || name;

export async function mountPei(root) {
  root.innerHTML = `<div class="page-heading"><div><p class="section-kicker">MÓDULO 3 · APOIO À INCLUSÃO</p><h1>Plano Educacional Individualizado</h1><p>Organize objetivos, apoios e acompanhamento pedagógico em oito etapas.</p></div><button id="new-pei" class="button button-primary" type="button">＋ Novo PEI</button></div><div class="notice-box" style="margin-bottom:17px"><strong>Privacidade:</strong> use um código interno e registre apenas informações necessárias ao trabalho pedagógico. Não inclua diagnósticos médicos nem dados excessivos. Os registros ficam privados na sua conta; não compartilhe o acesso ao dispositivo.</div><section id="pei-editor" class="panel" hidden></section><section id="pei-print" class="panel pei-print" hidden></section><section class="panel"><div class="panel-header"><h2>Seus PEIs</h2></div><div id="pei-list" class="record-list"><p class="loading-state">Carregando seus registros…</p></div></section>`;
  const editor = root.querySelector('#pei-editor');
  const list = root.querySelector('#pei-list');
  let records = [];
  let draft = {};
  let editId = null;
  let stepIndex = 0;
  const confirmPeiExport = () => window.confirm('Este arquivo contém informações educacionais potencialmente sensíveis. Guarde o PDF ou CSV em local protegido e não o compartilhe sem autorização. O arquivo é gerado localmente pelo navegador. Deseja continuar?');

  const load = async () => {
    list.innerHTML = '<p class="loading-state">Carregando seus registros…</p>';
    try {
      records = await listUserRecords('peis', 60);
      if (!records.length) list.innerHTML = '<div class="empty-state"><strong>Nenhum PEI cadastrado.</strong><p>Comece com um código interno e avance pelas etapas conforme necessário.</p></div>';
      else list.innerHTML = records.map((record) => `<article class="record-card"><div style="display:flex;justify-content:space-between;gap:10px"><div><h3>${escapeHtml(record.studentReference || 'Rascunho sem identificação')}</h3><p>${escapeHtml(record.grade || '')} ${record.className ? `· ${escapeHtml(record.className)}` : ''} ${record.educationStage ? `· ${escapeHtml(record.educationStage)}` : ''}</p><p class="record-meta">Atualizado em ${escapeHtml(formatDate(record.updatedAt))}</p></div><span class="status-pill ${record.status === 'completed' ? 'success' : 'warning'}">${record.status === 'completed' ? 'Revisado' : 'Rascunho'}</span></div><div class="record-actions"><button class="button button-quiet button-small" data-action="edit" data-id="${escapeHtml(record.id)}" type="button">Abrir e editar</button><button class="button button-quiet button-small" data-action="print" data-id="${escapeHtml(record.id)}" type="button">Imprimir</button><button class="button button-quiet button-small" data-action="csv" data-id="${escapeHtml(record.id)}" type="button">Exportar PEI CSV</button><button class="button button-danger button-small" data-action="delete" data-id="${escapeHtml(record.id)}" type="button">Excluir</button></div></article>`).join('');
    } catch (error) { list.innerHTML = `<div class="empty-state"><strong>Falha ao carregar os PEIs.</strong><p>${escapeHtml(errorMessage(error))}</p></div>`; }
  };

  const capture = () => {
    const form = editor.querySelector('#pei-step-form');
    if (!form) return;
    for (const [key, value] of new FormData(form).entries()) draft[key] = value;
  };

  const peiFields = steps.slice(0, -1).flatMap((step) => step.fields);
  const exportPei = (record) => {
    if (!confirmPeiExport()) return;
    const headers = peiFields.map(([, label]) => label).concat(['Situação', 'Atualizado em']);
    const row = peiFields.map(([name]) => record[name] ?? '').concat([record.status === 'completed' ? 'Revisado' : 'Rascunho', formatDate(record.updatedAt)]);
    const safeName = String(record.studentReference || 'pei').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 50) || 'pei';
    downloadCsv(`pei-${safeName}`, headers, [row]);
  };

  const renderEditor = () => {
    const step = steps[stepIndex];
    const progress = Math.round(((stepIndex + 1) / steps.length) * 100);
    const content = step.fields.map(([name, label, required]) => `<div class="field"><label for="pei-${name}">${escapeHtml(label)}${required ? ' <span aria-hidden="true">*</span>' : ''}</label><textarea id="pei-${name}" name="${name}" ${required ? 'required' : ''}>${escapeHtml(draft[name] || '')}</textarea></div>`).join('');
    const review = stepIndex === steps.length - 1 ? `<div class="preview-box"><h3>Resumo para revisão</h3>${steps.slice(0, -1).map((part) => `<h4>${escapeHtml(part.title)}</h4>${part.fields.map(([name, label]) => draft[name] ? `<p><strong>${escapeHtml(label)}:</strong> ${escapeHtml(draft[name])}</p>` : '').join('')}`).join('') || '<p class="muted">Preencha as etapas anteriores para montar o resumo.</p>'}</div>` : content;
    editor.innerHTML = `<div class="panel-header"><div><p class="section-kicker">${editId ? 'EDIÇÃO DE PEI' : 'NOVO PEI'}</p><h2>${escapeHtml(step.title)}</h2></div><button class="button button-quiet button-small" type="button" data-close-editor>Fechar</button></div><div class="step-heading"><strong>Etapa ${stepIndex + 1} de ${steps.length}</strong><span class="small muted">${progress}%</span></div><div class="progress-track" role="progressbar" aria-label="Progresso do PEI" aria-valuenow="${progress}" aria-valuemin="0" aria-valuemax="100"><span style="width:${progress}%"></span></div><form id="pei-step-form" style="margin-top:19px">${review}<p class="field-hint">Este formulário é uma ferramenta de apoio pedagógico adaptável às orientações aplicáveis; não é apresentado como modelo oficial da SEDUC-RS.</p><div id="pei-message" aria-live="polite"></div><div class="form-actions">${stepIndex > 0 ? '<button class="button button-quiet" type="button" data-step-back>← Etapa anterior</button>' : ''}${stepIndex < steps.length - 1 ? '<button class="button button-secondary" type="button" data-save-draft>Salvar rascunho</button><button class="button button-primary" type="button" data-step-next>Próxima etapa →</button>' : '<button class="button button-secondary" type="button" data-save-draft>Salvar rascunho</button><button class="button button-primary" type="button" data-finish>Salvar PEI revisado</button>'}</div></form>`;
    editor.hidden = false;
  };

  const saveDraft = async (status = 'draft') => {
    capture();
    draft.status = status;
    try {
      const { id: _recordId, ...payload } = draft;
      await saveUserRecord('peis', payload, editId);
      notify(status === 'completed' ? 'PEI revisado e salvo.' : 'Rascunho do PEI salvo no Firestore.');
      await load();
      if (status === 'completed') editor.hidden = true;
    } catch (error) {
      editor.querySelector('#pei-message').innerHTML = `<p class="form-error" role="alert">${escapeHtml(errorMessage(error))} Os dados digitados foram mantidos; tente salvar novamente.</p>`;
    }
  };

  root.querySelector('#new-pei').addEventListener('click', () => { draft = {}; editId = null; stepIndex = 0; renderEditor(); editor.scrollIntoView({ behavior: 'smooth' }); });
  editor.addEventListener('click', async (event) => {
    const action = event.target.closest('[data-step-next], [data-step-back], [data-save-draft], [data-finish], [data-close-editor]');
    if (!action) return;
    capture();
    if (action.hasAttribute('data-close-editor')) { editor.hidden = true; return; }
    if (action.hasAttribute('data-step-back')) { stepIndex = Math.max(0, stepIndex - 1); renderEditor(); return; }
    if (action.hasAttribute('data-step-next')) {
      const form = editor.querySelector('#pei-step-form');
      if (!form.reportValidity()) return;
      if (stepIndex === 0 && !String(draft.studentReference || '').trim()) { form.querySelector('[name="studentReference"]')?.focus(); return; }
      stepIndex = Math.min(steps.length - 1, stepIndex + 1); renderEditor(); return;
    }
    if (action.hasAttribute('data-save-draft')) await saveDraft('draft');
    if (action.hasAttribute('data-finish')) {
      if (!String(draft.studentReference || '').trim()) { notify('Informe o código interno do estudante na primeira etapa antes de concluir.', 'error'); return; }
      if (window.confirm('Salvar este PEI com a situação “revisado”?')) await saveDraft('completed');
    }
  });

  list.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-action]');
    if (!button) return;
    const record = records.find((entry) => entry.id === button.dataset.id);
    if (!record) return;
    if (button.dataset.action === 'csv') {
      try { exportPei(record); }
      catch (error) { notify(`Falha ao gerar CSV do PEI: ${errorMessage(error)}`, 'error'); }
      return;
    }
    if (button.dataset.action === 'edit') { draft = { ...record }; editId = record.id; stepIndex = 0; renderEditor(); editor.scrollIntoView({ behavior: 'smooth' }); }
    if (button.dataset.action === 'delete' && window.confirm(`Excluir o PEI de referência “${record.studentReference || 'sem código'}”? Esta ação não pode ser desfeita.`)) {
      try { await removeUserRecord('peis', record.id); notify('PEI excluído.'); await load(); } catch (error) { notify(errorMessage(error), 'error'); }
    }
    if (button.dataset.action === 'print') {
      if (!confirmPeiExport()) return;
      const print = root.querySelector('#pei-print');
      print.innerHTML = `<div class="print-header"><strong>ProfRS · Plano Educacional Individualizado</strong><span>Ferramenta de apoio pedagógico</span></div><h2>Referência: ${escapeHtml(record.studentReference || '—')}</h2>${steps.slice(0, -1).map((part) => `<section class="print-section"><h3>${escapeHtml(part.title)}</h3>${part.fields.map(([name, label]) => record[name] ? `<p><strong>${escapeHtml(label)}:</strong><br>${escapeHtml(record[name])}</p>` : '').join('')}</section>`).join('')}<p class="small muted">Evite compartilhar este documento. Contém informações educacionais potencialmente sensíveis.</p>`;
      try { printElement(print); }
      catch (error) { notify(`Falha ao abrir a impressão: ${errorMessage(error)}`, 'error'); }
    }
  });
  await load();
}

import { getPublishedSalaryTables } from '../firebase/firestore.js';
import { escapeHtml, formatDate, safeHttpsUrl, errorMessage, notify } from '../core/utils.js';
import { downloadCsv, printElement } from '../core/export.js';

const money = (value) => Number.isFinite(Number(value)) ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value)) : '—';

export async function mountRemuneracao(root) {
  root.innerHTML = `<div class="page-heading"><div><p class="section-kicker">MÓDULO 1 · REMUNERAÇÃO</p><h1>Consulta salarial</h1><p>Consulte referências cadastradas com fonte, vigência e carga horária identificadas.</p></div></div><div class="notice-box" style="margin-bottom:18px">Não apresentamos valores estimados como oficiais. A base inicial está vazia e precisa ser alimentada pelo administrador com fonte verificável.</div><section class="panel"><div class="toolbar"><input id="salary-search" type="search" placeholder="Classe, nível ou referência" aria-label="Buscar por classe, nível ou referência"><select id="salary-hours" aria-label="Filtrar por carga horária"><option value="">Todas as cargas</option><option value="20">20 horas</option><option value="40">40 horas</option></select><input id="salary-period" type="search" placeholder="Vigência" aria-label="Filtrar por vigência"><button id="salary-export" class="button button-secondary button-small" type="button" hidden>Exportar CSV</button><button id="salary-print-button" class="button button-quiet button-small" type="button" hidden>Imprimir / salvar PDF</button></div><div id="salary-list"><p class="loading-state">Consultando valores publicados…</p></div></section><section id="salary-print" class="panel" hidden></section><p class="small muted" style="margin-top:16px">Valores e condições podem mudar. Confira a fonte e a data de vigência antes de tomar decisões.</p>`;
  const list = root.querySelector('#salary-list');
  const exportButton = root.querySelector('#salary-export');
  const printButton = root.querySelector('#salary-print-button');
  const printArea = root.querySelector('#salary-print');
  try {
    const records = await getPublishedSalaryTables(100);
    const render = () => {
      const search = root.querySelector('#salary-search').value.trim().toLowerCase();
      const hours = root.querySelector('#salary-hours').value;
      const period = root.querySelector('#salary-period').value.trim().toLowerCase();
      const visible = records.filter((item) => {
        const target = `${item.classLevel || ''} ${item.reference || ''}`.toLowerCase();
        return (!search || target.includes(search)) && (!hours || String(item.weeklyHours) === hours) && (!period || String(item.effectivePeriod || '').toLowerCase().includes(period));
      });
      exportButton.hidden = printButton.hidden = visible.length === 0;
      if (!visible.length) {
        list.innerHTML = `<div class="empty-state"><strong>${records.length ? 'Nenhum valor corresponde aos filtros.' : 'Ainda não há tabela salarial publicada.'}</strong><p>${records.length ? 'Tente outros termos.' : 'Quando o administrador incluir valores com fonte e vigência, eles aparecerão aqui.'}</p></div>`;
        return;
      }
      list.innerHTML = `<div class="record-list">${visible.map((item) => {
        const source = safeHttpsUrl(item.sourceUrl);
        return `<article class="record-card"><div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start"><div><h3>${escapeHtml(item.classLevel || 'Classe não informada')} · ${escapeHtml(item.reference || 'Referência não informada')}</h3><p>${escapeHtml(item.effectivePeriod || 'Vigência não informada')} · ${escapeHtml(item.weeklyHours || '—')}h semanais</p></div><strong style="font-family:Manrope;color:var(--green);font-size:1.2rem">${money(item.amount)}</strong></div><p class="record-meta">Tipo: ${escapeHtml(item.amountType || 'não informado')} · Atualizado: ${escapeHtml(formatDate(item.updatedAt))}</p><p>${escapeHtml(item.notes || '')}</p><p class="small">Fonte: ${escapeHtml(item.sourceName || 'não informada')}${source ? ` · <a href="${escapeHtml(source)}" target="_blank" rel="noopener noreferrer">consultar fonte ↗</a>` : ''}</p></article>`;
      }).join('')}</div>`;
      const headers = ['Classe ou nível', 'Referência', 'Natureza do valor', 'Valor (R$)', 'Carga horária semanal', 'Vigência', 'Data da vigência', 'Fonte', 'URL da fonte', 'Observações', 'Status', 'Atualizado em'];
      const rows = visible.map((item) => [item.classLevel, item.reference, item.amountType, item.amount, item.weeklyHours, item.effectivePeriod, item.effectiveAt, item.sourceName, item.sourceUrl, item.notes, item.status || 'Publicado', formatDate(item.updatedAt)]);
      exportButton.onclick = () => {
        try { downloadCsv('tabela-remuneracao-filtrada', headers, rows); }
        catch (error) { notify(`Falha ao gerar CSV: ${errorMessage(error)}`, 'error'); }
      };
      const printable = visible.map((item) => `<article class="record-card"><h3>${escapeHtml(item.classLevel || 'Classe não informada')} · ${escapeHtml(item.reference || 'Referência não informada')}</h3><p><strong>Valor:</strong> ${escapeHtml(money(item.amount))} · ${escapeHtml(item.amountType || 'natureza não informada')}</p><p><strong>Vigência:</strong> ${escapeHtml(item.effectivePeriod || 'não informada')} · Data: ${escapeHtml(item.effectiveAt || 'não informada')}</p><p><strong>Carga horária:</strong> ${escapeHtml(item.weeklyHours || '—')} horas semanais</p><p><strong>Fonte:</strong> ${escapeHtml(item.sourceName || 'não informada')}${safeHttpsUrl(item.sourceUrl) ? ` · ${escapeHtml(item.sourceUrl)}` : ''}</p>${item.notes ? `<p>${escapeHtml(item.notes)}</p>` : ''}</article>`).join('');
      printArea.innerHTML = `<div class="print-header"><strong>ProfRS · Consulta salarial</strong><span>Valores publicados e filtrados · ${escapeHtml(new Intl.DateTimeFormat('pt-BR').format(new Date()))}</span></div>${printable}<p class="small muted">Confira a fonte e a vigência antes de utilizar estes valores.</p>`;
    };
    ['#salary-search', '#salary-hours', '#salary-period'].forEach((selector) => root.querySelector(selector).addEventListener('input', render));
    printButton.addEventListener('click', () => {
      try { printElement(printArea); }
      catch (error) { notify(`Falha ao abrir a impressão: ${errorMessage(error)}`, 'error'); }
    });
    render();
  } catch (error) {
    exportButton.hidden = printButton.hidden = true;
    list.innerHTML = `<div class="empty-state"><strong>Não foi possível consultar os valores.</strong><p>${escapeHtml(errorMessage(error))}</p></div>`;
  }
}

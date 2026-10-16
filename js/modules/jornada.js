import { escapeHtml, notify, errorMessage } from '../core/utils.js';
import { downloadCsv, printElement } from '../core/export.js';

export function parseHoursToMinutes(rawHours) {
  const value = Number(rawHours);
  if (!Number.isFinite(value) || value <= 0 || value > 80) throw new Error('Informe uma carga horária maior que zero e de até 80 horas semanais.');
  return Math.round(value * 60);
}

export function calculateWorkload(rawHours) {
  const totalMinutes = parseHoursToMinutes(rawHours);
  return {
    totalMinutes,
    maxContactMinutes: Math.floor(totalMinutes * 2 / 3),
    minPlanningMinutes: Math.ceil(totalMinutes / 3)
  };
}

export function formatMinutes(totalMinutes) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h${String(minutes).padStart(2, '0')}`;
}

export function mountJornada(root) {
  root.innerHTML = `
    <div class="page-heading"><div><p class="section-kicker">MÓDULO 1 · ORGANIZAÇÃO DA ROTINA</p><h1>Jornada de trabalho</h1><p>Consulte a proporção legal de horas de interação com estudantes e de atividades extraclasse.</p></div></div>
    <div class="content-grid">
      <section class="panel"><h2>Calculadora de jornada</h2><p class="muted small">Informe horas semanais em tempo cronológico. Períodos de aula podem ter duração diferente.</p>
        <form id="workload-form"><div class="field-grid"><div class="field"><label for="workload-hours">Carga horária semanal</label><select id="workload-hours" name="hours"><option value="20">20 horas</option><option value="40">40 horas</option><option value="custom">Outra carga horária</option></select></div><div id="custom-hours-field" class="field" hidden><label for="custom-hours">Outra carga (horas por semana)</label><input id="custom-hours" type="number" min="0.25" max="80" step="0.25" value="30"></div></div><button class="button button-primary" type="submit">Calcular distribuição</button></form>
        <div id="workload-results" aria-live="polite"></div>
      </section>
      <aside class="panel"><h2>Como interpretar</h2><p>A Lei Federal nº 11.738/2008 determina que, na composição da jornada, no máximo dois terços sejam destinados à interação com os educandos. O período restante é reservado às atividades extraclasse.</p><div class="notice-box">A calculadora é uma ferramenta de apoio. A organização concreta da jornada também depende das normas aplicáveis à rede e das condições locais de trabalho.</div><p class="small muted" style="margin-top:14px">Referência: art. 2º, § 4º, da Lei nº 11.738/2008. Revisado em 15 de outubro de 2026.</p><a href="https://www.planalto.gov.br/ccivil_03/_ato2007-2010/2008/lei/l11738.htm" target="_blank" rel="noopener noreferrer">Consultar texto legal ↗</a></aside>
    </div>
    <section id="workload-print" class="panel" hidden></section><section class="panel" style="margin-top:19px"><h2>Exemplo para 20 horas semanais</h2><p class="muted">A proporção matemática resulta em até 13h20 de interação e ao menos 6h40 de atividades extraclasse. Isso ilustra a regra; não é uma escala oficial nem define períodos de aula.</p><div class="stat-row"><div class="stat-card"><span>Jornada total</span><strong>20h</strong></div><div class="stat-card"><span>Máximo de interação</span><strong>13h20</strong></div><div class="stat-card"><span>Mínimo extraclasse</span><strong>6h40</strong></div></div></section>`;
  const select = root.querySelector('#workload-hours');
  const customField = root.querySelector('#custom-hours-field');
  select.addEventListener('change', () => { customField.hidden = select.value !== 'custom'; });
  root.querySelector('#workload-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const hours = select.value === 'custom' ? root.querySelector('#custom-hours').value : select.value;
    const output = root.querySelector('#workload-results');
    try {
      const result = calculateWorkload(hours);
      const total = formatMinutes(result.totalMinutes);
      const contact = formatMinutes(result.maxContactMinutes);
      const planning = formatMinutes(result.minPlanningMinutes);
      output.innerHTML = `<div class="divider"></div><div class="stat-row"><div class="stat-card"><span>Carga total</span><strong>${escapeHtml(total)}</strong></div><div class="stat-card"><span>Máximo para interação</span><strong>${escapeHtml(contact)}</strong></div><div class="stat-card"><span>Mínimo extraclasse</span><strong>${escapeHtml(planning)}</strong></div></div><p class="small muted" style="margin-top:12px">Os limites são calculados em minutos cronológicos e arredondados para preservar o limite máximo e mínimo.</p><div class="record-actions"><button id="workload-export" class="button button-secondary button-small" type="button">Exportar CSV</button><button id="workload-print-button" class="button button-quiet button-small" type="button">Imprimir / salvar PDF</button></div>`;
      const print = root.querySelector('#workload-print');
      print.innerHTML = `<div class="print-header"><strong>ProfRS · Simulação da jornada</strong><span>Gerado em ${escapeHtml(new Intl.DateTimeFormat('pt-BR').format(new Date()))}</span></div><h2>Jornada semanal</h2><p>Carga informada: ${escapeHtml(total)}</p><div class="stat-row"><div class="stat-card"><span>Carga horária total</span><strong>${escapeHtml(total)}</strong></div><div class="stat-card"><span>Limite máximo de interação</span><strong>${escapeHtml(contact)}</strong></div><div class="stat-card"><span>Tempo mínimo extraclasse</span><strong>${escapeHtml(planning)}</strong></div></div><p>Referência legal: art. 2º, § 4º, da Lei Federal nº 11.738/2008. Revisado em 15 de outubro de 2026.</p><p><a href="https://www.planalto.gov.br/ccivil_03/_ato2007-2010/2008/lei/l11738.htm">Consultar texto legal</a></p><p class="small muted">Cálculo matemático de apoio; a organização concreta depende das normas aplicáveis à rede.</p>`;
      output.querySelector('#workload-export').addEventListener('click', () => {
        try { downloadCsv('simulacao-jornada', ['Carga horária total', 'Limite máximo de interação', 'Tempo mínimo extraclasse', 'Referência legal', 'Fonte legal'], [[total, contact, planning, 'Art. 2º, § 4º, Lei Federal nº 11.738/2008', 'https://www.planalto.gov.br/ccivil_03/_ato2007-2010/2008/lei/l11738.htm']]); }
        catch (error) { notify(`Falha ao gerar CSV: ${errorMessage(error)}`, 'error'); }
      });
      output.querySelector('#workload-print-button').addEventListener('click', () => {
        try { printElement(print); }
        catch (error) { notify(`Falha ao abrir a impressão: ${errorMessage(error)}`, 'error'); }
      });
    } catch (error) {
      root.querySelector('#workload-print').innerHTML = '';
      output.innerHTML = `<p class="form-error" role="alert">${escapeHtml(error.message)}</p>`;
    }
  });
  root.querySelector('#workload-form button[type="submit"]').click();
}

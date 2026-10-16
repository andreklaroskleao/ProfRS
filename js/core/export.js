function neutralizeSpreadsheetFormula(value) {
  const text = value == null ? '' : String(value);
  return /^[\s\uFEFF\u200B-\u200D\u2060]*[=+\-@]/u.test(text) ? `'${text}` : text;
}

export function csvCell(value) {
  return `"${neutralizeSpreadsheetFormula(value).replace(/"/g, '""')}"`;
}

export function makeCsv(headers, rows) {
  if (!Array.isArray(headers) || !Array.isArray(rows)) throw new TypeError('Cabeçalhos e linhas CSV precisam ser listas.');
  return `\uFEFF${[headers, ...rows].map((row) => headers.map((_, index) => csvCell(row[index])).join(',')).join('\r\n')}`;
}

export function downloadCsv(filename, headers, rows) {
  if (!rows.length) throw new Error('Não há dados para exportar.');
  if (typeof Blob === 'undefined' || !URL?.createObjectURL || !document?.createElement) {
    throw new Error('Este navegador não permite gerar o arquivo CSV localmente.');
  }
  const blob = new Blob([makeCsv(headers, rows)], { type: 'text/csv;charset=utf-8' });
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = `${String(filename || 'exportacao').replace(/[^\p{L}\p{N}._-]+/gu, '-').replace(/^-+|-+$/g, '') || 'exportacao'}.csv`;
  link.hidden = true;
  document.body.append(link);
  try { link.click(); }
  catch (error) { URL.revokeObjectURL(objectUrl); throw error; }
  finally { link.remove(); }
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}

export function printElement(element) {
  if (!element || typeof window.print !== 'function') throw new Error('A impressão não está disponível neste navegador.');
  const wasHidden = element.hidden;
  const isPublicPage = Boolean(element.closest('#public-view'));
  element.hidden = false;
  element.classList.add('print-focus');
  document.body.classList.add('printing');
  if (isPublicPage) document.body.classList.add('printing-public');
  let cleaned = false;
  let fallback;
  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    element.classList.remove('print-focus');
    element.hidden = wasHidden;
    document.body.classList.remove('printing');
    document.body.classList.remove('printing-public');
    window.removeEventListener('afterprint', cleanup);
    window.clearTimeout(fallback);
  };
  window.addEventListener('afterprint', cleanup, { once: true });
  fallback = window.setTimeout(cleanup, 120000);
  try { window.print(); }
  catch (error) { cleanup(); throw error; }
}

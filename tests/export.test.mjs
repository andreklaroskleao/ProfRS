import test from 'node:test';
import assert from 'node:assert/strict';
import { csvCell, makeCsv } from '../js/core/export.js';

test('CSV uses UTF-8 BOM and CRLF rows for spreadsheet compatibility', () => {
  const csv = makeCsv(['Título', 'Conteúdo'], [['Ação', 'linha 1\nlinha 2']]);
  assert.ok(csv.startsWith('\uFEFF'));
  assert.ok(csv.includes('\r\n'));
  assert.ok(csv.includes('"Ação"'));
});

test('CSV escapes commas, quotation marks and line breaks', () => {
  assert.equal(csvCell('A, "B"\nC'), '"A, ""B""\nC"');
});

test('CSV neutralizes values that spreadsheet applications may evaluate as formulas', () => {
  for (const value of ['=1+1', '+SUM(A1:A2)', '-2+3', '@SUM(A1)', '\t=CMD()', '\u2003=SUM(A1)']) {
    assert.equal(csvCell(value).startsWith('"\''), true);
  }
});

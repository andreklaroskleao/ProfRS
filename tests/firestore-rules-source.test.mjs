import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const rules = await readFile(new URL('../firestore.rules', import.meta.url), 'utf8');

test('as regras usam UID autenticado e um UID master explícito', () => {
  assert.match(rules, /request\.auth\.uid == userId/);
  assert.match(rules, /request\.auth\.uid == '__ADMIN_UID__'/);
});

test('rascunhos e conteúdo inativo ficam restritos ao administrador', () => {
  assert.match(rules, /isAdmin\(\) \|\| resource\.data\.status == 'published'/);
  assert.match(rules, /isAdmin\(\) \|\| resource\.data\.active == true/);
});

test('as regras não concedem acesso geral de leitura ou gravação', () => {
  assert.doesNotMatch(rules, /allow\s+(?:read|write|read\s*,\s*write)\s*:\s*if\s+true\s*;/);
  assert.match(rules, /allow read, write: if false/);
});

test('perfil e registros privados têm validação de campos e UID do caminho', () => {
  assert.match(rules, /validProfile\(userId, request\.resource\.data, true\)/);
  assert.match(rules, /validPlan\(request\.resource\.data, true\)/);
  assert.match(rules, /validPei\(request\.resource\.data, true\)/);
  assert.match(rules, /data\.keys\(\)\.hasOnly/);
  assert.match(rules, /match \/publicContent\/news\/items\/{newsId}/);
  assert.match(rules, /match \/publicContent\/officialLinks\/items\/{linkId}/);
});

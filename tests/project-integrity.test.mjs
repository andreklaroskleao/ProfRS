import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const children = await Promise.all(entries.map((entry) => {
    const fullPath = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(fullPath) : fullPath;
  }));
  return children.flat();
}

test('imports locais e o ponto de entrada HTML resolvem para arquivos existentes', async () => {
  const files = (await walk(path.join(projectRoot, 'js'))).filter((file) => /\.m?js$/.test(file));
  const missing = [];
  for (const file of files) {
    const source = await readFile(file, 'utf8');
    for (const match of source.matchAll(/(?:from\s*|import\s*\()\s*['"](\.{1,2}\/[^'"]+)['"]/g)) {
      const target = path.resolve(path.dirname(file), match[1]);
      try { await access(target); } catch { missing.push(`${path.relative(projectRoot, file)} → ${match[1]}`); }
    }
  }
  const html = await readFile(path.join(projectRoot, 'index.html'), 'utf8');
  assert.match(html, /src="\.\/js\/app\.js"/);
  assert.deepEqual(missing, []);
});

test('arquivos de configuração e catálogo curricular são JSON válidos', async () => {
  for (const file of ['firebase.json', '.firebaserc', 'firestore.indexes.json', 'js/data/skills-demo.json']) {
    const contents = await readFile(path.join(projectRoot, file), 'utf8');
    assert.doesNotThrow(() => JSON.parse(contents), `${file} deve conter JSON válido`);
  }
});

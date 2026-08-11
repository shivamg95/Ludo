#!/usr/bin/env node
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const engineDir = path.resolve('src/engine');
const banned = [/from\s+['"]react['"]/, /from\s+['"]react\//, /Math\.random\s*\(/, /Date\.now\s*\(/];

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) files.push(...(await walk(p)));
    else if (e.name.endsWith('.ts') && !e.name.endsWith('.test.ts')) files.push(p);
  }
  return files;
}

const files = await walk(engineDir);
let failed = false;
for (const file of files) {
  const text = await readFile(file, 'utf8');
  for (const re of banned) {
    if (re.test(text)) {
      console.error(`Banned pattern ${re} in ${file}`);
      failed = true;
    }
  }
}
if (failed) process.exit(1);
console.log('Engine import/purity checks passed.');

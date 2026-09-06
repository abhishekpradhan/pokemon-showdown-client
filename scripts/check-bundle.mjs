import { readFileSync, statSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { resolve } from 'node:path';

const manifest = JSON.parse(readFileSync('dist/.vite/manifest.json', 'utf8'));
const entry = Object.entries(manifest).find(([, item]) => item.isEntry);
if (!entry) throw new Error('Build manifest has no app entry');
const initial = new Set();
const seen = new Set();
const visit = key => {
  if (seen.has(key)) return;
  seen.add(key);
  const item = manifest[key];
  if (!item) throw new Error(`Missing manifest entry: ${key}`);
  initial.add(item.file);
  for (const css of item.css || []) initial.add(css);
  for (const dependency of item.imports || []) visit(dependency);
};
visit(entry[0]);
let initialGzip = 0;
for (const file of initial) initialGzip += gzipSync(readFileSync(resolve('dist', file))).length;
const worker = readFileSync('dist/sw.js', 'utf8');
const offlineManifest = worker.match(/^const BUILD = (.+);$/m)?.[1];
if (!offlineManifest) throw new Error('Worker is missing its generated offline manifest');
const assets = new Set(JSON.parse(offlineManifest).assets.map(path => path === '/' ? 'index.html' : path.slice(1)));
let allRaw = 0;
let allGzip = 0;
for (const file of assets) { const body = readFileSync(resolve('dist', file)); allRaw += statSync(resolve('dist', file)).size; allGzip += gzipSync(body).length; }
const budgets = { initialGzip: 300 * 1024, allGzip: 1_700 * 1024, allRaw: 8 * 1024 * 1024 };
const actual = { initialGzip, allGzip, allRaw };
console.log('Bundle bytes:', JSON.stringify({ actual, budgets }));
for (const key of Object.keys(budgets)) {
  if (actual[key] > budgets[key]) throw new Error(`${key} exceeds its reviewed bundle budget (${actual[key]} > ${budgets[key]})`);
}

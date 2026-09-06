import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Plugin } from 'vite';
import metadata from '../package.json';

export function buildArtifacts(env: Record<string, string>): Plugin {
  let outDir = '';
  return {
    name: 'arena-offline-manifest-and-provenance',
    apply: 'build',
    configResolved(config) { outDir = resolve(config.root, config.build.outDir); },
    closeBundle() {
      const assets = readdirSync(resolve(outDir, 'assets')).filter(file => /\.(js|css)$/.test(file)).map(file => `/assets/${file}`).sort();
      let revision = env.VERCEL_GIT_COMMIT_SHA || env.GITHUB_SHA || '';
      if (!/^[a-f0-9]{40}$/i.test(revision)) {
        try { revision = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(); }
        catch { revision = 'unversioned'; }
      }
      const sourceRoot = env.VITE_SOURCE_URL || 'https://github.com/abhishekpradhan/pokemon-showdown-client';
      const source = /^[a-f0-9]{40}$/i.test(revision) ? `${sourceRoot.replace(/\/$/, '')}/tree/${revision}` : sourceRoot;
      let modified = false;
      try { modified = !!execFileSync('git', ['status', '--porcelain', '--untracked-files=normal'], { encoding: 'utf8' }).trim(); }
      catch { modified = true; }
      const info = { name: metadata.name, version: metadata.version, revision, source, modified, upstream: 'https://github.com/smogon/pokemon-showdown-client', license: metadata.license };
      writeFileSync(resolve(outDir, 'build-info.json'), JSON.stringify(info, null, 2));
      const lock = JSON.parse(readFileSync('package-lock.json', 'utf8')) as { packages: Record<string, { version?: string; license?: string; dev?: boolean }> };
      const dependencies = Object.entries(lock.packages).filter(([key]) => key.startsWith('node_modules/')).map(([key, entry]) => ({
        name: key.slice(key.lastIndexOf('node_modules/') + 13), version: entry.version, license: entry.license || 'See package license', development: !!entry.dev,
      })).sort((a, b) => a.name.localeCompare(b.name));
      writeFileSync(resolve(outDir, 'third-party-licenses.json'), JSON.stringify({ sourceRevision: revision, dependencies }, null, 2));
      const notices = ['ARENA THIRD-PARTY NOTICES', 'Installed runtime package license/notice files; external media attribution is in docs/attribution.md.'];
      for (const [path, entry] of Object.entries(lock.packages)) {
        if (!path.startsWith('node_modules/') || entry.dev || !existsSync(path)) continue;
        const files = readdirSync(path, { withFileTypes: true }).filter(file => file.isFile() && /^(licen[sc]e|copying|notice)([.-].*)?$/i.test(file.name));
        for (const file of files) notices.push(`\n${path} ${entry.version || ''} — ${file.name}\n${readFileSync(resolve(path, file.name), 'utf8')}`);
      }
      writeFileSync(resolve(outDir, 'THIRD_PARTY_NOTICES.txt'), notices.join('\n'));
      const shellPath = resolve(outDir, 'index.html');
      const shell = readFileSync(shellPath, 'utf8');
      const template = readFileSync('public/sw.js', 'utf8');
      const buildId = createHash('sha256').update(assets.join('\n') + shell + template + revision).digest('hex').slice(0, 20);
      writeFileSync(shellPath, shell.replace('</head>', `  <meta name="arena-build" content="${buildId}" />\n  </head>`));
      const core = ['/', '/manifest.webmanifest', '/favicon.svg', '/icon-512.png', '/build-info.json', '/third-party-licenses.json', '/THIRD_PARTY_NOTICES.txt', ...assets];
      writeFileSync(resolve(outDir, 'sw.js'), template.replace(/const BUILD = \/\* @arena-manifest \*\/ .*;/, `const BUILD = ${JSON.stringify({ revision: buildId, assets: core })};`));
    },
  };
}

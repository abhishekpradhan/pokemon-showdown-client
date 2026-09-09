import { readFileSync } from 'node:fs';

// Reviewed SPDX expressions in this lockfile. A new license requires maintainer
// review; this is an inventory gate, not an automated legal compatibility opinion.
const reviewed = new Set([
  'MIT',
  'ISC',
  'BSD-2-Clause',
  'BSD-3-Clause',
  'Apache-2.0',
  '0BSD',
  'CC0-1.0',
  'Python-2.0',
  'BlueOak-1.0.0',
  'CC-BY-4.0',
  'CC-BY-3.0',
  'AGPL-3.0-or-later',
  '(MIT OR CC0-1.0)',
  '(MIT AND Zlib)',
  'MIT-0',
  'Unlicense',
  'MPL-2.0',
  '(MPL-2.0 OR Apache-2.0)',
]);
const packages = Object.entries(JSON.parse(readFileSync('package-lock.json', 'utf8')).packages).filter(
  ([path]) => path.startsWith('node_modules/'),
);
const unknown = packages.filter(([, data]) => !data.license || !reviewed.has(data.license));
if (unknown.length) {
  for (const [path, data] of unknown) console.error(`${path}: ${data.license || 'missing SPDX metadata'}`);
  throw new Error('Review new dependency licenses and update the inventory policy before release.');
}
console.log(`Reviewed SPDX metadata present for ${packages.length} locked dependencies.`);

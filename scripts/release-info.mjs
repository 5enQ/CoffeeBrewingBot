// Prints release info for CI: version from package.json and its title from CHANGELOG.md.
// Usage: node scripts/release-info.mjs version|title
import { readFileSync } from 'node:fs';

const version = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version;
const changelog = readFileSync(new URL('../CHANGELOG.md', import.meta.url), 'utf8');
const heading = changelog.split('\n').find((l) => l.startsWith(`## v${version}`)) ?? '';
const title = heading.replace(/^##\s*/, '').replace(/\s*\(\d{4}-\d{2}-\d{2}\)\s*$/, '') || `v${version}`;

const what = process.argv[2];
process.stdout.write(what === 'title' ? title.replace(/["\\$`]/g, '').slice(0, 90) : version);

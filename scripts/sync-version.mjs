import { readFile, writeFile } from 'node:fs/promises';

const packageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
const utilsUrl = new URL('../src/lib/utils.ts', import.meta.url);
const utils = await readFile(utilsUrl, 'utf8');
const next = utils.replace(
  /export const APP_VERSION = '[^']+';/,
  `export const APP_VERSION = '${packageJson.version}';`,
);

if (next === utils) {
  if (!utils.includes(`export const APP_VERSION = '${packageJson.version}';`)) {
    throw new Error('APP_VERSION não encontrado em src/lib/utils.ts');
  }
} else {
  await writeFile(utilsUrl, next, 'utf8');
  console.log(`APP_VERSION sincronizada para ${packageJson.version}`);
}

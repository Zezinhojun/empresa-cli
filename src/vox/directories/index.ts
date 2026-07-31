import { readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const ext = path.extname(fileURLToPath(import.meta.url));

const files = readdirSync(currentDir).filter(
  (file) =>
    file.endsWith(ext) &&
    file !== `index${ext}` &&
    !file.endsWith(`.test${ext}`) &&
    !file.endsWith(`.spec${ext}`),
);

for (const file of files) {
  await import(`./${file}`);
}

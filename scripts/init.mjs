/**
 * Transforma este scaffold na SUA CLI. Roda uma vez:
 *
 *   npm run init -- <nome> [--repo dono/repositorio] [--author "Seu Nome <voce@exemplo.com>"]
 *
 * Troca o nome de exemplo `mycli` (comando, pasta de scripts, variáveis MYCLI_*, ~/.mycli, pacote npm),
 * preenche dono/repositório/autor e remove a si mesmo. Depois: `npm run build && npm test`.
 */
import { existsSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const PLACEHOLDER = 'mycli';
const SKIP = new Set(['.git', 'coverage', 'dist', 'node_modules']);
const BINARY = /\.(png|jpe?g|gif|ico|woff2?)$/i;
// Sem hífen: o nome vira identificador em código (ex.: helpers de teste).
const NAME = /^[a-z][a-z0-9]{0,38}$/;

/** Troca a marca e os placeholders em um texto. Pura: é o que o teste confere. */
export function renameContent(text, { author, name, repo }) {
  const upper = name.toUpperCase();
  const title = name[0].toUpperCase() + name.slice(1);
  let out = text
    .replaceAll(PLACEHOLDER, name)
    .replaceAll(PLACEHOLDER.toUpperCase(), upper)
    .replaceAll('Mycli', title);

  if (repo) {
    out = out.replaceAll('OWNER/REPO', repo).replaceAll('@OWNER', `@${repo.split('/')[0]}`);
  }
  if (author) {
    out = out
      .replaceAll('Seu Nome <voce@exemplo.com>', author)
      .replaceAll(
        'Copyright (c) 2026 Seu Nome',
        `Copyright (c) 2026 ${author.replace(/\s*<.*>$/, '')}`,
      );
  }
  return out;
}

function walk(dir, visit) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(entry.name)) continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) walk(path, visit);
    visit(path, entry);
  }
}

function parse(argv) {
  const [name, ...rest] = argv;
  const option = (flag) => {
    const index = rest.indexOf(flag);
    return index === -1 ? undefined : rest[index + 1];
  };
  return { author: option('--author'), name, repo: option('--repo') };
}

export function main(argv, root = process.cwd()) {
  const options = parse(argv);
  if (!options.name || !NAME.test(options.name)) {
    throw new Error(
      'Informe o nome da CLI em minúsculas, letras e números (ex.: npm run init -- meucli).',
    );
  }
  if (options.repo && !/^[\w.-]+\/[\w.-]+$/.test(options.repo)) {
    throw new Error('--repo deve ser "dono/repositorio".');
  }
  if (!existsSync(join(root, `${PLACEHOLDER}-scripts`))) {
    throw new Error(`Já inicializado: não existe mais a pasta ${PLACEHOLDER}-scripts/.`);
  }

  // 1) conteúdo. O lock só tem o nome do pacote e do binário (hashes nunca são tocados).
  walk(root, (path, entry) => {
    if (entry.isDirectory() || BINARY.test(path)) return;
    const before = readFileSync(path, 'utf8');
    const after = path.endsWith('package-lock.json')
      ? before
          .replaceAll(`"name": "${PLACEHOLDER}"`, `"name": "${options.name}"`)
          .replaceAll(`"${PLACEHOLDER}": "dist/index.js"`, `"${options.name}": "dist/index.js"`)
      : renameContent(before, options);
    if (after !== before) writeFileSync(path, after);
  });

  // 2) nomes de arquivos e pastas (o `walk` já devolve os filhos antes da pasta)
  const renames = [];
  walk(root, (path) => {
    const base = path.split(/[\\/]/).pop();
    if (base.includes(PLACEHOLDER)) renames.push(path);
  });
  for (const path of renames) {
    const base = path.split(/[\\/]/).pop();
    renameSync(path, join(path, '..', base.replaceAll(PLACEHOLDER, options.name)));
  }

  // 3) o init some: não faz sentido rodar duas vezes
  for (const file of ['init.mjs', 'init.test.ts'])
    rmSync(join(root, 'scripts', file), { force: true });
  const pkgPath = join(root, 'package.json');
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
  delete pkg.scripts.init;
  writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);

  return options;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const { name, repo } = main(process.argv.slice(2));
    console.log(`Pronto: a CLI agora se chama "${name}".`);
    if (!repo)
      console.log(
        'Faltou --repo: troque OWNER/REPO em package.json, CODEOWNERS e SECURITY.md à mão.',
      );
    console.log('Próximos passos: npm run build && npm test  (o init removeu a si mesmo).');
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}

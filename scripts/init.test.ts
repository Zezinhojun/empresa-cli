import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';

// @ts-expect-error módulo .mjs sem tipos
import { main, renameContent } from './init.mjs'; // eslint-disable-line n/no-missing-import -- o lint não resolve .mjs

const root = mkdtempSync(join(tmpdir(), 'init-'));
afterAll(() => rmSync(root, { force: true, recursive: true }));

describe('renameContent', () => {
  it('troca as três grafias e preenche dono, repo e autor', () => {
    const text = 'mycli MYCLI_JSON Mycli ~/.mycli OWNER/REPO @OWNER Seu Nome <voce@exemplo.com>';
    expect(
      renameContent(text, { author: 'Ana <ana@x.com>', name: 'meucli', repo: 'acme/meucli' }),
    ).toBe('meucli MEUCLI_JSON Meucli ~/.meucli acme/meucli @acme Ana <ana@x.com>');
  });

  it('sem --repo e --author deixa os placeholders', () => {
    expect(renameContent('OWNER/REPO', { name: 'x' })).toBe('OWNER/REPO');
  });
});

describe('main', () => {
  const tree = (dir: string) => {
    mkdirSync(join(dir, 'mycli-scripts', 'ola'), { recursive: true });
    mkdirSync(join(dir, 'scripts'));
    writeFileSync(join(dir, 'mycli-scripts', 'ola', 'ola.js'), 'process.env.MYCLI_YES');
    writeFileSync(join(dir, 'scripts', 'init.mjs'), '');
    writeFileSync(
      join(dir, 'package.json'),
      JSON.stringify({ name: 'mycli', scripts: { build: 'x', init: 'node scripts/init.mjs' } }),
    );
    writeFileSync(join(dir, 'package-lock.json'), '{"name": "mycli", "sha512-xmyclix": 1}');
  };

  it('renomeia conteúdo e pastas, poupa hashes do lock e remove o init', () => {
    const dir = join(root, 'ok');
    mkdirSync(dir);
    tree(dir);

    main(['meucli'], dir);

    expect(readFileSync(join(dir, 'meucli-scripts', 'ola', 'ola.js'), 'utf8')).toBe(
      'process.env.MEUCLI_YES',
    );
    expect(JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'))).toEqual({
      name: 'meucli',
      scripts: { build: 'x' },
    });
    expect(readFileSync(join(dir, 'package-lock.json'), 'utf8')).toContain('sha512-xmyclix');
    expect(() => main(['outra'], dir)).toThrow(/Já inicializado/);
  });

  it('recusa nome inválido e repo malformado', () => {
    expect(() => main(['Minha CLI'], root)).toThrow(/minúsculas/);
    expect(() => main(['ok', '--repo', 'sem-barra'], root)).toThrow(/dono\/repositorio/);
  });
});

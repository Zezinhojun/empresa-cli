import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/**
 * Contrato de uso da CLI por agentes de IA (docs/cli-contract.md), verificado no binário real:
 * sem terminal (stdin/stdout em pipe), sem prompts, JSON limpo em stdout, exit codes estáveis.
 */
const DIST = resolve(import.meta.dirname, '../../dist/index.js');

const ANSI = /\u001B\[/;
const EMOJI = /\p{Extended_Pictographic}/u;

let home: string;

interface Result {
  status: number | null;
  stderr: string;
  stdout: string;
}

function mycli(args: string[], env: Record<string, string> = {}, input = ''): Result {
  const base: Record<string, string | undefined> = {
    ...process.env,
    HOME: home,
    USERPROFILE: home,
  };
  for (const key of ['CI', 'NO_COLOR', 'FORCE_COLOR']) delete base[key];
  const r = spawnSync(process.execPath, [DIST, ...args], {
    encoding: 'utf8',
    env: { ...base, ...env },
    input, // stdin vira um pipe que fecha: nunca é um terminal
    timeout: 20_000,
  });
  return { status: r.status, stderr: r.stderr, stdout: r.stdout };
}

/** stdout inteiro precisa ser UM único JSON; qualquer texto a mais quebra o parse. */
function parseJson(r: Result) {
  expect(r.stdout.trim().split('\n'), 'stdout deve ter exatamente uma linha').toHaveLength(1);
  return JSON.parse(r.stdout) as {
    command?: string;
    data?: unknown;
    error?: { code: string; message: string };
    ok: boolean;
    schemaVersion: number;
  };
}

beforeAll(() => {
  home = mkdtempSync(join(tmpdir(), 'mycli-contract-'));
  mkdirSync(join(home, 'mycli', 'files', 'servicos'), { recursive: true });
  writeFileSync(join(home, 'mycli', 'files', 'leia-me.txt'), 'oi');
});

afterAll(() => rmSync(home, { force: true, recursive: true }));

describe('sem terminal: nunca trava nem executa sozinho', () => {
  it('`mycli` sem argumentos mostra a ajuda, sai 0 e não abre menu', () => {
    const r = mycli([]);

    expect(r.status).toBe(0);
    expect(r.stdout).toContain('Comandos:');
    expect(r.stdout).not.toContain('Selecione um comando');
  });

  it('mesmo recebendo Enter pelo stdin, não executa comando algum', () => {
    const r = mycli([], {}, '\n\n\n');

    expect(r.status).toBe(0);
    expect(r.stdout).not.toContain('Conteúdo de');
    expect(r.stdout).not.toContain('Top 10');
  });

  it.each([
    ['--no-input', ['--no-input'], {}],
    ['CI=true', [], { CI: 'true' }],
  ])('%s: ajuda em vez de menu', (_nome, args, env) => {
    const r = mycli(args, env);

    expect(r.status).toBe(0);
    expect(r.stdout).toContain('Comandos:');
  });

  it('`mycli menu` recusa com código 2 e dica, sem abrir prompt', () => {
    const r = mycli(['menu']);

    expect(r.status).toBe(2);
    expect(r.stdout).not.toContain('Selecione');
    expect(r.stderr).toContain('terminal interativo');
  });
});

describe('sem decoração fora de terminal', () => {
  it('sem ANSI nem emoji, mesmo com FORCE_COLOR', () => {
    for (const args of [[], ['--help'], ['list-files'], ['list']]) {
      const r = mycli(args, { FORCE_COLOR: '3' });
      expect(r.stdout, `mycli ${args.join(' ')}`).not.toMatch(ANSI);
      expect(r.stdout, `mycli ${args.join(' ')}`).not.toMatch(EMOJI);
    }
  });

  it('list-files em texto simples: pasta com "/" no fim', () => {
    const r = mycli(['list-files']);

    expect(r.stdout).toContain('servicos/');
    expect(r.stdout).toContain('leia-me.txt');
  });

  it.each([['--plain'], ['NO_COLOR']])('%s também é respeitado', (modo) => {
    const r =
      modo === '--plain'
        ? mycli(['list-files', '--plain'])
        : mycli(['list-files'], { NO_COLOR: '1' });

    expect(r.stdout).not.toMatch(ANSI);
    expect(r.stdout).not.toMatch(EMOJI);
  });
});

describe('--json: uma linha em stdout, sempre', () => {
  it('é guiado pelo catálogo: todo comando não interativo e sem argumento obrigatório', () => {
    const catalog = parseJson(mycli(['list', '--json'])).data as {
      commands: {
        args: { required: boolean }[];
        interactive: boolean;
        name: string;
        risk: string;
      }[];
    };
    // Só os de leitura rodam sozinhos; write/destructive pedem --yes (testado logo abaixo).
    const runnable = catalog.commands.filter(
      (c) => !c.interactive && !c.args.some((a) => a.required) && c.risk === 'read',
    );
    expect(runnable.map((c) => c.name)).toEqual(
      expect.arrayContaining(['agent-guide', 'list', 'list-files', 'top-memory']),
    );

    for (const command of catalog.commands) {
      expect(['read', 'write', 'destructive'], `risk de ${command.name}`).toContain(command.risk);
    }

    for (const command of runnable) {
      const r = mycli([command.name, '--json']);
      const out = parseJson(r);

      expect(out.schemaVersion, command.name).toBe(1);
      expect(out.command ?? out.error?.code, command.name).toBeTruthy();
      expect(r.stdout, command.name).not.toMatch(ANSI);
      expect(r.stderr, `${command.name}: stderr deve ficar vazio com --json`).toBe('');
      expect([0, 1], `${command.name}: exit code`).toContain(r.status);
      expect(out.ok, command.name).toBe(r.status === 0);
    }
  });

  it('comando que altera (write/destructive) NUNCA executa sem --yes: exit 4 e JSON de erro', () => {
    const catalog = parseJson(mycli(['list', '--json'])).data as {
      commands: {
        args: { required: boolean }[];
        interactive: boolean;
        name: string;
        risk: string;
      }[];
    };
    const mutating = catalog.commands.filter(
      (c) => !c.interactive && !c.args.some((a) => a.required) && c.risk !== 'read',
    );

    for (const command of mutating) {
      const r = mycli([command.name, '--json']);

      expect(r.status, `${command.name} sem --yes`).toBe(4);
      expect(r.stderr, command.name).toBe('');
      expect(parseJson(r), command.name).toMatchObject({
        error: { code: 'CONFIRMATION_REQUIRED' },
        ok: false,
      });
    }
  });

  it('flags globais valem antes e depois do comando', () => {
    const antes = parseJson(mycli(['--json', 'list-files']));
    const depois = parseJson(mycli(['list-files', '--json']));

    expect(antes).toEqual(depois);
    expect(antes.ok).toBe(true);
  });

  it('versão e ajuda também respondem em JSON', () => {
    expect(parseJson(mycli(['--version', '--json'])).data).toMatchObject({
      version: expect.any(String),
    });
    expect(parseJson(mycli(['--help', '--json'])).command).toBe('help');
    expect(parseJson(mycli(['--json'])).command).toBe('help'); // sem args e sem terminal
  });

  it('--help por comando descreve uso, argumentos e risco', () => {
    const out = parseJson(mycli(['list-files', '--help', '--json']));

    expect(out.data).toMatchObject({
      args: [{ name: 'subpasta', required: false }],
      risk: 'read',
      usage: 'mycli list-files [subpasta]',
    });
  });
});

describe('erros: código de saída estável + JSON de erro só em stdout', () => {
  it.each([
    ['comando inexistente', ['nao-existe'], 2, 'UNKNOWN_COMMAND'],
    ['opção desconhecida', ['list-files', '--bogus'], 2, 'UNKNOWN_OPTION'],
    ['argumentos demais', ['list-files', 'a', 'b'], 2, 'INVALID_ARGUMENTS'],
    ['menu sem terminal', ['menu'], 2, 'INTERACTIVE_REQUIRED'],
    ['subpasta fora da base', ['list-files', '../..'], 2, 'PATH_OUTSIDE_BASE'],
    ['pasta inexistente', ['list-files', 'nao-existe'], 1, 'NOT_FOUND'],
  ])('%s → exit %i (%s)', (_nome, args, status, code) => {
    const r = mycli([...args, '--json']);

    expect(r.status).toBe(status);
    expect(r.stderr).toBe('');
    expect(parseJson(r)).toMatchObject({ error: { code }, ok: false, schemaVersion: 1 });
  });

  it('em texto, o erro vai para stderr e stdout fica vazio', () => {
    const r = mycli(['nao-existe']);

    expect(r.status).toBe(2);
    expect(r.stdout).toBe('');
    expect(r.stderr).toContain('não encontrado');
  });

  it('`--` entrega o argumento literal (não vira flag)', () => {
    const r = mycli(['list-files', '--json', '--', '--json']);

    // "--json" depois de "--" é uma subpasta (inexistente), não a flag
    expect(parseJson(r).error?.code).toBe('NOT_FOUND');
  });
});

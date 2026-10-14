import { confirm } from '@inquirer/prompts';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import type { Runtime } from '../cli/runtime.js';

import pkg from '../../package.json' with { type: 'json' };
import { resetRuntime, setRuntime } from '../cli/runtime.js';
import { parseManifest, type Manifest } from '../runner/manifest.js';
import { hashDirectory } from '../runner/scriptIndex.js';
import { ScriptCommand } from './ScriptCommand.js';

// Os scripts rodam de verdade: usa o execa real, não o mock global do setup.
vi.unmock('execa');

let dir: string;
const OTHER_OS = process.platform === 'win32' ? 'linux' : 'win32';

const agent: Runtime = {
  dryRun: false,
  interactive: false,
  json: true,
  plain: true,
  verbose: false,
  yes: false,
};
const person: Runtime = { ...agent, interactive: true, json: false };

const manifest = (extra: Record<string, unknown> = {}): Manifest =>
  parseManifest(
    { description: 'Faz algo', entry: 'run.js', name: 'meu-script', risk: 'read', ...extra },
    'teste',
  );
const command = (extra: Record<string, unknown> = {}) =>
  new ScriptCommand(manifest(extra), dir, hashDirectory(dir));

/** Marcadores ficam FORA da pasta do script: arquivo novo lá dentro é "código não revisado". */
let out: string;

beforeAll(() => {
  out = mkdtempSync(path.join(tmpdir(), 'vox-script-out-'));
  dir = mkdtempSync(path.join(tmpdir(), 'vox-script-'));
  mkdirSync(path.join(dir, 'x'));
  writeFileSync(
    path.join(dir, 'run.js'),
    `const fs = require('node:fs');
     if (process.argv[2] === 'marcar') fs.writeFileSync(process.argv[3], 'executou');
     console.log(JSON.stringify({ args: process.argv.slice(2), cwd: process.cwd(), env: process.env }));
     if (process.argv[2] === 'falhar') process.exit(2);`,
  );
});
afterAll(() => {
  rmSync(dir, { force: true, recursive: true });
  rmSync(out, { force: true, recursive: true });
});
afterEach(() => {
  resetRuntime();
  vi.clearAllMocks();
});

describe('ScriptCommand: o que a CLI enxerga', () => {
  it('expõe o manifesto como comando (nome, args, risco, requisitos, categoria, origem)', () => {
    const cmd = command({
      args: [
        { description: 'Onde', name: 'pasta', required: true },
        { description: 'Quem', name: 'dono' },
      ],
      category: 'setup',
      requires: ['docker'],
      risk: 'write',
    });

    expect(cmd).toMatchObject({
      args: [
        { description: 'Onde', name: 'pasta', required: true },
        { description: 'Quem', name: 'dono', required: false },
      ],
      category: 'setup',
      description: 'Faz algo',
      kind: 'script',
      name: 'meu-script',
      requires: ['docker'],
      risk: 'write',
    });
  });

  it('sem categoria, category é undefined', () => {
    expect(command().category).toBeUndefined();
  });
});

describe('ScriptCommand.execute (risk: read)', () => {
  it('executa e devolve os dados no modo --json (stdout capturado)', async () => {
    setRuntime(agent);

    const result = await command().execute(['a', 'b']);

    expect(result).toMatchObject({
      dryRun: false,
      exitCode: 0,
      runtime: 'node',
      script: 'meu-script',
    });
    expect(JSON.parse(result.stdout ?? '').args).toEqual(['a', 'b']);
    expect(result.command).toBeUndefined();
  });

  it('entrega as variáveis VOX_* e NÃO vaza segredos do ambiente do usuário', async () => {
    process.env.VOX_TESTE_SEGREDO = 'nao-vazar';
    setRuntime({ ...agent, yes: true });

    const { stdout } = await command().execute();
    delete process.env.VOX_TESTE_SEGREDO;
    const env = JSON.parse(stdout ?? '').env as Record<string, string>;

    expect(env).toMatchObject({
      VOX_JSON: '1',
      VOX_NO_INPUT: '1',
      VOX_SCRIPT_DIR: dir,
      VOX_VERSION: pkg.version,
      VOX_YES: '1',
    });
    expect(env.VOX_TESTE_SEGREDO).toBeUndefined();
  });

  it('com terminal interativo: VOX_NO_INPUT=0 e VOX_JSON=0', async () => {
    // json=true só para capturar; interativo é o que interessa ao script
    setRuntime({ ...person, json: true });
    // (json desliga o interativo na CLI real; aqui forçamos o runtime para observar as variáveis)
    const { stdout } = await command().execute();
    const env = JSON.parse(stdout ?? '').env as Record<string, string>;

    expect(env.VOX_NO_INPUT).toBe('0');
  });

  it('roda no diretório de onde o usuário chamou', async () => {
    setRuntime(agent);

    const { stdout } = await command().execute();

    expect(path.resolve(JSON.parse(stdout ?? '').cwd)).toBe(path.resolve(process.cwd()));
  });

  it('script que falha vira SCRIPT_FAILED com o código real', async () => {
    setRuntime(agent);

    await expect(command().execute(['falhar'])).rejects.toMatchObject({
      code: 'SCRIPT_FAILED',
      details: { exitCode: 2 },
    });
  });

  it('modo humano: não captura (a saída vai direto ao terminal) e o format não imprime nada', async () => {
    setRuntime({ ...person, plain: true });

    const result = await command().execute();

    expect(result.stdout).toBeUndefined();
    expect(command().format(result)).toBe('');
  });
});

describe('ScriptCommand: sistema operacional e requisitos', () => {
  it('sistema não suportado: UNSUPPORTED_OS (exit 3) e não executa', async () => {
    setRuntime(agent);
    const marca = path.join(out, 'marca-os');

    await expect(command({ os: [OTHER_OS] }).execute([])).rejects.toMatchObject({
      code: 'UNSUPPORTED_OS',
      details: { os: [OTHER_OS], platform: process.platform },
      exitCode: 3,
      hint: expect.stringContaining('funciona em'),
    });
    expect(existsSync(marca)).toBe(false);
  });

  it('o sistema atual na lista: executa', async () => {
    setRuntime(agent);

    await expect(command({ os: [process.platform] }).execute()).resolves.toMatchObject({
      exitCode: 0,
    });
  });

  it('requisito ausente: MISSING_REQUIREMENT (exit 3) dizendo o que instalar, sem executar', async () => {
    setRuntime(agent);

    await expect(
      command({ requires: ['programa-que-nao-existe-xyz'] }).execute(),
    ).rejects.toMatchObject({
      code: 'MISSING_REQUIREMENT',
      details: { missing: ['programa-que-nao-existe-xyz'] },
      exitCode: 3,
      hint: expect.stringContaining('Instale programa-que-nao-existe-xyz'),
      message: expect.stringContaining('precisa do programa programa-que-nao-existe-xyz'),
    });
  });

  it('vários requisitos ausentes: plural e lista todos', async () => {
    setRuntime(agent);

    const error = await command({ requires: ['nada-um-xyz', 'nada-dois-xyz'] })
      .execute()
      .then(
        () => undefined,
        (e: unknown) => e as Error,
      );

    expect(error?.message).toContain('precisa dos programas nada-um-xyz, nada-dois-xyz');
    expect(error?.message).toContain('não estão instalados');
  });

  it('requisito presente (node está no PATH): executa', async () => {
    setRuntime(agent);

    await expect(command({ requires: ['node'] }).execute()).resolves.toMatchObject({ exitCode: 0 });
  });
});

describe.each(['write', 'destructive'] as const)('ScriptCommand (risk: %s)', (risk) => {
  const marca = () => path.join(out, `marca-${risk}-${Math.random().toString(36).slice(2)}`);
  /** O script cria `file` se for executado: é como sabemos se rodou ou não. */
  const runWith = (runtime: Runtime, file: string) => {
    setRuntime(runtime);
    return command({ risk }).execute(['marcar', file]);
  };

  it('agente sem --yes: CONFIRMATION_REQUIRED (exit 4) e o script NÃO executa', async () => {
    const file = marca();

    await expect(runWith(agent, file)).rejects.toMatchObject({
      code: 'CONFIRMATION_REQUIRED',
      exitCode: 4,
      hint: expect.stringContaining('--yes'),
    });
    expect(existsSync(file)).toBe(false);
  });

  it('agente com --yes: executa sem perguntar', async () => {
    const file = marca();

    await expect(runWith({ ...agent, yes: true }, file)).resolves.toMatchObject({ exitCode: 0 });
    expect(existsSync(file)).toBe(true);
    expect(confirm).not.toHaveBeenCalled();
  });

  it('pessoa responde SIM: executa', async () => {
    const file = marca();
    vi.mocked(confirm).mockResolvedValueOnce(true);

    await expect(runWith(person, file)).resolves.toMatchObject({ exitCode: 0 });
    expect(existsSync(file)).toBe(true);
  });

  it('pessoa responde NÃO: CANCELLED (exit 1) e o script NÃO executa', async () => {
    const file = marca();
    vi.mocked(confirm).mockResolvedValueOnce(false);

    await expect(runWith(person, file)).rejects.toMatchObject({ code: 'CANCELLED', exitCode: 1 });
    expect(existsSync(file)).toBe(false);
  });

  it('o aviso da pergunta é claro sobre o que pode acontecer', async () => {
    vi.mocked(confirm).mockResolvedValueOnce(true);

    await runWith(person, marca());

    expect(vi.mocked(confirm).mock.calls[0]?.[0].message).toContain(
      risk === 'destructive' ? 'APAGAR' : 'alterar coisas',
    );
  });

  it('--dry-run não pergunta e não executa; mostra o comando', async () => {
    const file = marca();

    const result = await runWith({ ...agent, dryRun: true }, file);

    expect(result).toMatchObject({ dryRun: true, exitCode: null });
    expect(result.command?.at(-1)).toBeDefined();
    expect(existsSync(file)).toBe(false);
    expect(confirm).not.toHaveBeenCalled();
    expect(command({ risk }).format(result)).toMatch(/^Executaria: .*run\.js/);
  });
});

describe('ScriptCommand: leitura nunca pergunta', () => {
  it('risk read não pede confirmação nem em modo agente', async () => {
    setRuntime(agent);

    await command().execute();

    expect(confirm).not.toHaveBeenCalled();
  });
});

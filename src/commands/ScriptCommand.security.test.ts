import { confirm } from '@inquirer/prompts';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Runtime } from '../cli/runtime.js';

import { resetRuntime, setRuntime } from '../cli/runtime.js';
import { parseManifest } from '../runner/manifest.js';
import { hashDirectory } from '../runner/scriptIndex.js';
import { ScriptCommand } from './ScriptCommand.js';

// Os scripts rodam de verdade: usa o execa real, não o mock global do setup.
vi.unmock('execa');

const agent: Runtime = {
  dryRun: false,
  interactive: false,
  json: true,
  plain: true,
  verbose: false,
  yes: false,
};

let work: string;
let dir: string;
let marker: string;
let auditFile: string;

const build = (extra: Record<string, unknown> = {}) =>
  new ScriptCommand(
    parseManifest(
      { description: 'Faz algo', entry: 'run.js', name: 'meu-script', risk: 'read', ...extra },
      'teste',
    ),
    dir,
    hashDirectory(dir), // como o índice do build: hashes tirados ANTES de qualquer adulteração
  );

const audit = () =>
  existsSync(auditFile)
    ? readFileSync(auditFile, 'utf8')
        .trim()
        .split('\n')
        .map((line) => JSON.parse(line) as Record<string, unknown>)
    : [];

beforeEach(() => {
  work = mkdtempSync(path.join(tmpdir(), 'vox-sec-'));
  dir = path.join(work, 'script');
  mkdirSync(dir);
  marker = path.join(work, 'executou.txt');
  auditFile = path.join(work, 'audit', 'audit.log');
  process.env.VOX_AUDIT_LOG = auditFile;
  // Se for executado, cria o marcador (fora da pasta do script).
  writeFileSync(
    path.join(dir, 'run.js'),
    `require('node:fs').writeFileSync(${JSON.stringify(marker)}, 'executou'); console.log('ok');`,
  );
  setRuntime(agent);
});
afterEach(() => {
  process.env.VOX_AUDIT_LOG = 'off';
  resetRuntime();
  vi.clearAllMocks();
  rmSync(work, { force: true, recursive: true });
});

describe('integridade: script alterado depois da instalação NÃO executa', () => {
  it('arquivo modificado: INTEGRITY_ERROR (exit 1), nada executa e diz qual arquivo mudou', async () => {
    const cmd = build();
    writeFileSync(
      path.join(dir, 'run.js'),
      `require('node:fs').writeFileSync(${JSON.stringify(marker)}, 'MALICIOSO')`,
    );

    await expect(cmd.execute()).rejects.toMatchObject({
      code: 'INTEGRITY_ERROR',
      details: { changed: ['run.js'], extra: [], missing: [], symlinks: [] },
      exitCode: 1,
      hint: expect.stringContaining('npm install -g cli-vox'),
      message: expect.stringContaining('foram alterados'),
    });
    expect(existsSync(marker)).toBe(false);
  });

  it('arquivo EXTRA na pasta (código que ninguém revisou, que o script poderia carregar)', async () => {
    const cmd = build();
    writeFileSync(path.join(dir, 'injetado.js'), 'console.log("x")');

    await expect(cmd.execute()).rejects.toMatchObject({
      code: 'INTEGRITY_ERROR',
      details: { extra: ['injetado.js'] },
    });
    expect(existsSync(marker)).toBe(false);
  });

  it('arquivo de apoio REMOVIDO', async () => {
    writeFileSync(path.join(dir, 'apoio.json'), '{}');
    const cmd = build();
    unlinkSync(path.join(dir, 'apoio.json'));

    await expect(cmd.execute()).rejects.toMatchObject({
      code: 'INTEGRITY_ERROR',
      details: { missing: ['apoio.json'] },
    });
  });

  it('alterar 1 único byte já é detectado', async () => {
    const cmd = build();
    const original = readFileSync(path.join(dir, 'run.js'), 'utf8');
    writeFileSync(path.join(dir, 'run.js'), `${original} `);

    await expect(cmd.execute()).rejects.toMatchObject({ code: 'INTEGRITY_ERROR' });
  });

  it('subpasta com arquivo novo também conta', async () => {
    const cmd = build();
    mkdirSync(path.join(dir, 'lib'));
    writeFileSync(path.join(dir, 'lib', 'novo.js'), 'x');

    await expect(cmd.execute()).rejects.toMatchObject({ details: { extra: ['lib/novo.js'] } });
  });

  it('link simbólico é recusado (poderia apontar para fora da pasta)', async (context) => {
    const cmd = build();
    try {
      symlinkSync(path.join(work, 'alvo-fora.txt'), path.join(dir, 'atalho'));
    } catch {
      context.skip(); // Windows sem privilégio para criar links
    }

    await expect(cmd.execute()).rejects.toMatchObject({
      code: 'INTEGRITY_ERROR',
      details: { symlinks: ['atalho'] },
    });
  });

  it('o PRÓPRIO arquivo de entrada trocado por link para fora: recusado e nada executa', async (context) => {
    const cmd = build();
    const fora = path.join(work, 'fora.js');
    writeFileSync(fora, `require('node:fs').writeFileSync(${JSON.stringify(marker)}, 'fora');`);
    unlinkSync(path.join(dir, 'run.js'));
    try {
      symlinkSync(fora, path.join(dir, 'run.js'));
    } catch {
      context.skip(); // Windows sem privilégio para criar links
    }

    await expect(cmd.execute()).rejects.toMatchObject({
      code: 'INTEGRITY_ERROR',
      details: { symlinks: ['run.js'] },
    });
    expect(existsSync(marker)).toBe(false);
  });

  it('a checagem vem ANTES de tudo: nem pergunta confirmação nem confere sistema/requisitos', async () => {
    const outroSistema = process.platform === 'win32' ? 'linux' : 'win32';
    const cmd = build({ os: [outroSistema], requires: ['nao-existe-xyz'], risk: 'destructive' });
    writeFileSync(path.join(dir, 'run.js'), 'alterado');

    await expect(cmd.execute()).rejects.toMatchObject({ code: 'INTEGRITY_ERROR' });
    expect(confirm).not.toHaveBeenCalled();
  });

  it('--dry-run também é bloqueado (mostrar o que rodaria de um script adulterado engana)', async () => {
    const cmd = build();
    writeFileSync(path.join(dir, 'run.js'), 'alterado');
    setRuntime({ ...agent, dryRun: true });

    await expect(cmd.execute()).rejects.toMatchObject({ code: 'INTEGRITY_ERROR' });
  });

  it('pasta íntegra: executa normalmente', async () => {
    await expect(build().execute()).resolves.toMatchObject({ exitCode: 0 });
    expect(existsSync(marker)).toBe(true);
  });
});

describe('injeção por argumento (no nível do comando)', () => {
  it('argumentos hostis chegam literais e nada extra é executado', async () => {
    writeFileSync(path.join(dir, 'run.js'), 'console.log(JSON.stringify(process.argv.slice(2)));');
    const cmd = build();
    const hostis = [
      '; touch invadido',
      '$(touch invadido)',
      '`touch invadido`',
      '&& touch invadido',
      '| tee invadido',
    ];

    const { stdout } = await cmd.execute(hostis);

    expect(JSON.parse(stdout ?? '')).toEqual(hostis);
    expect(existsSync(path.join(process.cwd(), 'invadido'))).toBe(false);
    expect(existsSync(path.join(dir, 'invadido'))).toBe(false);
  });
});

describe('auditoria: toda tentativa é registrada', () => {
  it('execução ok: quem, quando, o quê, risco, resultado — sem a saída do script', async () => {
    await build().execute(['a', 'b']);

    const [entry] = audit();
    expect(entry).toMatchObject({
      args: ['a', 'b'],
      exitCode: 0,
      interactive: false,
      outcome: 'ok',
      risk: 'read',
      runtime: 'node',
      script: 'meu-script',
      yes: false,
    });
    expect(entry?.user).toEqual(expect.any(String));
    expect(entry?.platform).toBe(process.platform);
    expect(entry?.version).toMatch(/^\d+\.\d+\.\d+/);
    expect(new Date(String(entry?.time)).toString()).not.toBe('Invalid Date');
    expect(entry?.durationMs).toEqual(expect.any(Number));
    // o script imprime "ok" em stdout; isso NÃO pode parar no log (só metadados)
    expect(entry).not.toHaveProperty('stdout');
    expect(entry).not.toHaveProperty('stderr');
    expect(Object.keys(entry ?? {}).sort()).toEqual(
      [
        'args',
        'durationMs',
        'exitCode',
        'interactive',
        'outcome',
        'platform',
        'risk',
        'runtime',
        'script',
        'time',
        'user',
        'version',
        'yes',
      ].sort(),
    );
  });

  it('script que falha: outcome=failed com o código real', async () => {
    writeFileSync(path.join(dir, 'run.js'), 'process.exit(3)');

    await expect(build().execute()).rejects.toMatchObject({ code: 'SCRIPT_FAILED' });

    expect(audit()[0]).toMatchObject({
      errorCode: 'SCRIPT_FAILED',
      exitCode: 3,
      outcome: 'failed',
    });
  });

  it('negado por falta de --yes: outcome=denied', async () => {
    await expect(build({ risk: 'write' }).execute()).rejects.toMatchObject({ exitCode: 4 });

    expect(audit()[0]).toMatchObject({
      errorCode: 'CONFIRMATION_REQUIRED',
      outcome: 'denied',
      risk: 'write',
    });
    expect(existsSync(marker)).toBe(false);
  });

  it('pessoa disse não: outcome=cancelled', async () => {
    setRuntime({ ...agent, interactive: true, json: false });
    vi.mocked(confirm).mockResolvedValueOnce(false);

    await expect(build({ risk: 'destructive' }).execute()).rejects.toMatchObject({
      code: 'CANCELLED',
    });

    expect(audit()[0]).toMatchObject({
      interactive: true,
      outcome: 'cancelled',
      risk: 'destructive',
    });
  });

  it('integridade violada: outcome=blocked', async () => {
    const cmd = build();
    writeFileSync(path.join(dir, 'run.js'), 'alterado');

    await expect(cmd.execute()).rejects.toMatchObject({ code: 'INTEGRITY_ERROR' });

    expect(audit()[0]).toMatchObject({ errorCode: 'INTEGRITY_ERROR', outcome: 'blocked' });
  });

  it('--dry-run: outcome=dry-run', async () => {
    setRuntime({ ...agent, dryRun: true });

    await build().execute();

    expect(audit()[0]).toMatchObject({ exitCode: null, outcome: 'dry-run' });
  });

  it('registra effects e a pasta alvo; sem effects, os campos não aparecem', async () => {
    setRuntime({ ...agent, confirm: path.basename(process.cwd()), yes: true });
    await build({ effects: ['delete:node_modules'], risk: 'destructive' }).execute();
    await build().execute();

    const [destructive, plain] = audit();
    expect(destructive).toMatchObject({
      effects: ['delete:node_modules'],
      outcome: 'ok',
      target: expect.stringContaining(path.basename(process.cwd())),
    });
    expect(plain).not.toHaveProperty('effects');
    expect(plain).not.toHaveProperty('target');
  });

  it('negado por falta de --confirm: registra denied com os effects e o alvo', async () => {
    setRuntime({ ...agent, yes: true });

    await expect(
      build({ effects: ['delete:vendor'], risk: 'destructive' }).execute(),
    ).rejects.toMatchObject({ code: 'CONFIRMATION_REQUIRED' });

    expect(audit()[0]).toMatchObject({
      effects: ['delete:vendor'],
      errorCode: 'CONFIRMATION_REQUIRED',
      outcome: 'denied',
      target: expect.any(String),
    });
  });

  it('com --yes registra yes=true', async () => {
    setRuntime({ ...agent, yes: true });

    await build({ risk: 'write' }).execute();

    expect(audit()[0]).toMatchObject({ outcome: 'ok', risk: 'write', yes: true });
  });

  it('timeout: outcome=timeout', async () => {
    writeFileSync(path.join(dir, 'run.js'), 'setTimeout(() => {}, 30000);');

    await expect(build({ timeoutSec: 1 }).execute()).rejects.toMatchObject({
      code: 'SCRIPT_TIMEOUT',
    });

    expect(audit()[0]).toMatchObject({ errorCode: 'SCRIPT_TIMEOUT', outcome: 'timeout' });
  });

  it('erro inesperado (fora da lista) vira outcome=error', async () => {
    const cmd = build({ requires: ['nao-existe-xyz'] });

    await expect(cmd.execute()).rejects.toMatchObject({ code: 'MISSING_REQUIREMENT' });

    expect(audit()[0]).toMatchObject({ errorCode: 'MISSING_REQUIREMENT', outcome: 'blocked' });
  });

  it('SEGREDOS nos argumentos são mascarados no log (mas o script recebe os valores reais)', async () => {
    writeFileSync(path.join(dir, 'run.js'), 'console.log(JSON.stringify(process.argv.slice(2)));');
    // credencial FALSA montada em tempo de execução (não dispara o secret scanning do GitHub)
    const segredo = ['gh', 'p_abcdefghijklmnopqrstuvwxyz0123456789'].join('');

    const { stdout } = await build().execute([
      '--token',
      'valor-secreto',
      `--api-key=${segredo}`,
      'normal',
    ]);

    expect(JSON.parse(stdout ?? '')).toEqual([
      '--token',
      'valor-secreto',
      `--api-key=${segredo}`,
      'normal',
    ]);
    const logged = readFileSync(auditFile, 'utf8');
    expect(logged).not.toContain('valor-secreto');
    expect(logged).not.toContain(segredo);
    expect(audit()[0]?.args).toEqual(['--token', '***', '--api-key=***', 'normal']);
  });

  it('um log que não pode ser gravado NUNCA derruba o comando', async () => {
    // o "diretório" do log é, na verdade, um arquivo: mkdir/append vão falhar
    const bloqueio = path.join(work, 'bloqueio');
    writeFileSync(bloqueio, 'arquivo, não pasta');
    process.env.VOX_AUDIT_LOG = path.join(bloqueio, 'audit.log');

    await expect(build().execute()).resolves.toMatchObject({ exitCode: 0 });
  });

  it('VOX_AUDIT_LOG=off não cria arquivo', async () => {
    process.env.VOX_AUDIT_LOG = 'off';

    await build().execute();

    expect(existsSync(auditFile)).toBe(false);
  });
});

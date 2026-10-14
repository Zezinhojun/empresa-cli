import { describe, expect, it, vi } from 'vitest';

import { installHelp } from './hints.js';
import { findInterpreter } from './interpreters.js';
import { runScript, type RunOptions } from './runScript.js';

vi.unmock('execa');
vi.mock('./interpreters.js', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  findInterpreter: vi.fn(),
}));

const options = (entry: string): RunOptions => ({
  args: [],
  capture: true,
  dryRun: false,
  entry,
  env: {},
  interactive: false,
  name: 'meu-script',
  timeoutSec: 5,
});

describe('runScript: dependência ausente', () => {
  it.each([
    ['a.sh', 'Bash', 'bash'],
    ['a.py', 'Python 3', 'python'],
  ])(
    '%s sem runtime: MISSING_RUNTIME (exit 3), não executa e explica o que instalar',
    async (entry, label, runtime) => {
      vi.mocked(findInterpreter).mockResolvedValueOnce(undefined);

      await expect(runScript(options(entry))).rejects.toMatchObject({
        code: 'MISSING_RUNTIME',
        details: { install: installHelp(runtime), runtime },
        exitCode: 3,
        hint: expect.stringContaining('vox doctor'),
        message: expect.stringContaining(`precisa do ${label}`),
      });
    },
  );

  it('a mensagem cita o comando e NUNCA mostra "ENOENT" ou stack', async () => {
    vi.mocked(findInterpreter).mockResolvedValueOnce(undefined);

    const error = await runScript(options('a.py')).then(
      () => undefined,
      (e: unknown) => e as Error,
    );

    expect(error?.message).toContain("'meu-script'");
    expect(error?.message).not.toMatch(/ENOENT|spawn|at .*\.ts/);
  });

  it('--dry-run também avisa que falta o runtime (não finge que daria certo)', async () => {
    vi.mocked(findInterpreter).mockResolvedValueOnce(undefined);

    await expect(runScript({ ...options('a.py'), dryRun: true })).rejects.toMatchObject({
      exitCode: 3,
    });
  });

  it('interpretador que some depois de detectado: SCRIPT_FAILED (não finge sucesso)', async () => {
    vi.mocked(findInterpreter).mockResolvedValueOnce({
      args: [],
      command: 'comando-que-nao-existe-xyz',
      runtime: 'node',
      version: 'v0',
    });

    await expect(runScript(options('a.js'))).rejects.toMatchObject({
      code: 'SCRIPT_FAILED',
      exitCode: 1,
    });
  });
});

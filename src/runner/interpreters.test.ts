import { execa } from 'execa';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { findInterpreter, resetInterpreterCache, runtimeOf } from './interpreters.js';

vi.mock('node:fs', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  existsSync: vi.fn(),
}));

type ExecaResult = Awaited<ReturnType<typeof execa>>;
const reply = (exitCode: number, stdout = '', stderr = '') =>
  ({ exitCode, stderr, stdout }) as unknown as ExecaResult;
/** Responde por executável: { python3: reply(...), ... }; o resto falha como "não encontrado". */
const fakeSystem = (table: Record<string, ExecaResult>) =>
  vi.mocked(execa).mockImplementation(((cmd: string) => {
    const found = table[cmd];
    return found ? Promise.resolve(found) : Promise.reject(new Error(`spawn ${cmd} ENOENT`));
  }) as unknown as typeof execa);

describe('runtimeOf', () => {
  it.each([
    ['a.js', 'node'],
    ['a.mjs', 'node'],
    ['a.cjs', 'node'],
    ['a.sh', 'bash'],
    ['a.py', 'python'],
    ['A.PY', 'python'],
    ['dir/sub/a.sh', 'bash'],
  ])('%s → %s', (file, runtime) => {
    expect(runtimeOf(file)).toBe(runtime);
  });

  it.each(['a.rb', 'a', 'a.ps1'])('%s não é suportado', (file) => {
    expect(runtimeOf(file)).toBeUndefined();
  });
});

describe('findInterpreter', () => {
  beforeEach(() => {
    resetInterpreterCache();
    vi.mocked(execa).mockReset();
    vi.mocked(existsSync).mockReset();
  });

  it('node: é o próprio Node da CLI, sem sondar nada', async () => {
    await expect(findInterpreter('node')).resolves.toEqual({
      args: [],
      command: process.execPath,
      runtime: 'node',
      version: process.version,
    });
    expect(execa).not.toHaveBeenCalled();
  });

  describe('python', () => {
    it('usa o primeiro que FUNCIONA, pulando o atalho vazio da Microsoft Store', async () => {
      fakeSystem({
        python: reply(0, 'Python 3.12.6'),
        python3: reply(
          9009,
          '',
          'Python não foi encontrado; executar sem argumentos para instalar...',
        ),
      });

      await expect(findInterpreter('python')).resolves.toMatchObject({
        command: 'python',
        runtime: 'python',
      });
    });

    it('python3 vence quando funciona', async () => {
      fakeSystem({ python: reply(0, 'Python 3.9.1'), python3: reply(0, 'Python 3.11.2') });

      await expect(findInterpreter('python')).resolves.toMatchObject({ command: 'python3' });
    });

    it('cai para `py -3` (launcher do Windows) com o argumento -3', async () => {
      fakeSystem({ py: reply(0, 'Python 3.12.6') });

      await expect(findInterpreter('python')).resolves.toEqual({
        args: ['-3'],
        command: 'py',
        runtime: 'python',
        version: 'Python 3.12.6',
      });
      expect(execa).toHaveBeenCalledWith('py', ['-3', '--version'], expect.any(Object));
    });

    it('rejeita Python 2', async () => {
      fakeSystem({ python: reply(0, '', 'Python 2.7.18'), python3: reply(1) });

      await expect(findInterpreter('python')).resolves.toBeUndefined();
    });

    it('sem nenhum funcionando (ou execa lançando erro): undefined', async () => {
      fakeSystem({});

      await expect(findInterpreter('python')).resolves.toBeUndefined();
    });
  });

  describe('bash', () => {
    it('Linux/macOS: `bash` do sistema', async () => {
      fakeSystem({ bash: reply(0, 'GNU bash, version 5.2') });

      await expect(findInterpreter('bash', 'linux')).resolves.toEqual({
        args: [],
        command: 'bash',
        runtime: 'bash',
        version: 'GNU bash, version 5.2',
      });
    });

    it('guarda a primeira linha não vazia da versão (Python 2 imprime em stderr, o Git Bash em stdout)', async () => {
      fakeSystem({ python3: reply(0, '\n\nPython 3.12.6\nmais uma linha') });

      await expect(findInterpreter('python')).resolves.toMatchObject({ version: 'Python 3.12.6' });
    });

    it('Windows: só o Git Bash; NUNCA o `bash` do PATH (launcher do WSL)', async () => {
      const gitBash = path.join('C:\\Program Files', 'Git', 'bin', 'bash.exe');
      vi.mocked(existsSync).mockImplementation((file) => file === gitBash);
      fakeSystem({
        bash: reply(0, 'GNU bash, version 5.0 (WSL)'),
        [gitBash]: reply(0, 'GNU bash, version 5.2'),
      });

      const found = await findInterpreter('bash', 'win32', { ProgramFiles: 'C:\\Program Files' });

      expect(found?.command).toBe(gitBash);
      expect(execa).not.toHaveBeenCalledWith('bash', expect.anything(), expect.anything());
    });

    it('Windows sem Git instalado: undefined (e nem tenta o bash do PATH)', async () => {
      vi.mocked(existsSync).mockReturnValue(false);
      fakeSystem({ bash: reply(0, 'GNU bash') });

      await expect(
        findInterpreter('bash', 'win32', { ProgramFiles: 'C:\\Program Files' }),
      ).resolves.toBeUndefined();
      expect(execa).not.toHaveBeenCalled();
    });

    it('Windows: procura também em ProgramFiles(x86) e em LOCALAPPDATA\\Programs', async () => {
      const local = path.join('C:\\Users\\u\\AppData\\Local', 'Programs', 'Git', 'bin', 'bash.exe');
      vi.mocked(existsSync).mockImplementation((file) => file === local);
      fakeSystem({ [local]: reply(0, 'GNU bash') });

      const found = await findInterpreter('bash', 'win32', {
        LOCALAPPDATA: 'C:\\Users\\u\\AppData\\Local',
        'ProgramFiles(x86)': 'C:\\Program Files (x86)',
      });

      expect(found?.command).toBe(local);
    });
  });

  it('guarda o resultado: a segunda chamada não sonda de novo', async () => {
    fakeSystem({ python3: reply(0, 'Python 3.12.6') });

    await findInterpreter('python');
    await findInterpreter('python');

    expect(execa).toHaveBeenCalledTimes(1);
  });
});

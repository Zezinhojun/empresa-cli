import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CliError, ExitCode, reportError } from './errors.js';
import { resetRuntime, setRuntime } from './runtime.js';

describe('reportError', () => {
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => vi.restoreAllMocks());

  it('CliError: mensagem + dica em stderr e o exit code do erro', () => {
    const code = reportError(new CliError('falhou', ExitCode.usage, 'X', 'faça Y'));

    expect(code).toBe(2);
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('falhou'));
    expect(errorSpy).toHaveBeenCalledWith('faça Y');
  });

  it('CliError sem dica não imprime linha extra', () => {
    reportError(new CliError('só msg'));
    expect(errorSpy).toHaveBeenCalledOnce();
  });

  it('Ctrl+C em prompt: 130 e silêncio', () => {
    const error = Object.assign(new Error('x'), { name: 'ExitPromptError' });

    expect(reportError(error)).toBe(ExitCode.interrupted);
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('erro comum: exit 1, sem stack por padrão', () => {
    expect(reportError(new Error('boom'))).toBe(1);
    expect(errorSpy).toHaveBeenCalledOnce();
  });

  it('--verbose inclui o stack', () => {
    reportError(new Error('boom'), true);
    expect(errorSpy).toHaveBeenCalledTimes(2);
  });

  it('valor que não é Error é convertido em texto', () => {
    expect(reportError('texto')).toBe(1);
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('texto'));
  });

  describe('erros do sistema viram frases claras', () => {
    const sys = (code: string, path?: string) =>
      Object.assign(new Error(`${code}: mensagem técnica do Node`), {
        code,
        ...(path && { path }),
      });
    const printed = () => errorSpy.mock.calls.flat().join('\n');

    it.each([
      ['EACCES', 'Sem permissão para acessar o arquivo ou pasta: /x/y'],
      ['EPERM', 'Sem permissão para acessar o arquivo ou pasta: /x/y'],
      ['ENOENT', 'Arquivo ou pasta não encontrado: /x/y'],
    ])('%s com caminho', (code, frase) => {
      expect(reportError(sys(code, '/x/y'))).toBe(1);
      expect(printed()).toContain(frase);
      expect(printed()).not.toMatch(/mensagem técnica|EACCES|EPERM|ENOENT/);
    });

    it('sem caminho a frase continua boa (sem ": undefined")', () => {
      reportError(sys('ENOENT'));

      expect(printed()).toContain('Arquivo ou pasta não encontrado');
      expect(printed()).not.toContain('undefined');
    });

    it('ENOSPC: disco cheio, com dica', () => {
      reportError(sys('ENOSPC'));

      expect(printed()).toContain('Não há espaço livre no disco');
      expect(printed()).toContain('Libere espaço');
    });

    it('código desconhecido mantém a mensagem original', () => {
      reportError(sys('EXYZ'));

      expect(printed()).toContain('mensagem técnica do Node');
    });

    it('--verbose mantém o stack para quem precisa depurar', () => {
      reportError(sys('EACCES', '/x'), true);

      expect(printed()).toContain('mensagem técnica do Node');
    });

    it('um CliError não é "traduzido" por cima: a mensagem dele manda', () => {
      reportError(Object.assign(new CliError('minha mensagem'), { code: 'EACCES' }));

      expect(printed()).toContain('minha mensagem');
    });

    it('com --json: code estável e hint, sem texto técnico', () => {
      const writes: string[] = [];
      vi.spyOn(process.stdout, 'write').mockImplementation((chunk) => {
        writes.push(String(chunk));
        return true;
      });
      setRuntime({
        dryRun: false,
        interactive: false,
        json: true,
        plain: true,
        verbose: false,
        yes: false,
      });

      reportError(sys('EACCES', '/x'));
      resetRuntime();

      expect(JSON.parse(writes.join(''))).toMatchObject({
        error: { code: 'PERMISSION_DENIED', hint: expect.stringContaining('permiss') },
        ok: false,
      });
      expect(writes.join('')).not.toContain('mensagem técnica');
    });
  });

  describe('com --json', () => {
    let writes: string[];
    const json = () =>
      JSON.parse(writes.join('')) as { error: Record<string, unknown>; ok: boolean };

    beforeEach(() => {
      writes = [];
      vi.spyOn(process.stdout, 'write').mockImplementation((chunk) => {
        writes.push(String(chunk));
        return true;
      });
      setRuntime({
        dryRun: false,
        interactive: false,
        json: true,
        plain: true,
        verbose: false,
        yes: false,
      });
    });

    afterEach(resetRuntime);

    it('CliError: SÓ o envelope de erro em stdout; stderr vazio; devolve o exit code', () => {
      const code = reportError(new CliError('falhou', ExitCode.usage, 'X', 'faça Y'));

      expect(code).toBe(2);
      expect(json()).toEqual({
        error: { code: 'X', hint: 'faça Y', message: 'falhou' },
        ok: false,
        schemaVersion: 1,
      });
      expect(errorSpy).not.toHaveBeenCalled();
    });

    it('details do CliError vão no JSON (ex.: código de saída do script)', () => {
      reportError(
        new CliError('falhou', 1, 'SCRIPT_FAILED', undefined, { exitCode: 3, stdout: 'x' }),
      );

      expect(json().error).toEqual({
        code: 'SCRIPT_FAILED',
        details: { exitCode: 3, stdout: 'x' },
        message: 'falhou',
      });
    });

    it('erro comum: code ERROR, exit 1, sem hint', () => {
      expect(reportError(new Error('boom'))).toBe(1);
      expect(json().error).toEqual({ code: 'ERROR', message: 'boom' });
    });

    it('--verbose inclui o stack no JSON', () => {
      reportError(new Error('boom'), true);
      expect(json().error.stack).toEqual(expect.stringContaining('boom'));
    });

    it('Ctrl+C continua silencioso (130)', () => {
      expect(reportError(Object.assign(new Error('x'), { name: 'ExitPromptError' }))).toBe(130);
      expect(writes).toEqual([]);
    });
  });
});

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
      setRuntime({ interactive: false, json: true, plain: true, verbose: false, yes: false });
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

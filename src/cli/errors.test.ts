import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CliError, ExitCode, reportError } from './errors.js';

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
});

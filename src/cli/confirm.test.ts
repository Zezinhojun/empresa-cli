import { confirm } from '@inquirer/prompts';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { confirmAction } from './confirm.js';
import { resetRuntime, setRuntime } from './runtime.js';

const base = { interactive: false, json: false, plain: false, verbose: false, yes: false };

describe('confirmAction', () => {
  afterEach(() => {
    resetRuntime();
    vi.clearAllMocks();
  });

  it('--yes confirma sem perguntar', async () => {
    setRuntime({ ...base, yes: true });

    await expect(confirmAction('apagar?')).resolves.toBe(true);
    expect(confirm).not.toHaveBeenCalled();
  });

  it('sem terminal e sem --yes: exit 4 explicando a flag, sem abrir prompt', async () => {
    setRuntime(base);

    await expect(confirmAction('apagar?')).rejects.toMatchObject({
      code: 'CONFIRMATION_REQUIRED',
      exitCode: 4,
      hint: expect.stringContaining('--yes'),
      message: expect.stringContaining('apagar?'),
    });
    expect(confirm).not.toHaveBeenCalled();
  });

  it('interativo: pergunta (padrão não) e devolve a resposta', async () => {
    setRuntime({ ...base, interactive: true });
    vi.mocked(confirm).mockResolvedValueOnce(true);

    await expect(confirmAction('apagar?')).resolves.toBe(true);
    expect(confirm).toHaveBeenCalledWith({ default: false, message: 'apagar?' });
  });
});

import { afterEach, describe, expect, it } from 'vitest';

import { getRuntime, resetRuntime, resolveRuntime, setRuntime } from './runtime.js';

const flags = {
  dryRun: false,
  json: false,
  noInput: false,
  plain: false,
  verbose: false,
  yes: false,
};
const tty = { isTTY: true };
const pipe = { isTTY: undefined };

describe('resolveRuntime', () => {
  it('terminal de verdade sem flags: interativo', () => {
    expect(resolveRuntime(flags, {}, tty, tty)).toMatchObject({
      dryRun: false,
      interactive: true,
      plain: false,
    });
  });

  it.each([
    ['stdin sem TTY', pipe, tty],
    ['stdout sem TTY', tty, pipe],
  ])('%s: não interativo', (_nome, stdin, stdout) => {
    expect(resolveRuntime(flags, {}, stdin, stdout).interactive).toBe(false);
  });

  it('--no-input e --json desligam os prompts mesmo com terminal', () => {
    expect(resolveRuntime({ ...flags, noInput: true }, {}, tty, tty).interactive).toBe(false);
    expect(resolveRuntime({ ...flags, json: true }, {}, tty, tty).interactive).toBe(false);
  });

  it.each([
    ['true', false],
    ['1', false],
    ['', true],
    ['false', true],
    ['0', true],
  ])('CI=%j: interativo=%s', (ci, esperado) => {
    expect(resolveRuntime(flags, { CI: ci }, tty, tty).interactive).toBe(esperado);
  });

  it('plain: --plain, --json, stdout sem TTY ou NO_COLOR', () => {
    expect(resolveRuntime({ ...flags, plain: true }, {}, tty, tty).plain).toBe(true);
    expect(resolveRuntime({ ...flags, json: true }, {}, tty, tty).plain).toBe(true);
    expect(resolveRuntime(flags, {}, tty, pipe).plain).toBe(true);
    expect(resolveRuntime(flags, { NO_COLOR: '1' }, tty, tty).plain).toBe(true);
    expect(resolveRuntime(flags, { NO_COLOR: '' }, tty, tty).plain).toBe(false);
  });

  it('repassa dryRun, json, verbose e yes', () => {
    expect(
      resolveRuntime(
        { ...flags, dryRun: true, json: true, verbose: true, yes: true },
        {},
        tty,
        tty,
      ),
    ).toMatchObject({
      dryRun: true,
      json: true,
      verbose: true,
      yes: true,
    });
  });
});

describe('get/set/resetRuntime', () => {
  afterEach(resetRuntime);

  it('usa o runtime definido e volta a deduzir do ambiente após o reset', () => {
    const definido = {
      dryRun: false,
      interactive: true,
      json: false,
      plain: false,
      verbose: false,
      yes: false,
    };
    setRuntime(definido);
    expect(getRuntime()).toBe(definido);

    resetRuntime();
    expect(getRuntime()).not.toBe(definido);
  });
});

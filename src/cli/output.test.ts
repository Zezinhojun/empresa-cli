import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Command } from '../core/command/Command.js';

import { emitData, emitJson, printResult, SCHEMA_VERSION } from './output.js';
import { resetRuntime, setRuntime } from './runtime.js';

const base = {
  dryRun: false,
  interactive: false,
  json: false,
  plain: true,
  verbose: false,
  yes: false,
};

describe('output', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  let writes: string[];
  const stdout = () => writes.join('');

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    writes = [];
    vi.spyOn(process.stdout, 'write').mockImplementation((chunk) => {
      writes.push(String(chunk));
      return true;
    });
  });

  afterEach(() => {
    resetRuntime();
    vi.restoreAllMocks();
  });

  it('emitJson escreve UMA linha de JSON em stdout', () => {
    emitJson({ a: 1 });
    expect(stdout()).toBe('{"a":1}\n');
  });

  it('emitData usa o envelope versionado e troca undefined por null', () => {
    emitData('x', undefined);
    expect(JSON.parse(stdout())).toEqual({
      command: 'x',
      data: null,
      ok: true,
      schemaVersion: SCHEMA_VERSION,
    });
  });

  describe('printResult', () => {
    const cmd: Command = { execute: () => {}, name: 'foo' };

    it('--json: só o envelope em stdout, nada via console.log', () => {
      setRuntime({ ...base, json: true });

      printResult(cmd, { n: 1 });

      expect(JSON.parse(stdout())).toEqual({
        command: 'foo',
        data: { n: 1 },
        ok: true,
        schemaVersion: 1,
      });
      expect(logSpy).not.toHaveBeenCalled();
    });

    it('--json sem dados: data null (sempre uma resposta)', () => {
      setRuntime({ ...base, json: true });

      printResult(cmd, undefined);

      expect(JSON.parse(stdout()).data).toBeNull();
    });

    it('humano: usa o format do comando com o runtime', () => {
      setRuntime(base);
      const format = vi.fn().mockReturnValue('texto');

      printResult({ ...cmd, format }, { n: 1 });

      expect(format).toHaveBeenCalledWith({ n: 1 }, base);
      expect(logSpy).toHaveBeenCalledWith('texto');
      expect(stdout()).toBe('');
    });

    it('humano sem format: string direta, objeto como JSON indentado', () => {
      setRuntime(base);

      printResult(cmd, 'oi');
      printResult(cmd, { a: 1 });

      expect(logSpy).toHaveBeenNthCalledWith(1, 'oi');
      expect(logSpy).toHaveBeenNthCalledWith(2, '{\n  "a": 1\n}');
    });

    it('humano sem dados: não imprime nada', () => {
      setRuntime(base);
      printResult(cmd, undefined);
      expect(logSpy).not.toHaveBeenCalled();
    });
  });
});

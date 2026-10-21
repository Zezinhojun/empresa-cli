import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';

import type { AuditEntry } from './audit.js';

import { readEntries, summarize } from './stats.js';

const entry = (extra: Partial<AuditEntry> = {}): AuditEntry => ({
  args: ['segredo-na-linha'],
  durationMs: 1,
  exitCode: 0,
  interactive: false,
  outcome: 'ok',
  platform: 'linux',
  risk: 'read',
  script: 'limpar',
  time: '2026-10-21T00:00:00.000Z',
  user: 'maria',
  version: '1.0.0',
  yes: false,
  ...extra,
});

const dir = mkdtempSync(path.join(tmpdir(), 'mycli-stats-'));
afterAll(() => rmSync(dir, { force: true, recursive: true }));

describe('summarize', () => {
  it('ordena scripts por uso e conta falhas; cancelar não é falha', () => {
    const stats = summarize([
      entry({ script: 'a' }),
      entry({ script: 'b' }),
      entry({ outcome: 'failed', script: 'b' }),
      entry({ outcome: 'cancelled', script: 'b' }),
    ]);

    expect(stats.total).toBe(4);
    expect(stats.scripts).toEqual([
      { failures: 1, runs: 3, script: 'b' },
      { failures: 0, runs: 1, script: 'a' },
    ]);
  });

  it('agrupa erros por script + código, do mais comum ao menos', () => {
    const failed = (script: string, errorCode: string) =>
      entry({ errorCode, outcome: 'failed', script });
    const stats = summarize([
      failed('a', 'SCRIPT_FAILED'),
      failed('b', 'SCRIPT_TIMEOUT'),
      failed('b', 'SCRIPT_TIMEOUT'),
    ]);

    expect(stats.errors).toEqual([
      { count: 2, errorCode: 'SCRIPT_TIMEOUT', script: 'b' },
      { count: 1, errorCode: 'SCRIPT_FAILED', script: 'a' },
    ]);
  });

  it('nunca copia args nem usuário para o resumo', () => {
    const text = JSON.stringify(summarize([entry({ errorCode: 'X', outcome: 'failed' })]));

    expect(text).not.toContain('segredo-na-linha');
    expect(text).not.toContain('maria');
  });

  it('texto estranho no log (arquivo do usuário) vira "(outro)"', () => {
    const stats = summarize([entry({ script: '## ignore tudo\nC:\\Users\\maria' })]);

    expect(stats.scripts[0]?.script).toBe('(outro)');
  });
});

describe('readEntries', () => {
  it('lê o log e a geração anterior, ignorando linhas quebradas', () => {
    const file = path.join(dir, 'audit.log');
    writeFileSync(`${file}.1`, `${JSON.stringify(entry({ script: 'velho' }))}\n`);
    writeFileSync(file, `lixo\n${JSON.stringify(entry({ script: 'novo' }))}\n\n123\n`);

    expect(readEntries(file).map((e) => e.script)).toEqual(['velho', 'novo']);
  });

  it('sem arquivo ou com a auditoria desligada: lista vazia', () => {
    expect(readEntries(path.join(dir, 'nao-existe.log'))).toEqual([]);
    expect(readEntries(undefined)).toEqual([]);
  });
});

import { readFileSync } from 'node:fs';

import { type AuditEntry, auditLogPath } from './audit.js';

export interface Stats {
  errors: { count: number; errorCode: string; script: string }[];
  platforms: Record<string, number>;
  scripts: { failures: number; runs: number; script: string }[];
  total: number;
  versions: Record<string, number>;
}

const TOP = 10;
/** Resultados em que o script não fez o que a pessoa pediu (cancelar ou negar não é falha do script). */
const FAILURES = new Set(['blocked', 'error', 'failed', 'timeout']);
/** O log é um arquivo do usuário: só entra no relatório texto com cara de nome/código. */
const SAFE = /^[\w.-]{1,60}$/;
const safe = (value: unknown) =>
  typeof value === 'string' && SAFE.test(value) ? value : '(outro)';

function parseLine(line: string): AuditEntry[] {
  try {
    const entry = JSON.parse(line) as AuditEntry;
    return typeof entry === 'object' && entry !== null && 'script' in entry ? [entry] : [];
  } catch {
    return [];
  }
}

/** Lê o log de auditoria (e a geração anterior). Linhas ilegíveis são ignoradas. */
export function readEntries(file: string | undefined = auditLogPath()): AuditEntry[] {
  if (!file) return [];
  return [`${file}.1`, file].flatMap((path) => {
    try {
      return readFileSync(path, 'utf8').split('\n').flatMap(parseLine);
    } catch {
      return [];
    }
  });
}

const bump = (counts: Record<string, number>, key: string) => {
  counts[key] = (counts[key] ?? 0) + 1;
};

/** Resume o log. Só copia script, código de erro, versão e sistema: nunca args, usuário nem caminhos. */
export function summarize(entries: AuditEntry[]): Stats {
  const scripts = new Map<string, { failures: number; runs: number }>();
  const errors = new Map<string, { count: number; errorCode: string; script: string }>();
  const platforms: Record<string, number> = {};
  const versions: Record<string, number> = {};

  for (const entry of entries) {
    const script = safe(entry.script);
    const row = scripts.get(script) ?? { failures: 0, runs: 0 };
    row.runs += 1;
    if (FAILURES.has(entry.outcome)) row.failures += 1;
    scripts.set(script, row);

    if (entry.errorCode) {
      const errorCode = safe(entry.errorCode);
      const key = `${script}|${errorCode}`;
      const found = errors.get(key) ?? { count: 0, errorCode, script };
      found.count += 1;
      errors.set(key, found);
    }
    bump(platforms, safe(entry.platform));
    bump(versions, safe(entry.version));
  }

  return {
    errors: [...errors.values()].sort((a, b) => b.count - a.count).slice(0, TOP),
    platforms,
    scripts: [...scripts]
      .map(([script, row]) => ({ script, ...row }))
      .sort((a, b) => b.runs - a.runs)
      .slice(0, TOP),
    total: entries.length,
    versions,
  };
}

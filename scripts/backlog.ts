/**
 * Soma os relatórios `mycli report` (issues com o rótulo `relatorio-mycli`) e imprime o ranking de uso e
 * de erros para virar backlog. Uso: `npm run backlog` (precisa do `gh` autenticado).
 */
import { execFileSync } from 'node:child_process';

import type { Stats } from '../src/runner/stats.js';

const issues = JSON.parse(
  execFileSync(
    'gh',
    [
      'issue',
      'list',
      '--label',
      'relatorio-mycli',
      '--state',
      'all',
      '--limit',
      '500',
      '--json',
      'body',
    ],
    {
      encoding: 'utf8',
    },
  ),
) as { body: string }[];

const scripts = new Map<string, { failures: number; runs: number }>();
const errors = new Map<string, number>();
let reports = 0;

for (const { body } of issues) {
  const json = /```json\s*([\s\S]*?)```/.exec(body)?.[1];
  if (!json || !body.includes('<!-- mycli-report -->')) continue;
  try {
    const stats = JSON.parse(json) as Stats;
    reports += 1;
    for (const s of stats.scripts) {
      const row = scripts.get(s.script) ?? { failures: 0, runs: 0 };
      scripts.set(s.script, { failures: row.failures + s.failures, runs: row.runs + s.runs });
    }
    for (const e of stats.errors) {
      const key = `${e.script} ${e.errorCode}`;
      errors.set(key, (errors.get(key) ?? 0) + e.count);
    }
  } catch {
    // issue editada à mão: ignora
  }
}

const top = <T>(map: Map<string, T>, order: (value: T) => number) =>
  [...map].sort((a, b) => order(b[1]) - order(a[1]));

console.log(`# Backlog a partir de ${reports} relatório(s)\n`);
console.log('## Scripts mais usados\n\n| Script | Execuções | Falhas |\n| --- | --- | --- |');
for (const [name, row] of top(scripts, (r) => r.runs))
  console.log(`| ${name} | ${row.runs} | ${row.failures} |`);
console.log(
  '\n## Erros mais comuns (candidatos a issue)\n\n| Script e erro | Ocorrências |\n| --- | --- |',
);
for (const [name, count] of top(errors, (n) => n)) console.log(`| ${name} | ${count} |`);

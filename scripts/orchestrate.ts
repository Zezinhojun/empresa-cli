#!/usr/bin/env tsx
/**
 * Orquestrador Spec-Driven: Arquiteto → Engenheiro → Revisor
 * Usa: specs/spec.md, specs/task.md, specs/review.md
 * Uso: npx tsx scripts/orchestrate.ts "Requisito do usuário"
 */

import { spawnSync } from 'node:child_process';
import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = resolve(fileURLToPath(import.meta.url), '..');
const ROOT = resolve(__dirname, '..');
const SPECS_DIR = join(ROOT, 'specs');

interface Spec {
  title: string;
  context: string;
  functionalRequirements: string[];
  nonFunctionalRequirements: string[];
  contracts: string[];
  implementationPlan: string[];
  acceptanceCriteria: string[];
  affectedFiles: string[];
}

function runCmd(cmd: string, args: string[], cwd = ROOT): { stdout: string; stderr: string } {
  console.log(`\n$ ${cmd} ${args.join(' ')}`);
  const result = spawnSync(cmd, args, { cwd, encoding: 'utf8', shell: true });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`Command failed (${result.status}): ${result.stderr}`);
  return { stderr: result.stderr, stdout: result.stdout };
}

function ensureSpecsDir() {
  if (!existsSync(SPECS_DIR)) mkdirSync(SPECS_DIR, { recursive: true });
}

function writeMd(file: string, content: string) {
  writeFileSync(file, content);
  console.log(`📄 ${file}`);
}

// Parser robusto: extrai seções entre headers ## e parseia listas com checkbox
function parseSpec(content: string): Spec {
  // Remove frontmatter se houver
  const body = content.replace(/^---[\s\S]*?---/, '').trim();

  const sections: Record<string, string> = {};
  const headerRegex = /^##\s+(.+)$/gm;
  let match;
  let lastHeader = '';
  let lastIndex = 0;

  while ((match = headerRegex.exec(body)) !== null) {
    if (lastHeader) {
      sections[lastHeader] = body.slice(lastIndex, match.index).trim();
    }
    lastHeader = match[1].trim();
    lastIndex = match.index + match[0].length;
  }
  if (lastHeader) {
    sections[lastHeader] = body.slice(lastIndex).trim();
  }

  const listItems = (text: string): string[] =>
    text
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.startsWith('-'))
      .map((l) =>
        l
          .replace(/^-\s*\[[ x]\]\s*/, '')
          .replace(/^-\s*/, '')
          .trim(),
      )
      .filter(Boolean);

  return {
    acceptanceCriteria: listItems(sections['Critérios de Aceite'] || ''),
    affectedFiles: listItems(sections['Arquivos Afetados'] || ''),
    context: sections['Contexto'] || '',
    contracts: listItems(sections['Contratos/Interfaces'] || ''),
    functionalRequirements: listItems(sections['Requisitos Funcionais'] || ''),
    implementationPlan: listItems(sections['Plano de Implementação'] || ''),
    nonFunctionalRequirements: listItems(sections['Requisitos Não-Funcionais'] || ''),
    title: body.match(/^#\s+Spec:\s+(.+)/m)?.[1] || 'Untitled',
  };
}

function loadSpec(): Spec {
  const file = join(SPECS_DIR, 'spec.md');
  if (!existsSync(file)) throw new Error('spec.md não encontrado em specs/');
  return parseSpec(readFileSync(file, 'utf8'));
}

function saveSpec(spec: Spec, iter: number) {
  const file = join(SPECS_DIR, 'spec.md');
  const md =
    `# Spec: ${spec.title}\n\n` +
    `**Iteração:** ${iter}\n` +
    `**Timestamp:** ${new Date().toISOString()}\n\n` +
    `## Contexto\n${spec.context}\n\n` +
    `## Requisitos Funcionais\n${spec.functionalRequirements.map((r) => `- [ ] ${r}`).join('\n')}\n\n` +
    `## Requisitos Não-Funcionais\n${spec.nonFunctionalRequirements.map((r) => `- ${r}`).join('\n')}\n\n` +
    `## Contratos/Interfaces\n${spec.contracts.map((c) => `- ${c}`).join('\n')}\n\n` +
    `## Plano de Implementação\n${spec.implementationPlan.map((p, i) => `${i + 1}. ${p}`).join('\n')}\n\n` +
    `## Critérios de Aceite\n${spec.acceptanceCriteria.map((c) => `- [ ] ${c}`).join('\n')}\n\n` +
    `## Arquivos Afetados\n${spec.affectedFiles.map((f) => `- ${f}`).join('\n')}\n`;
  writeMd(file, md);
  return file;
}

function saveTask(spec: Spec, iter: number) {
  const file = join(SPECS_DIR, 'task.md');
  const md =
    `# Task: ${spec.title}\n\n` +
    `**Iteração:** ${iter}\n` +
    `**Iniciado:** ${new Date().toISOString()}\n\n` +
    `## Checklist de Implementação\n${spec.implementationPlan.map((p) => `- [ ] ${p}`).join('\n')}\n\n` +
    `## Notas do Engenheiro\n<!-- Preencher durante implementação -->\n`;
  writeMd(file, md);
  return file;
}

function saveReview(report: string) {
  const file = join(SPECS_DIR, 'review.md');
  writeMd(file, report);
  return file;
}

// Arquiteto: carrega spec base (da v1) e apenas atualiza timestamp/iteração
// NÃO acumula review no context — o review vai no review.md
function architectPhase(requirement: string, iter: number): Spec {
  console.log('\n🏗️  ARQUITETO — Atualizando SPEC');
  const baseSpec = loadSpec();
  saveSpec(baseSpec, iter);
  saveTask(baseSpec, iter);
  return baseSpec;
}

function engineerPhase() {
  console.log('\n⚙️  ENGENHEIRO — Implementando (rodando checks locais)');
  runCmd('npm', ['run', 'lint']);
  runCmd('npm', ['run', 'build']);
  runCmd('npm', ['run', 'test:coverage']);
  console.log('✅ Checks locais passaram');
}

function reviewerPhase(iter: number): { passed: boolean; report: string } {
  console.log('\n🔍  REVISOR — Validando');
  const spec = loadSpec();

  const checks = [
    { fn: () => runCmd('npm', ['run', 'lint']), key: 'lint', name: 'Lint' },
    { fn: () => runCmd('npm', ['run', 'build']), key: 'build', name: 'Build' },
    { fn: () => runCmd('npm', ['run', 'test']), key: 'test', name: 'Testes' },
    { fn: () => runCmd('npm', ['run', 'test:coverage']), key: 'coverage', name: 'Coverage ≥ 80%' },
  ];

  const results = checks.map((c) => {
    try {
      c.fn();
      return { key: c.key, name: c.name, pass: true };
    } catch {
      return { err: String(e), key: c.key, name: c.name, pass: false };
    }
  });

  const missing = spec.affectedFiles.filter((f: string) => !existsSync(join(ROOT, f)));
  if (missing.length)
    results.push({ err: missing.join(', '), key: 'files', name: 'Arquivos de teste', pass: false });
  else results.push({ key: 'files', name: 'Arquivos de teste', pass: true });

  const allPass = results.every((r) => r.pass);

  // Mapeia cada critério de aceite para o check correspondente
  const criteriaMap: Record<string, number> = {
    'npm run build passa': results.findIndex((r) => r.key === 'build'),
    'npm run lint passa': results.findIndex((r) => r.key === 'lint'),
    'npm test:coverage ≥ 80% em todos thresholds': results.findIndex((r) => r.key === 'coverage'),
    'npm test passa (0 falhas)': results.findIndex((r) => r.key === 'test'),
    'Testes isolados, sem vazamento de mocks': results.findIndex((r) => r.key === 'test'),
    'Todos src/**/*.ts têm *.test.ts correspondente': results.findIndex((r) => r.key === 'files'),
  };

  const report =
    `# Review Report\n\n**Iteração:** ${iter}\n**Status:** ${allPass ? 'PASS' : 'FAIL'}\n\n` +
    `## Critérios de Aceite\n` +
    spec.acceptanceCriteria
      .map((c: string) => {
        const idx = criteriaMap[c] ?? -1;
        const mark = idx >= 0 && results[idx]?.pass ? '[x]' : '[ ]';
        return `- ${mark} ${c}`;
      })
      .join('\n') +
    '\n\n' +
    `## Qualidade\n` +
    results
      .map((r) => `- ${r.name}: ${r.pass ? 'PASS' : 'FAIL'}${r.err ? ` — ${r.err}` : ''}`)
      .join('\n');

  saveReview(report);
  return { passed: allPass, report };
}

async function main() {
  const req = process.argv.slice(2).join(' ') || 'Testes unitários para todos arquivos';
  ensureSpecsDir();

  for (let iter = 1; iter <= 3; iter++) {
    console.log(`\n${'='.repeat(50)}`);
    console.log(`ITERAÇÃO ${iter}/3`);
    console.log('='.repeat(50));

    architectPhase(req, iter);

    try {
      engineerPhase();
    } catch {
      console.log('⚠️  Engenheiro: falha em checks — Revisor avaliará mesmo assim');
    }

    const { passed } = reviewerPhase(iter);

    if (passed) {
      console.log('\n🎉 PASS — Todos critérios atendidos');
      process.exit(0);
    }
    if (iter === 3) {
      console.log(
        '\n⛔ LIMITE (3 iterações) — Usuário decide: aceitar, ajustar requisito, ou abortar',
      );
      process.exit(1);
    }
    console.log(`\n⏳ Iteração ${iter} falhou. Próxima tentará corrigir...`);
  }
}

main().catch((e) => {
  console.error('💥', e);
  process.exit(1);
});

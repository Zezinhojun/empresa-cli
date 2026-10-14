import path from 'node:path';

import type { Risk } from '../core/command/Command.js';

import { runtimeOf } from './interpreters.js';

export interface ManifestArg {
  description: string;
  name: string;
  required: boolean;
}

/** Contrato de um script em `vox-scripts/<nome>/manifest.json` (ver ADR 0002). */
export interface Manifest {
  args: ManifestArg[];
  category?: string;
  description: string;
  /** Arquivo de entrada, relativo à pasta do script. O runtime sai da extensão. */
  entry: string;
  name: string;
  /** Sistemas onde funciona; vazio = todos. */
  os: NodeJS.Platform[];
  /** Executáveis extras que precisam estar no PATH. */
  requires: string[];
  risk: Risk;
  timeoutSec: number;
}

export const DEFAULT_TIMEOUT_SEC = 300;
export const MAX_TIMEOUT_SEC = 3600;

const KNOWN_KEYS = new Set([
  'args',
  'category',
  'description',
  'entry',
  'name',
  'os',
  'requires',
  'risk',
  'timeoutSec',
]);
const RISKS: Risk[] = ['read', 'write', 'destructive'];
const SYSTEMS: NodeJS.Platform[] = ['darwin', 'linux', 'win32'];
const KEBAB = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;
const EXECUTABLE = /^[\w.-]+$/;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** Erro de validação com a lista COMPLETA de problemas encontrados. */
export class ManifestError extends Error {
  constructor(
    public readonly problems: string[],
    public readonly source: string,
  ) {
    super(`Manifesto inválido (${source}):\n${problems.map((p) => `  - ${p}`).join('\n')}`);
    this.name = 'ManifestError';
  }
}

function validateArgs(raw: unknown, problems: string[]): ManifestArg[] {
  if (raw === undefined) return [];
  if (!Array.isArray(raw)) {
    problems.push('"args" deve ser uma lista');
    return [];
  }

  const seen = new Set<string>();
  const args: ManifestArg[] = [];
  for (const [index, item] of raw.entries()) {
    const where = `args[${index}]`;
    if (!isRecord(item)) {
      problems.push(`${where} deve ser um objeto`);
      continue;
    }
    for (const key of Object.keys(item)) {
      if (!['description', 'name', 'required'].includes(key)) {
        problems.push(`${where}: campo desconhecido "${key}"`);
      }
    }
    const { description, name, required } = item;
    if (typeof name !== 'string' || !KEBAB.test(name)) {
      problems.push(`${where}.name deve ser texto em kebab-case (ex.: "pasta-destino")`);
    } else if (seen.has(name)) {
      problems.push(`${where}.name "${name}" repetido`);
    } else seen.add(name);
    if (typeof description !== 'string' || description.trim() === '') {
      problems.push(`${where}.description é obrigatório`);
    }
    if (required !== undefined && typeof required !== 'boolean') {
      problems.push(`${where}.required deve ser true ou false`);
    }
    args.push({
      description: typeof description === 'string' ? description : '',
      name: typeof name === 'string' ? name : '',
      required: required === true,
    });
  }

  // Argumentos opcionais não podem vir antes de obrigatórios (a CLI valida só a quantidade).
  const firstOptional = args.findIndex((a) => !a.required);
  if (firstOptional !== -1 && args.slice(firstOptional).some((a) => a.required)) {
    problems.push('args: os obrigatórios devem vir antes dos opcionais');
  }
  return args;
}

function validateList(
  raw: unknown,
  field: string,
  valid: (item: string) => boolean,
  rule: string,
  problems: string[],
): string[] {
  if (raw === undefined) return [];
  if (!Array.isArray(raw) || !raw.every((item) => typeof item === 'string' && valid(item))) {
    problems.push(`"${field}" ${rule}`);
    return [];
  }
  return raw as string[];
}

/** Valida e normaliza o conteúdo de um `manifest.json`. Lança `ManifestError` com todos os problemas. */
export function parseManifest(raw: unknown, source: string): Manifest {
  if (!isRecord(raw)) throw new ManifestError(['o manifesto deve ser um objeto JSON'], source);

  const problems: string[] = [];

  for (const key of Object.keys(raw)) {
    if (!KNOWN_KEYS.has(key)) problems.push(`campo desconhecido "${key}" (erro de digitação?)`);
  }

  const { category, description, entry, name, risk, timeoutSec } = raw;

  if (typeof name !== 'string' || !KEBAB.test(name) || name.length > 40) {
    problems.push('"name" é obrigatório: kebab-case, até 40 caracteres (ex.: "setup-wordpress")');
  }
  if (typeof description !== 'string' || description.trim() === '') {
    problems.push('"description" é obrigatório (em linguagem simples)');
  } else if (description.length > 200) {
    problems.push('"description" deve ter até 200 caracteres');
  }

  if (typeof entry !== 'string' || entry === '') {
    problems.push('"entry" é obrigatório (arquivo do script, ex.: "setup.sh")');
  } else if (path.isAbsolute(entry) || /(^|[\\/])\.\.([\\/]|$)/.test(entry)) {
    problems.push('"entry" deve ser relativo à pasta do script, sem ".."');
  } else if (!runtimeOf(entry)) {
    problems.push('"entry" deve ter extensão .js, .mjs, .cjs, .sh ou .py');
  }

  if (typeof risk !== 'string' || !RISKS.includes(risk as Risk)) {
    problems.push('"risk" é obrigatório: "read", "write" ou "destructive"');
  }

  if (
    timeoutSec !== undefined &&
    (!Number.isInteger(timeoutSec) ||
      (timeoutSec as number) < 1 ||
      (timeoutSec as number) > MAX_TIMEOUT_SEC)
  ) {
    problems.push(`"timeoutSec" deve ser um inteiro de 1 a ${MAX_TIMEOUT_SEC}`);
  }
  if (category !== undefined && (typeof category !== 'string' || category.trim() === '')) {
    problems.push('"category" deve ser um texto não vazio');
  }

  const os = validateList(
    raw.os,
    'os',
    (item) => SYSTEMS.includes(item as NodeJS.Platform),
    'deve listar sistemas entre "darwin", "linux" e "win32"',
    problems,
  );
  const requires = validateList(
    raw.requires,
    'requires',
    (item) => EXECUTABLE.test(item),
    'deve listar nomes de executáveis (ex.: "docker")',
    problems,
  );
  const args = validateArgs(raw.args, problems);

  if (problems.length > 0) throw new ManifestError(problems, source);

  return {
    args,
    ...(typeof category === 'string' && { category }),
    description: description as string,
    entry: entry as string,
    name: name as string,
    os: os as NodeJS.Platform[],
    requires,
    risk: risk as Risk,
    timeoutSec: typeof timeoutSec === 'number' ? timeoutSec : DEFAULT_TIMEOUT_SEC,
  };
}

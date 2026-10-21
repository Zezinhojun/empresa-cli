import { appendFileSync, mkdirSync, renameSync, statSync } from 'node:fs';
import { homedir, userInfo } from 'node:os';
import path from 'node:path';

export type AuditOutcome =
  | 'blocked' // integridade ou sistema: nada foi executado
  | 'cancelled' // a pessoa respondeu "não"
  | 'denied' // pedia confirmação e não havia terminal nem --yes
  | 'dry-run'
  | 'error'
  | 'failed' // o script rodou e saiu com código ≠ 0
  | 'ok'
  | 'timeout';

export interface AuditEntry {
  args: string[];
  durationMs: number;
  /** Efeitos declarados e pasta alvo resolvida (só em scripts que declaram `effects`). */
  effects?: string[];
  errorCode?: string;
  exitCode: number | null;
  /** Estava num terminal (pessoa) ou sem (agente/CI)? */
  interactive: boolean;
  outcome: AuditOutcome;
  platform: string;
  risk: string;
  runtime?: string;
  script: string;
  target?: string;
  time: string;
  user: string;
  version: string;
  yes: boolean;
}

const MAX_BYTES = 1_000_000;
const MAX_ARG_LENGTH = 200;
const MASK = '***';

/** Nomes de opção/variável que costumam carregar segredos. */
const SENSITIVE_NAME =
  /(token|secret|pass(word|wd)?|pwd|api[-_]?key|auth|credential|cookie|bearer|private[-_]?key)/i;
/** Prefixos de credenciais conhecidas (GitHub, GitLab, npm, OpenAI/Stripe, Slack, AWS, Google, JWT). */
const SECRET_VALUE =
  /^(gh[pousr]_|github_pat_|glpat-|npm_|sk-|sk_live_|sk_test_|rk_live_|xox[abprs]-|AKIA[0-9A-Z]{16}|AIza[\w-]{20,}|eyJ[\w-]{10,}\.)/;
/** Usuário opcional; a senha vai até o ÚLTIMO @ antes da primeira barra (a senha pode conter @). */
const URL_PASSWORD = /(\/\/[^/\s:@]*:)[^/\s]+@/;
/** Cabeçalhos HTTP com credencial (`-H "Authorization: Bearer x"`, `--header=X-Api-Key: x`). */
const HEADER_SECRET =
  /\b(authorization|proxy-authorization|cookie|set-cookie|x-[\w-]*(?:key|token|secret|auth)[\w-]*)\s*:\s*\S.*$/i;
/** `Bearer abc` / `Basic abc` soltos. */
const SCHEME_SECRET = /^(bearer|basic)\s+\S+$/i;
/** Segredo em query string: `?token=abc&x=1`. */
const QUERY_SECRET =
  /([?&][\w.-]*(?:token|secret|pass(?:word|wd)?|pwd|api[-_]?key|auth|credential|signature|sig|key)[\w.-]*=)[^&\s#]*/gi;

/**
 * Esconde segredos óbvios nos argumentos antes de gravar o log. É "melhor esforço": a regra de ouro
 * é não passar segredo por argumento (use variável de ambiente ou arquivo).
 */
export function maskArgs(args: string[]): string[] {
  let maskNext = false;

  return args.map((raw) => {
    const arg = raw.length > MAX_ARG_LENGTH ? `${raw.slice(0, MAX_ARG_LENGTH)}…` : raw;

    if (maskNext) {
      maskNext = false;
      return MASK;
    }
    if (SECRET_VALUE.test(arg) || SCHEME_SECRET.test(arg)) return MASK;

    // --token=valor | NOME=valor
    const assignment = /^(-{0,2}[\w.-]+)=(.*)$/s.exec(arg);
    if (assignment && SENSITIVE_NAME.test(assignment[1] ?? '')) return `${assignment[1]}=${MASK}`;

    // --token valor  (o valor é o próximo argumento)
    if (/^-{1,2}[\w.-]+$/.test(arg) && SENSITIVE_NAME.test(arg)) maskNext = true;

    return arg
      .replace(HEADER_SECRET, `$1: ${MASK}`)
      .replace(URL_PASSWORD, `$1${MASK}@`)
      .replace(QUERY_SECRET, `$1${MASK}`);
  });
}

/**
 * Onde gravar. `VOX_AUDIT_LOG=<arquivo>` troca o local; `off` desliga (só para CI/testes).
 * Padrão: `~/.vox/audit.log`.
 */
export function auditLogPath(env: NodeJS.ProcessEnv = process.env): string | undefined {
  const custom = env.VOX_AUDIT_LOG;
  if (custom === 'off') return undefined;
  return custom || path.join(homedir(), '.vox', 'audit.log');
}

function currentUser(): string {
  try {
    return userInfo().username;
  } catch {
    return 'desconhecido';
  }
}

export function newEntry(partial: Omit<AuditEntry, 'platform' | 'time' | 'user'>): AuditEntry {
  return {
    ...partial,
    args: maskArgs(partial.args),
    platform: process.platform,
    time: new Date().toISOString(),
    user: currentUser(),
  };
}

/**
 * Acrescenta uma linha JSON ao log. NUNCA derruba o comando: se não der para gravar
 * (disco cheio, sem permissão), segue em silêncio.
 */
export function writeAudit(entry: AuditEntry, file: string | undefined = auditLogPath()): void {
  if (!file) return;
  try {
    mkdirSync(path.dirname(file), { mode: 0o700, recursive: true });
    try {
      if (statSync(file).size > MAX_BYTES) renameSync(file, `${file}.1`); // guarda só 1 geração
    } catch {
      // ainda não existe: tudo bem
    }
    appendFileSync(file, `${JSON.stringify(entry)}\n`, { mode: 0o600 });
  } catch {
    // auditoria não pode quebrar o que a pessoa pediu
  }
}

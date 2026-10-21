import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { userInfo } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { auditLogPath, maskArgs, newEntry, writeAudit, type AuditEntry } from './audit.js';

vi.mock('node:os', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown> & { userInfo: typeof userInfo }>();
  return { ...actual, userInfo: vi.fn(actual.userInfo) };
});

describe('maskArgs: esconde segredos óbvios', () => {
  it('valor do argumento seguinte a uma opção sensível', () => {
    expect(maskArgs(['--token', 'abc123', 'ok'])).toEqual(['--token', '***', 'ok']);
    expect(maskArgs(['--password', 'x'])).toEqual(['--password', '***']);
    expect(maskArgs(['-p', 'x'])).toEqual(['-p', 'x']); // "-p" sozinho não diz nada: não adivinha
  });

  it.each([
    ['--token=abc', '--token=***'],
    ['--api-key=abc', '--api-key=***'],
    ['--client_secret=abc', '--client_secret=***'],
    ['--db-password=abc', '--db-password=***'],
    ['GITHUB_TOKEN=abc', 'GITHUB_TOKEN=***'],
    ['AWS_SECRET_ACCESS_KEY=abc', 'AWS_SECRET_ACCESS_KEY=***'],
    ['--authorization=Bearer x', '--authorization=***'],
  ])('atribuição %s', (entrada, saida) => {
    expect(maskArgs([entrada])).toEqual([saida]);
  });

  // Credenciais FALSAS montadas em tempo de execução (prefixo + resto): o texto completo nunca
  // aparece no código-fonte, senão o secret scanning do GitHub o trata como vazamento de verdade.
  it.each([
    ['gh', 'p_abcdefghijklmnopqrstuvwxyz0123456789'],
    ['github_', 'pat_11ABCDEFG0123456789_abcdefghijklmnop'],
    ['gl', 'pat-abcdefghij0123456789'],
    ['s', 'k-abcdefghijklmnopqrstuvwxyz'],
    ['xo', 'xb-123456789012-abcdefghijklmnop'],
    ['AK', 'IAIOSFODNN7EXAMPLE'],
    ['ey', 'JhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.abc'],
  ])('credencial pelo formato: %s…', (inicio, resto) => {
    expect(maskArgs([inicio + resto])).toEqual(['***']);
  });

  // Formatos que vazavam: o segredo está no meio do argumento, não no nome da opção.
  it.each([
    ['Authorization: Bearer abc123segredo', 'Authorization: ***'],
    ['--header=Authorization: Bearer abc123segredo', '--header=Authorization: ***'],
    ['X-Api-Key: abc123segredo', 'X-Api-Key: ***'],
    ['Cookie: sessao=abc123segredo; outro=1', 'Cookie: ***'],
    ['Bearer abc123segredo', '***'],
    ['https://h.com/a?token=abc123segredo', 'https://h.com/a?token=***'],
    [
      'https://h.com/a?x=1&access_token=abc123segredo&y=2',
      'https://h.com/a?x=1&access_token=***&y=2',
    ],
    ['https://h.com/a?X-Amz-Signature=abc123segredo', 'https://h.com/a?X-Amz-Signature=***'],
    ['https://:abc123segredo@h.com/x', 'https://:***@h.com/x'],
    ['https://u:p@ss@h.com/x', 'https://u:***@h.com/x'],
    ['postgres://u:abc123segredo@db:5432/x', 'postgres://u:***@db:5432/x'],
  ])('segredo no meio do argumento: %s', (entrada, saida) => {
    const [mascarado] = maskArgs([entrada]);

    expect(mascarado).toBe(saida);
    expect(mascarado).not.toContain('abc123segredo');
  });

  it.each([
    ['npm_', 'abcdefghijklmnopqrstuvwxyz0123456789'],
    ['sk_test', '_abcdefghijklmnop'],
    ['AIza', 'SyAbcdefghijklmnopqrstuvwxyz012345'],
  ])('credencial pelo formato (npm, Stripe teste, Google): %s…', (inicio, resto) => {
    expect(maskArgs([inicio + resto])).toEqual(['***']);
  });

  it('não confunde URL comum com segredo (porta, query inofensiva)', () => {
    const comuns = [
      'https://host:8080/caminho',
      'https://h.com/a?pagina=2&ordem=nome',
      'http://localhost:3000',
    ];

    expect(maskArgs(comuns)).toEqual(comuns);
  });

  it('senha dentro de uma URL', () => {
    expect(maskArgs(['https://usuario:senha-secreta@host.com/repo.git'])).toEqual([
      'https://usuario:***@host.com/repo.git',
    ]);
  });

  it('não mexe em argumentos comuns', () => {
    const comuns = [
      'pasta/arquivo.txt',
      '--verbose',
      '--nome=Maria',
      'https://exemplo.com/a?b=c',
      'PATH=/bin',
    ];
    expect(maskArgs(comuns)).toEqual(comuns);
  });

  it('a máscara de "valor seguinte" vale só para UM argumento', () => {
    expect(maskArgs(['--token', 'a', 'b'])).toEqual(['--token', '***', 'b']);
  });

  it('trunca argumentos gigantes (o log não vira depósito de dados)', () => {
    const [arg] = maskArgs(['x'.repeat(5000)]);

    expect(arg?.length).toBeLessThan(250);
    expect(arg?.endsWith('…')).toBe(true);
  });
});

describe('auditLogPath', () => {
  it('padrão: ~/.mycli/audit.log', () => {
    expect(auditLogPath({})).toMatch(/\.mycli[\\/]audit\.log$/);
  });

  it('MYCLI_AUDIT_LOG troca o local; "off" desliga', () => {
    expect(auditLogPath({ MYCLI_AUDIT_LOG: '/tmp/meu.log' })).toBe('/tmp/meu.log');
    expect(auditLogPath({ MYCLI_AUDIT_LOG: 'off' })).toBeUndefined();
  });
});

describe('writeAudit', () => {
  let dir: string;
  const entry = (script = 'x'): AuditEntry =>
    newEntry({
      args: ['--token', 'segredo'],
      durationMs: 5,
      exitCode: 0,
      interactive: false,
      outcome: 'ok',
      risk: 'read',
      script,
      version: '1.0.0',
      yes: false,
    });

  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), 'mycli-audit-'));
  });
  afterEach(() => rmSync(dir, { force: true, recursive: true }));

  it('newEntry acrescenta usuário, sistema e horário e mascara os argumentos', () => {
    const e = entry();

    expect(e.args).toEqual(['--token', '***']);
    expect(e.platform).toBe(process.platform);
    expect(e.user.length).toBeGreaterThan(0);
    expect(new Date(e.time).toISOString()).toBe(e.time);
  });

  it('sem conseguir descobrir o usuário (container sem passwd): registra "desconhecido" e segue', () => {
    vi.mocked(userInfo).mockImplementationOnce(() => {
      throw new Error('ENOENT: sem entrada em /etc/passwd');
    });

    expect(entry().user).toBe('desconhecido');
  });

  it('cria a pasta e grava uma linha JSON por entrada', () => {
    const file = path.join(dir, 'sub', 'audit.log');

    writeAudit(entry('um'), file);
    writeAudit(entry('dois'), file);

    const lines = readFileSync(file, 'utf8').trim().split('\n');
    expect(lines.map((l) => (JSON.parse(l) as AuditEntry).script)).toEqual(['um', 'dois']);
  });

  it('rotaciona quando passa de ~1 MB (guarda 1 geração)', () => {
    const file = path.join(dir, 'audit.log');
    writeFileSync(file, 'x'.repeat(1_100_000));

    writeAudit(entry('novo'), file);

    expect(readFileSync(`${file}.1`, 'utf8').length).toBe(1_100_000);
    expect(readFileSync(file, 'utf8').trim().split('\n')).toHaveLength(1);
  });

  it('desligado (undefined): não grava nada', () => {
    writeAudit(entry(), undefined);

    expect(existsSync(path.join(dir, 'audit.log'))).toBe(false);
  });

  it('local impossível de gravar: não lança erro', () => {
    const arquivo = path.join(dir, 'arquivo');
    writeFileSync(arquivo, 'x');

    expect(() => writeAudit(entry(), path.join(arquivo, 'audit.log'))).not.toThrow();
  });

  it('pasta existente continua funcionando', () => {
    mkdirSync(path.join(dir, 'ja-existe'));

    writeAudit(entry(), path.join(dir, 'ja-existe', 'audit.log'));

    expect(existsSync(path.join(dir, 'ja-existe', 'audit.log'))).toBe(true);
  });
});

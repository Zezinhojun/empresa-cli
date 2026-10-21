import { execa } from 'execa';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import type { Runtime } from '../cli/runtime.js';

import pkg from '../../package.json' with { type: 'json' };
import { resetRuntime, setRuntime } from '../cli/runtime.js';
import { REPORT_MARKER, ReportCommand } from './ReportCommand.js';
import { StatsCommand } from './StatsCommand.js';

const person: Runtime = {
  dryRun: false,
  interactive: true,
  json: false,
  plain: true,
  verbose: false,
  yes: true,
};
const line = (extra: Record<string, unknown>) =>
  JSON.stringify({
    args: ['--token=abc123'],
    outcome: 'failed',
    platform: 'win32',
    script: 'limpar',
    user: 'maria',
    version: '1.0.0',
    ...extra,
  });

let dir: string;
let file: string;
let previous: string | undefined;

beforeAll(() => {
  dir = mkdtempSync(path.join(tmpdir(), 'vox-report-'));
  file = path.join(dir, 'audit.log');
  writeFileSync(file, `${line({ errorCode: 'SCRIPT_FAILED' })}\n${line({ outcome: 'ok' })}\n`);
  previous = process.env.VOX_AUDIT_LOG;
  process.env.VOX_AUDIT_LOG = file;
});
afterEach(() => {
  resetRuntime();
  vi.mocked(execa).mockClear();
});
afterAll(() => {
  if (previous === undefined) delete process.env.VOX_AUDIT_LOG;
  else process.env.VOX_AUDIT_LOG = previous;
  rmSync(dir, { force: true, recursive: true });
});

describe('ReportCommand', () => {
  it('monta uma issue pré-preenchida no repositório, sem args nem usuário', async () => {
    setRuntime({ ...person, interactive: false });
    const data = await new ReportCommand().execute();

    expect(data.url.startsWith(`${pkg.bugs.url}/new?`)).toBe(true);
    expect(data.body).toContain(REPORT_MARKER);
    expect(data.body).toContain('SCRIPT_FAILED');
    expect(`${data.body}${data.url}`).not.toMatch(/abc123|maria/);
  });

  it('sem terminal (agente) nunca abre o navegador', async () => {
    setRuntime({ ...person, interactive: false });
    const data = await new ReportCommand().execute();

    expect(data.opened).toBe(false);
    expect(execa).not.toHaveBeenCalled();
  });

  it('com terminal, abre o link sem shell (URL inteira como um argumento)', async () => {
    setRuntime(person);
    vi.mocked(execa).mockResolvedValueOnce({} as never);
    const data = await new ReportCommand().execute();

    expect(data.opened).toBe(true);
    expect(vi.mocked(execa).mock.calls[0]?.[1]).toContain(data.url);
  });

  it('se o navegador não abre, devolve o link para a pessoa abrir', async () => {
    setRuntime(person);
    vi.mocked(execa).mockRejectedValueOnce(new Error('sem navegador'));
    const command = new ReportCommand();
    const data = await command.execute();

    expect(data.opened).toBe(false);
    expect(command.format(data)).toContain(data.url);
  });
});

describe('StatsCommand', () => {
  it('mostra scripts e erros do log', () => {
    const command = new StatsCommand();
    const text = command.format(command.execute());

    expect(text).toContain('limpar');
    expect(text).toContain('SCRIPT_FAILED');
  });
});

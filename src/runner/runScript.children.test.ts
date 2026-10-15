import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { runScript } from './runScript.js';

// Executa de verdade (sem o mock global do execa).
vi.unmock('execa');

let dir: string;
beforeAll(() => {
  dir = mkdtempSync(path.join(tmpdir(), 'vox-children-'));
});
afterAll(() => rmSync(dir, { force: true, recursive: true }));

const alive = (pid: number) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const waitFor = async (check: () => boolean, ms = 5000) => {
  const end = Date.now() + ms;
  while (Date.now() < end && !check()) await sleep(50);
  return check();
};

describe('runScript: timeout não deixa processo órfão', () => {
  it('o processo FILHO do script também é encerrado quando estoura o tempo', async () => {
    const pidFile = path.join(dir, 'filho.pid');
    const entry = path.join(dir, 'pai.mjs');
    writeFileSync(
      entry,
      `import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
const filho = spawn(process.execPath, ['-e', 'setTimeout(() => {}, 60000)'], { stdio: 'ignore' });
writeFileSync(${JSON.stringify(pidFile)}, String(filho.pid));
setTimeout(() => {}, 60000);
`,
    );

    await expect(
      runScript({
        args: [],
        capture: true,
        dryRun: false,
        entry,
        env: { PATH: process.env.PATH ?? '', SystemRoot: process.env.SystemRoot ?? '' },
        interactive: false,
        name: 'orfao',
        timeoutSec: 2,
      }),
    ).rejects.toMatchObject({ code: 'SCRIPT_TIMEOUT' });

    const pid = Number(readFileSync(pidFile, 'utf8'));
    const morreu = await waitFor(() => !alive(pid));
    if (!morreu) process.kill(pid, 'SIGKILL'); // não deixa lixo na máquina de quem roda o teste

    expect(morreu, `o filho (pid ${pid}) continuou vivo depois do timeout`).toBe(true);
  }, 20_000);
});

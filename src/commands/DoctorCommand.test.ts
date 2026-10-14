import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Runtime as CliRuntime } from '../cli/runtime.js';
import type { Interpreter } from '../runner/interpreters.js';

import { CommandRegistry } from '../core/command/CommandRegistry.js';
import { findInterpreter } from '../runner/interpreters.js';
import { DoctorCommand, type DoctorData } from './DoctorCommand.js';

vi.mock('../runner/interpreters.js', () => ({ findInterpreter: vi.fn() }));

const found = (runtime: Interpreter['runtime'], version: string): Interpreter => ({
  args: [],
  command: `/usr/bin/${runtime}`,
  runtime,
  version,
});
const cli = (plain: boolean): CliRuntime => ({
  dryRun: false,
  interactive: false,
  json: false,
  plain,
  verbose: false,
  yes: false,
});

/** Simula o que está instalado: { node, bash, python } (undefined = ausente). */
const machine = (table: Partial<Record<Interpreter['runtime'], Interpreter>>) =>
  vi.mocked(findInterpreter).mockImplementation((runtime) => Promise.resolve(table[runtime]));

describe('DoctorCommand', () => {
  let cmd: DoctorCommand;

  beforeEach(() => {
    (CommandRegistry as unknown as { instance?: CommandRegistry | undefined }).instance = undefined;
    CommandRegistry.getInstance();
    cmd = new DoctorCommand();
  });

  afterEach(() => vi.clearAllMocks());

  it('tem nome e descrição em linguagem simples', () => {
    expect(cmd.name).toBe('doctor');
    expect(cmd.description).toContain('Node, Bash, Python');
  });

  it('tudo instalado: ok, com versão e caminho de cada um', async () => {
    machine({
      bash: found('bash', 'GNU bash, version 5.2'),
      node: found('node', 'v22.1.0'),
      python: found('python', 'Python 3.12.6'),
    });

    const data = await cmd.execute();

    expect(data.ok).toBe(true);
    expect(data.checks.map((c) => [c.runtime, c.ok, c.version])).toEqual([
      ['node', true, 'v22.1.0'],
      ['bash', true, 'GNU bash, version 5.2'],
      ['python', true, 'Python 3.12.6'],
    ]);
    expect(data.checks[0]).toMatchObject({ path: '/usr/bin/node', usedFor: expect.any(String) });
    expect(data.checks.every((c) => c.install === undefined)).toBe(true);
  });

  it('Python ausente: ok=false e traz como instalar (sem tocar nos outros)', async () => {
    machine({ bash: found('bash', 'GNU bash'), node: found('node', 'v22.1.0') });

    const data = await cmd.execute();
    const python = data.checks.find((c) => c.runtime === 'python');

    expect(data.ok).toBe(false);
    expect(python).toMatchObject({
      install: expect.stringMatching(/instal/i),
      label: 'Python 3',
      ok: false,
    });
    expect(python?.version).toBeUndefined();
    expect(data.checks.filter((c) => !c.ok)).toHaveLength(1);
  });

  it.each([
    ['v18.20.0', false],
    ['v20.0.0', true],
    ['v24.18.0', true],
    ['v25.0.0', false],
  ])('Node %s: suportado=%s (faixa do engines)', async (version, ok) => {
    machine({
      bash: found('bash', 'GNU bash'),
      node: found('node', version),
      python: found('python', 'Python 3.12.6'),
    });

    const node = (await cmd.execute()).checks[0];

    expect(node?.ok).toBe(ok);
    if (!ok) expect(node?.install).toContain('>=20 <25');
  });

  describe('format', () => {
    const base: DoctorData = {
      checks: [
        {
          label: 'Node.js',
          ok: true,
          runtime: 'node',
          usedFor: 'a própria vox',
          version: 'v22.1.0',
        },
        {
          install: 'Instale o Python 3 em https://www.python.org/downloads/.',
          label: 'Python 3',
          ok: false,
          runtime: 'python',
          usedFor: 'scripts .py',
        },
      ],
      ok: false,
      platform: 'win32',
    };

    it('plain: [ok]/[FALTA], versão, como resolver e resumo no singular', () => {
      const out = cmd.format(base, cli(true));

      expect(out).toContain('[ok]');
      expect(out).toContain('[FALTA]');
      expect(out).toContain('v22.1.0');
      expect(out).toContain('Como resolver: Instale o Python 3');
      expect(out).toContain('Falta 1 item.');
      expect(out).toContain('só funcionam depois da instalação');
    });

    it('diferencia "não encontrado" de "versão não suportada"', () => {
      const velho = {
        ...base,
        checks: [
          { ...base.checks[0], install: 'Use o Node 20.', ok: false, version: 'v18.0.0' },
          base.checks[1],
        ],
      } as DoctorData;

      const out = cmd.format(velho, cli(true));

      expect(out).toContain('versão v18.0.0 não é suportada');
      expect(out).toContain('não encontrado');
    });

    it('com decoração: ✔ e ✖', () => {
      const out = cmd.format(base, cli(false));

      expect(out).toContain('✔');
      expect(out).toContain('✖');
    });

    it('resumo no plural', () => {
      const dois = {
        ...base,
        checks: [base.checks[1], { ...base.checks[1], runtime: 'bash' }],
      } as DoctorData;

      expect(cmd.format(dois, cli(true))).toContain('Faltam 2 itens.');
    });

    it('tudo certo', () => {
      const tudo = { ...base, checks: [base.checks[0]], ok: true } as DoctorData;

      expect(cmd.format(tudo, cli(true))).toContain('Tudo certo');
    });
  });
});

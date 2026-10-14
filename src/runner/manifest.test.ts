import { describe, expect, it } from 'vitest';

import type { ManifestError } from './manifest.js';

import { DEFAULT_TIMEOUT_SEC, parseManifest } from './manifest.js';

const valid = {
  description: 'Prepara um ambiente local',
  entry: 'setup.js',
  name: 'setup-local',
  risk: 'read',
};

const problemsOf = (raw: unknown): string[] => {
  try {
    parseManifest(raw, 'teste');
  } catch (error) {
    return (error as ManifestError).problems;
  }
  return [];
};

describe('parseManifest', () => {
  it('mínimo válido: aplica os padrões', () => {
    expect(parseManifest(valid, 'x')).toEqual({
      args: [],
      description: 'Prepara um ambiente local',
      entry: 'setup.js',
      name: 'setup-local',
      os: [],
      requires: [],
      risk: 'read',
      timeoutSec: DEFAULT_TIMEOUT_SEC,
    });
  });

  it('completo: normaliza args, os, requires, timeout e category', () => {
    const manifest = parseManifest(
      {
        ...valid,
        args: [
          { description: 'Onde criar', name: 'pasta', required: true },
          { description: 'Nome do site', name: 'nome-do-site' },
        ],
        category: 'setup',
        entry: 'sub/setup.sh',
        os: ['linux', 'darwin'],
        requires: ['docker', 'git'],
        risk: 'write',
        timeoutSec: 600,
      },
      'x',
    );

    expect(manifest).toMatchObject({
      args: [
        { name: 'pasta', required: true },
        { name: 'nome-do-site', required: false },
      ],
      category: 'setup',
      os: ['linux', 'darwin'],
      requires: ['docker', 'git'],
      risk: 'write',
      timeoutSec: 600,
    });
  });

  it.each(['.js', '.mjs', '.cjs', '.sh', '.py'])('aceita a extensão %s', (ext) => {
    expect(problemsOf({ ...valid, entry: `a${ext}` })).toEqual([]);
  });

  it.each([
    ['name ausente', { ...valid, name: undefined }, '"name"'],
    ['name em maiúsculas', { ...valid, name: 'Setup' }, '"name"'],
    ['name com underline', { ...valid, name: 'setup_local' }, '"name"'],
    ['name longo demais', { ...valid, name: 'a'.repeat(41) }, '"name"'],
    ['description vazia', { ...valid, description: '  ' }, '"description"'],
    ['description enorme', { ...valid, description: 'x'.repeat(201) }, '200 caracteres'],
    ['entry ausente', { ...valid, entry: undefined }, '"entry"'],
    ['entry com ..', { ...valid, entry: '../fora.js' }, 'sem ".."'],
    ['entry com .. no meio', { ...valid, entry: 'a/../../b.js' }, 'sem ".."'],
    ['entry absoluta', { ...valid, entry: '/etc/passwd.sh' }, 'relativo'],
    ['entry de tipo desconhecido', { ...valid, entry: 'a.rb' }, 'extensão'],
    ['risk ausente', { ...valid, risk: undefined }, '"risk"'],
    ['risk inválido', { ...valid, risk: 'perigoso' }, '"risk"'],
    ['timeout zero', { ...valid, timeoutSec: 0 }, '"timeoutSec"'],
    ['timeout acima do máximo', { ...valid, timeoutSec: 3601 }, '"timeoutSec"'],
    ['timeout fracionado', { ...valid, timeoutSec: 1.5 }, '"timeoutSec"'],
    ['category vazia', { ...valid, category: '' }, '"category"'],
    ['os inválido', { ...valid, os: ['freebsd'] }, '"os"'],
    ['os que não é lista', { ...valid, os: 'linux' }, '"os"'],
    ['requires com caminho', { ...valid, requires: ['/usr/bin/docker'] }, '"requires"'],
    ['campo desconhecido (typo)', { ...valid, riks: 'read' }, 'campo desconhecido "riks"'],
    ['args que não é lista', { ...valid, args: 'x' }, '"args"'],
    ['arg que não é objeto', { ...valid, args: ['x'] }, 'args[0] deve ser um objeto'],
    ['arg sem description', { ...valid, args: [{ name: 'a' }] }, 'args[0].description'],
    [
      'arg com name inválido',
      { ...valid, args: [{ description: 'd', name: 'A B' }] },
      'args[0].name',
    ],
    [
      'arg com campo desconhecido',
      { ...valid, args: [{ description: 'd', extra: 1, name: 'a' }] },
      'campo desconhecido "extra"',
    ],
    [
      'arg com required inválido',
      { ...valid, args: [{ description: 'd', name: 'a', required: 'sim' }] },
      'required',
    ],
    [
      'args repetidos',
      {
        ...valid,
        args: [
          { description: 'd', name: 'a' },
          { description: 'd', name: 'a' },
        ],
      },
      'repetido',
    ],
    [
      'opcional antes de obrigatório',
      {
        ...valid,
        args: [
          { description: 'd', name: 'a' },
          { description: 'd', name: 'b', required: true },
        ],
      },
      'obrigatórios devem vir antes',
    ],
  ])('rejeita: %s', (_nome, raw, trecho) => {
    expect(problemsOf(raw).join('\n')).toContain(trecho);
  });

  it.each([[null], ['texto'], [[]], [42]])('rejeita manifesto que não é objeto (%j)', (raw) => {
    expect(problemsOf(raw)).toEqual(['o manifesto deve ser um objeto JSON']);
  });

  it('reúne TODOS os problemas de uma vez e cita a origem', () => {
    let error: ManifestError | undefined;
    try {
      parseManifest({ entry: 'a.rb', riks: 1, risk: 'x' }, 'vox-scripts/ruim/manifest.json');
    } catch (e) {
      error = e as ManifestError;
    }

    expect(error?.problems.length).toBeGreaterThanOrEqual(5);
    expect(error?.source).toBe('vox-scripts/ruim/manifest.json');
    expect(error?.message).toContain('vox-scripts/ruim/manifest.json');
    expect(error?.message).toContain('- campo desconhecido "riks"');
    expect(error?.name).toBe('ManifestError');
  });
});

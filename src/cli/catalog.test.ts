import { describe, expect, it } from 'vitest';

import { describeCommand } from './catalog.js';

describe('describeCommand', () => {
  it('aplica os padrões: risk=read, interactive=false, required=false, descrição vazia', () => {
    expect(
      describeCommand({ args: [{ description: 'd', name: 'a' }], execute: () => {}, name: 'x' }),
    ).toEqual({
      args: [{ description: 'd', name: 'a', required: false }],
      description: '',
      interactive: false,
      kind: 'builtin',
      name: 'x',
      requires: [],
      risk: 'read',
      usage: 'mycli x [a]',
    });
  });

  it('script: expõe origem, requisitos e categoria para o agente decidir o que pode rodar', () => {
    expect(
      describeCommand({
        category: 'setup',
        description: 'Prepara o ambiente',
        execute: () => {},
        kind: 'script',
        name: 'setup-local',
        requires: ['docker', 'git'],
        risk: 'write',
      }),
    ).toMatchObject({
      category: 'setup',
      kind: 'script',
      requires: ['docker', 'git'],
      risk: 'write',
    });
  });

  it('sem categoria o campo nem aparece no JSON', () => {
    expect(describeCommand({ execute: () => {}, name: 'x' })).not.toHaveProperty('category');
  });

  it('comando sem args declarados vira lista vazia', () => {
    expect(describeCommand({ execute: () => {}, name: 'y' }).args).toEqual([]);
  });
});

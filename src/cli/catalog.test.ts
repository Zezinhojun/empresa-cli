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
      name: 'x',
      risk: 'read',
      usage: 'vox x [a]',
    });
  });

  it('comando sem args declarados vira lista vazia', () => {
    expect(describeCommand({ execute: () => {}, name: 'y' }).args).toEqual([]);
  });
});

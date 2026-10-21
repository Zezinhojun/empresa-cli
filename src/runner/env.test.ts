import { describe, expect, it } from 'vitest';

import { buildScriptEnv } from './env.js';

describe('buildScriptEnv', () => {
  const source = {
    AWS_SECRET_ACCESS_KEY: 'segredo',
    GITHUB_TOKEN: 'ghp_x',
    HOME: '/home/u',
    LC_ALL: 'pt_BR.UTF-8',
    NPM_TOKEN: 'npm_x',
    Path: 'C:\\bin',
    SystemRoot: 'C:\\Windows',
    VAZIA: undefined,
  };

  it('herda só o necessário (PATH, HOME, locale, raiz do Windows…)', () => {
    const env = buildScriptEnv(source, {});

    expect(env).toEqual({
      HOME: '/home/u',
      LC_ALL: 'pt_BR.UTF-8',
      Path: 'C:\\bin',
      SystemRoot: 'C:\\Windows',
    });
  });

  it('NÃO vaza tokens e chaves do ambiente do usuário', () => {
    const env = buildScriptEnv(source, {});

    expect(Object.keys(env)).not.toContain('AWS_SECRET_ACCESS_KEY');
    expect(Object.keys(env)).not.toContain('GITHUB_TOKEN');
    expect(Object.keys(env)).not.toContain('NPM_TOKEN');
  });

  it('o case do nome não importa (Path × PATH no Windows) e a chave original é preservada', () => {
    expect(buildScriptEnv({ PATH: '/bin' }, {})).toEqual({ PATH: '/bin' });
    expect(buildScriptEnv({ Path: 'C:\\x' }, {})).toEqual({ Path: 'C:\\x' });
  });

  it('as variáveis MYCLI_* do runner são acrescentadas e vencem as herdadas', () => {
    expect(buildScriptEnv({ HOME: '/h' }, { MYCLI_JSON: '1' })).toEqual({
      HOME: '/h',
      MYCLI_JSON: '1',
    });
    expect(buildScriptEnv({ HOME: '/h' }, { HOME: '/outro' })).toEqual({ HOME: '/outro' });
  });
});

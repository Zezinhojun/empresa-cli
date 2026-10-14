import { describe, expect, it } from 'vitest';

import { installHelp, RUNTIME_LABEL } from './hints.js';

describe('installHelp', () => {
  it('Python no Windows: link, opção winget e aviso para reabrir o terminal', () => {
    const help = installHelp('python', 'win32');

    expect(help).toContain('python.org');
    expect(help).toContain('winget install Python.Python.3.12');
    expect(help).toContain('Add python.exe to PATH');
    expect(help).toContain('feche e abra o terminal');
  });

  it('Python no macOS e no Linux: o jeito de cada sistema', () => {
    expect(installHelp('python', 'darwin')).toContain('brew install python');
    expect(installHelp('python', 'linux')).toContain('sudo apt install python3');
  });

  it('Bash no Windows: pede o Git para Windows (Git Bash), não o WSL', () => {
    const help = installHelp('bash', 'win32');

    expect(help).toContain('Git para Windows');
    expect(help).toContain('git-scm.com');
    expect(help).not.toMatch(/WSL/);
  });

  it('Bash no macOS/Linux: já vem no sistema', () => {
    expect(installHelp('bash', 'linux')).toContain('já vem com o sistema');
    expect(installHelp('bash', 'darwin')).toContain('já vem com o sistema');
  });

  it('Node: aponta para a versão LTS', () => {
    expect(installHelp('node', 'win32')).toContain('nodejs.org');
  });

  it('sem plataforma explícita usa a atual e devolve sempre um texto', () => {
    for (const runtime of ['bash', 'node', 'python'] as const) {
      expect(installHelp(runtime).length).toBeGreaterThan(20);
    }
  });

  it('nomes para as mensagens', () => {
    expect(RUNTIME_LABEL).toEqual({ bash: 'Bash', node: 'Node.js', python: 'Python 3' });
  });
});

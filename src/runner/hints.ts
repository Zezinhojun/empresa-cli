import type { Runtime } from './interpreters.js';

/** Nome para mensagens: "precisa do Python 3". */
export const RUNTIME_LABEL: Record<Runtime, string> = {
  bash: 'Bash',
  node: 'Node.js',
  python: 'Python 3',
};

const REOPEN = 'Depois de instalar, feche e abra o terminal novamente.';

/** Como instalar o runtime no sistema da pessoa, em linguagem simples. */
export function installHelp(
  runtime: Runtime,
  platform: NodeJS.Platform = process.platform,
): string {
  switch (runtime) {
    case 'bash':
      return platform === 'win32'
        ? `Instale o Git para Windows (ele inclui o Git Bash): https://git-scm.com/download/win ou rode "winget install Git.Git". ${REOPEN}`
        : 'O Bash já vem com o sistema. Se aparece como ausente, confira se ele está no PATH.';
    case 'node':
      return `Instale o Node.js (versão LTS) em https://nodejs.org. ${REOPEN}`;
    case 'python':
      if (platform === 'win32') {
        return `Instale o Python 3 em https://www.python.org/downloads/ (marque "Add python.exe to PATH") ou rode "winget install Python.Python.3.12". ${REOPEN}`;
      }
      return platform === 'darwin'
        ? 'Instale o Python 3 com "brew install python" ou em https://www.python.org/downloads/.'
        : 'Instale o Python 3 pelo gerenciador de pacotes da sua distribuição (ex.: "sudo apt install python3").';
  }
}

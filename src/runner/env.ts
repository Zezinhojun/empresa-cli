/**
 * Variáveis do ambiente do usuário que o script herda. O resto (tokens, chaves de API, senhas
 * exportadas no shell) NÃO vaza para o script por padrão.
 */
const ALLOWED = new Set(
  [
    'APPDATA',
    'COMSPEC',
    'HOME',
    'HOMEDRIVE',
    'HOMEPATH',
    'LANG',
    'LANGUAGE',
    'LOCALAPPDATA',
    'LOGNAME',
    'PATH',
    'PATHEXT',
    'PROGRAMDATA',
    'PROGRAMFILES',
    'PROGRAMFILES(X86)',
    'SHELL',
    'SYSTEMDRIVE',
    'SYSTEMROOT',
    'TEMP',
    'TERM',
    'TMP',
    'TMPDIR',
    'TZ',
    'USER',
    'USERNAME',
    'USERPROFILE',
    'WINDIR',
  ].map((name) => name.toUpperCase()),
);

export function buildScriptEnv(
  source: NodeJS.ProcessEnv,
  extra: Record<string, string>,
): Record<string, string> {
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(source)) {
    const name = key.toUpperCase();
    if (value !== undefined && (ALLOWED.has(name) || name.startsWith('LC_'))) env[key] = value;
  }
  return { ...env, ...extra };
}

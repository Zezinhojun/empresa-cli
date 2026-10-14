import { beforeEach, vi } from 'vitest';

// Mock global para execa
vi.mock('execa', () => ({
  execa: vi.fn(),
  execaCommand: vi.fn(),
  execaCommandSync: vi.fn(),
  execaSync: vi.fn(),
}));

// Mock global para @inquirer/prompts
vi.mock('@inquirer/prompts', () => ({
  checkbox: vi.fn(),
  confirm: vi.fn(),
  editor: vi.fn(),
  input: vi.fn(),
  password: vi.fn(),
  search: vi.fn(),
  select: vi.fn(),
}));

// Mock global para chalk - proxy que retorna a string para qualquer propriedade/função
const createChalkMock = () =>
  new Proxy((str: string) => str, {
    get: (target, prop) => {
      if (prop === 'default' || prop === Symbol.toPrimitive) return target;
      return (str: string) => str;
    },
  });

vi.mock('chalk', () => {
  const mock = createChalkMock();
  return { default: mock, ...mock };
});

// Limpeza automática entre testes
beforeEach(() => {
  vi.clearAllMocks();
});

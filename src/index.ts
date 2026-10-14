import { bootstrap } from './cli/bootstrap.js';

bootstrap().catch((error: unknown) => {
  // Ctrl+C dentro de um prompt do inquirer
  if (error instanceof Error && error.name === 'ExitPromptError') {
    process.exitCode = 130;
    return;
  }
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});

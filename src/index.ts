import { bootstrap } from './cli/bootstrap.js';
import { reportError } from './cli/errors.js';

bootstrap().catch((error: unknown) => {
  process.exitCode = reportError(error, process.argv.includes('--verbose'));
});

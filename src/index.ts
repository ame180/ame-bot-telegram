import { parseConfig } from './config.js';

try {
  parseConfig(process.env);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}

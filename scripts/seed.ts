import { ensureSchema } from '../src/lib/db';

await ensureSchema();
console.log('Turso schema is ready. No synthetic prospects were added.');

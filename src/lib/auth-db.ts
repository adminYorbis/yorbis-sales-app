import { drizzle } from 'drizzle-orm/libsql';
import { getTursoClient } from './db';

export const authDb = drizzle(getTursoClient());

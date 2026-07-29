import crypto from 'crypto';
import { DrizzleAdapter } from '@auth/drizzle-adapter';
import { authDb } from '../src/lib/auth-db';
import { getTursoClient } from '../src/lib/db';
import {
  ensureAuthSchema,
  productionDatabaseIdentity,
  salesTableSnapshot,
  verifyAuthSchema,
} from '../src/lib/auth-migration';

const identityBefore = productionDatabaseIdentity();
const salesBefore = await salesTableSnapshot();

console.log(`Production Turso host: ${identityBefore}`);
console.log('Existing sales tables before migration:', salesBefore);

await ensureAuthSchema();
await verifyAuthSchema();

const identityAfter = productionDatabaseIdentity();
if (identityAfter !== identityBefore) throw new Error('Production database identity changed during migration.');

const salesAfter = await salesTableSnapshot();
if (JSON.stringify(salesAfter) !== JSON.stringify(salesBefore)) {
  throw new Error('Existing sales table counts changed during the Auth.js migration.');
}

const adapter = DrizzleAdapter(authDb);
if (!adapter.createUser || !adapter.getUserByEmail || !adapter.deleteUser ||
    !adapter.createVerificationToken || !adapter.useVerificationToken ||
    !adapter.createSession || !adapter.getSessionAndUser || !adapter.deleteSession) {
  throw new Error('The configured Auth.js adapter does not expose the required lifecycle methods.');
}

const nonce = crypto.randomUUID();
const email = `auth-migration-${nonce}@invalid.local`;
const token = crypto.randomUUID();
const sessionToken = crypto.randomUUID();
let createdUserId: string | undefined;

try {
  const missingUser = await adapter.getUserByEmail(email);
  if (missingUser !== null) throw new Error('getUserByEmail did not return null for an unknown user.');

  const verification = await adapter.createVerificationToken({
    identifier: email,
    token,
    expires: new Date(Date.now() + 10 * 60 * 1000),
  });
  if (!verification || verification.token !== token) throw new Error('Verification token creation failed.');

  const consumed = await adapter.useVerificationToken({ identifier: email, token });
  if (!consumed || consumed.token !== token) throw new Error('Verification token read/delete failed.');
  const consumedAgain = await adapter.useVerificationToken({ identifier: email, token });
  if (consumedAgain !== null) throw new Error('Verification token was not deleted after use.');

  const user = await adapter.createUser({ id: crypto.randomUUID(), name: 'Auth Migration Check', email, emailVerified: null, image: null });
  createdUserId = user.id;
  const foundUser = await adapter.getUserByEmail(email);
  if (!foundUser || foundUser.id !== user.id) throw new Error('getUserByEmail failed after creating a user.');

  const session = await adapter.createSession({
    sessionToken,
    userId: user.id,
    expires: new Date(Date.now() + 10 * 60 * 1000),
  });
  const foundSession = await adapter.getSessionAndUser(session.sessionToken);
  if (!foundSession || foundSession.user.id !== user.id) throw new Error('Session create/read verification failed.');
} finally {
  try { await adapter.deleteSession?.(sessionToken); } catch {}
  if (createdUserId) {
    try { await adapter.deleteUser?.(createdUserId); } catch {}
  }
  await getTursoClient().execute({ sql: 'DELETE FROM "verificationToken" WHERE identifier = ?', args: [email] });
}

console.log('Auth.js migration and adapter lifecycle verification passed.');
console.log('Existing sales tables after migration:', salesAfter);

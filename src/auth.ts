import NextAuth from 'next-auth';
import Resend from 'next-auth/providers/resend';
import { DrizzleAdapter } from '@auth/drizzle-adapter';
import { authDb } from '@/lib/auth-db';
import { ensureSchema } from '@/lib/db';

const allowedEmails = new Set(['sun@yorbisapp.com', 'anant@yorbisapp.com']);

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(authDb),
  session: { strategy: 'database' },
  pages: { signIn: '/login', verifyRequest: '/login/check-email' },
  providers: [
    Resend({
      apiKey: process.env.AUTH_RESEND_KEY,
      from: process.env.AUTH_EMAIL_FROM || 'Yorbis <login@yorbisapp.com>',
    }),
  ],
  callbacks: {
    signIn({ user }) {
      return Boolean(user.email && allowedEmails.has(user.email.toLowerCase()));
    },
    authorized({ auth: session }) {
      return Boolean(session?.user?.email && allowedEmails.has(session.user.email.toLowerCase()));
    },
  },
  events: {
    async signIn() {
      await ensureSchema();
    },
  },
});

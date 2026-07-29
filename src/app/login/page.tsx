import { signIn } from '@/auth';
import { ensureAuthSchema } from '@/lib/auth-migration';
import { redirect } from 'next/navigation';
import styles from './login.module.css';

const approvedEmails = new Set(['sun@yorbisapp.com', 'anant@yorbisapp.com']);

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  async function requestLink(formData: FormData) {
    'use server';
    const email = String(formData.get('email') || '').trim().toLowerCase();
    if (!approvedEmails.has(email)) redirect('/login?error=AccessDenied');
    await ensureAuthSchema();
    await signIn('resend', {
      email,
      redirectTo: '/',
    });
  }

  return (
    <main className={styles.page}>
      <section className={styles.card}>
        <div className={styles.mark}>Y</div>
        <span className={styles.eyebrow}>Private sales workspace</span>
        <h1>Welcome to Yorbis</h1>
        <p>Enter your approved Yorbis email. We’ll send you a secure sign-in link.</p>
        {error && <div className={styles.error}>This email is not approved for Yorbis access.</div>}
        <form action={requestLink}>
          <label htmlFor="email">Work email</label>
          <input id="email" name="email" type="email" autoComplete="email" placeholder="you@yorbisapp.com" required />
          <button type="submit">Email me a sign-in link <span>→</span></button>
        </form>
        <small>Access is limited to approved Yorbis team members.</small>
      </section>
    </main>
  );
}

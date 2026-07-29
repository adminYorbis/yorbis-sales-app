import Link from 'next/link';
import styles from '../login.module.css';

export default function CheckEmailPage() {
  return (
    <main className={styles.page}>
      <section className={styles.card}>
        <div className={styles.mark}>✓</div>
        <span className={styles.eyebrow}>Sign-in link sent</span>
        <h1>Check your email</h1>
        <p>Open the secure link we sent to finish signing in. The link expires automatically.</p>
        <Link className={styles.back} href="/login">Use a different email</Link>
      </section>
    </main>
  );
}

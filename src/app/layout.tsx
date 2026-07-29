import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Yorbis | Outbound Sales Intelligent Engine",
  description: "AI-Powered Customer Discovery, Qualification, and Sales Intelligence Hub",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <header className="global-header glass-panel" style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '16px 32px',
          margin: '16px 24px',
          borderRadius: '12px',
          position: 'sticky',
          top: '16px',
          zIndex: 100
        }}>
          <div className="logo" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{
              background: 'var(--accent-gradient)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              fontSize: '1.6rem',
              fontWeight: '700',
              fontFamily: 'var(--font-display)',
              letterSpacing: '-0.03em'
            }}>YORBIS</span>
            <span style={{
              background: 'rgba(255,255,255,0.08)',
              padding: '2px 8px',
              borderRadius: '4px',
              fontSize: '0.7rem',
              fontWeight: '600',
              letterSpacing: '0.05em',
              color: 'var(--accent-primary)',
              border: '1px solid rgba(99, 102, 241, 0.2)'
            }}>OUTBOUND v1.0</span>
          </div>
          
          <nav style={{ display: 'flex', gap: '24px' }}>
            <span style={{ fontSize: '0.9rem', color: 'var(--foreground-muted)', fontWeight: '500', cursor: 'not-allowed' }}>Dashboard</span>
            <span style={{ fontSize: '0.9rem', color: '#fff', fontWeight: '600', borderBottom: '2px solid var(--accent-primary)', paddingBottom: '4px', cursor: 'pointer' }}>Prospects Search</span>
            <span style={{ fontSize: '0.9rem', color: 'var(--foreground-muted)', fontWeight: '500', cursor: 'not-allowed' }}>Outreach (Coming Soon)</span>
            <span style={{ fontSize: '0.9rem', color: 'var(--foreground-muted)', fontWeight: '500', cursor: 'not-allowed' }}>Meetings (Coming Soon)</span>
          </nav>
        </header>

        <main style={{ flex: 1, padding: '0 24px 40px 24px', display: 'flex', flexDirection: 'column' }}>
          {children}
        </main>
      </body>
    </html>
  );
}

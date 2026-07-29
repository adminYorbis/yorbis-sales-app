import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Yorbis Prospect Intelligence',
  description: 'Find, research, and engage the companies most likely to need Yorbis.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}

import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Regnskap',
  description: 'Norsk regnskapsverktøy for småbedrifter',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="no">
      <body>{children}</body>
    </html>
  );
}

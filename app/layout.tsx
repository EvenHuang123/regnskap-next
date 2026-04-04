import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Regnskap',
  description: 'Norsk regnskapsverktøy for småbedrifter',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="no">
      <head>
        <link rel="preconnect" href="https://api.fontshare.com" />
        <link
          rel="stylesheet"
          href="https://api.fontshare.com/v2/css?f[]=cabinet-grotesk@800,700,500,400,300&display=swap"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}

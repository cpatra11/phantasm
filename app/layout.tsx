import type { Metadata } from 'next';
import { Archivo } from 'next/font/google';
import './globals.css';

const archivo = Archivo({
  subsets: ['latin'],
  weight: ['400', '500', '700', '800'],
  variable: '--font-archivo',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Phantasma',
  description: 'Turn a brand URL and a prompt into editable motion graphics.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={archivo.variable}>
      <body>
        <div className="grid-overlay" aria-hidden="true" />
        <div className="page">{children}</div>
      </body>
    </html>
  );
}

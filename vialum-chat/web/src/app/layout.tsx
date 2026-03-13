import type { Metadata } from 'next';
import { Sora } from 'next/font/google';
import { Toaster } from '@/components/ui/toaster';
import './globals.css';

const sora = Sora({ subsets: ['latin'], weight: ['300', '400', '500', '600', '700'] });

export const metadata: Metadata = {
  title: 'Vialum Chat',
  description: 'Plataforma de engajamento WhatsApp com IA',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className="dark">
      <body className={`${sora.className} antialiased`}>
        {children}
        <Toaster />
      </body>
    </html>
  );
}

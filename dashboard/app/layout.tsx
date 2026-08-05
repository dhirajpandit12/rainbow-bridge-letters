import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Rainbow Bridge Admin',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[#f8f7f5]">{children}</body>
    </html>
  );
}

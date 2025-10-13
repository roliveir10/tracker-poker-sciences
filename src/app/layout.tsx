import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Link from 'next/link';

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Betclic Spin Tracker",
  description: "Track Spin & Go hands and tournaments",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        suppressHydrationWarning
      >
        <nav className="border-b">
          <div className="max-w-5xl mx-auto px-4 py-3 flex gap-4 text-sm">
            <Link className="hover:underline" href="/dashboard">Dashboard</Link>
            <Link className="hover:underline" href="/imports">Imports</Link>
            <Link className="hover:underline" href="/tournaments">Tournois</Link>
          </div>
        </nav>
        {children}
      </body>
    </html>
  );
}

import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Link from "next/link";
import { ThemeProvider } from "@/components/theme-provider";
import { cn } from "@/lib/utils";
import { SidebarNav } from "@/components/SidebarNav";
import AutoSso from "@/components/AutoSso";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Poker Sciences",
  description: "Track Spin & Go hands and tournaments",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const sidebarItems: never[] = [];

  return (
    <html lang="fr" suppressHydrationWarning data-theme="dark" className="dark">
      <head>
        <meta name="color-scheme" content="dark" />
      </head>
      <body
        className={cn(
          inter.variable,
          "min-h-screen bg-background font-sans text-foreground antialiased",
        )}
        suppressHydrationWarning
      >
        <ThemeProvider>
          <div className="flex min-h-screen bg-background text-foreground">
            <aside className="hidden w-64 flex-col border-r border-border/60 bg-card/80 px-4 py-6 sm:flex">
              <Link
                href="/dashboard"
                className="mb-8 inline-flex items-center text-lg font-semibold tracking-tight text-foreground"
              >
                Poker Sciences
              </Link>
              <SidebarNav />
            </aside>
            <div className="flex flex-1 flex-col">
              <AutoSso />
              {children}
            </div>
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}

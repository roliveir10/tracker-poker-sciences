import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Link from "next/link";
import {
  Home,
  LayoutDashboard,
  UploadCloud,
  Trophy,
  LogIn,
} from "lucide-react";
import { ThemeProvider } from "@/components/theme-provider";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

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
  const sidebarItems = [
    { label: "Home", href: "/", icon: Home },
    { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { label: "Imports", href: "/imports", icon: UploadCloud },
    { label: "Tournaments", href: "/tournaments", icon: Trophy },
    { label: "Sign In", href: "/signin", icon: LogIn },
  ];

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
              <nav className="flex flex-1 flex-col gap-1">
                {sidebarItems.map(({ href, label, icon: Icon }) => (
                  <Link
                    key={href}
                    href={href}
                    className={buttonVariants({
                      variant: "ghost",
                      className:
                        "justify-start gap-3 text-sm font-medium text-muted-foreground transition hover:text-foreground",
                    })}
                  >
                    <Icon className="h-4 w-4" aria-hidden />
                    <span>{label}</span>
                  </Link>
                ))}
              </nav>
            </aside>
            <div className="flex flex-1 flex-col">
              {children}
            </div>
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}

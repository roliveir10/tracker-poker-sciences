"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import {
  Home,
  LayoutDashboard,
  UploadCloud,
  Trophy,
  LogIn,
} from "lucide-react";

export function SidebarNav() {
  const pathname = usePathname();
  type MemberstackSdk = { openModal: (type: 'LOGIN' | 'SIGNUP' | 'PROFILE' | 'FORGOT_PASSWORD' | 'RESET_PASSWORD') => Promise<void> } | null;
  const [ms, setMs] = useState<MemberstackSdk>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const publicKey = process.env.NEXT_PUBLIC_MEMBERSTACK_PUBLIC_KEY;
        if (!publicKey) return;
        const mod = await import("@memberstack/dom");
        const sdk = await mod.default.init({ publicKey });
        if (!cancelled) setMs(sdk);
      } catch {
        // silent
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  const items = [
    { label: "Home", href: "/", icon: Home },
    { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { label: "Imports", href: "/imports", icon: UploadCloud },
    { label: "Tournaments", href: "/tournaments", icon: Trophy },
    { label: "Sign In", href: "/signin", icon: LogIn },
  ];

  return (
    <nav className="flex flex-1 flex-col gap-1">
      {items.map(({ href, label, icon: Icon }) => {
        const isActive = href === "/"
          ? pathname === "/"
          : pathname === href || pathname.startsWith(`${href}/`);

        return (
          <Link
            key={href}
            href={href}
            onClick={(e) => {
              if (href === "/signin" && ms) {
                e.preventDefault();
                ms.openModal("LOGIN").catch(() => {});
              }
            }}
            className={cn(
              buttonVariants({
                variant: "ghost",
                className:
                  "justify-start gap-3 text-sm font-medium transition",
              }),
              isActive
                ? "bg-accent text-accent-foreground hover:bg-accent"
                : "text-muted-foreground hover:text-foreground"
            )}
            aria-current={isActive ? "page" : undefined}
          >
            <Icon className="h-4 w-4" aria-hidden />
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}



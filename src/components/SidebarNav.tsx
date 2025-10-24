"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
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
  const [ms, setMs] = useState<unknown>(null);
  const [auth, setAuth] = useState<{ authenticated: boolean; email?: string | null } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const publicKey = process.env.NEXT_PUBLIC_MEMBERSTACK_PUBLIC_KEY;
        if (!publicKey) return;
        const mod = await import("@memberstack/dom");
        const sdk = await mod.default.init({ publicKey });
        if (!cancelled) setMs(sdk as unknown);
      } catch {
        // silent
      }
    })();
    (async () => {
      try {
        const r = await fetch('/api/session', { credentials: 'include' });
        if (!r.ok) return;
        const j = await r.json().catch(() => null);
        if (!cancelled) setAuth({ authenticated: Boolean(j?.authenticated), email: j?.user?.email ?? null });
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
                (ms as { openModal: (
                  type: 'LOGIN' | 'SIGNUP' | 'PROFILE' | 'FORGOT_PASSWORD' | 'RESET_PASSWORD',
                  params?: Record<string, unknown>
                ) => Promise<unknown> }).openModal("LOGIN").catch(() => {});
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
      <div className="mt-auto pt-4">
        {auth?.authenticated ? (
          <div className="flex flex-col gap-2">
            <button
              className={cn(buttonVariants({ variant: "ghost", className: "justify-start gap-3 text-sm font-medium" }))}
              onClick={(e) => {
                e.preventDefault();
                if (!ms) return;
                (ms as { openModal: (
                  type: 'LOGIN' | 'SIGNUP' | 'PROFILE' | 'FORGOT_PASSWORD' | 'RESET_PASSWORD',
                  params?: Record<string, unknown>
                ) => Promise<unknown> }).openModal('PROFILE').catch(() => {});
              }}
            >
              Mon compte
            </button>
            <button
              className={cn(buttonVariants({ variant: "ghost", className: "justify-start gap-3 text-sm font-medium" }))}
              onClick={async (e) => {
                e.preventDefault();
                try {
                  if (ms && (ms as { logout?: () => Promise<unknown> }).logout) {
                    await (ms as { logout: () => Promise<unknown> }).logout();
                  }
                } catch {}
                try {
                  await fetch('/api/auth/[...nextauth]?csrf=true', { method: 'GET', credentials: 'include' });
                  await fetch('/api/auth/signout', { method: 'POST', credentials: 'include' });
                } catch {}
                window.location.href = '/';
              }}
            >
              Se déconnecter
            </button>
          </div>
        ) : (
          <div className="text-xs text-muted-foreground px-2">Non connecté</div>
        )}
      </div>
    </nav>
  );
}



"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import {
  Home,
  LayoutDashboard,
  UploadCloud,
  Trophy,
  LogIn,
  Loader2,
  Eye,
  BarChart2,
  Search,
  type LucideIcon,
} from "lucide-react";
import { getMemberstackClient, openLoginModal, type MemberstackClient } from "@/lib/msClient";

type NavItem = { label: string; href: string; icon: LucideIcon; disabled?: boolean };

const MEMBERSTACK_READY_EVENT = "pksciences:memberstack-ready";
const DISABLE_AUTOSSO_COOKIE = "ms_disable_autosso";

export function SidebarNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { status } = useSession();
  const isAuthenticated = status === "authenticated";
  const isLoadingSession = status === "loading";

  const [msClient, setMsClient] = useState<MemberstackClient | null>(null);
  const [isOpeningLogin, setIsOpeningLogin] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [pendingHref, setPendingHref] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const client = await getMemberstackClient();
      if (mounted && client) setMsClient(client);
    })();
    const handleReady = (event: Event) => {
      const detail = (event as CustomEvent<{ ms?: MemberstackClient }>).detail;
      if (detail?.ms) setMsClient(detail.ms);
    };
    window.addEventListener(MEMBERSTACK_READY_EVENT, handleReady as EventListener);
    return () => {
      mounted = false;
      window.removeEventListener(MEMBERSTACK_READY_EVENT, handleReady as EventListener);
    };
  }, []);

  useEffect(() => {
    if (!pendingHref) return;
    const matches =
      pendingHref === "/"
        ? pathname === "/"
        : pathname === pendingHref || pathname.startsWith(`${pendingHref}/`);
    if (matches) setPendingHref(null);
  }, [pathname, pendingHref]);

  useEffect(() => {
    if (!pendingHref) return;
    const timeout = setTimeout(() => setPendingHref(null), 6000);
    return () => clearTimeout(timeout);
  }, [pendingHref]);

  const items = useMemo<NavItem[]>(() => {
    if (isAuthenticated) {
      return [
        { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
        { label: "Imports", href: "/imports", icon: UploadCloud },
        { label: "Tournaments", href: "/tournaments", icon: Trophy, disabled: true },
        { label: "Review", href: "/review", icon: Eye, disabled: true },
        { label: "Leaderboard", href: "/leaderboard", icon: BarChart2, disabled: true },
        { label: "Leak Finder", href: "/leak-finder", icon: Search, disabled: true },
      ];
    }
    if (isLoadingSession) {
      return [{ label: "…", href: "/", icon: Home }];
    }
    return [
      { label: "Home", href: "/", icon: Home },
      { label: "Sign In", href: "/signin", icon: LogIn },
    ];
  }, [isAuthenticated, isLoadingSession]);

  const candidatePath = pendingHref ?? pathname;
  const matchesPath = (target: string) =>
    target === "/"
      ? candidatePath === "/"
      : candidatePath === target || candidatePath.startsWith(`${target}/`);

  const handleLoginClick = async () => {
    if (isOpeningLogin) return;
    setIsOpeningLogin(true);
    try { document.cookie = `${DISABLE_AUTOSSO_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`; } catch {}
    try { localStorage.setItem("ms_post_login_redirect", window.location.pathname + window.location.search + window.location.hash); } catch {}
    try { sessionStorage.setItem("ms_login_request_at", String(Date.now())); } catch {}
    try {
      let client = msClient;
      if (!client) {
        client = await getMemberstackClient();
        if (client) setMsClient(client);
      }
      const opened = await openLoginModal(client ?? null);
      try { sessionStorage.removeItem("ms_login_request_at"); } catch {}
      if (!opened) {
        try { window.dispatchEvent(new CustomEvent("pksciences:login-requested")); } catch {}
      }
    } catch {
      // ignore: handled by AutoSso fallback
    } finally {
      setIsOpeningLogin(false);
    }
  };

  const handleLogout = async () => {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    try {
      document.cookie = `${DISABLE_AUTOSSO_COOKIE}=1; Path=/; Max-Age=${30 * 24 * 60 * 60}; SameSite=Lax`;
    } catch {}
    try {
      const client = msClient ?? (await getMemberstackClient());
      if (client?.logout) {
        const result = client.logout();
        await Promise.race([
          Promise.resolve(result),
          new Promise((resolve) => setTimeout(resolve, 1500)),
        ]);
      }
    } catch {
      // ignore Memberstack logout failure to avoid blocking
    }
    try {
      await signOut({ redirect: false });
    } catch {
      // ignore signOut failure; we'll reload anyway
    }
    try { localStorage.removeItem("ms_post_login_redirect"); } catch {}
    window.location.href = "/";
  };

  return (
    <nav className="flex flex-1 flex-col gap-1">
      {items.map(({ href, label, icon: Icon, disabled }) => {
        const isDisabled = Boolean(disabled);
        const isActive = !isDisabled && matchesPath(href);
        return (
          <Link
            key={href}
            href={href}
            prefetch={false}
            onClick={(event) => {
              if (isDisabled) {
                event.preventDefault();
                return;
              }
              if (href !== "/signin") {
                setPendingHref(href);
                return;
              }
              event.preventDefault();
              void handleLoginClick();
            }}
            className={cn(
              buttonVariants({
                variant: "ghost",
                className: "justify-start gap-3 text-sm font-medium transition",
              }),
              isDisabled
                ? "text-muted-foreground opacity-50 hover:text-muted-foreground cursor-not-allowed"
                : isActive
                  ? "bg-accent text-accent-foreground hover:bg-accent"
                  : "text-muted-foreground hover:text-foreground",
            )}
            aria-current={isActive ? "page" : undefined}
            aria-disabled={isDisabled || undefined}
            tabIndex={isDisabled ? -1 : undefined}
            title={isDisabled ? "Arrive prochainement" : undefined}
          >
            <Icon className="h-4 w-4" aria-hidden />
            <span>
              {label === "Sign In" && (isOpeningLogin || isLoadingSession) ? (
                <span className="inline-flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  Connexion…
                </span>
              ) : (
                label
              )}
            </span>
          </Link>
        );
      })}

      <div className="mt-auto pt-4">
        {isAuthenticated ? (
          <div className="flex flex-col gap-2">
            {[
              { label: "Abonnements", href: "/pricing" },
              { label: "Mon compte", href: "/account" },
            ].map(({ label, href }) => (
              <button
                key={href}
                className={cn(
                  buttonVariants({
                    variant: "ghost",
                    className: "justify-start gap-3 text-sm font-medium transition",
                  }),
                  matchesPath(href)
                    ? "bg-accent text-accent-foreground hover:bg-accent"
                    : "text-muted-foreground hover:text-foreground",
                )}
                onClick={(event) => {
                  event.preventDefault();
                  setPendingHref(href);
                  router.push(href);
                }}
              >
                {label}
              </button>
            ))}
            <button
              className={cn(
                buttonVariants({
                  variant: "ghost",
                  className: "justify-start gap-3 text-sm font-medium",
                }),
              )}
              disabled={isLoggingOut}
              onClick={(event) => {
                event.preventDefault();
                void handleLogout();
              }}
            >
              {isLoggingOut ? (
                <span className="inline-flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  Déconnexion…
                </span>
              ) : (
                "Se déconnecter"
              )}
            </button>
          </div>
        ) : (
          <div className="px-2 text-xs text-muted-foreground">
            {isLoadingSession ? (
              <span className="inline-flex items-center gap-1">
                <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
                Connexion en cours…
              </span>
            ) : (
              "Non connecté"
            )}
          </div>
        )}
      </div>
    </nav>
  );
}


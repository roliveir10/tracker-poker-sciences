"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { Home, LayoutDashboard, UploadCloud, Trophy, LogIn, Loader2, Eye, BarChart2, Search, type LucideIcon } from "lucide-react";
import { getMemberstackClient, openLoginModal, type MemberstackClient } from "@/lib/msClient";

const AUTH_EVENT = 'pksciences:auth-changed';
const MEMBERSTACK_READY_EVENT = 'pksciences:memberstack-ready';

type AuthState = { authenticated: boolean; email?: string | null };
type NavItem = { label: string; href: string; icon: LucideIcon; disabled?: boolean };
const COMING_SOON_LABEL = "Arrive prochainement";

export function SidebarNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [ms, setMs] = useState<MemberstackClient | null>(null);
  const [auth, setAuth] = useState<AuthState | null>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isOpeningLogin, setIsOpeningLogin] = useState(false);
  const isSigningIn = false;
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const authLockUntilRef = useRef<number>(0);

  const refreshAuthState = useCallback(async () => {
    try {
      const r = await fetch('/api/session', {
        credentials: 'include',
        cache: 'no-store',
        headers: { 'cache-control': 'no-store' },
      });
      if (!r.ok) {
        if (Date.now() < authLockUntilRef.current) return;
        setAuth({ authenticated: false });
        return;
      }
      const j = await r.json().catch(() => null);
      if (Date.now() < authLockUntilRef.current) return;
      setAuth({ authenticated: Boolean(j?.authenticated), email: j?.user?.email ?? null });
    } catch {
      if (Date.now() < authLockUntilRef.current) return;
      setAuth((prev) => prev ?? { authenticated: false });
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await refreshAuthState();
      if (cancelled) return;
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshAuthState]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<AuthState>).detail;
      if (detail && typeof detail.authenticated === 'boolean') {
        setAuth({ authenticated: detail.authenticated, email: detail.email ?? null });
        if (detail.authenticated) {
          // Gèle toute mise à jour issue de refreshAuthState pendant un court instant
          authLockUntilRef.current = Date.now() + 5000;
          setTimeout(() => { if (authLockUntilRef.current < Date.now()) authLockUntilRef.current = 0; }, 5000);
        } else {
          authLockUntilRef.current = 0;
        }
        // No refresh to avoid loops; rely on emitted state
        return;
      }
      refreshAuthState();
    };
    window.addEventListener(AUTH_EVENT, handler as EventListener);
    return () => {
      window.removeEventListener(AUTH_EVENT, handler as EventListener);
    };
  }, [refreshAuthState]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const client = await getMemberstackClient();
      if (!cancelled && client) setMs(client);
    })();
    if (typeof window !== 'undefined') {
      const onMsReady = (event: Event) => {
        const detail = (event as CustomEvent<{ ms?: MemberstackClient }>).detail;
        if (detail?.ms) setMs(detail.ms);
      };
      window.addEventListener(MEMBERSTACK_READY_EVENT, onMsReady as EventListener);
      return () => {
        cancelled = true;
        window.removeEventListener(MEMBERSTACK_READY_EVENT, onMsReady as EventListener);
      };
    }
    return () => { /* no-op */ };
  }, []);

  useEffect(() => {
    if (!pendingHref) return;
    const matches = pendingHref === '/'
      ? pathname === '/'
      : pathname === pendingHref || pathname.startsWith(`${pendingHref}/`);
    if (matches) setPendingHref(null);
  }, [pathname, pendingHref]);

  useEffect(() => {
    if (!pendingHref) return;
    const timeout = setTimeout(() => setPendingHref(null), 6000);
    return () => clearTimeout(timeout);
  }, [pendingHref]);

  const items = useMemo<NavItem[]>(() => {
    if (!auth) {
      // état indéterminé: affiche un squelette minimal pour éviter tout flash
      return [
        { label: "…", href: "/", icon: Home },
      ];
    }
    if (auth.authenticated) {
      return [
        { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
        { label: "Imports", href: "/imports", icon: UploadCloud },
        { label: "Tournaments", href: "/tournaments", icon: Trophy, disabled: true },
        { label: "Review", href: "/review", icon: Eye, disabled: true },
        { label: "Leaderboard", href: "/leaderboard", icon: BarChart2, disabled: true },
        { label: "Leak Finder", href: "/leak-finder", icon: Search, disabled: true },
      ];
    }
    return [
      { label: "Home", href: "/", icon: Home },
      { label: "Sign In", href: "/signin", icon: LogIn },
    ];
  }, [auth]);

  const candidatePath = pendingHref ?? pathname;
  const matchesPath = useCallback(
    (target: string) =>
      target === '/'
        ? candidatePath === '/'
        : candidatePath === target || candidatePath.startsWith(`${target}/`),
    [candidatePath]
  );

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
            onClick={async (e) => {
              if (isDisabled) {
                e.preventDefault();
                return;
              }
              if (href !== "/signin") {
                setPendingHref(href);
              }
              if (href === "/signin") {
                e.preventDefault();
                if (isOpeningLogin) return;
                setIsOpeningLogin(true);
                try { document.cookie = 'ms_disable_autosso=; Path=/; Max-Age=0; SameSite=Lax'; } catch {}
                // Retenir la redirection post-login et marquer l'intention d'ouvrir le modal (éphémère)
                try { localStorage.setItem('ms_post_login_redirect', window.location.pathname + window.location.search + window.location.hash); } catch {}
                try { sessionStorage.setItem('ms_login_request_at', String(Date.now())); } catch {}
                try {
                  let sdk = ms;
                  if (!sdk) {
                    sdk = await getMemberstackClient();
                    if (sdk) setMs(sdk);
                  }
                  const opened = await openLoginModal(sdk ?? null);
                  // Nettoie le flag après tentative pour éviter l'ouverture au reload
                  try { sessionStorage.removeItem('ms_login_request_at'); } catch {}
                  if (!opened) {
                    // Fallback: déclenche un événement pour AutoSso
                    try { window.dispatchEvent(new CustomEvent('pksciences:login-requested')); } catch {}
                  }
                } catch {
                  // ignore: on reste sur la page courante
                } finally {
                  setIsOpeningLogin(false);
                }
              }
            }}
            className={cn(
              buttonVariants({
                variant: "ghost",
                className:
                  "justify-start gap-3 text-sm font-medium transition",
              }),
              isDisabled
                ? "text-muted-foreground opacity-50 hover:text-muted-foreground cursor-not-allowed"
                : isActive
                  ? "bg-accent text-accent-foreground hover:bg-accent"
                  : "text-muted-foreground hover:text-foreground"
            )}
            aria-current={isActive ? "page" : undefined}
            aria-disabled={isDisabled}
            tabIndex={isDisabled ? -1 : undefined}
            title={isDisabled ? COMING_SOON_LABEL : undefined}
          >
            <Icon className="h-4 w-4" aria-hidden />
            <span>{label === 'Sign In' && (isOpeningLogin || isSigningIn) ? (
              <span className="inline-flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                Connexion…
              </span>
            ) : label}</span>
          </Link>
        );
      })}
      <div className="mt-auto pt-4">
        {auth?.authenticated ? (
          <div className="flex flex-col gap-2">
            <button
              className={cn(
                buttonVariants({ variant: "ghost", className: "justify-start gap-3 text-sm font-medium transition" }),
                matchesPath('/pricing')
                  ? "bg-accent text-accent-foreground hover:bg-accent"
                  : "text-muted-foreground hover:text-foreground"
              )}
              onClick={(e) => {
                e.preventDefault();
                setPendingHref('/pricing');
                router.push('/pricing');
              }}
            >
              Abonnements
            </button>
            <button
              className={cn(
                buttonVariants({ variant: "ghost", className: "justify-start gap-3 text-sm font-medium transition" }),
                matchesPath('/account')
                  ? "bg-accent text-accent-foreground hover:bg-accent"
                  : "text-muted-foreground hover:text-foreground"
              )}
              onClick={(e) => {
                e.preventDefault();
                setPendingHref('/account');
                router.push('/account');
              }}
            >
              Mon compte
            </button>
            <button
              className={cn(buttonVariants({ variant: "ghost", className: "justify-start gap-3 text-sm font-medium" }))}
              disabled={isLoggingOut}
              onClick={async (e) => {
                e.preventDefault();
                if (isLoggingOut) return;
                setIsLoggingOut(true);
                try {
                  // Désactive l'auto-SSO immédiatement pour éviter une reconnexion instantanée
                  document.cookie = 'ms_disable_autosso=1; Path=/; Max-Age=' + (30*24*60*60) + '; SameSite=Lax';
                } catch {}
                // 1) Déconnexion Memberstack non bloquante avec timeout court
                try {
                  const client = ms ?? (await getMemberstackClient());
                  if (client?.logout) {
                    const result = client.logout();
                    await Promise.race([
                      Promise.resolve(result),
                      new Promise((resolve) => setTimeout(resolve, 1500)),
                    ]);
                  }
                } catch {}
                // 2) Invalidation de session serveur en fire-and-forget
                try {
                  fetch('/api/session', { method: 'DELETE', credentials: 'include', keepalive: true }).catch(() => {});
                } catch {}
                // 3) Redirection immédiate
                window.location.href = '/';
              }}
            >
              {isLoggingOut ? (
                <span className="inline-flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  Déconnexion…
                </span>
              ) : (
                'Se déconnecter'
              )}
            </button>
          </div>
        ) : (
          <div className="text-xs text-muted-foreground px-2">
            {isSigningIn ? (
              <span className="inline-flex items-center gap-1">
                <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
                Connexion en cours…
              </span>
            ) : (
              'Non connecté'
            )}
          </div>
        )}
      </div>
    </nav>
  );
}

"use client";

import { buttonVariants } from "@/components/ui/button";
import { getMemberstackClient, openLoginModal } from "@/lib/msClient";

export default function HomeGuestCta() {
  async function handleOpenLoginAndRedirect(target: string) {
    try {
      if (typeof window === 'undefined') return;
      try { localStorage.setItem('ms_post_login_redirect', target); } catch {}
      try { sessionStorage.setItem('ms_login_request_at', String(Date.now())); } catch {}
      const ms = await getMemberstackClient();
      if (!ms) {
        try { window.dispatchEvent(new CustomEvent('pksciences:login-requested')); } catch {}
        window.location.href = target;
        return;
      }
      const opened = await openLoginModal(ms);
      try { sessionStorage.removeItem('ms_login_request_at'); } catch {}
      if (!opened) {
        try { window.dispatchEvent(new CustomEvent('pksciences:login-requested')); } catch {}
      }
    } catch {
      try { window.location.href = target; } catch {}
    }
  }

  return (
    <section className="mx-auto w-full max-w-3xl text-center mt-16">
      <div className="rounded-lg border border-border/60 bg-card/40 px-5 py-4">
        <h3 className="mb-2 text-xl font-semibold text-foreground">Prêt à commencer ?</h3>
        <p className="mx-auto mb-4 max-w-xl text-sm text-muted-foreground">Connectez-vous et importez vos premières mains. Le reste est automatique.</p>
        <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
          <button onClick={() => handleOpenLoginAndRedirect('/dashboard')} className={buttonVariants({ size: 'default', variant: 'default' })}>Aller au dashboard</button>
          <button onClick={() => handleOpenLoginAndRedirect('/imports')} className={buttonVariants({ size: 'default', variant: 'outline' })}>Importer des mains</button>
        </div>
      </div>
    </section>
  );
}


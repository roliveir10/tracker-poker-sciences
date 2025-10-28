import Image from "next/image";
import { auth } from "@/auth";
import HomeGuestCta from "@/components/HomeGuestCta";
import { redirect } from "next/navigation";

export default async function Home() {
  const session = await auth();

  if (session?.user?.id) {
    redirect('/dashboard');
  }

  // Non connecté (server-render, pas de flash)
  return (
    <main className="mx-auto flex w-full max-w-5xl min-h-[calc(100svh-64px)] flex-col gap-10 px-4 py-8 overflow-hidden">
      <section className="flex flex-[0.75] flex-col items-center justify-center gap-5 text-center">
        <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl inline-flex items-center gap-3">
          Poker Sciences Tracker
          <Image
            src="/logo_pksciences.svg"
            alt="Logo Poker Sciences Tracker"
            width={44}
            height={44}
            className="opacity-95"
            priority
          />
        </h1>
        <p className="mx-auto max-w-2xl text-base text-muted-foreground md:mx-0">
          Le tracker pour les Spin &amp; Go.
        </p>
      </section>

      <HomeGuestCta />

      <div className="flex-1" aria-hidden="true" />

      <section className="mx-auto w-full max-w-4xl">
        <h2 className="mb-4 text-center text-2xl font-semibold tracking-tight text-foreground">Comment ça marche ?</h2>
        <ol className="grid gap-4 sm:grid-cols-3">
          <li className="rounded-lg border border-border/60 bg-card/40 p-5">
            <div className="mb-1.5 text-base font-medium text-foreground">1. Connectez-vous</div>
            <div className="text-sm text-muted-foreground">Connectez-vous et accédez au dashboard.</div>
          </li>
          <li className="rounded-lg border border-border/60 bg-card/40 p-5">
            <div className="mb-1.5 text-base font-medium text-foreground">2. Importez vos mains</div>
            <div className="text-sm text-muted-foreground">Glissez-déposez vos fichiers, nous gérons le reste.</div>
          </li>
          <li className="rounded-lg border border-border/60 bg-card/40 p-5">
            <div className="mb-1.5 text-base font-medium text-foreground">3. Analysez</div>
            <div className="text-sm text-muted-foreground">Suivez CEV et bankroll avec tous les filtres dont les joueurs de Spin ont besoin.</div>
          </li>
        </ol>
      </section>
    </main>
  );
}

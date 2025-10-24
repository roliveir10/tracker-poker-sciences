"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type MemberstackMemberEvent = {
	data?: { id?: string | null } | null;
};

export default function SignInPage() {
	const [email, setEmail] = useState('');
	const [status, setStatus] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Si déjà authentifié côté app, redirige rapidement vers le dashboard
        const r = await fetch('/api/session', { credentials: 'include' });
        const j = await r.json().catch(() => null);
        if (!cancelled && j?.authenticated) {
          router.replace('/dashboard');
          return;
        }

        const publicKey = process.env.NEXT_PUBLIC_MEMBERSTACK_PUBLIC_KEY;
        if (!publicKey) return; // Pas de clé → on laisse le fallback email
        const mod = await import('@memberstack/dom');
        const ms = await mod.default.init({ publicKey });

        // Lorsqu'un membre se connecte, créer la session locale et rediriger
		ms.onAuthChange(async (member: MemberstackMemberEvent) => {
          if (cancelled) return;
          try {
            const memberId = typeof member?.data?.id === 'string' ? member.data.id : undefined;
            if (!memberId) return;
            const res = await fetch('/api/auth/memberstack', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({ memberId }),
            });
            if (res.ok) router.replace('/');
          } catch {
            // ignore
          }
        });

        // Ouvre le modal de connexion automatiquement
        await ms.openModal('LOGIN');
      } catch {
        // silencieux, on garde le fallback email
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

	async function submit(event: React.FormEvent) {
		event.preventDefault();
		setStatus('Sending magic link...');
		const result = await signIn('email', { email, callbackUrl: '/', redirect: false });
		if (result?.ok) setStatus('Check your inbox and click the link.');
		else setStatus('Unable to send the link. Check EMAIL_SERVER.');
	}

	return (
		<main className="mx-auto flex min-h-[calc(100vh-80px)] w-full max-w-md items-center px-4 py-12">
			<Card className="w-full">
				<CardHeader className="space-y-2">
					<CardTitle className="text-2xl font-semibold text-foreground">Sign in</CardTitle>
					<CardDescription>
						Enter your email address to receive a magic link and access the dashboard.
					</CardDescription>
				</CardHeader>
				<CardContent>
					<form onSubmit={submit} className="space-y-4">
						<Button
							type="button"
							className="w-full"
							onClick={async () => {
								try {
									const publicKey = process.env.NEXT_PUBLIC_MEMBERSTACK_PUBLIC_KEY;
									if (!publicKey) return;
									const mod = await import('@memberstack/dom');
									const ms = await mod.default.init({ publicKey });
									await ms.openModal('LOGIN');
								} catch {}
							}}
						>
							Se connecter avec Memberstack
						</Button>
						<div className="space-y-2">
							<Label htmlFor="email">Email address</Label>
							<Input
								id="email"
								type="email"
								value={email}
								placeholder="you@example.com"
								autoComplete="email"
								onChange={(event) => setEmail(event.target.value)}
								required
							/>
						</div>
						<Button type="submit" className="w-full">
							Recevoir le lien
						</Button>
					</form>
					{status && (
						<p className="mt-4 text-sm text-muted-foreground">
							{status}
						</p>
					)}
				</CardContent>
			</Card>
		</main>
	);
}

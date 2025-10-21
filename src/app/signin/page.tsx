"use client";

import { useState } from 'react';
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

export default function SignInPage() {
	const [email, setEmail] = useState('');
	const [status, setStatus] = useState<string | null>(null);

	async function submit(event: React.FormEvent) {
		event.preventDefault();
		setStatus('Sending magic link...');
		const result = await signIn('email', { email, callbackUrl: '/dashboard', redirect: false });
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

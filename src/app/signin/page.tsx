"use client";

import { useState } from 'react';
import { signIn } from 'next-auth/react';

export default function SignInPage() {
	const [email, setEmail] = useState('');
	const [status, setStatus] = useState<string | null>(null);

	async function submit(e: React.FormEvent) {
		e.preventDefault();
		setStatus('Envoi du lien...');
		const res = await signIn('email', { email, callbackUrl: '/dashboard', redirect: false });
		if (res?.ok) setStatus('Vérifiez votre boîte mail et cliquez sur le lien.');
		else setStatus('Impossible d’envoyer le lien. Vérifiez EMAIL_SERVER.');
	}

	return (
		<div className="max-w-sm mx-auto p-6 space-y-4">
			<h1 className="text-2xl font-semibold">Connexion</h1>
			<form onSubmit={submit} className="space-y-3">
				<input
					type="email"
					value={email}
					onChange={(e) => setEmail(e.target.value)}
					placeholder="email"
					className="w-full border rounded px-3 py-2"
					required
				/>
				<button className="px-4 py-2 bg-blue-600 text-white rounded" type="submit">Recevoir le lien</button>
			</form>
			{status && <p className="text-sm text-gray-700">{status}</p>}
		</div>
	);
}


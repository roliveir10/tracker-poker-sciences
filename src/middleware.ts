import type { NextRequest } from 'next/server';

export default async function middleware(_req: NextRequest) {
	// No-op middleware; Sentry SDK v10 doesn't expose withSentryMiddleware.
	// Keep this file only if you need custom edge logic.
}

export const config = {
	matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};

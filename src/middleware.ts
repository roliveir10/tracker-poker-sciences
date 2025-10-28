import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const BLOCKED_PATHS = ['/tournaments', '/review', '/leaderboard', '/leak-finder'];

export default function middleware(req: NextRequest) {
	if (BLOCKED_PATHS.some((path) => req.nextUrl.pathname === path || req.nextUrl.pathname.startsWith(`${path}/`))) {
		const redirectUrl = req.nextUrl.clone();
		redirectUrl.pathname = '/';
		redirectUrl.search = '';
		return NextResponse.redirect(redirectUrl);
	}

	return NextResponse.next();
}

export const config = {
	matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};

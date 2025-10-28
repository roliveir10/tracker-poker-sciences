import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const BLOCKED_PATHS = ['/tournaments', '/review', '/leaderboard', '/leak-finder'];

export default function middleware(req: NextRequest) {
	if (req.method === 'OPTIONS') {
		const res = new NextResponse(null, { status: 204 });
		const origin = req.headers.get('origin');
		if (origin) {
			res.headers.set('Access-Control-Allow-Origin', origin);
		}
		res.headers.set('Access-Control-Allow-Methods', 'GET,HEAD,POST,OPTIONS');
		res.headers.set('Access-Control-Allow-Headers', req.headers.get('access-control-request-headers') ?? 'Content-Type');
		res.headers.set('Access-Control-Allow-Credentials', 'true');
		return res;
	}

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

import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function DELETE() {
	return NextResponse.json(
		{ error: 'deletion_disabled' },
		{
			status: 405,
			headers: {
				Allow: 'GET, POST',
			},
		},
	);
}

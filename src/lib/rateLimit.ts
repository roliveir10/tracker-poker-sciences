import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import type { NextRequest } from 'next/server';

const redis = process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
	? new Redis({ url: process.env.UPSTASH_REDIS_REST_URL, token: process.env.UPSTASH_REDIS_REST_TOKEN })
	: null;

const limiter = redis ? new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(10, '1 m') }) : null;

export async function rateLimit(req: NextRequest, keyPrefix: string): Promise<{ allowed: boolean }>{
	if (!limiter) return { allowed: true };
	const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || '127.0.0.1';
	const key = `${keyPrefix}:${ip}`;
	const res = await limiter.limit(key);
	return { allowed: res.success };
}


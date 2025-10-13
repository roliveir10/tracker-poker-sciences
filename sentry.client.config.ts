import * as Sentry from "@sentry/nextjs";

Sentry.init({
	dsn: process.env.SENTRY_DSN || undefined,
	tracesSampleRate: 0.1,
	replaysSessionSampleRate: 0.0,
	replaysOnErrorSampleRate: 1.0,
});


import { Client } from '@upstash/qstash';

const trimmedToken = (process.env.QSTASH_TOKEN ?? '').trim();
const client = trimmedToken.length > 0 ? new Client({ token: trimmedToken }) : null;

const trimmedCurrentKey = (process.env.QSTASH_CURRENT_SIGNING_KEY ?? '').trim();
const trimmedNextKey = (process.env.QSTASH_NEXT_SIGNING_KEY ?? '').trim();

type PublishResult = {
  queued: boolean;
  url: string;
  reason?: string;
};

function normalizeBaseUrl(url: string): string {
  if (!url) return url;
  return url.replace(/\/+$/, '');
}

function resolveBaseUrl(): string {
  const candidates = [
    process.env.QSTASH_BASE_URL,
    process.env.NEXTAUTH_URL,
    process.env.APP_BASE_URL,
    process.env.PUBLIC_BASE_URL,
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined,
    process.env.URL,
  ];

  for (const candidate of candidates) {
    const trimmed = (candidate ?? '').trim();
    if (trimmed.length > 0) {
      return normalizeBaseUrl(trimmed);
    }
  }

  const port = process.env.PORT ?? '3000';
  return normalizeBaseUrl(`http://localhost:${port}`);
}

export function isQStashConfigured(): boolean {
  return Boolean(client && trimmedCurrentKey.length > 0 && trimmedNextKey.length > 0);
}

export async function publishParseJob(params: {
  importId: string;
  body: Record<string, unknown>;
}): Promise<PublishResult> {
  const baseUrl = resolveBaseUrl();
  const { importId, body } = params;
  const url = `${baseUrl}/api/imports/${importId}/parse`;

  if (!client) {
    return { queued: false, url, reason: 'missing_qstash_token' };
  }

  try {
    await client.publishJSON({
      url,
      body,
      retries: 3,
      timeout: 120,
      label: 'parse-import',
    });
    return { queued: true, url };
  } catch (err: unknown) {
    const reason = err instanceof Error ? err.message : String(err);
    console.error('[qstash] failed to publish parse job', { importId, url, error: reason });
    return { queued: false, url, reason };
  }
}




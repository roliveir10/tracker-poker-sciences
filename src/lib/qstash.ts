import { Client } from '@upstash/qstash';

const qstashToken = process.env.QSTASH_TOKEN;

let client: Client | null = null;
if (qstashToken) {
  client = new Client({ token: qstashToken });
}

export async function publishParseJob(params: {
  baseUrl: string;
  importId: string;
  body: Record<string, unknown>;
}): Promise<{ queued: boolean }>{
  const { baseUrl, importId, body } = params;
  const url = `${baseUrl}/api/imports/${importId}/parse`;

  if (!client) {
    // Dev fallback: do nothing; parse endpoint will be invoked manually or next step.
    return { queued: false };
  }

  await client.publishJSON({ url, body });
  return { queued: true };
}




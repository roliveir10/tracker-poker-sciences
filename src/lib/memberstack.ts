type MemberstackMember = {
  id?: string;
  email?: string;
  fullName?: string;
  data?: Record<string, unknown> & { email?: string; fullName?: string };
};

const DEFAULT_BASE = 'https://api.memberstack.com/v2';

export async function fetchMemberstackMember(memberId: string): Promise<MemberstackMember> {
  const apiKey = process.env.MEMBERSTACK_API_KEY;
  const baseUrl = process.env.MEMBERSTACK_API_BASE || DEFAULT_BASE;

  if (!apiKey) {
    const allowDevFallback = process.env.DEV_FALLBACK === '1' || process.env.NODE_ENV !== 'production';
    if (!allowDevFallback) {
      throw new Error('MEMBERSTACK_API_KEY is not set');
    }
    // Dev seulement: renvoie un membre minimal. N’activez pas en prod.
    return { id: memberId, email: `dev+${memberId}@example.com`, fullName: 'Dev Member' };
  }

  const url = `${baseUrl.replace(/\/$/, '')}/members/${encodeURIComponent(memberId)}`;
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    // Ne pas envoyer de cookies cross-site
    credentials: 'omit',
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Memberstack fetch failed: ${res.status} ${text}`);
  }
  const json = (await res.json()) as unknown as MemberstackMember;
  return json;
}



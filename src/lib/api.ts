const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_FUNCTIONS_URL = import.meta.env.VITE_SUPABASE_FUNCTIONS_URL;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY ?? import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!SUPABASE_URL || !SUPABASE_FUNCTIONS_URL || !SUPABASE_PUBLISHABLE_KEY) {
  console.warn('[api] Missing Supabase environment variables.');
}

const FUNCTIONS_BASE = SUPABASE_FUNCTIONS_URL?.replace(/\/$/, '') ?? '';
const REST_BASE = SUPABASE_URL?.replace(/\/$/, '') ?? '';

export interface ApiOptions {
  token?: string | null;
  headers?: Record<string, string>;
  useAnonAuth?: boolean;
}

export const callFunction = async <T = unknown>(
  name: string,
  payload: unknown,
  options: ApiOptions = {}
): Promise<T> => {
  const url = `${FUNCTIONS_BASE}/${name}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  const useAnonAuth = options.useAnonAuth ?? true;

  if (SUPABASE_PUBLISHABLE_KEY) {
    headers['apikey'] = SUPABASE_PUBLISHABLE_KEY;
  }

  // Authorization strategy for Edge Functions:
  // - If explicitly not anon and token provided -> use user token
  // - Else -> use anon key
  if (useAnonAuth === false && options.token) {
    headers['Authorization'] = `Bearer ${options.token}`;
  } else if (SUPABASE_PUBLISHABLE_KEY) {
    headers['Authorization'] = `Bearer ${SUPABASE_PUBLISHABLE_KEY}`;
  }

  if (options.token) {
    headers['x-gcae-auth'] = options.token;
  }

  if (options.headers) {
    Object.assign(headers, options.headers);
  }

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload ?? {}),
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const message = (data && (data.error || data.message)) || response.statusText;
    throw new Error(message || 'Request failed');
  }

  return data as T;
};

export const decodeJwt = <T = unknown>(token: string): T | null => {
  try {
    const [, payload] = token.split('.');
    if (!payload) return null;

    const paddedPayload = payload.padEnd(payload.length + (4 - (payload.length % 4)) % 4, '=');
    const decoded = atob(paddedPayload.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(decoded) as T;
  } catch (error) {
    console.error('Failed to decode JWT', error);
    return null;
  }
};

export const fetchProfileByUserId = async <T = unknown>(
  token: string,
  userId: string
): Promise<T | null> => {
  if (!REST_BASE) throw new Error('Missing SUPABASE_URL');

  const params = new URLSearchParams({ select: '*', user_id: `eq.${userId}` });
  const response = await fetch(`${REST_BASE}/rest/v1/profiles?${params.toString()}`, {
    headers: {
      apikey: SUPABASE_PUBLISHABLE_KEY ?? '',
      Authorization: `Bearer ${token}`,
    },
  });

  if (response.status === 401 || response.status === 403) {
    throw new Error('Unauthorized');
  }

  if (!response.ok) {
    throw new Error(`Failed to fetch profile (${response.status})`);
  }

  const data = await response.json();
  if (!Array.isArray(data) || data.length === 0) {
    return null;
  }

  return data[0] as T;
};

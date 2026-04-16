export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export type ApiError = {
  message: string;
  status?: number;
  details?: unknown;
};

type RequestOptions = {
  method: HttpMethod;
  path: string;
  baseUrl: string;
  headers?: Record<string, string>;
  body?: unknown;
  timeoutMs?: number;
};

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number) {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject({ message: 'Request timed out' } satisfies ApiError);
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

export async function requestJson<T>({
  method,
  path,
  baseUrl,
  headers,
  body,
  timeoutMs = 15000,
}: RequestOptions): Promise<T> {
  const url = `${baseUrl.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;

  const res = await withTimeout(
    fetch(url, {
      method,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...(headers ?? {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
    timeoutMs,
  );

  const contentType = res.headers.get('content-type') ?? '';
  const isJson = contentType.includes('application/json');
  const payload = isJson ? await res.json().catch(() => null) : await res.text();

  if (!res.ok) {
    const message =
      (payload && typeof payload === 'object' && 'error' in payload
        ? String((payload as any).error)
        : undefined) ?? `Request failed (${res.status})`;

    throw { message, status: res.status, details: payload } satisfies ApiError;
  }

  return payload as T;
}


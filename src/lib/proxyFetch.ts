import { ProxyAgent, fetch as undiciFetch } from "undici";

let cachedAgent: ProxyAgent | null = null;
let cachedProxyUrl: string | null = null;

function readBrightDataProxyUrl(): string | null {
  const direct = process.env.BRIGHTDATA_PROXY_URL?.trim();
  if (direct) return direct;

  const host = process.env.BRIGHTDATA_PROXY_HOST?.trim();
  const user = process.env.BRIGHTDATA_PROXY_USER?.trim();
  const password = process.env.BRIGHTDATA_PROXY_PASSWORD?.trim();
  if (!host || !user || !password) return null;

  const port = process.env.BRIGHTDATA_PROXY_PORT?.trim() || "33335";
  const encodedUser = encodeURIComponent(user);
  const encodedPassword = encodeURIComponent(password);
  return `http://${encodedUser}:${encodedPassword}@${host}:${port}`;
}

function getProxyAgent(proxyUrl: string): ProxyAgent {
  if (cachedAgent && cachedProxyUrl === proxyUrl) return cachedAgent;
  cachedAgent = new ProxyAgent(proxyUrl);
  cachedProxyUrl = proxyUrl;
  return cachedAgent;
}

/**
 * Fetch que enruta por Bright Data (u otro proxy HTTP) cuando hay
 * BRIGHTDATA_PROXY_URL o BRIGHTDATA_PROXY_HOST/USER/PASSWORD en env.
 */
export function createProxyFetch(baseFetch: typeof fetch = fetch): typeof fetch {
  const proxyUrl = readBrightDataProxyUrl();
  if (!proxyUrl) return baseFetch;

  const agent = getProxyAgent(proxyUrl);

  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    const response = await undiciFetch(input as Parameters<typeof undiciFetch>[0], {
      ...init,
      dispatcher: agent,
    } as Parameters<typeof undiciFetch>[1]);
    return response as unknown as Response;
  }) as typeof fetch;
}

/** fetch con proxy si está configurado; si no, el fetch pasado o global. */
export function resolveProxyFetch(customFetch?: typeof fetch): typeof fetch {
  return createProxyFetch(customFetch ?? fetch);
}

export function isProxyFetchEnabled(): boolean {
  return readBrightDataProxyUrl() !== null;
}

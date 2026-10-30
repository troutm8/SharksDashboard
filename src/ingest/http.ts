/** Small fetch wrapper: per-host serialization with a minimum gap, retries, timeout. */

type HostState = { chain: Promise<void>; last: number };
const hosts = new Map<string, HostState>();

/** Minimum gap between requests to a host, in ms. The NHL hosts sit behind Cloudflare and have
 * never published a limit; MoneyPuck is one person's server, so be gentle. */
const DEFAULT_GAPS: Record<string, number> = {
  "api-web.nhle.com": 100,
  "api.nhle.com": 100,
  "moneypuck.com": 1000,
};

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export class HttpError extends Error {
  constructor(
    public status: number,
    public url: string,
    public body: string,
  ) {
    super(`HTTP ${status} for ${url}: ${body.slice(0, 200)}`);
  }
}

async function fetchText(url: string, opts: { retries?: number; timeoutMs?: number; minGapMs?: number } = {}): Promise<string> {
  const { retries = 3, timeoutMs = 30_000 } = opts;
  const host = new URL(url).host;
  const gap = opts.minGapMs ?? DEFAULT_GAPS[host] ?? 100;
  const state = hosts.get(host) ?? { chain: Promise.resolve(), last: 0 };
  hosts.set(host, state);

  const run = async (): Promise<string> => {
    let lastErr: unknown;
    for (let attempt = 0; attempt <= retries; attempt++) {
      const wait = state.last + gap - Date.now();
      if (wait > 0) await sleep(wait);
      state.last = Date.now();
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), timeoutMs);
      try {
        // `redirect: "follow"` is the default; the NHL's /now endpoints answer with a 307.
        const res = await fetch(url, {
          signal: ctrl.signal,
          headers: { "user-agent": "sharks-dashboard/0.1 (personal project)", accept: "application/json, text/csv, */*" },
        });
        const text = await res.text();
        if (!res.ok) throw new HttpError(res.status, url, text);
        return text;
      } catch (err) {
        lastErr = err;
        if (err instanceof HttpError && err.status === 404) throw err;
        if (attempt < retries) await sleep(500 * 2 ** attempt);
      } finally {
        clearTimeout(timer);
      }
    }
    throw lastErr;
  };

  const result = state.chain.then(run, run);
  state.chain = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

export async function fetchJson(url: string, opts: { retries?: number; timeoutMs?: number; minGapMs?: number } = {}): Promise<unknown> {
  const text = await fetchText(url, opts);
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Non-JSON response from ${url}: ${text.slice(0, 120)}`);
  }
}

export async function fetchCsv(url: string, opts: { retries?: number; timeoutMs?: number; minGapMs?: number } = {}): Promise<string> {
  return fetchText(url, { timeoutMs: 60_000, ...opts });
}

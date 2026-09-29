const UA = "JetJobBot/0.1 (+https://jetjob.dev/bot; free internship alerts for students)";

/** GET JSON with a timeout and a clear user agent. Returns null on 404 so dead boards are cheap. */
export async function getJson<T>(
  url: string,
  { signal, timeoutMs = 20_000, headers }: { signal?: AbortSignal; timeoutMs?: number; headers?: Record<string, string> } = {},
): Promise<T | null> {
  const timeout = AbortSignal.timeout(timeoutMs);
  const res = await fetch(url, {
    headers: { "user-agent": UA, accept: "application/json", ...headers },
    signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GET ${url} -> ${res.status}`);
  return (await res.json()) as T;
}

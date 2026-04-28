export async function fetchJson<T>(input: string, init?: RequestInit & { timeoutMs?: number }): Promise<Response> {
  const timeoutMs = init?.timeoutMs ?? 2_000;
  const signal = AbortSignal.timeout(timeoutMs);

  return fetch(input, {
    ...init,
    signal
  });
}

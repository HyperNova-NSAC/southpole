const cache = new Map<string, Promise<unknown>>();

/** Share one in-flight load, and keep a successful result for the rest of the session. */
export function cachedRequest<T>(key: string, load: () => Promise<T | null>): Promise<T | null> {
  const hit = cache.get(key) as Promise<T | null> | undefined;
  if (hit) return hit;
  const pending = load()
    .then((value) => {
      if (value == null) cache.delete(key);
      return value;
    })
    .catch((error: unknown) => {
      cache.delete(key);
      throw error;
    });
  cache.set(key, pending);
  return pending;
}

export function clearRequestCache(): void {
  cache.clear();
}

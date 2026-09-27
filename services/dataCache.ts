// A tiny in-memory cache so screens can show what they already know instantly
// and refresh in the background, instead of blocking on the server every time
// the user switches tabs.
//
//   get(key)        -> { data, at } or undefined
//   set(key, data)  -> store fresh data
//   markStale(...)  -> keep the data for display but force the next screen to refetch
//   clear()         -> forget everything (sign-out, switching accounts)
type Entry = { data: unknown; at: number };

const entries = new Map<string, Entry>();

export const dataCache = {
  get<T>(key: string): { data: T; at: number } | undefined {
    const entry = entries.get(key);
    return entry ? { data: entry.data as T, at: entry.at } : undefined;
  },

  set(key: string, data: unknown) {
    entries.set(key, { data, at: Date.now() });
  },

  isFresh(key: string, maxAgeMs: number) {
    const entry = entries.get(key);
    return Boolean(entry && Date.now() - entry.at < maxAgeMs);
  },

  // Called after anything that changes the data (add, edit, delete, purchase…).
  markStale(...keys: string[]) {
    for (const key of keys) {
      const entry = entries.get(key);
      if (entry) entries.set(key, { data: entry.data, at: 0 });
    }
  },

  clear() {
    entries.clear();
  },
};

// How long cached data counts as up to date before a screen refetches on focus.
export const FRESH_MS = 30_000;

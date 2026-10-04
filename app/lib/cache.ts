// 간단한 인메모리 캐시 (서버리스 인스턴스별)
const store = new Map<string, { t: number; v: any }>();

export function getCache<T>(key: string, ttlMs: number): T | null {
  const e = store.get(key);
  if (e && Date.now() - e.t < ttlMs) return e.v as T;
  return null;
}

export function setCache(key: string, v: any) {
  store.set(key, { t: Date.now(), v });
  if (store.size > 100) {
    const first = store.keys().next().value;
    if (first) store.delete(first);
  }
}

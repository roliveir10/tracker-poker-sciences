/*
  IndexedDB cache for EV computations on the client.
*/

export type EvCacheEntry = {
  realized: number | null;
  adjusted: number | null;
  samples: number;
  updatedAt: number; // epoch ms
  version: 1;
};

const DB_NAME = 'ev-cache-db';
const DB_VERSION = 1;
const STORE = 'evCache';

export function isEvCacheAvailable(): boolean {
  return typeof window !== 'undefined' && 'indexedDB' in window;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function evCacheGetMany(ids: string[]): Promise<Map<string, EvCacheEntry>> {
  const out = new Map<string, EvCacheEntry>();
  if (!isEvCacheAvailable() || ids.length === 0) return out;
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const store = tx.objectStore(STORE);
      let remaining = ids.length;
      for (const id of ids) {
        const req = store.get(id);
        req.onsuccess = () => {
          const val = req.result as (EvCacheEntry & { id: string }) | undefined;
          if (val && val.version === 1) out.set(id, { realized: val.realized, adjusted: val.adjusted, samples: val.samples, updatedAt: val.updatedAt, version: 1 });
          if (--remaining === 0) resolve();
        };
        req.onerror = () => {
          if (--remaining === 0) resolve();
        };
      }
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
  return out;
}

export async function evCacheSetMany(entries: Array<{ id: string; value: EvCacheEntry }>): Promise<void> {
  if (!isEvCacheAvailable() || entries.length === 0) return;
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      const store = tx.objectStore(STORE);
      for (const { id, value } of entries) {
        store.put({ id, ...value });
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

export async function evCacheDelete(id: string): Promise<void> {
  if (!isEvCacheAvailable()) return;
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      const store = tx.objectStore(STORE);
      store.delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}



// Favorites and search history on the device. Storage failures never break the screen (see F03-E1, F03-E2).
import AsyncStorage from '@react-native-async-storage/async-storage';
import { addToCompare } from './logic/compare.ts';

async function readList(key: string): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(key);
    const v = raw ? JSON.parse(raw) : [];
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}
async function writeList(key: string, list: string[]): Promise<void> {
  try { await AsyncStorage.setItem(key, JSON.stringify(list)); } catch { /* keep going without saving */ }
}

export const favorites = {
  list: () => readList('favs'),
  async has(id: string) { return (await readList('favs')).includes(id); },
  async toggle(id: string): Promise<boolean> {
    const list = await readList('favs');
    const on = !list.includes(id);
    await writeList('favs', on ? [id, ...list] : list.filter(x => x !== id));
    return on;
  },
};

// Paid history reports stay on the device (the user paid for them), plus a purchase waiting for its report
// (bought, but the server failed): it is retried without paying again.
export interface SavedReport { plate: string; savedAt: string; report: unknown }
async function readJson<T>(key: string, fallback: T): Promise<T> {
  try { const raw = await AsyncStorage.getItem(key); return raw ? (JSON.parse(raw) as T) : fallback; } catch { return fallback; }
}
async function writeJson(key: string, value: unknown) { try { await AsyncStorage.setItem(key, JSON.stringify(value)); } catch { /* keep going */ } }
export const reports = {
  list: () => readJson<SavedReport[]>('reports', []),
  async save(r: SavedReport) { const all = (await reports.list()).filter(x => x.plate !== r.plate); await writeJson('reports', [r, ...all].slice(0, 50)); },
};
export const pendingPurchase = {
  get: () => readJson<{ plate: string; transactionId: string } | null>('pending_history', null),
  set: (p: { plate: string; transactionId: string } | null) => writeJson('pending_history', p),
};

// vehicles picked for the comparison screen (up to 3, see src/logic/compare.ts)
export const compareList = {
  list: () => readList('compare'),
  async add(id: string) { await writeList('compare', addToCompare(await readList('compare'), id)); },
  async remove(id: string) { await writeList('compare', (await readList('compare')).filter(x => x !== id)); },
};

export const history = {
  list: () => readList('hist'),
  async add(id: string) {
    const list = (await readList('hist')).filter(x => x !== id);
    await writeList('hist', [id, ...list].slice(0, 30));
  },
};

// Random id for this install, created on first use. Sent only with plate lookups so the server can apply the
// per-device daily limit. Not linked to a person; reinstalling the app creates a new one.
let installIdCache: string | null = null;
export async function installId(): Promise<string> {
  if (installIdCache) return installIdCache;
  try {
    const saved = await AsyncStorage.getItem('install_id');
    if (saved && /^[0-9a-f-]{36}$/.test(saved)) return (installIdCache = saved);
  } catch { /* fall through and create one */ }
  const id = randomUuid();
  installIdCache = id;
  try { await AsyncStorage.setItem('install_id', id); } catch { /* keep it for this session */ }
  return id;
}

function randomUuid(): string {
  const c = globalThis.crypto as Crypto | undefined;
  if (c?.randomUUID) return c.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, ch => {
    const r = (Math.random() * 16) | 0;
    return (ch === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

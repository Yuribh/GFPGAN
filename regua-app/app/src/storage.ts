// Favorites and search history on the device. Storage failures never break the screen (see F03-E1, F03-E2).
import AsyncStorage from '@react-native-async-storage/async-storage';

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

export const history = {
  list: () => readList('hist'),
  async add(id: string) {
    const list = (await readList('hist')).filter(x => x !== id);
    await writeList('hist', [id, ...list].slice(0, 30));
  },
};

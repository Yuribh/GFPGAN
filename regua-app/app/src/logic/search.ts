/** Accent-, case- and space-insensitive text for searching ("Automático " -> "automatico"). BUG-002. */
export function fold(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLocaleLowerCase('pt-BR').trim();
}
export function filterByLabel<T>(items: T[], query: string, label: (t: T) => string): T[] {
  const q = fold(query);
  return q ? items.filter(i => fold(label(i)).includes(q)) : items;
}
/** Cut a query before showing it back to the user (BUG-004). */
export function shortQuery(q: string, max = 40): string {
  const t = q.trim();
  return t.length > max ? t.slice(0, max) + '…' : t;
}

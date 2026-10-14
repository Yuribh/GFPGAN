const MONTHS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

/** 4567890 -> "R$ 45.678,90" (cents in, no floating point math on money) */
export function formatBRL(cents: number): string {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(Math.round(cents));
  const reais = Math.floor(abs / 100).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const rest = (abs % 100).toString().padStart(2, '0');
  return `${sign}R$ ${reais},${rest}`;
}

/** "2026-10" -> "outubro de 2026" */
export function formatMonth(ref: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(ref);
  if (!m) throw new Error(`bad reference month: ${ref}`);
  const idx = Number(m[2]) - 1;
  if (idx < 0 || idx > 11) throw new Error(`bad reference month: ${ref}`);
  return `${MONTHS[idx]} de ${m[1]}`;
}

/** 32000 means zero km in the FIPE catalog */
export function formatModelYear(year: number): string {
  return year === 32000 ? '0 km' : String(year);
}

/** 3.2 -> "+3,2%" / -1.05 -> "-1,1%" / 0 -> "0,0%"  (arrow and sign, never colour alone) */
export function formatPercent(p: number): string {
  // round the magnitude, so +1.05 and -1.05 are treated the same (Math.round rounds -10.5 toward zero)
  const magnitude = Math.round(Math.abs(p) * 10) / 10;
  const text = magnitude.toFixed(1).replace('.', ',');
  if (magnitude === 0) return `${text}%`;
  return `${p > 0 ? '+' : '-'}${text}%`;
}

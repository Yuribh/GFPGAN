// Sale card helpers: read the asking price the seller types and say how it compares with the FIPE price.
import { formatPercent } from '../format.ts';

/** "45.900" / "45900,50" / "R$ 45.900" -> cents; null when empty or not a price. Brazilian separators. */
export function parseBRLInput(input: string): number | null {
  const t = input.replace(/R\$|\s/g, '');
  if (!t) return null;
  if (!/^\d{1,3}(\.\d{3})*(,\d{1,2})?$|^\d+(,\d{1,2})?$/.test(t)) return null;
  const [int, dec = ''] = t.replace(/\./g, '').split(',');
  const cents = Number(int) * 100 + Number(dec.padEnd(2, '0'));
  return cents > 0 ? cents : null;
}

/** Live mask for the price field: digits only, thousands with dots ("45900" -> "45.900"). */
export function maskBRLInput(input: string): string {
  const d = input.replace(/\D/g, '').replace(/^0+/, '').slice(0, 9);
  return d.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/** "45000" -> "45.000 km"; empty when not a number. */
export function formatKm(input: string): string {
  const d = input.replace(/\D/g, '').slice(0, 7);
  return d ? `${d.replace(/\B(?=(\d{3})+(?!\d))/g, '.')} km` : '';
}

/** "3,2% abaixo da FIPE" / "1,0% acima da FIPE" / "no preço da FIPE". */
export function versusFipe(askingCents: number, fipeCents: number): string {
  if (fipeCents <= 0) return '';
  const p = ((askingCents - fipeCents) / fipeCents) * 100;
  const text = formatPercent(Math.abs(p)).replace(/^\+/, '');
  if (text === '0,0%') return 'no preço da FIPE';
  return `${text} ${p < 0 ? 'abaixo' : 'acima'} da FIPE`;
}

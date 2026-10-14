import { View, Text } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import type { PricePoint } from '../data/types.ts';
import { formatBRL, formatMonth, formatPercent } from '../format.ts';
import { c, s, font } from '../theme.ts';

/** Monthly line chart with a text summary for screen readers (F02-E2). One month shows a note instead (F02-E1). */
export function PriceChart({ points, months, width }: { points: PricePoint[]; months: number; width: number }) {
  const pts = points.slice(-months);
  if (pts.length === 0) return null;
  if (pts.length < 2) {
    return <Text style={{ color: c.muted, fontSize: font.sm.fontSize }}>Só há um mês de dados para este veículo. O gráfico aparece quando houver mais meses.</Text>;
  }
  const H = 140, pad = 8, W = Math.max(width, 120);
  const ys = pts.map(p => p.priceCents);
  const min = Math.min(...ys), max = Math.max(...ys), span = max - min || 1;
  const xy = pts.map((p, i) => [pad + (i * (W - 2 * pad)) / (pts.length - 1), pad + (1 - (p.priceCents - min) / span) * (H - 2 * pad)]);
  const d = xy.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const first = pts[0], last = pts[pts.length - 1];
  const pct = first.priceCents > 0 ? ((last.priceCents - first.priceCents) / first.priceCents) * 100 : null;
  const summary = `${formatMonth(first.referenceMonth)}: ${formatBRL(first.priceCents)} → ${formatMonth(last.referenceMonth)}: ${formatBRL(last.priceCents)}${pct === null ? '' : ` (${formatPercent(pct)})`}`;
  const [lx, ly] = xy[xy.length - 1];
  return (
    <View accessible accessibilityLabel={`Evolução do preço. ${summary}`}>
      <Svg width={W} height={H}>
        <Path d={`M${pad},${H - pad}H${W - pad}`} stroke={c.border} strokeWidth={1} />
        <Path d={d} fill="none" stroke={c.accent} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        <Circle cx={lx} cy={ly} r={4} fill={c.accent} />
      </Svg>
      <Text style={{ color: c.muted, fontSize: font.sm.fontSize, lineHeight: font.sm.lineHeight, marginTop: s[2] }}>{summary}</Text>
    </View>
  );
}

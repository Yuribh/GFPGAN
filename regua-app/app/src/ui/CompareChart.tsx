// Price change of each vehicle since the first common month, as %: vehicles with very different prices fit one chart.
import { Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import type { VehicleResult } from '../data/types.ts';
import { formatModelYear, formatMonth, formatPercent } from '../format.ts';
import { c, s, font } from '../theme.ts';

// accent, blue, dark grey; the lines also differ by dash pattern so color is never the only cue
export const SERIES = [
  { color: c.accent, dash: undefined, label: 'linha cheia' },
  { color: '#1d5f8f', dash: '8 5', label: 'linha tracejada' },
  { color: '#3d4450', dash: '2 4', label: 'linha pontilhada' },
];

export function CompareChart({ vehicles, width }: { vehicles: VehicleResult[]; width: number }) {
  const months = vehicles.map(v => new Set(v.history.slice(-12).map(p => p.referenceMonth)));
  const common = [...months[0] ?? []].filter(m => months.every(set => set.has(m))).sort();
  if (vehicles.length < 2 || common.length < 2) {
    return <Text style={{ color: c.muted, fontSize: font.sm.fontSize }}>O gráfico aparece quando os veículos têm pelo menos dois meses de tabela em comum.</Text>;
  }
  const series = vehicles.map(v => {
    const byMonth = new Map(v.history.map(p => [p.referenceMonth, p.priceCents]));
    const base = byMonth.get(common[0])!;
    return common.map(m => ((byMonth.get(m)! - base) / base) * 100);
  });
  const all = series.flat(), min = Math.min(0, ...all), max = Math.max(0, ...all), span = max - min || 1;
  const H = 160, pad = 8, W = Math.max(width, 160);
  const y = (p: number) => pad + (1 - (p - min) / span) * (H - 2 * pad);
  const x = (i: number) => pad + (i * (W - 2 * pad)) / (common.length - 1);
  const summary = vehicles.map((v, i) => `${v.model.name}: ${formatPercent(series[i][series[i].length - 1])}`).join('; ');
  return (
    <View accessible accessibilityLabel={`Variação desde ${formatMonth(common[0])}. ${summary}`}>
      <Svg width={W} height={H}>
        <Path d={`M${pad},${y(0)}H${W - pad}`} stroke={c.border} strokeWidth={1} />
        {series.map((pts, k) => (
          <Path key={k} d={pts.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p).toFixed(1)}`).join(' ')}
            fill="none" stroke={SERIES[k].color} strokeWidth={2.5} strokeDasharray={SERIES[k].dash} strokeLinecap="round" strokeLinejoin="round" />
        ))}
      </Svg>
      <View style={{ gap: s[1], marginTop: s[2] }}>
        {vehicles.map((v, k) => (
          <View key={v.year.id} style={{ flexDirection: 'row', alignItems: 'center', gap: s[2] }}>
            <Svg width={28} height={10}><Path d="M2,5H26" stroke={SERIES[k].color} strokeWidth={2.5} strokeDasharray={SERIES[k].dash} strokeLinecap="round" /></Svg>
            <Text style={{ flex: 1, color: c.text, fontSize: font.sm.fontSize }} numberOfLines={1}>{v.model.name} {formatModelYear(v.year.modelYear)}</Text>
            <Text style={{ color: c.text, fontSize: font.sm.fontSize, fontWeight: '600' }}>{formatPercent(series[k][series[k].length - 1])}</Text>
          </View>
        ))}
      </View>
      <Text style={{ color: c.muted, fontSize: font.sm.fontSize, lineHeight: font.sm.lineHeight, marginTop: s[2] }}>
        Variação desde {formatMonth(common[0])} (0% = preço daquele mês).
      </Text>
    </View>
  );
}

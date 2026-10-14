// Comparar preços: up to 3 vehicles side by side, cheapest marked, change over the month and the year.
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { repo, usingSampleData } from '../src/data/index.ts';
import type { VehicleResult } from '../src/data/types.ts';
import { formatBRL, formatModelYear, formatPercent } from '../src/format.ts';
import { MAX_COMPARE, compareRows } from '../src/logic/compare.ts';
import { compareList } from '../src/storage.ts';
import { Button, Header, Loading, Message, st as kit } from '../src/ui/kit.tsx';
import { CompareChart, SERIES } from '../src/ui/CompareChart.tsx';
import { c, card, r, s, font, layout } from '../src/theme.ts';

export default function Compare() {
  const [list, setList] = useState<VehicleResult[] | null>(null);
  const [failed, setFailed] = useState(false);
  const { width } = useWindowDimensions();

  const load = useCallback(() => {
    let alive = true;
    (async () => {
      setFailed(false);
      try {
        const found = await Promise.all((await compareList.list()).map(id => repo.getVehicle(id)));
        if (alive) setList(found.filter((v): v is VehicleResult => v !== null));
      } catch { if (alive) setFailed(true); }
    })();
    return () => { alive = false; };
  }, []);
  useFocusEffect(load);

  const remove = async (id: string) => { await compareList.remove(id); setList(l => l?.filter(v => v.year.id !== id) ?? null); };
  const add = <Button icon="plus" label="Adicionar veículo" onPress={() => router.push({ pathname: '/choose', params: { then: 'compare' } })} />;

  let body;
  if (failed) body = <Message tone="error" title="Não deu para carregar a comparação." detail="Confira sua conexão e tente outra vez." actionLabel="Tentar outra vez" onAction={load} />;
  else if (!list) body = <Loading />;
  else if (!list.length) body = <View style={{ gap: s[3] }}><Message title="Compare até 3 veículos." detail="Escolha os veículos para ver o preço lado a lado e como cada um variou." />{add}</View>;
  else {
    const rows = compareRows(list);
    body = (
      <View style={{ gap: s[3] }}>
        {list.map((v, i) => {
          const row = rows[i];
          return (
            <View key={v.year.id} style={[card, st.item, row.cheapest && { borderColor: c.accent }]}>
              <View style={st.itemHead}>
                <View style={[st.swatch, { backgroundColor: SERIES[i].color }]} accessibilityLabel={`Cor no gráfico: ${SERIES[i].label}`} />
                <Pressable style={{ flex: 1 }} accessibilityRole="button" onPress={() => router.push(`/vehicle/${encodeURIComponent(v.year.id)}`)}>
                  <Text style={kit.muted}>{v.brand.name}</Text>
                  <Text style={st.model}>{v.model.name}</Text>
                  <Text style={kit.muted}>{formatModelYear(v.year.modelYear)} · {v.year.fuel}</Text>
                </Pressable>
                <Pressable onPress={() => remove(v.year.id)} hitSlop={8} accessibilityRole="button" accessibilityLabel={`Tirar ${v.model.name} da comparação`} style={st.remove}>
                  <Feather name="x" size={20} color={c.muted} />
                </Pressable>
              </View>
              <Text style={st.price}>{formatBRL(row.priceCents)}</Text>
              <Text style={[st.badge, row.cheapest ? st.badgeOn : null]}>
                {row.cheapest ? 'Mais barato' : list.length > 1 ? `${formatBRL(row.overCheapestCents)} a mais que o mais barato` : 'Adicione outro para comparar'}
              </Text>
              <View style={st.metrics}>
                <Metric label="No mês" value={row.monthPercent === null ? '—' : formatPercent(row.monthPercent)} />
                <Metric label="Em 12 meses" value={row.yearPercent === null ? '—' : formatPercent(row.yearPercent)} />
                <Metric label="FIPE" value={v.year.fipeCode} />
              </View>
            </View>
          );
        })}
        {list.length < MAX_COMPARE ? add : <Text style={kit.muted}>Para trocar um veículo, tire um da lista.</Text>}
        {list.length > 1 ? (
          <View style={[card, { padding: s[4], marginTop: s[2] }]}>
            <Text style={[st.model, { marginBottom: s[3] }]}>Como os preços mudaram</Text>
            <CompareChart vehicles={list} width={width - 2 * layout['screen-gutter'] - 2 * s[4]} />
          </View>
        ) : null}
        {usingSampleData ? <Text style={kit.muted}>Dados de exemplo, não são valores reais da tabela FIPE.</Text> : null}
      </View>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
      <Header title="Comparar preços" back />
      <ScrollView contentContainerStyle={{ padding: layout['screen-gutter'], paddingTop: 0, paddingBottom: s[7] }}>{body}</ScrollView>
    </SafeAreaView>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <View style={{ flex: 1 }}><Text style={kit.muted}>{label}</Text><Text style={st.metric}>{value}</Text></View>;
}

const st = StyleSheet.create({
  item: { padding: s[4], gap: s[1], borderWidth: 2, borderColor: 'transparent' },
  itemHead: { flexDirection: 'row', alignItems: 'flex-start', gap: s[3] },
  swatch: { width: 6, alignSelf: 'stretch', borderRadius: r.pill },
  model: { color: c.text, fontSize: font.base.fontSize, lineHeight: font.base.lineHeight, fontWeight: '600' },
  remove: { minWidth: layout['min-touch-target'], minHeight: layout['min-touch-target'], alignItems: 'center', justifyContent: 'center', marginTop: -s[2], marginRight: -s[2] },
  price: { color: c.text, fontSize: font.xl.fontSize, lineHeight: font.xl.lineHeight, fontWeight: '700', marginTop: s[2] },
  badge: { alignSelf: 'flex-start', color: c.muted, fontSize: font.sm.fontSize, backgroundColor: c.surfaceMuted, borderRadius: r.pill, paddingHorizontal: s[2], paddingVertical: 2, overflow: 'hidden' },
  badgeOn: { color: c.onAccent, backgroundColor: c.accent, fontWeight: '600' },
  metrics: { flexDirection: 'row', gap: s[3], marginTop: s[3] },
  metric: { color: c.text, fontSize: font.sm.fontSize, fontWeight: '600' },
});

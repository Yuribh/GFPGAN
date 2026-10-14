// S05 + S06: price, reference month, FIPE code, change vs last month, favorite, share, chart.
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, Share, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { repo, usingSampleData } from '../../src/data/index.ts';
import type { VehicleResult } from '../../src/data/types.ts';
import { formatBRL, formatModelYear, formatMonth, formatPercent } from '../../src/format.ts';
import { favorites, history } from '../../src/storage.ts';
import { Button, Header, Loading, Message } from '../../src/ui/kit.tsx';
import { PriceChart } from '../../src/ui/PriceChart.tsx';
import { c, card, r, s, font, layout } from '../../src/theme.ts';

const TYPE_LABEL = { cars: 'Carros', motorcycles: 'Motos', trucks: 'Caminhões' } as const;

export default function Vehicle() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [state, setState] = useState<{ status: 'loading' } | { status: 'error' } | { status: 'ready'; v: VehicleResult | null }>({ status: 'loading' });
  const [fav, setFav] = useState(false);
  const [months, setMonths] = useState(12);
  const toggling = useRef(false);
  const { width } = useWindowDimensions();

  const load = useCallback(async () => {
    setState({ status: 'loading' });
    try {
      const v = await repo.getVehicle(String(id));
      setState({ status: 'ready', v });
      if (v) { history.add(v.year.id); setFav(await favorites.has(v.year.id)); }
    } catch {
      setState({ status: 'error' });
    }
  }, [id]);
  useEffect(() => { load(); }, [load]);

  if (state.status === 'loading') return <Screen><Loading label="Carregando o preço" /></Screen>;
  if (state.status === 'error') return <Screen><Message tone="error" title="Não deu para carregar o preço." detail="Confira sua conexão e tente outra vez." actionLabel="Tentar outra vez" onAction={load} /></Screen>;
  const v = state.v;
  if (!v) return <Screen><Message title="Não há preço para este ano nesta tabela." /></Screen>;

  const ch = v.change;
  const arrow = !ch ? '' : ch.cents > 0 ? '▲' : ch.cents < 0 ? '▼' : '■';
  const shareText = `${v.brand.name} ${v.model.name} ${formatModelYear(v.year.modelYear)}: ${formatBRL(v.latest.priceCents)} (tabela de ${formatMonth(v.latest.referenceMonth)})`;

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: layout['screen-gutter'], paddingBottom: s[7] }}>
        <View style={[card, { padding: s[4] }]}>
          <Text style={st.muted}>{v.brand.name}</Text>
          <Text style={st.model} accessibilityRole="header">{v.model.name}</Text>
          <Text style={st.muted}>{formatModelYear(v.year.modelYear)} · {v.year.fuel}</Text>
          <Text style={st.price} numberOfLines={1} adjustsFontSizeToFit accessibilityLabel={`Preço FIPE ${formatBRL(v.latest.priceCents)}`}>{formatBRL(v.latest.priceCents)}</Text>
          <Text style={st.muted}>Tabela de {formatMonth(v.latest.referenceMonth)}</Text>
          <View style={st.chip} accessible accessibilityLabel={!ch ? 'Primeiro mês de dados'
            : ch.cents === 0 ? 'Sem mudança em relação ao mês anterior'
            : `${ch.cents > 0 ? 'Alta' : 'Queda'} de ${formatPercent(Math.abs(ch.percent)).replace(/^\+/, '')}, ${formatBRL(Math.abs(ch.cents))}, em relação ao mês anterior`}>
            <Text style={st.chipText}>
              {ch ? `${arrow} ${formatPercent(ch.percent)} (${formatBRL(ch.cents)}) vs mês anterior` : 'Primeiro mês de dados'}
            </Text>
          </View>
          <View style={st.meta}><Text style={st.muted}>Código FIPE</Text><Text style={st.metaValue}>{v.year.fipeCode}</Text></View>
          <View style={st.meta}><Text style={st.muted}>Tipo</Text><Text style={st.metaValue}>{TYPE_LABEL[v.brand.vehicleType]}</Text></View>
          <View style={st.actions}>
            <Button variant="secondary" icon="heart" label={fav ? 'Favorito' : 'Favoritar'} pressed={fav}
              onPress={async () => {
                if (toggling.current) return;            // a second tap while saving would undo the first
                toggling.current = true;
                try { setFav(await favorites.toggle(v.year.id)); } finally { toggling.current = false; }
              }} />
            <Button variant="secondary" icon="share" label="Compartilhar" onPress={() => { Share.share({ message: shareText }).catch(() => {}); }} />
          </View>
        </View>

        <Text style={st.h2} accessibilityRole="header">Evolução do preço</Text>
        <View style={[card, { padding: s[4] }]}>
          <View style={st.seg} accessibilityRole="radiogroup" accessibilityLabel="Período">
            {[6, 12].map(m => (
              <Pressable key={m} onPress={() => setMonths(m)} accessibilityRole="radio" accessibilityState={{ checked: months === m }}
                style={[st.segBtn, months === m && st.segOn]}>
                <Text style={[st.segText, months === m && { color: c.onAccent }]}>{m} meses</Text>
              </Pressable>
            ))}
          </View>
          <PriceChart points={v.history} months={months} width={width - 2 * layout['screen-gutter'] - 2 * s[4]} />
        </View>
        {usingSampleData ? <Text style={[st.muted, { marginTop: s[4] }]}>Dados de exemplo, não são valores reais da tabela FIPE.</Text> : null}
      </ScrollView>
    </Screen>
  );
}

function Screen({ children }: { children: ReactNode }) {
  return <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}><Header title="Preço FIPE" back />{children}</SafeAreaView>;
}

const st = StyleSheet.create({
  muted: { color: c.muted, fontSize: font.sm.fontSize, lineHeight: font.sm.lineHeight },
  model: { color: c.text, fontSize: font.lg.fontSize, lineHeight: font.lg.lineHeight, fontWeight: '600', marginVertical: s[1] },
  price: { color: c.text, fontSize: font.display.fontSize, lineHeight: font.display.lineHeight, fontWeight: '700', marginTop: s[2] },
  chip: { alignSelf: 'flex-start', marginTop: s[3], paddingHorizontal: s[2], paddingVertical: s[1], borderRadius: r.pill, backgroundColor: c.surfaceMuted },
  chipText: { color: c.text, fontSize: font.sm.fontSize, fontWeight: '600' },
  meta: { flexDirection: 'row', justifyContent: 'space-between', marginTop: s[2] },
  metaValue: { color: c.text, fontSize: font.sm.fontSize },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: s[2], marginTop: s[4] },
  h2: { color: c.text, fontSize: font.lg.fontSize, fontWeight: '600', marginTop: s[5], marginBottom: s[3] },
  seg: { flexDirection: 'row', alignSelf: 'flex-end', borderWidth: 1, borderColor: c.borderInput, borderRadius: r.pill, overflow: 'hidden', marginBottom: s[3] },
  segBtn: { minHeight: layout['min-touch-target'], paddingHorizontal: s[4], justifyContent: 'center' },
  segOn: { backgroundColor: c.accent },
  segText: { color: c.text, fontSize: font.sm.fontSize, fontWeight: '600' },
});

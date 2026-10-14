// S04: brand -> model -> year, in one screen with steps. Hardware back (Android) goes back one step.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { BackHandler, FlatList, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { repo } from '../src/data/index.ts';
import type { Brand, Model, ModelYear, VehicleType } from '../src/data/types.ts';
import { formatModelYear } from '../src/format.ts';
import { filterByLabel, shortQuery } from '../src/logic/search.ts';
import { createLatest, createTapGuard } from '../src/logic/latest.ts';
import { Header, Loading, Message, Row, st as kit } from '../src/ui/kit.tsx';
import { c, r, s, font, layout } from '../src/theme.ts';

type Item = { id: string; label: string; sub?: string; raw: Brand | Model | ModelYear };
const TYPE_LABEL: Record<VehicleType, string> = { cars: 'Carros', motorcycles: 'Motos', trucks: 'Caminhões' };
const TITLES = ['Escolha a marca', 'Escolha o modelo', 'Escolha o ano'];
const isType = (v: unknown): v is VehicleType => v === 'cars' || v === 'motorcycles' || v === 'trucks';

export default function Pick() {
  const params = useLocalSearchParams<{ type?: string }>();
  const vtype: VehicleType = isType(params.type) ? params.type : 'cars';
  const [step, setStep] = useState(0);
  const [brand, setBrand] = useState<Brand | null>(null);
  const [model, setModel] = useState<Model | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [query, setQuery] = useState('');
  const [latest] = useState(() => createLatest());
  const [guard] = useState(() => createTapGuard());

  const load = useCallback(async () => {
    setStatus('loading'); setQuery('');
    const res = await latest.run(async (): Promise<{ ok: true; items: Item[] } | { ok: false }> => {
      try {
        if (step === 0) return { ok: true, items: (await repo.listBrands(vtype)).map(b => ({ id: b.id, label: b.name, raw: b })) };
        if (step === 1) return { ok: true, items: (await repo.listModels(brand!.id)).map(m => ({ id: m.id, label: m.name, raw: m })) };
        return { ok: true, items: (await repo.listYears(model!.id)).map(y => ({ id: y.id, label: formatModelYear(y.modelYear), sub: y.fuel, raw: y })) };
      } catch {
        return { ok: false };
      }
    });
    if (res.stale) return;                                   // an older request finished late: ignore it, even its errors
    if (!res.value.ok) { setStatus('error'); return; }
    setItems(res.value.items); setStatus('ready');
  }, [step, vtype, brand, model, latest]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => () => latest.cancel(), [latest]);

  const back = useCallback(() => {
    if (step === 0) { if (router.canGoBack()) router.back(); else router.replace('/'); return true; }
    if (step === 2) setModel(null);
    if (step === 1) setBrand(null);
    setStatus('loading');
    setStep(step - 1);
    return true;
  }, [step]);
  // only while this screen is focused: otherwise it would steal the back button from the price screen above it
  useFocusEffect(useCallback(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', back);
    return () => sub.remove();
  }, [back]));

  const pick = (item: Item) => {
    if (!guard.take()) return;                              // double tap (BUG-001)
    if (step === 0) { setStatus('loading'); setBrand(item.raw as Brand); setStep(1); }
    else if (step === 1) { setStatus('loading'); setModel(item.raw as Model); setStep(2); }
    else router.push(`/vehicle/${encodeURIComponent(item.id)}`);
  };

  const visible = useMemo(() => filterByLabel(items, query, i => i.label), [items, query]);
  const parts = [TYPE_LABEL[vtype], brand?.name, model?.name].filter(Boolean);
  const crumbs = parts.join(' › ');

  return (
    <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
      {/* swipe-back would leave the picker from any step; allow it only on the first */}
      <Stack.Screen options={{ gestureEnabled: step === 0 }} />
      <Header title={TITLES[step]} back={back} />
      <View style={st.body}>
        <Text style={st.crumbs} accessibilityLabel={`Etapas: ${parts.join(', ')}`}>{crumbs}</Text>
        {step < 2 && status === 'ready' ? (
          <TextInput value={query} onChangeText={setQuery} placeholder={step === 0 ? 'Buscar marca' : 'Buscar modelo'}
            placeholderTextColor={c.muted} accessibilityLabel="Buscar na lista" autoCorrect={false} autoCapitalize="none"
            style={st.search} returnKeyType="search" />
        ) : null}
        {status === 'loading' ? <Loading /> : status === 'error' ? (
          <Message tone="error" title="Não deu para carregar a lista." detail="Confira sua conexão e tente outra vez."
            actionLabel="Tentar outra vez" onAction={load} />
        ) : visible.length === 0 ? (
          <Message title={query.trim() ? `Nenhum resultado para “${shortQuery(query)}”.` : 'Nenhum item nesta lista.'} />
        ) : (
          <FlatList data={visible} keyExtractor={i => i.id} keyboardShouldPersistTaps="handled"
            style={st.list} ItemSeparatorComponent={() => <View style={kit.sep} />}
            renderItem={({ item }) => <Row title={item.label} subtitle={item.sub} onPress={() => pick(item)} />} />
        )}
      </View>
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  body: { flex: 1, paddingHorizontal: layout['screen-gutter'] },
  crumbs: { color: c.muted, fontSize: font.sm.fontSize, lineHeight: font.sm.lineHeight, marginBottom: s[3] },
  search: { height: 56, borderRadius: r.lg, borderWidth: 1, borderColor: c.borderInput, backgroundColor: c.surface,
    paddingHorizontal: s[4], fontSize: font.base.fontSize, color: c.text, marginBottom: s[3] },
  list: { borderRadius: r.lg, backgroundColor: c.surface, flexGrow: 0 },
});

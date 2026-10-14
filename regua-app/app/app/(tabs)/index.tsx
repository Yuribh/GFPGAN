import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import type { VehicleType } from '../../src/data/types.ts';
import { usingSampleData } from '../../src/data/index.ts';
import { createTapGuard } from '../../src/logic/latest.ts';
import { c, card, r, s, font, layout } from '../../src/theme.ts';
import { AdBanner } from '../../src/services/ads';
import { PlateSearch } from '../../src/ui/PlateSearch.tsx';

const TYPES: { type: VehicleType; label: string; icon: keyof typeof MaterialCommunityIcons.glyphMap }[] = [
  { type: 'trucks', label: 'Caminhões', icon: 'truck-outline' },
  { type: 'motorcycles', label: 'Motos', icon: 'motorbike' },
  { type: 'cars', label: 'Carros', icon: 'car-outline' },
];
const guard = createTapGuard();
const open = (type: VehicleType) => { if (guard.take()) router.push({ pathname: '/pick', params: { type } }); };

export default function Home() {
  return (
    <SafeAreaView style={{ flex: 1 }} edges={['top']}>
      <ScrollView contentContainerStyle={st.page}>
        <Text style={st.brand} accessibilityRole="header">Régua</Text>
        {usingSampleData ? <Text style={st.note}>Dados de exemplo. Configure o Supabase para ver preços reais.</Text> : null}

        <View style={[card, st.findCard]}>
          <Text style={st.h2} accessibilityRole="header">Qual veículo você quer consultar?</Text>
          <View style={st.tiles}>
            {TYPES.map((t, i) => (
              <Pressable key={t.type} onPress={() => open(t.type)} accessibilityRole="button" accessibilityLabel={t.label}
                style={({ pressed }) => [st.tile, i > 0 && st.tileDivider, pressed && { backgroundColor: c.surfaceMuted }]}>
                <MaterialCommunityIcons name={t.icon} size={28} color={c.text} />
                <Text style={st.tileText}>{t.label}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <PlateSearch />

        <Text style={[st.h2, { marginTop: s[5] }]} accessibilityRole="header">Ferramentas</Text>
        <View style={st.tools}>
          <Tool icon="search" label="Buscar veículo" onPress={() => open('cars')} />
          <Tool icon="credit-card" label="Consulta por placa" onPress={() => guard.take() && router.push('/plate')} />
          <Tool icon="bar-chart-2" label="Comparar preços" onPress={() => guard.take() && router.push('/compare')} />
          <Tool icon="clock" label="Histórico" onPress={() => guard.take() && router.push('/history')} />
          <Tool icon="heart" label="Favoritos" onPress={() => router.navigate('/favorites')} />
          <Tool icon="tag" label="Card de venda" onPress={() => guard.take() && router.push({ pathname: '/choose', params: { then: 'card' } })} />
          <Tool icon="file-text" label="Relatório" onPress={() => guard.take() && router.push({ pathname: '/choose', params: { then: 'report' } })} />
        </View>

        {/* one fixed banner on the free plan, never pop-ups; hidden for Régua Plus */}
        <View style={st.ad}><AdBanner /></View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Tool({ icon, label, onPress, disabled }: { icon: keyof typeof Feather.glyphMap; label: string; onPress?: () => void; disabled?: boolean }) {
  // 4 columns; on narrow phones the circle shrinks so neighbours never touch
  const { width } = useWindowDimensions();
  const size = Math.min(layout['tool-tile'], Math.floor((width - 2 * layout['screen-gutter']) / 4) - s[3]);
  return (
    <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button" accessibilityLabel={label}
      accessibilityState={{ disabled }} style={[st.tool, disabled && { opacity: 0.55 }]}>
      <View style={[st.circle, { width: size, height: size }]}><Feather name={icon} size={28} color={c.accent} /></View>
      <Text style={st.toolText} numberOfLines={2}>{label}</Text>
    </Pressable>
  );
}

const st = StyleSheet.create({
  page: { padding: layout['screen-gutter'], paddingBottom: s[7] },
  brand: { color: c.text, fontSize: font.lg.fontSize, lineHeight: font.lg.lineHeight, fontWeight: '700', marginBottom: s[3] },
  note: { color: c.muted, fontSize: font.sm.fontSize, marginBottom: s[3] },
  findCard: { padding: s[3] },
  h2: { color: c.text, fontSize: font.lg.fontSize, lineHeight: font.lg.lineHeight, fontWeight: '600', margin: s[1], marginBottom: s[3] },
  tiles: { flexDirection: 'row' },
  tile: { flex: 1, minHeight: 96, alignItems: 'center', justifyContent: 'center', gap: s[1], borderRadius: r.md },
  tileDivider: { borderLeftWidth: 1, borderLeftColor: c.border, borderRadius: 0 },
  tileText: { color: c.text, fontSize: font.base.fontSize },
  tools: { flexDirection: 'row', flexWrap: 'wrap', rowGap: s[4] },
  tool: { width: '25%', alignItems: 'center', gap: s[2], minHeight: layout['min-touch-target'] },
  circle: { borderRadius: r.pill, backgroundColor: c.accentSoft, alignItems: 'center', justifyContent: 'center' },
  toolText: { color: c.muted, fontSize: font.sm.fontSize, lineHeight: font.sm.lineHeight, textAlign: 'center' },
  ad: { marginTop: s[5], alignItems: 'center' },
});

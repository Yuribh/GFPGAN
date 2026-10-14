// Chooses the vehicle for a tool: from favorites, from recent lookups, or by type > brand > model > year.
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { VehicleType } from '../src/data/types.ts';
import { favorites, history } from '../src/storage.ts';
import { Header, st as kit } from '../src/ui/kit.tsx';
import { VehicleList } from '../src/ui/VehicleList.tsx';
import { TOOL_TITLE, isTool, openTool } from '../src/ui/tools.ts';
import { c, card, r, s, font, layout } from '../src/theme.ts';

const TYPES: { type: VehicleType; label: string; icon: keyof typeof MaterialCommunityIcons.glyphMap }[] = [
  { type: 'cars', label: 'Carros', icon: 'car-outline' },
  { type: 'motorcycles', label: 'Motos', icon: 'motorbike' },
  { type: 'trucks', label: 'Caminhões', icon: 'truck-outline' },
];
const recent = async () => (await history.list()).slice(0, 5);

export default function Choose() {
  const { then } = useLocalSearchParams<{ then?: string }>();
  const tool = isTool(then) ? then : 'report';
  return (
    <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
      <Header title={TOOL_TITLE[tool]} back />
      <ScrollView contentContainerStyle={{ padding: layout['screen-gutter'], paddingTop: 0, paddingBottom: s[7] }}>
        <Text style={st.h2} accessibilityRole="header">Escolha o veículo</Text>
        <View style={[card, st.tiles]}>
          {TYPES.map((t, i) => (
            <Pressable key={t.type} accessibilityRole="button" accessibilityLabel={t.label}
              onPress={() => router.push({ pathname: '/pick', params: { type: t.type, then: tool } })}
              style={({ pressed }) => [st.tile, i > 0 && st.divider, pressed && { backgroundColor: c.surfaceMuted }]}>
              <MaterialCommunityIcons name={t.icon} size={28} color={c.text} />
              <Text style={st.tileText}>{t.label}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={st.h3} accessibilityRole="header">Seus favoritos</Text>
        <VehicleList loadIds={favorites.list} scroll={false} onSelect={v => openTool(tool, v.year.id)}
          emptyTitle="Nenhum favorito ainda." />
        <Text style={st.h3} accessibilityRole="header">Vistos por último</Text>
        <VehicleList loadIds={recent} scroll={false} onSelect={v => openTool(tool, v.year.id)}
          emptyTitle="Nenhuma busca ainda." />
        <Text style={[kit.muted, { marginTop: s[4] }]}>Ou escolha o tipo acima para buscar por marca, modelo e ano.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  h2: { color: c.text, fontSize: font.lg.fontSize, lineHeight: font.lg.lineHeight, fontWeight: '600', marginBottom: s[3] },
  h3: { color: c.text, fontSize: font.base.fontSize, fontWeight: '600', marginTop: s[5], marginBottom: s[2] },
  tiles: { flexDirection: 'row', padding: s[2] },
  tile: { flex: 1, minHeight: 88, alignItems: 'center', justifyContent: 'center', gap: s[1], borderRadius: r.md },
  divider: { borderLeftWidth: 1, borderLeftColor: c.border, borderRadius: 0 },
  tileText: { color: c.text, fontSize: font.base.fontSize },
});

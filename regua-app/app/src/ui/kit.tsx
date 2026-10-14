import { useEffect } from 'react';
import { AccessibilityInfo, ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { c, r, s, font, layout } from '../theme.ts';

/** back: a handler, true for "go back one screen", or nothing for tab screens (no back button). */
export function Header({ title, back }: { title: string; back?: true | (() => void) }) {
  const onBack = back === true ? () => (router.canGoBack() ? router.back() : router.replace('/')) : back;
  return (
    <View style={st.header}>
      {onBack ? (
        <Pressable onPress={onBack} accessibilityRole="button" accessibilityLabel="Voltar"
          style={st.back} hitSlop={8}>
          <Feather name="chevron-left" size={24} color={c.accent} />
          <Text style={st.backText}>Voltar</Text>
        </Pressable>
      ) : null}
      <Text style={st.title} accessibilityRole="header" numberOfLines={2}>{title}</Text>
    </View>
  );
}

export function Button({ label, onPress, variant = 'primary', icon, pressed, disabled }: {
  label: string; onPress: () => void; variant?: 'primary' | 'secondary'; icon?: keyof typeof Feather.glyphMap;
  pressed?: boolean; disabled?: boolean;
}) {
  const primary = variant === 'primary';
  const fg = primary ? c.onAccent : c.accent;
  return (
    <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button" accessibilityLabel={label}
      accessibilityState={{ disabled, selected: pressed }}
      style={({ pressed: p }) => [st.btn, primary ? st.btnPrimary : st.btnSecondary, p && { opacity: 0.8 }, disabled && { opacity: 0.5 }]}>
      {icon ? <Feather name={icon} size={20} color={fg} /> : null}
      <Text style={[st.btnText, { color: fg }]}>{label}</Text>
    </Pressable>
  );
}

export function Row({ title, subtitle, onPress }: { title: string; subtitle?: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={subtitle ? `${title}, ${subtitle}` : title}
      style={({ pressed }) => [st.row, pressed && { backgroundColor: c.surfaceMuted }]}>
      <View style={{ flex: 1 }}>
        <Text style={st.rowTitle}>{title}</Text>
        {subtitle ? <Text style={st.muted}>{subtitle}</Text> : null}
      </View>
      <Feather name="chevron-right" size={20} color={c.muted} />
    </Pressable>
  );
}

export function Loading({ label = 'Carregando' }: { label?: string }) {
  return (
    <View style={st.state} accessibilityLabel={label} accessible>
      <ActivityIndicator color={c.accent} />
    </View>
  );
}

export function Message({ title, detail, actionLabel, onAction, tone = 'neutral' }: {
  title: string; detail?: string; actionLabel?: string; onAction?: () => void; tone?: 'neutral' | 'error';
}) {
  // live regions are Android-only and may skip a newly mounted view; announce errors explicitly on both platforms
  useEffect(() => { if (tone === 'error') AccessibilityInfo.announceForAccessibility(title); }, [tone, title]);
  return (
    <View style={[st.card, st.state]} accessibilityRole={tone === 'error' ? 'alert' : undefined}
      accessibilityLiveRegion={tone === 'error' ? 'polite' : 'none'}>
      <Text style={[st.stateTitle, tone === 'error' && { color: c.danger }]}>{title}</Text>
      {detail ? <Text style={[st.muted, { textAlign: 'center' }]}>{detail}</Text> : null}
      {actionLabel && onAction ? <View style={{ marginTop: s[4] }}><Button label={actionLabel} onPress={onAction} /></View> : null}
    </View>
  );
}

export const st = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: s[2], paddingHorizontal: layout['screen-gutter'], paddingVertical: s[3], minHeight: 64 },
  back: { flexDirection: 'row', alignItems: 'center', minHeight: layout['min-touch-target'], minWidth: layout['min-touch-target'] },
  backText: { color: c.accent, fontSize: font.base.fontSize, fontWeight: '600' },
  title: { flex: 1, color: c.text, fontSize: font.lg.fontSize, lineHeight: font.lg.lineHeight, fontWeight: '700' },
  btn: { minHeight: layout['min-touch-target'], paddingHorizontal: s[5], borderRadius: r.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: s[2] },
  btnPrimary: { backgroundColor: c.accent },
  btnSecondary: { backgroundColor: c.surface, borderWidth: 1, borderColor: c.accent },
  btnText: { fontSize: font.base.fontSize, fontWeight: '600' },
  row: { minHeight: 56, paddingHorizontal: s[4], paddingVertical: s[2], flexDirection: 'row', alignItems: 'center', gap: s[2], backgroundColor: c.surface },
  rowTitle: { color: c.text, fontSize: font.base.fontSize, lineHeight: font.base.lineHeight },
  muted: { color: c.muted, fontSize: font.sm.fontSize, lineHeight: font.sm.lineHeight },
  card: { backgroundColor: c.surface, borderRadius: r.lg, padding: s[3] },
  state: { padding: s[6], alignItems: 'center', justifyContent: 'center', gap: s[2] },
  stateTitle: { color: c.text, fontSize: font.base.fontSize, fontWeight: '600', textAlign: 'center' },
  sep: { height: 1, backgroundColor: c.border },
});

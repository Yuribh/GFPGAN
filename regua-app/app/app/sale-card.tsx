// Card de venda: the seller fills the asking price and details; the card becomes an image to post or send.
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { captureRef } from 'react-native-view-shot';
import { repo, usingSampleData } from '../src/data/index.ts';
import type { VehicleResult } from '../src/data/types.ts';
import { formatBRL, formatModelYear, formatMonth } from '../src/format.ts';
import { formatKm, maskBRLInput, parseBRLInput, versusFipe } from '../src/logic/saleCard.ts';
import { shareImage } from '../src/services/share.ts';
import { track } from '../src/services/track.ts';
import { Button, Header, Loading, Message, st as kit } from '../src/ui/kit.tsx';
import { c, r, s, font, layout } from '../src/theme.ts';

export default function SaleCard() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [v, setV] = useState<VehicleResult | null | 'error' | undefined>(undefined);
  const [price, setPrice] = useState('');
  const [km, setKm] = useState('');
  const [notes, setNotes] = useState('');
  const [contact, setContact] = useState('');
  const [busy, setBusy] = useState(false);
  const cardRef = useRef<View>(null);

  const load = useCallback(async () => {
    setV(undefined);
    try { setV(await repo.getVehicle(String(id))); } catch { setV('error'); }
  }, [id]);
  useEffect(() => { load(); }, [load]);

  if (v === undefined) return <Screen><Loading /></Screen>;
  if (v === 'error') return <Screen><Message tone="error" title="Não deu para carregar o preço." detail="Confira sua conexão e tente outra vez." actionLabel="Tentar outra vez" onAction={load} /></Screen>;
  if (v === null) return <Screen><Message title="Não há preço para este veículo nesta tabela." /></Screen>;

  const asking = parseBRLInput(price);
  const kmText = formatKm(km);
  const priceLabel = asking ? formatBRL(asking) : 'Preço a combinar';
  const vs = asking ? versusFipe(asking, v.latest.priceCents) : '';
  const text = [
    `À venda: ${v.brand.name} ${v.model.name} ${formatModelYear(v.year.modelYear)} (${v.year.fuel})`,
    asking ? `Preço: ${formatBRL(asking)}${vs ? ` (${vs})` : ''}` : null,
    kmText ? `Quilometragem: ${kmText}` : null,
    `Tabela FIPE de ${formatMonth(v.latest.referenceMonth)}: ${formatBRL(v.latest.priceCents)}`,
    notes.trim() || null,
    contact.trim() ? `Contato: ${contact.trim()}` : null,
  ].filter(Boolean).join('\n');

  const share = async () => {
    if (busy) return;
    setBusy(true);
    track('share');
    let uri: string | null = null;
    if (Platform.OS !== 'web') {
      try { uri = await captureRef(cardRef, { format: 'png', quality: 1, result: 'tmpfile' }); } catch { uri = null; }
    }
    await shareImage(uri, text);
    setBusy(false);
  };

  return (
    <Screen>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: layout['screen-gutter'], paddingTop: 0, paddingBottom: s[7], gap: s[4] }} keyboardShouldPersistTaps="handled">
          {/* the card itself: what gets captured as the image */}
          <View ref={cardRef} collapsable={false} style={st.card}>
            <View style={st.cardTop}>
              <Text style={st.forSale}>À VENDA</Text>
              <Text style={st.brandMark}>Valor do Carro</Text>
            </View>
            <Text style={st.cardBrand}>{v.brand.name}</Text>
            <Text style={st.cardModel}>{v.model.name}</Text>
            <Text style={st.cardMeta}>{[formatModelYear(v.year.modelYear), v.year.fuel, kmText].filter(Boolean).join(' · ')}</Text>
            <Text style={[st.cardPrice, priceLabel.length > 12 && st.cardPriceLong]} numberOfLines={1} adjustsFontSizeToFit>{priceLabel}</Text>
            {vs ? <Text style={st.cardVs}>{vs}</Text> : null}
            <View style={st.cardFipe}>
              <Text style={st.cardFipeLabel}>Tabela FIPE de {formatMonth(v.latest.referenceMonth)}</Text>
              <Text style={st.cardFipeValue}>{formatBRL(v.latest.priceCents)}</Text>
            </View>
            {notes.trim() ? <Text style={st.cardNotes}>{notes.trim()}</Text> : null}
            {contact.trim() ? <Text style={st.cardContact}>{contact.trim()}</Text> : null}
            {usingSampleData ? <Text style={st.cardSample}>Dados de exemplo</Text> : null}
          </View>

          <Field label="Preço pedido (R$)" value={price} onChange={t => setPrice(maskBRLInput(t))} placeholder="Ex.: 45.900" keyboardType="number-pad" />
          <Field label="Quilometragem" value={km} onChange={t => setKm(t.replace(/\D/g, '').slice(0, 7))} placeholder="Ex.: 62000" keyboardType="number-pad" />
          <Field label="Destaques (opcional)" value={notes} onChange={t => setNotes(t.slice(0, 120))} placeholder="Ex.: único dono, revisões em dia" multiline />
          <Field label="Contato (opcional)" value={contact} onChange={t => setContact(t.slice(0, 60))} placeholder="Ex.: WhatsApp (11) 90000-0000" />
          <Text style={kit.muted}>O que você digita fica só neste aparelho e no card que você compartilhar.</Text>
          <Button icon="share" label={busy ? 'Preparando…' : 'Compartilhar card'} onPress={share} disabled={busy} />
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

function Screen({ children }: { children: ReactNode }) {
  return <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}><Header title="Card de venda" back />{children}</SafeAreaView>;
}

function Field({ label, value, onChange, placeholder, keyboardType, multiline }: {
  label: string; value: string; onChange: (t: string) => void; placeholder?: string; keyboardType?: 'number-pad'; multiline?: boolean;
}) {
  return (
    <View style={{ gap: s[1] }}>
      <Text style={{ color: c.text, fontSize: font.sm.fontSize, fontWeight: '600' }}>{label}</Text>
      <TextInput value={value} onChangeText={onChange} placeholder={placeholder} placeholderTextColor={c.muted}
        keyboardType={keyboardType} multiline={multiline} accessibilityLabel={label}
        style={[st.input, multiline && { minHeight: 72, textAlignVertical: 'top', paddingTop: s[3] }]} />
    </View>
  );
}

const st = StyleSheet.create({
  card: { backgroundColor: c.surface, borderRadius: r.lg, padding: s[5], borderTopWidth: 8, borderTopColor: c.accent, gap: s[1] },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: s[2] },
  forSale: { color: c.onAccent, backgroundColor: c.accent, fontWeight: '700', fontSize: font.sm.fontSize, letterSpacing: 1, paddingHorizontal: s[2], paddingVertical: 2, borderRadius: r.sm, overflow: 'hidden' },
  brandMark: { color: c.accent, fontWeight: '700', fontSize: font.sm.fontSize },
  cardBrand: { color: c.muted, fontSize: font.sm.fontSize },
  cardModel: { color: c.text, fontSize: font.lg.fontSize, lineHeight: font.lg.lineHeight, fontWeight: '700' },
  cardMeta: { color: c.muted, fontSize: font.base.fontSize },
  cardPrice: { color: c.text, fontSize: font.display.fontSize, lineHeight: font.display.lineHeight, fontWeight: '700', marginTop: s[3] },
  cardPriceLong: { fontSize: font.xl.fontSize, lineHeight: font.xl.lineHeight },
  cardVs: { color: c.accent, fontSize: font.base.fontSize, fontWeight: '600' },
  cardFipe: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: c.surfaceMuted, borderRadius: r.md, padding: s[3], marginTop: s[3], gap: s[2] },
  cardFipeLabel: { color: c.muted, fontSize: font.sm.fontSize, flexShrink: 1 },
  cardFipeValue: { color: c.text, fontSize: font.sm.fontSize, fontWeight: '700', flexShrink: 0 },
  cardNotes: { color: c.text, fontSize: font.base.fontSize, lineHeight: font.base.lineHeight, marginTop: s[3] },
  cardContact: { color: c.text, fontSize: font.base.fontSize, fontWeight: '600', marginTop: s[2] },
  cardSample: { color: c.muted, fontSize: font.xs.fontSize, marginTop: s[2] },
  input: { minHeight: layout['min-touch-target'], borderWidth: 1, borderColor: c.borderInput, borderRadius: r.md, paddingHorizontal: s[3], fontSize: font.base.fontSize, color: c.text, backgroundColor: c.surface },
});

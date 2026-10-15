// Consultor: questions about buying and selling, answered with the vehicle's FIPE data when one is chosen.
import { useCallback, useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { repo } from '../src/data/index.ts';
import type { VehicleResult } from '../src/data/types.ts';
import { advisorClient } from '../src/data/advisorClient.ts';
import type { ChatTurn } from '../src/data/advisor.ts';
import { formatBRL, formatModelYear } from '../src/format.ts';
import { installId } from '../src/storage.ts';
import { usePlus } from '../src/services/plus.tsx';
import { track } from '../src/services/track.ts';
import { Header, st as kit } from '../src/ui/kit.tsx';
import { c, card, r, s, font, layout } from '../src/theme.ts';

const WITH_VEHICLE = ['Esse preço está bom?', 'Quanto pedir se eu for vender?', 'É uma boa hora para comprar?', 'O que checar antes de fechar?'];
const GENERAL = ['O que checar antes de comprar um usado?', 'Como negociar o preço?', 'Vale mais a pena carro ou moto?', 'Quais custos além do preço?'];
const MAX_QUESTION = 500;

export default function Advisor() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const plus = usePlus();
  const [vehicle, setVehicle] = useState<VehicleResult | null>(null);
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ text: string; plusOffer?: boolean } | null>(null);
  const scroll = useRef<ScrollView>(null);

  useEffect(() => { if (id) repo.getVehicle(String(id)).then(setVehicle, () => setVehicle(null)); }, [id]);

  const ask = useCallback(async (q: string) => {
    const question = q.trim().slice(0, MAX_QUESTION);
    if (!question || busy) return;
    setBusy(true); setNotice(null); setDraft('');
    const history = turns;
    setTurns(t => [...t, { role: 'user', text: question }]);
    track('advisor_asked');
    const a = await advisorClient.ask({ question, history, installId: await installId(), rcUserId: await plus.appUserId(), vehicle });
    if (a.status === 'ok') setTurns(t => [...t, { role: 'assistant', text: a.answer }]);
    else {
      setTurns(t => t.slice(0, -1));        // keep the history valid: drop the unanswered question
      setDraft(question);
      if (a.status === 'limit') setNotice({ text: `Você já fez as ${a.limit} perguntas de hoje.${!a.plus && plus.available ? ' Com o Valor do Carro Plus são mais perguntas por dia.' : ' Volte amanhã.'}`, plusOffer: !a.plus && plus.available });
      else if (a.status === 'offline') setNotice({ text: 'Não deu para enviar. Confira sua conexão e tente outra vez.' });
      else setNotice({ text: 'O consultor está indisponível agora. Tente mais tarde.' });
    }
    setBusy(false);
    setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 50);
  }, [busy, turns, vehicle, plus]);

  const suggestions = vehicle ? WITH_VEHICLE : GENERAL;
  return (
    <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
      <Header title="Consultor" back />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView ref={scroll} contentContainerStyle={{ padding: layout['screen-gutter'], paddingTop: 0, gap: s[3] }} keyboardShouldPersistTaps="handled">
          {vehicle ? (
            <View style={[card, st.vehicle]}>
              <Feather name="truck" size={18} color={c.accent} />
              <Text style={{ flex: 1, color: c.text, fontSize: font.sm.fontSize }} numberOfLines={2}>
                {vehicle.brand.name} {vehicle.model.name} {formatModelYear(vehicle.year.modelYear)} · FIPE {formatBRL(vehicle.latest.priceCents)}
              </Text>
            </View>
          ) : (
            <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/choose', params: { then: 'advisor' } })} style={[card, st.vehicle]}>
              <Feather name="plus-circle" size={18} color={c.accent} />
              <Text style={{ flex: 1, color: c.accent, fontWeight: '600', fontSize: font.sm.fontSize }}>Escolher um veículo para perguntas sobre ele</Text>
            </Pressable>
          )}
          {turns.length === 0 ? (
            <View style={{ gap: s[2] }}>
              <Text style={{ color: c.text, fontSize: font.base.fontSize, lineHeight: font.base.lineHeight }}>Pergunte sobre preço, compra, venda e cuidados com o veículo.</Text>
              <View style={st.chips}>
                {suggestions.map(q => (
                  <Pressable key={q} onPress={() => ask(q)} accessibilityRole="button" style={({ pressed }) => [st.chip, pressed && { backgroundColor: c.accentSoft }]}>
                    <Text style={st.chipText}>{q}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : null}
          {turns.map((t, i) => (
            <View key={i} style={[st.bubble, t.role === 'user' ? st.mine : st.theirs]} accessibilityLabel={`${t.role === 'user' ? 'Você' : 'Consultor'}: ${t.text}`}>
              <Text style={[st.bubbleText, t.role === 'user' && { color: c.onAccent }]} selectable>{t.text}</Text>
            </View>
          ))}
          {busy ? <Text style={kit.muted} accessibilityLiveRegion="polite">O consultor está escrevendo…</Text> : null}
          {notice ? (
            <View style={[card, { padding: s[3], gap: s[2] }]} accessibilityLiveRegion="polite">
              <Text style={{ color: c.text, fontSize: font.sm.fontSize }}>{notice.text}</Text>
              {notice.plusOffer ? <Text style={st.link} onPress={() => router.push('/plus')} accessibilityRole="link">Conhecer o Valor do Carro Plus</Text> : null}
            </View>
          ) : null}
          <Text style={[kit.muted, { marginBottom: s[3] }]}>
            Respostas geradas por inteligência artificial com os dados da tabela FIPE. Podem conter erros: confira antes de decidir.
            {advisorClient.sample ? ' Modo de exemplo.' : ''}
          </Text>
        </ScrollView>
        <View style={st.composer}>
          <TextInput value={draft} onChangeText={t => setDraft(t.slice(0, MAX_QUESTION))} placeholder="Escreva sua pergunta" placeholderTextColor={c.muted}
            multiline accessibilityLabel="Sua pergunta" style={st.input} editable={!busy} />
          <Pressable onPress={() => ask(draft)} disabled={busy || !draft.trim()} accessibilityRole="button" accessibilityLabel="Enviar pergunta"
            style={[st.send, (busy || !draft.trim()) && { opacity: 0.5 }]}>
            <Feather name="send" size={20} color={c.onAccent} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  vehicle: { flexDirection: 'row', alignItems: 'center', gap: s[2], padding: s[3], minHeight: layout['min-touch-target'] },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: s[2] },
  chip: { borderWidth: 1, borderColor: c.accent, borderRadius: r.pill, paddingHorizontal: s[3], paddingVertical: s[2], minHeight: 40, justifyContent: 'center' },
  chipText: { color: c.accent, fontSize: font.sm.fontSize, fontWeight: '600' },
  bubble: { maxWidth: '88%', borderRadius: r.lg, paddingHorizontal: s[3], paddingVertical: s[2] },
  mine: { alignSelf: 'flex-end', backgroundColor: c.accent },
  theirs: { alignSelf: 'flex-start', backgroundColor: c.surface },
  bubbleText: { color: c.text, fontSize: font.base.fontSize, lineHeight: font.base.lineHeight },
  link: { color: c.accent, fontWeight: '600', fontSize: font.sm.fontSize, paddingVertical: s[1] },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: s[2], padding: s[3], borderTopWidth: 1, borderTopColor: c.border, backgroundColor: c.surface },
  input: { flex: 1, minWidth: 0, minHeight: layout['min-touch-target'], maxHeight: 120, borderWidth: 1, borderColor: c.borderInput, borderRadius: r.md, paddingHorizontal: s[3], paddingTop: s[3], fontSize: font.base.fontSize, color: c.text },
  send: { width: layout['min-touch-target'], height: layout['min-touch-target'], borderRadius: r.pill, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center' },
});

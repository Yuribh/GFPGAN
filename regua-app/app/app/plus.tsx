// Valor do Carro Plus: removes the ad. Lookups stay free forever; there is no paywall in front of a price.
import { useEffect, useState } from 'react';
import { Alert, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { usePlus } from '../src/services/plus.tsx';
import { links } from '../src/services/runtime.ts';
import { track } from '../src/services/track.ts';
import { Button, Header, Loading, Message, st as kit } from '../src/ui/kit.tsx';
import { c, card, r, s, font, layout } from '../src/theme.ts';

const PERKS = ['Sem anúncio em nenhuma tela', 'Até 30 consultas por placa por dia (3 no grátis)', '50 perguntas por dia ao Consultor (5 no grátis)', 'Ajuda a manter o Valor do Carro grátis para todo mundo', 'Cancele quando quiser, com um toque'];

export default function Plus() {
  const plus = usePlus();
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { track('plus_viewed'); if (plus.available) plus.loadOptions(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // pre-select the yearly plan when it exists (cheapest per month)
  useEffect(() => {
    if (!selected && plus.options?.length) setSelected((plus.options.find(o => o.label === 'Anual') ?? plus.options[0]).id);
  }, [plus.options, selected]);

  const buy = async () => {
    if (!selected || busy) return;
    setBusy(true);
    const out = await plus.purchase(selected);
    setBusy(false);
    if (out === 'failed') Alert.alert('A compra não foi concluída', 'Nada foi cobrado. Tente outra vez em instantes.');
  };
  const restore = async () => {
    if (busy) return;
    setBusy(true);
    const ok = await plus.restore();
    setBusy(false);
    Alert.alert(ok ? 'Valor do Carro Plus restaurado' : 'Nenhuma assinatura encontrada',
      ok ? 'Obrigado por apoiar o Valor do Carro.' : 'Use a mesma conta da loja em que você assinou.');
  };

  let body;
  if (!plus.available) {
    body = <Message title="Assinatura indisponível nesta versão" detail="O Valor do Carro Plus aparece na versão instalada pela Play Store ou App Store." />;
  } else if (plus.isPlus) {
    body = (
      <View style={[card, st.box]}>
        <Feather name="check-circle" size={32} color={c.accent} />
        <Text style={st.h1}>Você é Valor do Carro Plus</Text>
        <Text style={kit.muted}>Obrigado por apoiar o Valor do Carro. Os anúncios estão desligados.</Text>
        <View style={{ marginTop: s[4], alignSelf: 'stretch' }}>
          <Button variant="secondary" icon="settings" label="Gerenciar ou cancelar assinatura" onPress={plus.manage} />
        </View>
      </View>
    );
  } else if (!plus.options) {
    body = <Loading label="Carregando os planos" />;
  } else if (!plus.options.length) {
    body = <Message tone="error" title="Não deu para carregar os planos." detail="Confira sua conexão e tente outra vez." actionLabel="Tentar outra vez" onAction={plus.loadOptions} />;
  } else {
    body = (
      <>
        <View accessibilityRole="radiogroup" accessibilityLabel="Plano" style={{ gap: s[3] }}>
          {plus.options.map(o => {
            const on = o.id === selected;
            return (
              <Pressable key={o.id} onPress={() => setSelected(o.id)} accessibilityRole="radio" accessibilityState={{ checked: on }}
                accessibilityLabel={`${o.label}, ${o.price}`} style={[card, st.option, on && st.optionOn]}>
                <Feather name={on ? 'check-circle' : 'circle'} size={22} color={on ? c.accent : c.muted} />
                <View style={{ flex: 1 }}>
                  <Text style={st.optionTitle}>{o.label}</Text>
                  {o.note ? <Text style={kit.muted}>{o.note}</Text> : null}
                </View>
                <Text style={st.optionPrice}>{o.price}</Text>
              </Pressable>
            );
          })}
        </View>
        <View style={{ marginTop: s[5], gap: s[3] }}>
          <Button label={busy ? 'Aguarde…' : 'Assinar'} onPress={buy} disabled={busy || !selected} />
          <Button variant="secondary" label="Restaurar compra" onPress={restore} disabled={busy} />
        </View>
        <Text style={[kit.muted, { marginTop: s[4] }]}>
          A cobrança é feita na sua conta {Platform.OS === 'ios' ? 'da App Store' : 'do Google Play'} e renova automaticamente até você cancelar. Cancele a qualquer momento na loja,
          pelo menos 24 horas antes da renovação. Ao cancelar, o Plus continua até o fim do período já pago.
        </Text>
        <View style={st.legal}>
          <Text style={st.link} accessibilityRole="link" onPress={() => Linking.openURL(links.terms)}>Termos de uso</Text>
          <Text style={st.link} accessibilityRole="link" onPress={() => Linking.openURL(links.privacy)}>Política de privacidade</Text>
        </View>
      </>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
      <Header title="Valor do Carro Plus" back />
      <ScrollView contentContainerStyle={{ padding: layout['screen-gutter'], paddingBottom: s[7] }}>
        <View style={{ gap: s[2], marginBottom: s[5] }}>
          {PERKS.map(p => (
            <View key={p} style={st.perk}><Feather name="check" size={20} color={c.accent} /><Text style={st.perkText}>{p}</Text></View>
          ))}
          <Text style={kit.muted}>A consulta de preços continua grátis, com ou sem Plus.</Text>
        </View>
        {body}
      </ScrollView>
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  box: { padding: s[5], alignItems: 'center', gap: s[2] },
  h1: { color: c.text, fontSize: font.lg.fontSize, lineHeight: font.lg.lineHeight, fontWeight: '700' },
  perk: { flexDirection: 'row', alignItems: 'center', gap: s[2] },
  perkText: { color: c.text, fontSize: font.base.fontSize, lineHeight: font.base.lineHeight, flex: 1 },
  option: { flexDirection: 'row', alignItems: 'center', gap: s[3], padding: s[4], minHeight: 72, borderWidth: 2, borderColor: 'transparent', borderRadius: r.lg },
  optionOn: { borderColor: c.accent },
  optionTitle: { color: c.text, fontSize: font.base.fontSize, fontWeight: '600' },
  optionPrice: { color: c.text, fontSize: font.base.fontSize, fontWeight: '700' },
  legal: { flexDirection: 'row', flexWrap: 'wrap', gap: s[4], marginTop: s[3] },
  link: { color: c.accent, fontSize: font.sm.fontSize, fontWeight: '600', paddingVertical: s[2] },
});

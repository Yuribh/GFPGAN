import { useEffect, useState, type ReactNode } from 'react';
import { Linking, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Header, Row, st } from '../../src/ui/kit.tsx';
import { card, c, s, layout, font } from '../../src/theme.ts';
import { usePlus } from '../../src/services/plus.tsx';
import { adPrivacyOptionsRequired, openAdPrivacyOptions } from '../../src/services/ads';
import { appVersion, links } from '../../src/services/runtime.ts';

export default function About() {
  const plus = usePlus();
  const [adPrivacy, setAdPrivacy] = useState(false);
  useEffect(() => { adPrivacyOptionsRequired().then(setAdPrivacy); }, []);
  const open = (url: string) => () => { Linking.openURL(url).catch(() => {}); };

  return (
    <SafeAreaView style={{ flex: 1 }} edges={['top']}>
      <Header title="Sobre" />
      <ScrollView contentContainerStyle={{ paddingHorizontal: layout['screen-gutter'], paddingBottom: s[7], gap: s[5] }}>
        <View style={[card, { padding: s[4], gap: s[2] }]}>
          <Text style={{ color: c.text, fontSize: font.base.fontSize }}>Régua mostra o preço da tabela FIPE, sem cadastro e sem pop-up.</Text>
          <Text style={st.muted}>A Régua não é afiliada à Fundação Instituto de Pesquisas Econômicas (FIPE). Os valores seguem a tabela FIPE e podem variar do preço praticado no mercado.</Text>
        </View>

        {plus.available ? (
          <List>
            <Row title="Régua Plus" subtitle={plus.isPlus ? 'Ativo. Obrigado pelo apoio!' : 'Use sem anúncios'} onPress={() => router.push('/plus')} />
            {plus.isPlus ? <Row title="Gerenciar ou cancelar assinatura" onPress={plus.manage} /> : null}
          </List>
        ) : null}

        <List>
          <Row title="Ajuda e suporte" onPress={open(links.support)} />
          {links.supportEmail ? <Row title="Fale com a gente" subtitle={links.supportEmail} onPress={open(`mailto:${links.supportEmail}`)} /> : null}
          <Row title="Política de privacidade" onPress={open(links.privacy)} />
          <Row title="Termos de uso" onPress={open(links.terms)} />
          {adPrivacy ? <Row title="Privacidade dos anúncios" subtitle="Mudar suas escolhas de consentimento" onPress={openAdPrivacyOptions} /> : null}
        </List>

        <Text style={[st.muted, { textAlign: 'center' }]}>Versão {appVersion}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function List({ children }: { children: ReactNode }) {
  return <View style={[card, { padding: 0, overflow: 'hidden' }]}>{children}</View>;
}

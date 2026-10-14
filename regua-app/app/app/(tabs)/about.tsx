import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Header, st } from '../../src/ui/kit.tsx';
import { card, c, s, layout, font } from '../../src/theme.ts';

export default function About() {
  return (
    <SafeAreaView style={{ flex: 1 }} edges={['top']}>
      <Header title="Sobre" />
      <View style={{ paddingHorizontal: layout['screen-gutter'] }}>
        <View style={[card, { padding: s[4], gap: s[2] }]}>
          <Text style={{ color: c.text, fontSize: font.base.fontSize }}>Régua mostra o preço da tabela FIPE, sem cadastro e sem pop-up.</Text>
          <Text style={st.muted}>A Régua não é afiliada à Fundação Instituto de Pesquisas Econômicas (FIPE). Os valores seguem a tabela FIPE e podem variar do preço praticado no mercado.</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

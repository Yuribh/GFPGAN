// Any address the app does not know (old link, typo): a short message and a way home, never the framework's page.
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Button, Header, Message } from '../src/ui/kit.tsx';
import { layout, s } from '../src/theme.ts';

export default function NotFound() {
  return (
    <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
      <Header title="Valor do Carro" />
      <View style={{ padding: layout['screen-gutter'], gap: s[3] }}>
        <Message title="Não encontramos esta página." detail="O link pode estar errado ou ser de uma versão antiga do app." />
        <Button label="Ir para o início" icon="home" onPress={() => router.replace('/')} />
      </View>
    </SafeAreaView>
  );
}

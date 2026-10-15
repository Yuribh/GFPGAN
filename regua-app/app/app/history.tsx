import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { history } from '../src/storage.ts';
import { Header } from '../src/ui/kit.tsx';
import { VehicleList } from '../src/ui/VehicleList.tsx';
import { layout } from '../src/theme.ts';

export default function History() {
  return (
    <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
      <Header title="Histórico" back />
      <View style={{ flex: 1, paddingHorizontal: layout['screen-gutter'] }}>
        <VehicleList loadIds={history.list} emptyTitle="Nenhuma busca ainda." />
      </View>
    </SafeAreaView>
  );
}

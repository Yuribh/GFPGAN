import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { favorites } from '../../src/storage.ts';
import { Header } from '../../src/ui/kit.tsx';
import { VehicleList } from '../../src/ui/VehicleList.tsx';
import { layout } from '../../src/theme.ts';

export default function Favorites() {
  return (
    <SafeAreaView style={{ flex: 1 }} edges={['top']}>
      <Header title="Favoritos" />
      <View style={{ flex: 1, paddingHorizontal: layout['screen-gutter'] }}>
        <VehicleList loadIds={favorites.list} emptyTitle="Sua lista está vazia." emptyDetail="Abra um preço e toque em Favoritar para acompanhar aqui." />
      </View>
    </SafeAreaView>
  );
}

// Shared by Favoritos and Histórico: loads vehicles by id, skips ones that left the catalog (F03-E2).
import { useCallback, useState } from 'react';
import { FlatList, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { repo } from '../data/index.ts';
import type { VehicleResult } from '../data/types.ts';
import { formatBRL, formatModelYear, formatPercent } from '../format.ts';
import { Loading, Message, Row, st } from './kit.tsx';
import { r } from '../theme.ts';

export function VehicleList({ loadIds, emptyTitle, emptyDetail }: { loadIds: () => Promise<string[]>; emptyTitle: string; emptyDetail?: string }) {
  const [list, setList] = useState<VehicleResult[] | null>(null);
  const [failed, setFailed] = useState(false);
  const load = useCallback(() => {
    let alive = true;
    (async () => {
      setFailed(false);
      try {
        const ids = await loadIds();
        // null = the vehicle left the catalog (skip it); a rejection = network or server problem (show the error)
        const found = await Promise.all(ids.map(id => repo.getVehicle(id)));
        if (alive) setList(found.filter((v): v is VehicleResult => v !== null));
      } catch {
        if (alive) setFailed(true);
      }
    })();
    return () => { alive = false; };
  }, [loadIds]);
  useFocusEffect(load);    // refresh every time the screen comes back into view

  if (failed) return <Message tone="error" title="Não deu para carregar a lista." actionLabel="Tentar outra vez" onAction={load} />;
  if (!list) return <Loading />;
  if (list.length === 0) return <Message title={emptyTitle} detail={emptyDetail} />;
  return (
    <FlatList data={list} keyExtractor={v => v.year.id} style={{ borderRadius: r.lg, flexGrow: 0 }}
      ItemSeparatorComponent={() => <View style={st.sep} />}
      renderItem={({ item: v }) => (
        <Row title={`${v.brand.name} ${v.model.name}`}
          subtitle={`${formatModelYear(v.year.modelYear)} · ${formatBRL(v.latest.priceCents)}${v.change ? ' · ' + formatPercent(v.change.percent) : ''}`}
          onPress={() => router.push(`/vehicle/${encodeURIComponent(v.year.id)}`)} />
      )} />
  );
}

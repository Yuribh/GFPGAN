// Relatório: preview of the price report, then a PDF to share or print.
import { useCallback, useEffect, useState } from 'react';
import { Alert, Platform, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { repo, usingSampleData } from '../src/data/index.ts';
import type { VehicleResult } from '../src/data/types.ts';
import { formatBRL, formatModelYear, formatMonth, formatPercent } from '../src/format.ts';
import { printReport, shareReportPdf } from '../src/services/share.ts';
import { Button, Header, Loading, Message, st as kit } from '../src/ui/kit.tsx';
import { c, card, s, font, layout } from '../src/theme.ts';

export default function Report() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [v, setV] = useState<VehicleResult | null | 'error' | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    setV(undefined);
    try { setV(await repo.getVehicle(String(id))); } catch { setV('error'); }
  }, [id]);
  useEffect(() => { load(); }, [load]);

  const run = async (fn: (v: VehicleResult) => Promise<boolean>) => {
    if (busy || !v || v === 'error') return;
    setBusy(true);
    const ok = await fn(v);
    setBusy(false);
    if (!ok) Alert.alert('Não deu para gerar o relatório', 'Tente outra vez em instantes.');
  };

  let body;
  if (v === undefined) body = <Loading />;
  else if (v === 'error') body = <Message tone="error" title="Não deu para carregar o preço." detail="Confira sua conexão e tente outra vez." actionLabel="Tentar outra vez" onAction={load} />;
  else if (v === null) body = <Message title="Não há preço para este veículo nesta tabela." />;
  else {
    const pts = v.history.slice(-12);
    const yearPct = pts.length > 1 && pts[0].priceCents > 0 ? ((v.latest.priceCents - pts[0].priceCents) / pts[0].priceCents) * 100 : null;
    body = (
      <View style={{ gap: s[4] }}>
        <View style={[card, { padding: s[4], gap: s[1] }]}>
          <Text style={kit.muted}>{v.brand.name}</Text>
          <Text style={{ color: c.text, fontSize: font.lg.fontSize, lineHeight: font.lg.lineHeight, fontWeight: '600' }}>{v.model.name}</Text>
          <Text style={kit.muted}>{formatModelYear(v.year.modelYear)} · {v.year.fuel} · FIPE {v.year.fipeCode}</Text>
          <Text style={{ color: c.text, fontSize: font.xl.fontSize, lineHeight: font.xl.lineHeight, fontWeight: '700', marginTop: s[2] }}>{formatBRL(v.latest.priceCents)}</Text>
          <Text style={kit.muted}>Tabela de {formatMonth(v.latest.referenceMonth)}</Text>
        </View>
        <View style={[card, { padding: s[4], gap: s[2] }]}>
          <Text style={{ color: c.text, fontWeight: '600', fontSize: font.base.fontSize }}>O relatório traz</Text>
          {['Preço FIPE do mês e código FIPE', `Variação no mês${v.change ? ` (${formatPercent(v.change.percent)})` : ''} e em ${pts.length} meses${yearPct === null ? '' : ` (${formatPercent(yearPct)})`}`,
            'Gráfico e tabela mês a mês', 'Data em que foi gerado'].map(t => <Text key={t} style={kit.muted}>• {t}</Text>)}
        </View>
        <Button icon="share" label={busy ? 'Gerando…' : Platform.OS === 'web' ? 'Imprimir ou salvar PDF' : 'Compartilhar PDF'} onPress={() => run(shareReportPdf)} disabled={busy} />
        {Platform.OS !== 'web' ? <Button variant="secondary" icon="printer" label="Imprimir" onPress={() => run(printReport)} disabled={busy} /> : null}
        {usingSampleData ? <Text style={kit.muted}>Dados de exemplo: o relatório avisa que não são valores reais.</Text> : null}
      </View>
    );
  }
  return (
    <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
      <Header title="Relatório de preço" back />
      <ScrollView contentContainerStyle={{ padding: layout['screen-gutter'], paddingTop: 0, paddingBottom: s[7] }}>{body}</ScrollView>
    </SafeAreaView>
  );
}

// Histórico do veículo: paid report by plate (auction, theft, total loss, financing, restrictions, recall).
// One store purchase = one report. If the server fails after paying, the purchase waits on the device to be retried.
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { historyClient } from '../src/data/historyClient.ts';
import { CHECK_LABEL, SAMPLE_REPORT, type HistoryAnswer, type HistoryReport, type CheckStatus } from '../src/data/history.ts';
import { formatPlate, maskPlateInput, normalizePlate } from '../src/logic/plate.ts';
import { pendingPurchase, reports, type SavedReport } from '../src/storage.ts';
import { usePlus } from '../src/services/plus.tsx';
import { Button, Header, Loading, Row, st as kit } from '../src/ui/kit.tsx';
import { tokens } from '../src/tokens.ts';
import { c, card, r, s, font, layout } from '../src/theme.ts';

const PRODUCT = 'historico_veicular';
const STATUS: Record<CheckStatus, { icon: 'check-circle' | 'alert-triangle' | 'help-circle'; color: string; text: string }> = {
  ok: { icon: 'check-circle', color: tokens.color.success, text: 'Nada consta' },
  alert: { icon: 'alert-triangle', color: c.danger, text: 'Consta registro' },
  unknown: { icon: 'help-circle', color: c.muted, text: 'Sem informação' },
};
const MESSAGES: Record<Exclude<HistoryAnswer['status'], 'ok'>, string> = {
  not_paid: 'Não encontramos o pagamento deste relatório. Se você pagou, toque em tentar outra vez em alguns minutos.',
  already_used: 'Esta compra já foi usada para outra placa.',
  not_found: 'O fornecedor não encontrou essa placa. Sua compra continua valendo: confira a placa e tente outra vez.',
  unavailable: 'O serviço de histórico está indisponível agora. Sua compra está guardada: tente outra vez mais tarde.',
  offline: 'Sem conexão. Sua compra está guardada: tente outra vez quando tiver internet.',
  invalid_plate: 'Essa placa não parece válida.',
};

export default function VehicleHistory() {
  const plus = usePlus();
  const [plateInput, setPlateInput] = useState('');
  const [price, setPrice] = useState<string | null | undefined>(undefined);
  const [pending, setPending] = useState<{ plate: string; transactionId: string } | null>(null);
  const [saved, setSaved] = useState<SavedReport[]>([]);
  const [shown, setShown] = useState<{ plate: string; report: HistoryReport; sample?: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const sample = historyClient.sample || !plus.available;

  useEffect(() => {
    pendingPurchase.get().then(setPending);
    reports.list().then(setSaved);
    if (!sample) plus.productPrice(PRODUCT).then(setPrice); else setPrice(null);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchPaid = useCallback(async (p: { plate: string; transactionId: string }) => {
    setBusy(true); setMessage('');
    const rcUserId = await plus.appUserId();
    const a = rcUserId ? await historyClient.fetchReport(p.plate, p.transactionId, rcUserId) : { status: 'unavailable' as const };
    if (a.status === 'ok') {
      const entry = { plate: p.plate, savedAt: new Date().toISOString(), report: a.report };
      await reports.save(entry);
      await pendingPurchase.set(null);
      setPending(null); setSaved(await reports.list()); setShown({ plate: p.plate, report: a.report });
    } else {
      if (a.status === 'already_used') { await pendingPurchase.set(null); setPending(null); }
      setMessage(MESSAGES[a.status]);
    }
    setBusy(false);
  }, [plus]);

  const buy = async () => {
    const plate = normalizePlate(plateInput);
    if (!plate) { setMessage(MESSAGES.invalid_plate); return; }
    if (sample) { setShown({ plate, report: SAMPLE_REPORT, sample: true }); return; }
    if (pending) { setMessage('Você já tem um relatório pago esperando. Use o botão acima para buscá-lo.'); return; }
    setBusy(true); setMessage('');
    const res = await plus.buyProduct(PRODUCT);
    setBusy(false);
    if (res.status !== 'purchased') {
      if (res.status === 'failed') Alert.alert('A compra não foi concluída', 'Nada foi cobrado. Tente outra vez em instantes.');
      return;
    }
    const p = { plate, transactionId: res.transactionId };
    await pendingPurchase.set(p); setPending(p);       // saved before the network call, so a crash cannot lose it
    await fetchPaid(p);
  };

  if (shown) return <Screen><ReportView {...shown} onBack={() => setShown(null)} /></Screen>;
  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: layout['screen-gutter'], paddingTop: 0, paddingBottom: s[7], gap: s[4] }} keyboardShouldPersistTaps="handled">
        {pending ? (
          <View style={[card, { padding: s[4], gap: s[2], borderWidth: 2, borderColor: c.accent }]}>
            <Text style={st.h3}>Relatório pago esperando: placa {formatPlate(pending.plate)}</Text>
            <Text style={kit.muted}>Você já pagou. Busque o relatório sem pagar de novo.</Text>
            <Button label={busy ? 'Buscando…' : 'Buscar meu relatório'} onPress={() => fetchPaid(pending)} disabled={busy} />
          </View>
        ) : null}
        <View style={[card, { padding: s[4], gap: s[3] }]}>
          <Text style={st.h3}>Consulte o histórico pela placa</Text>
          {(Object.keys(CHECK_LABEL) as (keyof typeof CHECK_LABEL)[]).map(k => (
            <View key={k} style={st.incl}><Feather name="check" size={18} color={c.accent} /><Text style={st.inclText}>{CHECK_LABEL[k]}</Text></View>
          ))}
          <TextInput value={plateInput} onChangeText={t => { setPlateInput(maskPlateInput(t)); setMessage(''); }} placeholder="ABC1D23"
            placeholderTextColor={c.muted} autoCapitalize="characters" autoCorrect={false} maxLength={8} accessibilityLabel="Placa do veículo" style={st.input} />
          <Button icon="shopping-bag" disabled={busy || price === undefined}
            label={busy ? 'Aguarde…' : sample ? 'Ver relatório de exemplo' : price ? `Comprar relatório por ${price}` : 'Relatório indisponível agora'}
            onPress={buy} />
          {message ? <Text style={st.message} accessibilityLiveRegion="polite">{message}</Text> : null}
          <Text style={kit.muted}>
            {sample ? 'Modo de exemplo: o relatório real aparece quando o app estiver ligado ao serviço e à loja. '
              : 'Pagamento único pela loja. Se o relatório não puder ser gerado, sua compra fica guardada para tentar de novo. '}
            Dados do veículo, sem dados do proprietário.
          </Text>
        </View>
        {saved.length ? (
          <View style={{ gap: s[2] }}>
            <Text style={st.h3}>Meus relatórios</Text>
            <View style={[card, { padding: 0, overflow: 'hidden' }]}>
              {saved.map(x => (
                <Row key={x.plate} title={`Placa ${formatPlate(x.plate)}`} subtitle={new Date(x.savedAt).toLocaleDateString('pt-BR')}
                  onPress={() => setShown({ plate: x.plate, report: x.report as HistoryReport })} />
              ))}
            </View>
          </View>
        ) : null}
      </ScrollView>
      {price === undefined && !sample ? <Loading /> : null}
    </Screen>
  );
}

function ReportView({ plate, report, sample, onBack }: { plate: string; report: HistoryReport; sample?: boolean; onBack: () => void }) {
  const alerts = report.checks.filter(x => x.status === 'alert').length;
  return (
    <ScrollView contentContainerStyle={{ padding: layout['screen-gutter'], paddingTop: 0, paddingBottom: s[7], gap: s[3] }}>
      <View style={[card, { padding: s[4], gap: s[1] }]}>
        <Text style={kit.muted}>Placa {formatPlate(plate)}</Text>
        <Text style={st.model}>{[report.vehicle.brand, report.vehicle.model].filter(Boolean).join(' ') || 'Veículo'}</Text>
        <Text style={kit.muted}>{[report.vehicle.year, report.vehicle.color].filter(Boolean).join(' · ')}</Text>
        <Text style={[st.summary, { color: alerts ? c.danger : tokens.color.success }]}>
          {alerts ? `${alerts} ${alerts === 1 ? 'item pede atenção' : 'itens pedem atenção'}` : 'Nada consta nos itens consultados'}
        </Text>
      </View>
      <View style={[card, { padding: 0, overflow: 'hidden' }]}>
        {report.checks.map((x, i) => {
          const m = STATUS[x.status];
          return (
            <View key={x.key} style={[st.check, i > 0 && { borderTopWidth: 1, borderTopColor: c.border }]} accessible accessibilityLabel={`${CHECK_LABEL[x.key]}: ${m.text}${x.detail ? `. ${x.detail}` : ''}`}>
              <Feather name={m.icon} size={22} color={m.color} />
              <View style={{ flex: 1 }}>
                <Text style={st.checkTitle}>{CHECK_LABEL[x.key]}</Text>
                <Text style={[kit.muted, x.status === 'alert' && { color: c.danger }]}>{m.text}{x.detail ? ` · ${x.detail}` : ''}</Text>
              </View>
            </View>
          );
        })}
      </View>
      <Text style={kit.muted}>
        {sample ? 'Relatório de exemplo, com dados inventados. ' : ''}
        Informações de bases de terceiros na data da consulta. "Sem informação" não quer dizer que está tudo certo: confirme no Detran e faça uma vistoria antes de fechar negócio.
      </Text>
      <Button variant="secondary" icon="arrow-left" label="Voltar" onPress={onBack} />
    </ScrollView>
  );
}

function Screen({ children }: { children: ReactNode }) {
  return <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}><Header title="Histórico do veículo" back />{children}</SafeAreaView>;
}

const st = StyleSheet.create({
  h3: { color: c.text, fontSize: font.base.fontSize, lineHeight: font.base.lineHeight, fontWeight: '600' },
  incl: { flexDirection: 'row', alignItems: 'center', gap: s[2] },
  inclText: { color: c.text, fontSize: font.sm.fontSize, flex: 1 },
  input: { minHeight: layout['min-touch-target'], borderWidth: 1, borderColor: c.borderInput, borderRadius: r.md, paddingHorizontal: s[3], fontSize: 20, letterSpacing: 2, fontWeight: '600', color: c.text },
  message: { color: c.danger, fontSize: font.sm.fontSize, lineHeight: font.sm.lineHeight },
  model: { color: c.text, fontSize: font.lg.fontSize, lineHeight: font.lg.lineHeight, fontWeight: '600' },
  summary: { fontSize: font.base.fontSize, fontWeight: '700', marginTop: s[2] },
  check: { flexDirection: 'row', alignItems: 'center', gap: s[3], padding: s[4], backgroundColor: c.surface },
  checkTitle: { color: c.text, fontSize: font.base.fontSize, fontWeight: '600' },
});

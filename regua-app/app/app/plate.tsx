// Plate result: one catalog match opens the price directly; several are listed; none offers the manual search.
import { useCallback, useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { plateClient } from '../src/data/plateClient.ts';
import type { PlateAnswer } from '../src/data/plate.ts';
import { formatModelYear } from '../src/format.ts';
import { formatPlate, normalizePlate } from '../src/logic/plate.ts';
import { installId } from '../src/storage.ts';
import { usePlus } from '../src/services/plus.tsx';
import { track } from '../src/services/track.ts';
import { Button, Header, Loading, Message, Row, st as kit } from '../src/ui/kit.tsx';
import { PlateSearch } from '../src/ui/PlateSearch.tsx';
import { c, card, s, font, layout } from '../src/theme.ts';

export default function Plate() {
  const params = useLocalSearchParams<{ plate?: string }>();
  const plate = normalizePlate(String(params.plate ?? ''));
  const plus = usePlus();
  const [answer, setAnswer] = useState<PlateAnswer | null>(null);

  const load = useCallback(async () => {
    if (!params.plate) return;                         // opened from the tools: show the search field
    if (!plate) { setAnswer({ status: 'invalid_plate' }); return; }
    setAnswer(null);
    track('plate_lookup');
    const a = await plateClient.lookup(plate, await installId(), await plus.appUserId());
    if (a.status === 'ok' && a.matches.length) track('plate_found');
    // exactly one version: go straight to the price, like the manual search does
    if (a.status === 'ok' && a.matches.length === 1) { router.replace(`/vehicle/${a.matches[0].modelYearId}`); return; }
    setAnswer(a);
  }, [plate]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [load]);

  const manual = <Button variant="secondary" icon="list" label="Buscar por marca e modelo" onPress={() => router.replace({ pathname: '/pick', params: { type: 'cars' } })} />;
  let body;
  if (!params.plate) body = <><Text style={kit.muted}>Digite a placa para ver o preço FIPE do modelo.</Text><PlateSearch /></>;
  else if (!answer) body = <Loading label="Consultando a placa" />;
  else if (answer.status === 'ok') {
    const v = answer.vehicle;
    body = (
      <>
        <View style={[card, { padding: s[4], gap: s[1] }]}>
          <Text style={kit.muted}>{v.brand}</Text>
          <Text style={{ color: c.text, fontSize: font.lg.fontSize, lineHeight: font.lg.lineHeight, fontWeight: '600' }}>{v.model}</Text>
          {v.year ? <Text style={kit.muted}>Ano modelo {v.year}</Text> : null}
        </View>
        {answer.matches.length ? (
          <>
            <Text style={{ color: c.text, fontSize: font.base.fontSize, fontWeight: '600', marginTop: s[5], marginBottom: s[2] }}>Escolha a versão</Text>
            <View style={[card, { padding: 0, overflow: 'hidden' }]}>
              {answer.matches.map(m => (
                <Row key={m.modelYearId} title={m.model} subtitle={`${formatModelYear(m.modelYear)} · ${m.fuel} · FIPE ${m.fipeCode}`}
                  onPress={() => router.push(`/vehicle/${m.modelYearId}`)} />
              ))}
            </View>
          </>
        ) : (
          <View style={{ marginTop: s[4], gap: s[3] }}>
            <Message title="Achamos o veículo, mas não o preço dele na tabela." detail="Procure pela marca e pelo modelo." />
            {manual}
          </View>
        )}
      </>
    );
  } else if (answer.status === 'limit') {
    body = (
      <View style={{ gap: s[3] }}>
        <Message title={`Você já fez as ${answer.limit} consultas por placa de hoje.`}
          detail={answer.plus ? 'O limite volta amanhã. A busca por marca e modelo continua livre.'
            : plus.available ? 'Amanhã tem mais. Com o Régua Plus você consulta mais placas por dia.' : 'Amanhã tem mais. A busca por marca e modelo continua livre.'} />
        {!answer.plus && plus.available ? <Button label="Conhecer o Régua Plus" onPress={() => router.push('/plus')} /> : null}
        {manual}
      </View>
    );
  } else if (answer.status === 'not_found') {
    body = <View style={{ gap: s[3] }}><Message title="Não encontramos essa placa." detail="Confira as letras e os números e tente outra vez." />{manual}</View>;
  } else if (answer.status === 'invalid_plate') {
    body = <View style={{ gap: s[3] }}><Message title="Essa placa não parece válida." detail="Use 3 letras e 4 números ou letras, como ABC1D23." />{manual}</View>;
  } else if (answer.status === 'offline') {
    body = <Message tone="error" title="Não deu para consultar a placa." detail="Confira sua conexão e tente outra vez." actionLabel="Tentar outra vez" onAction={load} />;
  } else {
    body = <View style={{ gap: s[3] }}><Message title="A consulta por placa está indisponível agora." detail="Tente mais tarde ou busque pela marca e pelo modelo." />{manual}</View>;
  }

  return (
    <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
      <Header title={plate ? `Placa ${formatPlate(plate)}` : 'Placa'} back />
      <ScrollView contentContainerStyle={{ padding: layout['screen-gutter'], paddingBottom: s[7] }}>
        {body}
        {plateClient.sample ? <Text style={[kit.muted, { marginTop: s[4] }]}>Exemplo: sem o serviço de placas configurado, toda placa mostra o mesmo veículo de exemplo.</Text> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

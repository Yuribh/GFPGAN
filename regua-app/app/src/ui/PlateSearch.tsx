// "Buscar pela placa" card on the home screen.
import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { maskPlateInput, normalizePlate } from '../logic/plate.ts';
import { Button } from './kit.tsx';
import { c, card, r, s, font, layout } from '../theme.ts';

export function PlateSearch() {
  const [value, setValue] = useState('');
  const [error, setError] = useState('');
  const submit = () => {
    const plate = normalizePlate(value);
    if (!plate) { setError('Digite a placa com 3 letras e 4 números ou letras, como ABC1D23.'); return; }
    setError('');
    router.push({ pathname: '/plate', params: { plate } });
  };
  return (
    <View style={[card, st.box]}>
      <Text style={st.h2} accessibilityRole="header">Buscar pela placa</Text>
      <View style={st.row}>
        <TextInput value={value} onChangeText={t => { setValue(maskPlateInput(t)); if (error) setError(''); }}
          placeholder="ABC1D23" placeholderTextColor={c.muted} autoCapitalize="characters" autoCorrect={false}
          autoComplete="off" maxLength={8} returnKeyType="search" onSubmitEditing={submit}
          accessibilityLabel="Placa do veículo" style={[st.input, error ? { borderColor: c.danger } : null]} />
        <Button label="Buscar" icon="search" onPress={submit} />
      </View>
      {error ? <Text style={st.error} accessibilityLiveRegion="polite">{error}</Text> : null}
    </View>
  );
}

const st = StyleSheet.create({
  box: { padding: s[4], gap: s[3], marginTop: s[4] },
  h2: { color: c.text, fontSize: font.lg.fontSize, lineHeight: font.lg.lineHeight, fontWeight: '600' },
  row: { flexDirection: 'row', gap: s[2], alignItems: 'center' },
  input: {
    flex: 1, minWidth: 0, minHeight: layout['min-touch-target'], borderWidth: 1, borderColor: c.borderInput, borderRadius: r.md,
    paddingHorizontal: s[3], fontSize: 20, letterSpacing: 2, fontWeight: '600', color: c.text, backgroundColor: c.surface,
  },
  error: { color: c.danger, fontSize: font.sm.fontSize, lineHeight: font.sm.lineHeight },
});

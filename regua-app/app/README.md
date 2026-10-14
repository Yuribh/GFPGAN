# Régua (app Android e iOS)

Um só código em Expo (React Native) gera o app de Android e de iPhone.

**Situação:** a lógica de dados, busca, cobrança, importação e banco está testada (41 testes Node, 42 checagens de banco, 49 checagens de navegador no protótipo). As dependências já estão no `package.json` (Expo SDK 57), `npm run typecheck` passa sem erros e o Metro gera os bundles de Android e iOS (`npx expo export`). **O app ainda não foi aberto num celular**: essa é a próxima verificação. Se algo quebrar, mande o erro.

## Rodar no seu computador
Precisa de Node 20 ou mais novo.
```
npm install          # instala as dependências (npm run setup realinha as versões com o Expo)
npx expo start       # rode uma vez (Ctrl+C depois): gera os tipos do Expo usados no typecheck
npm run typecheck    # confere os tipos
npm start            # abre o servidor; leia o QR code com o app Expo Go no celular
```
- **Android**: instale o Expo Go pela Play Store e leia o QR code. Ou `npm run android` com um emulador aberto.
- **iPhone**: instale o Expo Go pela App Store e leia o QR code com a câmera. `npm run ios` abre o simulador, mas só funciona em Mac.

Sem configuração, o app usa **dados de exemplo** (avisa na tela). Para dados reais, crie `.env.local` a partir de `.env.example` com `EXPO_PUBLIC_SUPABASE_URL` e `EXPO_PUBLIC_SUPABASE_ANON_KEY`, rode as migrações de `supabase/migrations` no seu projeto e a importação (`supabase/functions/ingest-fipe`).

## Gerar os apps para as lojas (EAS Build, na nuvem da Expo)
Não precisa de Mac nem para o iOS.
```
npm install -g eas-cli
eas login
eas build --platform android --profile preview      # APK para instalar e testar
eas build --platform ios --profile preview          # build para o simulador
eas build --platform all --profile production       # versões para Play Store e App Store
eas submit --platform android    # e  --platform ios
```
Antes:
- **Troque o identificador** `br.app.regua` em `app.json` (`ios.bundleIdentifier` e `android.package`) por um baseado no seu domínio. Depois de publicado ele não muda mais.
- Contas: Google Play Console (taxa única) e Apple Developer Program (anual), em seu nome.
- Ícone e tela de abertura: ainda não existem (`brand.md` tem o briefing). Até lá o Expo usa o ícone padrão, que as lojas não aceitam.

## Se der erro
- `Unable to resolve "./types.ts"`: o código importa arquivos com a extensão `.ts` para que os mesmos arquivos rodem nos testes do Node. Se o Metro da sua versão não aceitar, me avise o erro.
- Versões: `npx expo install --fix` alinha tudo com a versão do Expo instalada.

## Mapa do código
- `app/` telas (Expo Router): abas Home, Favoritos, Sobre; `pick` (marca, modelo, ano); `vehicle/[id]` (preço e gráfico); `history`.
- `src/data/` dados: `supabase.ts` (real), `fake.ts` (exemplo), mesma interface.
- `src/logic/` busca sem acento, proteção contra toque duplo e contra respostas atrasadas (testadas).
- `server/`, `supabase/` backend, migrações e funções. `prototype/` protótipo web. `landing/` página de venda.

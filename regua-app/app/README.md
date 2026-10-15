# Valor do Carro (app Android e iOS)

Um só código em Expo (React Native) gera o app de Android e de iPhone.

**Situação:** pronto para publicar; falta criar as contas e as chaves (passo a passo em **[PUBLICAR.md](PUBLICAR.md)**). Verificado: 46 testes Node (`npm test`), 51 checagens de banco (`npm run test:db`), `npm run typecheck` sem erros, e o Metro gera os bundles de Android, iOS e web. O APK de teste é gerado pelo GitHub Actions. **O app ainda não foi aberto num celular de verdade.**

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

## Instalar no Android sem computador (APK de teste)
O GitHub Actions (`.github/workflows/regua-apk.yml`) gera o APK a cada push neste app e publica em:
https://github.com/Yuribh/GFPGAN/releases/download/regua-apk/regua.apk
(QR code: `../replica/launch/regua-apk-qr.png`). Abra o link no celular, baixe e instale permitindo "fontes desconhecidas".
Na primeira vez, ative o Actions no repositório (aba **Actions** → "I understand my workflows, go ahead and enable them") e rode o workflow **Valor do Carro APK** em "Run workflow".

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
- O identificador é `io.github.yuribh.regua` (`app.json`). Se tiver um domínio próprio e quiser outro, troque **antes** da primeira publicação: depois ele não muda mais.
- Contas: Google Play Console (taxa única) e Apple Developer Program (anual), em seu nome.
- Ícone e tela de abertura estão em `assets/` (gerados por `scripts/make_icons.py` a partir do briefing de `brand.md`).

## Se der erro
- `Unable to resolve "./types.ts"`: o código importa arquivos com a extensão `.ts` para que os mesmos arquivos rodem nos testes do Node. Se o Metro da sua versão não aceitar, me avise o erro.
- Versões: `npx expo install --fix` alinha tudo com a versão do Expo instalada.

## Mapa do código
- `app/` telas (Expo Router): abas Home, Favoritos, Sobre; `pick` (marca, modelo, ano); `vehicle/[id]` (preço e gráfico); `history`.
- `src/data/` dados: `supabase.ts` (real), `fake.ts` (exemplo), mesma interface.
- `src/logic/` busca sem acento, proteção contra toque duplo e contra respostas atrasadas (testadas).
- Histórico do veículo (pago): `app/vehicle-history.tsx`; servidor em `server/history/` e `supabase/functions/vehicle-history`.
- Consultor: `app/advisor.tsx`; servidor em `server/advisor/` (prompt, regras, adaptador do Claude) e `supabase/functions/advisor`.
- Ferramentas: `app/compare.tsx` (comparar até 3), `app/sale-card.tsx` (card de venda em imagem), `app/report.tsx` (relatório em PDF), `app/choose.tsx` (escolher o veículo); lógica testada em `src/logic/compare.ts`, `saleCard.ts`, `report.ts`.
- `app/plate.tsx` + `src/ui/PlateSearch.tsx` busca por placa; `server/plate/` e `supabase/functions/plate-lookup` (fornecedor, cache, limites).
- `app/plus.tsx` assinatura Valor do Carro Plus. `src/services/` assinatura (RevenueCat), anúncio (AdMob), erros (Sentry), contagem anônima de uso.
- `server/`, `supabase/` backend, migrações e funções (`supabase/schedule.sql` agenda a importação). `prototype/` protótipo web.
- `landing/` site: página de venda, privacidade, termos, suporte (publicado no GitHub Pages).
- `store/` material das lojas: capturas, imagem de destaque, respostas dos formulários.
- Expo Go: abre o app, mas sem anúncio e sem assinatura (precisam de código nativo). Para testar tudo, use o APK ou `eas build --profile development`.

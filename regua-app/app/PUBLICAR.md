# Como publicar a Régua

O código está pronto para publicar. O que falta são **contas e chaves que só você pode criar**, porque ficam no seu nome.
Siga na ordem. Cada passo diz onde colocar o que você criar.

> Onde ficam as chaves:
> - **Variáveis do GitHub:** Settings › Secrets and variables › Actions › aba *Variables* (ou *Secrets* quando indicado).
>   Usadas pelo APK de teste e pelo site.
> - **Variáveis da Expo (EAS):** `npx eas-cli env:create --environment production --name NOME --value VALOR --visibility plaintext`.
>   Usadas pelo build de loja. Todas as `EXPO_PUBLIC_*` são públicas por natureza (vão dentro do app).
> - A lista completa de nomes está em `.env.example`.

## O que já está feito

| Item | Onde |
| --- | --- |
| App Android e iOS (Expo SDK 57), testado: 46 testes, 51 checagens de banco, tipos, bundles Android/iOS/web | `app/`, `src/` |
| Ícone, ícone adaptativo do Android, tela de abertura, favicon, logo, imagem social | `assets/` (gerados por `scripts/make_icons.py`) |
| Identificador do app: **`io.github.yuribh.regua`** (baseado no seu GitHub Pages, que é seu) | `app.json` |
| **Consultor** com IA (Claude): dúvidas de compra e venda com os dados FIPE do veículo; 5 perguntas/dia grátis, 50 no Plus, teto diário de gasto | `app/advisor.tsx`, `server/advisor/`, `supabase/functions/advisor`, `migrations/0007` |
| **Ferramentas**: comparar até 3 veículos (com gráfico), card de venda em imagem para compartilhar, relatório de preço em PDF | `app/compare.tsx`, `app/sale-card.tsx`, `app/report.tsx` |
| **Busca por placa**: campo no início, cache por placa, limite de 3/dia grátis e 30/dia no Plus, teto diário de gastos; a placa nunca é guardada em texto | `app/plate.tsx`, `server/plate/`, `supabase/functions/plate-lookup`, `migrations/0006` |
| Assinatura **Régua Plus** (remove anúncios): tela de planos, compra, restaurar, cancelar com um toque | `app/plus.tsx`, `src/services/plus.tsx` |
| **Um banner** do AdMob no plano grátis, com pedido de consentimento (LGPD/GDPR); some para quem assina | `src/services/ads.tsx` |
| **Relatórios de erro** (Sentry) e **contagem anônima de uso** (tabela `app_events`, sem dados pessoais) | `src/services/`, `supabase/migrations/0005_app_events.sql` |
| Política de privacidade, termos de uso e página de suporte | `landing/privacidade.html`, `termos.html`, `suporte.html` |
| Respostas dos formulários das lojas, ficha, capturas de tela, imagem de destaque | `store/`, `../replica/launch/listing.json` |
| APK de teste automático, site no GitHub Pages, build de loja pelo EAS | `.github/workflows/regua-apk.yml`, `regua-site.yml`, `regua-store.yml` |

Sem nenhuma chave, o app funciona com dados de exemplo, anúncio de teste do Google e sem assinatura.

---

## 1. GitHub (5 minutos)
1. **Actions:** https://github.com/Yuribh/GFPGAN/actions › *I understand my workflows, go ahead and enable them*.
2. **Pages:** Settings › Pages › *Source*: **GitHub Actions**.
   Depois, em Settings › Environments › `github-pages`, permita o branch `claude/regua-app-iyjqep` (ou faça o merge do PR no `master`).
3. **Variáveis** `REGUA_RESPONSAVEL` (seu nome completo ou razão social, e CPF/CNPJ) e `REGUA_EMAIL` (e-mail de contato).
   Elas preenchem a política de privacidade, os termos e o suporte.
4. Actions › *Régua site* › *Run workflow*. O site fica em https://yuribh.github.io/GFPGAN/

## 2. Marca e jurídico (antes de gastar com o resto)
- Pesquise "Régua" e "Regua" no INPI (https://busca.inpi.gov.br), classes 9 e 42.
- Peça a um advogado para revisar `landing/privacidade.html` e `landing/termos.html`, o uso descritivo de "FIPE" e os termos da fonte de dados.

## 3. Dados reais (Supabase + FIPE)
1. Crie o projeto em https://supabase.com (região São Paulo).
2. **SQL Editor:** rode, em ordem, `supabase/migrations/0001` a `0005`.
3. Assine o plano pago da API FIPE (https://fipe.api.br) e **peça por escrito** a autorização de uso comercial.
4. Publique a função de importação (no seu computador, com a CLI do Supabase):
   ```
   npx supabase login
   npx supabase link --project-ref SEU-PROJECT-REF
   npx supabase secrets set FIPE_API_TOKEN=... INGEST_CRON_SECRET=uma-senha-longa FIPE_REQUESTS_PER_RUN=400
   npx supabase functions deploy ingest-fipe --no-verify-jwt
   ```
5. Rode `supabase/schedule.sql` no SQL Editor (troque os dois valores entre `< >`). A importação passa a rodar sozinha todo mês.
6. Ative os backups diários do projeto (Database › Backups).
7. Chaves no app (GitHub *Variables* e Expo *env*): `EXPO_PUBLIC_SUPABASE_URL` e `EXPO_PUBLIC_SUPABASE_ANON_KEY` (Project Settings › API).
8. Números do lançamento: no SQL Editor, `select * from app_daily_metrics;`

## 3b. Busca por placa (fornecedor pago)
Cada consulta nova custa dinheiro ao fornecedor (preços vistos: perto de R$ 0,80–1,00 por consulta; placas repetidas vêm do cache, sem custo).
1. Escolha um fornecedor de consulta **veicular** (só dados do veículo, sem dados do proprietário) que devolva o **código FIPE**.
   Exemplos encontrados: Consultar Placa, WebXcar, FipeAPI, Direct Data. Peça por escrito: origem dos dados, permissão de uso em app, LGPD, preço.
2. Rode a migração `0006_plate_lookup.sql` (se ainda não rodou) e publique a função:
   ```
   npx supabase secrets set PLATE_API_URL='https://.../{plate}' PLATE_API_TOKEN=... PLATE_API_AUTH=bearer \
     PLATE_HASH_PEPPER=$(openssl rand -hex 32) PLATE_GLOBAL_DAILY=300 REVENUECAT_SECRET_KEY=...
   npx supabase functions deploy plate-lookup
   ```
   `PLATE_API_AUTH` é `bearer`, `header:Nome-Do-Header` ou `query:nome_do_parametro`, conforme a documentação do fornecedor.
   `PLATE_GLOBAL_DAILY` é o teto de consultas pagas por dia (300 ≈ R$ 300/dia no pior caso); ajuste ao seu orçamento.
3. **Me mande um exemplo de resposta do fornecedor** (com dados de teste): o leitor da resposta (`server/plate/provider.ts`)
   entende os formatos comuns, mas vale confirmar os nomes dos campos e adicionar um teste com o formato real.
4. Variável do GitHub `REGUA_PLATE_PROVIDER` com o nome do fornecedor: preenche a política de privacidade.
5. Sem fornecedor configurado, a busca por placa responde "indisponível agora" e oferece a busca por marca e modelo.

## 3c. Consultor (IA)
1. Crie uma conta em https://platform.claude.com, adicione créditos e gere uma API key.
2. Rode a migração `0007_feature_quota.sql` e publique a função:
   ```
   npx supabase secrets set ANTHROPIC_API_KEY=... ADVISOR_FREE_DAILY=5 ADVISOR_PLUS_DAILY=50 ADVISOR_GLOBAL_DAILY=2000
   npx supabase functions deploy advisor
   ```
3. Custo: cada pergunta usa o modelo Claude Opus 5.5 com esforço baixo e respostas curtas. `ADVISOR_GLOBAL_DAILY` é o teto de perguntas por dia no app todo; ajuste ao orçamento e acompanhe o gasto no painel da Anthropic.
4. Sem a chave, o Consultor responde "indisponível agora".

## 3d. Cotar seguro (opcional)
Se fechar parceria com uma seguradora ou corretora, coloque o link (https) em `EXPO_PUBLIC_INSURANCE_URL` e o nome do botão em `EXPO_PUBLIC_INSURANCE_LABEL`. Sem isso, a ferramenta não aparece.

## 4. Anúncios (AdMob)
1. Crie a conta em https://admob.google.com e adicione o app (Android; depois iOS).
2. Crie um bloco de anúncios **Banner** em cada app.
3. Chaves: `ADMOB_ANDROID_APP_ID` / `ADMOB_IOS_APP_ID` (o *ID do app*, com `~`) e
   `EXPO_PUBLIC_ADMOB_ANDROID_BANNER` / `EXPO_PUBLIC_ADMOB_IOS_BANNER` (o *ID do bloco*, com `/`).
4. Em *Privacidade e mensagens*, crie a mensagem de consentimento (GDPR e regulamentos dos EUA). O app já mostra essa mensagem.
5. Depois que o app estiver publicado, vincule-o à loja no AdMob e publique o `app-ads.txt` (o AdMob mostra o conteúdo; coloque em `landing/app-ads.txt`).

## 5. Assinatura (RevenueCat)
1. Crie as assinaturas nas lojas (passos 7 e 8): grupo **Régua Plus**, produtos `plus_monthly` (R$ 9,90) e `plus_yearly` (R$ 99).
2. Em https://app.revenuecat.com: projeto **Régua**, apps Android e iOS, importe os dois produtos.
3. Entitlement **`plus`** com os dois produtos. Offering **default** (atual) com os pacotes **Monthly** e **Annual**.
4. Chaves públicas do SDK: `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY` e `EXPO_PUBLIC_REVENUECAT_IOS_KEY`.
5. O webhook (`billing-webhook`) é opcional nesta versão: sem contas de usuário, o app confere a assinatura direto no RevenueCat.

## 6. Erros (Sentry, opcional mas recomendado)
Crie um projeto React Native em https://sentry.io e coloque o DSN em `EXPO_PUBLIC_SENTRY_DSN`.

## 7. Google Play
1. Conta de desenvolvedor: https://play.google.com/console (US$ 25, uma vez). Verificação de identidade leva alguns dias.
2. **Contas pessoais novas precisam de um teste fechado com pelo menos 12 testadores por 14 dias** antes de liberar a produção. Comece cedo.
3. Expo: crie a conta em https://expo.dev, rode `npx eas-cli init` dentro de `regua-app/app` e guarde o ID do projeto
   na variável `EAS_PROJECT_ID` (GitHub *Variables* e seu `.env.local`). Crie um token em expo.dev › Access tokens
   e salve como *Secret* `EXPO_TOKEN` no GitHub.
4. Gere a versão de loja: Actions › *Régua store build* › plataforma `android` (ou `npx eas-cli build -p android --profile production`).
   A Expo cria e guarda a chave de assinatura definitiva. **Não perca a conta da Expo.**
5. Crie o app no Play Console, envie o primeiro `.aab` **manualmente** (o Google exige) em Teste interno.
6. Preencha *Conteúdo do app* e *Segurança dos dados* com `store/formularios.md`.
7. Ficha da loja: textos de `../replica/launch/listing.json`, ícone `assets/brand/play-store-icon-512.png`,
   imagem de destaque `store/feature-graphic-1024x500.png`, capturas `store/screenshots/android-*.png`
   (troque por capturas com dados reais quando o Supabase estiver ligado).
8. Para envios automáticos depois: crie uma conta de serviço do Google Play, envie o JSON com `npx eas-cli credentials` e use *submit = true* no workflow.

## 8. App Store (opcional, iPhone)
1. Apple Developer Program: https://developer.apple.com/programs (US$ 99/ano).
2. `npx eas-cli build -p ios --profile production` (não precisa de Mac) e `npx eas-cli submit -p ios`.
3. No App Store Connect: privacidade, classificação e nota ao revisor em `store/formularios.md`; capturas `store/screenshots/iphone-6.9-*.png`.

## 9. Antes de apertar "publicar"
- [ ] Testar no celular o APK com as chaves reais (Actions › *Régua APK*): preço real, banner, compra de teste e cancelamento.
- [ ] Mostrar o app para ~10 pessoas que consultam a FIPE todo mês (plano de lançamento).
- [ ] Trocar as capturas de tela por versões com dados reais.
- [ ] `npm audit` e atualizar o que for crítico.

# Como publicar o Valor do Carro

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
| **Histórico do veículo** (leilão, roubo/furto, sinistro, gravame, restrições, recall): relatório pago por placa, compra avulsa na loja, conferida no servidor e usada uma só vez; se falhar, a compra fica guardada para tentar de novo | `app/vehicle-history.tsx`, `server/history/`, `supabase/functions/vehicle-history`, `migrations/0008` |
| **Consultor** com IA (Claude): dúvidas de compra e venda com os dados FIPE do veículo; 5 perguntas/dia grátis, 50 no Plus, teto diário de gasto | `app/advisor.tsx`, `server/advisor/`, `supabase/functions/advisor`, `migrations/0007` |
| **Ferramentas**: comparar até 3 veículos (com gráfico), card de venda em imagem para compartilhar, relatório de preço em PDF | `app/compare.tsx`, `app/sale-card.tsx`, `app/report.tsx` |
| **Busca por placa**: campo no início, cache por placa, limite de 3/dia grátis e 30/dia no Plus, teto diário de gastos; a placa nunca é guardada em texto | `app/plate.tsx`, `server/plate/`, `supabase/functions/plate-lookup`, `migrations/0006` |
| Assinatura **Valor do Carro Plus** (remove anúncios): tela de planos, compra, restaurar, cancelar com um toque | `app/plus.tsx`, `src/services/plus.tsx` |
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
4. Actions › *Valor do Carro site* › *Run workflow*. O site fica em https://yuribh.github.io/GFPGAN/

## 2. Marca e jurídico (antes de gastar com o resto)
- Pesquise "Valor do Carro" no INPI (https://busca.inpi.gov.br), classes 9 e 42.
- Peça a um advogado para revisar `landing/privacidade.html` e `landing/termos.html`, o uso descritivo de "FIPE" e os termos da fonte de dados.

## 3. Dados reais: preencher o banco com a tabela FIPE
O jeito mais simples: o **GitHub Actions** cria as tabelas e importa a tabela FIPE para o Supabase, sem instalar nada.

1. Crie o projeto em https://supabase.com (região **São Paulo**). Guarde a senha do banco.
2. Assine o plano pago da API FIPE (https://fipe.api.br) e **peça por escrito** a autorização de uso comercial.
   Uma tabela completa tem perto de 30 mil consultas por mês; o plano grátis (cerca de 500 a 1.000 por dia) não dá conta.
3. No Supabase, abra **Project Settings › Database › Connection string**, aba **Session pooler**, e copie a URI
   (troque `[YOUR-PASSWORD]` pela senha do passo 1).
4. No GitHub, em **Settings › Secrets and variables › Actions › New repository secret**, crie:
   - `SUPABASE_DB_URL`: a URI do passo 3
   - `FIPE_API_TOKEN`: o token da API FIPE
5. Em **Actions › Valor do Carro FIPE import**, abra a última execução e clique em **Re-run all jobs** (ou rode pelo botão
   *Run workflow* depois do merge no `master`). Ele aplica as migrações e começa a importar:
   primeiro o mês mais novo, depois os 11 anteriores (o histórico do gráfico).
   Cada execução dura até 5h30 e a seguinte continua de onde parou; o agendamento roda a cada 6 horas nos dias 1 a 20
   de cada mês, então a tabela nova entra sozinha todo mês (o agendamento só vale depois do merge no `master`).
   A 60 consultas por minuto, o primeiro mês leva umas 8 horas e cada mês de histórico, outras 8.
6. Ainda no plano grátis? Crie a variável (não secret) `FIPE_REQUESTS_PER_RUN` = `900` para não passar do limite diário.
7. Ligue o app ao banco: em **Project Settings › API**, copie a *Project URL* e a chave *anon public* e crie as variáveis
   `EXPO_PUBLIC_SUPABASE_URL` e `EXPO_PUBLIC_SUPABASE_ANON_KEY` (GitHub *Variables* e Expo *env*). O próximo APK já usa dados reais.
8. Ative os backups diários (Database › Backups). Para conferir: no SQL Editor, `select count(*) from price_points;`

Alternativa sem GitHub: no computador, `DATABASE_URL=... node scripts/migrate.mts` e
`DATABASE_URL=... FIPE_API_TOKEN=... node scripts/import-fipe.mts --months 12`.

**As funções do Supabase (passos 3b, 3c, 3e)** e o `supabase/schedule.sql` continuam valendo para placa, consultor e
histórico. A função `ingest-fipe` é uma alternativa ao import pelo GitHub; não precisa das duas.

## 3b. Busca por placa (fornecedor pago)
Como funciona: a pessoa digita a placa → a função `plate-lookup` (no Supabase, onde a chave do fornecedor fica escondida)
pergunta ao fornecedor marca, modelo, ano e **código FIPE** → o app abre o preço FIPE desse código. Se o código já está no
seu banco (importação do passo 3), vem de lá; se ainda não está, o app busca o preço direto na API da FIPE. Placas repetidas
vêm do cache (sem custo); a placa é guardada só como código embaralhado.

Cada consulta nova custa dinheiro ao fornecedor (preços vistos: perto de R$ 0,80–1,00 por consulta).
1. Escolha um fornecedor de consulta **veicular** (só dados do veículo, sem dados do proprietário) que devolva o **código FIPE**.
   Exemplos encontrados: Consultar Placa, WebXcar, FipeAPI, Direct Data. Peça por escrito: origem dos dados, permissão de uso em app, LGPD, preço.
2. Crie o projeto no Supabase (passo 3) e cadastre no GitHub (Settings › Secrets and variables › Actions):
   - Variável `SUPABASE_PROJECT_REF`: o código do projeto (o pedaço `xxxx` de `https://xxxx.supabase.co`).
   - Segredo `SUPABASE_ACCESS_TOKEN`: supabase.com › Account › Access Tokens › Generate new token.
   - Segredo `SUPABASE_DB_URL`: o mesmo do passo 3.
   - Segredos do fornecedor: `PLATE_API_URL` (ex.: `https://api.fornecedor.com/v1/placa/{plate}`), `PLATE_API_TOKEN`,
     `PLATE_API_AUTH` (`bearer`, `header:Nome-Do-Header` ou `query:nome_do_parametro`, conforme a documentação dele).
   - Segredo `PLATE_HASH_PEPPER`: qualquer texto longo e aleatório (ex.: o resultado de `openssl rand -hex 32`). Não troque depois.
3. Actions › **Valor do Carro Supabase deploy** › Run workflow. Ele cria as tabelas, envia os segredos, publica as funções e confere
   que `plate-lookup` está no ar.
4. Variáveis do app `EXPO_PUBLIC_SUPABASE_URL` e `EXPO_PUBLIC_SUPABASE_ANON_KEY` (passo 3) e rode **Valor do Carro APK**: o APK novo
   já consulta placas de verdade.
5. **Me mande um exemplo de resposta do fornecedor** (com dados de teste): o leitor da resposta (`server/plate/provider.ts`)
   entende os formatos comuns, mas vale confirmar os nomes dos campos e adicionar um teste com o formato real.
6. Limites (opcionais, segredos ou padrão): `PLATE_FREE_DAILY` (3 por aparelho/dia), `PLATE_PLUS_DAILY` (30),
   `PLATE_GLOBAL_DAILY` (300 consultas pagas por dia ≈ R$ 300 no pior caso). Para mudar, adicione no `Function secrets`
   do workflow ou rode `npx supabase secrets set PLATE_GLOBAL_DAILY=...`.
7. Variável do GitHub `REGUA_PLATE_PROVIDER` com o nome do fornecedor: preenche a política de privacidade.
8. Sem fornecedor configurado, a busca por placa responde "indisponível agora" e oferece a busca por marca e modelo.

## 3c. Consultor (IA)
1. Crie uma conta em https://platform.claude.com, adicione créditos e gere uma API key.
2. Rode a migração `0007_feature_quota.sql` e publique a função:
   ```
   npx supabase secrets set ANTHROPIC_API_KEY=... ADVISOR_FREE_DAILY=5 ADVISOR_PLUS_DAILY=50 ADVISOR_GLOBAL_DAILY=2000
   npx supabase functions deploy advisor
   ```
3. Custo: cada pergunta usa o modelo Claude Opus 5.5 com esforço baixo e respostas curtas. `ADVISOR_GLOBAL_DAILY` é o teto de perguntas por dia no app todo; ajuste ao orçamento e acompanhe o gasto no painel da Anthropic.
4. Sem a chave, o Consultor responde "indisponível agora".

## 3e. Histórico do veículo (relatório pago)
1. Contrate um fornecedor de **dados veiculares** com API (leilão, roubo/furto, sinistro, gravame, restrições). Exemplo que menciona API: Concar. Peça por escrito: fontes de cada item (Renajud, SNG etc.), preço por consulta, LGPD e permissão de revenda em app.
2. Crie o produto consumível `historico_veicular` nas lojas e importe no RevenueCat (`store/formularios.md`). O preço é definido na loja.
3. Rode a migração `0008_vehicle_history.sql` e publique a função:
   ```
   npx supabase secrets set HISTORY_API_URL='https://.../{plate}' HISTORY_API_TOKEN=... HISTORY_API_AUTH=bearer
   npx supabase functions deploy vehicle-history
   ```
   Ela usa os mesmos `PLATE_HASH_PEPPER` e `REVENUECAT_SECRET_KEY` da busca por placa.
4. **Me mande um exemplo de resposta do fornecedor** para eu confirmar os campos e adicionar um teste com ele.
5. Variável do GitHub `REGUA_HISTORY_PROVIDER` com o nome do fornecedor (preenche a política de privacidade).

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
1. Crie as assinaturas nas lojas (passos 7 e 8): grupo **Valor do Carro Plus**, produtos `plus_monthly` (R$ 9,90) e `plus_yearly` (R$ 99).
2. Em https://app.revenuecat.com: projeto **Valor do Carro**, apps Android e iOS, importe os dois produtos.
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
4. Gere a versão de loja: Actions › *Valor do Carro store build* › plataforma `android` (ou `npx eas-cli build -p android --profile production`).
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
- [ ] Testar no celular o APK com as chaves reais (Actions › *Valor do Carro APK*): preço real, banner, compra de teste e cancelamento.
- [ ] Mostrar o app para ~10 pessoas que consultam a FIPE todo mês (plano de lançamento).
- [ ] Trocar as capturas de tela por versões com dados reais.
- [ ] `npm audit` e atualizar o que for crítico.

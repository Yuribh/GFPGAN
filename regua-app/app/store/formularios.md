# Respostas para os formulários das lojas

Baseado no que o app faz hoje: sem conta, favoritos só no aparelho, contagem anônima de uso (Supabase),
relatórios de erro (Sentry), um banner do AdMob e a assinatura Régua Plus (RevenueCat).
Se você desligar algum desses serviços, ajuste as respostas. Releia na hora de preencher: os formulários mudam.

## Google Play: Segurança dos dados (Data safety)

**O app coleta ou compartilha algum dos tipos de dados exigidos?** Sim.
**Todos os dados coletados são criptografados em trânsito?** Sim.
**Você oferece uma forma de os usuários pedirem a exclusão dos dados?** Sim, pelo e-mail de contato (o app não tem conta).
URL para pedido de exclusão: `https://yuribh.github.io/GFPGAN/privacidade.html` (seção "Suas escolhas e seus direitos").

| Tipo de dado (nome no formulário) | Coletado | Compartilhado | Opcional? | Finalidades |
| --- | --- | --- | --- | --- |
| Local › Local aproximado (o AdMob estima pela rede) | Sim | Sim (Google) | Não | Publicidade ou marketing; Análise |
| Atividade no app › Interações com o app (eventos anônimos e do AdMob) | Sim | Sim (Google, só o do AdMob) | Não | Análise; Publicidade ou marketing |
| Informações e desempenho do app › Registros de falhas | Sim | Não | Não | Análise; Funcionalidade do app |
| Informações e desempenho do app › Diagnóstico | Sim | Não | Não | Análise; Funcionalidade do app |
| Dispositivo ou outros IDs (ID de publicidade) | Sim | Sim (Google) | Não | Publicidade ou marketing; Análise; Prevenção contra fraudes, segurança e conformidade |
| Informações financeiras › Histórico de compras (assinatura Plus) | Sim | Não | Sim (só quem assina) | Funcionalidade do app |
| Outros tipos de dados › Outras ações / conteúdo (placa digitada na busca por placa) | Sim | Sim (fornecedor de consulta veicular) | Sim (só quem usa a busca por placa) | Funcionalidade do app |
| Dispositivo ou outros IDs (código aleatório do app, só na busca por placa) | Sim | Não | Sim | Funcionalidade do app; Prevenção contra fraudes, segurança e conformidade |

Não marque: informações pessoais (nome, e-mail, endereço, telefone), mensagens, fotos, áudio, arquivos, agenda, contatos, saúde, local exato.
Observação: os dados de pagamento ficam com o Google Play, então "Informações de pagamento" não é coletado pelo app.

**Declaração de ID de publicidade** (Conteúdo do app › ID de publicidade): Sim, usa. Finalidades: Publicidade ou marketing; Análise.

## Google Play: outras declarações (Conteúdo do app)

- **Política de privacidade:** `https://yuribh.github.io/GFPGAN/privacidade.html`
- **Anúncios:** Sim, o app contém anúncios.
- **Acesso ao app:** Todas as funcionalidades estão disponíveis sem acesso especial (não há login).
- **Público-alvo:** 18 anos ou mais (evita as regras de apps para crianças e combina com o assunto: compra e venda de veículos).
- **App de notícias / governo / saúde / financeiro:** Não. (Mostra preço de referência; não oferece crédito, investimento nem pagamentos entre pessoas.)
- **Classificação de conteúdo (questionário IARC):** categoria "Utilitário, produtividade, comunicação ou outro". Responda Não para violência, sexo, linguagem, drogas, jogos de azar e interação entre usuários. Sim para "compras digitais". Resultado esperado: **Livre (L)**.

## App Store: Privacidade do app (App Privacy)

**Você ou seus parceiros coletam dados deste app?** Sim.
**Rastreamento (tracking):** Não. O app não pede a permissão de rastreamento (ATT), então o AdMob não usa o IDFA; os anúncios no iPhone não são personalizados com dados de outros apps.

Todos abaixo: **Não vinculados à identidade do usuário**, **Não usados para rastreamento**.

| Categoria › tipo | Finalidades |
| --- | --- |
| Localização › Localização aproximada | Publicidade de terceiros; Análises |
| Identificadores › ID do dispositivo | Publicidade de terceiros; Análises |
| Uso › Interação com o produto | Análises; Publicidade de terceiros |
| Uso › Dados de publicidade | Publicidade de terceiros |
| Diagnóstico › Dados de falhas | Funcionalidade do app; Análises |
| Diagnóstico › Dados de desempenho | Funcionalidade do app |
| Compras › Histórico de compras | Funcionalidade do app |
| Outros dados › Outros tipos de dados (placa digitada) | Funcionalidade do app |

- **URL da política de privacidade:** `https://yuribh.github.io/GFPGAN/privacidade.html`
- **URL de suporte:** `https://yuribh.github.io/GFPGAN/suporte.html`
- **Classificação etária:** responda "Nenhum" para todos os conteúdos; sem acesso irrestrito à web; sem jogos de azar. Resultado esperado: **4+**.
- **Criptografia (export compliance):** já respondido no app (`usesNonExemptEncryption: false`, só HTTPS).

## Assinaturas (as duas lojas)

- Grupo: **Régua Plus**. Produtos: `plus_monthly` (R$ 9,90/mês) e `plus_yearly` (R$ 99,00/ano).
- No RevenueCat: entitlement **`plus`** com os dois produtos; offering **default** (marcada como atual) com os pacotes **Monthly** e **Annual**. O app lê esses nomes.
- Nome de exibição: "Régua Plus mensal" / "Régua Plus anual". Descrição: "Use a Régua sem anúncios."
- Apple exige uma captura da tela de assinatura para a revisão: use a tela Sobre › Régua Plus no app instalado pelo TestFlight.

## Nota para o revisor (App Review / Google)

```
A Régua não exige login: todas as funções estão disponíveis ao abrir o app.
Para testar: toque em Carros, escolha uma marca, um modelo e um ano para ver o preço da tabela FIPE.
Busca por placa: digite uma placa no campo "Buscar pela placa" (limite de 3 por dia no plano grátis). O app mostra apenas dados do veículo, nunca do proprietário.
A assinatura Régua Plus (Sobre > Régua Plus) apenas remove o banner de anúncio; a consulta é sempre gratuita.
Cancelamento: Sobre > Gerenciar ou cancelar assinatura abre a tela de assinaturas da loja.
A Régua não é afiliada à Fundação Instituto de Pesquisas Econômicas (FIPE); exibimos os valores públicos da tabela como referência.
```

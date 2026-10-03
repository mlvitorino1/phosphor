# Funcionalidades e operação do Phosphor

Plataforma de monitoramento de eventos globais. A identidade Phosphor aparece na página inicial, no cabeçalho, na entrada e no ícone do site.

## O que está pronto

- Página inicial com a marca Phosphor, globo interativo, pontos de eventos e identidade visual escura.
- Mapa mundial com agrupamento de pontos, áreas regionais aproximadas e alternância entre mapa plano e globo. Tornados e furacões permanecem visíveis com ícones próprios mesmo em escala global; terremotos, vulcões, inundações, incêndios e tempestades também têm símbolos próprios. Notícias usam um ícone de jornal com a palavra NEWS no mapa, nas listas e nos detalhes, independentemente do tema; o ícone permanece visível mesmo quando os demais pontos são agrupados. O nível EF aparece como número somente quando confirmado.
- Busca e filtros por tema, natureza do registro, impacto, horário da última atualização, região e país informado pela fonte.
- Lista de eventos e página individual com localização, métricas, atualizações e links das fontes.
- Leitura de 13 fontes públicas: USGS, NASA EONET, GDACS, NOAA/NWS, GeoMet Canadá, MeteoAlarm, NOAA/NHC, NOAA Tsunami, JMA, Copernicus EMS, GeoNet, IFRC GO e OMS. A NASA FIRMS é ativada ao fornecer `FIRMS_MAP_KEY`. Cada fonte é buscada separadamente; a falha de uma não impede a exibição das outras.
- Distinção entre ocorrência, alerta e observação. Polígonos oficiais são usados quando disponíveis; marcadores no centro de um país ou área são identificados como aproximados.
- Deduplicação automática por tipo, localização, horário e nome, mantendo múltiplas fontes vinculadas ao mesmo evento. Ciclones nomeados são reconhecidos entre idiomas e órgãos; notícias aprovadas sobre a mesma ocorrência são reunidas por tema, região, proximidade, período e semelhança da manchete. A captura também elimina URLs com parâmetros de rastreamento e republicações idênticas no mesmo veículo.
- Administração de Marcus para revisar impacto, status, localização, visibilidade e nível EF confirmado de tornados. O número EF aparece no ícone somente quando confirmado.
- Configurações de fontes para pausar ou reativar cada feed, a busca geral do GDELT, os canais CNN, BBC News e Globo/g1 descobertos pelo GDELT, e o rastreador de notícias da Agência Brasil.
- Descoberta periódica de notícias pelo GDELT e por RSS e páginas de seção da Agência Brasil. O rastreador consulta feeds públicos, identifica links de matérias, respeita `robots.txt` para as páginas HTML e verifica a data da publicação antes de criar um candidato. Os resultados entram na mesma base, com URL canônica e eliminação de republicações idênticas; candidatos com local identificável podem aparecer diretamente no mapa. A abrangência em mais de 100 idiomas é do monitoramento feito pelo GDELT; o rastreador direto desta versão cobre a Agência Brasil em português.
- Painel de notícias organizado em fila de revisão, mapa e arquivo, com cartões curtos e sugestões automáticas de tema, impacto, contexto, local e segunda fonte quando há indícios. Manchetes recentes com sinal de evento e país ou cidade identificável são publicadas automaticamente; se apenas o país for identificado, o ponto fica na capital como referência aproximada, sem afirmar que o evento ocorreu ali. Marcus pode corrigir, remover aprovação, descartar, bloquear, mover para a lixeira e restaurar. Notícias sem local identificável ficam pendentes.
- Acervo histórico separado em `/historico`, com períodos importados do banco de eventos GDELT, busca, filtro de tema e mapa. A entrega inclui amostras reais de 1979, 1989, 1999, janeiro de 2009, um dia de 2019 e um recorte brasileiro de 1979. O importador em fluxo lê arquivos ZIP oficiais, seleciona eventos codificados com localização, reduz duplicatas idênticas e limita a amostra por período.
- Prazos automáticos para revisar e exibir notícias. Pendentes têm prazo de revisão de 24 horas, reduzido a 8 horas para alto impacto e 2 horas para impacto crítico após a classificação. Notícias aprovadas ficam no mapa por 2 a 5 dias conforme o tema, com acréscimo de 1 dia para alto impacto ou 2 dias para impacto crítico. Eventos de alto impacto ou críticos em temas com possíveis consequências posteriores recebem mais 2 ou 4 dias, respectivamente. O painel mostra os prazos, identifica os vencidos e permite renovar a aprovação após nova revisão; notícias vencidas saem automaticamente do mapa. Alertas de órgãos oficiais seguem a validade definida pela própria fonte.
- Ingestão agendada preparada para Vercel, com histórico de mudanças em PostgreSQL.
- Entrada integrada a `/mapa?entrar=1`: o mesmo mapa começa como globo sem eventos, apresenta login, cadastro e recuperação de senha e permanece montado durante toda a transição. Após autenticação, a localização é solicitada apenas por ação do usuário e usada no navegador para aproximar o globo. A câmera começa lentamente, acelera na aproximação e estabiliza no destino; os eventos surgem em lotes e os painéis entram em sequência. Há opção de continuar sem localização. `/entrar` redireciona para esse fluxo.
- Triagem de notícias com **cadeia de suprimentos como prioridade**, ao lado de Agro, ESG, Mercado financeiro, Seguros e Risco político. O score de risco é uma regra de priorização baseada no impacto revisado, contexto logístico e região confirmada; o índice de fonte mostra evidências observáveis, como confirmação em domínio distinto, coberturas semelhantes e revisão humana. Nenhum dos dois representa probabilidade de ocorrência ou veracidade.
- A busca do GDELT separa emergências e cadeia de suprimentos em duas consultas multilíngues, além de uma consulta direcionada aos domínios de CNN, BBC News e Globo/g1. Títulos precisam conter sinal relevante antes de entrar na fila. A Agência Brasil segue como fonte brasileira rastreada diretamente. Manchetes parecidas entre veículos são identificadas para corroboração, além da deduplicação de URL e da reunião de notícias aprovadas sobre a mesma ocorrência.
- Extração assistida por LLM no painel de Marcus: ele cola um trecho da publicação e recebe sugestões de resumo, tema, impacto, entidades, relações e causalidade explícita com citações literais validadas contra o trecho. O texto integral da matéria não é rastreado para esta função. A IA não publica; ainda são obrigatórios revisão do local, coordenadas e confirmação independente. Configure `OPENAI_API_KEY` e `OPENAI_MODEL` para ativá-la.
- Página `/alertas` com preferências de e-mail, limite de risco e filtros de cadeia de suprimentos e América Latina, ambos ativados por padrão. A ativação exige confirmação do endereço por e-mail. Apenas notícias com revisão humana disparam alertas externos; a rotina de 15 minutos repete a verificação como garantia, com chave de entrega para evitar reenvio. Webhooks Slack e ERP são opcionais para notícias revisadas da vertical na América Latina e configurados por variáveis de ambiente; não há envio sem credenciais e URL configuradas.

## Executar localmente

Requer Node.js 24 ou mais recente.

```bash
npm ci
npm run dev
```

Abra `http://localhost:3000`. O mapa e a lista funcionam com os feeds públicos sem configuração adicional. Há cache de cinco minutos para as consultas às fontes; a tela do mapa verifica novas informações a cada cinco minutos.

No primeiro acesso a `http://localhost:3000/admin`, Marcus cria a própria senha, com pelo menos 12 caracteres. A senha é armazenada localmente como hash em `data/local-state.json`; esse arquivo não entra no pacote de código. Depois do login, o botão **Marcus** abre `/configuracoes`, com **Configurar fontes**, **Painel de notícias** e **Revisar eventos**. Notícias elegíveis entram no mapa automaticamente com o estado de publicação identificado; remover a aprovação retira a notícia do mapa e impede republicação automática. Bloqueios e exclusões ficam no painel e não são recapturados automaticamente; a exclusão é reversível pela lixeira. A seleção em lote alcança todas as notícias pendentes, e a aprovação manual ignora cartões sem revisão completa. O GDELT pode limitar temporariamente consultas; o painel conserva cartões já capturados e informa a falha. O rastreador brasileiro continua funcionando separadamente.

**Entrar e alertas:** o link **Entrar** no cabeçalho abre `/mapa?entrar=1`. No desenvolvimento local, contas podem ser criadas sem banco; em produção, configure `DATABASE_URL` e `USER_SESSION_SECRET`. A localização fica apenas na memória do navegador durante a sessão e não é salva na conta. Recuperação e confirmação de e-mail dependem de `RESEND_API_KEY` e `MAIL_FROM`; alertas não podem ser ativados sem endereço confirmado. A revisão manual tenta entregar os alertas elegíveis imediatamente; falhas transitórias são tentadas novamente pela rotina de 15 minutos. A verificação da conta e do risco não substitui a checagem do órgão e da notícia original.

## Importar outros períodos históricos

O acervo é gerado em `public/history/` e pode ser explorado em `/historico` após a importação. Os arquivos incluídos são amostras, não o banco integral. A seleção prioriza eventos raiz com coordenadas e maior número de menções; o filtro de país usa o código de país do GDELT.

```bash
npm run history:import -- 1979 --limit=250
npm run history:import -- 1979 --country=BR --limit=150
npm run history:import -- 200901 --limit=250
npm run history:import -- 20190101 --limit=250
```

Use ano de 1979 a 2005, mês de 200601 a 201303, ou dia no formato `YYYYMMDD` desde 20130401. O importador limita cada ZIP comprimido a 220 MB e cada arquivo resultante a 2.000 registros. Para publicar um novo período em uma implantação estática, execute a importação antes do build e inclua o JSON gerado no deploy. A série anterior a abril de 2013 geralmente não fornece URL do artigo original; a interface aponta ao arquivo oficial e identifica essa limitação. Esses dados são eventos sociopolíticos codificados, não textos integrais de notícias antigas nem alertas ativos.

## Ativar histórico e administração

Copie `.env.example` para `.env.local` e defina:

| Variável                                | Uso                                                                                                        |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`                          | Conexão PostgreSQL usada para persistir eventos e revisões.                                                |
| `ADMIN_PASSWORD`                        | Senha de Marcus para acesso à página `/admin` em produção.                                                 |
| `ADMIN_SESSION_SECRET`                  | Chave aleatória longa para assinar a sessão.                                                               |
| `CRON_SECRET`                           | Chave exigida por `/api/ingest`.                                                                           |
| `FIRMS_MAP_KEY`                         | Chave gratuita da NASA FIRMS para ativar grupos de detecções térmicas por satélite.                        |
| `USER_SESSION_SECRET`                   | Segredo longo exclusivo para assinar as sessões das contas públicas em produção.                           |
| `PUBLIC_APP_URL`                        | Origem HTTPS pública usada nos links de confirmação e recuperação por e-mail em produção.                  |
| `OPENAI_API_KEY` e `OPENAI_MODEL`       | Ativam a extração assistida no painel de notícias; defina explicitamente o modelo disponível na sua conta. |
| `RESEND_API_KEY` e `MAIL_FROM`          | Recuperação de senha, confirmação de e-mail e alertas; `MAIL_FROM` deve usar remetente autorizado.         |
| `SLACK_WEBHOOK_URL`                     | Webhook opcional para alertas de cadeia de suprimentos com score 60 ou maior.                              |
| `ERP_WEBHOOK_URL` e `ERP_WEBHOOK_TOKEN` | Webhook HTTPS opcional para o ERP, com token Bearer se fornecido.                                          |

Execute `npm run db:migrate` antes de iniciar a aplicação com PostgreSQL. A aplicação verifica a versão do esquema e não executa DDL durante as requisições. Depois de configurar o banco, execute uma ingestão inicial por `GET /api/ingest` com o cabeçalho `Authorization: Bearer <CRON_SECRET>`. A página `/admin` passa a exibir os eventos persistidos. Somente quem possui a senha pode alterar eventos. As revisões, preferências de fontes e cartões de notícias sobrevivem a novas ingestões.

`vercel.json` programa a ingestão dos feeds e a descoberta de notícias a cada 15 minutos. Essa frequência requer um plano Vercel que aceite Cron Jobs com intervalo inferior a um dia. Configure as quatro variáveis administrativas no ambiente de produção antes do deploy. A chave FIRMS é opcional.

## Verificações

```bash
npm run lint
npm run build
```

## Limites desta versão

- Ainda não há fonte estruturada de conflitos e segurança. [ACLED](https://acleddata.com/eula) exige licença adequada para republicar dados; o [IPAWS](https://www.fema.gov/emergency-managers/practitioners/integrated-public-alert-warning-system/technology-developers) requer autorização de acesso. Notícias descobertas no [GDELT](https://gdeltproject.org/data.html) são exibidas como relatos jornalísticos, sem equivalência a alertas oficiais.
- A descoberta por notícias usa a [API DOC 2.0 do GDELT](https://blog.gdeltproject.org/gdelt-doc-2-0-api-debuts/). O GDELT pode impor limites de consulta e não confirma sozinho o local ou a ocorrência. Publicação automática exige sinal de evento na manchete e país ou cidade sem ambiguidade. A capital é uma referência geográfica quando só há país; não representa o local do fato.
- A consulta multilíngue do GDELT inclui publicações em português e espanhol; o idioma e o país do veículo não determinam o país do evento. Apenas a manchete é usada na triagem inicial; o país do veículo nunca define o ponto no mapa. A semelhança de manchetes indica possível cobertura da mesma história, sem provar independência editorial.
- Os canais CNN, BBC News e Globo/g1 são descobertos pelo índice GDELT, com verificação do domínio da URL original e controles individuais de pausa. O sistema guarda manchete, data, URL e metadados recebidos; não copia o corpo ou as imagens das matérias. A indisponibilidade ou limitação de consultas do GDELT também afeta esses três canais. O uso direto de feeds, metadados ou conteúdo protegido em contexto empresarial depende das permissões de cada veículo.
- A extração por IA usa somente texto colado pelo administrador; o conteúdo é enviado ao provedor configurado. Citações não encontradas literalmente no trecho são descartadas. A análise pode omitir fatos ou sugerir classificações incorretas e precisa de revisão humana.
- Os alertas dependem da rotina agendada, do serviço de e-mail e dos webhooks configurados. Não são instantâneos. Apenas notícias aprovadas nas últimas 24 horas são candidatas; notícias antigas não provocam disparo retroativo.
- O rastreador direto usa apenas título, data e URL da Agência Brasil, sem copiar corpo ou imagem das matérias. A consulta de páginas é suplementar ao RSS e depende das permissões em `robots.txt` e de uma data publicada verificável.
- O [arquivo histórico do GDELT](https://gdeltproject.org/data.html) contém classificações e localizações automatizadas. A página mostra amostras por período e não deve ser usada como confirmação factual sem consultar outras fontes. Antes de 2013, a estrutura histórica não inclui URL da notícia de origem.
- A NASA FIRMS exige `FIRMS_MAP_KEY`. Seus focos de calor são observações de satélite e não comprovam incêndios por si só.
- A classificação de impacto é inicial e varia conforme os dados disponíveis em cada fonte. Consulte o órgão original para decisões operacionais.
- Círculos de alcance regional são aproximações visuais; quando um polígono oficial está disponível, ele é desenhado no mapa. Nenhum círculo representa automaticamente uma trajetória.
- O país só aparece no filtro quando a fonte informa um nome reconhecível. Eventos oceânicos ou com localização imprecisa continuam pesquisáveis pelo título e lugar.
- Em produção, a administração e o histórico persistente exigem PostgreSQL e as variáveis administrativas. No desenvolvimento local, o primeiro acesso pode ser criado sem banco.
- Backups, métricas de produção e proteção distribuída contra abuso precisam ser configurados no provedor de hospedagem e banco antes de uso operacional amplo.

## Fontes e mapa

- [USGS — feed GeoJSON](https://earthquake.usgs.gov/earthquakes/feed/v1.0/geojson.php)
- [NASA EONET — API v3](https://eonet.gsfc.nasa.gov/docs/v3)
- [GDACS — API](https://www.gdacs.org/gdacsapi/swagger/index.html)
- [NOAA/NWS — alertas](https://www.weather.gov/documentation/services-web-alerts)
- [GeoMet Canadá — alertas](https://api.weather.gc.ca/collections/weather-alerts/queryables?f=html)
- [MeteoAlarm — feeds](https://feeds.meteoalarm.org/)
- [NOAA/NHC — ciclones](https://www.nhc.noaa.gov/CurrentStorms.json)
- [NOAA Tsunami — produtos](https://www.tsunami.gov/?page=productRetrieval)
- [JMA — XML](https://xml.kishou.go.jp/xmlpull.html)
- [Copernicus EMS — mapeamento](https://mapping.emergency.copernicus.eu/about/how-to-harvest-cems-mapping-data/emergency-response-data/)
- [GeoNet — API](https://api.geonet.org.nz/)
- [IFRC GO — API](https://go-wiki.ifrc.org/en/go-api/using_authorization_token)
- [OMS — avisos de surtos](https://www.who.int/api/hubs/diseaseoutbreaknews/sfhelp)
- [NASA FIRMS — API](https://firms.modaps.eosdis.nasa.gov/api/area/)
- [MapLibre GL JS](https://maplibre.org/maplibre-gl-js/docs/) com mapa base CARTO e atribuição OpenStreetMap exibida na interface.

Os eventos podem ser corrigidos ou retirados pelas fontes. A plataforma mostra o horário de atualização e os links originais em cada página individual.

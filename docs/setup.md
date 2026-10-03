# Configuração e implantação

## Exploração local

Use Node.js 24+. `npm ci` instala o lockfile; `npm run dev` inicia a aplicação. Mapas e feeds são públicos, mas exigem rede e WebGL. Você pode explorar sem arquivo de ambiente.

Se quiser configurar integrações, copie `.env.example` para `.env.local`. Ele vem com valores vazios, permitindo ativar somente o necessário. Não compartilhe esse arquivo.

## PostgreSQL

1. Crie um banco PostgreSQL 17 ou compatível.
2. Configure `DATABASE_URL`, usando TLS conforme o provedor.
3. Execute `npm run db:migrate` antes de iniciar ou atualizar o servidor.
4. Defina os segredos de contas/administração para habilitar esses fluxos em produção.

Opcionalmente, use `DATABASE_MIGRATION_URL` para a conta com DDL e mantenha `DATABASE_URL` com a conta da aplicação. A migração é transacional e tem checksum: crie uma nova migração para cada mudança, sem editar as anteriores.

Não há ferramenta para transferir automaticamente contas do JSON local para PostgreSQL. Trate o armazenamento local como desenvolvimento; configure o acesso administrativo do ambiente de produção pelas variáveis abaixo.

## Variáveis de ambiente

| Variável                               | Quando usar                                                                       |
| -------------------------------------- | --------------------------------------------------------------------------------- |
| `DATABASE_URL`                         | Persistência, contas, administração e controles compartilhados em produção.       |
| `DATABASE_MIGRATION_URL`               | Opcional, conexão exclusiva para migrações com permissão de DDL.                  |
| `ADMIN_PASSWORD`                       | Senha administrativa de 12 a 256 caracteres. Nome de entrada: Marcus.             |
| `ADMIN_SESSION_SECRET`                 | Segredo administrativo exclusivo, mínimo de 32 caracteres.                        |
| `USER_SESSION_SECRET`                  | Segredo exclusivo para contas públicas, mínimo de 32 caracteres.                  |
| `CRON_SECRET`                          | Autorização da captura agendada.                                                  |
| `PUBLIC_APP_URL`                       | Origem HTTPS pública, sem caminho/query, para recuperação, verificação e alertas. |
| `FIRMS_MAP_KEY`                        | Ativa observações de focos de calor da NASA FIRMS.                                |
| `OPENAI_API_KEY`, `OPENAI_MODEL`       | Extração assistida pelo modelo escolhido pelo operador.                           |
| `RESEND_API_KEY`, `MAIL_FROM`          | Recuperação, verificação e alertas por e-mail; remetente autorizado.              |
| `SLACK_WEBHOOK_URL`                    | Webhook HTTPS opcional de alertas revisados.                                      |
| `ERP_WEBHOOK_URL`, `ERP_WEBHOOK_TOKEN` | Integração HTTPS opcional; Bearer quando fornecido.                               |
| `TEST_DATABASE_URL`                    | Somente testes, obrigatoriamente apontando a `phosphor_test`.                     |

Gere segredos aleatórios exclusivos; nunca reutilize a senha como segredo de sessão. A rotação de senha ou segredo invalida cookies anteriores.

## Hospedagem

```bash
npm ci
npm run db:migrate  # quando DATABASE_URL estiver configurada
npm run check
npm run build
npm start
```

O build inclui apenas o código e o worker do MapLibre. Em produção, dados locais são ignorados. Um build sem banco permite exploração dos feeds, mas não contas nem administração persistente.

`vercel.json` declara captura a cada 15 minutos; confirme que o plano contratado aceita essa frequência. Em outro host, configure o agendador para chamar `GET /api/ingest` com `Authorization: Bearer <CRON_SECRET>`. Essa rota também pode enviar alertas, se as integrações estiverem ativas.

O proxy deve reescrever cabeçalhos de endereço/protocolo. Configure HTTPS, backups do banco e retenção operacional de logs. O projeto não cria infraestrutura de hospedagem automaticamente.

## Testes de PostgreSQL

Prepare um banco separado `phosphor_test`, aplique as migrações a ele e passe `TEST_DATABASE_URL` para `npm test`. A CI usa um serviço PostgreSQL isolado para executar esses testes, sem precisar de credenciais externas.

Exemplo em PowerShell:

```powershell
$env:DATABASE_URL = 'postgresql://user:password@localhost:5432/phosphor_test'
npm run db:migrate
$env:TEST_DATABASE_URL = $env:DATABASE_URL
npm test
Remove-Item Env:DATABASE_URL, Env:TEST_DATABASE_URL
```

## Importar histórico

```bash
npm run history:import -- 1979 --country=BR --limit=150
npm run history:import -- 20190101 --limit=250
```

Os JSONs são gravados em `public/history/`, com origem e data da importação, e entram no próximo build. Há limites de tamanho e quantidade. Consulte [funcionalidades](features.md) para formatos aceitos e limitações das amostras.

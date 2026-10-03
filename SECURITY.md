# Segurança

## Relatar uma vulnerabilidade

Evite publicar senhas, tokens, e-mails pessoais ou instruções de exploração em uma issue aberta. Use o canal privado de reporte de vulnerabilidades do GitHub quando habilitado, ou peça ao mantenedor um canal privado. Não existe compromisso de SLA de resposta neste projeto de portfólio.

## Proteções implementadas

- Senhas de contas locais/públicas derivadas com scrypt, salt aleatório e comparação constante.
- Sessões assinadas, com expiração, cookies `HttpOnly`, `SameSite=Strict` e `Secure` em produção.
- Sessões vinculadas à credencial atual; a redefinição de senha revoga os cookies anteriores.
- Comparação de origem e autorização em endpoints de alteração.
- Validação com Zod e limite de bytes antes de analisar corpos de requisição.
- Limites de tentativas compartilhados no PostgreSQL; fallback limitado em memória no desenvolvimento.
- SQL parametrizado; migrações executadas separadamente do tráfego da aplicação.
- Fronteira `server-only` para credenciais, armazenamento e integrações.
- Arquivos de conta, segredos, estado de navegador e builds ignorados pelo Git.

## Configuração do operador

Use HTTPS, segredos exclusivos de pelo menos 32 caracteres, backups e uma conexão PostgreSQL com privilégios mínimos. O proxy deve substituir `x-forwarded-for` e `x-forwarded-proto`; não preserve valores enviados livremente pelo cliente. Use uma conta com DDL somente na migração, e uma conta de aplicação para o tráfego normal.

Configure os segredos no ambiente de hospedagem. Nunca os inclua no repositório, nas capturas de tela ou em um arquivo público. `.env.example` contém apenas nomes e valores vazios.

## Limites

A autenticação é uma implementação local pequena, sem MFA, OAuth ou painel de sessões por dispositivo. Para uma operação com requisitos maiores, planeje um provedor de identidade. A aplicação depende de provedores públicos e regras heurísticas; não é um sistema oficial de emergência.

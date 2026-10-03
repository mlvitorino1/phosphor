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
- Logs de falha limitados a contexto estático e tipo conhecido, sem mensagens, causas ou URLs de provedores.
- Tokens de recuperação/verificação enviados no fragmento do link, removidos pela interface e trocados por POST; expiração e uso único no servidor.
- Requisições NASA FIRMS com chave na URL não usam cache persistente e recusam redirecionamentos.
- CI com Gitleaks e histórico completo, regras adicionais para credenciais da aplicação e URLs de banco.

## Configuração do operador

Use HTTPS, segredos exclusivos de pelo menos 32 caracteres, backups e uma conexão PostgreSQL com privilégios mínimos. O proxy deve substituir `x-forwarded-for` e `x-forwarded-proto`; não preserve valores enviados livremente pelo cliente. Use uma conta com DDL somente na migração, e uma conta de aplicação para o tráfego normal.

Configure os segredos no ambiente de hospedagem. Nunca os inclua no repositório, nas capturas de tela ou em um arquivo público. `.env.example` contém apenas nomes e valores vazios.

## Antes de publicar

`npm run security:files` verifica os arquivos rastreados e o template de ambiente. Instale [Gitleaks](https://github.com/gitleaks/gitleaks), versão 8.30.1 ou compatível, e execute `npm run security:scan` para varrer o histórico. A CI baixa a versão fixada, confere SHA-256 e faz essa varredura em cada envio e pull request. Use `--redact` também em auditorias manuais; relatórios de scanners podem conter segredos.

As únicas exceções de credenciais no scanner são senhas sintéticas específicas para PostgreSQL descartável e testes isolados de autenticação/erros, nos caminhos declarados na configuração. Nenhum arquivo de ambiente real é permitido no Git.

Se uma credencial real já tiver sido enviada, revogue-a no provedor antes de limpar o histórico. Apagar o arquivo ou adicionar uma regra no `.gitignore` não revoga a chave. Não publique `data/`: embora as senhas estejam derivadas, ele contém material de autenticação e dados de contas.

## Limites

A autenticação é uma implementação local pequena, sem MFA, OAuth ou painel de sessões por dispositivo. Para uma operação com requisitos maiores, planeje um provedor de identidade. A aplicação depende de provedores públicos e regras heurísticas; não é um sistema oficial de emergência.

Varredura sem achados não garante ausência de todas as vulnerabilidades. A configuração de produção, permissões do banco, acesso aos arquivos locais e integrações do operador precisam de validação no ambiente de hospedagem. Links de conta antigos com token na query são migrados para fragmentos, mas a primeira requisição antiga pode ter aparecido nos logs do servidor/proxy.

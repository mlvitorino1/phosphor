# Como contribuir

## Primeiro acesso

1. Use Node.js 24+ e execute `npm ci`.
2. Rode `npm run dev` e explore `/`, `/mapa`, `/historico` e `/admin`.
3. Crie uma branch com um nome curto que descreva a alteração.
4. Faça a alteração e atualize a documentação quando o comportamento mudar.
5. Execute `npm run check` e `npm run build` antes de abrir o pull request.

## Convenções

- Use TypeScript estrito. Evite `any`, casts que escondem erros e dependências sem necessidade.
- Componentes ficam na pasta da funcionalidade; regras puras em `lib/domain`; efeitos e credenciais em `lib/server`.
- Deixe endpoints pequenos: autorização, validação, chamada ao serviço e resposta.
- Use nomes claros e comentários curtos para explicar decisões. Não comente cada linha.
- Respeite o padrão de Prettier e os recursos de acessibilidade: rótulos, foco, estado de erro e movimento reduzido.
- Não remova atribuições de fontes ou transforme coordenadas aproximadas em local confirmado.

## Testes

Adicione testes para regras e falhas relevantes. Use fixtures sintéticas; não faça chamadas reais para provedores, e-mail ou IA nos testes. Testes de armazenamento usam diretórios temporários, nunca `data/` da instalação.

Integração PostgreSQL: prepare um banco separado chamado `phosphor_test`, aplique as migrações e execute `npm test` com `TEST_DATABASE_URL` apontando para ele. A CI prepara esse ambiente automaticamente.

## Migrações e novas fontes

Crie uma nova migração numerada; nunca edite uma migração já aplicada. Preserve dados existentes e descreva qualquer mudança de operação no guia de configuração.

Para um novo provedor, inclua:

- Documentação oficial, formato, cobertura e condições de acesso.
- Timeout, validação de datas/coordenadas e identificação da precisão geográfica.
- Comportamento com fonte indisponível e controle de ativação.
- Testes com respostas sintéticas e atribuição correta.

## Respeito e segurança

Discuta propostas e evidências com respeito, sem ataques pessoais ou exposição de dados. Remova dados pessoais e credenciais de capturas, fixtures e logs. Vulnerabilidades devem seguir [SECURITY.md](SECURITY.md).

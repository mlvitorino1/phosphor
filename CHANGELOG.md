# Changelog

## 0.2.0 — 2026-10-02

- Separação de componentes por funcionalidade, regras de domínio e serviços de servidor.
- Correção da validação de senha administrativa configurada por ambiente.
- scrypt assíncrono e sessões revogadas após troca de senha.
- Validação das entradas, limite de corpos JSON e controles de tentativas.
- Captura preserva revisões simultâneas e usa leases em PostgreSQL.
- Gravação local atômica; leituras do painel não alteram publicações.
- Deduplicação não modifica dados do cache; eventos encerrados/expirados saem do mapa público.
- Migrações SQL explícitas, consultas de assinantes sem N+1 e atualização atômica de fontes.
- Testes de regressão, CI com PostgreSQL, formatação e documentação para contribuição pública.

## 0.1.0

- Versão inicial do Phosphor: globo, fontes oficiais, notícias, administração, entrada, alertas e acervo histórico.

# Easter eggs para recrutadores

## Nível médio · Sinal 15

Digite **PHOSPHOR** fora de campos de formulário, com no máximo 2,5 segundos entre letras. Na página inicial, também é possível observar o pequeno elemento **15 P**, no rodapé, três vezes em sequência. Ele é um botão acessível por teclado e toque, com uma pista no nome acessível e no tooltip.

Surge um dossiê sobre arquitetura, segurança e testes. Ele só é carregado quando descoberto. O diálogo usa o modal nativo do navegador, com foco contido, Escape, botão de fechar, retorno do foco e respeito à preferência por movimento reduzido.

## Nível avançado · Conexões sob ruído

No dossiê médio, abra a próxima pista. Nas ferramentas do navegador, execute:

```js
window.phosphor.challenge();
```

O desafio entrega seis relatos fictícios. Conecte pares da mesma categoria, com distância geodésica de até 3 km e intervalo de até 60 minutos. Os grupos são componentes conexos: a transitividade inclui extremos que não são vizinhos diretos. Aplique Haversine e uma busca em grafo ou union-find.

Envie os IDs agrupados:

```js
window.phosphor.submit(grupos);
```

A ordem não importa; todos os IDs devem aparecer uma única vez. Uma resposta válida abre o dossiê avançado, com decisões sobre concorrência, preservação de revisões, sessões e precisão geográfica.

<details>
<summary>Resposta para manutenção e verificação</summary>

```js
window.phosphor.submit([["A", "B", "C"], ["D"], ["E", "F"]]);
```

A e C se conectam por B; D está fora da janela temporal; E/F têm outra categoria. Esta regra reduzida é exclusiva do quebra-cabeça. Não representa todos os critérios de deduplicação da aplicação.

</details>

## Limites intencionais

São descobertas de interface, disponíveis publicamente no código. Nenhuma combinação altera sessões, libera administração, consulta dados privados ou chama integrações. As teclas de campos editáveis são ignoradas; não há registro, telemetria nem persistência das descobertas. A API `window.phosphor` aceita somente grupos do quebra-cabeça e é removida ao desmontar o componente.

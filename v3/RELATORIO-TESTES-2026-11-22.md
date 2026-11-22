# Relatório de testes — Algaroba 3.0 (22/11/2026)

## Código
Executado com Node.js 22.16.0: `node v3/eventos-pedidos.test.js`.
Resultado: 5/5 verificações aprovadas (reenvio, dois aparelhos, total, colisão, quantidade inválida).

## Banco Supabase
Projeto: dlwrmpfurphccaeuwsfj
Área de homologação: `algaroba_v3_test.order_events`, separada de `public.algaroba_records`.
Permissões USAGE no esquema para `anon` e `authenticated`: ambas falsas.

Teste SQL em transação com ROLLBACK:
- A envia evento de R$14.
- A reenvia o mesmo event_id.
- B envia evento de R$6.
- Resultado: 2 eventos únicos, total R$20.
- ROLLBACK executado; nenhum pedido fictício deve permanecer.

## Restrições e próximas etapas
- Não foi realizado teste em três celulares reais.
- A tabela de homologação ainda não tem RPC transacional autenticada para a aplicação.
- A política de colisão de event_id com payload divergente deve ser implementada no banco, não apenas no cliente.
- Não há fila offline persistente, integração com caixa, estoque ou migração de dados reais.
- Não ativar a versão 3.0 em produção até os testes completos e conciliação dos históricos.

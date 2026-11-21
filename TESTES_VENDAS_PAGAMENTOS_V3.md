# Etapa 3 — vendas e pagamentos (21/11/2026)

## Implantação
Migração `003_v3_complete_sale.sql` aplicada ao Supabase. A RPC `algaroba_v3_complete_sale` registra evento de venda e comprovante na mesma transação, com verificação de:
- Sessão de caixa aberta, bloqueio de venda em caixa fechado.
- Itens com nome, quantidade e preço válidos; total calculado pelo servidor.
- Pagamentos em Pix, dinheiro, débito e crédito, sem valores negativos e com soma exata do total.
- Idempotência pelo UUID de operação: repetição idêntica retorna `already_received`; reuso diferente falha.
- Uma única conclusão por ID de venda, com índice único.
- Permissão provisória de administrador ativo, sem acesso anônimo.
- RPC genérica `algaroba_v3_append_event` teve EXECUTE revogado para `authenticated`, para não contornar regras de venda.

## Testes executados em transação com ROLLBACK
1. Criar sessão de caixa de teste.
2. Liquidar venda de R$ 14 (2 × R$ 7), com R$ 10 Pix e R$ 4 dinheiro: sucesso.
3. Repetir operação com mesmo UUID e conteúdo: `already_received`.
4. Pagamento de R$ 13 para venda de R$ 14: rejeitado.
5. Repetir ID da venda com UUID diferente: rejeitado por unicidade.
6. Fechar caixa de teste e tentar nova venda: rejeitado.
7. ROLLBACK: confirmadas 0 sessões, 0 eventos, 0 recibos de teste no banco v3.
8. Legado preservado: 492 vendas, caixa fechado.

## Bloqueadores
- Ainda não existe fluxo autenticado de abrir/fechar caixa via RPC de negócio.
- Falta conectar a interface real e testar tablet + celulares, reconexão offline e concorrência.
- Falta política de operadores e modelos de desconto, crédito, cancelamento e troco.
- Os 492 registros históricos continuam no legado; não migrar automaticamente sem regra de compatibilidade.
- **Não liberar produção ainda.**

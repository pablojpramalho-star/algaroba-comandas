# Testes transacionais da etapa 3 — 21/11/2026

## Escopo executado
Testes de restrições da base v3 executados no Supabase dentro de `BEGIN ... ROLLBACK`. Foi usado um usuário existente como chave estrangeira de teste, sem autenticar esse usuário e sem utilizar o caixa real.

Cenários executados com sucesso:
1. Inserção de sessão de caixa de teste com saldo inicial R$ 50.
2. Tentativa de abrir segunda sessão simultânea: rejeitada por índice único parcial.
3. Tentativa de abrir com valor negativo: rejeitada por CHECK.
4. Inserção de evento de venda de teste com UUID.
5. Tentativa de duplicar o mesmo UUID: rejeitada por chave primária.
6. Fechamento da sessão de teste com valor contado R$ 60.
7. ROLLBACK completo.

Consulta após rollback:
- `algaroba_v3_cash_sessions`: 0 linhas.
- `algaroba_v3_events`: 0 linhas.
- Caixa legado: fechado.
- Vendas legadas: 492.

## O que estes testes NÃO provam
- Não houve execução da RPC sob sessão real de administrador ou operador.
- Não foi testado pagamento real, Pix, cartão, dinheiro, venda de balcão, mesa, cancelamento, crédito ou fechamento com conferência de pagamentos.
- Não foi testada sincronização concorrente em três aparelhos nem funcionamento offline.
- Não há interface 3.0 integrada aos RPCs nem publicação de produção.

**Etapa 3 parcialmente validada. Sistema não liberado para uso.**

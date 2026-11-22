# Algaroba Comandas 3.0 — Homologação

## Estado
Ambiente de desenvolvimento isolado na branch `v3-homologacao`. Não usar como sistema de caixa em produção até aprovação dos testes.

## Regras obrigatórias
1. Supabase é a referência central; nenhuma restauração local sobrescreve registros mais recentes.
2. Cada pedido deve ter ID imutável e ser gravado de modo idempotente, sem duplicação em reenvios.
3. Operações offline permanecem numa fila durável com status pendente, enviado e confirmado; jamais apagar antes de confirmação.
4. Pedidos de mesas diferentes não devem bloquear uns aos outros; conflitos na mesma mesa exigem conciliação comprovável.
5. Fechamentos são vinculados a `cash_session_id` / expediente, não apenas à data civil.
6. Estoque exige movimentações identificadas e auditáveis; não substituir saldo central por snapshot antigo.
7. Preservar histórico de vendas, caixa, clientes, preços e permissões.
8. Atualizações de aplicativo devem expor versão do código, evitar cache obsoleto e permitir exportação local segura.
9. Nenhum dispositivo será marcado sincronizado enquanto houver pendências locais não confirmadas.

## Matriz de testes antes da liberação
- [ ] Backup integral do banco e recuperação testada
- [ ] Comparação de esquema 2.9 → 3.0 e migração reversível
- [ ] Dois aparelhos inserem pedidos simultaneamente na mesma mesa sem perda
- [ ] Reenvio do mesmo pedido não duplica itens nem valores
- [ ] Pedido offline é recuperado após reinício e enviado uma única vez
- [ ] Fechamento de mesa não é reaberto por snapshot antigo
- [ ] Vendas após meia-noite permanecem no expediente original
- [ ] Estoque não regride após sincronização de aparelho desatualizado
- [ ] Perfis Pablo, Claudevânia e Larissa têm permissões adequadas
- [ ] Exportação JSON e restauração de contingência conferidas
- [ ] Verificação de publicação, versão e atualização nos aparelhos
- [ ] Conferência final de totais históricos e saldos antes da troca

## Critério de publicação
Nenhum pedido perdido, nenhuma venda duplicada, nenhum fechamento alterado por sincronização e nenhum saldo sobrescrito por dados obsoletos.

# Validação da integração Algaroba 3.0 — 22/11/2026

## Base existente preservada
- Aplicativo completo continua em `index.html`, sem substituição da produção.
- Sincronização principal em `sincronizacao-segura-v68.js` usa `algaroba_records` e a RPC `algaroba_atomic_write`.
- A RPC compara `expected_at` com `updated_at`, bloqueia alterações concorrentes (SQLSTATE 40001) e aplica lotes em transação.
- A função `algaroba_v3_legacy_integrity()` consulta registros legados em modo somente leitura e exige administrador autenticado.
- A interface de auditoria foi adicionada a `index.html` somente nesta branch.

## Testes executados no banco
1. Inserção de registro temporário: aprovada.
2. Escrita com revisão antiga: rejeitada com 40001.
3. Escrita com revisão atual: aprovada.
4. Lote com conflito: rejeitado sem gravação parcial.
5. Todos os dados temporários foram revertidos na própria transação e sua ausência foi verificada.

## Ainda NÃO testado / bloqueadores para produção
- Teste E2E com login de administrador no navegador.
- Teste real de concorrência entre Pablo, Claudevânia e Larissa, inclusive offline e reconexão.
- Atribuição completa de cada venda a um ID de sessão de caixa, inclusive após a meia-noite.
- Integração transacional entre baixa de estoque, venda e fechamento, com idempotência e recuperação de falhas.
- Conferência e migração de dados legados sem perda.

Não promover esta branch à produção sem concluir esses itens. Não usar vendas reais para testes.

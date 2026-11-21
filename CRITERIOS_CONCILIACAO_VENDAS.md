# Critério de conciliação autorizado — 21/11/2026

## Prioridade operacional
O proprietário determinou que a conciliação do Algaroba 3.0 deve focar exclusivamente a integridade das **vendas**. Não bloquear a retomada por divergências históricas de estoque ou de fechamentos antigos.

## Fonte de verdade
- **Vendas**: reconciliar histórico por identificador e conteúdo, deduplicar e preservar lançamentos exclusivos dos backups de Pablo e Larissa, comparando com o servidor. Não inferir igualdade apenas por contagem.
- **Estoque**: tomar o último backup de Pablo como referência inicial; desconsiderar estoques dos backups de Larissa e Claudivânia. O proprietário fará recontagem física e ajuste posterior.
- **Caixas antigos**: preservar dados e fechamentos como histórico, sem reabrir, recalcular, apagar ou reescrever.
- **Caixas futuros**: sessões independentes; atribuir vendas à sessão de abertura, não à data do relógio após meia-noite; somente novas operações entram no caixa novo.
- **Relatórios**: basear-se no histórico conciliado de vendas, com valores, itens, formas de pagamento, operadores e sessão, quando disponíveis.

## Limites
Não apagar backups, histórico ou estoque do servidor. Não lançar vendas fictícias, não abrir caixa e não publicar produção sem testar a integridade de vendas e as operações essenciais.

## Evidências anteriores
- Backups Pablo e Larissa: 492 vendas cada; auditoria anterior encontrou histórico idêntico.
- Supabase: 492 vendas no registro meta, 44 fechamentos. A diferença de um fechamento não bloqueia conciliação das vendas, mas deve ser preservada.
- Requer conferência do conteúdo integral das 492 vendas contra o servidor antes de declarar conciliação concluída.

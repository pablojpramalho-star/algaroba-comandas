# Algaroba Comandas 3.0 — critérios de liberação
Data da auditoria: 2026-11-22

## Evidências de banco (consulta somente leitura)
- Sistema legado: 14 registros, 492 vendas em meta.history, 3.484 movimentos de estoque.
- 3.0: 5 eventos, 1 recibo de operação, 1 sessão de caixa aberta.
- Sessão 3.0 aberta: bb53dead-5b02-4126-9318-361065331221, data comercial 2026-11-21, abertura 2026-11-22T00:39:21Z, saldo inicial R$ 0.
- Sessão anterior fechada: a9e7c8d1-61f3-4b44-9c5e-b14f691f22f4.
- Nenhum registro financeiro foi alterado nesta auditoria.

## Bloqueios para produção
1. O index.html da branch v3-homologacao ainda é a interface 2.9 e não usa o adaptador v3/api-transacional.js.
2. A sessão 3.0 aberta precisa de conciliação; não encerrar automaticamente.
3. Testes automatizados existentes foram publicados, mas ainda não há execução confirmada no ambiente de CI.
4. Testar concorrência real com 3 operadores autenticados, reenvio idempotente, perda de rede e reabertura.
5. Implementar e validar migração/cutover com snapshots de caixa, estoque, contas a prazo e pedidos abertos.
6. Verificar autorizações/RLS e rollback antes de ativar o 3.0 em produção.

## Regra de segurança
Não migrar ou duplicar vendas legadas como novas vendas 3.0. Não alterar a branch main nem o banco 2.9 até que os testes sejam aprovados.

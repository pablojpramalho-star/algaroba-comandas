# Piloto de integração — dispositivo Pablo

## Estado inicial conferido (21/11/2026)
- Produção: aplicativo 2.9.7.90, ainda com sincronização legada.
- Pablo: `sync_status=pendente`, `pending=true`, erro de conflito em caixa, histórico e balcão; última presença 19:34:19 UTC.
- Claudivânia: pendente, conflito na Mesa 1; última presença 21:27:21 UTC.
- Larissa: pendente, conflito em estoque; última presença 20:36:14 UTC.
- Histórico de 492 vendas reconciliado integralmente com os backups.
- Banco v3 possui RPC transacional de venda/pagamento; **a interface ainda não a utiliza**.

## Ordem de ativação
1. Pablo — único piloto de integração.
2. Claudivânia — apenas após OK comprovado de Pablo.
3. Larissa — apenas após OK comprovado de Claudivânia.

## Critérios para declarar Pablo ONLINE e APTO
- Cliente executa código integrado à API v3 com autenticação válida.
- Última presença recente e confirmação de sincronização sem fila pendente.
- Conferência do histórico (492 vendas originais intactas).
- Abrir caixa v3 via operação autenticada; lançar e quitar venda teste em ambiente isolado; fechar; confirmar total e pagamento; rollback ou limpeza controlada dos testes.
- Repetir operação com mesmo UUID: não duplica.
- Testar reconexão e conflito entre atualizações sem sobrescrever venda.
- Passagem da meia-noite preserva vínculo à sessão de caixa original.
- Permissões de operador e bloqueios de caixa fechado validados.

## Restrições
Não marcar ONLINE por presença antiga; não desativar proteção de sincronização legada para forçar status verde. Não abrir caixa real, lançar vendas fictícias ou publicar mudança financeira em produção sem testes.

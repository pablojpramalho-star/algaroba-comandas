# Algaroba Comandas 3.0 — reconstrução controlada

## Situação
Branch de desenvolvimento; **não é uma versão operacional**. Não trocar o sistema atual por este branch.

## Diagnóstico confirmado em 21/11/2026
- O legado mantém 14 registros em `algaroba_records`, incluindo `meta` com caixa, histórico e balcão no mesmo JSON.
- A rotina `sincronizacao-segura-v68.js` grava registros completos, com verificação de versão e tentativas de mesclagem. Isso cria concorrência desnecessária entre operações independentes.
- O aplicativo tem rotas de escrita fora da rotina central, que precisam ser inventariadas e substituídas.
- Há infraestrutura de eventos prévia (`algaroba_operations`, `algaroba_operation_receipts`, `algaroba_order_events`), mas a tela operacional ainda depende do modelo legado.
- Os ajustes de recuperação específicos por aparelho e os bloqueios globais foram uma resposta emergencial e não substituem arquitetura transacional.

## Plano de migração
1. Congelar alterações não essenciais, preservar cópias de dados e mapear todas as rotas de escrita.
2. Aplicar migração `migrations/001_v3_core.sql` **somente em homologação**.
3. Criar RPCs autenticados com idempotência por UUID, verificação de operador e transações de banco: abrir caixa, lançar item, pagar, cancelar, sangria, fechar caixa.
4. Separar sessões de caixa e vendas; uma venda após meia-noite pertence à sessão que a recebeu.
5. Criar fila local durável com reenvio do mesmo UUID, ACK explícito e visualização de pendências por operação. Nenhum evento confirmado deve ser reaplicado.
6. Migrar histórico e estoque do legado em modo somente leitura; reconciliar contagens, totais, IDs e contas a prazo antes de habilitar gravação.
7. Homologar tablet único de operação e celular de consulta; testar queda de rede, refresh, fechamento e reabertura, pagamentos repetidos e concorrência.
8. Habilitar progressivamente com rollback testado. Não desligar o legado antes de reconciliar os resultados.

## Critérios de aceite
- Uma venda ou pagamento só é confirmado após ACK do banco; repetir o envio com mesmo UUID não duplica a operação.
- Apenas uma sessão de caixa aberta; fechamento exige reconciliação e preserva contagem física.
- Mesas e balcão independentes; uma divergência não bloqueia as demais operações.
- Estoque mantém trilha auditável e jamais sofre sobrescrita silenciosa.
- Dados antigos permanecem consultáveis; total por método, histórico e crédito conferidos.
- Operação com tablet + consulta no celular sem escrita involuntária.
- Cache PWA atualiza de modo verificável sem apagar fila local.

## Decisões
Não remover proteções contra duplicação, não fazer `UPDATE` de `meta` para fingir sincronização, não alterar produção sem homologação e backup. A migração SQL cria tabelas paralelas e não mexe em `algaroba_records`.

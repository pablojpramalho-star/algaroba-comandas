# Teste de integração do aparelho Pablo — critérios de segurança

A conexão de Pablo foi comprovada no Android: login, Supabase e leitura de 492 vendas.
A migração 005 instalou `algaroba_v3_pilot_status`, RPC somente para administrador ativo, sem políticas de leitura direta nas tabelas v3.
Conferência atual: 0 caixas e 0 eventos v3; 492 vendas legadas.

## Bloqueio identificado no piloto HTML
O piloto atualmente gera novo UUID a cada clique; se a resposta do servidor for perdida, o reenvio com outro UUID pode duplicar uma tentativa. Ele também não possui renovação de token nem fila offline, e ainda não integra mesas, balcão ou estoque.

## Condição para liberação
Não liberar o piloto como caixa real enquanto o cliente não persistir o UUID e payload de cada operação até ACK, recuperar token expirado, detectar incerteza de rede, e reconciliar o estado remoto antes de qualquer reenvio. Não permitir operação em modo offline com registro local como se fosse venda confirmada.

O histórico de 492 vendas permanece intacto e o estoque será recontado posteriormente pelo proprietário.
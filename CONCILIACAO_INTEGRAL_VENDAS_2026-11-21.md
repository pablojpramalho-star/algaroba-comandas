# Conciliação integral das vendas — concluída em 21/11/2026

## Fontes
- Backup Pablo: `algaroba-comandas-atual-2026-11-21-2 (1).json`, exportado 18:54:24 UTC.
- Backup Larissa: `algaroba-comandas-atual-2026-11-21 (1) (1).json`, exportado 17:28:04 UTC.
- Supabase produção: `public.algaroba_records`, chave `meta`, campo `history`.

## Resultado
- **492 vendas** em cada uma das três fontes.
- Comparação integral de **16.170 valores escalares** no histórico de vendas, preservando posição da venda, caminhos completos das propriedades, índices dos itens e pagamentos, e valores em JSON.
- Digest MD5 do histórico integral (Pablo): `690b3f7ba91a57bfaeff50cfb76456ec`.
- Digest MD5 do histórico integral (Larissa): `690b3f7ba91a57bfaeff50cfb76456ec`.
- Digest MD5 do histórico integral (Supabase): `690b3f7ba91a57bfaeff50cfb76456ec`.
- A assinatura foi calculada ordenando os caminhos com collation `C` para manter a mesma ordenação binária entre Python e PostgreSQL.
- Comparação financeira independente: MD5 `5ba1e25c3a5bbbc962ecd71d16c4e869` nas três fontes, usando nome, data, total, operador, ticket, pagamento, anulação, itens e pagamentos.
- 19 vendas marcadas anuladas e 6 vendas com identificador de recuperação, presentes nas três fontes.
- Nenhuma divergência detectada no histórico de vendas e nenhuma venda precisa ser inserida ou substituída.

## Escopo e ressalvas
- Esta auditoria prova igualdade do conteúdo integral do array `meta.history` no instante da consulta; não prova correção econômica de cada venda nem reconcilia filas de balcão ainda abertas ou outras coleções fora de `history`.
- Estoque e caixas antigos ficam fora do escopo, por decisão do proprietário; seus dados são preservados.
- A etapa 2 de **conciliação do histórico de vendas** está concluída. O sistema 3.0 **não está liberado**: faltam testes de fluxo operacional e publicação validada.
- Nenhum dado financeiro foi modificado durante a conferência.

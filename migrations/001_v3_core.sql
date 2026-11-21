-- Algaroba 3.0 / fase 1: esquema paralelo, sem modificar o legado.
-- Executar somente após revisão, backup e testes em ambiente de homologação.
begin;
create table if not exists public.algaroba_v3_cash_sessions (
 id uuid primary key default gen_random_uuid(),
 business_date date not null,
 opened_at timestamptz not null default now(),
 opened_by uuid not null references auth.users(id),
 opening_amount numeric(12,2) not null check (opening_amount>=0),
 closed_at timestamptz,
 closed_by uuid references auth.users(id),
 counted_cash numeric(12,2),
 note text,
 constraint v3_closed_after_open check (closed_at is null or closed_at>=opened_at),
 constraint v3_counted_only_when_closed check (counted_cash is null or closed_at is not null)
);
create unique index if not exists algaroba_v3_only_one_open_cash
 on public.algaroba_v3_cash_sessions ((true)) where closed_at is null;
create table if not exists public.algaroba_v3_events (
 id uuid primary key,
 session_id uuid references public.algaroba_v3_cash_sessions(id),
 entity_type text not null check (entity_type in ('table','counter','sale','payment','inventory','credit','cash')),
 entity_id text not null,
 event_type text not null,
 payload jsonb not null,
 actor_id uuid not null references auth.users(id),
 device_id text not null,
 occurred_at timestamptz not null,
 received_at timestamptz not null default now(),
 constraint v3_device_id_present check (length(trim(device_id))>0),
 constraint v3_entity_id_present check (length(trim(entity_id))>0)
);
create index if not exists algaroba_v3_events_entity on public.algaroba_v3_events(entity_type,entity_id,received_at);
create index if not exists algaroba_v3_events_session on public.algaroba_v3_events(session_id,received_at);
create table if not exists public.algaroba_v3_operation_receipts (
 id uuid primary key references public.algaroba_v3_events(id),
 payload_hash text not null,
 result jsonb not null,
 created_at timestamptz not null default now()
);
alter table public.algaroba_v3_cash_sessions enable row level security;
alter table public.algaroba_v3_events enable row level security;
alter table public.algaroba_v3_operation_receipts enable row level security;
-- Sem políticas de escrita ainda: nenhuma aplicação consegue operar sobre
-- as tabelas v3 até que RPCs autenticados e testados sejam publicados.
commit;

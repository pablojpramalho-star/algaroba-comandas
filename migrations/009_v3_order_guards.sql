create or replace function public.algaroba_v3_guard_order_events()
returns trigger language plpgsql set search_path=public,pg_temp as $$
begin
 if new.event_type='order_item_added' and exists(
 select 1 from public.algaroba_v3_events e where e.session_id=new.session_id and e.entity_id='order:'||new.session_id::text||':'||new.entity_id and e.event_type='sale_completed'
 ) then raise exception 'ORDER_ALREADY_SETTLED' using errcode='23505';end if;
 return new;
end $$;
drop trigger if exists algaroba_v3_guard_order_events_trg on public.algaroba_v3_events;
create trigger algaroba_v3_guard_order_events_trg before insert on public.algaroba_v3_events for each row execute function public.algaroba_v3_guard_order_events();
create or replace function public.algaroba_v3_guard_cash_close()
returns trigger language plpgsql set search_path=public,pg_temp as $$
begin
 if old.closed_at is null and new.closed_at is not null and exists(
 select 1 from public.algaroba_v3_events e where e.session_id=old.id and e.event_type='order_item_added'
 and not exists(select 1 from public.algaroba_v3_events s where s.session_id=old.id and s.event_type='sale_completed' and s.entity_id='order:'||old.id::text||':'||e.entity_id)
 ) then raise exception 'UNPAID_ORDERS_PREVENT_CASH_CLOSE' using errcode='22023';end if;
 return new;
end $$;
drop trigger if exists algaroba_v3_guard_cash_close_trg on public.algaroba_v3_cash_sessions;
create trigger algaroba_v3_guard_cash_close_trg before update of closed_at on public.algaroba_v3_cash_sessions for each row execute function public.algaroba_v3_guard_cash_close();
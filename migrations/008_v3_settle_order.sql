create or replace function public.algaroba_v3_settle_order(
 p_operation_id uuid,p_session_id uuid,p_order_id text,p_payments jsonb,p_device_id text
) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_actor uuid:=auth.uid();v_items jsonb;v_total numeric;v_existing public.algaroba_v3_events%rowtype;v_receipt jsonb;v_sale_id text;
begin
 if v_actor is null or not public.is_algaroba_admin() then raise exception 'ADMIN_REQUIRED_TO_SETTLE' using errcode='42501';end if;
 if p_operation_id is null or p_session_id is null or nullif(btrim(p_order_id),'') is null or nullif(btrim(p_device_id),'') is null then raise exception 'INVALID_REQUEST' using errcode='22023';end if;
 v_sale_id:='order:'||p_session_id::text||':'||p_order_id;
 perform 1 from public.algaroba_v3_cash_sessions where id=p_session_id and closed_at is null for update;
 if not found then
   select * into v_existing from public.algaroba_v3_events where id=p_operation_id and event_type='sale_completed';
   if not found then raise exception 'CASH_SESSION_NOT_OPEN' using errcode='22023';end if;
 end if;
 select jsonb_agg(jsonb_build_object('name',payload->>'name','qty',payload->'qty','price',payload->'unit_price') order by received_at,id),
 coalesce(sum((payload->>'total')::numeric),0) into v_items,v_total
 from public.algaroba_v3_events where session_id=p_session_id and entity_id=p_order_id and event_type='order_item_added';
 if v_items is null or v_total<=0 then raise exception 'EMPTY_ORDER' using errcode='22023';end if;
 if exists(select 1 from public.algaroba_v3_events where session_id=p_session_id and entity_id=v_sale_id and event_type='sale_completed' and id<>p_operation_id) then
 raise exception 'ORDER_ALREADY_SETTLED' using errcode='23505';end if;
 v_receipt:=public.algaroba_v3_complete_sale(p_operation_id,p_session_id,v_sale_id,v_items,p_payments,p_device_id);
 return v_receipt||jsonb_build_object('order_id',p_order_id);
end $$;
revoke all on function public.algaroba_v3_settle_order(uuid,uuid,text,jsonb,text) from public,anon;
grant execute on function public.algaroba_v3_settle_order(uuid,uuid,text,jsonb,text) to authenticated;
create unique index if not exists algaroba_v3_one_sale_per_order on public.algaroba_v3_events(session_id,entity_id) where event_type='sale_completed' and entity_id like 'order:%';
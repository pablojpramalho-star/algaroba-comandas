create or replace function public.algaroba_v3_shared_orders()
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_actor uuid:=auth.uid();v_role text;v_cash uuid;v_rows jsonb;
begin
 select perfil into v_role from public.algaroba_users where id=v_actor and ativo=true;
 if v_role not in ('administrador','gerente','atendimento') or v_role is null then raise exception 'NOT_AUTHORIZED' using errcode='42501';end if;
 select id into v_cash from public.algaroba_v3_cash_sessions where closed_at is null order by opened_at desc limit 1;
 if v_cash is null then return jsonb_build_object('status','ok','cash_id',null,'orders','[]'::jsonb);end if;
 select coalesce(jsonb_agg(t.row_data order by t.order_id),'[]'::jsonb) into v_rows from (
  select e.entity_id order_id,jsonb_build_object('order_id',e.entity_id,'total',sum((e.payload->>'total')::numeric),
  'items',jsonb_agg(jsonb_build_object('id',e.id,'name',e.payload->>'name','qty',e.payload->'qty','unit_price',e.payload->'unit_price','total',e.payload->'total','at',e.received_at) order by e.received_at,e.id)) row_data
  from public.algaroba_v3_events e
  where e.session_id=v_cash and e.event_type='order_item_added'
  and not exists(select 1 from public.algaroba_v3_events s where s.session_id=v_cash and s.event_type='sale_completed' and s.entity_id='order:'||v_cash::text||':'||e.entity_id)
  group by e.entity_id
 ) t;
 return jsonb_build_object('status','ok','cash_id',v_cash,'orders',v_rows);
end $$;
revoke all on function public.algaroba_v3_shared_orders() from public,anon;
grant execute on function public.algaroba_v3_shared_orders() to authenticated;
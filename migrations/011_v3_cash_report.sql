create or replace function public.algaroba_v3_cash_report()
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_actor uuid:=auth.uid();v_session uuid;v_sales jsonb;v_methods jsonb;v_count integer;v_total numeric;v_pending jsonb;
begin
 if v_actor is null or not public.is_algaroba_admin() then raise exception 'ADMIN_REQUIRED' using errcode='42501';end if;
 select id into v_session from public.algaroba_v3_cash_sessions where closed_at is null order by opened_at desc limit 1;
 if v_session is null then return jsonb_build_object('status','ok','cash_id',null,'sale_count',0,'total',0,'methods','{}'::jsonb,'sales','[]'::jsonb,'pending_orders','[]'::jsonb);end if;
 select count(*),coalesce(sum((payload->>'total')::numeric),0),coalesce(jsonb_agg(jsonb_build_object('id',entity_id,'total',payload->'total','payments',payload->'payments','at',received_at) order by received_at desc),'[]'::jsonb)
 into v_count,v_total,v_sales from public.algaroba_v3_events where session_id=v_session and event_type='sale_completed';
 select coalesce(jsonb_object_agg(method,amount),'{}'::jsonb) into v_methods from (
 select p.value->>'method' method,sum((p.value->>'amount')::numeric) amount
 from public.algaroba_v3_events e cross join lateral jsonb_array_elements(e.payload->'payments') p
 where e.session_id=v_session and e.event_type='sale_completed' group by p.value->>'method'
 ) x;
 select coalesce(jsonb_agg(jsonb_build_object('order_id',order_id,'total',total) order by order_id),'[]'::jsonb) into v_pending from (
 select e.entity_id order_id,sum((e.payload->>'total')::numeric) total from public.algaroba_v3_events e
 where e.session_id=v_session and e.event_type='order_item_added'
 and not exists(select 1 from public.algaroba_v3_events s where s.session_id=v_session and s.event_type='sale_completed' and s.entity_id='order:'||v_session::text||':'||e.entity_id)
 group by e.entity_id
 ) x;
 return jsonb_build_object('status','ok','cash_id',v_session,'sale_count',v_count,'total',v_total,'methods',v_methods,'sales',v_sales,'pending_orders',v_pending);
end $$;
revoke all on function public.algaroba_v3_cash_report() from public,anon;
grant execute on function public.algaroba_v3_cash_report() to authenticated;
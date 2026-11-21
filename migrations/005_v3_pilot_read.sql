create or replace function public.algaroba_v3_pilot_status()
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_actor uuid:=auth.uid();v_session public.algaroba_v3_cash_sessions%rowtype;v_sales jsonb;v_count integer;
begin
 if v_actor is null then raise exception 'AUTH_REQUIRED' using errcode='28000';end if;
 if not public.is_algaroba_admin() then raise exception 'V3_ADMIN_ONLY' using errcode='42501';end if;
 select * into v_session from public.algaroba_v3_cash_sessions where closed_at is null order by opened_at desc limit 1;
 if not found then return jsonb_build_object('status','ok','cash',null,'sales','[]'::jsonb,'sale_count',0);end if;
 select coalesce(jsonb_agg(jsonb_build_object('sale_id',entity_id,'total',payload->'total','received_at',received_at) order by received_at desc),'[]'::jsonb),count(*) into v_sales,v_count
 from public.algaroba_v3_events where session_id=v_session.id and entity_type='sale' and event_type='sale_completed';
 return jsonb_build_object('status','ok','cash',jsonb_build_object('id',v_session.id,'opened_at',v_session.opened_at,'opening_amount',v_session.opening_amount,'business_date',v_session.business_date),'sales',v_sales,'sale_count',v_count);
end $$;
revoke all on function public.algaroba_v3_pilot_status() from public,anon;
grant execute on function public.algaroba_v3_pilot_status() to authenticated;
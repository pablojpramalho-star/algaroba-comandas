create or replace function public.algaroba_v3_open_cash(p_operation_id uuid,p_opening_amount numeric,p_device_id text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_actor uuid:=auth.uid();v_id uuid;v_old public.algaroba_v3_events%rowtype;v_session public.algaroba_v3_cash_sessions%rowtype;
begin
 if v_actor is null then raise exception 'AUTH_REQUIRED' using errcode='28000';end if;
 if not public.is_algaroba_admin() then raise exception 'V3_ADMIN_ONLY' using errcode='42501';end if;
 if p_operation_id is null or p_opening_amount is null or p_opening_amount<0 or p_opening_amount>1000000 or p_opening_amount<>round(p_opening_amount,2) or nullif(btrim(p_device_id),'') is null then raise exception 'INVALID_OPENING' using errcode='22023';end if;
 select * into v_old from public.algaroba_v3_events where id=p_operation_id;
 if found then
  if v_old.actor_id<>v_actor or v_old.event_type<>'cash_opened' or v_old.payload->>'opening_amount'<>p_opening_amount::text or v_old.device_id<>p_device_id then raise exception 'OPERATION_ID_REUSED' using errcode='23505';end if;
  return jsonb_build_object('status','already_received','session_id',v_old.session_id);
 end if;
 insert into public.algaroba_v3_cash_sessions(business_date,opened_by,opening_amount)
 values((now() at time zone 'America/Fortaleza')::date,v_actor,p_opening_amount) returning id into v_id;
 insert into public.algaroba_v3_events(id,session_id,entity_type,entity_id,event_type,payload,actor_id,device_id,occurred_at)
 values(p_operation_id,v_id,'cash',v_id::text,'cash_opened',jsonb_build_object('opening_amount',p_opening_amount),v_actor,p_device_id,now());
 return jsonb_build_object('status','received','session_id',v_id);
end $$;
create or replace function public.algaroba_v3_close_cash(p_operation_id uuid,p_session_id uuid,p_counted_cash numeric,p_device_id text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_actor uuid:=auth.uid();v_old public.algaroba_v3_events%rowtype;v_session public.algaroba_v3_cash_sessions%rowtype;v_total numeric;v_cash numeric;
begin
 if v_actor is null then raise exception 'AUTH_REQUIRED' using errcode='28000';end if;
 if not public.is_algaroba_admin() then raise exception 'V3_ADMIN_ONLY' using errcode='42501';end if;
 if p_operation_id is null or p_session_id is null or p_counted_cash is null or p_counted_cash<0 or p_counted_cash>1000000 or p_counted_cash<>round(p_counted_cash,2) or nullif(btrim(p_device_id),'') is null then raise exception 'INVALID_CLOSE' using errcode='22023';end if;
 select * into v_old from public.algaroba_v3_events where id=p_operation_id;
 if found then
  if v_old.actor_id<>v_actor or v_old.event_type<>'cash_closed' or v_old.session_id<>p_session_id or (v_old.payload->>'counted_cash')::numeric<>p_counted_cash or v_old.device_id<>p_device_id then raise exception 'OPERATION_ID_REUSED' using errcode='23505';end if;
  return jsonb_build_object('status','already_received','session_id',p_session_id);
 end if;
 select * into v_session from public.algaroba_v3_cash_sessions where id=p_session_id for update;
 if not found or v_session.closed_at is not null then raise exception 'CASH_SESSION_NOT_OPEN' using errcode='22023';end if;
 select coalesce(sum((payload->>'total')::numeric),0),
 coalesce(sum((select coalesce(sum((p->>'amount')::numeric),0) from jsonb_array_elements(payload->'payments') p where p->>'method'='cash')),0)
 into v_total,v_cash from public.algaroba_v3_events where session_id=p_session_id and entity_type='sale' and event_type='sale_completed';
 update public.algaroba_v3_cash_sessions set closed_at=now(),closed_by=v_actor,counted_cash=p_counted_cash where id=p_session_id;
 insert into public.algaroba_v3_events(id,session_id,entity_type,entity_id,event_type,payload,actor_id,device_id,occurred_at)
 values(p_operation_id,p_session_id,'cash',p_session_id::text,'cash_closed',jsonb_build_object('counted_cash',p_counted_cash,'sales_total',v_total,'expected_cash',v_session.opening_amount+v_cash),v_actor,p_device_id,now());
 return jsonb_build_object('status','received','session_id',p_session_id,'sales_total',v_total,'expected_cash',v_session.opening_amount+v_cash);
end $$;
revoke all on function public.algaroba_v3_open_cash(uuid,numeric,text) from public,anon;
revoke all on function public.algaroba_v3_close_cash(uuid,uuid,numeric,text) from public,anon;
grant execute on function public.algaroba_v3_open_cash(uuid,numeric,text) to authenticated;
grant execute on function public.algaroba_v3_close_cash(uuid,uuid,numeric,text) to authenticated;
create or replace function public.algaroba_v3_add_order_item(
 p_operation_id uuid,p_session_id uuid,p_order_id text,p_item_name text,p_qty numeric,p_unit_price numeric,p_device_id text
) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_actor uuid:=auth.uid();v_profile text;v_old public.algaroba_v3_events%rowtype;v_payload jsonb;v_total numeric;
begin
 select perfil into v_profile from public.algaroba_users where id=v_actor and ativo=true;
 if v_profile is null or v_profile not in ('administrador','gerente','atendimento') then raise exception 'NOT_AUTHORIZED' using errcode='42501';end if;
 if p_operation_id is null or p_session_id is null or nullif(btrim(p_order_id),'') is null or length(p_order_id)>100
 or nullif(btrim(p_item_name),'') is null or length(p_item_name)>160 or nullif(btrim(p_device_id),'') is null
 or p_qty is null or p_qty<=0 or p_qty>1000 or p_qty<>round(p_qty,3)
 or p_unit_price is null or p_unit_price<0 or p_unit_price>100000 or p_unit_price<>round(p_unit_price,2)
 then raise exception 'INVALID_ORDER_ITEM' using errcode='22023';end if;
 v_total:=round(p_qty*p_unit_price,2);
 v_payload:=jsonb_build_object('name',p_item_name,'qty',p_qty,'unit_price',p_unit_price,'total',v_total);
 select * into v_old from public.algaroba_v3_events where id=p_operation_id;
 if found then
  if v_old.actor_id is distinct from v_actor or v_old.session_id is distinct from p_session_id or v_old.entity_id is distinct from p_order_id
   or v_old.event_type<>'order_item_added' or v_old.entity_type<>'order' or v_old.payload is distinct from v_payload or v_old.device_id is distinct from p_device_id
  then raise exception 'OPERATION_ID_REUSED' using errcode='23505';end if;
  return jsonb_build_object('status','already_received','operation_id',p_operation_id,'order_id',p_order_id);
 end if;
 perform 1 from public.algaroba_v3_cash_sessions where id=p_session_id and closed_at is null for update;
 if not found then raise exception 'CASH_SESSION_NOT_OPEN' using errcode='22023';end if;
 insert into public.algaroba_v3_events(id,session_id,entity_type,entity_id,event_type,payload,actor_id,device_id,occurred_at)
 values(p_operation_id,p_session_id,'order',p_order_id,'order_item_added',v_payload,v_actor,p_device_id,now());
 return jsonb_build_object('status','received','operation_id',p_operation_id,'order_id',p_order_id,'total',v_total);
end $$;
revoke all on function public.algaroba_v3_add_order_item(uuid,uuid,text,text,numeric,numeric,text) from public,anon;
grant execute on function public.algaroba_v3_add_order_item(uuid,uuid,text,text,numeric,numeric,text) to authenticated;
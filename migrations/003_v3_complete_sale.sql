-- Algaroba 3.0: venda e recebimentos atomicos, homologacao admin-only.
create unique index if not exists algaroba_v3_unique_completed_sale
on public.algaroba_v3_events(entity_id) where entity_type='sale' and event_type='sale_completed';

create or replace function public.algaroba_v3_complete_sale(
 p_operation_id uuid, p_session_id uuid, p_sale_id text,
 p_items jsonb, p_payments jsonb, p_device_id text
) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare
 v_actor uuid:=auth.uid(); v_session public.algaroba_v3_cash_sessions%rowtype;
 v_old public.algaroba_v3_events%rowtype; v_receipt jsonb;
 v_total numeric:=0; v_paid numeric:=0; v_item jsonb; v_payment jsonb;
 v_qty numeric; v_price numeric; v_amount numeric; v_method text;
 v_payload jsonb;
begin
 if v_actor is null then raise exception 'AUTH_REQUIRED' using errcode='28000'; end if;
 if not public.is_algaroba_admin() then raise exception 'V3_ADMIN_ONLY_UNTIL_OPERATOR_AUTH_READY' using errcode='42501'; end if;
 if p_operation_id is null or p_session_id is null or nullif(btrim(p_sale_id),'') is null
    or nullif(btrim(p_device_id),'') is null
    or jsonb_typeof(p_items) is distinct from 'array'
    or jsonb_typeof(p_payments) is distinct from 'array'
    or jsonb_array_length(p_items)=0 or jsonb_array_length(p_payments)=0 then
   raise exception 'INVALID_SALE' using errcode='22023';
 end if;
 for v_item in select value from jsonb_array_elements(p_items) loop
   if jsonb_typeof(v_item) is distinct from 'object'
      or nullif(btrim(v_item->>'name'),'') is null
      or (v_item->>'qty') !~ '^[0-9]+(\.[0-9]+)?$'
      or (v_item->>'price') !~ '^[0-9]+(\.[0-9]{1,2})?$' then
      raise exception 'INVALID_SALE_ITEM' using errcode='22023';
   end if;
   v_qty:=(v_item->>'qty')::numeric; v_price:=(v_item->>'price')::numeric;
   if v_qty<=0 or v_price<0 or v_qty>10000 or v_price>1000000 then raise exception 'INVALID_SALE_ITEM_AMOUNT' using errcode='22023'; end if;
   v_total:=v_total+v_qty*v_price;
 end loop;
 if round(v_total,2)<>v_total or v_total<=0 then raise exception 'INVALID_SALE_TOTAL' using errcode='22023'; end if;
 for v_payment in select value from jsonb_array_elements(p_payments) loop
   v_method:=v_payment->>'method';
   if v_method not in ('pix','cash','debit','credit') or
      (v_payment->>'amount') !~ '^[0-9]+(\.[0-9]{1,2})?$' then
      raise exception 'INVALID_PAYMENT' using errcode='22023';
   end if;
   v_amount:=(v_payment->>'amount')::numeric;
   if v_amount<=0 or v_amount>1000000 then raise exception 'INVALID_PAYMENT_AMOUNT' using errcode='22023'; end if;
   v_paid:=v_paid+v_amount;
 end loop;
 if v_paid<>v_total then raise exception 'PAYMENT_TOTAL_MISMATCH' using errcode='22023'; end if;
 v_payload:=jsonb_build_object('items',p_items,'payments',p_payments,'total',v_total);
 -- Mesmo UUID so pode representar o mesmo conteudo e mesma sessao.
 select * into v_old from public.algaroba_v3_events where id=p_operation_id;
 if found then
   if v_old.actor_id is distinct from v_actor or v_old.session_id is distinct from p_session_id
     or v_old.entity_id is distinct from p_sale_id or v_old.entity_type<>'sale'
     or v_old.event_type<>'sale_completed' or v_old.payload is distinct from v_payload
     or v_old.device_id is distinct from p_device_id then
     raise exception 'OPERATION_ID_REUSED' using errcode='23505';
   end if;
   return jsonb_build_object('status','already_received','operation_id',p_operation_id,'sale_id',p_sale_id,'total',v_total);
 end if;
 select * into v_session from public.algaroba_v3_cash_sessions where id=p_session_id for update;
 if not found or v_session.closed_at is not null then raise exception 'CASH_SESSION_NOT_OPEN' using errcode='22023'; end if;
 insert into public.algaroba_v3_events(id,session_id,entity_type,entity_id,event_type,payload,actor_id,device_id,occurred_at)
 values(p_operation_id,p_session_id,'sale',p_sale_id,'sale_completed',v_payload,v_actor,p_device_id,now());
 v_receipt:=jsonb_build_object('status','received','operation_id',p_operation_id,'sale_id',p_sale_id,'total',v_total);
 insert into public.algaroba_v3_operation_receipts(id,payload_hash,result)
 values(p_operation_id,md5(v_payload::text),v_receipt);
 return v_receipt;
end $$;
revoke all on function public.algaroba_v3_complete_sale(uuid,uuid,text,jsonb,jsonb,text) from public,anon;
grant execute on function public.algaroba_v3_complete_sale(uuid,uuid,text,jsonb,jsonb,text) to authenticated;
-- A RPC generica nao pode contornar as regras de venda/caixa.
revoke execute on function public.algaroba_v3_append_event(uuid,text,text,text,jsonb,text,timestamptz,uuid) from authenticated;

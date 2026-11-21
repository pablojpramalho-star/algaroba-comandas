-- Algaroba 3.0: RPC idempotente para registrar eventos em transação.
-- Preparação de homologação; requer migrations/001_v3_core.sql.
create or replace function public.algaroba_v3_append_event(
 p_id uuid,p_entity_type text,p_entity_id text,p_event_type text,
 p_payload jsonb,p_device_id text,p_occurred_at timestamptz,
 p_session_id uuid default null
) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_actor uuid:=auth.uid(); v_existing public.algaroba_v3_events%rowtype;
 v_result jsonb; v_claim jsonb;
begin
 if v_actor is null then raise exception 'AUTH_REQUIRED' using errcode='28000'; end if;
 -- Fase de homologação: somente administrador ativo pode testar a RPC.
 -- Antes da operação real, autorizar por perfil e tipo de evento.
 if not public.is_algaroba_admin() then
   raise exception 'V3_ADMIN_ONLY_UNTIL_OPERATION_RULES_ARE_READY' using errcode='42501';
 end if;
 if p_id is null or p_payload is null or p_device_id is null or btrim(p_device_id)='' or
    p_entity_id is null or btrim(p_entity_id)='' or p_occurred_at is null then
   raise exception 'INVALID_EVENT' using errcode='22023';
 end if;
 if p_entity_type not in ('table','counter','sale','payment','inventory','credit','cash') then
   raise exception 'INVALID_ENTITY_TYPE' using errcode='22023';
 end if;
 -- Repetições do mesmo UUID devolvem ACK somente se conteúdo e autor forem iguais.
 select * into v_existing from public.algaroba_v3_events where id=p_id;
 if found then
   if v_existing.actor_id is distinct from v_actor or
      v_existing.entity_type is distinct from p_entity_type or
      v_existing.entity_id is distinct from p_entity_id or
      v_existing.event_type is distinct from p_event_type or
      v_existing.payload is distinct from p_payload or
      v_existing.device_id is distinct from p_device_id or
      v_existing.occurred_at is distinct from p_occurred_at or
      v_existing.session_id is distinct from p_session_id then
      raise exception 'EVENT_ID_REUSED_WITH_DIFFERENT_CONTENT' using errcode='23505';
   end if;
   return jsonb_build_object('id',p_id,'status','already_received','received_at',v_existing.received_at);
 end if;
 insert into public.algaroba_v3_events
   (id,session_id,entity_type,entity_id,event_type,payload,actor_id,device_id,occurred_at)
 values(p_id,p_session_id,p_entity_type,p_entity_id,p_event_type,p_payload,v_actor,p_device_id,p_occurred_at)
 on conflict (id) do nothing;
 -- Trata também a corrida de dois dispositivos reenviando o mesmo UUID.
 select * into v_existing from public.algaroba_v3_events where id=p_id;
 if v_existing.actor_id is distinct from v_actor or
    v_existing.entity_type is distinct from p_entity_type or
    v_existing.entity_id is distinct from p_entity_id or
    v_existing.event_type is distinct from p_event_type or
    v_existing.payload is distinct from p_payload or
    v_existing.device_id is distinct from p_device_id or
    v_existing.occurred_at is distinct from p_occurred_at or
    v_existing.session_id is distinct from p_session_id then
    raise exception 'EVENT_ID_REUSED_WITH_DIFFERENT_CONTENT' using errcode='23505';
 end if;
 return jsonb_build_object('id',p_id,'status','received_or_already_received','received_at',v_existing.received_at);
end $$;
revoke all on function public.algaroba_v3_append_event(uuid,text,text,text,jsonb,text,timestamptz,uuid) from public,anon;
grant execute on function public.algaroba_v3_append_event(uuid,text,text,text,jsonb,text,timestamptz,uuid) to authenticated;
-- Ainda não conectar esta RPC à tela: autenticação, autorização por perfil
-- e transições de negócio devem ser validadas antes de uso operacional.

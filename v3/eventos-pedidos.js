/* Algaroba 3.0 — núcleo de eventos de pedidos (homologação).
 * Módulo puro: não altera o sistema 2.9 nem o banco.
 * Persistência e RPC transacional devem ser implementados antes de ativar.
 */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.AlgarobaV3Events=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  function assertEvent(e){
    if(!e||typeof e!=='object'||typeof e.event_id!=='string'||!e.event_id.trim())throw Error('event_id obrigatório');
    if(typeof e.device_id!=='string'||!e.device_id.trim())throw Error('device_id obrigatório');
    if(typeof e.table_key!=='string'||!/^table:\d+$/.test(e.table_key))throw Error('table_key inválida');
    if(!Array.isArray(e.items)||!e.items.length)throw Error('Pedido sem itens');
    for(const i of e.items){
      if(!i||typeof i.product!=='string'||!i.product.trim()||!Number.isFinite(i.qty)||i.qty<=0||!Number.isFinite(i.price)||i.price<0)throw Error('Item inválido');
    }
    return true;
  }
  function stable(value){
    if(Array.isArray(value))return value.map(stable);
    if(value&&typeof value==='object'){
      const out={};for(const k of Object.keys(value).sort())out[k]=stable(value[k]);return out;
    }
    return value;
  }
  function same(a,b){return JSON.stringify(stable(a))===JSON.stringify(stable(b))}
  function mergeEvents(existing,incoming){
    if(!Array.isArray(existing)||!Array.isArray(incoming))throw Error('Eventos inválidos');
    const byId=new Map(),out=[];
    for(const e of [...existing,...incoming]){
      assertEvent(e);
      const prior=byId.get(e.event_id);
      if(prior){if(!same(prior,e))throw Error('Colisão de event_id: '+e.event_id);continue}
      byId.set(e.event_id,e);out.push(e);
    }
    return out;
  }
  function amountCents(events){
    return mergeEvents([],events).reduce((sum,e)=>sum+e.items.reduce((s,i)=>s+Math.round(i.price*100)*i.qty,0),0);
  }
  return Object.freeze({assertEvent,mergeEvents,amountCents});
});

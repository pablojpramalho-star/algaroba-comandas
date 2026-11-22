/* Algaroba 3.0 — adaptador transacional de homologação.
 * Não altera nem grava em algaroba_records (produção 2.9).
 * Requer cliente Supabase autenticado; a autorização é validada pelo servidor.
 */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.AlgarobaV3Api=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
 const required=(v,label)=>{if(typeof v!=='string'||!v.trim())throw Error(label+' obrigatório');return v.trim()};
 const uuid=(v,label)=>{if(!UUID.test(required(v,label)))throw Error(label+' deve ser UUID');return v};
 const amount=(v,label)=>{if(typeof v!=='number'||!Number.isFinite(v)||v<0)throw Error(label+' inválido');return v};
 function create(client){
   if(!client||typeof client.rpc!=='function')throw Error('Cliente Supabase autenticado obrigatório');
   async function call(name,args={}){
     const {data,error}=await client.rpc('algaroba_v3_'+name,args);
     if(error)throw Error(name+': '+(error.message||String(error)));
     return data;
   }
   return Object.freeze({
     pilotStatus:()=>call('pilot_status'),
     integrity:()=>call('legacy_integrity'),
     sharedOrders:()=>call('shared_orders'),
     cashReport:()=>call('cash_report'),
     creditReport:()=>call('credit_accounts_report'),
     pendingOrders:(sessionId)=>call('pending_orders',{p_session_id:uuid(sessionId,'sessionId')}),
     openCash:({operationId,openingAmount,deviceId})=>call('open_cash',{
       p_operation_id:uuid(operationId,'operationId'),p_opening_amount:amount(openingAmount,'openingAmount'),p_device_id:required(deviceId,'deviceId')
     }),
     addItem:({operationId,sessionId,orderId,itemName,qty,unitPrice,deviceId})=>{
       if(typeof qty!=='number'||!Number.isFinite(qty)||qty<=0)throw Error('qty inválido');
       return call('add_order_item',{p_operation_id:uuid(operationId,'operationId'),p_session_id:uuid(sessionId,'sessionId'),p_order_id:required(orderId,'orderId'),p_item_name:required(itemName,'itemName'),p_qty:qty,p_unit_price:amount(unitPrice,'unitPrice'),p_device_id:required(deviceId,'deviceId')});
     },
     settleOrder:({operationId,sessionId,orderId,payments,deviceId})=>{
       if(!Array.isArray(payments))throw Error('payments deve ser array');
       return call('settle_order',{p_operation_id:uuid(operationId,'operationId'),p_session_id:uuid(sessionId,'sessionId'),p_order_id:required(orderId,'orderId'),p_payments:payments,p_device_id:required(deviceId,'deviceId')});
     },
     completeSale:({operationId,sessionId,saleId,items,payments,deviceId})=>{
       if(!Array.isArray(items)||!items.length||!Array.isArray(payments))throw Error('items/payments inválidos');
       return call('complete_sale',{p_operation_id:uuid(operationId,'operationId'),p_session_id:uuid(sessionId,'sessionId'),p_sale_id:required(saleId,'saleId'),p_items:items,p_payments:payments,p_device_id:required(deviceId,'deviceId')});
     },
     closeCash:({operationId,sessionId,countedCash,deviceId})=>call('close_cash',{
       p_operation_id:uuid(operationId,'operationId'),p_session_id:uuid(sessionId,'sessionId'),p_counted_cash:amount(countedCash,'countedCash'),p_device_id:required(deviceId,'deviceId')
     })
   });
 }
 return Object.freeze({create});
});

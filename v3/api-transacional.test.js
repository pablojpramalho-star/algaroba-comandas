// Testes do adaptador: node v3/api-transacional.test.js
const assert=require('node:assert/strict');
const {create}=require('./api-transacional');
(async()=>{
 const calls=[];
 const api=create({rpc:async(name,args)=>{calls.push({name,args});return {data:{ok:true},error:null}}});
 await api.openCash({operationId:'123e4567-e89b-42d3-a456-426614174000',openingAmount:0,deviceId:'pablo'});
 await api.addItem({operationId:'123e4567-e89b-42d3-a456-426614174001',sessionId:'123e4567-e89b-42d3-a456-426614174002',orderId:'mesa:1',itemName:'Carne',qty:2,unitPrice:7,deviceId:'claudia'});
 await api.sharedOrders();
 assert.equal(calls[0].name,'algaroba_v3_open_cash');
 assert.equal(calls[1].name,'algaroba_v3_add_order_item');
 assert.equal(calls[2].name,'algaroba_v3_shared_orders');
 assert.throws(()=>api.closeCash({operationId:'invalido',sessionId:'x',countedCash:0,deviceId:'x'}),/UUID/);
 assert.throws(()=>api.addItem({operationId:'123e4567-e89b-42d3-a456-426614174001',sessionId:'123e4567-e89b-42d3-a456-426614174002',orderId:'mesa:1',itemName:'Carne',qty:-1,unitPrice:7,deviceId:'x'}),/qty/);
 const failure=create({rpc:async()=>({data:null,error:{message:'AUTH_REQUIRED'}})});
 await assert.rejects(()=>failure.pilotStatus(),/AUTH_REQUIRED/);
 console.log('Adaptador 3.0: 6 verificações passaram');
})().catch(e=>{console.error(e);process.exitCode=1});

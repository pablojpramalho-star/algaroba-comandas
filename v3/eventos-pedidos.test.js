// Executar: node v3/eventos-pedidos.test.js
const assert=require('node:assert/strict');
const {mergeEvents,amountCents}=require('./eventos-pedidos');
const a={event_id:'aparelho-a:001',device_id:'aparelho-a',table_key:'table:1',items:[{product:'Espeto',qty:2,price:7}]};
const b={event_id:'aparelho-b:001',device_id:'aparelho-b',table_key:'table:1',items:[{product:'Suco',qty:1,price:6}]};
assert.equal(mergeEvents([a],[a]).length,1,'reenvio não duplica');
assert.equal(mergeEvents([a],[b]).length,2,'aparelhos distintos somam');
assert.equal(amountCents([a,b,a]),2000,'valor idempotente');
assert.throws(()=>mergeEvents([a],[{...a,items:[{product:'Espeto',qty:3,price:7}]}]),/Colisão/,'mesmo ID com valores divergentes deve bloquear');
assert.throws(()=>mergeEvents([],[{...a,items:[{product:'Espeto',qty:-1,price:7}]}]),/Item inválido/);
console.log('5 verificações de eventos passaram');

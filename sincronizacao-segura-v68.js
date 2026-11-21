(function installSafeSyncV68(){
 const PENDING='algarobaSyncPendingV68';
 const canExport=()=>!!authProfile&&['administrador','gerente'].includes(authProfile.perfil);
 const canExportCurrent=()=>canExport()||!!(authProfile&&blocked&&authProfile.perfil==='atendimento');
 const BACKUPS='algarobaComandasBackupsV68';
 const VERSION='2.9.7.90';
 const rawRequest=cloudRequest;
 const rawSave=save;
 let started=false,reading=false,writing=false,blocked=null,writeChain=Promise.resolve(),lastBackupSig={};
 const canon=x=>JSON.stringify(sortObject(x));
 function sortObject(x){
   if(Array.isArray(x))return x.map(sortObject);
   if(x&&typeof x==='object'){
     const out={};Object.keys(x).sort().forEach(k=>out[k]=sortObject(x[k]));return out;
   }return x;
 }
 function changedNow(){
   return stateRecords(state).filter(r=>!cloudSnapshot[r.record_key]||canon(JSON.parse(cloudSnapshot[r.record_key]))!==canon(r.data));
 }
 function labelKey(k){
   if(k.startsWith('table:'))return 'Mesa '+k.slice(6);
   return {counter:'Balcão',inventory:'Estoque',meta:'Caixa, histórico e pedidos de balcão',credit_accounts:'Contas a prazo'}[k]||k;
 }
 function activeRows(){return stateRecords(state)}
 function pendingRead(){
   try{const p=JSON.parse(localStorage.getItem(PENDING)||'null');return p&&Array.isArray(p.keys)?p:null}catch(e){return null}
 }
 function pendingWrite(){
   const keys=changedNow().map(r=>r.record_key);
   try{if(keys.length)localStorage.setItem(PENDING,JSON.stringify({keys,at:new Date().toISOString(),version:VERSION}));else localStorage.removeItem(PENDING)}catch(e){}
 }
 function backupRows(rows,why){
   let entries=[];
   try{entries=JSON.parse(localStorage.getItem(BACKUPS)||'[]');if(!Array.isArray(entries))entries=[]}catch(e){}
   let added=0;
   for(const r of rows||[]){
     const key=r.record_key||r.key;
     if(!key||!r.data)continue;
     // A centralização de estoque/caixa pode conter milhares de lançamentos:
     // guarda menos revisões grandes para não esgotar o armazenamento do PWA.
     const data=r.data,signature=canon(data),token=key+':'+signature.length+':'+signature.slice(-210);
     if(lastBackupSig[key]===token)continue;
     if(entries.some(e=>e.key===key&&e.signature===token))continue;
     lastBackupSig[key]=token;
     const size=signature.length;
     if(size>750000)continue;
     entries.push({key,at:new Date().toISOString(),why,signature:token,data,size});
     added++;
   }
   if(!added)return;
   const sizeOf=e=>JSON.stringify(e).length;
   entries=entries.sort((a,b)=>a.at.localeCompare(b.at));
   // Até 3 revisões por mesa, 2 por meta/estoque e 25 no total.
   const perKey={};
   entries=entries.reverse().filter(e=>{
     const max=e.key.startsWith('table:')?4:2;
     perKey[e.key]=(perKey[e.key]||0)+1;return perKey[e.key]<=max;
   }).slice(0,35);
   while(entries.length&&entries.reduce((v,e)=>v+sizeOf(e),0)>2200000)entries.pop();
   try{localStorage.setItem(BACKUPS,JSON.stringify(entries))}catch(e){
     // Backup cheio: não interfere na gravação da comanda.
     console.warn('Backup local cheio:',e);
   }
 }
 function alertSync(message,details){
   blocked={message,details:details||'',at:new Date().toISOString()};
   cloudLastError=message;
   cloudFailures++;
   setSyncStatus('error','⚠️ CONFLITO — CONFERIR');
   backupRows(activeRows(),'Conflito de sincronização detectado');
   try{localStorage.setItem('algarobaSyncConflictV68',JSON.stringify(blocked))}catch(e){}
   console.warn('ALGAROBA / SINCRONIZAÇÃO SEGURA:',message,details||'');
 }
 function clearBlock(){
   blocked=null;
   try{localStorage.removeItem('algarobaSyncConflictV68')}catch(e){}
 }
 function isDirty(){return !!changedNow().length}
 function latestRow(key){
   return activeRows().find(r=>r.record_key===key);
 }
 function dataLossSigns(localRecords,remoteRecords){
   const server=new Map(remoteRecords.map(r=>[r.record_key,r]));
   const reasons=[];
   for(const x of localRecords){
     const y=server.get(x.record_key);
     if(!y||!x.data||!y.data)continue;
     if(x.record_key.startsWith('table:')){
       const localOrderIds=new Set((x.data.orders||[]).map(o=>String(o.id)));
       const serverOrderIds=new Set((y.data.orders||[]).map(o=>String(o.id)));
       const lost=[...localOrderIds].filter(id=>!serverOrderIds.has(id));
       const mesa=x.record_key.slice(6),meta=server.get('meta')?.data||{},mesaName='Mesa '+String(mesa).padStart(2,'0');
       const recentOrderMs=Math.max(0,...(x.data.orders||[]).map(o=>new Date(o.createdAt||0).getTime()).filter(Number.isFinite));
       const hasValidClosure=(meta.history||[]).some(h=>String(h.name||'').startsWith(mesaName)&&
         new Date(h.closedAt||0).getTime()>=recentOrderMs);
       const hasValidCancel=(meta.cancellations||[]).some(h=>String(h.table||'').startsWith(mesaName)&&
         new Date(h.at||0).getTime()>=recentOrderMs);
       const movedFromHere=(meta.transfers||[]).some(t=>String(t.from)===String(mesa)&&
         new Date(t.at||0).getTime()>=recentOrderMs);
       const totalOf=t=>(t.items||[]).reduce((v,it)=>v+Number(it.qty||0)*Number(it.price||0),0);
       const beforeTotal=totalOf(x.data),afterTotal=totalOf(y.data);
       if(afterTotal+.009<beforeTotal&&!hasValidClosure&&!hasValidCancel&&!movedFromHere){
         reasons.push(labelKey(x.record_key)+' teve redução não justificada: '+beforeTotal.toFixed(2)+' → '+afterTotal.toFixed(2));
       }
       if(lost.length){
         const mesa=x.record_key.slice(6),meta=server.get('meta')?.data||{},name='Mesa '+String(mesa).padStart(2,'0');
         const affected=(x.data.orders||[]).filter(o=>lost.includes(String(o.id)));
         const closed=(meta.history||[]).some(s=>String(s.name||'').startsWith(name)&&
           affected.some(o=>new Date(s.closedAt||0)>=new Date(o.createdAt||0)));
         const cancelled=(meta.cancellations||[]).some(s=>String(s.table||'').startsWith(name)&&
           affected.some(o=>new Date(s.at||0)>=new Date(o.createdAt||0)));
         const moved=affected.every(o=>[...server.entries()].some(([key,row])=>
           key.startsWith('table:')&&key!==x.record_key&&(row.data?.orders||[]).some(other=>String(other.id)===String(o.id))));
         if(!closed&&!cancelled&&!moved)reasons.push(labelKey(x.record_key)+' com '+lost.length+' pedido(s) ausente(s) do servidor');
       }
     }
     if(x.record_key==='credit_accounts'){
       const a=x.data.accounts||[],b=y.data.accounts||[];
       const ids=new Set(b.map(c=>c.id));
       const missing=a.filter(c=>!ids.has(c.id));
       if(missing.length)reasons.push(missing.length+' cliente(s) a prazo ausentes do servidor');
       const receipts=new Set((y.data.receipts||[]).map(r=>r.id));
       const missingReceipts=(x.data.receipts||[]).filter(r=>!receipts.has(r.id));
       if(missingReceipts.length)reasons.push(missingReceipts.length+' pagamento(s) de clientes sumiram do servidor');
       for(const account of a){
         const remoteAccount=b.find(b=>b.id===account.id);
         if(!remoteAccount)continue;
         const chargeIds=new Set((remoteAccount.charges||[]).map(c=>c.id));
         const missingCharges=(account.charges||[]).filter(c=>!chargeIds.has(c.id));
         if(missingCharges.length)reasons.push(missingCharges.length+' consumo(s) do cliente '+String(account.name||'')+' não constam no servidor');
       }
     }
     if(x.record_key==='meta'){
       const localHistory=x.data.history||[],remoteHistory=y.data.history||[];
       const saleKey=s=>String(s.id||'')+'|'+String(s.originalClosedAt||s.closedAt||'');
       const activeSales=new Set(remoteHistory.map(saleKey));
       const disappeared=localHistory.slice(-80).filter(s=>!activeSales.has(saleKey(s)));
       if(disappeared.length)reasons.push(disappeared.length+' venda(s) do histórico local não constam na atualização');
       const withdrawals=new Set((y.data.internalAccounts?.withdrawals||[]).map(w=>String(w.id||'')+'|'+String(w.at||'')));
       const forgottenWithdrawals=(x.data.internalAccounts?.withdrawals||[]).slice(-30).filter(w=>
         !withdrawals.has(String(w.id||'')+'|'+String(w.at||'')));
       if(forgottenWithdrawals.length)reasons.push(forgottenWithdrawals.length+' retirada(s) de contas internas não constam no servidor');
       const settlements=new Set((y.data.internalAccounts?.settlements||[]).map(p=>String(p.id||'')+'|'+String(p.at||'')));
       const forgottenSettlements=(x.data.internalAccounts?.settlements||[]).slice(-30).filter(p=>
         !settlements.has(String(p.id||'')+'|'+String(p.at||'')));
       if(forgottenSettlements.length)reasons.push(forgottenSettlements.length+' pagamento(s) de contas internas não constam no servidor');
       const closures=new Set((y.data.cash?.closures||[]).map(c=>c.closedAt));
       const missingClosures=(x.data.cash?.closures||[]).slice(-20).filter(c=>!closures.has(c.closedAt));
       if(missingClosures.length)reasons.push(missingClosures.length+' fechamento(s) de caixa não constam no servidor');
       const latestQ=x.data.counterQueue||[],remoteQ=new Set((y.data.counterQueue||[]).map(q=>String(q.id)));
       for(const localQ of latestQ){
         const serverQ=(y.data.counterQueue||[]).find(q=>String(q.id)===String(localQ.id));
         if(!serverQ)continue;
         const totalOf=q=>(q.items||[]).reduce((v,it)=>v+Number(it.qty||0)*Number(it.price||0),0);
         const oldTotal=totalOf(localQ),newTotal=totalOf(serverQ);
         const cancel=(y.data.cancellations||[]).some(c=>
           String(c.table||'').includes(String(localQ.ticket||''))&&
           new Date(c.at||0)>=new Date(localQ.createdAt||0));
         if(newTotal+.009<oldTotal&&!cancel){
           reasons.push('Pedido de balcão '+String(localQ.ticket||localQ.id)+' teve redução não justificada');
           break;
         }
       }
       for(const q of latestQ){
         if(remoteQ.has(String(q.id)))continue;
         const cashPaid=remoteHistory.some(s=>String(s.ticket||'')===String(q.ticket||'')&&
           new Date(s.closedAt||0)>=new Date(q.createdAt||0));
         const internalPaid=(y.data.internalAccounts?.withdrawals||[]).some(w=>
           String(w.ticket||'')===String(q.ticket||'')&&new Date(w.at||0)>=new Date(q.createdAt||0));
         const creditPaid=(server.get('credit_accounts')?.data?.accounts||[]).some(a=>
           (a.charges||[]).some(c=>String(c.orderId)===String(q.id)));
         const cancelled=(y.data.cancellations||[]).some(c=>
           String(c.table||'').includes(String(q.ticket||''))&&new Date(c.at||0)>=new Date(q.createdAt||0));
         if(!cashPaid&&!internalPaid&&!creditPaid&&!cancelled){
           reasons.push('Pedido de balcão '+String(q.ticket||q.id)+' ausente do servidor');
           break;
         }
       }
     }
     if(x.record_key==='inventory'){
       const key=m=>[m.at,m.key,m.type,m.qty,m.before,m.after].join('|');
       const remoteMovements=new Set((y.data.movements||[]).map(key));
       const missing=(x.data.movements||[]).slice(-30).filter(m=>!remoteMovements.has(key(m)));
       if(missing.length)reasons.push(missing.length+' movimentação(ões) de estoque não constam no servidor');
     }
   }
   return reasons;
 }

 // Mesclagem de três vias: somente inclusões independentes são combinadas.
 // Mudanças destrutivas, pagamentos concorrentes e edições do mesmo evento
 // continuam bloqueados até que exista uma regra de negócio inequívoca.
 function mergeAppend(base,local,remote,key){
   if(!Array.isArray(base)||!Array.isArray(local)||!Array.isArray(remote))return null;
   const ident=x=>key(x);
   const b=new Map(base.map(x=>[ident(x),x]));
   const l=new Map(local.map(x=>[ident(x),x]));
   const r=new Map(remote.map(x=>[ident(x),x]));
   if([b,l,r].some((m,i)=>m.size!==[base,local,remote][i].length))return null;
   for(const [id,x] of b){
     if(!l.has(id)||!r.has(id)||canon(l.get(id))!==canon(x)||canon(r.get(id))!==canon(x))return null;
   }
   for(const [id,x] of l)if(r.has(id)&&canon(r.get(id))!==canon(x))return null;
   return [...remote,...local.filter(x=>!r.has(ident(x)))];
 }
 const eventKey=x=>String(x.id||'')+'|'+String(x.originalClosedAt||x.closedAt||x.at||x.createdAt||'');
 function mergeQueue(base,local,remote){
 const eq=(a,b)=>canon(a)===canon(b), maps=[base,local,remote].map(a=>new Map(a.map(x=>[String(x.id),x])));
 if(maps.some((m,i)=>m.size!==[base,local,remote][i].length))return null;
 const [b,l,r]=maps,out=[];
 for(const id of new Set([...r.keys(),...l.keys(),...b.keys()])){
   const x=b.get(id),y=l.get(id),z=r.get(id);
   if(eq(y,z)){if(y)out.push(y);continue}
   if(eq(x,y)){if(z)out.push(z);continue}
   if(eq(x,z)){if(y)out.push(y);continue}
   return null;
 }
 return out;
 }
 function mergeRecord(key,base,local,remote){
   if(!base||!local||!remote)return null;
   if(canon(local)===canon(remote))return remote;
   const eq=(a,b)=>canon(a)===canon(b);
   if(key.startsWith('table:')){
     // Only merge independent additions; closure, transfers and cancellations remain atomic conflicts.
     if([base,local,remote].some(t=>!Array.isArray(t.orders)||!Array.isArray(t.items)))return null;
     const strip=t=>({...t,orders:[],items:[],status:null});
     if(!eq(strip(base),strip(local))||!eq(strip(base),strip(remote)))return null;
     const orders=mergeAppend(base.orders,local.orders,remote.orders,o=>String(o.id));
     if(!orders)return null;
     const itemKey=i=>canon({...i,qty:0});
     const sums=a=>{const m=new Map();for(const i of a){const k=itemKey(i);m.set(k,(m.get(k)||0)+Number(i.qty));}return m};
     const check=(t,added)=>{const b=sums(base.items),n=sums(t.items),d=sums(added.flatMap(o=>o.items||[]));return [...new Set([...b.keys(),...n.keys(),...d.keys()])].every(k=>Math.abs((n.get(k)||0)-(b.get(k)||0)-(d.get(k)||0))<.00001)};
     const ids=new Set(base.orders.map(o=>String(o.id)));
     if(!check(local,local.orders.filter(o=>!ids.has(String(o.id))))||!check(remote,remote.orders.filter(o=>!ids.has(String(o.id)))))return null;
     const remoteIds=new Set(remote.orders.map(o=>String(o.id))),items=JSON.parse(JSON.stringify(remote.items));
     for(const o of orders.filter(o=>!remoteIds.has(String(o.id))))for(const i of o.items||[]){const x=items.find(a=>itemKey(a)===itemKey(i));if(x)x.qty+=i.qty;else items.push({...i})}
     return {...remote,orders,items,status:items.length?'ocupada':'livre'};
   }
   if(key==='credit_accounts'){
     const mergedReceipts=mergeAppend(base.receipts||[],local.receipts||[],remote.receipts||[],x=>String(x.id));
     if(!mergedReceipts)return null;
     const b=new Map((base.accounts||[]).map(x=>[x.id,x]));
     const l=new Map((local.accounts||[]).map(x=>[x.id,x]));
     const r=new Map((remote.accounts||[]).map(x=>[x.id,x]));
     const accounts=[];
     for(const [id,a] of r){
       const la=l.get(id),ba=b.get(id);
       if(!la){if(ba)return null;accounts.push(a);continue}
       if(!ba){if(!eq(a,la))return null;accounts.push(a);continue}
       if(!eq({...a,charges:[]},{...ba,charges:[]})||
          !eq({...la,charges:[]},{...ba,charges:[]}))return null;
       const charges=mergeAppend(ba.charges||[],la.charges||[],a.charges||[],x=>String(x.id));
       if(!charges)return null;
       accounts.push({...a,charges});
     }
     for(const [id,a] of l)if(!r.has(id)){
       if(b.has(id))return null;
       accounts.push(a);
     }
     if(!eq({...base,accounts:[],receipts:[]},{...local,accounts:[],receipts:[]})||
        !eq({...base,accounts:[],receipts:[]},{...remote,accounts:[],receipts:[]}))return null;
     return {...remote,accounts,receipts:mergedReceipts};
   }
   if(key==='inventory'){
     if(!eq({...base,items:{},movements:[]},{...local,items:{},movements:[]})||
        !eq({...base,items:{},movements:[]},{...remote,items:{},movements:[]}))return null;
     const mk=x=>[x.at,x.key,x.type,x.qty,x.before,x.after].join('|');
     const movements=mergeAppend(base.movements||[],local.movements||[],remote.movements||[],mk);
     if(!movements)return null;
     const items={...remote.items};
     for(const name of new Set([...Object.keys(base.items||{}),...Object.keys(local.items||{}),...Object.keys(remote.items||{})])){
       const b=base.items?.[name],l=local.items?.[name],r=remote.items?.[name];
       if(!b||!l||!r){if(!eq(l,r))return null;continue}
       if(!eq({...b,qty:0},{...l,qty:0})||!eq({...b,qty:0},{...r,qty:0}))return null;
       const localDelta=Number(l.qty)-Number(b.qty);
       const remoteDelta=Number(r.qty)-Number(b.qty);
       if(!Number.isFinite(localDelta)||!Number.isFinite(remoteDelta))return null;
       const localMovements=local.movements.filter(x=>!(base.movements||[]).some(y=>mk(y)===mk(x))&&x.key===name);
       const remoteMovements=remote.movements.filter(x=>!(base.movements||[]).some(y=>mk(y)===mk(x))&&x.key===name);
       if(Math.abs(localDelta-localMovements.reduce((n,x)=>n+Number(x.qty),0))>.00001||
          Math.abs(remoteDelta-remoteMovements.reduce((n,x)=>n+Number(x.qty),0))>.00001)return null;
       const delta=localMovements.filter(x=>!remoteMovements.some(y=>mk(y)===mk(x))).reduce((n,x)=>n+Number(x.qty),0);
       if(Number(r.qty)+delta<0)return null;
       items[name]={...r,qty:Number(r.qty)+delta};
     }
     return {...remote,items,movements};
   }
   if(key==='meta'){
     const history=mergeAppend(base.history||[],local.history||[],remote.history||[],eventKey);
     const queue=mergeQueue(base.counterQueue||[],local.counterQueue||[],remote.counterQueue||[]);
     if(!history||!queue)return null;
     const bt=base.counterTicket||{},lt=local.counterTicket||{},rt=remote.counterTicket||{};
     if(bt.date!==lt.date||bt.date!==rt.date)return null;
     const localNew=local.history.length-base.history.length;
     const remoteNew=remote.history.length-base.history.length;
     const baseRevenue=Number(base.revenue),localRevenue=Number(local.revenue),remoteRevenue=Number(remote.revenue);
     if(![baseRevenue,localRevenue,remoteRevenue].every(Number.isFinite))return null;
     const added=history.filter(x=>!(remote.history||[]).some(y=>eventKey(y)===eventKey(x)));
     const extra=added.reduce((n,x)=>n+Number(x.total||0),0);
     const baseIds=new Set((base.history||[]).map(eventKey));
     const additionsTotal=h=>h.filter(x=>!baseIds.has(eventKey(x))).reduce((n,x)=>n+Number(x.total||0),0);
     if(Math.abs(localRevenue-baseRevenue-additionsTotal(local.history))>.01||Math.abs(remoteRevenue-baseRevenue-additionsTotal(remote.history))>.01)return null;
     const cash=mergeAppend(base.cash?.movements||[],local.cash?.movements||[],remote.cash?.movements||[],x=>canon(x));
     if(!cash)return null;
     const strip=x=>({...x,history:[],counterQueue:[],counterTicket:null,revenue:0,cash:{...x.cash,movements:[]}});
     const bs=strip(base),ls=strip(local),rs=strip(remote);
     const fields={};
     for(const k of new Set([...Object.keys(bs),...Object.keys(ls),...Object.keys(rs)])){
       if(eq(ls[k],rs[k]))fields[k]=local[k];
       else if(eq(bs[k],ls[k]))fields[k]=remote[k];
       else if(eq(bs[k],rs[k]))fields[k]=local[k];
       else return null;
     }
     fields.cash={...fields.cash,movements:cash};
     const ticket=Math.max(Number(lt.last||0),Number(rt.last||0));
     if(queue.some((q,i)=>queue.findIndex(x=>x.ticket===q.ticket&&x.date===q.date)!==i))return null;
     return {...remote,...fields,history,counterQueue:queue,counterTicket:{...rt,last:ticket},revenue:remoteRevenue+extra};
   }
   return null;
 }

 // Reconciliação de cópias antigas após recuperação administrativa no banco.
 // Somente recebe o servidor quando TODOS os eventos locais continuam presentes
 // e o estado operacional restante é idêntico. Não grava nem fecha comandas.
 function remoteContainsEvents(local,remote,key){
   if(!Array.isArray(local)||!Array.isArray(remote))return false;
   const identity=x=>key(x);
   const seen=new Map(remote.map(x=>[identity(x),x]));
   if(seen.size!==remote.length)return false;
   return local.every(x=>seen.has(identity(x))&&canon(seen.get(identity(x)))===canon(x));
 }
 function recoveredRemoteDominates(key,local,remote){
   if(!local||!remote)return false;
   const eq=(a,b)=>canon(a)===canon(b);
   const prefix=(a,b)=>Array.isArray(a)&&Array.isArray(b)&&a.length<=b.length&&
     a.every((x,i)=>eq(x,b[i]));
   if(key==='inventory'){
     const lm=local.movements||[],rm=remote.movements||[];
     // Eventos podem chegar em ordem diferente após recuperação administrativa.
     // Comparar multiplicidade e conteúdo completo, sem exigir mesma posição.
     const counts=new Map();
     for(const mv of lm){const k=canon(mv);counts.set(k,(counts.get(k)||0)+1)}
     const additions=[];
     for(const mv of rm){
       const k=canon(mv),n=counts.get(k)||0;
       if(n)counts.set(k,n-1);else additions.push(mv);
     }
     if([...counts.values()].some(n=>n!==0))return false;
     const li=local.items||{},ri=remote.items||{};
     if(Object.keys(li).some(k=>!Object.prototype.hasOwnProperty.call(ri,k)))return false;
     // Novos cadastros vazios do catálogo não são perda de estoque.
     const newKeys=Object.keys(ri).filter(k=>!Object.prototype.hasOwnProperty.call(li,k));
     if(newKeys.some(k=>ri[k].qty!==0||ri[k].cost!==0||rm.some(m=>m.key===k)))return false;
     const expected={};
     for(const [k,v] of Object.entries(li))expected[k]=Number(v.qty);
     for(const mv of additions){
       if(!Object.prototype.hasOwnProperty.call(expected,mv.key))return false;
       if(Number(mv.before)!==expected[mv.key])return false;
       expected[mv.key]=Math.max(0,expected[mv.key]+Number(mv.qty));
       if(Number(mv.after)!==expected[mv.key])return false;
     }
     if(!Object.keys(li).every(k=>ri[k]&&
       eq({...li[k],qty:0},{...ri[k],qty:0})&&
       Number(ri[k].qty)===expected[k]))return false;
     return eq({...local,items:{},movements:[]},{...remote,items:{},movements:[]});
   }
   if(key==='meta'){
     const lh=local.history||[],rh=remote.history||[];
     const normalizedSale=s=>{
       const v={...s,closedAt:s.originalClosedAt||s.closedAt};
       delete v.originalClosedAt;delete v.businessDate;delete v.shift;
       return v;
     };
     if(!prefix(lh.map(normalizedSale),rh.map(normalizedSale)))return false;
     if(!prefix(local.cancellations||[],remote.cancellations||[]))return false;
     if(!remoteContainsEvents(local.counterQueue||[],remote.counterQueue||[],x=>String(x.id)))return false;
     const lt=local.counterTicket||{},rt=remote.counterTicket||{};
     if(lt.date!==rt.date||Number(rt.last||0)<Number(lt.last||0))return false;
     const extra=rh.slice(lh.length).reduce((sum,x)=>sum+Number(x.total||0),0);
     if(Math.abs(Number(local.revenue||0)+extra-Number(remote.revenue||0))>0.001)return false;
     return eq({...local,history:[],cancellations:[],revenue:0,counterQueue:[],counterTicket:null},
               {...remote,history:[],cancellations:[],revenue:0,counterQueue:[],counterTicket:null});
   }
   return false;
 }
 function remoteDominatesMeta(local,remote){
   if(!local||!remote)return false;
   const omit=x=>({...x,counterQueue:[],counterTicket:null,creditAccounts:null,
     cash:x.cash?{...x.cash,movements:[]}:x.cash});
   // A despesa registrada em outro aparelho pode estar somente no servidor.
   // Receber apenas acréscimos idênticos, sem perder movimentos locais.
   const localCash=local.cash?.movements||[],remoteCash=remote.cash?.movements||[];
   if(!localCash.every(v=>remoteCash.some(w=>canon(w)===canon(v))))return false;
   if(canon(omit(local))!==canon(omit(remote)))return false;
   const lq=local.counterQueue||[],rq=remote.counterQueue||[];
   if(!lq.every(q=>rq.some(v=>String(v.id)===String(q.id)&&canon(v)===canon(q))))return false;
   const lt=local.counterTicket||{},rt=remote.counterTicket||{};
   if(lt.date!==rt.date||Number(rt.last||0)<Number(lt.last||0))return false;
   const lc=local.creditAccounts||{accounts:[],receipts:[]};
   const rc=remote.creditAccounts||{accounts:[],receipts:[]};
   if(!Array.isArray(lc.accounts)||!Array.isArray(rc.accounts))return false;
   for(const a of lc.accounts){
     const b=rc.accounts.find(x=>x.id===a.id);
     if(!b||canon({...a,charges:[]})!==canon({...b,charges:[]}))return false;
     if(!(a.charges||[]).every(c=>(b.charges||[]).some(x=>x.id===c.id&&canon(x)===canon(c))))return false;
   }
   if(!(lc.receipts||[]).every(c=>(rc.receipts||[]).some(x=>x.id===c.id&&canon(x)===canon(c))))return false;
   return true;
 }
 async function getRows(){
   const rows=await rawRequest('algaroba_records?select=record_key,data,updated_at',{method:'GET'});
   if(!Array.isArray(rows))throw Error('Servidor não retornou lista válida de registros.');
   return rows;
 }
 async function safeWriteRows(requestRows){
   const requested=(Array.isArray(requestRows)?requestRows:[requestRows]).filter(x=>x?.record_key);
   if(!requested.length)return null;
   // Divergência em outro registro não impede envio deste lote: a transação
   // valida a revisão de cada registro e rejeita substituições conflitantes.
   backupRows(requested,'Cópia antes do envio ao servidor');
   pendingWrite();
   writing=true;
   try{
     const current=await getRows();
     const by=new Map(current.map(r=>[r.record_key,r]));
     const localAtPlanning=canon(activeRows());
     const requestedKeys=new Set(requested.map(r=>r.record_key));
     const unrelatedDirty=changedNow().some(r=>!requestedKeys.has(r.record_key));
     // PRÉ-CONFERÊNCIA DO LOTE INTEIRO antes de mudar qualquer registro.
     // Evita fechar a mesa se o histórico do caixa já está divergente.
     const plans=requested.map(row=>{
       const key=row.record_key,local=latestRow(key),remote=by.get(key),known=cloudSnapshot[key];
       let data=local?.data||row.data,merged=false;
       if(remote&&canon(remote.data)!==canon(data)&&
          (!known||canon(remote.data)!==canon(JSON.parse(known)))){
         const combined=known?mergeRecord(key,JSON.parse(known),data,remote.data):null;
         if(combined){data=combined;merged=true}
         else{
           backupRows([remote],'Versão divergente recebida do banco');
           alertSync('Outro aparelho alterou '+labelKey(key)+' antes da gravação. Nenhuma comanda será substituída.',key);
           throw Error('Conflito de sincronização em '+labelKey(key)+': lote não enviado.');
         }
       }
       const same=!!remote&&canon(remote.data)===canon(data);
       return {key,data,remote,same,merged};
     });
     // O modelo legado duplica contas a prazo dentro de meta.
     // As duas representações devem conter o MESMO conjunto conciliado.
     const creditPlan=plans.find(p=>p.key==='credit_accounts');
     const metaPlan=plans.find(p=>p.key==='meta');
     if(creditPlan&&metaPlan&&creditPlan.merged){
       metaPlan.data={...metaPlan.data,creditAccounts:creditPlan.data};
       metaPlan.same=!!metaPlan.remote&&canon(metaPlan.remote.data)===canon(metaPlan.data);
       metaPlan.merged=true;
     }
     // Lote único: o PostgreSQL valida todas as versões e grava tudo em uma transação.
     // Se um aparelho modificar qualquer registro, o banco desfaz o lote inteiro.
     try{
       const changes=plans.filter(p=>!p.same).map(p=>({
         record_key:p.key,data:p.data,expected_at:p.remote?.updated_at||null
       }));
       if(changes.length){
         const result=await rawRequest('rpc/algaroba_atomic_write',{
           method:'POST',body:JSON.stringify({p_changes:changes})
         });
         if(!result||Number(result.saved)!==changes.length)
           throw Error('Servidor não confirmou todas as gravações do lote.');
       }
       // Se houve mesclagem, atualizar a memória local somente depois do commit
       // confirmado, para evitar que um save posterior reenvie a versão antiga.
       if(plans.some(p=>p.merged)){
         if(unrelatedDirty)throw Error('Outros registros locais pendentes; união preservada no servidor, atualização local suspensa.');
         const latest=await getRows();
         if(canon(activeRows())!==localAtPlanning)
           throw Error('Novo lançamento local durante a conciliação. O servidor já salvou o lote; preserve os dados e reavalie.');
         for(const plan of plans.filter(p=>p.merged)){
           const persisted=latest.find(x=>x.record_key===plan.key);
           if(!persisted||canon(persisted.data)!==canon(plan.data))
             throw Error('Conciliação gravada, mas o banco mudou antes da atualização local.');
         }
         backupRows(activeRows(),'Antes de aplicar união de lançamentos simultâneos');
         cloudApplying=true;
         let applied=false;
         try{applied=applyRows(latest)}finally{cloudApplying=false}
         if(!applied)throw Error('A união foi salva no banco, mas a aplicação local falhou.');
       }
       for(const plan of plans)cloudSnapshot[plan.key]=JSON.stringify(plan.data);
     }catch(e){
       if(!blocked){const msg=String(e.message||e);if(/CONCURRENT_WRITE|40001/i.test(msg)){
         // Concorrência é transitória: a próxima tentativa relê a versão central.
         // Não congela todos os aparelhos por uma colisão normal entre gravações.
         cloudLastError=msg;pendingWrite();
         setSyncStatus('offline','CONCORRÊNCIA — RECONCILIANDO AUTOMATICAMENTE');
       }else if(/conciliação|união/i.test(msg)){
         cloudLastError=msg;pendingWrite();
         setSyncStatus('offline','CONFERINDO GRAVAÇÃO — NOVA TENTATIVA');
       }else{cloudLastError=msg;pendingWrite();setSyncStatus('offline','PENDENTE — NOVA TENTATIVA AUTOMÁTICA');}}
       throw e;
     }
     clearBlock();
     cloudFailures=0;cloudLastError='';
     pendingWrite();
     if(isDirty()){
       scheduleCloudSave();setSyncStatus('offline','PENDENTE DE SINCRONIZAÇÃO');
     }else setSyncStatus('online','ONLINE • SALVO');
     return null;
   }finally{
     writing=false;
   }
 }
 cloudRequest=function(path,opts={}){
   if(/^algaroba_records\?on_conflict=record_key/.test(path)&&String(opts.method||'').toUpperCase()==='POST'){
     let body;
     try{body=JSON.parse(opts.body)}catch(e){return Promise.reject(Error('Dados inválidos ao sincronizar o caixa.'))}
     // Nunca dispara gravações concorrentes, inclusive quando a transação
     // veio das rotinas antigas de pagamento/estoque.
     const execute=()=>safeWriteRows(body);
     const job=writeChain.then(execute,execute);
     writeChain=job.catch(()=>{});
     return job;
   }
   return rawRequest(path,opts);
 };
 pushChangedRecords=async function(){
   if(!cloudReady||writing||reading)return;
   const changes=changedNow();
   if(!changes.length){pendingWrite();setSyncStatus('online','ONLINE • SALVO');return}
   setSyncStatus('offline','SALVANDO '+changes.length+' REGISTRO(S)…');
   try{
     await cloudRequest('algaroba_records?on_conflict=record_key',{
       method:'POST',prefer:'resolution=merge-duplicates,return=minimal',
       body:JSON.stringify(changes)
     });
     if(!blocked){
       pendingWrite();
       if(isDirty())scheduleCloudSave();
       else setSyncStatus('online','ONLINE • SALVO');
     }
   }catch(e){
     console.error('Sincronização protegida',e);
     if(!blocked){cloudLastError=String(e.message||e);pendingWrite();setSyncStatus('offline','PENDENTE — NOVA TENTATIVA AUTOMÁTICA');}
   }
 };
 save=function(){
   const before=activeRows();
   backupRows(before,'Alteração registrada na comanda');
   const result=rawSave();
   pendingWrite();
   return result;
 };
 pullRecords=async function(first=false){
   if(reading||writing||blocked)return false;
   if(!first){
     if(!cloudReady||userIsEditing()||Date.now()<cloudPausePullUntil)return false;
     if(isDirty()||pendingRead()){
       if(isDirty()){pendingWrite();scheduleCloudSave()}else pendingWrite()
       return false;
     }
   }
   reading=true;
   try{
     const pendingAtStart=pendingRead();
     const currentStateAtStart=first?null:canon(activeRows());
     let rows=await getRows();
     if(!rows.length){
       if(first){
         // Sem registros: não inventa um banco vazio nem apaga comandas locais.
         alertSync('Não foram encontrados registros no banco. Os dados locais foram mantidos; confira a conexão e o projeto.', 'Banco vazio');
       }
       return false;
     }
     if(writing||blocked||(!first&&(userIsEditing()||Date.now()<cloudPausePullUntil||
       isDirty()||pendingRead()||canon(activeRows())!==currentStateAtStart))){
       return false;
     }
     const local=activeRows();
     if(first){
       // Guardar o conteúdo local antes da primeira atualização.
       backupRows(local,'Cópia antes de conectar ao banco');
       if(pendingAtStart){
         const remoteMap=new Map(rows.map(x=>[x.record_key,x.data]));
         const suspicious=pendingAtStart.keys.filter(k=>{
           const localData=local.find(x=>x.record_key===k)?.data;
           const remoteData=remoteMap.get(k);
           return localData&&canon(localData)!==canon(remoteData);
         });
         if(suspicious.length){
           alertSync('Existem lançamentos salvos neste aparelho que não estão confirmados no banco. A atualização automática foi suspensa para não apagar comandas.',suspicious.map(labelKey).join(', '));
           return false;
         }
       }
       const risks=dataLossSigns(local,rows);
       if(risks.length){
         alertSync('A cópia do servidor não contém todos os pedidos locais. A versão deste aparelho foi preservada para conferência.',risks.join('; '));
         return false;
       }
     }else{
       // Mesmo sem alterações locais, um aparelho desatualizado pode
       // ter enviado uma cópia regressiva. Não escondemos pedidos perdidos.
       const risks=dataLossSigns(local,rows);
       if(risks.length){
         alertSync('O servidor retornou uma versão sem pedidos que estavam visíveis neste aparelho. A comanda não foi substituída.',risks.join('; '));
         return false;
       }
     }
     cloudApplying=true;
     const applied=applyRows(rows);
     cloudApplying=false;
     if(applied){
       clearBlock();pendingWrite();refreshVisible();
     }
     cloudFailures=0;cloudLastError='';
     setSyncStatus('online','ONLINE • ATUALIZADO');
     return !!applied;
   }catch(e){
     cloudApplying=false;cloudLastError=e.message||String(e);cloudFailures++;
     console.error('Leitura protegida',e);
     setSyncStatus('error','⚠️ ERRO DE SINCRONIZAÇÃO');
     if(first)throw e;return false;
   }finally{reading=false}
 };
 // Caixa único: operações de abertura e fechamento exigem a revisão central atual.
 const originalOpenCash=openCash,originalConfirmCloseCash=confirmCloseCash;
 let cashTransition=false;
 async function centralCashTransition(opening,action){
   if(cashTransition)return;
   if(!cloudReady||!navigator.onLine||reading||writing||isDirty()||pendingRead())
     return alert('Caixa central ainda não confirmado. Aguarde a sincronização antes de abrir ou fechar.');
   cashTransition=true;
   try{
     const before=canon(activeRows());
     const rows=await getRows(),meta=rows.find(r=>r.record_key==='meta');
     if(!meta?.data?.cash||reading||writing||canon(activeRows())!==before)
       return alert('Não foi possível confirmar o caixa central. Tente novamente.');
     const local=latestRow('meta')?.data;
     if(canon(meta.data.cash)!==canon(local?.cash)){
       return alert('O caixa central mudou em outro aparelho. Feche esta janela, aguarde a atualização e confira novamente.');
     }
     if(!!meta.data.cash.open===opening){
       if(opening)renderCash();
       return alert(opening?'O caixa central já está aberto para todos.':'O caixa central já está fechado.');
     }
     await action();
   }catch(e){alert('Não foi possível confirmar a operação no caixa central. Confira a sincronização.');}
   finally{cashTransition=false;}
 }
 openCash=function(){return centralCashTransition(true,originalOpenCash)};
 confirmCloseCash=function(){return centralCashTransition(false,originalConfirmCloseCash)};
 const priorEditing=userIsEditing;
 userIsEditing=function(){
   const modal=document.getElementById('modal');
   return !!(modal&&!modal.classList.contains('hide'))||priorEditing();
 };
 const priorFinishPayment=finishPayment;
 let checkingPayment=false;
 finishPayment=async function(){
   if(checkingPayment)return;
   if(!cloudReady||!navigator.onLine)return alert('Sem conexão com o caixa central. Confira a conta no caixa online.');
   if(!payCtx)return;
   checkingPayment=true;
   const ctx=payCtx;
   try{
     if(reading||writing)return alert('Aguarde a confirmação da sincronização e tente novamente.');
     const key=ctx.tableId==='counterQueue'?'meta':ctx.tableId==='counter'?'counter':'table:'+ctx.tableId;
     const local=latestRow(key)?.data;
     const rows=await getRows();
     const remote=rows.find(r=>r.record_key===key)?.data;
     const select=x=>ctx.tableId==='counterQueue'?x?.counterQueue?.find(o=>String(o.id)===String(ctx.counterId)):x;
     if(payCtx!==ctx||!select(local)||!select(remote)||canon(select(local))!==canon(select(remote))||canon(select(latestRow(key)?.data))!==canon(select(local))){
       return alert('Conta ainda não confirmada pelo servidor ou alterada por outro aparelho. Não cobre este valor. Confira a comanda no caixa online.');
     }
     await priorFinishPayment();
   }catch(e){alert('Não foi possível confirmar a conta online. Confira os lançamentos antes de cobrar.');}
   finally{checkingPayment=false;}
 };
 const originalInit=initCloud;
 initCloud=async function(){
   // A rotina antiga inicia o polling; a leitura protegida é chamada por
   // referência, inclusive no tablet que antes não conferia mudanças locais.
   await originalInit();
   if(blocked){setSyncStatus('error','⚠️ CONFLITO — CONFERIR');if(cloudReady&&authProfile)await window.retrySafeSyncV68(true);}
   else if(cloudReady&&isDirty())scheduleCloudSave();
 };
 function backupList(){
   try{const list=JSON.parse(localStorage.getItem(BACKUPS)||'[]');return Array.isArray(list)?list:[]}catch(e){return []}
 }

 window.retrySafeSyncV68=async function(automatic=false){
   const notify=message=>{if(!automatic)alert(message)};
   const dismiss=()=>{if(!automatic)closeModal()};
   if(!(automatic?!!authProfile:canExportCurrent()))return notify('Somente Administrador ou Gerente pode conciliar a sincronização.');
   if(!cloudReady)return notify('Sem conexão online. Preserve as cópias e tente quando a internet estiver disponível.');
   if(reading||writing)return notify('A sincronização ainda está verificando dados. Tente novamente.');
   try{
     const server=await getRows(),by=new Map(server.map(r=>[r.record_key,r]));
     const local=activeRows();
     // Se a recuperação administrativa já tornou as bases idênticas,
     // atualizar o snapshot sem reenviar dados ou depender de revisão antiga.
     const identical=(a,b)=>a.length===b.length&&a.every(r=>b.some(v=>v.record_key===r.record_key&&canon(v.data)===canon(r.data)));
     if(identical(local,server)){
       const fresh=await getRows();
       if(!identical(activeRows(),fresh))return notify('A central mudou durante a conferência. Tente novamente.');
       cloudApplying=true;let applied=false;
       try{applied=applyRows(fresh)}finally{cloudApplying=false}
       if(!applied)throw Error('Falha ao aplicar a base conferida.');
       clearBlock();pendingWrite();cloudLastError='';cloudFailures=0;refreshVisible();setSyncStatus('online','ONLINE • ATUALIZADO');dismiss();notify('Todos os registros conferidos. Caixa central sincronizado.');return;
     }
     // Recuperação administrativa de exportações conferidas em 18/11/2026.
     // Não aceita dados locais novos nem uma revisão do servidor diferente.
     const approvedExports=new Set(['ac4d2e2eaba322942051cdb6e85cc423e16a137dee5b425a36b58f6ab4318d0b']);
     const approvedRevisions={"counter":1791034939884,"credit_accounts":1795095118357,"inventory":1795095172605,"meta":1795095280273,"table:1":1795048728799,"table:10":1794016549497,"table:2":1795095118358,"table:3":1795052799561,"table:4":1794353159351,"table:5":1794357058122,"table:6":1794686383700,"table:7":1794017804827,"table:8":1791551413702,"table:9":1794453797154};
     const exportDigest=async rows=>{
       const payload=canon(rows.map(r=>({record_key:r.record_key,data:r.data})).sort((a,b)=>a.record_key.localeCompare(b.record_key)));
       const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(payload));
       return Array.from(new Uint8Array(hash),b=>b.toString(16).padStart(2,'0')).join('');
     };
     // Recuperação 20/11: somente o backup exato de Claudevânia já conciliado
     // no servidor, sem reenviar vendas ou alterar estoque/caixa.
     // Recuperação Larissa: aceita somente o backup auditado de 20/11
     // ou registros que já coincidem integralmente com a central.
     // Recuperação pontual do aparelho Pablo, backup exportado 20/11 14:43 UTC.
     // A cópia local anulou indevidamente um débito de Lucas; a central contém
     // o lançamento válido. Nunca enviar esta anulação ao servidor.
     const pabloAudited={"meta":"03153b243f8117baa35ee3298d5bb957bf0cfc4e425917fe7bd70aadc9454494","credit_accounts":"ed6e393e9bbf55bcc568c0d5dfa2c8f803630c26eb4e208730de20616d9c486c"};
     const pabloSafe=async(localRows,serverRows)=>{
       if(localRows.length!==serverRows.length)return false;
       for(const row of localRows){
         const remote=serverRows.find(r=>r.record_key===row.record_key);
         if(!remote)return false;
         if(canon(row.data)===canon(remote.data))continue;
         if(!pabloAudited[row.record_key])return false;
         const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(canon(row.data)));
         const hex=Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
         if(hex!==pabloAudited[row.record_key])return false;
       }
       const meta=serverRows.find(r=>r.record_key==='meta')?.data;
       const credits=serverRows.find(r=>r.record_key==='credit_accounts')?.data;
       const lucas=(credits?.accounts||[]).find(a=>a.id==='cliente-mwdu0zxn-cbwgk8');
       const charges=(lucas?.charges||[]).filter(c=>c.id==='consumo-mwoy4w3i-bwcbeo'&&String(c.orderId)==='1795177168046'&&Number(c.total)===21&&!c.voided);
       return !!(meta&&credits&&charges.length===1&&!(meta.counterQueue||[]).some(q=>String(q.id)==='1795177168046')&&(meta.history||[]).length>=473);
     };
     if(authProfile&&globalThis.crypto?.subtle&&await pabloSafe(local,server)){
       if(!automatic&&!confirm('Backup de Pablo conferido. O débito de Lucas (R$ 21) já está correto na central. Receber a base central, sem duplicar lançamentos?'))return;
       const fresh=await getRows();
       if(!identical(server,fresh)||!await pabloSafe(activeRows(),fresh))throw Error('A central ou o aparelho mudou durante a conferência. Exporte novo backup.');
       backupRows(local,'Cópia auditada de Pablo antes de receber a central');
       cloudApplying=true;let applied=false;
       try{applied=applyRows(fresh)}finally{cloudApplying=false}
       if(!applied)throw Error('Falha ao aplicar base central.');
       clearBlock();pendingWrite();cloudLastError='';cloudFailures=0;
       refreshVisible();setSyncStatus('online','ONLINE • ATUALIZADO');
       dismiss();notify('Pablo sincronizado com a central. Débito de Lucas preservado uma única vez.');return;
     }
     const larissaDigests={"table:1":"815581555beb862a7239808506d9e3cf4a747d854e8d44b63b167dafa81e98e1","table:2":"233f9254ef1c0ce902cc8bdec8122ad82940b4d7d9a8efa6d10fd44737756b2e","table:3":"9491e65de0f4b5934e7e8b9ff1b24ede50b722e200f8f7a69f758a661d2e7bab","table:4":"792fcde86775c1e53583540e5d0e52fbea29cc562c174116740861f8cd568486","table:5":"59dd7a9a98e476857d2465928f37447587fe051dd5851169dc2ec9f4ad0958df","table:6":"beccd5afb7cf30cba907610900923f62da3e9f683739722b819208d3621a39e7","table:7":"f8c67c9027f1b562f256f9a7cfd0d86cbae669eb135b05fb0a8e294dcf2a7ee6","table:8":"9b88b03ec2eb3856d0a54b3c2e4c3e7c8deb97a9f4f79cf160092b87322cf5d5","table:9":"aaa71583b5ca1abac0d9d337a27cca96afe5de54c0e753a72df619a425f66f0a","table:10":"ff956a1f6bab1b579cbd9c5cae17190ca66fb298ca08fd9fb350f6b73485b9db","counter":"5ada3cf6028908978ffa3a572646ad0c4b174866c89f23f0f404967011b31f68","inventory":"0fb30ca495ed21b50acf13f30bd27d4b31cae404f2d62a16a571bd64d9b6c425","meta":"283b20d5c0c3ab683b948fb30b8074ba416ddae2224c51beaf53cec5c5e7fb7c","credit_accounts":"139bb200b7dc68dbedefe2d5c41f7cce160c534c84b2f5144eb0526e6a4325bf"};
     const larissaRecovered=rows=>{
       const m=rows.find(r=>r.record_key==='meta')?.data;
       const inv=rows.find(r=>r.record_key==='inventory')?.data;
       const t1=rows.find(r=>r.record_key==='table:1')?.data;
       const t3=rows.find(r=>r.record_key==='table:3')?.data;
       const credits=rows.find(r=>r.record_key==='credit_accounts')?.data;
       const sold=(name,total)=>(m?.history||[]).some(h=>h.name===name&&Number(h.total)===total&&String(h.closedAt||'').startsWith('2026-11-20T22:'));
       const hasOrders=(table,ids)=>ids.every(id=>(table?.orders||[]).some(o=>String(o.id)===id));
       const table1Safe=hasOrders(t1,['1795190628499','1795194825895'])||((t1?.status==='livre')&&sold('Mesa 01',143));
       const table3Safe=hasOrders(t3,['1795190479226','1795192449365'])||((t3?.status==='livre')&&sold('Mesa 03',45));
       const required=['2026-11-20T16:44:49.525Z','2026-11-20T16:48:17.040Z','2026-11-20T17:13:45.893Z'];
       return !!(m&&inv&&t1&&t3&&credits&&table1Safe&&table3Safe&&
         required.every(at=>(inv.movements||[]).some(v=>v.at===at&&v.operator==='Larissa miguel'))&&
         (m.history||[]).length>=485&&(credits.receipts||[]).length>=5);
     };
     const larissaSafe=async(local,remote)=>{
       if(local.length!==remote.length)return false;
       for(const r of local){
         const srv=remote.find(x=>x.record_key===r.record_key);
         if(!srv||!larissaDigests[r.record_key])return false;
         if(canon(r.data)!==canon(srv.data)){
           const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(canon(r.data)));
           const hex=Array.from(new Uint8Array(hash),b=>b.toString(16).padStart(2,'0')).join('');
           if(hex!==larissaDigests[r.record_key])return false;
         }
       }
       return true;
     };
     if(authProfile&&globalThis.crypto?.subtle&&larissaRecovered(server)&&await larissaSafe(local,server)){
       if(!automatic&&!confirm('Vendas e estoque de Larissa já conciliados. Receber a base única do caixa e voltar ONLINE?'))return;
       const fresh=await getRows();
       if(!larissaRecovered(fresh)||!identical(server,fresh)||!await larissaSafe(activeRows(),fresh))
         throw Error('Os dados mudaram durante a recuperação. Exporte novo backup e preserve o aparelho.');
       backupRows(local,'Backup Larissa antes de receber central conciliada');
       cloudApplying=true;let applied=false;
       try{applied=applyRows(fresh)}finally{cloudApplying=false}
       if(!applied)throw Error('Falha ao aplicar base central.');
       clearBlock();pendingWrite();cloudLastError='';cloudFailures=0;
       refreshVisible();setSyncStatus('online','ONLINE • ATUALIZADO');
       dismiss();notify('Larissa recebeu o caixa e estoque centralizados.');return;
     }
     const claudiaDigest='8f10f9e7c6a42710142ba2bd81ec5a53aa8ffd94766d8b7f8d42fab93f84a0ec';
     // Permitir também sincronização parcial: cada registro local deve ser
     // exatamente o backup auditado ou a versão já unificada do servidor.
     const claudiaRecordDigests={"table:1":"88a75cc18e932cff704216f3fd4912e9597ac0e5083186d06b40489b000c768f","table:2":"9b4aca536e2ed5f3ba377098304ed2363b74fe7795bfb6760e101a0b8ca3d6b2","table:3":"1b2488536a259dbce4a23332b674431f5afcb698917d3353120039a9070a467b","table:4":"47a45c4e377e04932cad043965b765b6f1764fd19f492c8c0c30293d5da7fdf9","table:5":"4d6f5624a723b1da32960c8eb4d7c11fc62716649d6ad68c878ffcd20c1bff62","table:6":"372bcb824cd6409822761ca3b1ab5a9d317be3e4a180219ec3ae7b375e39cc3b","table:7":"843d8256e61a23bb0062b846c4d7bab9c206bf70d8e473f40048aab725ab96ab","table:8":"7683ccf7fe9200857e6b2c1fc8c0490e3cb870e029902ba0afb1c65f217a4e1b","table:9":"aaa71583b5ca1abac0d9d337a27cca96afe5de54c0e753a72df619a425f66f0a","table:10":"ff956a1f6bab1b579cbd9c5cae17190ca66fb298ca08fd9fb350f6b73485b9db","counter":"5ada3cf6028908978ffa3a572646ad0c4b174866c89f23f0f404967011b31f68","inventory":"36dcb8962d40fc121bbca86a5a51b5c320759e2b5f7434807589bf43a24d83b6","meta":"8853053057198026c4f02ef381d67cf12596315275827bb82e9b28e601762833","credit_accounts":"c6c917fbfb111c8327bed03e117446ade941b833984035f63b39bf85aea89fff"};
     const digestData=async d=>{
       const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(canon(d)));
       return Array.from(new Uint8Array(hash),b=>b.toString(16).padStart(2,'0')).join('');
     };
     const claudiaPartial=async(local,server)=>{
       if(local.length!==server.length)return false;
       for(const r of local){
         const remote=server.find(x=>x.record_key===r.record_key);
         if(!remote||!claudiaRecordDigests[r.record_key])return false;
         if(canon(r.data)!==canon(remote.data)&&await digestData(r.data)!==claudiaRecordDigests[r.record_key])return false;
       }
       return true;
     };
     const claudiaRecovered=rows=>{
       const m=rows.find(r=>r.record_key==='meta')?.data;
       const inv=rows.find(r=>r.record_key==='inventory')?.data;
       if(!m||!inv||(m.history||[]).length!==459||(inv.movements||[]).length!==3268)return false;
       const expected={'table:1':3,'table:2':1,'table:3':1,'table:4':3,'table:5':1,'table:6':2,'table:7':3,'table:8':3};
       if(!Object.entries(expected).every(([k,n])=>(rows.find(r=>r.record_key===k)?.data?.orders||[]).length===n))return false;
       const q=m.counterQueue||[];
       return q.length===3&&[18,19,1].every(n=>q.some(v=>Number(v.ticket)===n));
     };
     if(authProfile&&globalThis.crypto?.subtle&&claudiaRecovered(server)&&(await exportDigest(local)===claudiaDigest||await claudiaPartial(local,server))){
       if(!automatic&&!confirm('Backup de Claudevânia conciliado no servidor. Receber caixa único e voltar ONLINE?'))return;
       const fresh=await getRows();
       if(!claudiaRecovered(fresh)||!identical(server,fresh)||!(await exportDigest(activeRows())===claudiaDigest||await claudiaPartial(activeRows(),fresh)))
         throw Error('A central ou o aparelho mudou durante a conferência. Preserve o backup.');
       backupRows(local,'Backup Claudevânia antes de receber central unificada');
       cloudApplying=true;let applied=false;
       try{applied=applyRows(fresh)}finally{cloudApplying=false}
       if(!applied)throw Error('Falha ao aplicar base central conciliada.');
       clearBlock();pendingWrite();cloudLastError='';cloudFailures=0;
       refreshVisible();setSyncStatus('online','ONLINE • ATUALIZADO');
       dismiss();notify('Claudevânia recebeu a central conciliada. Pedidos e estoque preservados.');return;
     }
     const revisionMatch=rows=>rows.length===Object.keys(approvedRevisions).length&&rows.every(r=>approvedRevisions[r.record_key]===Date.parse(r.updated_at));
     if(canExport()&&revisionMatch(server)&&globalThis.crypto?.subtle&&approvedExports.has(await exportDigest(local))){
       if(!automatic&&!confirm('A cópia deste aparelho corresponde ao backup conferido. Receber a base central consolidada, preservando os arquivos de auditoria já exportados?'))return;
       const fresh=await getRows();
       if(!revisionMatch(fresh)||!approvedExports.has(await exportDigest(activeRows())))throw Error('Os dados mudaram durante a conferência. Não foi aplicada a recuperação.');
       backupRows(local,'Antes de receber base central conferida em 19/11');
       cloudApplying=true;
       let applied=false;
       try{applied=applyRows(fresh)}finally{cloudApplying=false}
       if(!applied)throw Error('Falha ao aplicar base central.');
       clearBlock();pendingWrite();cloudLastError='';cloudFailures=0;
       refreshVisible();setSyncStatus('online','ONLINE • ATUALIZADO');
       dismiss();notify('Base central recebida com segurança. Nenhuma venda foi reenviada.');
       return;
     }
     // Backup Pablo 19/11 10:44: registros históricos conferidos; somente leitura da central.
     const pabloDigest='b9f4126428ff963c2eb2ac20f102f8c4ab846edfbd37cd642b281e2b36757896';
     const pabloCentral=rows=>{
       const m=rows.find(r=>r.record_key==='meta'),i=rows.find(r=>r.record_key==='inventory');
       return rows.length===14&&Date.parse(m?.updated_at)>=Date.parse('2026-11-19T13:42:49.457Z')&&Date.parse(i?.updated_at)>=Date.parse('2026-11-19T13:42:49.436Z')&&m.data.history.length>=440&&i.data.movements.length>=3126&&m.data.history.some(h=>h.closedAt==='2026-11-19T02:24:58.477Z'&&h.ticket===9&&h.total===17);
     };
     if(blocked&&authProfile?.perfil==='administrador'&&globalThis.crypto?.subtle&&pabloCentral(server)&&await exportDigest(local)===pabloDigest){
       if(!automatic&&!confirm('Backup conferido. Receber a base central atual sem reenviar vendas antigas?'))return;
       const fresh=await getRows();
       if(!pabloCentral(fresh)||await exportDigest(activeRows())!==pabloDigest)throw Error('Dados alterados; recuperação não aplicada.');
       backupRows(local,'Backup Pablo 10:44 conciliado');
       cloudApplying=true;let applied=false;
       try{applied=applyRows(fresh)}finally{cloudApplying=false}
       if(!applied)throw Error('Falha ao receber base central.');
       clearBlock();pendingWrite();cloudLastError='';cloudFailures=0;refreshVisible();setSyncStatus('online','ONLINE • ATUALIZADO');dismiss();notify('Base central recebida sem reenviar vendas.');return;
     }
     // Recuperação pontual do backup de Larissa, conciliado pela administração.
     const larissaDigest='f6579ce27bbfd4eceafb4f0f3e093f5a38889de44e445635996a77e47feb29e8';
     const larissaRevisions={"counter":"2026-10-03 13:42:19.884+00","credit_accounts":"2026-11-19 00:14:39.840959+00","inventory":"2026-11-19 01:27:09.824708+00","meta":"2026-11-19 12:48:31.490335+00","table:1":"2026-11-19 00:38:48.79985+00","table:10":"2026-11-07 01:55:49.497+00","table:2":"2026-11-18 03:05:28.975912+00","table:3":"2026-11-19 01:46:39.561544+00","table:4":"2026-11-10 23:25:59.351+00","table:5":"2026-11-11 00:30:58.122+00","table:6":"2026-11-14 19:59:43.700725+00","table:7":"2026-11-07 02:16:44.827+00","table:8":"2026-10-09 13:10:13.702+00","table:9":"2026-11-12 03:23:17.154681+00"};
     const larissaMatch=rows=>rows.length===Object.keys(larissaRevisions).length&&rows.every(r=>larissaRevisions[r.record_key]===r.updated_at);
     if(blocked&&authProfile&&globalThis.crypto?.subtle&&larissaMatch(server)&&await exportDigest(local)===larissaDigest){
       const fresh=await getRows();
       if(!larissaMatch(fresh)||await exportDigest(activeRows())!==larissaDigest)throw Error('Dados alterados; recuperação não aplicada.');
       backupRows(local,'Backup Larissa conciliado; saldo central prioritário');
       cloudApplying=true;let applied=false;
       try{applied=applyRows(fresh)}finally{cloudApplying=false}
       if(!applied)throw Error('Falha ao receber base central.');
       clearBlock();pendingWrite();cloudLastError='';cloudFailures=0;refreshVisible();setSyncStatus('online','ONLINE • ATUALIZADO');dismiss();notify('Backup conferido; base central recebida.');return;
     }
     // Exportação Larissa 11:33 preservada externamente; recuperação somente leitura.
     const larissaCurrentDigest='776aa929a828e17675992c698e75bc2f287334ee1fac176c0156076614ebd562';
     const larissaCentralCurrent=rows=>{
       const m=rows.find(r=>r.record_key==='meta')?.data,i=rows.find(r=>r.record_key==='inventory')?.data;
       const hasSale=(at,total,name)=>m?.history?.some(h=>h.closedAt===at&&Number(h.total)===total&&h.items?.some(x=>x.name===name));
       return rows.length===14&&m?.history?.length>=446&&i?.movements?.length>=3148&&
         hasSale('2026-11-18T14:56:03.683Z',10,'Shake 500 ml • Tradicional com Açúcar Mascavo')&&
         hasSale('2026-11-18T18:18:07.132Z',6,'Água sem gás')&&
         hasSale('2026-11-19T00:38:46.344Z',10,'Cuscuz + Carne Moída')&&
         hasSale('2026-11-19T14:57:57.282Z',8,'Pastel de Carne Moída');
     };
     if(blocked&&authProfile&&globalThis.crypto?.subtle&&await exportDigest(local)===larissaCurrentDigest&&larissaCentralCurrent(server)){
       if(automatic)return;
       if(!confirm('O backup exportado foi preservado e os quatro pedidos conferidos constam no histórico central. Receber o caixa central atual, sem reenviar o backup?'))return;
       const fresh=await getRows();
       if(!larissaCentralCurrent(fresh)||await exportDigest(activeRows())!==larissaCurrentDigest)throw Error('Dados alterados durante a conferência.');
       backupRows(local,'Antes de receber caixa central; backup externo Larissa 11:33');
       cloudApplying=true;let applied=false;
       try{applied=applyRows(fresh)}finally{cloudApplying=false}
       if(!applied)throw Error('Falha ao receber a central.');
       clearBlock();pendingWrite();cloudLastError='';cloudFailures=0;refreshVisible();setSyncStatus('online','ONLINE • ATUALIZADO');dismiss();notify('Caixa central recebido. Confira os dados antes de lançar.');return;
     }
     // Fechamento confirmado: aceitar somente quando todos os demais registros
     // são idênticos ou comprovadamente preservados na central.
     const confirmedClosure=(localRows,remoteRows)=>{
       const map=new Map(remoteRows.map(r=>[r.record_key,r.data]));
       const lm=localRows.find(r=>r.record_key==='meta')?.data,rm=map.get('meta');
       if(!lm||!rm||localRows.length!==remoteRows.length)return false;
       if(!recoveredRemoteDominates('meta',lm,rm))return false;
       const added=rm.history.slice(lm.history.length);
       const used=new Set();
       return localRows.every(r=>{
         const a=r.data,b=map.get(r.record_key);
         if(!b)return false;
         if(canon(a)===canon(b))return true;
         if(r.record_key==='meta')return true;
         if(r.record_key==='inventory')return recoveredRemoteDominates('inventory',a,b);
         if(!r.record_key.startsWith('table:')||!a.items?.length||!a.orders?.length||
           b.status!=='livre'||b.items?.length||b.orders?.length||
           a.customerPayments?.length||a.customers?.length||b.customerPayments?.length||b.customers?.length)return false;
         const name='Mesa '+r.record_key.slice(6).padStart(2,'0');
         const last=Math.max(...a.orders.map(o=>Number(o.createdAt||o.id)));
         const idx=added.findIndex((h,i)=>!used.has(i)&&
           (h.name===name||h.name===name+' • Mesa / Compartilhado')&&
           Date.parse(h.closedAt)>=last&&canon(h.items)===canon(a.items)&&
           Math.abs(Number(h.total)-a.items.reduce((v,x)=>v+Number(x.qty)*Number(x.price),0))<0.001);
         if(idx<0)return false;
         used.add(idx);return true;
       });
     };
     if(blocked&&authProfile&&confirmedClosure(local,server)){
       const fresh=await getRows();
       if(canon(activeRows())!==canon(local)||!confirmedClosure(local,fresh))throw Error('Dados alterados durante a conferência.');
       backupRows(local,'Antes de receber fechamento confirmado no caixa central');
       cloudApplying=true;let applied=false;
       try{applied=applyRows(fresh)}finally{cloudApplying=false}
       if(!applied)throw Error('Falha ao receber a central.');
       clearBlock();pendingWrite();cloudLastError='';cloudFailures=0;refreshVisible();setSyncStatus('online','ONLINE • ATUALIZADO');dismiss();notify('Fechamento confirmado; caixa central atualizado.');return;
     }
     // Conciliação pontual do backup de Claudevânia exportado em 21/11 às 02:42 UTC.
     // O servidor recebeu os pedidos e movimentos; o aparelho ainda mantém o caixa antigo.
     // Somente aceitar se TODOS os eventos locais constarem integralmente na central.
     const claudiaNov21Digest='88dc12db58369cc6d551dcc23dd40499a7bed7af5e0eb0550ed59a4ee67a59dd';
     const claudiaNov21Covered=rows=>{
       const byKey=new Map(rows.map(r=>[r.record_key,r.data]));
       const lm=local.find(r=>r.record_key==='meta')?.data,rm=byKey.get('meta');
       const li=local.find(r=>r.record_key==='inventory')?.data,ri=byKey.get('inventory');
       if(rows.length!==14||!lm||!rm||!li||!ri||
          ri.movements?.length<3407||rm.history?.length<486||
          rm.internalAccounts?.withdrawals?.length<24)return false;
       const includesAll=(small,big)=>{
         if(!Array.isArray(small)||!Array.isArray(big))return false;
         const count=new Map();for(const x of big){const k=canon(x);count.set(k,(count.get(k)||0)+1)}
         for(const x of small){const k=canon(x),n=count.get(k)||0;if(!n)return false;count.set(k,n-1)}
         return true;
       };
       const matchingSales=(lm.history||[]).every(h=>(rm.history||[]).some(x=>
         x.closedAt===h.closedAt&&x.name===h.name&&Number(x.total)===Number(h.total)&&
         canon(x.items)===canon(h.items)));
       const withdrawals=includesAll(lm.internalAccounts?.withdrawals||[],rm.internalAccounts?.withdrawals||[]);
       const cashMovements=includesAll(lm.cash?.movements||[],rm.cash?.movements||[]);
       const stockMovements=includesAll(li.movements||[],ri.movements||[]);
       const tables=local.filter(r=>r.record_key.startsWith('table:')).every(r=>
         byKey.has(r.record_key)&&canon(byKey.get(r.record_key))===canon(r.data));
       const other=local.filter(r=>!r.record_key.startsWith('table:')&&
         !['meta','inventory'].includes(r.record_key)).every(r=>
         byKey.has(r.record_key)&&canon(byKey.get(r.record_key))===canon(r.data));
       return matchingSales&&withdrawals&&cashMovements&&stockMovements&&tables&&other;
     };
     if(blocked&&authProfile&&globalThis.crypto?.subtle&&
        await exportDigest(local)===claudiaNov21Digest&&claudiaNov21Covered(server)){
       const fresh=await getRows();
       if(await exportDigest(activeRows())!==claudiaNov21Digest||!claudiaNov21Covered(fresh))
         throw Error('Dados mudaram durante a conferência; nada foi aplicado.');
       backupRows(local,'Antes da conciliação auditada Claudevânia 21/11');
       cloudApplying=true;let applied=false;
       try{applied=applyRows(fresh)}finally{cloudApplying=false}
       if(!applied)throw Error('Não foi possível receber os dados da central.');
       clearBlock();pendingWrite();cloudLastError='';cloudFailures=0;
       refreshVisible();setSyncStatus('online','ONLINE • ATUALIZADO');
       dismiss();notify('Conciliação Claudevânia concluída: todos os eventos locais conferidos e central recebida.');return;
     }
     // Recuperação auditada do backup Larissa 21/11 17:28 UTC.
     // A central já recebeu os eventos. A comparação de objetos inteiros de meta
     // não é válida após conciliação administrativa e mudanças em outros aparelhos.
     // Somente recebe a central se a cópia LOCAL EXATA e todos os eventos críticos
     // estiverem preservados, inclusive em uma segunda leitura do servidor.
     const larissaNov21Digest='ae56b72e6b7b785fe0d60a32c235c14f4cac47495f99491e2a7a319fdc106fde';
     const larissaNov21Covered=rows=>{
       if(rows.length!==local.length||local.length!==14)return false;
       const map=new Map(rows.map(r=>[r.record_key,r.data]));
       const lm=local.find(r=>r.record_key==='meta')?.data,rm=map.get('meta');
       const li=local.find(r=>r.record_key==='inventory')?.data,ri=map.get('inventory');
       const lc=local.find(r=>r.record_key==='credit_accounts')?.data,rc=map.get('credit_accounts');
       if(!lm||!rm||!li||!ri||!lc||!rc)return false;
       const contains=(small,big,key)=>Array.isArray(small)&&Array.isArray(big)&&small.every(x=>
         big.some(y=>key(x)===key(y)&&canon(x)===canon(y)));
       const id=x=>String(x.id);
       const stockKey=x=>[x.at,x.key,x.type,x.qty,x.before,x.after].join('|');
       if(!(li.movements||[]).every(x=>(ri.movements||[]).some(y=>stockKey(x)===stockKey(y))))return false;
       if(!contains(lm.history||[],rm.history||[],x=>String(x.id||'')+'|'+String(x.closedAt)))return false;
       if(!contains(lm.cash?.closures||[],rm.cash?.closures||[],x=>String(x.closedAt)))return false;
       if(!contains(lm.cash?.movements||[],rm.cash?.movements||[],x=>String(x.id||x.at)))return false;
       if(!contains(lm.internalAccounts?.withdrawals||[],rm.internalAccounts?.withdrawals||[],id))return false;
       if(!contains(lm.internalAccounts?.settlements||[],rm.internalAccounts?.settlements||[],id))return false;
       if(!contains(lm.counterQueue||[],rm.counterQueue||[],id))return false;
       if(!contains(lc.receipts||[],rc.receipts||[],id))return false;
       for(const a of lc.accounts||[]){
         const b=(rc.accounts||[]).find(x=>String(x.id)===String(a.id));
         if(!b||!contains(a.charges||[],b.charges||[],id))return false;
       }
       for(const row of local){
         if(!row.record_key.startsWith('table:'))continue;
         const remote=map.get(row.record_key);
         if(!remote)return false;
         if((row.data.orders||[]).length||(row.data.items||[]).length)return false;
       }
       return true;
     };
     if(blocked&&authProfile?.perfil==='atendimento'&&globalThis.crypto?.subtle&&
        await exportDigest(local)===larissaNov21Digest&&larissaNov21Covered(server)){
       const fresh=await getRows();
       if(await exportDigest(activeRows())!==larissaNov21Digest||!larissaNov21Covered(fresh))
         throw Error('O aparelho ou o servidor mudou durante a conferência; recuperação não aplicada.');
       backupRows(local,'Larissa: antes de receber central com todos os eventos conferidos');
       cloudApplying=true;let applied=false;
       try{applied=applyRows(fresh)}finally{cloudApplying=false}
       if(!applied)throw Error('Não foi possível aplicar os dados da central.');
       clearBlock();pendingWrite();cloudLastError='';cloudFailures=0;
       refreshVisible();setSyncStatus('online','ONLINE • ATUALIZADO');
       dismiss();notify('Backup de Larissa conferido; dados centrais recebidos sem reenviar vendas.');return;
     }
     const risks=dataLossSigns(local,server);
     // Recuperação automática genérica: não depende de nomes de operadores,
     // datas, hashes de backup nem da ordem de eventos no banco.
     // Só recebe a central quando ela contém todos os lançamentos locais.
     // Recuperação do caixa de Pablo exportado em 21/11 às 18:54 UTC.
     // Compara os lançamentos efetivos, não a posição dos arrays.
     // A conferência é repetida contra uma leitura nova antes de aplicar.
     // Recuperação orientada por eventos: não depende de hash fixo nem do operador.
     const pabloMetaCovered=rows=>{
       const lm=local.find(r=>r.record_key==='meta')?.data;
       const rm=rows.find(r=>r.record_key==='meta')?.data;
       if(!lm||!rm)return false;
       const same=(a,b)=>canon(a)===canon(b);
       const subset=(a,b)=>Array.isArray(a)&&Array.isArray(b)&&a.every(x=>b.some(y=>same(x,y)));
       const normalizedSale=x=>{
         const y={...x,closedAt:x.originalClosedAt||x.closedAt};
         delete y.originalClosedAt;delete y.businessDate;delete y.shift;
         return y;
       };
       // Fechamentos antigos receberam campos auxiliares de data/turno na
       // central. Eles não são vendas novas nem justificam bloqueio.
       if(!subset((lm.history||[]).map(normalizedSale),(rm.history||[]).map(normalizedSale)))return false;
       const arrays=['cancellations','operators','transfers'];
       if(arrays.some(k=>!subset(lm[k]||[],rm[k]||[])))return false;
       if(!subset(lm.cash?.closures||[],rm.cash?.closures||[])||
          !subset(lm.cash?.movements||[],rm.cash?.movements||[])||
          !subset(lm.internalAccounts?.settlements||[],rm.internalAccounts?.settlements||[])||
          !subset(lm.internalAccounts?.withdrawals||[],rm.internalAccounts?.withdrawals||[])||
          !subset(lm.counterQueue||[],rm.counterQueue||[]))return false;
       const strip=x=>({...x,history:[],cancellations:[],operators:[],transfers:[],
         counterQueue:[],counterTicket:null,creditAccounts:null,
         cash:x.cash?{...x.cash,closures:[],movements:[]}:x.cash,
         internalAccounts:x.internalAccounts?{...x.internalAccounts,settlements:[],withdrawals:[]}:x.internalAccounts});
       if(!same(strip(lm),strip(rm)))return false;
       const lt=lm.counterTicket||{},rt=rm.counterTicket||{};
       if(lt.date!==rt.date||Number(rt.last||0)<Number(lt.last||0))return false;
       const lc=lm.creditAccounts||{},rc=rm.creditAccounts||{};
       if(!subset(lc.receipts||[],rc.receipts||[]))return false;
       for(const a of lc.accounts||[]){
         const b=(rc.accounts||[]).find(x=>x.id===a.id);
         if(!b||!same({...a,charges:[]},{...b,charges:[]})||
            !subset(a.charges||[],b.charges||[]))return false;
       }
       return true;
     };
     if(blocked&&pabloMetaCovered(server)&&!risks.length&&
        local.every(r=>r.record_key==='meta'||by.get(r.record_key)&&
          (canon(r.data)===canon(by.get(r.record_key).data)||
           (r.record_key==='inventory'&&recoveredRemoteDominates('inventory',r.data,by.get(r.record_key).data))||
           (r.record_key.startsWith('table:')&&r.data.status==='livre'&&
            by.get(r.record_key).data.status==='livre'&&!(r.data.orders||[]).length&&
            !(by.get(r.record_key).data.orders||[]).length)))){
       const before=canon(activeRows());
       const fresh=await getRows();
       if(canon(activeRows())!==before||!pabloMetaCovered(fresh)||
          dataLossSigns(local,fresh).length)throw Error('Nova alteração detectada; recuperação não aplicada.');
       backupRows(local,'Pablo 21/11: caixa conferido antes da atualização');
       cloudApplying=true;let applied=false;
       try{applied=applyRows(fresh)}finally{cloudApplying=false}
       if(!applied)throw Error('Não foi possível aplicar a central.');
       clearBlock();pendingWrite();cloudLastError='';cloudFailures=0;
       refreshVisible();setSyncStatus('online','ONLINE • ATUALIZADO');
       dismiss();notify('Caixa e balcão conferidos e sincronizados sem descartar vendas.');return;
     }
     const allEventsPreserved=()=>{
       if(risks.length||local.length!==server.length)return false;
       const eq=(a,b)=>canon(a)===canon(b);
       const subset=(small,big,key)=>Array.isArray(small)&&Array.isArray(big)&&
         small.every(x=>big.some(y=>key(x)===key(y)&&eq(x,y)));
       const eventId=x=>String(x.id||'')+'|'+String(x.originalClosedAt||x.closedAt||x.at||'');
       for(const row of local){
         const remote=by.get(row.record_key)?.data,v=row.data;
         if(!remote)return false;
         if(eq(v,remote))continue;
         if(row.record_key.startsWith('table:')){
           // Não troca mesas ativas; somente mesas comprovadamente vazias.
           if(v.status!=='livre'||remote.status!=='livre'||
             (v.items||[]).length||(remote.items||[]).length||
             (v.orders||[]).length||(remote.orders||[]).length||
             (v.customers||[]).length||(remote.customers||[]).length||
             (v.customerPayments||[]).length||(remote.customerPayments||[]).length)return false;
           continue;
         }
         if(row.record_key==='counter'){
           if((v.items||[]).length||(v.orders||[]).length||
             (remote.items||[]).length||(remote.orders||[]).length)return false;
           continue;
         }
         if(row.record_key==='inventory'){
           const mk=x=>[x.at,x.key,x.type,x.qty,x.before,x.after].join('|');
           if(!subset(v.movements||[],remote.movements||[],mk))return false;
           const l=v.items||{},b=remote.items||{};
           const added=(remote.movements||[]).filter(x=>!(v.movements||[]).some(y=>mk(x)===mk(y)));
           for(const [k,item] of Object.entries(l)){
             if(!b[k]||!eq({...item,qty:0},{...b[k],qty:0}))return false;
             const delta=added.filter(x=>x.key===k).reduce((n,x)=>n+Number(x.qty||0),0);
             if(Math.abs(Number(item.qty)+delta-Number(b[k].qty))>.00001)return false;
           }
           if(Object.keys(b).some(k=>!l[k]&&(Number(b[k].qty)!==0||added.some(x=>x.key===k))))return false;
           if(!eq({...v,items:{},movements:[]},{...remote,items:{},movements:[]}))return false;
           continue;
         }
         if(row.record_key==='credit_accounts'){
           if(!subset(v.receipts||[],remote.receipts||[],x=>String(x.id)))return false;
           for(const a of v.accounts||[]){
             const b=(remote.accounts||[]).find(x=>String(x.id)===String(a.id));
             if(!b||!eq({...a,charges:[]},{...b,charges:[]})||
               !subset(a.charges||[],b.charges||[],x=>String(x.id)))return false;
           }
           if(!eq({...v,accounts:[],receipts:[]},{...remote,accounts:[],receipts:[]}))return false;
           continue;
         }
         if(row.record_key==='meta'){
           if(!subset(v.history||[],remote.history||[],eventId)||
             !subset(v.cancellations||[],remote.cancellations||[],eventId)||
             !subset(v.cash?.closures||[],remote.cash?.closures||[],x=>String(x.closedAt))||
             !subset(v.cash?.movements||[],remote.cash?.movements||[],eventId)||
             !subset(v.internalAccounts?.withdrawals||[],remote.internalAccounts?.withdrawals||[],eventId)||
             !subset(v.internalAccounts?.settlements||[],remote.internalAccounts?.settlements||[],eventId))return false;
           // Pedido aberto só pode desaparecer após venda, crédito ou cancelamento.
           for(const q of v.counterQueue||[]){
             const b=(remote.counterQueue||[]).find(x=>String(x.id)===String(q.id));
             if(b){if(!eq(q,b))return false;continue}
             const sold=(remote.history||[]).some(h=>String(h.orderId)===String(q.id));
             const credited=(by.get('credit_accounts')?.data?.accounts||[]).some(a=>
               (a.charges||[]).some(c=>String(c.orderId)===String(q.id)));
             const cancelled=(remote.cancellations||[]).some(c=>String(c.orderId)===String(q.id));
             if(!sold&&!credited&&!cancelled)return false;
           }
           // O espelho legado de crédito não deve bloquear a centralização.
           const strip=x=>({...x,history:[],cancellations:[],counterQueue:[],
             counterTicket:null,revenue:0,creditAccounts:null,
             internalAccounts:x.internalAccounts?{...x.internalAccounts,withdrawals:[],settlements:[]}:x.internalAccounts,
             cash:x.cash?{...x.cash,closures:[],movements:[]}:x.cash});
           if(!eq(strip(v),strip(remote)))return false;
           const lTicket=v.counterTicket||{},rTicket=remote.counterTicket||{};
           if(lTicket.date===rTicket.date&&Number(rTicket.last||0)<Number(lTicket.last||0))return false;
           continue;
         }
         return false;
       }
       return true;
     };
     if(blocked&&allEventsPreserved()){
       const fingerprint=canon(activeRows());
       const fresh=await getRows();
       const previous=server;
       if(canon(fresh)!==canon(previous)||canon(activeRows())!==fingerprint)
         throw Error('Os dados mudaram durante a recuperação; nova conferência necessária.');
       backupRows(local,'Antes da reconciliação automática sem perda de eventos');
       cloudApplying=true;let applied=false;
       try{applied=applyRows(fresh)}finally{cloudApplying=false}
       if(!applied)throw Error('A atualização local não foi confirmada.');
       clearBlock();pendingWrite();cloudLastError='';cloudFailures=0;
       refreshVisible();setSyncStatus('online','ONLINE • ATUALIZADO');
       dismiss();notify('Eventos locais preservados; central recebida sem reenviar ou duplicar vendas.');
       return;
     }
     // Em conflitos surgidos durante esta sessão, a versão-base conhecida
     // permite unir inclusões independentes em vez de exigir exportação manual.
     const pending=changedNow();
     const mergeable=pending.length>0&&pending.every(row=>{
       const remote=by.get(row.record_key),known=cloudSnapshot[row.record_key];
       if(!remote)return !known;
       if(canon(remote.data)===canon(row.data))return true;
       if(known&&canon(remote.data)===canon(JSON.parse(known)))return true;
       return !!(known&&mergeRecord(row.record_key,JSON.parse(known),row.data,remote.data));
     });
     if(mergeable){
       backupRows(local,'Antes de conciliar lançamentos entre aparelhos');
       clearBlock();
       try{
         await safeWriteRows(pending);
         if(blocked)throw Error('A conciliação não pôde ser confirmada.');
         dismiss();notify('Lançamentos independentes conciliados e gravados com segurança.');
         return;
       }catch(e){
         if(!blocked){cloudLastError=String(e.message||e);pendingWrite();setSyncStatus('offline','PENDENTE — NOVA TENTATIVA AUTOMÁTICA');}
         return notify('A conciliação não foi concluída. Seus dados continuam preservados.');
       }
     }
     // O banco pode conter exatamente os eventos recuperados de um backup.
     // Neste caso o telefone deve RECEBER, jamais reenviar, a versão completa.
     const recoveryDominated=local.every(r=>{
       const remote=by.get(r.record_key)?.data;
       if(!remote)return false;
       return canon(remote)===canon(r.data)||
         (['meta','inventory'].includes(r.record_key)&&recoveredRemoteDominates(r.record_key,r.data,remote))||
         (r.record_key==='meta'&&remoteDominatesMeta(r.data,remote))||
         (r.record_key.startsWith('table:')&&
           (r.data.items||[]).length===0&&(r.data.orders||[]).length===0&&
           r.data.status==='livre'&&
           (r.data.customers||[]).length===0&&(remote.customers||[]).length===0&&
           (r.data.customerPayments||[]).length===0&&(remote.customerPayments||[]).length===0);
     });
     if(recoveryDominated&&!risks.length){
       backupRows(local,'Antes de receber recuperação administrativa confirmada');
       const before=canon(activeRows());
       const fresh=await getRows();
       if(canon(activeRows())!==before)throw Error('Novo lançamento durante a verificação; não atualizar.');
       const freshMap=new Map(fresh.map(r=>[r.record_key,r]));
       if(!local.every(r=>{
         const remote=freshMap.get(r.record_key)?.data;
         return remote&&(canon(remote)===canon(r.data)||
           (['meta','inventory'].includes(r.record_key)&&recoveredRemoteDominates(r.record_key,r.data,remote))||
           (r.record_key==='meta'&&remoteDominatesMeta(r.data,remote))||
           (r.record_key.startsWith('table:')&&
             (r.data.items||[]).length===0&&(r.data.orders||[]).length===0&&
           r.data.status==='livre'&&
             (r.data.customers||[]).length===0&&(remote.customers||[]).length===0&&
             (r.data.customerPayments||[]).length===0&&(remote.customerPayments||[]).length===0));
       }))throw Error('Servidor mudou durante a conferência; reavaliar.');
       cloudApplying=true;
       let applied=false;
       try{applied=applyRows(fresh)}finally{cloudApplying=false}
       if(!applied)throw Error('Não foi possível aplicar a versão completa.');
       clearBlock();pendingWrite();cloudLastError='';cloudFailures=0;
       refreshVisible();setSyncStatus('online','ONLINE • ATUALIZADO');
       dismiss();notify('Dados recuperados confirmados no banco e recebidos neste aparelho. Nenhum lançamento foi reenviado.');
       return;
     }
     // Quando o banco já recebeu o pedido recuperado, o meta local antigo
     // pode diferir em fila, numeração e espelho de contas a prazo.
     // Aceitar apenas se cada evento local também existir no servidor.
     const onlyRemoteAdditions=local.every(r=>{
       const remote=by.get(r.record_key)?.data;
       if(!remote)return false;
       return canon(remote)===canon(r.data)||
         (r.record_key==='meta'&&remoteDominatesMeta(r.data,remote))||
         (['meta','inventory'].includes(r.record_key)&&recoveredRemoteDominates(r.record_key,r.data,remote))||
         // Mesas vazias equivalentes: diferenças de campos opcionais legados
         // não representam vendas ou comandas perdidas.
         (r.record_key.startsWith('table:')&&
           (r.data.items||[]).length===0&&(r.data.orders||[]).length===0&&
           r.data.status==='livre'&&
           (r.data.customers||[]).length===0&&(remote.customers||[]).length===0&&
           (r.data.customerPayments||[]).length===0&&(remote.customerPayments||[]).length===0);
     });
     if(onlyRemoteAdditions&&!risks.length){
       backupRows(local,'Antes de receber eventos adicionais do banco');
       cloudApplying=true;
       let applied=false;
       try{applied=applyRows(server)}finally{cloudApplying=false}
       if(!applied)throw Error('A atualização local não foi confirmada.');
       clearBlock();pendingWrite();cloudLastError='';cloudFailures=0;
       refreshVisible();setSyncStatus('online','ONLINE • ATUALIZADO');
       dismiss();notify('Sincronização recuperada: os lançamentos do banco foram incorporados sem descartar os do aparelho.');
       return;
     }
     // Aceitar apenas a fila remota estritamente mais completa, sem alterar outros dados.
     const remoteMeta=by.get('meta')?.data,localMeta=local.find(r=>r.record_key==='meta')?.data;
     const queueOnlySuperset=!!remoteMeta&&!!localMeta&&
       canon({...remoteMeta,counterQueue:[]})===canon({...localMeta,counterQueue:[]})&&
       (remoteMeta.counterQueue||[]).length>(localMeta.counterQueue||[]).length&&
       (localMeta.counterQueue||[]).every(q=>(remoteMeta.counterQueue||[]).some(s=>String(s.id)===String(q.id)&&canon(s)===canon(q)))&&
       local.every(r=>r.record_key==='meta'||(by.has(r.record_key)&&canon(by.get(r.record_key).data)===canon(r.data)));
     if(queueOnlySuperset&&!risks.length){
       backupRows(local,'Antes de unificar fila de balcão com o servidor');
       cloudApplying=true;
       let applied=false;
       try{applied=applyRows(server)}finally{cloudApplying=false}
       if(!applied)throw Error('A aplicação da conciliação não foi confirmada.');
       clearBlock();pendingWrite();cloudLastError='';cloudFailures=0;
       refreshVisible();setSyncStatus('online','ONLINE • ATUALIZADO');
       dismiss();notify('Conciliação concluída: fila de balcão completa e dados preservados.');
       return;
     }
     const divergent=[];
     for(const row of changedNow()){
       const remote=by.get(row.record_key);
       const known=cloudSnapshot[row.record_key];
       if(remote&&canon(remote.data)===canon(row.data)){
         cloudSnapshot[row.record_key]=JSON.stringify(row.data);
       }else if(remote&&known&&canon(remote.data)===canon(JSON.parse(known))){
         // Modificação local pode ser reenviada sem risco de substituir o outro aparelho.
       }else if(!remote&&!known){
         // Registro novo ausente no banco: tentar inserção com chave única.
       }else divergent.push(labelKey(row.record_key));
     }
     if(risks.length||divergent.length){
       alertSync('Ainda existem diferenças entre a versão local e o banco. Nenhum lançamento será descartado.',
         [...new Set([...risks,...divergent])].join('; '));
       return notify('Persistem diferenças. Registros: '+[...new Set([...risks,...divergent])].join('; ').slice(0,900)+'\n\nNenhum dado foi descartado. Não force a sincronização.');
     }
     clearBlock();pendingWrite();
     cloudLastError='';cloudFailures=0;
     if(isDirty()){
       scheduleCloudSave();setSyncStatus('offline','REENVIANDO ALTERAÇÕES SEGURAS…');
     }else setSyncStatus('online','ONLINE • SALVO');
     dismiss();notify('A verificação não encontrou conflito pendente nos registros alterados. A sincronização segura foi retomada.');
   }catch(e){
     alertSync('Não foi possível reavaliar a sincronização. Os dados locais permanecem preservados.',String(e.message||e));
     notify('A verificação falhou. Confira sua conexão e não apague as cópias locais.');
   }
 };
 
 window.openSafeSyncPanelV68=function(){
   const backups=backupList();
   const content='<h2>🛡️ Segurança das Comandas</h2>'+
     '<div class="panel"><b>'+esc(blocked?'⚠️ SINCRONIZAÇÃO INTERROMPIDA':'✅ Proteção contra sobrescrita ativa')+'</b>'+
     '<div class="muted">'+esc(blocked?.message||'As alterações são comparadas com a versão do servidor antes de salvar.')+'</div>'+
     (blocked?.details?'<div class="muted">Registros afetados: '+esc(blocked.details)+'</div>':'')+
     (blocked&&canExportCurrent()?'<button class="btn primary" onclick="retrySafeSyncV68()">🔄 REAVALIAR E RETOMAR COM SEGURANÇA</button>':'')+'</div>'+
     '<div class="panel"><b>Arquivos de segurança deste aparelho</b><div class="muted">As cópias ficam armazenadas apenas neste aparelho. Faça uma exportação antes de limpar o navegador ou reinstalar o aplicativo.</div>'+
     (canExportCurrent()?'<button class="btn primary" onclick="exportCurrentComandasV68()">📥 EXPORTAR ESTADO ATUAL (JSON)</button>':'')+
     (canExport()?'<button class="btn" onclick="exportComandasBackupsV68()">📥 EXPORTAR CÓPIAS DE SEGURANÇA</button>':'<div class="muted">Cópias históricas completas: somente administrador ou gerente.</div>')+'</div>'+
     backups.slice(0,20).map(e=>'<div class="cart-row"><span><b>'+esc(labelKey(e.key))+'</b><div class="muted">'+new Date(e.at).toLocaleString('pt-BR')+' • '+esc(e.why||'')+'</div></span><b>'+Math.round(e.size/1024)+' KB</b></div>').join('')+
     (blocked?'<p class="muted">Não force a sincronização nem limpe os dados. Mantenha os aparelhos abertos e confira as comandas antes de retomar.</p>':'')+
     '<button class="btn" onclick="closeModal()">FECHAR</button>';
   const el=document.getElementById('modalContent');if(!el)return;
   el.innerHTML=content;document.getElementById('modal').classList.remove('hide');
 };
 function downloadJSON(name,value){
   const file=new Blob([JSON.stringify(value,null,2)],{type:'application/json'});
   const url=URL.createObjectURL(file);
   const a=document.createElement('a');
   a.href=url;a.download=name;a.style.display='none';document.body.appendChild(a);a.click();a.remove();
   setTimeout(()=>URL.revokeObjectURL(url),1500);
 }
 window.exportCurrentComandasV68=function(){
   if(!canExportCurrent())return alert('Exportação permitida à gerência ou ao atendimento durante conflito.');
   if(!canExport()&&!confirm('Este arquivo contém dados da empresa e de clientes. Envie exclusivamente ao responsável autorizado pela recuperação. Continuar?'))return;
   backupRows(activeRows(),'Exportação manual');
   downloadJSON('algaroba-comandas-atual-'+new Date().toISOString().slice(0,10)+'.json',
     {version:VERSION,exportedAt:new Date().toISOString(),records:activeRows(),conflict:blocked});
 };
 window.exportComandasBackupsV68=function(){
   if(!canExport())return alert('Apenas Administrador ou Gerente pode exportar registros de clientes.');
   downloadJSON('algaroba-backups-'+new Date().toISOString().slice(0,10)+'.json',
     {version:VERSION,exportedAt:new Date().toISOString(),backups:backupList()});
 };

 window.safeStorageReloadV68=function(raw){
   try{
     if(!raw||reading||writing||blocked||isDirty()||pendingRead())return false;
     const candidate=JSON.parse(raw);
     if(!candidate||!Array.isArray(candidate.tables))return false;
     const incoming=stateRecords(candidate);
     const risks=dataLossSigns(activeRows(),incoming);
     if(risks.length){
       alertSync('Outra aba tentou substituir comandas por uma cópia local sem alguns lançamentos. A troca foi bloqueada.',risks.join('; '));
       return false;
     }
     return true;
   }catch(e){
     console.warn('Bloqueada atualização local inválida:',e);
     return false;
   }
 };

 const priorTables=renderTables;
 renderTables=function(){
   priorTables();
   const tableArea=document.getElementById('tables');
   if(!tableArea)return;
   const button=document.createElement('div');
   button.className='table full sync-safe-tile';
   button.innerHTML='<h3>🛡️ Segurança / Recuperação</h3>'+
     '<div class="muted">'+(blocked?'⚠️ Verificar divergência entre aparelhos':'Ver backups locais e exportar comandas')+'</div>';
   button.addEventListener('click',window.openSafeSyncPanelV68);
   tableArea.appendChild(button);
 };
 const priorCash=renderCash;
 renderCash=function(){
   priorCash();
   const status=document.getElementById('cashStatus');
   if(!status)return;
   const box=document.createElement('div');box.className='panel sync-safe-cash';
   box.innerHTML='<b>🛡️ Proteção de sincronização '+VERSION+'</b><div class="muted">'+
     esc(blocked?.message||'Gravação com comparação de versão; cópias locais disponíveis.')+
     '</div><button class="btn" onclick="openSafeSyncPanelV68()">VER SEGURANÇA / CÓPIAS</button>';
   status.appendChild(box);
 };
 const oldCloudError=showCloudError;
 showCloudError=function(){
   if(blocked)return window.openSafeSyncPanelV68();
   return oldCloudError();
 };
 let automaticBusy=false;
 async function automaticRecovery(){
   if(automaticBusy||reading||writing||!authProfile||!navigator.onLine||userIsEditing())return;
   automaticBusy=true;
   try{
     if(!cloudReady){await initCloud();return}
     if(blocked){
       if(isDirty()){pendingWrite();await pushChangedRecords()}
       else await window.retrySafeSyncV68(true);
       return;
     }
     if(isDirty()){pendingWrite();scheduleCloudSave()}else{await pullRecords(false)}
   }catch(e){console.warn('Nova tentativa automática:',e)}finally{automaticBusy=false}
 }
 window.algarobaSyncHealth=()=>({blocked:!!blocked,pending:!!pendingRead()||isDirty(),cloudReady:!!cloudReady,reading:!!reading,writing:!!writing,error:String(blocked?.message||cloudLastError||'').slice(0,240)});
 setInterval(automaticRecovery,15000);
 window.addEventListener('online',automaticRecovery);
 started=true;
 // Carrega a autenticação somente DEPOIS de instalar todas as proteções.
 // Evita uma primeira leitura antiga do servidor sobrescrever os dados locais.
 renderTables();
 initAuth();
})();
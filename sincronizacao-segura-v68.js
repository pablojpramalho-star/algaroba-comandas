(function installSafeSyncV68(){
 const PENDING='algarobaSyncPendingV68';
 const BACKUPS='algarobaComandasBackupsV68';
 const VERSION='2.9.7.68';
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
   return stateRecords(state).filter(r=>cloudSnapshot[r.record_key]!==JSON.stringify(r.data));
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
     }
     if(x.record_key==='meta'){
       const localHistory=x.data.history||[],remoteHistory=y.data.history||[];
       const saleKey=s=>String(s.id||'')+'|'+String(s.closedAt||'')+'|'+String(s.name||'')+'|'+Number(s.total||0);
       const activeSales=new Set(remoteHistory.map(saleKey));
       const disappeared=localHistory.slice(-80).filter(s=>!activeSales.has(saleKey(s)));
       if(disappeared.length)reasons.push(disappeared.length+' venda(s) do histórico local não constam na atualização');
       const closures=new Set((y.data.cash?.closures||[]).map(c=>c.closedAt));
       const missingClosures=(x.data.cash?.closures||[]).slice(-20).filter(c=>!closures.has(c.closedAt));
       if(missingClosures.length)reasons.push(missingClosures.length+' fechamento(s) de caixa não constam no servidor');
       const latestQ=x.data.counterQueue||[],remoteQ=new Set((y.data.counterQueue||[]).map(q=>String(q.id)));
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
 async function getRows(){
   const rows=await rawRequest('algaroba_records?select=record_key,data,updated_at',{method:'GET'});
   if(!Array.isArray(rows))throw Error('Servidor não retornou lista válida de registros.');
   return rows;
 }
 async function safeWriteRows(requestRows){
   const requested=(Array.isArray(requestRows)?requestRows:[requestRows]).filter(x=>x?.record_key);
   if(!requested.length)return null;
   writing=true;
   try{
     // Consulta o servidor ANTES de gravar. O campo updated_at funciona
     // como token de versão para o PATCH condicional atômico do PostgREST.
     const current=await getRows();
     const by=new Map(current.map(r=>[r.record_key,r]));
     for(const originalRow of requested){
       const key=originalRow.record_key;
       // Se um novo pedido chegou enquanto a gravação esperava,
       // a carga usada será o estado mais recente deste aparelho.
       const local=latestRow(key);
       const data=local?.data||originalRow.data;
       const remote=by.get(key),known=cloudSnapshot[key];
       if(remote&&canon(remote.data)===canon(data)){
         cloudSnapshot[key]=JSON.stringify(data);continue;
       }
       if(remote&&(!known||canon(remote.data)!==canon(JSON.parse(known)))){
         alertSync('Outro aparelho alterou '+labelKey(key)+' antes da gravação. Nenhuma comanda será substituída.',key);
         throw Error('Conflito de sincronização em '+labelKey(key)+': atualização concorrente não sobrescrita.');
       }
       let saved;
       if(!remote){
         saved=await rawRequest('algaroba_records?on_conflict=record_key&select=record_key,updated_at',{
           method:'POST',prefer:'resolution=ignore-duplicates,return=representation',
           body:JSON.stringify([{record_key:key,data,updated_at:new Date().toISOString()}])
         });
       }else{
         const timestamp=remote.updated_at;
         const versionFilter=timestamp==null?'is.null':'eq.'+encodeURIComponent(timestamp);
         const url='algaroba_records?record_key=eq.'+encodeURIComponent(key)+
           '&updated_at='+versionFilter+'&select=record_key,updated_at';
         saved=await rawRequest(url,{
           method:'PATCH',prefer:'return=representation',
           body:JSON.stringify({data,updated_at:new Date().toISOString()})
         });
       }
       if(!Array.isArray(saved)||saved.length!==1){
         alertSync('Houve atualização simultânea de '+labelKey(key)+'. A operação foi preservada neste aparelho para conferência.',key);
         throw Error('Conflito: o servidor não confirmou a gravação exclusiva de '+labelKey(key));
       }
       cloudSnapshot[key]=JSON.stringify(data);
     }
     clearBlock();
     cloudFailures=0;cloudLastError='';
     pendingWrite();
     if(isDirty())scheduleCloudSave();
     setSyncStatus('online','ONLINE • SALVO');
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
   if(!cloudReady||blocked||writing||reading)return;
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
     if(!blocked)alertSync('Falha ao salvar. Os dados permanecem no aparelho. Toque no status para conferir.',String(e.message||e));
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
     if(!cloudReady||userIsEditing()||Date.now()<cloudPausePullUntil||isDirty()||pendingRead())return false;
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
 const originalInit=initCloud;
 initCloud=async function(){
   // A rotina antiga inicia o polling; a leitura protegida é chamada por
   // referência, inclusive no tablet que antes não conferia mudanças locais.
   await originalInit();
   if(blocked)setSyncStatus('error','⚠️ CONFLITO — CONFERIR');
   else if(cloudReady&&isDirty())scheduleCloudSave();
 };
 function backupList(){
   try{const list=JSON.parse(localStorage.getItem(BACKUPS)||'[]');return Array.isArray(list)?list:[]}catch(e){return []}
 }
 window.openSafeSyncPanelV68=function(){
   const backups=backupList();
   const content='<h2>🛡️ Segurança das Comandas</h2>'+
     '<div class="panel"><b>'+esc(blocked?'⚠️ SINCRONIZAÇÃO INTERROMPIDA':'✅ Proteção contra sobrescrita ativa')+'</b>'+
     '<div class="muted">'+esc(blocked?.message||'As alterações são comparadas com a versão do servidor antes de salvar.')+'</div>'+
     (blocked?.details?'<div class="muted">Registros afetados: '+esc(blocked.details)+'</div>':'')+'</div>'+
     '<div class="panel"><b>Arquivos de segurança deste aparelho</b><div class="muted">As cópias ficam armazenadas apenas neste aparelho. Faça uma exportação antes de limpar o navegador ou reinstalar o aplicativo.</div>'+
     '<button class="btn primary" onclick="exportCurrentComandasV68()">📥 EXPORTAR ESTADO ATUAL (JSON)</button>'+
     '<button class="btn" onclick="exportComandasBackupsV68()">📥 EXPORTAR CÓPIAS DE SEGURANÇA</button></div>'+
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
   backupRows(activeRows(),'Exportação manual');
   downloadJSON('algaroba-comandas-atual-'+new Date().toISOString().slice(0,10)+'.json',
     {version:VERSION,exportedAt:new Date().toISOString(),records:activeRows(),conflict:blocked});
 };
 window.exportComandasBackupsV68=function(){
   downloadJSON('algaroba-backups-'+new Date().toISOString().slice(0,10)+'.json',
     {version:VERSION,exportedAt:new Date().toISOString(),backups:backupList()});
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
 started=true;
})();
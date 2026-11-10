(function installClientAccountsV67(){
 const ZONE="America/Fortaleza",financialMethods=['Dinheiro','Pix','Débito','Crédito'];
 let selectedAccountId=null,pendingTicket=null,paying=false;
 const amount=v=>Number(v||0),money=v=>brl(amount(v));
 const id=prefix=>prefix+'-'+Date.now().toString(36)+'-'+Math.floor(Math.random()*1e9).toString(36);
 function safeDate(iso){
   const d=new Date(iso||Date.now());
   return Number.isFinite(d.getTime())?new Intl.DateTimeFormat("pt-BR",{timeZone:ZONE,day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).format(d):'—';
 }
 function dateParts(iso){
   const d=new Date(iso||Date.now());
   if(!Number.isFinite(d.getTime()))return {day:'',title:'—'};
   const p={};
   for(const x of new Intl.DateTimeFormat("en-GB",{timeZone:ZONE,year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(d)){
     if(x.type!=='literal')p[x.type]=x.value;
   }
   return {day:p.year+'-'+p.month+'-'+p.day,title:p.day+'/'+p.month+'/'+p.year};
 }
 function data(){
   if(!state.creditAccounts||!Array.isArray(state.creditAccounts.accounts)||!Array.isArray(state.creditAccounts.receipts)){
     state.creditAccounts={accounts:[],receipts:[]};
   }
   return state.creditAccounts;
 }
 function accountById(accountId){return data().accounts.find(a=>a.id===accountId)}
 function balance(a){return Math.max(0,Math.round((chargesTotal(a)-paidTotal(a))*100)/100)}
 function chargesTotal(a){return (a?.charges||[]).filter(x=>!x.voided).reduce((v,x)=>v+amount(x.total),0)}
 function receiptsOf(a){return data().receipts.filter(r=>r.accountId===a.id&&!r.voided)}
 function paidTotal(a){return receiptsOf(a).reduce((v,r)=>v+amount(r.value),0)}
 function pendingAccounts(){return data().accounts.filter(a=>balance(a)>.009)}
 function canAccess(){return !authProfile||canView('mesas')||canView('caixa')}
 function canCharge(){return !authProfile||canView('mesas')}
 function canCollect(){return !!state.cash?.open && (!authProfile||canView('caixa'))}
 function escapeId(x){return encodeURIComponent(String(x||''))}
 function decodeId(x){try{return decodeURIComponent(x)}catch(e){return String(x||'')}}
 function markDirty(){
   cloudPausePullUntil=Date.now()+7000;
   save();
 }
 function accountLineItems(charges,payments){
   const events=[];
   for(const q of charges)events.push({day:dateParts(q.at),at:q.at,type:'charge',record:q});
   for(const p of payments)events.push({day:dateParts(p.at),at:p.at,type:'receipt',record:p});
   events.sort((a,b)=>new Date(a.at)-new Date(b.at));
   const groups=new Map();
   for(const ev of events){
     const key=ev.day.day;
     if(!groups.has(key))groups.set(key,{label:ev.day.title,items:[],charges:0,received:0});
     const group=groups.get(key);group.items.push(ev);
     if(ev.type==='charge'&&!ev.record.voided)group.charges+=amount(ev.record.total);
     if(ev.type==='receipt'&&!ev.record.voided)group.received+=amount(ev.record.value);
   }
   return [...groups.values()].map(g=>
     '<div class="panel credit-day"><h3>📅 '+esc(g.label)+'</h3>'+
     g.items.map(({type,record:r,at})=>{
       if(type==='receipt')return '<div class="cart-row"><span><b>✅ Pagamento recebido • '+esc(r.method)+'</b><small class="muted">'+safeDate(at)+' • '+esc(r.operator||'-')+'</small></span><b>− '+money(r.value)+'</b></div>';
       const q=r,detail=(q.items||[]).map(p=>
         '<div class="cart-row credit-product"><span>'+Number(p.qty||1)+'× '+esc(p.name||'Produto')+
         '</span><span>'+money(Number(p.qty||1)*Number(p.price||0))+'</span></div>').join('');
       return '<div class="credit-entry"><div class="cart-row"><span><b>🧾 Consumo '+(q.ticket?'#'+esc(q.ticket):'')+'</b><small class="muted">'+
         safeDate(q.at)+' • '+esc(q.operator||'-')+
         (q.voided?' • CANCELADO: '+esc(q.voidReason||''):'')+'</small></span><b>'+money(q.total)+'</b></div>'+detail+'</div>';
     }).join('')+
     '<div class="cart-row credit-day-total"><span><b>Consumos: '+money(g.charges)+'</b></span><b>Recebido: '+money(g.received)+'</b></div></div>'
   ).join('')||'<div class="panel muted">Nenhum consumo ou pagamento registrado neste período.</div>';
 }
 function statement(a,start=null,end=null){
   const charges=(a.charges||[]).filter(x=>!start||dateParts(x.at).day>=start).filter(x=>!end||dateParts(x.at).day<=end);
   const payments=receiptsOf(a).filter(x=>!start||dateParts(x.at).day>=start).filter(x=>!end||dateParts(x.at).day<=end);
   return '<div class="panel credit-summary"><h2>👤 '+esc(a.name)+'</h2>'+
    (a.phone?'<div class="muted">Contato: '+esc(a.phone)+'</div>':'')+
    '<div class="muted">Conta criada em '+safeDate(a.createdAt)+'</div>'+
    '<div class="grid"><div><small>Consumos acumulados</small><b>'+money(chargesTotal(a))+'</b></div>'+
    '<div><small>Pagamentos recebidos</small><b>'+money(paidTotal(a))+'</b></div>'+
    '<div><small>Saldo pendente</small><b>'+money(balance(a))+'</b></div>'+
    '<div><small>Situação</small><b>'+(balance(a)>.009?'EM ABERTO':'QUITADA')+'</b></div></div></div>'+
    '<h3>Extrato detalhado por dia</h3>'+accountLineItems(charges,payments)+
    '<div class="panel credit-total"><div class="cart-row"><span>Saldo atual a pagar</span><b>'+money(balance(a))+'</b></div></div>'+
    '<p class="muted">Documento de conferência do cliente. Não substitui nota fiscal. Consumos entram no extrato na hora do pedido; recebimentos entram no caixa somente quando pagos.</p>';
 }
 function showAccounts(){
   if(!canAccess())return alert('Seu perfil não permite consultar contas de clientes.');
   let accounts=data().accounts.slice().sort((a,b)=>(balance(b)>0)-(balance(a)>0)||a.name.localeCompare(b.name,'pt-BR'));
   document.getElementById('modalContent').innerHTML='<h2>👥 Contas de Clientes — Balcão</h2>'+
     '<p class="muted">A conta continua disponível mesmo após o fechamento do dia. Selecione um cliente para lançar novos produtos, conferir os consumos ou receber pagamentos.</p>'+
     '<div class="panel"><label>Novo cliente</label><input id="creditClientNameV67" maxlength="100" placeholder="Digite o nome do cliente">'+
     '<label>Telefone / referência (opcional)</label><input id="creditClientPhoneV67" maxlength="70" placeholder="Telefone ou identificação">'+
     '<button class="btn primary" style="width:100%;margin-top:10px" onclick="createCreditAccountV67()" '+(!canCharge()?'disabled':'')+'>+ CADASTRAR CLIENTE</button></div>'+
     '<label>Buscar cliente já cadastrado</label><input id="creditClientSearchV67" placeholder="🔎 Nome ou telefone..." oninput="filterCreditAccountsV67()">'+
     '<div id="creditClientCardsV67">'+accounts.map(a=>
       '<div class="panel credit-person-card" data-credit-search="'+esc((a.name+' '+(a.phone||'')).toLowerCase())+'">'+
       '<div class="cart-row"><span><b>'+esc(a.name)+'</b><small class="muted">'+(a.phone?esc(a.phone):'Conta de cliente')+'</small></span>'+
       '<b>'+money(balance(a))+'</b></div>'+
       '<div class="credit-actions"><button class="btn primary" onclick="launchCreditOrderV67(\''+escapeId(a.id)+'\')" '+(!canCharge()?'disabled':'')+'>+ LANÇAR PEDIDO</button>'+
       '<button class="btn" onclick="openCreditAccountV67(\''+escapeId(a.id)+'\')">🧾 VER EXTRATO</button></div></div>'
     ).join('')+'</div>'+
     '<div class="sheet-actions"><button class="btn" onclick="closeModal()">FECHAR</button></div>';
   document.getElementById('modal').classList.remove('hide');
 }
 window.openCreditAccountsV67=showAccounts;
 window.filterCreditAccountsV67=function(){
   const txt=(document.getElementById('creditClientSearchV67')?.value||'').toLocaleLowerCase('pt-BR');
   document.querySelectorAll('#creditClientCardsV67 .credit-person-card').forEach(el=>{
     el.style.display=el.getAttribute('data-credit-search')?.includes(txt)?'':'none';
   });
 };
 window.createCreditAccountV67=function(){
   if(!canCharge())return alert('Seu perfil não permite cadastrar clientes.');
   const name=(document.getElementById('creditClientNameV67')?.value||'').trim().replace(/\s+/g,' '),
         phone=(document.getElementById('creditClientPhoneV67')?.value||'').trim();
   if(name.length<2)return alert('Informe o nome do cliente.');
   const found=data().accounts.find(a=>a.name.toLocaleLowerCase('pt-BR')===name.toLocaleLowerCase('pt-BR'));
   if(found)return alert('Cliente já cadastrado: '+found.name+'. Use a busca para selecionar a conta existente.');
   const a={id:id('cliente'),name,phone,createdAt:new Date().toISOString(),createdBy:state.activeOperator,charges:[]};
   data().accounts.push(a);markDirty();
   showAccount(a.id);
 };
 function showAccount(value){
   const a=accountById(decodeId(value));
   if(!a)return alert('Conta não localizada. Atualize a página e tente novamente.');
   document.getElementById('modalContent').innerHTML=statement(a)+
     '<div class="panel"><div class="credit-actions">'+
     '<button class="btn primary" onclick="launchCreditOrderV67(\''+escapeId(a.id)+'\')" '+(!canCharge()?'disabled':'')+'>🍢 LANÇAR NOVO CONSUMO</button>'+
     '<button class="btn" onclick="startCreditPaymentV67(\''+escapeId(a.id)+'\')" '+(!canCollect()||balance(a)<.01?'disabled':'')+'>💰 RECEBER / ACERTAR</button>'+
     '<button class="btn" onclick="printCreditAccountV67(\''+escapeId(a.id)+'\')">📄 PDF / IMPRIMIR</button>'+
     '<button class="btn" onclick="shareCreditAccountV67(\''+escapeId(a.id)+'\')">📲 WHATSAPP</button>'+
     '</div></div><div class="sheet-actions"><button class="btn" onclick="openCreditAccountsV67()">← TODAS AS CONTAS</button></div>';
   document.getElementById('modal').classList.remove('hide');
 }
 window.openCreditAccountV67=showAccount;
 window.printCreditAccountV67=function(value){
   const a=accountById(decodeId(value));if(!a)return;
   openPrintableReport('Extrato • '+a.name,'<h1>ALGAROBA SHAKES GRILLS</h1>'+
     '<p>Extrato de cliente • Emitido em '+safeDate(new Date())+'</p>'+statement(a));
 };
 window.shareCreditAccountV67=function(value){
   const a=accountById(decodeId(value));if(!a)return;
   let out=['ALGAROBA SHAKES GRILLS','EXTRATO DE CONSUMO — '+a.name,''];
   const events=(a.charges||[]).map(c=>({type:'charge',at:c.at,data:c}))
      .concat(receiptsOf(a).map(p=>({type:'receipt',at:p.at,data:p})))
      .sort((x,y)=>new Date(x.at)-new Date(y.at));
   let lastDay='';
   for(const e of events){
     const day=dateParts(e.at).title;
     if(day!==lastDay){out.push('\n📅 '+day);lastDay=day;}
     if(e.type==='receipt')out.push('✅ Pago '+money(e.data.value)+' ('+e.data.method+')');
     else{out.push((e.data.voided?'🚫 CANCELADO ':'🧾 Pedido ')+safeDate(e.at)+' • '+money(e.data.total));
       for(const item of e.data.items||[])out.push('  '+item.qty+'× '+item.name+' — '+money(Number(item.qty||1)*Number(item.price||0)));
     }
   }
   out.push('\nConsumos: '+money(chargesTotal(a)),'Pagamentos: '+money(paidTotal(a)),'SALDO PENDENTE: '+money(balance(a)),'Documento de conferência, não fiscal.');
   const message=out.join('\n');
   const url='https://wa.me/?text='+encodeURIComponent(message);
   window.open(url,'_blank');
 };
 const originalOpenTable=openTable;
 openTable=function(t){
   selectedAccountId=null;pendingTicket=null;
   originalOpenTable(t);
   decorateCart();
 };
 window.launchCreditOrderV67=function(value){
   if(!canCharge())return alert('Seu perfil não permite lançar pedidos.');
   const a=accountById(decodeId(value));if(!a)return alert('Cliente não encontrado.');
   if(current!=='counter')originalOpenTable('counter');
   if(cart.length&&!confirm('Há itens no carrinho. Deseja vinculá-los à conta de '+a.name+'?'))return;
   selectedAccountId=a.id;
   closeModal();decorateCart();
   document.getElementById('tableTitle').textContent='Balcão • '+a.name;
 };
 window.creditCustomerNameV67=()=>accountById(selectedAccountId)?.name||'';
 window.leaveCreditOrderV67=function(){
   if(cart.length&&!confirm('Voltar ao balcão comum sem perder os itens que ainda não foram enviados?'))return;
   selectedAccountId=null;pendingTicket=null;decorateCart();
   document.getElementById('tableTitle').textContent='Balcão / Retirada';
 };
 function decorateCart(){
   const container=document.getElementById('cart');
   if(!container)return;
   let wrap=document.getElementById('creditClientBannerV67');
   if(current!=='counter'){
     if(wrap)wrap.remove();return;
   }
   if(!wrap){
     wrap=document.createElement('div');wrap.id='creditClientBannerV67';
     wrap.className='panel credit-client-banner';
     container.parentNode.insertBefore(wrap,container);
   }
   const a=accountById(selectedAccountId);
   wrap.innerHTML=a?
     '<b>👤 CONTA A PRAZO: '+esc(a.name)+'</b>'+
     '<div class="muted">Cada novo pedido será lançado no extrato, com data e hora. O estoque será baixado no envio à produção.</div>'+
     '<div class="cart-row"><span>Saldo anterior</span><b>'+money(balance(a))+'</b></div>'+
     '<div class="credit-actions"><button class="btn" onclick="openCreditAccountV67(\''+escapeId(a.id)+'\')">🧾 EXTRATO</button>'+
     '<button class="btn" onclick="leaveCreditOrderV67()">TROCAR / PEDIDO COMUM</button></div>':
     '<b>🛍️ Balcão — Pedido comum</b><div class="muted">Cliente que paga depois? Vincule um nome para manter os consumos acumulados por vários dias.</div>'+
     '<button class="btn primary" style="margin-top:8px" onclick="openCreditAccountsV67()">👤 CLIENTE COM CONTA A PRAZO</button>';
 }
 const originalRenderCart=renderCart;
 renderCart=function(){originalRenderCart();decorateCart()};
 const originalRenderTables=renderTables;
 renderTables=function(){
   originalRenderTables();
   const box=document.getElementById('tables');
   if(!box)return;
   const el=document.createElement('div');el.className='table full credit-dashboard-tile';
   const count=pendingAccounts().length,total=pendingAccounts().reduce((t,a)=>t+balance(a),0);
   el.innerHTML='<span class="status">'+count+' CLIENTE(S) DEVENDO</span><h3>👥 Contas de Clientes</h3>'+
     '<div class="money">'+money(total)+'</div><div class="muted">Consumos por dia • Pagamentos parciais • Extratos</div>';
   el.addEventListener('click',showAccounts);box.appendChild(el);
 };
 const originalNextTicket=nextCounterTicket;
 nextCounterTicket=function(){
   const number=originalNextTicket();
   const a=accountById(selectedAccountId);
   pendingTicket=current==='counter'&&a?
     {accountId:a.id,ticket:number,createdAt:Date.now(),date:state.counterTicket?.date}:null;
   return number;
 };
 const originalSave=save;
 save=function(){
   if(pendingTicket&&current==='counter'&&Date.now()-pendingTicket.createdAt<30000){
     const q=(state.counterQueue||[]).slice().reverse().find(x=>
       !x.creditAccountId&&Number(x.ticket)===Number(pendingTicket.ticket)&&
       Math.abs(Number(x.createdAt||0)-Number(pendingTicket.createdAt||0))<30000);
     const a=accountById(pendingTicket.accountId);
     if(q&&a){
       const line=(q.items||[]).map(x=>({...x}));
       const total=line.reduce((n,x)=>n+Number(x.qty||0)*Number(x.price||0),0);
       if(total>0&&!a.charges.some(x=>x.orderId===q.id)){
         const entry={id:id('consumo'),orderId:q.id,ticket:q.ticket,at:new Date(q.createdAt||Date.now()).toISOString(),
           operator:state.activeOperator,items:line,total,notes:'Pedido de balcão'};
         a.charges.push(entry);
         q.creditAccountId=a.id;q.creditChargeId=entry.id;q.creditClientName=a.name;
       }
       pendingTicket=null;
     }
   }
   return originalSave();
 };
 const oldCashRender=renderCash;
 renderCash=function(){
   oldCashRender();
   const target=document.getElementById('cashStatus');
   if(target){
     const total=pendingAccounts().reduce((v,a)=>v+balance(a),0);
     const panel=document.createElement('div');panel.className='panel credit-cash-summary';
     panel.innerHTML='<div class="cart-row"><span><b>👥 Clientes com contas a prazo</b>'+
       '<div class="muted">Saldos a receber — não entram no caixa até o pagamento.</div></span><b>'+money(total)+'</b></div>'+
       '<button type="button" class="btn" onclick="openCreditAccountsV67()">VER CONTAS / RECEBER</button>';
     target.appendChild(panel);
   }
   const box=document.getElementById('openAccounts');
   if(!box)return;
   for(const q of state.counterQueue||[]){
     if(!q.creditAccountId)continue;
     for(const b of box.querySelectorAll('button[onclick]')){
       const action=b.getAttribute('onclick')||'';
       if(action==='paymentModalCounter('+q.id+')'){
         b.textContent='👤 CONTA: '+(q.creditClientName||'Cliente');
         b.setAttribute('onclick','openCreditAccountV67(\''+escapeId(q.creditAccountId)+'\')');
       }
       if(action==='internalWithdrawalCounter('+q.id+')')b.remove();
     }
   }
 };
 const oldPaymentModalCounter=paymentModalCounter;
 paymentModalCounter=function(orderId){
   const q=counterOrderById(orderId);
   if(q?.creditAccountId)return showAccount(q.creditAccountId);
   return oldPaymentModalCounter(orderId);
 };
 const oldInternalWithdrawal=internalWithdrawalCounter;
 internalWithdrawalCounter=function(orderId){
   if(counterOrderById(orderId)?.creditAccountId)return alert('Este pedido já foi lançado na conta a prazo do cliente. Receba pelo extrato dele.');
   return oldInternalWithdrawal(orderId);
 };
 const oldCancelCash=cancelCashComanda;
 cancelCashComanda=function(kind,orderId){
   if(kind==='counter'&&counterOrderById(orderId)?.creditAccountId)
     return alert('Este pedido está vinculado a uma conta de cliente. Consulte o extrato; não feche como venda comum.');
   return oldCancelCash(kind,orderId);
 };
 // Um pedido entregue sai da fila temporária, mas o débito continua registrado.
 const oldAdvance=advanceStation;
 advanceStation=function(orderId,station){
   const q=counterOrderById(orderId);
   oldAdvance(orderId,station);
   if(q?.creditAccountId&&q.orders?.every(o=>o.status==='ENTREGUE')){
     state.counterQueue=(state.counterQueue||[]).filter(x=>x.id!==q.id);
     markDirty();renderTables();renderCash();
   }
 };
 const oldReportCards=reportModuleCards;
 reportModuleCards=function(){return [...oldReportCards(),['credit','👥','Clientes a Prazo','Consumos por dia, saldos e recebimentos']]};
 const oldReportGenerator=generateModuleReport;
 generateModuleReport=function(){
   if(activeReportModule!=='credit')return oldReportGenerator();
   let [a,b]=moduleDates(),from=dateParts(a).day,to=dateParts(b).day;
   const container=document.getElementById('moduleResult');if(!container)return;
   let customerRows=data().accounts.slice().sort((a,b)=>a.name.localeCompare(b.name,'pt-BR'));
   const running=pendingAccounts().reduce((v,a)=>v+balance(a),0);
   let totalCharged=0,totalReceived=0;
   const rows=customerRows.map(customer=>{
     const charge=(customer.charges||[]).filter(x=>dateParts(x.at).day>=from&&dateParts(x.at).day<=to);
     const received=receiptsOf(customer).filter(x=>dateParts(x.at).day>=from&&dateParts(x.at).day<=to);
     if(!charge.length&&!received.length)return '';
     totalCharged+=charge.filter(x=>!x.voided).reduce((v,x)=>v+amount(x.total),0);
     totalReceived+=received.reduce((v,x)=>v+amount(x.value),0);
     return '<div class="panel"><div class="cart-row"><b>👤 '+esc(customer.name)+'</b><b>Pendente: '+money(balance(customer))+'</b></div>'+
       accountLineItems(charge,received)+
       '<button class="btn" onclick="openCreditAccountV67(\''+escapeId(customer.id)+'\')">ABRIR EXTRATO COMPLETO</button></div>';
   }).join('');
   container.innerHTML='<div class="panel"><h3>👥 Clientes a Prazo — '+dateParts(a).title+' até '+dateParts(b).title+'</h3>'+
     '<div class="cart-row"><span>Consumos no período</span><b>'+money(totalCharged)+'</b></div>'+
     '<div class="cart-row"><span>Recebimentos no período</span><b>'+money(totalReceived)+'</b></div>'+
     '<div class="cart-row"><span>Total a receber (todos os dias)</span><b>'+money(running)+'</b></div>'+
     '</div>'+ (rows||'<div class="panel">Sem movimentações de clientes neste período.</div>')+
     '<button class="btn" onclick="openCreditAccountsV67()">GERENCIAR TODAS AS CONTAS</button>'+modulePrintButton();
 };
 window.startCreditPaymentV67=function(value){
   const a=accountById(decodeId(value));if(!a)return alert('Conta não localizada.');
   if(!canCollect())return alert('Abra o Caixa com um perfil de Caixa ou Gerente para receber.');
   const left=balance(a);if(left<.01)return alert('Conta já está quitada.');
   document.getElementById('modalContent').innerHTML='<h2>💰 Receber conta de cliente</h2>'+
     '<div class="panel"><b>'+esc(a.name)+'</b><div class="muted">Saldo a pagar</div><div class="big">'+money(left)+'</div></div>'+
     '<label>Valor recebido (aceita pagamento parcial)</label>'+
     '<input id="creditReceivedV67" type="number" inputmode="decimal" min=".01" step=".01" max="'+left.toFixed(2)+'" value="'+left.toFixed(2)+'">'+
     '<label>Forma de pagamento</label><select id="creditMethodV67">'+financialMethods.map(method=>'<option>'+method+'</option>').join('')+'</select>'+
     '<div class="panel muted">O recebimento será registrado no caixa e no turno desta data. Os consumos antigos não serão cobrados novamente.</div>'+
     '<div class="sheet-actions"><button class="btn" onclick="openCreditAccountV67(\''+escapeId(a.id)+'\')">VOLTAR</button>'+
     '<button id="creditConfirmPayV67" class="btn primary" onclick="confirmCreditPaymentV67(\''+escapeId(a.id)+'\')">CONFIRMAR RECEBIMENTO</button></div>';
   document.getElementById('modal').classList.remove('hide');
 };
 window.confirmCreditPaymentV67=async function(value){
   if(paying)return;
   if(!canCollect())return alert('O caixa está fechado ou seu perfil não possui permissão de recebimento.');
   const a=accountById(decodeId(value));if(!a)return alert('Cliente não localizado.');
   const left=balance(a),input=document.getElementById('creditReceivedV67');
   const v=Math.round(Number(String(input?.value||0).replace(',','.'))*100)/100,
         method=document.getElementById('creditMethodV67')?.value;
   if(!financialMethods.includes(method)||!Number.isFinite(v)||v<=0||v>left+.001)return alert('Informe um valor de pagamento válido até '+money(left)+'.');
   if(!confirm('Confirmar recebimento de '+money(v)+' em '+method+' de '+a.name+'?'))return;
   paying=true;
   const button=document.getElementById('creditConfirmPayV67');if(button)button.disabled=true;
   const at=new Date().toISOString(),receiptId=id('recebimento');
   const rec={id:receiptId,accountId:a.id,at,value:v,method,operator:state.activeOperator};
   data().receipts.push(rec);
   state.history=state.history||[];
   state.history.push({id:receiptId,creditReceiptId:receiptId,customerCredit:true,creditAccountId:a.id,
     closedAt:at,name:'Recebimento conta a prazo • '+a.name,payment:method,payments:[{method,value:v}],
     total:v,operator:state.activeOperator,items:[]});
   state.revenue=Number(state.revenue||0)+v;
   markDirty();
   let onlineError=null;
   if(cloudReady){
     clearTimeout(cloudTimer);
     const row=stateRecords(state).find(r=>r.record_key==='meta');
     const payload={...row,updated_at:new Date().toISOString()};
     try{
       await cloudRequest('algaroba_records?on_conflict=record_key',{
         method:'POST',prefer:'resolution=merge-duplicates,return=minimal',
         body:JSON.stringify([payload])
       });
       cloudSnapshot.meta=JSON.stringify(row.data);
       cloudLastError='';cloudFailures=0;setSyncStatus('online','ONLINE');
     }catch(e){
       onlineError=e;console.error('Recebimento conta cliente',e);setSyncStatus('error','ERRO: TOQUE AQUI');
     }finally{cloudPausePullUntil=Date.now()+2500}
   }else onlineError=new Error('Offline');
   paying=false;
   renderCash();
   showAccount(a.id);
   alert('Recebimento de '+money(v)+' registrado para '+a.name+
     '.\nSaldo restante: '+money(balance(a))+
     (onlineError?'\n⚠️ Salvo localmente; verifique a sincronização ONLINE antes de registrar outro pagamento.':'\n✅ Sincronizado com o caixa.'));
 };
 data();
})();
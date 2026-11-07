(function enableCustomerBills(){
  let selected='geral',busy=false;
  const original={openTable,renderCart,pushCart,paymentModal,finishPayment,renderPaymentModal,transferTable,kitchenItem,reportModuleCards,generateModuleReport};
  function owner(it){return String(it?.customerId||'geral')}
  window.customerOwnerId=owner;
  function clientName(t,id){return id==='geral'?'Mesa / Compartilhado':(t.customers||[]).find(c=>c.id===id)?.name||(t.items||[]).find(x=>owner(x)===id)?.customerName||'Cliente'}
  function groups(t){
    const ids=['geral',...(t.customers||[]).map(x=>x.id)];
    for(const i of [...t.items,...(current===t.id?cart:[])])if(!ids.includes(owner(i)))ids.push(owner(i));
    return ids.map(id=>{
      const sent=t.items.filter(x=>owner(x)===id),pending=current===t.id?cart.filter(x=>owner(x)===id):[],paid=(t.customerPayments||[]).filter(x=>x.customerId===id);
      return {id,name:clientName(t,id),sent,pending,paid,subtotal:sent.reduce((v,x)=>v+x.qty*x.price,0),waiting:pending.reduce((v,x)=>v+x.qty*x.price,0),settled:paid.reduce((v,x)=>v+x.total,0)};
    });
  }
  function addCustomer(){
    if(current==='counter')return;
    let t=getT(),raw=prompt('Nome do novo cliente da Mesa '+t.id+':');if(raw===null)return;
    let name=raw.trim().replace(/\s+/g,' ');if(!name)return alert('Informe um nome.');if(name.length>60)return alert('Nome muito longo.');
    t.customers=t.customers||[];
    if(t.customers.some(c=>c.name.toLowerCase()===name.toLowerCase()))return alert('Nome já usado. Diferencie os dois clientes.');
    let id='c'+Date.now().toString(36)+Math.random().toString(36).slice(2,8);
    t.customers.push({id,name});selected=id;save();renderCart();
  }
  function selectCustomer(id){selected=id;renderCart()}
  function editOwner(section,i){
    if(current==='counter')return;
    let t=getT(),item=section==='sent'?t.items[i]:cart[i];if(!item)return;
    const prev=owner(item);
    openChoiceModal('👤 Responsável','Quem consumiu '+item.name+'?',groups(t).map(g=>({label:g.name,action:()=>{
      if(g.id===prev)return;
      const oldName=item.name,qty=item.qty;
      item.customerId=g.id;item.customerName=clientName(t,g.id);
      if(section==='sent'){
        let remaining=qty;
        for(const o of t.orders||[])for(const oi of [...o.items]){
          if(remaining<=0)break;
          if(oi.name!==oldName||oi.cancelled||owner(oi)!==prev)continue;
          let q=Math.min(remaining,oi.qty);
          if(q===oi.qty){oi.customerId=g.id;oi.customerName=item.customerName}
          else {oi.qty-=q;o.items.push({...oi,qty:q,customerId:g.id,customerName:item.customerName})}
          remaining-=q;
        }
        save();
      }
      renderCart();
    }})));
  }
  function ensureUI(){
    if(!document.getElementById('tableClientPicker')){
      const d=document.createElement('div');d.id='tableClientPicker';document.getElementById('tableTitle')?.insertAdjacentElement('afterend',d);
    }
    if(!document.getElementById('tableClientTotals')){
      const d=document.createElement('div');d.id='tableClientTotals';document.getElementById('cart')?.insertAdjacentElement('afterend',d);
    }
  }
  function renderClients(){
    ensureUI();
    const head=document.getElementById('tableClientPicker'),totals=document.getElementById('tableClientTotals');
    if(!head||!totals)return;
    if(current==='counter'){head.style.display=totals.style.display='none';return;}
    head.style.display=totals.style.display='block';
    let t=getT(),all=groups(t);
    head.innerHTML=`<h3>👥 Clientes da Mesa ${String(t.id).padStart(2,'0')}</h3><div class="muted">Selecione o cliente antes de adicionar o pedido.</div><div class="client-pills">${all.map(g=>`<button class="client-chip ${selected===g.id?'on':''}" onclick="selectCustomerOnTable('${g.id}')">${esc(g.name)}</button>`).join('')}<button class="client-chip add" onclick="addCustomerOnTable()">＋ ADICIONAR PESSOA</button></div><div class="muted">Pedido atual para: <b>${esc(clientName(t,selected))}</b></div>`;
    totals.innerHTML=`<h3>Contas individuais</h3>${all.map(g=>{
      if(!g.subtotal&&!g.waiting&&!g.settled)return '';
      return `<div class="client-bill"><div class="cart-row"><b>${esc(g.name)}</b><b>${brl(g.subtotal+g.waiting)}</b></div><div class="muted">${[...g.sent,...g.pending].map(x=>`${x.qty}× ${esc(x.name)}`).join(' • ')||'Sem consumo em aberto'}</div>${g.waiting?`<div class="muted">⏳ A enviar: ${brl(g.waiting)}</div>`:''}${g.settled?`<div class="muted">✅ Pago anteriormente: ${brl(g.settled)}</div>`:''}<div class="client-actions"><button class="btn" onclick="showClientBill('${g.id}')">👁 VER CONTA</button>${g.subtotal?`<button class="btn primary" onclick="payClientBill(${t.id},'${g.id}')">💳 RECEBER</button>`:''}</div></div>`;
    }).join('')}<div class="cart-row"><b>TOTAL PENDENTE DA MESA</b><b>${brl([...t.items,...cart].reduce((v,x)=>v+x.price*x.qty,0))}</b></div>`;
    document.querySelectorAll('#cart > .cart-row').forEach((row,i)=>{
      let tCount=t.items.length,it=i<tCount?t.items[i]:cart[i-tCount];if(!it)return;
      let sub=document.createElement('div');sub.className='client-inline';sub.textContent='👤 '+(it.customerName||clientName(t,owner(it)))+' ';
      let change=document.createElement('button');change.type='button';change.className='mini';change.textContent='⇄ Alterar cliente';
      change.onclick=()=>editOwner(i<tCount?'sent':'pending',i<tCount?i:i-tCount);
      sub.append(change);row.firstElementChild?.append(sub);
    });
  }
  function viewBill(id){
    let t=getT(),g=groups(t).find(x=>x.id===id);if(!g)return;
    window.billClientId=id;
    const paymentDetails=g.paid.map(p=>`<div class="cart-row"><span>${new Date(p.at).toLocaleString('pt-BR')} • ${p.items.map(x=>x.qty+'× '+esc(x.name)).join(' / ')}</span><b>${brl(p.total)}</b></div>`).join('');
    document.getElementById('modalContent').innerHTML=`<h2>👤 ${esc(g.name)} — Mesa ${String(t.id).padStart(2,'0')}</h2><p class="muted">Extrato individual de consumo</p><div class="panel">${[...g.sent,...g.pending].map(x=>`<div class="cart-row"><span>${x.qty}× ${esc(x.name)}</span><b>${brl(x.qty*x.price)}</b></div>`).join('')||'Nenhum item pendente'}<div class="cart-row"><b>Em aberto</b><b>${brl(g.subtotal+g.waiting)}</b></div></div>${paymentDetails?`<h3>Consumo já pago</h3><div class="panel">${paymentDetails}</div>`:''}<div class="sheet-actions"><button class="btn" onclick="closeModal()">VOLTAR</button><button class="btn primary" onclick="printClientBill()">🖨 PDF / IMPRIMIR</button></div>`;
    document.getElementById('modal').classList.remove('hide');
  }
  function printBill(){
    let t=getT(),g=groups(t).find(x=>x.id===window.billClientId);if(!g)return;
    openPrintableReport('Conta de '+g.name,`<h1>Algaroba Shakes Grills</h1><h2>Mesa ${String(t.id).padStart(2,'0')} • ${esc(g.name)}</h2><p>Conferência de consumo — não é documento fiscal</p>${[...g.sent,...g.pending].map(x=>`<div class="r"><span>${x.qty}× ${esc(x.name)}</span><b>${brl(x.qty*x.price)}</b></div>`).join('')}<div class="r"><b>Em aberto</b><b>${brl(g.subtotal+g.waiting)}</b></div>${g.settled?`<p>Pagamentos anteriores: ${brl(g.settled)}</p>`:''}`);
  }
  function paymentForClient(tableId,id){
    let t=state.tables.find(x=>x.id===Number(tableId));if(!t)return;
    if(current===t.id&&cart.length)return alert('Envie primeiro os pedidos em espera antes do pagamento.');
    let items=t.items.filter(x=>owner(x)===id),sum=items.reduce((a,x)=>a+x.price*x.qty,0);
    if(!sum)return alert('Não há itens pendentes para esta pessoa.');
    payCtx={name:'Mesa '+String(t.id).padStart(2,'0')+' • '+clientName(t,id),tableId:t.id,customerId:id,customerName:clientName(t,id),sum,itemSnapshot:JSON.stringify(items.map(x=>[x.name,x.qty,x.price,owner(x)])),items:items.map(x=>({...x}))};
    payments=[];renderPaymentModal();
  }
  function paymentForWhole(tableId){
    let t=state.tables.find(x=>x.id===Number(tableId));if(!t)return;
    if(current===t.id&&cart.length)return alert('Envie primeiro os pedidos em espera.');
    payCtx={name:'Mesa '+String(t.id).padStart(2,'0'),tableId:t.id,sum:t.items.reduce((a,x)=>a+x.price*x.qty,0),items:t.items.map(x=>({...x}))};
    payments=[];renderPaymentModal();
  }
  function choosePayment(tableId){
    let t=state.tables.find(x=>x.id===Number(tableId));if(!t)return;
    if(current===t.id&&cart.length)return alert('Envie primeiro os pedidos em espera.');
    document.getElementById('modalContent').innerHTML=`<h2>💳 Mesa ${String(t.id).padStart(2,'0')}</h2><p class="muted">Selecione uma pessoa ou receba toda a mesa.</p>${groups(t).filter(g=>g.subtotal>0).map(g=>`<div class="cart-row"><b>${esc(g.name)}</b><button class="btn primary" onclick="payClientBill(${t.id},'${g.id}')">${brl(g.subtotal)} • RECEBER</button></div>`).join('')}<div class="sheet-actions"><button class="btn" onclick="closeModal()">VOLTAR</button><button class="btn primary" onclick="payWholeBill(${t.id})">PAGAR TUDO</button></div>`;
    document.getElementById('modal').classList.remove('hide');
  }
  Object.assign(window,{addCustomerOnTable:addCustomer,selectCustomerOnTable:selectCustomer,showClientBill:viewBill,printClientBill:printBill,payClientBill:paymentForClient,payWholeBill:paymentForWhole});
  openTable=function(id){selected='geral';original.openTable(id);renderClients()};
  renderCart=function(){original.renderCart();renderClients()};
  pushCart=function(name,price,components=null){
    let comps=components||[stockKey(name)],cost=comps.reduce((a,k)=>a+Number((state.inventory.items[k]||{}).cost||0),0);
    let id=current==='counter'?'geral':selected,person=current==='counter'?'':clientName(getT(),id);
    let x=cart.find(x=>x.name===name&&x.price===price&&owner(x)===id);
    x?x.qty++:cart.push({name,price,qty:1,cost,stockComponents:comps,skewerLine:skewerLineForName(name),customerId:id,customerName:person});
    renderCart();
  };
  paymentModal=function(name){
    const id=name==='Balcão'?'counter':Number(name.replace(/\D/g,''));
    let t=id==='counter'?state.counter:state.tables.find(x=>x.id===id);
    if(!t||!t.items?.length)return alert('Comanda vazia.');
    return id!=='counter'&&(t.customers||[]).length?choosePayment(id):original.paymentModal(name);
  };
  renderPaymentModal=function(){
    original.renderPaymentModal();
    if(payCtx?.items?.length){
      const el=document.getElementById('modalContent'),box=document.createElement('div');box.className='panel';
      box.innerHTML='<h3>Itens deste pagamento</h3>'+payCtx.items.map(x=>`<div class="cart-row"><span>${x.qty}× ${esc(x.name)}</span><b>${brl(x.qty*x.price)}</b></div>`).join('');
      let actions=el.querySelector('.sheet-actions');if(actions)el.insertBefore(box,actions);
    }
  };
  finishPayment=async function(){
    if(!payCtx?.customerId){
      let ctx=payCtx;await original.finishPayment();
      if(ctx&&typeof ctx.tableId==='number'){
        let t=state.tables.find(x=>x.id===ctx.tableId);
        if(t&&!t.items.length){t.customers=[];t.customerPayments=[];save();if(current===ctx.tableId)renderCart()}
      }
      return;
    }
    if(busy)return;
    let ctx=payCtx,paid=payments.reduce((a,x)=>a+Number(x.value||0),0),left=ctx.sum-paid;
    if(left>.01){
      let val=parseFloat(document.getElementById('payValue')?.value||0);
      if(val>0&&Math.abs(val-left)<=.01){payments.push({method:document.getElementById('payMethod')?.value||'Não informado',value:left});paid+=left;left=ctx.sum-paid}
    }
    if(Math.abs(left)>.01)return alert('Faltam '+brl(Math.max(0,left))+' para quitar esta conta.');
    let t=state.tables.find(x=>x.id===ctx.tableId);if(!t)return alert('Mesa não encontrada.');
    let items=t.items.filter(x=>owner(x)===ctx.customerId),sum=items.reduce((a,x)=>a+x.price*x.qty,0);
    if(Math.abs(ctx.sum-sum)>.01||ctx.itemSnapshot!==JSON.stringify(items.map(x=>[x.name,x.qty,x.price,owner(x)])))return alert('A conta mudou. Feche e abra novamente a cobrança.');
    busy=true;
    let sale={closedAt:new Date().toISOString(),name:ctx.name,tableId:ctx.tableId,customerId:ctx.customerId,customerName:ctx.customerName,payment:payments.length===1?payments[0].method:'Dividido',payments:payments.map(x=>({...x})),total:sum,operator:state.activeOperator,items:items.map(x=>({...x}))};
    state.revenue=Number(state.revenue||0)+sum;state.history=state.history||[];state.history.push(sale);
    t.customerPayments=t.customerPayments||[];
    t.customerPayments.push({customerId:ctx.customerId,customerName:ctx.customerName,total:sum,items:sale.items,at:sale.closedAt});
    t.items=t.items.filter(x=>owner(x)!==ctx.customerId);
    let open=t.items.length>0;
    if(!open){t.orders=[];t.status='livre';t.customers=[];t.customerPayments=[]}else t.status='ocupada';
    cloudPausePullUntil=Date.now()+7000;localStorage.setItem('algarobaState',JSON.stringify(state));
    try{
      if(cloudReady){
        clearTimeout(cloudTimer);
        let rows=stateRecords(state).filter(r=>['table:'+ctx.tableId,'meta'].includes(r.record_key)).map(r=>({...r,updated_at:new Date().toISOString()}));
        await cloudRequest('algaroba_records?on_conflict=record_key',{method:'POST',prefer:'resolution=merge-duplicates,return=minimal',body:JSON.stringify(rows)});
        for(const r of rows)cloudSnapshot[r.record_key]=JSON.stringify(r.data);
        cloudLastError='';cloudFailures=0;setSyncStatus('online','ONLINE');
      }
    }catch(e){cloudLastError=e.message||String(e);console.error(e);setSyncStatus('error','ERRO: TOQUE AQUI');alert('Registrado localmente, mas a sincronização falhou. Confira a conexão.')}
    busy=false;payCtx=null;payments=[];closeModal();renderCash();renderTables();if(current===ctx.tableId)renderCart();
    alert('Pagamento de '+ctx.customerName+' registrado! '+(open?'Outros clientes continuam na mesa.':'Mesa liberada.'));
  };
  kitchenItem=function(i){return i.cancelled?original.kitchenItem(i):`<div class="active-item">${i.qty}× ${esc(i.name)}${i.customerName?` • 👤 <b>${esc(i.customerName)}</b>`:''}</div>`};
  transferTable=function(){
    if(current==='counter')return original.transferTable();
    let t=getT(),oldId=current,people=(t.customers||[]).map(x=>({...x})),pays=(t.customerPayments||[]).map(x=>({...x}));
    original.transferTable();
    if(oldId!==current){let old=state.tables.find(x=>x.id===oldId);getT().customers=people;getT().customerPayments=pays;old.customers=[];old.customerPayments=[];save();renderCart()}
  };
  reportModuleCards=function(){return [...original.reportModuleCards(),['customers','👥','Clientes por mesa','Consumo e pagamentos individualizados']]};
  generateModuleReport=function(){
    if(activeReportModule!=='customers')return original.generateModuleReport();
    let [a,b]=moduleDates(),h=moduleSales(a,b),el=document.getElementById('moduleResult');if(!el)return;
    let rows=[];
    for(const sale of h){
      let map=new Map();
      for(let it of sale.items||[]){
        let id=owner(it),name=it.customerName||sale.customerName||'Mesa / Compartilhado';
        if(!map.has(id))map.set(id,{name,items:[],total:0});
        let g=map.get(id);g.total+=it.qty*it.price;g.items.push(it);
      }
      for(const g of map.values())rows.push({sale,g});
    }
    el.innerHTML=`<div class="panel"><b>${modulePeriodTitle(a,b)}</b></div>${rows.reverse().map(({sale,g})=>`<div class="panel"><div class="cart-row"><span><b>👤 ${esc(g.name)}</b><div class="muted">${esc(sale.name)} • ${new Date(sale.closedAt).toLocaleString('pt-BR')}</div></span><b>${brl(g.total)}</b></div>${g.items.map(x=>`<div class="cart-row"><span>${x.qty}× ${esc(x.name)}</span><b>${brl(x.qty*x.price)}</b></div>`).join('')}</div>`).join('')||'<div class="panel">Nenhum registro de venda no período.</div>'}${modulePrintButton()}`;
  };
})();
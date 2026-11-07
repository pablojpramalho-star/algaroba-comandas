(function installConferencesV59(){
 const productionSend=sendOrder;
 const paymentEntry=paymentModal;
 const individualPayment=window.payClientBill;
 const wholePayment=window.payWholeBill;
 const beforeRenderCart=renderCart;
 const beforeRenderCash=renderCash;
 let previewOrder=null,previewBill=null,proceeding=false;

 function normalizeOwner(item){return String(item?.customerId||'geral')}
 function nameOfOwner(t,id,items){
   if(id==='geral')return 'Mesa / Compartilhado';
   return (t?.customers||[]).find(c=>c.id===id)?.name||items.find(i=>normalizeOwner(i)===id)?.customerName||'Cliente';
 }
 function money(n){return brl(Number(n)||0)}
 function lineTotal(item){return (Number(item.qty)||0)*(Number(item.price)||0)}
 function total(items){return (items||[]).reduce((a,x)=>a+lineTotal(x),0)}
 function itemRows(items){
   return items.map(i=>`<div class="confer-row"><span><b>${Number(i.qty)||0}× ${esc(i.name||'Produto')}</b><small>${money(i.price)} cada</small></span><b>${money(lineTotal(i))}</b></div>`).join('');
 }
 function groupedItems(items,t){
   let groups=new Map();
   for(const item of items){
     const id=normalizeOwner(item);
     if(!groups.has(id))groups.set(id,[]);
     groups.get(id).push(item);
   }
   return [...groups.entries()].map(([id,parts])=>({
     id,name:nameOfOwner(t,id,items),items:parts,subtotal:total(parts)
   }));
 }
 function groupedHtml(items,t){
   const groups=groupedItems(items,t);
   return groups.map(g=>`<div class="confer-group"><div class="confer-group-name"><b>👤 ${esc(g.name)}</b><b>${money(g.subtotal)}</b></div>${itemRows(g.items)}<div class="confer-group-total"><span>Subtotal — ${esc(g.name)}</span><b>${money(g.subtotal)}</b></div></div>`).join('')||'<div class="muted">Nenhum produto registrado.</div>';
 }
 function summaryHtml({title,subject,items,t,kind,previous,tableLabel}){
   const subtotal=total(items),alreadyPaid=(previous||[]).reduce((a,p)=>a+Number(p.total||0),0);
   const notes=kind==='before-production'
     ?'<div class="confer-warning">⏳ ESTE PEDIDO AINDA NÃO FOI ENVIADO À PRODUÇÃO.</div>'
     :'<div class="confer-warning">🧾 CONFERÊNCIA PRÉ-PAGAMENTO — NÃO É RECIBO DE QUITAÇÃO.</div>';
   return `<div class="confer-report">
     <div class="confer-brand">🌳 ALGAROBA SHAKES GRILLS</div>
     <h2>${esc(title)}</h2>
     <p class="muted">${esc(subject)} • ${new Date().toLocaleString('pt-BR')}<br>Atendente: ${esc(state.activeOperator||'Não identificado')}</p>
     ${notes}${groupedHtml(items,t)}
     <div class="confer-grand"><span>${kind==='before-production'?'TOTAL DESTE PEDIDO':'TOTAL A PAGAR'}</span><b>${money(subtotal)}</b></div>
     ${kind==='before-payment'&&alreadyPaid>0?`<div class="confer-paid">✅ Valores já pagos anteriormente na mesa: <b>${money(alreadyPaid)}</b></div><div class="confer-paid">Consumo acumulado desta mesa: <b>${money(subtotal+alreadyPaid)}</b></div>`:''}
     <p class="confer-note">Relatório para conferência com o cliente. Não é documento fiscal.</p>
   </div>`;
 }
 function toPrintDocument(viewTitle,markup){
   const printCss=`<style>
     .confer-report{font-family:Arial,sans-serif;color:#181818}
     .confer-brand{font-size:17px;font-weight:900;margin:0 0 10px}
     .confer-group{border:1px solid #999;border-radius:9px;padding:10px;margin:12px 0;page-break-inside:avoid}
     .confer-group-name,.confer-row,.confer-group-total,.confer-grand{display:flex;justify-content:space-between;gap:10px;align-items:center;padding:7px 0}
     .confer-group-name{border-bottom:1px solid #aaa}
     .confer-row{border-bottom:1px dotted #ddd}
     .confer-row small{display:block;color:#555;font-size:12px;margin-top:2px}
     .confer-group-total{font-size:13px}
     .confer-grand{font-size:20px;font-weight:bold;border-top:2px solid #111;margin-top:14px}
     .confer-warning{border:1px dashed #999;padding:10px;margin:10px 0;font-size:12px;font-weight:bold}
     .confer-paid,.confer-note{font-size:12px;margin:8px 0}
     .muted{color:#555;font-size:13px}
   </style>`;
   openPrintableReport(viewTitle,printCss+markup);
 }
 function activeOrderTitle(id){
   return id==='counter'?'Balcão / Retirada':'Mesa '+String(id).padStart(2,'0');
 }
 function showOrderPreview(){
   if(!cart.length)return alert('Adicione algum produto.');
   const order=cart.map(i=>({...i})),base=activeOrderTitle(current),table=getT();
   previewOrder={tableId:current,cartSignature:JSON.stringify(cart),items:order,openedAt:Date.now()};
   const html=summaryHtml({title:'CONFERÊNCIA DO PEDIDO',subject:base,items:order,t:table,kind:'before-production'});
   const el=document.getElementById('modalContent');
   el.innerHTML=`${html}<div class="confer-actions"><button class="btn" type="button" onclick="cancelOrderPreviewV59()">← CORRIGIR PEDIDO</button><button class="btn" type="button" onclick="printOrderPreviewV59()">🖨 IMPRIMIR / PDF</button><button class="btn primary" id="confirmOrderV59" type="button" onclick="confirmOrderPreviewV59()">✅ CONFERIDO — ENVIAR À PRODUÇÃO</button></div>`;
   document.getElementById('modal').classList.remove('hide');
 }
 function printOrder(){
   if(!previewOrder)return;
   const t=previewOrder.tableId==='counter'?state.counter:state.tables.find(x=>x.id===previewOrder.tableId);
   const html=summaryHtml({title:'CONFERÊNCIA DO PEDIDO',subject:activeOrderTitle(previewOrder.tableId),items:previewOrder.items,t,kind:'before-production'});
   toPrintDocument('Conferência pré-produção • '+activeOrderTitle(previewOrder.tableId),html);
 }
 function dismissOrder(){previewOrder=null;closeModal();}
 function confirmOrder(){
   if(proceeding||!previewOrder)return;
   if(current!==previewOrder.tableId||JSON.stringify(cart)!==previewOrder.cartSignature){
     dismissOrder();return alert('O pedido foi alterado. Confira novamente antes de enviar.');
   }
   proceeding=true;
   const button=document.getElementById('confirmOrderV59');
   if(button)button.disabled=true;
   previewOrder=null;closeModal();
   try{productionSend()}finally{proceeding=false;}
 }
 function locateInvoice(target){
   if(target.type==='counterQueue')return (state.counterQueue||[]).find(q=>Number(q.id)===Number(target.id));
   if(target.type==='counter')return state.counter;
   return state.tables.find(t=>Number(t.id)===Number(target.id));
 }
 function readInvoice(target){
   const t=locateInvoice(target);
   if(!t)return null;
   const items=(t.items||[]).filter(i=>target.customerId==null||normalizeOwner(i)===String(target.customerId));
   const past=target.type==='table'?(t.customerPayments||[]):[];
   const previous=target.customerId==null?past:past.filter(p=>p.customerId===target.customerId);
   const subject=target.type==='table'
      ?'Mesa '+String(t.id).padStart(2,'0')+(target.customerId==null?'':' • '+nameOfOwner(t,target.customerId,[...t.items]))
      :(target.type==='counterQueue'?'Balcão / Retirada • Senha '+(t.ticket||target.id):'Balcão / Retirada');
   return {t,items:items.map(i=>({...i})),previous:previous.map(x=>({...x})),subject,signature:JSON.stringify({items,previous})};
 }
 function openBillPreview(target,forward=null){
   const inv=readInvoice(target);
   if(!inv||!inv.items.length)return alert('Não há itens enviados para conferir.');
   previewBill={target,forward,signature:inv.signature,openedAt:Date.now()};
   const notYetSent=current===target.id && cart.length>0 && target.type==='table';
   const html=summaryHtml({title:'CONFERÊNCIA DA COMANDA',subject:inv.subject,items:inv.items,t:inv.t,kind:'before-payment',previous:inv.previous});
   const el=document.getElementById('modalContent');
   const warning=notYetSent?'<p class="confer-warning">⚠️ Há itens adicionados à comanda que ainda não foram enviados. Envie esses pedidos antes de receber.</p>':'';
   const allowed=!!forward&&(!notYetSent);
   el.innerHTML=`${html}${warning}<div class="confer-actions"><button class="btn" type="button" onclick="cancelBillPreviewV59()">← VOLTAR</button><button class="btn" type="button" onclick="printBillPreviewV59()">🖨 IMPRIMIR / PDF</button>${allowed?'<button class="btn primary" id="continueBillV59" type="button" onclick="continueBillPreviewV59()">✅ CONFERIDO — IR AO PAGAMENTO</button>':''}</div>`;
   document.getElementById('modal').classList.remove('hide');
 }
 function printBill(){
   if(!previewBill)return;
   const inv=readInvoice(previewBill.target);
   if(!inv)return alert('Comanda não encontrada.');
   if(inv.signature!==previewBill.signature)return alert('A comanda foi alterada. Abra novamente a conferência para imprimir os valores atuais.');
   const html=summaryHtml({title:'CONFERÊNCIA DA COMANDA',subject:inv.subject,items:inv.items,t:inv.t,kind:'before-payment',previous:inv.previous});
   toPrintDocument('Conferência pré-pagamento • '+inv.subject,html);
 }
 function dismissBill(){previewBill=null;closeModal();}
 function continueBill(){
   if(proceeding||!previewBill||!previewBill.forward)return;
   const ctx=previewBill,inv=readInvoice(ctx.target);
   if(!inv||inv.signature!==ctx.signature){
     dismissBill();return alert('A conta mudou enquanto era conferida. Revise os valores novamente.');
   }
   if(ctx.target.type==='table'&&current===ctx.target.id&&cart.length){
     return alert('Envie os produtos ainda pendentes antes de receber.');
   }
   proceeding=true;
   previewBill=null;
   try{ctx.forward()}finally{proceeding=false;}
 }
 function checkTableBill(){
   if(current==='counter')return alert('Escolha um pedido do balcão no Caixa para conferir.');
   const t=getT();
   const target={type:'table',id:t.id,customerId:null};
   const forward=canView('caixa')&&state.cash?.open?()=>paymentEntry('Mesa '+String(t.id).padStart(2,'0')):null;
   openBillPreview(target,forward);
 }
 function previewCashBill(tableId){return openBillPreview({type:'table',id:Number(tableId),customerId:null},()=>paymentEntry('Mesa '+String(Number(tableId)).padStart(2,'0')));}
 function renderCashPreviewButtons(){
   const el=document.getElementById('openAccounts');
   if(!el||!state.cash?.open)return;
   for(const card of el.querySelectorAll('.panel')){
     if(card.querySelector('[data-confer-preview]'))continue;
     const allButtons=[...card.querySelectorAll('button')];
     const link=allButtons.find(b=>/paymentModal\(|paymentModalCounter\(/.test(b.getAttribute('onclick')||''));
     if(!link)continue;
     const raw=link.getAttribute('onclick')||'';
     let match=raw.match(/Mesa\s+(\d+)/),target=null;
     if(match)target={type:'table',id:Number(match[1])};
     else{match=raw.match(/paymentModalCounter\((\d+)\)/);if(match)target={type:'counterQueue',id:Number(match[1])};}
     if(!target)continue;
     const btn=document.createElement('button');btn.className='btn';btn.type='button';btn.dataset.conferPreview='true';btn.textContent='🧾 CONFERIR / IMPRIMIR CONTA';
     btn.onclick=()=>openBillPreview(target,()=>link.click());
     link.insertAdjacentElement('afterend',btn);
   }
 }
 function mountTableButton(){
   const btnArea=document.getElementById('transferBtn');
   if(!btnArea)return;
   let btn=document.getElementById('conferTableBtnV59');
   if(!btn){
     btn=document.createElement('button');btn.id='conferTableBtnV59';btn.type='button';btn.className='btn';btn.textContent='🧾 CONFERIR CONTA';
     btn.onclick=checkTableBill;
     btnArea.insertAdjacentElement('afterend',btn);
   }
   btn.style.display=current==='counter'?'none':'inline-block';
 }
 Object.assign(window,{
   cancelOrderPreviewV59:dismissOrder,printOrderPreviewV59:printOrder,confirmOrderPreviewV59:confirmOrder,
   cancelBillPreviewV59:dismissBill,printBillPreviewV59:printBill,continueBillPreviewV59:continueBill,
   checkTableBillV59:checkTableBill,previewCashBillV59:previewCashBill
 });
 sendOrder=showOrderPreview;
 paymentModal=function(name){
   const id=name==='Balcão'?'counter':Number(String(name).replace(/\D/g,''));
   if(id==='counter')return openBillPreview({type:'counter'},()=>paymentEntry(name));
   return openBillPreview({type:'table',id},()=>paymentEntry(name));
 };
 if(typeof individualPayment==='function'){
   window.payClientBill=function(tableId,id){
     return openBillPreview({type:'table',id:Number(tableId),customerId:String(id)},()=>individualPayment(tableId,id));
   };
 }
 if(typeof wholePayment==='function'){
   window.payWholeBill=function(tableId){
     return openBillPreview({type:'table',id:Number(tableId),customerId:null},()=>wholePayment(tableId));
   };
 }
 renderCart=function(){beforeRenderCart();mountTableButton();};
 renderCash=function(){beforeRenderCash();renderCashPreviewButtons();};
})();
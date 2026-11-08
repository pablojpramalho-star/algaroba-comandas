(function installStockAuditV61(){
 const originalRenderCart=renderCart;
 const originalRenderInventory=renderInventory;
 const categoryNames=()=>Object.keys(catalog||{});
 const normalizeQty=x=>Number(x||0);
 const stockDetails=()=>state.inventory?.items||{};
 function addRequirement(map,key,qty,label){
   if(!key||!Number.isFinite(qty)||qty<=0)return;
   if(!map.has(key))map.set(key,{key,qty:0,labels:new Set()});
   let req=map.get(key);req.qty+=qty;if(label)req.labels.add(label);
 }
 function shakeSize(str){
   const hit=String(str||'').match(/\b(?:Shake\s*)?(300|500)\s*ml\b/i);
   return hit?Number(hit[1]):0;
 }
 function isDrinkWithFlavor(name){
   return /^Shake\s+(300|500)\s*ml(?:\s*•|$)/i.test(String(name||''));
 }
 function getShakeRequirements(source,qty,map,label){
   const size=shakeSize(source?.name||source);
   const item=typeof source==='string'?{name:source}:source;
   const stock=resolveShakeFlavorStock(item);
   if(!size||!stock){
     return {issue:'Sabor de shake não identificado no pedido: '+String(item.name||source)+'. Selecione o sabor novamente na comanda.'};
   }
   ensureShakeStockUnit(stock);
   const cfg=shakeCostConfig();
   addRequirement(map,stock.key,qty*Number(size===300?cfg.grams300:cfg.grams500),label+' • Sabor '+stock.key);
   addRequirement(map,'Leite em Pó',qty*Number(size===300?cfg.milk300:cfg.milk500),label+' • Leite em pó');
   return null;
 }
 function buildCartRequirements(items){
   ensureInventory();
   ensureShakeFlavorInventory();
   ensureShakeMilkInventory();
   const map=new Map(),issues=[];
   for(const item of items||[]){
     const qty=normalizeQty(item?.qty);
     if(qty<=0||!Number.isFinite(qty)){issues.push('Quantidade inválida no pedido: '+String(item?.name||'produto'));continue;}
     let name=String(item.name||'');
     if(isDrinkWithFlavor(name)){
       let problem=getShakeRequirements(item,qty,map,name);
       if(problem)issues.push(problem.issue);
       continue;
     }
     if(/^Suco\s+400\s*ml/i.test(name))addRequirement(map,'Açúcar',50*qty,name+' • Açúcar');
     // Preserva a receita de goma já cadastrada no sistema anterior.
     if(/^Tapioca\s*\(base\)/i.test(name))addRequirement(map,'Goma de Tapioca',70*qty,name+' • Goma');
     const parts=Array.isArray(item.stockComponents)?item.stockComponents:[stockKey(name)];
     for(const raw of parts){
       const key=String(raw||'').trim();
       if(/^Shake\s+(?:300|500)\s*ml\s*•/i.test(key)){
         const problem=getShakeRequirements(key,qty,map,name);
         if(problem)issues.push(problem.issue);
         continue;
       }
       if(/^Shake\s+(?:300|500)\s*ml$/i.test(key)){
         issues.push('O shake do pedido "'+name+'" está sem sabor definido. Volte e escolha um sabor.');
         continue;
       }
       addRequirement(map,key,qty,name);
     }
   }
   return {requirements:[...map.values()].map(x=>({...x,labels:[...x.labels]})),issues};
 }
 function checkRequirements(items){
   const plan=buildCartRequirements(items);
   const inventory=stockDetails();
   const issues=plan.issues.map(message=>({key:'Seleção do pedido',message,required:0,available:0}));
   for(const r of plan.requirements){
     const it=inventory[r.key];
     if(!it){issues.push({...r,required:r.qty,available:0,message:'Produto sem cadastro de estoque: '+r.key+'. Verifique o vínculo no Estoque.'});continue}
     if(it.track===false)continue;
     const available=Number(it.qty||0);
     if(!Number.isFinite(available)||available+1e-8<r.qty){
       let suffix=it.stockUnit==='g'?' g':' un.';
       issues.push({...r,required:r.qty,available,message:r.key+' — precisa '+r.qty.toLocaleString('pt-BR',{maximumFractionDigits:2})+suffix+', disponível '+available.toLocaleString('pt-BR',{maximumFractionDigits:2})+suffix});
     }
   }
   return {plan,issues};
 }
 function auditStockCart(items){
   const data=checkRequirements(items);
   if(!data.issues.length)return '';
   let msgs=data.issues.slice(0,8).map(x=>'• '+x.message);
   if(data.issues.length>8)msgs.push('• ... e mais '+(data.issues.length-8)+' item(ns).');
   return 'Não foi possível enviar o pedido devido ao estoque cadastrado:\n\n'+msgs.join('\n')+'\n\nConfira o saldo na aba Estoque e o indicador de sincronização. Nenhum item foi enviado para produção.';
 }
 function auditCartUi(){
   let target=document.getElementById('total');
   if(!target)return;
   let el=document.getElementById('stockOrderAuditV61');
   if(!el){el=document.createElement('div');el.id='stockOrderAuditV61';target.insertAdjacentElement('beforebegin',el);}
   if(!cart||!cart.length){el.innerHTML='';el.style.display='none';return}
   el.style.display='block';
   const data=checkRequirements(cart),issues=data.issues;
   el.className='stock-order-audit '+(issues.length?'stock-order-issue':'stock-order-ok');
   el.innerHTML=issues.length
    ?'<b>⚠️ Conferência de estoque: '+issues.length+' pendência(s)</b><div class="stock-audit-note">'+issues.slice(0,3).map(x=>esc(x.message)).join('<br>')+'</div><button type="button" class="mini" onclick="showOrderStockPlanV61()">VER TODOS OS INGREDIENTES</button>'
    :'<b>✅ Estoque conferido para os itens do pedido</b><button type="button" class="mini" onclick="showOrderStockPlanV61()">VER DETALHES</button>';
 }
 function formatAmount(q,unit){
   return Number(q||0).toLocaleString('pt-BR',{maximumFractionDigits:2})+(unit==='g'?' g':' un.');
 }
 function showOrderStockPlan(){
   const {plan,issues}=checkRequirements(cart);
   const inv=stockDetails();
   const rows=plan.requirements.map(r=>{
     const x=inv[r.key]||{},stock=Number(x.qty||0),tracked=x.track!==false;
     const isShort=tracked&&stock+1e-8<r.qty;
     return `<div class="cart-row"><span><b>${esc(r.key)}</b><div class="muted">${esc(r.labels.slice(0,3).join(' / '))}</div></span><span style="text-align:right">${isShort?'⚠️ ':''}${formatAmount(r.qty,x.stockUnit)} necessários<div class="muted">${tracked?'Disponível: '+formatAmount(stock,x.stockUnit):'Controle desativado'}</div></span></div>`;
   }).join('');
   document.getElementById('modalContent').innerHTML=`<h2>📦 Conferência de estoque do pedido</h2><div class="muted">A soma abaixo considera itens repetidos, combos e ingredientes dos shakes.</div><div class="panel">${rows||'Nenhum componente registrado.'}</div>${issues.length?'<div class="panel"><b>⚠️ Pendências</b>'+issues.map(i=>'<p>'+esc(i.message)+'</p>').join('')+'</div>':'<div class="panel">✅ O saldo cadastrado atende à quantidade necessária.</div>'}<div class="sheet-actions"><button class="btn primary" onclick="closeModal()">VOLTAR À COMANDA</button></div>`;
   document.getElementById('modal').classList.remove('hide');
 }
 function auditCatalogUi(){
   ensureInventory();ensureShakeFlavorInventory();
   let all=inventoryCatalog();
   let source=stockDetails();
   const keys=new Set(all.map(x=>x.key));
   // Produtos com estoque, mas sem associação ao catálogo atual, são exibidos separadamente.
   let unlinked=Object.entries(source).filter(([key,x])=>!keys.has(key)&&Number(x.qty||0)>0&&
      x.cat!=='Shakes'&&!['Insumos','Descartáveis','Cafés'].includes(x.cat||x.category));
   const count=all.length;
   const rows=all.map(p=>{
     const x=source[p.key]||{};
     const q=Number(x.qty||0),tracked=x.track!==false;
     return {key:p.key,cat:p.cat||'Outros',qty:q,unit:x.stockUnit||'un',tracked};
   });
   const byCat={};for(const row of rows)(byCat[row.cat]=byCat[row.cat]||[]).push(row);
   const html=Object.entries(byCat).map(([cat,products])=>`<details class="panel"><summary><b>${esc(cat)}</b> • ${products.length} produtos</summary>${products.map(p=>`<div class="cart-row"><span>${esc(p.key)}</span><span>${p.tracked?formatAmount(p.qty,p.unit):'Sem controle'} ${p.qty<=0&&p.tracked?'⚠️':''}</span></div>`).join('')}</details>`).join('');
   document.getElementById('modalContent').innerHTML=`<h2>🔎 Auditoria Estoque × Cardápio</h2><div class="muted">${count} registros de produtos/variantes vinculados à comanda. A conferência mostra o saldo cadastrado neste aparelho, não necessariamente o saldo físico.</div>${html}${unlinked.length?'<div class="panel"><b>⚠️ Saldo em cadastro fora do cardápio atual</b>'+unlinked.slice(0,30).map(([k,x])=>`<div class="cart-row"><span>${esc(k)}</span><b>${formatAmount(x.qty,x.stockUnit)}</b></div>`).join('')+'</div>':''}<div class="sheet-actions"><button class="btn primary" onclick="closeModal()">FECHAR AUDITORIA</button></div>`;
   document.getElementById('modal').classList.remove('hide');
 }
 function addInventoryAuditButton(){
   const list=document.getElementById('inventoryList');if(!list)return;
   if(list.querySelector('#auditStockCatalogBtnV61'))return;
   const btn=document.createElement('button');btn.type='button';btn.id='auditStockCatalogBtnV61';btn.className='btn primary';btn.style.width='100%';btn.style.marginBottom='12px';btn.textContent='🔎 AUDITAR VÍNCULOS ENTRE ESTOQUE E CARDÁPIO';
   btn.addEventListener('click',auditCatalogUi);
   list.insertAdjacentElement('afterbegin',btn);
 }
 window.auditStockCart=auditStockCart;
 window.showOrderStockPlanV61=showOrderStockPlan;
 window.auditCatalogStockV61=auditCatalogUi;
 renderCart=function(){originalRenderCart();auditCartUi();}
 renderInventory=function(){originalRenderInventory();addInventoryAuditButton();}
})();
(function installBeerNamesV66(){
 const aliases={
  'Brahma litrinho':'Litrinho Brahma',
  'Skol litrinho':'Litrinho Skol',
  'Original litrinho':'Litrinho Original'
 };
 const beerNames=Object.entries(aliases);
 const rename=key=>{
  const text=String(key||'');
  for(const [oldName,newName] of beerNames){
   if(text===oldName)return newName;
   if(text.startsWith(oldName+' •'))return newName+text.slice(oldName.length);
  }
  return text;
 };
 function localPersist(){
   try{localStorage.setItem('algarobaState',JSON.stringify(state))}
   catch(e){console.error('Estoque cervejas: erro ao salvar no aparelho',e)}
   if(cloudReady&&!cloudApplying){
     cloudPausePullUntil=Date.now()+6000;
     scheduleCloudSave();
   }
 }
 let running=false;
 function renameLedger(oldName,newName){
   let total=0;
   for(const movement of state.inventory?.movements||[]){
     if(movement.key===oldName){
       movement.originalStockKey=movement.originalStockKey||oldName;
       movement.key=newName;
       total++;
     }
   }
   return total;
 }
 function migrateBeerStocks(){
   if(running)return false;
   const inv=state?.inventory,items=inv?.items;
   if(!items)return false;
   let changed=false;
   running=true;
   try{
     for(const [oldName,newName] of beerNames){
       const legacy=items[oldName];
       if(!legacy)continue;
       const existing=items[newName];
       const oldQty=Number(legacy.qty||0),newQty=Number(existing?.qty||0);
       if(!Number.isFinite(oldQty)||!Number.isFinite(newQty))continue;
       // Dois saldos positivos: NÃO somar automaticamente, pois podem
       // representar o mesmo estoque lançado duas vezes.
       if(oldQty>0&&newQty>0)continue;
       if(!existing||newQty===0){
         items[newName]={
           ...(legacy||{}),
           ...(existing||{}),
           qty:oldQty,
           cost:Number(existing?.cost||0)>0?existing.cost:legacy.cost,
           min:Number(existing?.min||0)>0?existing.min:legacy.min,
           stockUnit:existing?.stockUnit||legacy.stockUnit||'un',
           track:existing?.track===false?false:legacy.track!==false,
           category:'Bebidas',
           cat:'Bebidas'
         };
       }else if(newQty>0&&oldQty===0){
         // Preserva o saldo novo; descarta somente o registro antigo vazio.
         if(Number(items[newName]?.cost||0)===0&&Number(legacy.cost||0)>0)items[newName].cost=legacy.cost;
       }
       delete items[oldName];
       renameLedger(oldName,newName);
       changed=true;
     }
   }finally{running=false}
   if(changed)localPersist();
   return changed;
 }
 // O código da comanda pode recriar a lista de estoque durante o uso.
 const originalEnsure=ensureInventory;
 ensureInventory=function(){
   originalEnsure();
   migrateBeerStocks();
 };
 // A sincronização online substitui os objetos em memória a cada leitura;
 // migra novamente os nomes do banco e grava a atualização quando necessário.
 const originalApply=applyRows;
 applyRows=function(rows){
   const result=originalApply(rows);
   if(result){
     originalEnsure();
     const wasMigrated=migrateBeerStocks();
     if(wasMigrated&&cloudReady){
       cloudPausePullUntil=Date.now()+6000;
       scheduleCloudSave();
     }
   }
   return result;
 };
 // Comandas antigas podem carregar itens/combos com stockComponents legados.
 function normalizedItem(item){
   if(!item)return item;
   const comps=Array.isArray(item.stockComponents)?item.stockComponents.map(rename):undefined;
   return comps?{...item,stockComponents:comps}:item;
 }
 const oldStockKey=stockKey;
 stockKey=function(value){return rename(oldStockKey(value))};
 const originalConsume=inventoryConsume;
 inventoryConsume=function(item,reason){return originalConsume(normalizedItem(item),reason)};
 const originalReturn=inventoryReturn;
 inventoryReturn=function(item,reason){return originalReturn(normalizedItem(item),reason)};
 const oldAudit=window.auditStockCart;
 if(typeof oldAudit==='function'){
   window.auditStockCart=function(items){return oldAudit((items||[]).map(normalizedItem))};
 }
 // O relatório e o painel de produção continuam reconhecendo vendas antigas.
 const oldReportCategory=reportCategory;
 reportCategory=function(name){return oldReportCategory(rename(name))};
 const oldStation=stationOf;
 stationOf=function(name){return oldStation(rename(name))};
 // Se dois saldos já existirem, oferecemos reconciliação EXPLÍCITA.
 window.transferOldBeerStockV66=async function(oldName){
   const newName=aliases[oldName];if(!newName)return;
   ensureInventory();
   const old=state.inventory.items[oldName],current=state.inventory.items[newName];
   if(!old||!current)return alert('Não há saldos duplicados para conferir.');
   const oldQty=Number(old.qty||0),newQty=Number(current.qty||0);
   if(!Number.isInteger(oldQty)||oldQty<=0)return alert('Nenhum saldo antigo disponível.');
   const response=prompt(
     'CONFERÊNCIA DE ESTOQUE — '+newName+
     '\n\nCadastro antigo: '+oldName+' ('+oldQty+' un.)'+
     '\nCadastro novo: '+newName+' ('+newQty+' un.)'+
     '\n\nQuantas unidades do cadastro antigo são adicionais ao estoque novo e devem ser transferidas?'+
     '\n\nConfira fisicamente para evitar duplicação.'
   );
   if(response===null)return;
   const move=Number(String(response).trim().replace(',','.'));
   if(!Number.isInteger(move)||move<=0||move>oldQty)return alert('Informe uma quantidade inteira entre 1 e '+oldQty+'.');
   if(!confirm('Transferir '+move+' unidade(s) do cadastro antigo para '+newName+'?\n\nO histórico de movimentação será preservado.'))return;
   const beforeOld=oldQty,beforeNew=newQty;
   old.qty=oldQty-move;current.qty=newQty+move;
   const reason='Conciliação de nomenclatura: '+oldName+' → '+newName;
   addInvMovement('ajuste',oldName,-move,reason,beforeOld,old.qty,inventoryCostPerStockUnit(old));
   addInvMovement('ajuste',newName,move,reason,beforeNew,current.qty,inventoryCostPerStockUnit(current));
   if(old.qty===0){
     renameLedger(oldName,newName);
     delete state.inventory.items[oldName];
   }
   localPersist();
   renderInventory();
   try{
     const result=await saveInventoryNow();
     alert('Estoque conferido: '+newName+' = '+Number(current.qty||0)+' un.\n'+
       (result?.synced===false?'⚠️ Salvo somente neste aparelho.':'Confira o indicador ONLINE para confirmar a sincronização.'));
   }catch(e){
     alert('Alteração salva neste aparelho, mas falhou a sincronização. Confira a conexão antes de repetir.');
   }
 };
 const priorRender=renderInventory;
 renderInventory=function(){
   priorRender();
   if(inventoryViewCategory!=='Bebidas')return;
   const list=document.getElementById('inventoryList');if(!list)return;
   const pending=beerNames.map(([oldName,newName])=>({
     oldName,newName,
     legacy:Number(state.inventory?.items?.[oldName]?.qty||0),
     fresh:Number(state.inventory?.items?.[newName]?.qty||0)
   })).filter(x=>x.legacy>0);
   if(!pending.length)return;
   const banner=document.createElement('div');banner.className='panel';
   banner.style.border='1px solid #bc8744';
   banner.innerHTML='<b>🍺 Conferência de nomes antigos de cervejas</b>'+
     '<p class="muted">Há saldo simultâneo no cadastro antigo e no novo. Não some automaticamente: verifique as unidades físicas antes de transferir.</p>'+
     pending.map(p=>'<div class="cart-row"><span><b>'+esc(p.oldName)+'</b><div class="muted">Antigo: '+p.legacy+' un. • Novo: '+p.fresh+' un.</div></span><button class="btn" onclick="transferOldBeerStockV66('+JSON.stringify(p.oldName).replaceAll('"','&quot;')+')">CONFERIR</button></div>').join('');
   list.insertAdjacentElement('afterbegin',banner);
 };
 // Executa a migração local somente depois que a versão de catálogo nova
 // e os métodos de salvamento já estão carregados.
 ensureInventory();
})();
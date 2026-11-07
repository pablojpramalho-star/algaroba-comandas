(function installCoalhoStockFixV60(){
 const previousCatalog=inventoryCatalog;
 const previousRender=renderInventory;
 const previousSave=saveInventoryNow;
 inventoryCatalog=function(){
   const rows=previousCatalog().map(p=>p.key==='Queijo Coalho'&&p.cat==='Espetinhos'?{...p,key:'Espetinho Queijo Coalho',cat:'Espetinhos'}:p);
   const base=(catalog.Bases||[]).find(x=>x[0]==='Queijo Coalho');
   if(!rows.some(p=>p.key==='Queijo Coalho'))rows.push({key:'Queijo Coalho',cat:'Bases',price:Number(base?.[1]??4)});
   return rows;
 };
 // Local-only operations must not be reported as synchronized to the cloud.
 saveInventoryNow=async function(){
   if(!cloudReady){
     localStorage.setItem('algarobaState',JSON.stringify(state));
     setSyncStatus('offline','ESTOQUE LOCAL — SEM SINCRONIZAÇÃO');
     return {synced:false};
   }
   await previousSave();
   return {synced:true};
 };
 // Explicit recovery of old wrong-key movements; no automatic transfer or guessing.
 async function transferLegacyCoalho(){
   ensureInventory();
   const base=state.inventory.items['Queijo Coalho'];
   const skewer=state.inventory.items['Espetinho Queijo Coalho'];
   const available=Number(base?.qty||0);
   if(available<=0)return alert('Não há saldo no Queijo Coalho das Bases para transferir. Use o botão + do Espetinho Queijo Coalho para uma nova entrada.');
   let promptText='CONFERÊNCIA DE ESTOQUE\\n\\nQUEIJO COALHO EM BASES: '+available+' un.\\nESPETINHO QUEIJO COALHO: '+Number(skewer.qty||0)+' un.\\n\\nQuantas unidades foram lançadas em Bases e realmente pertencem ao estoque dos espetos?\\n\\nTransfira apenas o que foi conferido fisicamente.';
   const raw=prompt(promptText);
   if(raw===null)return;
   const amount=Number(String(raw).trim().replace(',','.'));
   if(!Number.isInteger(amount)||amount<=0||amount>available)return alert('Informe uma quantidade inteira entre 1 e '+available+'.');
   if(!confirm('Transferir '+amount+' unidade(s) do Queijo Coalho das Bases para Espetinho Queijo Coalho?\\n\\nA ação será registrada no histórico de movimentações.'))return;
   const b0=Number(base.qty||0),s0=Number(skewer.qty||0);
   base.qty=b0-amount;skewer.qty=s0+amount;
   const reason='Correção de cadastro: saldo lançado nas Bases pertencia ao Espetinho Queijo Coalho';
   addInvMovement('ajuste','Queijo Coalho',-amount,reason,b0,base.qty,inventoryCostPerStockUnit(base));
   addInvMovement('ajuste','Espetinho Queijo Coalho',amount,reason,s0,skewer.qty,inventoryCostPerStockUnit(skewer));
   renderInventory();
   try{
     const result=await saveInventoryNow();
     renderInventory();
     alert('Transferência concluída.\\nBases: '+base.qty+' un.\\nEspetinhos: '+skewer.qty+' un.\\n'+(result?.synced?'☁️ Sincronizado com o servidor.':'⚠️ Salvo somente neste aparelho: sem sincronização online.'));
   }catch(err){alert('Saldo transferido neste aparelho, mas a sincronização falhou. Não repita a transferência antes de verificar a conexão.');}
 }
 window.transferLegacyCoalho=transferLegacyCoalho;
 renderInventory=function(){
   previousRender();
   if(inventoryViewCategory!=='Espetos')return;
   const list=document.getElementById('inventoryList');if(!list)return;
   const from=Number(state.inventory?.items?.['Queijo Coalho']?.qty||0);
   const to=Number(state.inventory?.items?.['Espetinho Queijo Coalho']?.qty||0);
   const banner=document.createElement('div');banner.className='panel';
   banner.style.border='1px solid #5c9b6a';
   banner.innerHTML='<b>🧀 Dois estoques de queijo coalho</b><div class="muted">Espetinho Queijo Coalho (churrasqueira) e Queijo Coalho (Bases/recheios) são produtos separados.</div><p>🍢 Espetos: <b>'+to+' un.</b> &nbsp; 🥣 Bases: <b>'+from+' un.</b></p>'+(from>0?'<button class="btn primary" type="button" onclick="transferLegacyCoalho()">⇄ TRANSFERIR SALDO ANTIGO CONFERIDO</button>':'');
   list.insertAdjacentElement('afterbegin',banner);
 };
})();
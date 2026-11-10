/* Algaroba Shakes Grills — Cardápio v2.9.7.63
 * Cachaças e Destilados dentro de Bebidas; caldos/sopas em porções de 300 ml.
 * Não converte automaticamente o estoque legado de recipientes de 500 ml. */
(function(){
 const menu=catalog;
 const broths=menu['Caldos/Sopas']||[];
 const transitions=[
   ['Sopa de Costela 500 ml','Sopa de Costela 300 ml'],
   ['Caldo da Casa 500 ml','Caldo da Casa 300 ml']
 ];
 for(const [oldName,newName] of transitions){
   const item=broths.find(p=>p[0]===oldName);
   if(item)item[0]=newName;
 }
 const drinks=menu.Bebidas||[];
 let ypioca=drinks.find(p=>p[0]==='Ypióca Lata');
 if(!ypioca)drinks.push(['Ypióca Lata',20]);
 else ypioca[1]=20;
 let selectedGroup='Todas';
 const sections=['Refrigerantes','Cervejas','Águas','Cafés','Sucos','Cachaças e Destilados','Outras bebidas'];
 function drinkGroup(name){
   const n=String(name||'');
   if(/^(?:Ypióca|Ipioca|Cachaça|Pit[uú]|Vodka|Whisk(?:y|e)y|Gin\b|Rum\b|Tequila|Conhaque|Licor)/i.test(n))return 'Cachaças e Destilados';
   if(/^(?:KS\s*290\s*ml|Refrigerante\s*1\s*L|Refrigerante\b)/i.test(n))return 'Refrigerantes';
   if(/(?:litrinho|long neck|cerveja)/i.test(n))return 'Cervejas';
   if(/^Água\b/i.test(n))return 'Águas';
   if(/^Café\b/i.test(n))return 'Cafés';
   if(/^Suco\b/i.test(n))return 'Sucos';
   return 'Outras bebidas';
 }
 const baseShowCat=showCat;
 showCat=function(c,button){
   if(c!=='Bebidas')return baseShowCat(c,button);
   baseShowCat(c,button);
   const area=document.getElementById('products');
   if(!area)return;
   const products=[...area.children].slice(0,drinks.length);
   const nav=document.createElement('div');
   nav.className='skewer-category-tabs beverage-tabs';
   const available=sections.filter(group=>group==='Cachaças e Destilados'||drinks.some(p=>drinkGroup(p[0])===group));
   const control=[];
   function draw(){
     area.innerHTML='';
     area.appendChild(nav);
     sections.forEach(group=>{
       if(selectedGroup!=='Todas'&&selectedGroup!==group)return;
       const matches=drinks.map((p,i)=>({p,node:products[i]})).filter(x=>drinkGroup(x.p[0])===group);
       if(!matches.length)return;
       const title=document.createElement('div');
       title.className='beverage-group-head';
       title.textContent=(group==='Cachaças e Destilados'?'🥃 ':'🥤 ')+group.toUpperCase();
       area.appendChild(title);
       matches.forEach(x=>{if(x.node)area.appendChild(x.node)});
     });
     for(const o of control)o.node.classList.toggle('active',o.group===selectedGroup);
   }
   for(const group of ['Todas',...available]){
     const node=document.createElement('button');
     node.type='button';
     node.className='skewer-category-chip beverage-chip';
     node.textContent=group==='Todas'?'Todas as bebidas':group;
     node.addEventListener('click',()=>{selectedGroup=group;draw()});
     nav.appendChild(node);control.push({node,group});
   }
   draw();
 };
 const originalReportCategory=reportCategory;
 reportCategory=function(name){
   if(/^(?:Sopa de Costela|Caldo da Casa)\s+500\s*ml(?:\s*•|$)/i.test(String(name||'')))return 'Caldos/Sopas';
   return originalReportCategory(name);
 };
 const originalRenderInventory=renderInventory;
 renderInventory=function(){
   originalRenderInventory();
   if(inventoryViewCategory!=='Porções / Caldos')return;
   const area=document.getElementById('inventoryList');
   if(!area||area.querySelector('#legacyBroth500Notice'))return;
   const legacy=transitions.map(([key,newKey])=>({key,newKey,qty:Number(state.inventory?.items?.[key]?.qty||0)})).filter(x=>x.qty>0);
   if(!legacy.length)return;
   const note=document.createElement('div');
   note.id='legacyBroth500Notice';note.className='panel';
   note.style.border='1px solid #c78f3b';
   note.innerHTML='<b>⚠️ Estoque antigo de 500 ml preservado</b><p class="muted">O cardápio vende agora porções de 300 ml. Não houve conversão automática: faça a contagem física das porções de 300 ml e cadastre a quantidade pelo botão ⚖️. O saldo antigo permanece no histórico, sem ser apagado.</p>'+
     legacy.map(x=>'<div><b>'+esc(x.key)+'</b>: '+x.qty.toLocaleString('pt-BR')+' unidade(s) anteriores</div>').join('');
   area.insertAdjacentElement('afterbegin',note);
 };
})();

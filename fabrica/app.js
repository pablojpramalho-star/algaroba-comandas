const SUPABASE_URL="https://zqyehddgyiqtbynnoecz.supabase.co";
const PUBLISHABLE_KEY="sb_publishable_WERTeRIu5m88f89HfjSdWg_AlI91sb5";

const $=s=>document.querySelector(s);
const main=$("#main"),toastEl=$("#toast"),clientNav=$("#clientNav"),accountLabel=$("#accountLabel"),cartCount=$("#cartCount");
const brl=v=>new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(Number(v||0));
const esc=v=>String(v??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));
const fmtDate=v=>v?new Date(v+"T12:00:00").toLocaleDateString("pt-BR"):"";
const fmtDateTime=v=>v?new Date(v).toLocaleString("pt-BR"):"";
const fmtTime=v=>v?String(v).slice(0,5):"";
const localDateISO=()=>{const d=new Date(),y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,"0"),day=String(d.getDate()).padStart(2,"0");return `${y}-${m}-${day}`};

const state={
  session:JSON.parse(localStorage.getItem("algaroba_session")||"null"),
  role:null,profile:null,catalog:[],groups:[],selectedGroup:null,search:"",groupInfoOpen:false,
  cart:JSON.parse(localStorage.getItem("algaroba_cart")||"{}"),
  deliveryOptions:[],selectedDelivery:null,lastOrder:null,returnView:null
};

function showToast(message){
  toastEl.textContent=message;toastEl.style.display="block";
  clearTimeout(showToast.timer);showToast.timer=setTimeout(()=>toastEl.style.display="none",2800);
}
function loading(label="Carregando..."){main.innerHTML='<div class="loading"><span class="spinner"></span><span>'+esc(label)+'</span></div>'}
function saveCart(){
  localStorage.setItem("algaroba_cart",JSON.stringify(state.cart));
  cartCount.textContent=Object.values(state.cart).reduce((a,b)=>a+Number(b||0),0);
}
function authHeaders(){
  const h={"apikey":PUBLISHABLE_KEY};
  if(state.session?.access_token)h["Authorization"]="Bearer "+state.session.access_token;
  return h;
}
async function refreshSession(){
  if(!state.session?.refresh_token)return false;
  const r=await fetch(SUPABASE_URL+"/auth/v1/token?grant_type=refresh_token",{method:"POST",headers:{"apikey":PUBLISHABLE_KEY,"Content-Type":"application/json"},body:JSON.stringify({refresh_token:state.session.refresh_token})});
  if(!r.ok)return false;
  state.session=await r.json();localStorage.setItem("algaroba_session",JSON.stringify(state.session));return true;
}
async function request(path,{method="GET",body,headers={},retry=true}={}){
  const h={...authHeaders(),...headers};let payload=body;
  if(body!==undefined && !(body instanceof FormData)){h["Content-Type"]="application/json";payload=JSON.stringify(body)}
  let r=await fetch(SUPABASE_URL+path,{method,headers:h,body:payload});
  if(r.status===401&&retry&&state.session&&await refreshSession())return request(path,{method,body,headers,retry:false});
  const text=await r.text();let data=null;try{data=text?JSON.parse(text):null}catch{data=text}
  if(!r.ok)throw new Error(data?.message||data?.error_description||data?.hint||data?.details||text||"Falha na operação.");
  return data;
}
const rpc=(name,params={},auth=true)=>request("/rest/v1/rpc/"+name,{method:"POST",body:params,headers:auth?{}:{"Authorization":PUBLISHABLE_KEY}});
async function table(path){return request("/rest/v1/"+path)}

function categoryKey(p){return p.linha||p.categoria||"Outros"}
function groupIcon(key){
  return ({tradicional:"🥤",classic:"🍓",intense:"🍫","graos-farinaceos":"🥜","xaropes-coberturas":"🍯"})[key]||"▦";
}
function groupProducts(group){
  if(!group)return[];
  if(group.chave==="tradicional")return state.catalog.filter(p=>["Tradicional","Zero","Raiz"].includes(p.linha));
  if(group.chave==="classic")return state.catalog.filter(p=>p.linha==="Classic");
  if(group.chave==="intense")return state.catalog.filter(p=>p.linha==="Intense");
  if(group.chave==="graos-farinaceos")return state.catalog.filter(p=>p.categoria==="Grãos e Farináceos");
  if(group.chave==="xaropes-coberturas")return state.catalog.filter(p=>["Xaropes","Coberturas"].includes(p.categoria));
  const values=String(group.filtro_valor||"").split("|");
  if(group.tipo_filtro==="linha")return state.catalog.filter(p=>p.linha===group.filtro_valor);
  if(group.tipo_filtro==="linhas")return state.catalog.filter(p=>values.includes(p.linha));
  if(group.tipo_filtro==="categorias")return state.catalog.filter(p=>values.includes(p.categoria));
  return state.catalog.filter(p=>p.categoria===group.filtro_valor);
}
function displayProductName(p,group){
  if(group?.tipo_filtro==="linha"){
    if(p.sabor)return p.sabor;
    return String(p.produto||"")
      .replace(/^Classic\s+/i,"")
      .replace(/^Intense\s+/i,"")
      .replace(/^Tradicional\s+/i,"");
  }
  return p.produto;
}
function productIcon(p){
  const c=(p.categoria||"").toLowerCase(),n=(p.produto||"").toLowerCase(),l=(p.linha||"").toLowerCase();
  if(c.includes("xarope"))return "🍯"; if(c.includes("cobertura"))return "🍓"; if(c.includes("grão"))return "🥜";
  if(n.includes("lácteo"))return "🥛"; if(l.includes("zero"))return "🌿"; if(l.includes("intense"))return "🍫"; return "🥤";
}
function measure(p){
  if(p.volume_litros)return Number(p.volume_litros).toLocaleString("pt-BR",{maximumFractionDigits:2})+" L"+(p.peso_kg?" • "+Number(p.peso_kg).toLocaleString("pt-BR",{maximumFractionDigits:2})+" kg":"");
  if(p.peso_volume)return Number(p.peso_volume).toLocaleString("pt-BR",{maximumFractionDigits:3})+" "+esc(p.unidade||"");
  return "";
}
function cartItems(){return Object.entries(state.cart).map(([id,q])=>({p:state.catalog.find(x=>x.produto_id===id),q:Number(q)})).filter(x=>x.p&&x.q>0)}
function cartUnits(){return cartItems().reduce((a,x)=>a+x.q,0)}
function effectivePrice(p,modalidade=null){
  const units=cartUnits();
  return Number(modalidade==="retirada_fabrica"||units>=6?p.preco_atacado:p.preco_varejo);
}
function statusClass(v){
  if(["pago","pagamento_confirmado","entregue","pronto","aprovado"].includes(v))return "ok";
  if(["cancelado","devolvido","rejeitado","atrasado"].includes(v))return "bad";
  return "warn";
}
function nav(view){
  document.querySelectorAll("[data-nav]").forEach(b=>b.classList.toggle("active",b.dataset.nav===view));
}
function setClientNavigation(){
  const internal=state.session&&state.role&&state.role!=="cliente";
  clientNav.classList.toggle("hidden",internal);
  accountLabel.textContent=state.session?(state.role==="cliente"?(state.profile?.nome?.split(" ")[0]||"Conta"):"Painel"):"Entrar";
}
async function loadCatalog(){
  try{
    const [catalog,groups]=await Promise.all([
      rpc(state.session&&state.role==="cliente"?"catalogo_cliente":"catalogo_publico",{},!!state.session&&state.role==="cliente"),
      rpc("catalogo_grupos",{},false)
    ]);
    state.catalog=catalog||[];
    state.groups=groups||[];
  }catch(e){
    console.error(e);state.catalog=[];state.groups=[];showToast("Não foi possível carregar o catálogo.");
  }
}
async function loadIdentity(){
  if(!state.session){state.role=null;state.profile=null;return}
  try{
    state.role=await rpc("current_user_role",{},true);
    if(state.role==="cliente"){
      const p=await rpc("meu_perfil_cliente",{},true);state.profile=Array.isArray(p)?p[0]:p;
    }
  }catch(e){console.error(e);state.role=null;state.profile=null}
}
async function boot(){
  saveCart();
  window.addEventListener("online",()=>$("#offlineBanner").classList.add("hidden"));
  window.addEventListener("offline",()=>$("#offlineBanner").classList.remove("hidden"));
  if(!navigator.onLine)$("#offlineBanner").classList.remove("hidden");
  if(state.session)await loadIdentity();
  await loadCatalog();setClientNavigation();go(state.role&&state.role!=="cliente"?"internal":"home");
}
async function go(view){
  window.scrollTo({top:0,behavior:"smooth"});
  if(state.session&&state.role&&state.role!=="cliente"&&view!=="login"&&view!=="internal")view="internal";
  nav(view);
  if(view==="home")renderHome();
  else if(view==="catalog")renderCatalog();
  else if(view==="cart")renderCart();
  else if(view==="delivery")renderDelivery();
  else if(view==="review")renderReview();
  else if(view==="success")renderSuccess();
  else if(view==="orders")await renderOrders();
  else if(view==="account")await renderAccount();
  else if(view==="login")renderLogin();
  else if(view==="internal")await renderInternal();
}
document.addEventListener("click",e=>{
  const b=e.target.closest("[data-go]");
  if(b){
    e.preventDefault();
    if(b.dataset.go==="catalog"){state.selectedGroup=null;state.search="";state.groupInfoOpen=false}
    go(b.dataset.go);
  }
});
$("#cartButton").addEventListener("click",()=>go("cart"));
$("#accountButton").addEventListener("click",()=>go(state.session&&state.role!=="cliente"?"internal":"account"));

function renderHome(){
  const groups=state.groups;
  main.innerHTML=`
  <section class="hero">
    <div class="eyebrow">Pedido direto da fábrica</div>
    <h1>Direto da nossa fábrica para você.</h1>
    <p>Escolha primeiro a linha ou categoria. Dentro dela você encontra os sabores e produtos disponíveis, sem misturar tudo em uma única lista.</p>
    <button class="button" onclick="window.openGroups()">Fazer meu pedido →</button>
  </section>
  <div class="section-head"><div><h2>Escolha uma linha</h2><p>Entre na categoria para ver os sabores.</p></div></div>
  <div class="catalog-groups">
    ${groups.map(g=>`<button class="group-card" type="button" onclick="window.chooseGroup('${g.chave}')">
      <div class="group-card-icon">${groupIcon(g.chave)}</div>
      <div class="group-card-copy"><strong>${esc(g.titulo)}</strong><span>${esc(g.subtitulo||"")}</span><small>${g.qtd_produtos} ${g.qtd_produtos===1?"opção":"opções"} →</small></div>
    </button>`).join("")}
  </div>
  <div class="section-head"><h2>Como funciona</h2></div>
  <div class="grid">
    <div class="info-card"><div class="big-icon">🧾</div><strong>Pedido até 11h</strong><div class="small">A manhã fica reservada para controle, produção, conferência e montagem da carga.</div></div>
    <div class="info-card"><div class="big-icon">🏭</div><strong>Produção sob encomenda</strong><div class="small">Os shakes são produzidos após o pedido.</div></div>
    <div class="info-card"><div class="big-icon">🚚</div><strong>Rotas à tarde</strong><div class="small">Saída padrão às 14h, podendo ser antecipada para 13h em rotas maiores. Sem horário exato de chegada.</div></div>
    <div class="info-card"><div class="big-icon">📦</div><strong>Retirada na fábrica</strong><div class="small">Preço de atacado em qualquer quantidade. Logística por conta do comprador.</div></div>
  </div>
  <div class="notice green" style="margin-top:14px"><b>Regra comercial:</b> nas entregas, pedidos com 6 ou mais unidades utilizam preço de atacado. Na retirada na fábrica, o atacado vale desde a primeira unidade.</div>`;
}
window.openGroups=()=>{state.selectedGroup=null;state.search="";state.groupInfoOpen=false;go("catalog")};
window.chooseGroup=key=>{state.selectedGroup=key;state.search="";state.groupInfoOpen=false;go("catalog")};
window.backToGroups=()=>{state.selectedGroup=null;state.search="";state.groupInfoOpen=false;renderCatalog()};
window.toggleGroupInfo=()=>{state.groupInfoOpen=!state.groupInfoOpen;renderCatalog()};

function renderGroupChooser(){
  main.innerHTML=`
    <div class="section-head"><div><h2>Fazer meu pedido</h2><p>Escolha uma linha ou categoria. Você pode voltar e misturar produtos no mesmo pedido.</p></div></div>
    <div class="catalog-groups">
      ${state.groups.map(g=>`<button class="group-card" type="button" onclick="window.chooseGroup('${g.chave}')">
        <div class="group-card-icon">${groupIcon(g.chave)}</div>
        <div class="group-card-copy"><strong>${esc(g.titulo)}</strong><span>${esc(g.subtitulo||"")}</span><small>${g.qtd_produtos} ${g.qtd_produtos===1?"opção":"opções"} →</small></div>
      </button>`).join("")}
    </div>
    ${cartItems().length?`<div class="catalog-bottom-actions"><button class="button orange" type="button" data-go="cart">Finalizar meu pedido →</button></div>`:""}
    ${miniCheckout()}
  `;
}

function miniCheckout(){
  const items=cartItems(),units=cartUnits();
  if(!items.length)return"";
  const total=items.reduce((s,x)=>s+x.q*effectivePrice(x.p),0);
  return `<div class="mini-checkout"><div><b>${units} ${units===1?"item":"itens"} no pedido</b><small>Total estimado ${brl(total)}</small></div><button class="button orange" type="button" data-go="cart">Ver pedido e finalizar →</button></div>`;
}

function renderProductCards(list,group){
  return list.map(p=>`<article class="product-card ${p.destaque?"featured":""}">
    <div class="product-visual">${p.imagem_url?`<img src="${esc(p.imagem_url)}" alt="${esc(displayProductName(p,group))}" loading="lazy" onerror="this.parentElement.innerHTML='${productIcon(p)}'">`:productIcon(p)}</div>
    <div class="product-meta">${group.tipo_filtro==="linha"?"Sabor":esc(p.categoria||group.titulo)}${measure(p)?" • "+measure(p):""}</div>
    <h3>${esc(displayProductName(p,group))}</h3>
    ${p.descricao_cliente?`<div class="product-description">${esc(p.descricao_cliente)}</div>`:""}
    <div class="stock-line"><span class="supply-badge ${p.modelo_fornecimento==="estoque"?"stock":"made"}">${p.modelo_fornecimento==="estoque"?"Estoque":"Produção sob encomenda"}</span>${p.destaque?'<span class="featured-badge">Destaque</span>':""}</div>
    <div class="prices"><span class="price">Atacado ${brl(p.preco_atacado)}</span><span class="price retail">Varejo ${brl(p.preco_varejo)}</span></div>
    ${p.disponibilidade_catalogo==="em_falta"?'<div class="soldout">Temporariamente em falta</div>':p.disponibilidade_catalogo==="sob_consulta"?'<div class="soldout">Disponibilidade sob consulta</div>':`<div class="qtybar"><button type="button" onclick="window.changeQty('${p.produto_id}',-1)">−</button><b id="qty-${p.produto_id}">${state.cart[p.produto_id]||0}</b><button type="button" onclick="window.changeQty('${p.produto_id}',1)">+</button><button class="add" type="button" onclick="window.changeQty('${p.produto_id}',1)">Adicionar</button></div>`}
  </article>`).join("");
}

function renderCatalog(){
  const group=state.groups.find(g=>g.chave===state.selectedGroup);
  if(!group){renderGroupChooser();return}

  const term=state.search.trim().toLocaleLowerCase("pt-BR");
  const groupList=groupProducts(group);
  const list=groupList.filter(p=>{
    const hay=[p.produto,p.sabor,p.codigo,p.categoria].filter(Boolean).join(" ").toLocaleLowerCase("pt-BR");
    return !term||hay.includes(term);
  });

  const combined=group.chave==="xaropes-coberturas";
  const content=combined
    ? ["Xaropes","Coberturas"].map(cat=>{
        const subset=list.filter(p=>p.categoria===cat);
        if(!subset.length)return"";
        return `<section class="catalog-subsection"><div class="catalog-result-head"><b>${esc(cat)}</b><span>${subset.length} opções</span></div><div class="products">${renderProductCards(subset,group)}</div></section>`;
      }).join("")
    : `<div class="catalog-result-head"><b>${group.chave==="tradicional"?"Opções":group.tipo_filtro==="linha"?"Sabores":"Produtos"}</b><span>${list.length} de ${groupList.length}</span></div><div class="products">${renderProductCards(list,group)}</div>`;

  main.innerHTML=`
    <div class="catalog-group-head">
      <button class="back-circle" type="button" onclick="window.backToGroups()" aria-label="Voltar às linhas">‹</button>
      <div class="group-head-icon">${groupIcon(group.chave)}</div>
      <div class="group-head-copy">
        <div class="eyebrow dark">Catálogo Algaroba</div>
        <h2>${esc(group.titulo)}</h2>
        <p>${esc(group.subtitulo||"")}</p>
      </div>
      <button class="help-circle" type="button" onclick="window.toggleGroupInfo()" aria-label="Saiba mais">?</button>
    </div>

    <div class="group-intro">
      <span>${group.tipo_filtro==="linha"?"Sobre esta linha":"Sobre este grupo"}</span>
      <p>${esc(group.descricao||"")}</p>
      <button type="button" onclick="window.toggleGroupInfo()">${state.groupInfoOpen?"Ocultar detalhes":"Saiba mais"} <b>?</b></button>
    </div>

    ${state.groupInfoOpen?`<div class="line-explainer">
      <div class="line-explainer-icon">${groupIcon(group.chave)}</div>
      <div><strong>${esc(group.titulo)}</strong><p>${esc(group.descricao||"")}</p>${["tradicional","classic","intense"].includes(group.chave)?'<small>Cada linha tem uma proposta diferente. Você pode voltar a qualquer momento e adicionar produtos de outra linha ao mesmo pedido.</small>':""}</div>
    </div>`:""}

    <div class="catalog-search"><span>🔎</span><input id="catalogSearch" type="search" placeholder="${group.tipo_filtro==="linha"?"Buscar sabor nesta linha...":"Buscar nesta categoria..."}" value="${esc(state.search)}" oninput="window.setSearch(this.value)"></div>

    ${content||'<div class="empty"><div class="empty-icon">🔎</div>Nenhum produto encontrado neste grupo.</div>'}

    <div class="catalog-bottom-actions">
      <button class="button ghost" type="button" onclick="window.backToGroups()">← Voltar às linhas</button>
      ${cartItems().length?'<button class="button orange" type="button" data-go="cart">Finalizar meu pedido →</button>':""}
    </div>
    ${miniCheckout()}
  `;
}
window.setSearch=v=>{state.search=v;renderCatalog();requestAnimationFrame(()=>{const e=$("#catalogSearch");if(e){e.focus();e.setSelectionRange(e.value.length,e.value.length)}})};
window.changeQty=(id,delta)=>{
  const n=Math.max(0,Number(state.cart[id]||0)+delta);if(n)state.cart[id]=n;else delete state.cart[id];saveCart();
  const e=$("#qty-"+id);if(e)e.textContent=state.cart[id]||0;
};

function renderCart(){
  const items=cartItems(),units=cartUnits(),atacado=units>=6,total=items.reduce((s,x)=>s+x.q*effectivePrice(x.p),0);
  main.innerHTML=`
    <div class="section-head"><div><h2>Meu pedido</h2><p>${units} unidades</p></div></div>
    ${items.length?`<div class="panel">
      ${items.map(x=>`<div class="row"><div><div class="row-title">${esc(x.p.produto)}</div><div class="row-sub">${esc(categoryKey(x.p))} • ${brl(effectivePrice(x.p))} por unidade</div><div class="qtybar" style="margin-top:8px"><button onclick="window.cartQty('${x.p.produto_id}',-1)">−</button><b>${x.q}</b><button onclick="window.cartQty('${x.p.produto_id}',1)">+</button></div></div><b>${brl(x.q*effectivePrice(x.p))}</b></div>`).join("")}
      <div class="summary"><div class="summary-line"><span>Regra estimada</span><b>${atacado?"Atacado":"Varejo"}</b></div><div class="summary-line total"><span>Total estimado</span><span>${brl(total)}</span></div></div>
    </div>
    <div class="notice" style="margin-top:12px">Se escolher <b>retirada na fábrica</b>, o sistema recalcula automaticamente todos os itens para preço de atacado, mesmo abaixo de 6 unidades.</div>
    <button class="button orange" style="width:100%;margin-top:13px" type="button" onclick="window.checkout()">Escolher entrega / retirada →</button>`:
    '<div class="empty"><div class="empty-icon">🛒</div>Seu carrinho está vazio.<br><br><button class="button" data-go="catalog">Escolher produtos</button></div>'}`;
}
window.cartQty=(id,d)=>{window.changeQty(id,d);renderCart()};
window.checkout=async()=>{
  if(!state.session||state.role!=="cliente"){state.returnView="delivery";showToast("Entre com seu cadastro para finalizar o pedido.");go("login");return}
  try{loading("Consultando opções de entrega...");state.deliveryOptions=await rpc("opcoes_entrega_cliente",{},true)||[];state.selectedDelivery=null;go("delivery")}
  catch(e){showToast(e.message);renderCart()}
};

function deliveryTitle(o){return o.modalidade==="retirada_fabrica"?"🏭 Retirada na fábrica":o.modalidade==="rota"?"🚚 "+(o.rota_nome||"Entrega por rota"):"📍 Entrega a combinar"}
function renderDelivery(){
  if(!state.deliveryOptions.length){main.innerHTML='<div class="empty"><div class="empty-icon">📍</div>Nenhuma opção de recebimento disponível.</div>';return}
  main.innerHTML=`
    <div class="section-head"><div><h2>Entrega ou retirada</h2><p>Escolha como deseja receber.</p></div></div>
    <div class="notice"><b>Importante:</b> pedidos até 11h. As rotas saem normalmente às 14h e podem sair às 13h nas rotas maiores. Não trabalhamos com horário exato de chegada.</div>
    <div style="margin-top:12px">
      ${state.deliveryOptions.map((o,i)=>`<div class="delivery-card ${state.selectedDelivery===i?"selected":""}" onclick="window.pickDelivery(${i})"><strong>${deliveryTitle(o)}</strong><small>${o.identificacao?esc(o.identificacao)+" • ":""}${o.bairro?esc(o.bairro)+", ":""}${esc(o.cidade||"")}${o.proxima_data?" • "+fmtDate(o.proxima_data):""}<br>${esc(o.observacao||"")}</small></div>`).join("")}
    </div>
    <button class="button" style="width:100%;margin-top:13px" type="button" onclick="window.deliveryNext()">Continuar →</button>`;
}
window.pickDelivery=i=>{state.selectedDelivery=i;renderDelivery()};
window.deliveryNext=()=>{if(state.selectedDelivery===null){showToast("Escolha uma opção.");return}go("review")};

function renderReview(){
  const d=state.deliveryOptions[state.selectedDelivery],items=cartItems(),total=items.reduce((s,x)=>s+x.q*effectivePrice(x.p,d.modalidade),0);
  main.innerHTML=`
    <div class="section-head"><div><h2>Revisar pedido</h2><p>Confira antes de enviar à Produção.</p></div></div>
    <div class="panel">
      ${items.map(x=>`<div class="row"><div><div class="row-title">${esc(x.p.produto)}</div><div class="row-sub">${x.q} un. • ${brl(effectivePrice(x.p,d.modalidade))} cada</div></div><b>${brl(x.q*effectivePrice(x.p,d.modalidade))}</b></div>`).join("")}
      <div class="summary"><div class="summary-line"><span>Recebimento</span><b>${esc(deliveryTitle(d).replace(/^.. /,""))}</b></div><div class="summary-line total"><span>Total estimado</span><span>${brl(total)}</span></div></div>
    </div>
    <div class="field"><label>Observação do pedido (opcional)</label><textarea id="orderObs" rows="3" placeholder="Informação importante para a produção ou entrega..."></textarea></div>
    <div class="notice">O valor final só é confirmado após a Produção. Se um item de estoque estiver indisponível, ele poderá ser retirado e o total será recalculado automaticamente.</div>
    <button id="submitOrder" class="button orange" style="width:100%;margin-top:13px" type="button" onclick="window.submitOrder()">Enviar pedido para a fábrica →</button>`;
}
window.submitOrder=async()=>{
  const d=state.deliveryOptions[state.selectedDelivery],btn=$("#submitOrder");btn.disabled=true;btn.textContent="Enviando...";
  try{
    const data=await rpc("criar_pedido_cliente_com_entrega",{p_itens:cartItems().map(x=>({produto_id:x.p.produto_id,quantidade:x.q})),p_modalidade_entrega:d.modalidade,p_endereco_id:d.endereco_id||null,p_observacao:$("#orderObs").value||null},true);
    state.lastOrder=Array.isArray(data)?data[0]:data;state.cart={};saveCart();go("success");
  }catch(e){showToast(e.message);btn.disabled=false;btn.textContent="Enviar pedido para a fábrica →"}
};
function renderSuccess(){
  const o=state.lastOrder||{};
  main.innerHTML=`<div class="success"><div class="success-icon">✅</div><h2>Pedido enviado!</h2><p>Seu pedido foi recebido e seguirá para a Produção.</p><div class="notice green"><b>Número do pedido</b><br><span style="font-size:23px;font-weight:900">${esc(o.numero||"—")}</span></div><p class="small" style="margin:15px 0">A forma de pagamento será escolhida depois que a Produção confirmar o pedido e o valor final.</p><div class="actions">${o.pedido_id?`<button class="button soft" onclick="window.downloadPdf('${o.pedido_id}')">Resumo em PDF</button>`:""}<button class="button" data-go="orders">Acompanhar pedido</button></div></div>`;
}
async function renderOrders(){
  if(!state.session){main.innerHTML='<div class="login-card"><h2>Meus pedidos</h2><p class="small">Entre para acompanhar seus pedidos.</p><button class="button" data-go="login">Entrar</button></div>';return}
  if(state.role!=="cliente"){go("internal");return}
  loading("Carregando seus pedidos...");
  try{
    const rows=await rpc("meus_pedidos",{},true)||[];
    main.innerHTML=`<div class="section-head"><div><h2>Meus pedidos</h2><p>Acompanhamento individual</p></div></div><div class="panel">${rows.length?rows.map(o=>`<div class="row"><div><div class="row-title">${esc(o.numero)}</div><div class="row-sub">${fmtDateTime(o.data_pedido)} • ${esc(o.modalidade_entrega||"")}${o.data_entrega_prevista?" • "+fmtDate(o.data_entrega_prevista):""}</div><div style="margin-top:7px"><span class="status ${statusClass(o.status)}">${esc(o.status)}</span> <span class="status ${statusClass(o.status_financeiro)}">${esc(o.status_financeiro)}</span></div></div><div style="text-align:right"><b>${brl(o.total)}</b><div class="inline-actions" style="margin-top:7px"><button class="button soft" onclick="window.viewOrder('${o.pedido_id}')">Ver pedido</button><button class="button ghost" onclick="window.downloadPdf('${o.pedido_id}')">PDF</button></div></div></div>`).join(""):'<div class="empty"><div class="empty-icon">▤</div>Nenhum pedido ainda.</div>'}</div>`;
  }catch(e){main.innerHTML='<div class="empty">'+esc(e.message)+'</div>'}
}

window.viewOrder=async id=>{
  loading("Carregando pedido...");
  try{
    const o=await rpc("pedido_detalhe_cliente",{p_pedido_id:id},true);
    const choice=o.pagamento_escolha||null,proof=o.comprovante||null;
    const canPay=o.status==="pronto"&&o.status_financeiro!=="pago";
    main.innerHTML=`
      <div class="section-head"><div><h2>${esc(o.numero)}</h2><p>${fmtDateTime(o.data_pedido)}</p></div><button class="button ghost" data-go="orders">Voltar</button></div>
      <div class="panel">
        ${(o.itens||[]).map(i=>`<div class="row"><div><div class="row-title">${esc(i.produto)}</div><div class="row-sub">Solicitado: ${i.quantidade_solicitada} • Confirmado: ${i.quantidade_confirmada}</div>${Number(i.quantidade_confirmada)<Number(i.quantidade_solicitada)?`<div class="row-sub bad">Ajustado: ${esc(i.motivo_indisponibilidade||"item indisponível")}</div>`:""}<span class="status ${statusClass(i.status_producao)}">${esc(i.status_producao)}</span></div><div style="text-align:right"><b>${brl(i.total_item)}</b><div class="row-sub">${brl(i.preco_unitario)} / un.</div></div></div>`).join("")}
        <div class="summary">
          <div class="summary-line"><span>Status</span><b>${esc(o.status)}</b></div>
          <div class="summary-line"><span>Financeiro</span><b>${esc(o.status_financeiro)}</b></div>
          <div class="summary-line"><span>Pago</span><b>${brl(o.valor_pago)}</b></div>
          <div class="summary-line total"><span>Total final</span><span>${brl(o.total)}</span></div>
        </div>
      </div>
      ${choice?`<div class="notice green" style="margin-top:12px"><b>Forma escolhida: ${esc(choice.metodo)}</b><br>Status: ${esc(choice.status)}${proof?" • comprovante: "+esc(proof.status):""}</div>`:""}
      ${canPay?`<div class="section-head"><div><h2>Forma de pagamento</h2><p>Escolha após a confirmação da Produção.</p></div></div>
        <div class="payment-grid">
          <button class="payment-card" onclick="window.chooseMethod('${id}','pix')"><span>💠</span><b>Pix</b><small>Envie o comprovante pelo sistema.</small></button>
          <button class="payment-card" onclick="window.chooseMethod('${id}','dinheiro')"><span>💵</span><b>Dinheiro</b><small>Pagamento combinado na entrega/retirada.</small></button>
          <button class="payment-card" onclick="window.chooseMethod('${id}','debito')"><span>💳</span><b>Débito</b><small>Pagamento por cartão.</small></button>
          <button class="payment-card" onclick="window.chooseMethod('${id}','credito')"><span>💳</span><b>Crédito</b><small>Pagamento por cartão.</small></button>
          <button class="payment-card" onclick="window.chooseMethod('${id}','prazo')"><span>🧾</span><b>A prazo</b><small>Somente se autorizado no cadastro.</small></button>
        </div>`:""}
      ${choice?.metodo==="pix"&&choice.status!=="aprovado"?`<button class="button orange" style="width:100%;margin-top:12px" onclick="window.pickProof('${id}')">Enviar / reenviar comprovante Pix</button>`:""}
      ${o.status==="recebido"?`<button class="button danger" style="width:100%;margin-top:12px" onclick="window.cancelOrder('${id}')">Cancelar pedido</button>`:""}
      <div class="actions" style="margin-top:12px"><button class="button soft" onclick="window.downloadPdf('${id}')">Baixar PDF</button><button class="button ghost" data-go="orders">Voltar aos pedidos</button></div>
    `;
  }catch(e){showToast(e.message);await renderOrders()}
};
window.chooseMethod=async(id,method)=>{
  try{
    await rpc("escolher_forma_pagamento_cliente",{p_pedido_id:id,p_metodo:method},true);
    if(method==="pix"){showToast("Pix selecionado. Agora envie o comprovante.");await window.viewOrder(id)}
    else if(method==="prazo"){showToast("Condição de prazo processada.");await window.viewOrder(id)}
    else{showToast("Forma de pagamento registrada.");await window.viewOrder(id)}
  }catch(e){showToast(e.message)}
};
window.pickProof=id=>{
  const input=document.createElement("input");input.type="file";input.accept="image/jpeg,image/png,image/webp,application/pdf";
  input.onchange=async()=>{if(input.files?.[0])await window.uploadProof(id,input.files[0])};input.click();
};
window.cancelOrder=async id=>{
  if(!confirm("Cancelar este pedido?"))return;
  try{await rpc("cancelar_pedido_cliente",{p_pedido_id:id},true);showToast("Pedido cancelado.");await renderOrders()}catch(e){showToast(e.message)}
};
window.downloadPdf=async id=>{
  try{
    const r=await fetch(SUPABASE_URL+"/functions/v1/pedido-pdf",{method:"POST",headers:{...authHeaders(),"Content-Type":"application/json"},body:JSON.stringify({pedido_id:id})});
    if(!r.ok)throw new Error("Não foi possível gerar o PDF.");
    const blob=await r.blob(),u=URL.createObjectURL(blob),a=document.createElement("a");a.href=u;a.download="pedido-algaroba.pdf";a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);
  }catch(e){showToast(e.message)}
};
window.choosePix=async id=>window.chooseMethod(id,"pix");
window.uploadProof=async(id,file)=>{
  try{
    showToast("Enviando comprovante...");
    const fd=new FormData();fd.append("pedido_id",id);fd.append("arquivo",file);
    await request("/functions/v1/upload-comprovante",{method:"POST",body:fd});
    showToast("Comprovante enviado para conferência.");await renderOrders();
  }catch(e){showToast(e.message)}
};
window.choosePrazo=async id=>window.chooseMethod(id,"prazo");

function renderLogin(){
  if(state.session){
    main.innerHTML=`<div class="account-card"><div class="login-mark"><img src="../algaroba-icon.svg" alt=""></div><h2 style="text-align:center">Conta Algaroba</h2><p style="text-align:center"><b>${esc(state.profile?.nome||state.session.user?.email||"Usuário")}</b><br><span class="status">${esc(state.role||"")}</span></p><div class="actions"><button class="button" onclick="window.afterLogin()">Abrir painel</button><button class="button ghost" onclick="window.logout()">Sair</button></div></div>`;return
  }
  main.innerHTML=`<div class="login-card"><div class="login-mark"><img src="../algaroba-icon.svg" alt=""></div><h2>Entrar na Algaroba</h2><p class="small" style="text-align:center">Acesso do cliente e da equipe da fábrica.</p><form onsubmit="window.login(event)"><div class="field"><label>E-mail</label><input id="email" type="email" autocomplete="email" required></div><div class="field"><label>Senha</label><input id="password" type="password" autocomplete="current-password" required></div><button id="loginSubmit" class="button" style="width:100%" type="submit">Entrar</button></form><div class="notice green" style="margin-top:13px">O catálogo pode ser consultado sem login. O acesso é exigido para finalizar pedidos e usar os painéis internos.</div></div>`;
}
window.login=async e=>{
  e.preventDefault();const btn=$("#loginSubmit");btn.disabled=true;btn.textContent="Entrando...";
  try{
    const r=await fetch(SUPABASE_URL+"/auth/v1/token?grant_type=password",{method:"POST",headers:{"apikey":PUBLISHABLE_KEY,"Content-Type":"application/json"},body:JSON.stringify({email:$("#email").value.trim(),password:$("#password").value})});
    const data=await r.json();if(!r.ok)throw new Error(data.error_description||data.msg||"E-mail ou senha inválidos.");
    state.session=data;localStorage.setItem("algaroba_session",JSON.stringify(data));await loadIdentity();await loadCatalog();setClientNavigation();
    const target=state.returnView|| (state.role==="cliente"?"home":"internal");state.returnView=null;go(target);
  }catch(e2){showToast(e2.message);btn.disabled=false;btn.textContent="Entrar"}
};
window.logout=async()=>{
  try{if(state.session)await fetch(SUPABASE_URL+"/auth/v1/logout",{method:"POST",headers:authHeaders()})}catch{}
  localStorage.removeItem("algaroba_session");state.session=null;state.role=null;state.profile=null;await loadCatalog();setClientNavigation();go("home");
};
window.afterLogin=()=>go(state.role==="cliente"?"home":"internal");

async function renderAccount(){
  if(!state.session){renderLogin();return}
  if(state.role!=="cliente"){go("internal");return}
  loading("Carregando cadastro...");
  try{
    const addresses=await table("cliente_enderecos?select=id,identificacao,logradouro,numero,bairro,cidade,uf,recebimento_inicio,recebimento_fim,intervalo_inicio,intervalo_fim,observacao_recebimento,janela_recebimento_confirmada&ativo=eq.true&order=identificacao.asc");
    main.innerHTML=`<div class="account-card"><h2>Olá, ${esc(state.profile?.nome?.split(" ")[0]||"cliente")}</h2><div class="small">${esc(state.profile?.whatsapp||state.profile?.telefone||"")}</div></div>
    <div class="section-head"><div><h2>Horário de recebimento</h2><p>Ajuda a Expedição a organizar a sequência da rota, sem prometer horário de chegada.</p></div></div>
    ${addresses.length?addresses.map(a=>`<div class="account-card"><b>${esc(a.identificacao||"Endereço")}</b><div class="small">${esc(a.logradouro||"")}, ${esc(a.numero||"")} • ${esc(a.bairro||"")}, ${esc(a.cidade||"")}/${esc(a.uf||"")}</div><div class="grid" style="margin-top:8px"><div class="field"><label>Recebe a partir de</label><input id="ini-${a.id}" type="time" value="${fmtTime(a.recebimento_inicio)}"></div><div class="field"><label>Recebe até</label><input id="fim-${a.id}" type="time" value="${fmtTime(a.recebimento_fim)}"></div><div class="field"><label>Intervalo início</label><input id="intini-${a.id}" type="time" value="${fmtTime(a.intervalo_inicio)}"></div><div class="field"><label>Intervalo fim</label><input id="intfim-${a.id}" type="time" value="${fmtTime(a.intervalo_fim)}"></div></div><div class="field"><label>Observação</label><input id="obs-${a.id}" value="${esc(a.observacao_recebimento||"")}" placeholder="Ex.: receber pela porta lateral"></div><button class="button" onclick="window.saveReceiving('${a.id}')">Salvar horário</button></div>`).join(""):'<div class="empty">Nenhum endereço cadastrado.</div>'}
    <div class="actions" style="max-width:470px;margin:14px auto"><button class="button ghost" onclick="window.logout()">Sair da conta</button></div>`;
  }catch(e){main.innerHTML='<div class="empty">'+esc(e.message)+'</div>'}
}
window.saveReceiving=async id=>{
  const v=x=>$("#"+x+"-"+id)?.value||null;
  try{await rpc("cliente_salvar_horario_recebimento",{p_endereco_id:id,p_recebimento_inicio:v("ini"),p_recebimento_fim:v("fim"),p_intervalo_inicio:v("intini"),p_intervalo_fim:v("intfim"),p_observacao:$("#obs-"+id)?.value||null},true);showToast("Horário de recebimento salvo.")}
  catch(e){showToast(e.message)}
};

async function renderInternal(){
  if(!state.session||!state.role){state.returnView="internal";go("login");return}
  setClientNavigation();
  if(state.role==="producao")return renderProduction();
  if(state.role==="expedicao")return renderExpedition();
  if(state.role==="financeiro")return renderFinance();
  return renderAdmin();
}
async function renderProduction(){
  loading("Carregando Produção...");
  try{
    const rows=await rpc("producao_fila",{},true)||[],groups={};rows.forEach(x=>(groups[x.pedido_id]??=[]).push(x));
    main.innerHTML=`<div class="rolebar"><b>🏭 Produção</b><span>sem preços e sem financeiro</span></div><div class="section-head"><div><h2>Fila de Produção</h2><p>${Object.keys(groups).length} pedidos</p></div><button class="button ghost" onclick="window.logout()">Sair</button></div>${Object.entries(groups).map(([pid,it])=>`<div class="panel" style="margin-bottom:11px"><div class="summary"><b>${esc(it[0].numero)} • ${esc(it[0].cliente_nome)}</b></div>${it.map(x=>`<div class="row"><div><div class="row-title">${esc(x.produto)}</div><div class="row-sub">Solicitado: ${x.quantidade_solicitada} • ${esc(x.modelo_fornecimento)}</div><span class="status ${statusClass(x.status_item)}">${esc(x.status_item)}</span></div><div class="inline-actions">${x.modelo_fornecimento==="estoque"?`<button class="button soft" onclick="window.prodUpdate('${x.item_id}','separado',${Number(x.quantidade_solicitada)})">Separado</button><button class="button ghost" onclick="window.prodAdjust('${x.item_id}',${Number(x.quantidade_solicitada)},${Number(x.quantidade_faturada||x.quantidade_solicitada)})">Ajustar qtd.</button><button class="button danger" onclick="window.prodUpdate('${x.item_id}','indisponivel',0)">Em falta</button>`:`<button class="button soft" onclick="window.prodUpdate('${x.item_id}','pronto',${Number(x.quantidade_solicitada)})">Pronto</button>`}</div></div>`).join("")}<div style="padding:13px"><button class="button" onclick="window.prodFinish('${pid}')">Finalizar pedido</button></div></div>`).join("")||'<div class="empty">Nenhum pedido aguardando produção.</div>'}`;
  }catch(e){main.innerHTML='<div class="empty">'+esc(e.message)+'</div>'}
}
window.prodUpdate=async(id,status,q)=>{
  let obs=null;if(status==="indisponivel")obs=prompt("Motivo da indisponibilidade:")||"Indisponível";
  try{await rpc("producao_atualizar_item",{p_item_id:id,p_status:status,p_quantidade_faturada:q,p_observacao:obs},true);showToast("Item atualizado.");await renderProduction()}catch(e){showToast(e.message)}
};
window.prodAdjust=async(id,solicitada,atual)=>{
  const raw=prompt("Quantidade realmente disponível (máximo "+solicitada+"):",String(atual).replace(".",","));
  if(raw===null)return;
  const qtd=Number(raw.replace(",","."));if(!Number.isFinite(qtd)||qtd<0||qtd>solicitada){showToast("Quantidade inválida.");return}
  const motivo=qtd<solicitada?(prompt("Motivo do ajuste:")||"Quantidade parcial em estoque"):null;
  const status=qtd<=0?"indisponivel":"separado";
  try{await rpc("producao_atualizar_item",{p_item_id:id,p_status:status,p_quantidade_faturada:qtd,p_observacao:motivo},true);showToast("Quantidade confirmada.");await renderProduction()}catch(e){showToast(e.message)}
};
window.prodFinish=async id=>{try{await rpc("producao_finalizar_pedido",{p_pedido_id:id},true);showToast("Pedido finalizado.");await renderProduction()}catch(e){showToast(e.message)}};

async function renderExpedition(){
  loading("Carregando Expedição...");
  try{
    const today=localDateISO();
    const [rows,planning,executions]=await Promise.all([
      rpc("expedicao_fila",{},true),
      rpc("expedicao_planejamento_rota",{p_data:today},true),
      table("rota_execucoes?select=id,rota_id,data_rota,status,hora_saida_prevista,saiu_em,finalizada_em,motorista,veiculo,odometro_inicio,odometro_fim,entregas_planejadas,entregas_concluidas,entregas_pendentes&data_rota=eq."+today)
    ]);
    const queue=rows||[],groups={};queue.forEach(x=>(groups[x.pedido_id]??=[]).push(x));
    const routeGroups={};(planning||[]).forEach(x=>(routeGroups[x.rota_id]??={meta:x,items:[]}).items.push(x));
    main.innerHTML=`
      <div class="rolebar"><b>🚚 Expedição</b><span>rotas e janelas de recebimento</span></div>
      <div class="section-head"><div><h2>Planejamento de hoje</h2><p>${fmtDate(today)} • saída padrão às 14h</p></div><button class="button ghost" onclick="window.logout()">Sair</button></div>
      <div class="notice green" style="margin-bottom:11px">As prioridades abaixo servem apenas para organizar a logística. O cliente continua sem receber previsão de horário de chegada.</div>

      ${Object.values(routeGroups).length?Object.values(routeGroups).map(g=>{
        const x=executions.find(e=>e.rota_id===g.meta.rota_id);
        return `<div class="panel" style="margin-bottom:13px">
          <div class="summary">
            <div><b>${esc(g.meta.rota_nome)}</b><span class="status ${x?.status==="em_rota"?"warn":x?.status==="finalizada"?"ok":""}">${esc(x?.status||"planejada")}</span></div>
            <div class="small">Saída padrão ${fmtTime(g.meta.hora_saida_padrao)} • antecipada ${fmtTime(g.meta.hora_saida_antecipada)} • ${g.items.length} entregas</div>
            <div class="inline-actions" style="margin-top:8px">
              ${!x||x.status==="planejada"?`<button class="button" onclick="window.startRoute('${g.meta.rota_id}','${today}')">Iniciar rota</button>`:""}
              ${x?.status==="em_rota"?`<button class="button orange" onclick="window.finishRoute('${x.id}')">Finalizar rota</button>`:""}
            </div>
          </div>
          ${g.items.map((p,i)=>`<div class="row"><div><div class="row-title">${p.ordem_planejada||i+1}. ${esc(p.cliente_nome)} • ${esc(p.bairro||p.cidade||"")}</div><div class="row-sub">${esc(p.endereco||"")}</div><div class="row-sub">${p.recebimento_inicio||p.recebimento_fim?`Recebe ${fmtTime(p.recebimento_inicio)||"—"}–${fmtTime(p.recebimento_fim)||"—"}`:"Horário de recebimento não informado"}${p.intervalo_inicio?" • intervalo "+fmtTime(p.intervalo_inicio)+"–"+fmtTime(p.intervalo_fim):""}</div>${p.alerta_operacional?`<span class="status warn" style="margin-top:6px">${esc(p.alerta_operacional)}</span>`:""}</div><b>${esc(p.numero)}</b></div>`).join("")}
        </div>`
      }).join(""):'<div class="empty"><div class="empty-icon">🛣️</div>Nenhuma entrega programada para hoje.</div>'}

      <div class="section-head"><div><h2>Pedidos liberados</h2><p>${Object.keys(groups).length} pedidos disponíveis para expedição</p></div></div>
      ${Object.entries(groups).map(([pid,it])=>`<div class="panel" style="margin-bottom:11px"><div class="summary"><b>${esc(it[0].numero)} • ${esc(it[0].cliente_nome)}</b><div class="small">${esc(it[0].modalidade_entrega||"")} • ${esc(it[0].endereco||"")}</div></div>${it.map(x=>`<div class="row"><div><div class="row-title">${esc(x.produto)}</div><div class="row-sub">${x.quantidade} un.</div></div></div>`).join("")}<div style="padding:13px"><button class="button" onclick="window.expUpdate('${pid}','${it[0].modalidade_entrega==="retirada_fabrica"?"entregue":"saiu_entrega"}')">${it[0].modalidade_entrega==="retirada_fabrica"?"Marcar como retirado":"Saiu para entrega"}</button></div></div>`).join("")||'<div class="empty">Nenhum pedido liberado para Expedição.</div>'}
    `;
  }catch(e){main.innerHTML='<div class="empty">'+esc(e.message)+'</div>'}
}
window.expUpdate=async(id,status)=>{try{await rpc("expedicao_atualizar_status",{p_pedido_id:id,p_novo_status:status},true);showToast("Status atualizado.");await renderExpedition()}catch(e){showToast(e.message)}};
window.startRoute=async(rotaId,data)=>{
  const motorista=prompt("Nome do motorista (opcional):")||null;
  const veiculo=prompt("Veículo/placa (opcional):")||null;
  const kmTxt=prompt("Odômetro inicial (opcional):")||"";
  const km=kmTxt?Number(kmTxt.replace(",",".")):null;
  if(kmTxt&&Number.isNaN(km)){showToast("Odômetro inválido.");return}
  try{await rpc("expedicao_iniciar_rota",{p_rota_id:rotaId,p_data:data,p_motorista:motorista,p_veiculo:veiculo,p_odometro_inicio:km},true);showToast("Rota iniciada.");await renderExpedition()}catch(e){showToast(e.message)}
};
window.finishRoute=async(execId)=>{
  const kmTxt=prompt("Odômetro final (opcional):")||"";
  const km=kmTxt?Number(kmTxt.replace(",",".")):null;
  if(kmTxt&&Number.isNaN(km)){showToast("Odômetro inválido.");return}
  const obs=prompt("Observação de encerramento (opcional):")||null;
  try{await rpc("expedicao_finalizar_rota",{p_execucao_id:execId,p_odometro_fim:km,p_observacao:obs},true);showToast("Rota finalizada.");await renderExpedition()}catch(e){showToast(e.message)}
};

async function renderFinance(){
  loading("Carregando Financeiro...");
  try{
    const [rows,manual]=await Promise.all([
      rpc("financeiro_comprovantes_fila",{},true),
      rpc("financeiro_pagamentos_pendentes",{},true)
    ]);
    const proofs=rows||[],pendingProofs=proofs.filter(x=>["enviado","em_analise"].includes(x.comprovante_status)),manualRows=manual||[];
    main.innerHTML=`
      <div class="rolebar"><b>💳 Financeiro</b><span>pagamentos e liberação</span></div>
      <div class="section-head"><div><h2>Painel financeiro</h2><p>Conferência antes da liberação do pedido</p></div><button class="button ghost" onclick="window.logout()">Sair</button></div>
      <div class="kpis" style="margin-bottom:12px">
        <div class="kpi"><b>${pendingProofs.length}</b><small>Pix aguardando análise</small></div>
        <div class="kpi"><b>${manualRows.length}</b><small>Pagamentos manuais</small></div>
        <div class="kpi"><b>${brl(pendingProofs.reduce((a,x)=>a+Number(x.valor_pendente||0),0)+manualRows.reduce((a,x)=>a+Number(x.valor_pendente||0),0))}</b><small>Saldo aguardando confirmação</small></div>
      </div>

      <div class="section-head"><div><h2>Pix / comprovantes</h2><p>${pendingProofs.length} aguardando conferência</p></div></div>
      <div class="panel">${proofs.length?proofs.map(x=>`
        <div class="row">
          <div>
            <div class="row-title">${esc(x.numero)} • ${esc(x.cliente_nome)}</div>
            <div class="row-sub">${fmtDateTime(x.created_at)} • ${esc(x.mime_type||"arquivo")}</div>
            <div class="row-sub">Total ${brl(x.total)} • pendente ${brl(x.valor_pendente)}</div>
            ${x.observacao_cliente?`<div class="row-sub">Cliente: ${esc(x.observacao_cliente)}</div>`:""}
            <div style="margin-top:6px"><span class="status ${statusClass(x.comprovante_status)}">${esc(x.comprovante_status)}</span></div>
          </div>
          <div class="inline-actions">
            <button class="button soft" onclick="window.openProof('${x.comprovante_id}')">Ver comprovante</button>
            ${!["aprovado"].includes(x.comprovante_status)?`<button class="button" onclick="window.approveProof('${x.comprovante_id}')">Aprovar</button><button class="button danger" onclick="window.rejectProof('${x.comprovante_id}')">Rejeitar</button>`:""}
          </div>
        </div>`).join(""):'<div class="empty">Sem comprovantes.</div>'}</div>

      <div class="section-head"><div><h2>Dinheiro e cartões</h2><p>Pedidos prontos aguardando confirmação de pagamento</p></div></div>
      <div class="panel">${manualRows.length?manualRows.map(x=>`
        <div class="row">
          <div>
            <div class="row-title">${esc(x.numero)} • ${esc(x.cliente_nome)}</div>
            <div class="row-sub">${fmtDateTime(x.data_pedido)} • ${esc(x.modalidade_entrega||"")}</div>
            <div class="row-sub">Forma: <b>${esc(x.metodo)}</b> • Total ${brl(x.total)} • pendente ${brl(x.valor_pendente)}</div>
            <span class="status warn">${esc(x.escolha_status)}</span>
          </div>
          <div class="inline-actions">
            <button class="button" onclick="window.confirmManualPayment('${x.pedido_id}',${Number(x.valor_pendente)})">Confirmar pagamento</button>
          </div>
        </div>`).join(""):'<div class="empty">Nenhum pagamento manual aguardando confirmação.</div>'}</div>
    `;
  }catch(e){main.innerHTML='<div class="empty">'+esc(e.message)+'</div>'}
}
window.confirmManualPayment=async(id,pending)=>{
  const raw=prompt("Valor recebido:",String(pending).replace(".",","));
  if(raw===null)return;
  const value=Number(raw.replace(",","."));if(!Number.isFinite(value)||value<=0||value>pending){showToast("Valor inválido.");return}
  const obs=prompt("Observação do pagamento (opcional):")||null;
  try{
    await rpc("financeiro_registrar_pagamento_manual",{p_pedido_id:id,p_valor:value,p_observacao:obs},true);
    showToast("Pagamento registrado.");
    await renderFinance();
  }catch(e){showToast(e.message)}
};
window.openProof=async id=>{
  try{
    const data=await request("/functions/v1/comprovante-url",{method:"POST",body:{comprovante_id:id}});
    if(!data?.signed_url)throw new Error("Link do comprovante indisponível.");
    window.open(data.signed_url,"_blank","noopener,noreferrer");
  }catch(e){showToast(e.message)}
};
window.approveProof=async id=>{try{await rpc("financeiro_aprovar_comprovante",{p_comprovante_id:id,p_observacao:"Aprovado pelo painel"},true);showToast("Pagamento aprovado.");await renderFinance()}catch(e){showToast(e.message)}};
window.rejectProof=async id=>{const motivo=prompt("Motivo da rejeição:");if(!motivo)return;try{await rpc("financeiro_rejeitar_comprovante",{p_comprovante_id:id,p_motivo:motivo},true);showToast("Comprovante rejeitado.");await renderFinance()}catch(e){showToast(e.message)}};

async function renderAdmin(){
  loading("Carregando Administração...");
  try{
    const [orders,routes,stock]=await Promise.all([
      table("pedidos?select=id,numero,status,status_financeiro,total,data_pedido,modalidade_entrega&order=data_pedido.desc&limit=30"),
      table("rotas?select=id,nome,dia_semana,hora_limite_pedido,hora_inicio_padrao,hora_inicio_antecipada,ativo&ativo=eq.true&order=nome.asc"),
      rpc("estoque_painel",{},true)
    ]);
    const total=orders.reduce((a,x)=>a+Number(x.total||0),0),pending=orders.filter(x=>x.status_financeiro!=="pago").length;
    const featured=state.catalog.filter(p=>p.destaque);
    main.innerHTML=`
      <div class="rolebar"><b>📊 Administração</b><span>${esc(state.role)}</span></div>
      <div class="section-head"><div><h2>Painel da fábrica</h2><p>Visão operacional dos dados atuais</p></div><button class="button ghost" onclick="window.logout()">Sair</button></div>
      <div class="kpis">
        <div class="kpi"><b>${orders.length}</b><small>Pedidos recentes</small></div>
        <div class="kpi"><b>${brl(total)}</b><small>Total dos 30 recentes</small></div>
        <div class="kpi"><b>${pending}</b><small>Financeiro pendente</small></div>
        <div class="kpi"><b>${routes.length}</b><small>Rotas ativas</small></div>
        <div class="kpi"><b>${stock.filter(p=>p.disponibilidade_catalogo==="em_falta").length}</b><small>Itens de estoque em falta</small></div>
        <div class="kpi"><b>${featured.length}</b><small>Destaques do catálogo</small></div>
      </div>

      <div class="section-head"><div><h2>Catálogo e estoque</h2><p>Controle rápido do que o cliente enxerga.</p></div></div>
      <div class="panel">
        ${stock.length?stock.map(s=>{const p=state.catalog.find(x=>x.produto_id===s.produto_id)||s;return `<div class="row"><div><div class="row-title">${esc(s.produto)}</div><div class="row-sub">${esc(s.categoria||categoryKey(p))} • Saldo: <b>${s.quantidade_atual}</b> • Mínimo: ${s.estoque_minimo}</div><div style="margin-top:6px"><span class="status ${s.disponibilidade_catalogo==="disponivel"?"ok":s.disponibilidade_catalogo==="em_falta"?"bad":"warn"}">${esc(s.disponibilidade_catalogo)}</span> ${s.abaixo_minimo?'<span class="status warn">abaixo do mínimo</span>':""}${p.destaque?' <span class="status warn">destaque</span>':""}</div></div><div class="inline-actions"><button class="button soft" onclick="window.adminStockEntry('${s.produto_id}',${Number(s.quantidade_atual)})">Entrada</button><button class="button ghost" onclick="window.adminSetStock('${s.produto_id}',${Number(s.quantidade_atual)},${Number(s.estoque_minimo)})">Ajustar</button><button class="button ghost" onclick="window.adminToggleFeatured('${s.produto_id}',${!!p.destaque})">${p.destaque?"Remover destaque":"Destacar"}</button><button class="button ghost" onclick="window.adminEditPresentation('${s.produto_id}')">Editar</button></div></div>`}).join(""):'<div class="empty">Nenhum item de estoque cadastrado.</div>'}
      </div>

      <div class="section-head"><h2>Rotas</h2></div>
      <div class="panel">${routes.map(r=>`<div class="row"><div><div class="row-title">${esc(r.nome)}</div><div class="row-sub">${esc(r.dia_semana||"")} • pedidos até ${fmtTime(r.hora_limite_pedido)} • saída ${fmtTime(r.hora_inicio_padrao)}${r.hora_inicio_antecipada?" • antecipada "+fmtTime(r.hora_inicio_antecipada):""}</div></div><span class="status ok">ativa</span></div>`).join("")}</div>

      <div class="section-head"><h2>Pedidos recentes</h2></div>
      <div class="panel">${orders.map(o=>`<div class="row"><div><div class="row-title">${esc(o.numero)}</div><div class="row-sub">${fmtDateTime(o.data_pedido)} • ${esc(o.modalidade_entrega||"")}</div><span class="status ${statusClass(o.status)}">${esc(o.status)}</span> <span class="status ${statusClass(o.status_financeiro)}">${esc(o.status_financeiro)}</span></div><b>${brl(o.total)}</b></div>`).join("")||'<div class="empty">Sem pedidos.</div>'}</div>
    `;
  }catch(e){main.innerHTML='<div class="empty">'+esc(e.message)+'</div>'}
}
window.adminStockEntry=async(id,current)=>{
  const raw=prompt("Quantidade que está entrando no estoque:","1");if(raw===null)return;
  const qtd=Number(raw.replace(",","."));if(!Number.isFinite(qtd)||qtd<=0){showToast("Quantidade inválida.");return}
  const obs=prompt("Observação da entrada (opcional):")||null;
  try{await rpc("admin_movimentar_estoque",{p_produto_id:id,p_quantidade:qtd,p_tipo:"entrada",p_observacao:obs},true);showToast("Entrada registrada.");await loadCatalog();await renderAdmin()}catch(e){showToast(e.message)}
};
window.adminSetStock=async(id,current,minCurrent)=>{
  const raw=prompt("Saldo físico atual:",String(current).replace(".",","));if(raw===null)return;
  const qtd=Number(raw.replace(",","."));if(!Number.isFinite(qtd)||qtd<0){showToast("Quantidade inválida.");return}
  const rawMin=prompt("Estoque mínimo:",String(minCurrent).replace(".",","));if(rawMin===null)return;
  const minimo=Number(rawMin.replace(",","."));if(!Number.isFinite(minimo)||minimo<0){showToast("Estoque mínimo inválido.");return}
  const obs=prompt("Motivo do ajuste (opcional):")||null;
  try{await rpc("admin_ajustar_estoque",{p_produto_id:id,p_nova_quantidade:qtd,p_estoque_minimo:minimo,p_observacao:obs},true);showToast("Estoque ajustado.");await loadCatalog();await renderAdmin()}catch(e){showToast(e.message)}
};
window.adminToggleFeatured=async(id,current)=>{
  try{
    await rpc("admin_atualizar_produto_catalogo",{p_produto_id:id,p_descricao_cliente:null,p_imagem_url:null,p_ordem_exibicao:null,p_destaque:!current,p_disponibilidade_catalogo:null,p_ativo:null},true);
    showToast(!current?"Produto destacado.":"Destaque removido.");
    await loadCatalog();await renderAdmin();
  }catch(e){showToast(e.message)}
};
window.adminEditPresentation=async id=>{
  const p=state.catalog.find(x=>x.produto_id===id);if(!p)return;
  const desc=prompt("Descrição que o cliente verá:",p.descricao_cliente||"");
  if(desc===null)return;
  const img=prompt("URL da foto do produto (pode deixar vazio por enquanto):",p.imagem_url||"");
  if(img===null)return;
  try{
    await rpc("admin_atualizar_produto_catalogo",{p_produto_id:id,p_descricao_cliente:desc||null,p_imagem_url:img||null,p_ordem_exibicao:null,p_destaque:null,p_disponibilidade_catalogo:null,p_ativo:null},true);
    showToast("Apresentação do produto atualizada.");await loadCatalog();await renderAdmin();
  }catch(e){showToast(e.message)}
};

boot();

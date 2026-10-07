import { installInternalFlow } from "./internal-flow.js?v=20261007-flow6";
import { installInternalAdmin } from "./internal-admin.js?v=20261007-admin1";
const SUPABASE_URL="https://zqyehddgyiqtbynnoecz.supabase.co";
const PUBLISHABLE_KEY="sb_publishable_WERTeRIu5m88f89HfjSdWg_AlI91sb5";
const AUTH_REDIRECT_URL="https://pablojpramalho-star.github.io/algaroba-comandas/fabrica/";

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
  drafts:{},
  cart:JSON.parse(localStorage.getItem("algaroba_cart")||"{}"),
  deliveryOptions:[],selectedDelivery:null,lastOrder:null,returnView:null,
  internalModule:localStorage.getItem("algaroba_internal_module")||null,
  adminOrders:[],adminQuery:"",
  productionOpenOrder:null,
  expeditionOpenOrder:null
};
let renderConference,renderRoute,renderReports,renderTestClient;

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
  const icons={
    tradicional:`<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M15 14h18l-2 25H17L15 14Z"/><path d="M19 10h10M29 10l6-6M20 20c5 3 8-3 12 0"/></svg>`,
    classic:`<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M24 14c-8 0-14 6-14 14s6 13 14 13 14-5 14-13-6-14-14-14Z"/><path d="M18 13c1-6 5-8 9-6M26 13c2-5 6-6 10-4"/><path d="M16 25h.1M24 22h.1M31 27h.1M22 33h.1"/></svg>`,
    intense:`<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M11 18 24 9l13 9-3 20H14l-3-20Z"/><path d="m11 18 13 8 13-8M24 9v17M14 38l10-12 10 12"/></svg>`,
    "graos-farinaceos":`<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M12 37c5-11 11-19 25-26-2 14-9 23-25 26Z"/><path d="M16 32c5-1 10-5 15-11M18 26l-1-7M24 22l1-7M30 18l4-4"/></svg>`,
    "xaropes-coberturas":`<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M18 7h12v8l4 5v20H14V20l4-5V7Z"/><path d="M18 14h12M18 27h12M22 7V4h4v3"/></svg>`
  };
  return icons[key]||icons.tradicional;
}
function groupScene(key){
  const cls=key==="classic"?"classic":key==="intense"?"intense":key==="graos-farinaceos"?"grain":key==="xaropes-coberturas"?"syrup":"tradicional";
  return `<div class="group-scene scene-${cls}" aria-hidden="true"><span class="scene-leaf leaf-a"></span><span class="scene-leaf leaf-b"></span><span class="scene-product"><i></i><b>A</b></span></div>`;
}
function productThumb(p){
  return `<div class="mini-product ${productVisualClass(p)}" aria-hidden="true"><span><i></i><b>A</b></span></div>`;
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
function productType(p){
  const c=(p.categoria||"").toLowerCase(),n=(p.produto||"").toLowerCase(),l=(p.linha||"").toLowerCase();
  if(c.includes("xarope"))return "syrup";
  if(c.includes("cobertura"))return "topping";
  if(c.includes("grão")||c.includes("farin"))return "grain";
  if(n.includes("lácteo"))return "milk";
  if(l.includes("intense"))return "intense";
  if(l.includes("zero"))return "zero";
  return "shake";
}
function productVisualClass(p){
  const raw=(p.sabor||p.produto||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
  const line=(p.linha||"").toLowerCase(),type=productType(p);
  let base=type==="grain"?"visual-grain":(type==="syrup"||type==="topping")?"visual-syrup":line.includes("intense")?"visual-intense":line.includes("zero")?"visual-zero":line.includes("raiz")?"visual-raiz":line.includes("tradicional")?"visual-tradicional":"visual-classic";
  if(raw.includes("uva"))base+=" flavor-uva";
  else if(raw.includes("acai"))base+=" flavor-acai";
  else if(raw.includes("morango"))base+=" flavor-morango";
  else if(raw.includes("pistache"))base+=" flavor-pistache";
  else if(raw.includes("chocolate branco"))base+=" flavor-chocolate-branco";
  else if(raw.includes("abacaxi"))base+=" flavor-abacaxi";
  return base;
}
function productIcon(p){return `<span class="product-fallback type-${productType(p)}" aria-hidden="true"><i></i><b>A</b></span>`}
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
  if(["pago","pagamento_confirmado","entregue","pronto","aprovado","separado","pronto_rota","pronto_retirada","conferido"].includes(v))return "ok";
  if(["cancelado","devolvido","rejeitado","atrasado","indisponivel"].includes(v))return "bad";
  return "warn";
}
function nav(view){
  document.querySelectorAll("[data-nav]").forEach(b=>b.classList.toggle("active",b.dataset.nav===view));
}
function setClientNavigation(){
  const internal=state.session&&state.role&&state.role!=="cliente";
  clientNav.classList.toggle("hidden",internal);
  document.body.classList.toggle("internal-mode",!!internal);
  accountLabel.textContent=state.session?(state.role==="cliente"?(state.profile?.nome?.split(" ")[0]||"Conta"):(state.role?"Painel":"Cadastro")):"Entrar";
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
    }else{
      state.profile=null;
    }
  }catch(e){
    console.error(e);
    state.role=null;state.profile=null;
  }
}
async function tryBootstrapFirstAdmin(){
  if(!state.session||state.role)return false;
  let email=state.session?.user?.email||null;
  if(!email){
    try{
      const user=await request("/auth/v1/user",{method:"GET"});
      if(user?.email){
        email=user.email;
        state.session.user=user;
        localStorage.setItem("algaroba_session",JSON.stringify(state.session));
      }
    }catch{}
  }
  if(String(email||"").trim().toLowerCase()!=="algarobalinefit@gmail.com")return false;
  try{
    await rpc("bootstrap_primeiro_admin",{},true);
    await loadIdentity();
    return state.role==="administrador";
  }catch(e){
    console.warn("Bootstrap ADM:",e.message);
    return false;
  }
}

function captureAuthCallback(){
  const raw=window.location.hash.startsWith("#")?window.location.hash.slice(1):"";
  if(!raw)return null;
  const params=new URLSearchParams(raw);
  const error=params.get("error_description")||params.get("error");
  if(error){
    history.replaceState(null,"",window.location.pathname+window.location.search);
    return {error:decodeURIComponent(error.replace(/\+/g," "))};
  }
  const accessToken=params.get("access_token"),refreshToken=params.get("refresh_token");
  if(!accessToken||!refreshToken)return null;
  state.session={
    access_token:accessToken,
    refresh_token:refreshToken,
    token_type:params.get("token_type")||"bearer",
    expires_in:Number(params.get("expires_in")||3600),
    expires_at:Number(params.get("expires_at")||0)
  };
  localStorage.setItem("algaroba_session",JSON.stringify(state.session));
  localStorage.removeItem("algaroba_pending_email");
  history.replaceState(null,"",window.location.pathname+window.location.search);
  return {confirmed:true};
}

async function boot(){
  const authCallback=captureAuthCallback();
  const requestedView=new URLSearchParams(window.location.search).get("abrir");
  saveCart();
  window.addEventListener("online",()=>$("#offlineBanner").classList.add("hidden"));
  window.addEventListener("offline",()=>$("#offlineBanner").classList.remove("hidden"));
  if(!navigator.onLine)$("#offlineBanner").classList.remove("hidden");
  if(state.session)await loadIdentity();
  await loadCatalog();setClientNavigation();
  if(requestedView==="interno"){
    if(state.session&&!state.role)await tryBootstrapFirstAdmin();
    if(state.session&&state.role&&state.role!=="cliente")go("internal");
    else if(state.session&&state.role==="cliente"){showToast("Este acesso é exclusivo para a equipe Algaroba.");go("home")}
    else {state.returnView="internal";go("login")}
  }
  else if(state.session&&!state.role){
    const becameAdmin=await tryBootstrapFirstAdmin();
    go(becameAdmin?"internal":"complete-profile");
  }
  else if(state.role&&state.role!=="cliente")go("internal");
  else if(requestedView==="pedido"){state.selectedGroup=null;state.search="";state.groupInfoOpen=false;go("catalog")}
  else if(requestedView==="pedidos")go("orders");
  else if(requestedView==="info")go("info");
  else if(requestedView==="conta")go("account");
  else go("home");
  if(requestedView)history.replaceState(null,"",window.location.pathname);
  if(authCallback?.confirmed)setTimeout(()=>showToast("E-mail confirmado. Complete seu cadastro."),120);
  else if(authCallback?.error)setTimeout(()=>showToast(authCallback.error),120);
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
  else if(view==="info")await renderInfo();
  else if(view==="account")await renderAccount();
  else if(view==="login")renderLogin();
  else if(view==="signup")renderSignup();
  else if(view==="complete-profile")renderCompleteProfile();
  else if(view==="address-setup")renderAddressSetup();
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
  main.innerHTML=`
    <section class="ref-home">
      <div class="ref-home-card">
        <div class="ref-home-copy">
          <div class="ref-kicker"><i>⌁</i><span>SABOR NATURAL</span></div>
          <h1>Shakes que<br>conectam<br><em>bons</em><br>momentos.</h1>
          <p>Ingredientes selecionados e muito sabor para o seu dia.</p>
        </div>
        <div class="ref-home-photo" aria-hidden="true"></div>
        <div class="ref-home-actions">
          <button class="ref-primary" type="button" onclick="window.openGroups()">
            <svg viewBox="0 0 24 24"><path d="M3 4h2l2.2 10.5h9.7L20 7H6"/><circle cx="9" cy="19" r="1.4"/><circle cx="17" cy="19" r="1.4"/></svg>
            <span>Fazer meu pedido</span><b>→</b>
          </button>
          <button class="ref-secondary" type="button" onclick="window.location.href='./catalogo.html'">
            <span>▤</span><div><b>Ver catálogo completo</b><small>Conheça todos os produtos Algaroba</small></div><strong>›</strong>
          </button>
        </div>
      </div>
    </section>
  `;
}
window.openGroups=()=>{state.selectedGroup=null;state.search="";state.groupInfoOpen=false;go("catalog")};
window.chooseGroup=key=>{state.selectedGroup=key;state.search="";state.groupInfoOpen=false;go("catalog")};

function draftForGroup(key){
  if(!state.drafts[key])state.drafts[key]={};
  return state.drafts[key];
}
function draftUnits(key){
  return Object.values(draftForGroup(key)).reduce((sum,qty)=>sum+Number(qty||0),0);
}
window.changeDraftQty=(id,delta)=>{
  const group=state.groups.find(g=>g.chave===state.selectedGroup);
  if(!group||!groupProducts(group).some(p=>p.produto_id===id&&p.disponibilidade_catalogo==="disponivel"))return;
  const draft=draftForGroup(group.chave);
  const next=Math.max(0,Math.min(9999,Number(draft[id]||0)+delta));
  if(next)draft[id]=next;else delete draft[id];
  const out=document.getElementById("draft-"+id);if(out)out.textContent=next;
  const minus=document.getElementById("remove-"+id);if(minus)minus.disabled=next===0;
  const total=draftUnits(group.chave);
  const button=document.getElementById("confirmGroupItems");if(button)button.disabled=total===0;
  const counter=document.getElementById("pendingCount");if(counter)counter.textContent=total?" • "+total+" un.":"";
};
window.addDraftToCart=()=>{
  const group=state.groups.find(g=>g.chave===state.selectedGroup);if(!group)return;
  const draft=draftForGroup(group.chave);
  const availableIds=new Set(groupProducts(group).filter(p=>p.disponibilidade_catalogo==="disponivel").map(p=>p.produto_id));
  const entries=Object.entries(draft).filter(([id,quantity])=>availableIds.has(id)&&Number.isSafeInteger(quantity)&&quantity>0);
  const total=entries.reduce((sum,[,q])=>sum+q,0);
  if(total===0){showToast("Escolha a quantidade de pelo menos um produto.");return}
  if(entries.some(([id,q])=>Number(state.cart[id]||0)+q>9999)){showToast("Quantidade máxima por produto excedida.");return}
  for(const [id,q] of entries)state.cart[id]=Number(state.cart[id]||0)+q;
  state.drafts[group.chave]={};
  saveCart();
  state.selectedGroup=null;state.search="";state.groupInfoOpen=false;
  go("catalog");
  showToast(total+" "+(total===1?"unidade adicionada":"unidades adicionadas")+" ao carrinho.");
};
window.finishFromGroup=()=>{
  if(state.selectedGroup&&draftUnits(state.selectedGroup)>0){
    showToast("Primeiro toque em Adicionar estes itens ao carrinho.");return;
  }
  if(cartUnits())go("cart");else showToast("Seu carrinho ainda está vazio.");
};

window.backToGroups=()=>{state.selectedGroup=null;state.search="";state.groupInfoOpen=false;go("catalog")};
window.toggleGroupInfo=()=>{state.groupInfoOpen=!state.groupInfoOpen;renderCatalog()};

function renderGroupChooser(){
  main.innerHTML=`
    <div class="mock-page-head">
      <div>
        <h2>Escolha sua linha</h2>
        <p>Produtos de alta qualidade para o seu negócio.</p>
      </div>
      <a class="catalog-inline-link" href="./catalogo.html">Ver catálogo completo →</a>
    </div>
    <div class="mock-category-list">
      ${state.groups.map(g=>`<button class="mock-category-card category-${g.chave}" type="button" onclick="window.chooseGroup('${g.chave}')">
        ${groupScene(g.chave)}
        <div class="mock-category-copy">
          <strong>${esc(g.titulo)}</strong>
          <span>${esc(g.subtitulo||"")}</span>
          <small>${g.qtd_produtos} ${g.qtd_produtos===1?"opção":"opções"}${draftUnits(g.chave)>0?" • "+draftUnits(g.chave)+" selecionadas":""}</small>
        </div>
        <i class="mock-category-arrow">›</i>
      </button>`).join("")}
    </div>
    ${cartItems().length?`<div class="catalog-bottom-actions mock-finalize"><button class="button orange" type="button" data-go="cart">Ver pedido e finalizar →</button></div>`:""}
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
  return list.map(p=>`<article class="mock-product-card ${p.destaque?"featured":""}">
    <div class="mock-product-photo ${productVisualClass(p)} ${p.imagem_url?"has-image":""}">
      ${p.imagem_url?`<img src="${esc(p.imagem_url)}" alt="${esc(displayProductName(p,group))}" loading="lazy" onerror="this.remove();this.parentElement.classList.remove('has-image')">`:productIcon(p)}
    </div>
    <div class="mock-product-copy">
      <div class="mock-product-kicker">${measure(p)||"1 kg"}</div>
      <h3>${esc(displayProductName(p,group))}</h3>
      ${p.descricao_cliente?`<p>${esc(p.descricao_cliente)}</p>`:""}
      <div class="mock-price-lines">
        <span>Atacado <b>${brl(p.preco_atacado)}</b></span>
        <span>Varejo <b>${brl(p.preco_varejo)}</b></span>
      </div>
      ${p.modelo_fornecimento==="sob_encomenda"?'<small class="mock-made">Produção sob encomenda</small>':""}
    </div>
    <div class="mock-product-controls">
      ${p.disponibilidade_catalogo==="em_falta"?'<span class="soldout">Em falta</span>':p.disponibilidade_catalogo==="sob_consulta"?'<span class="soldout">Consultar</span>':`
        <button class="mock-qty minus" type="button" id="remove-${p.produto_id}" onclick="window.changeDraftQty('${p.produto_id}',-1)" ${!draftForGroup(group.chave)[p.produto_id]?"disabled":""}>−</button>
        <output class="mock-count" id="draft-${p.produto_id}">${draftForGroup(group.chave)[p.produto_id]||0}</output>
        <button class="mock-qty plus" type="button" onclick="window.changeDraftQty('${p.produto_id}',1)">+</button>
      `}
    </div>
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
        <div class="eyebrow dark">Produtos Algaroba</div>
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

    <div class="group-draft-action">
      <small>Selecione as quantidades acima e confirme tudo de uma vez.</small>
      <button id="confirmGroupItems" class="button orange group-draft-button" type="button" onclick="window.addDraftToCart()" ${!draftUnits(group.chave)?"disabled":""}>
        Adicionar itens ao carrinho <span id="pendingCount">${draftUnits(group.chave)?" • "+draftUnits(group.chave)+" un.":""}</span>
      </button>
    </div>
    <div class="catalog-bottom-actions">
      <button class="button ghost" type="button" onclick="window.backToGroups()">← Voltar às linhas</button>
      ${cartItems().length?'<button class="button orange" type="button" onclick="window.finishFromGroup()">Finalizar meu pedido →</button>':""}
    </div>

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
    <div class="mock-page-head cart-head"><div><h2>Meu pedido</h2><p>Confira seus itens e finalize seu pedido.</p></div></div>
    ${items.length?`<div class="mock-cart-list">
      ${items.map(x=>`<div class="mock-cart-row">
        ${productThumb(x.p)}
        <div class="mock-cart-copy">
          <strong>${esc(displayProductName(x.p,null)||x.p.produto)}</strong>
          <small>${measure(x.p)||esc(categoryKey(x.p))}</small>
          <span>${brl(effectivePrice(x.p))} <em>${atacado?"(Atacado)":"(Varejo)"}</em></span>
        </div>
        <div class="mock-cart-right">
          <div class="mock-cart-qty"><button onclick="window.cartQty('${x.p.produto_id}',-1)">−</button><b>${x.q}</b><button onclick="window.cartQty('${x.p.produto_id}',1)">+</button></div>
          <strong>${brl(x.q*effectivePrice(x.p))}</strong>
          <button class="ref-trash" type="button" onclick="window.removeCartItem('${x.p.produto_id}')" aria-label="Remover item">⌫</button>
        </div>
      </div>`).join("")}
      <button class="mock-add-more" type="button" data-go="catalog"><b>＋</b><span>Adicionar mais produtos</span><strong>›</strong></button>
      <div class="mock-cart-summary">
        <div><span>Subtotal estimado</span><small>${units} ${units===1?"item":"itens"}</small></div>
        <strong>${brl(total)}</strong>
      </div>
    </div>
    <div class="mock-receive-note"><b>Como deseja receber?</b><span>Na próxima etapa você escolhe entrega por rota ou retirada na fábrica.</span></div>
    <button class="button orange mock-checkout" type="button" onclick="window.checkout()">Finalizar pedido →</button>`:
    '<div class="empty"><div class="empty-icon">🛒</div>Seu carrinho está vazio.<br><br><button class="button" data-go="catalog">Escolher produtos</button></div>'}`;
}
window.cartQty=(id,d)=>{window.changeQty(id,d);renderCart()};
window.removeCartItem=id=>{delete state.cart[id];saveCart();renderCart()};
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
    if(!state.role){renderCompleteProfile();return}
    main.innerHTML=`<div class="account-card"><div class="login-mark"><img src="../algaroba-icon.svg" alt=""></div><h2 style="text-align:center">Conta Algaroba</h2><p style="text-align:center"><b>${esc(state.profile?.nome||state.session.user?.email||"Usuário")}</b><br><span class="status">${esc(state.role||"")}</span></p><div class="actions"><button class="button" onclick="window.afterLogin()">Abrir painel</button><button class="button ghost" onclick="window.logout()">Sair</button></div></div>`;return
  }
  const internalAccess=state.returnView==="internal";
  main.innerHTML=`<div class="login-card ${internalAccess?"internal-login-card":""}">
    <div class="login-mark"><img src="../algaroba-icon.svg" alt=""></div>
    <h2>${internalAccess?"Painel Algaroba Fábrica":"Entrar na Algaroba"}</h2>
    <p class="small" style="text-align:center">${internalAccess?"Acesso exclusivo da equipe administrativa e operacional.":"Entre para finalizar pedidos e acompanhar suas compras."}</p>
    <form onsubmit="window.login(event)">
      <div class="field"><label>E-mail</label><input id="email" type="email" autocomplete="email" required></div>
      <div class="field"><label>Senha</label><input id="password" type="password" autocomplete="current-password" required></div>
      <button id="loginSubmit" class="button" style="width:100%" type="submit">Entrar</button>
    </form>
    ${internalAccess?`
      <div class="notice green" style="margin-top:13px"><b>Acesso interno</b><br>Use o e-mail e a senha cadastrados para sua função na Algaroba.</div>
      <div class="auth-divider"><span>primeiro acesso</span></div>
      <button class="button orange" style="width:100%" type="button" onclick="window.startInternalSignup()">Criar primeiro acesso ADM</button>
    `:`
      <div class="auth-divider"><span>ou</span></div>
      <button class="button orange" style="width:100%" type="button" data-go="signup">Criar meu cadastro</button>
      <div class="notice green" style="margin-top:13px">Você pode consultar o catálogo sem login. A conta só é necessária para enviar o pedido.</div>`}
  </div>`;
}

function renderSignup(){
  if(state.session){go(state.role?(state.role==="cliente"?"account":"internal"):"complete-profile");return}
  const internalAccess=state.returnView==="internal";
  main.innerHTML=`<div class="login-card ${internalAccess?"internal-login-card":""}">
    <button class="auth-back" type="button" data-go="login">← Voltar</button>
    <div class="login-mark"><img src="../algaroba-icon.svg" alt=""></div>
    <h2>${internalAccess?"Criar primeiro acesso ADM":"Criar meu cadastro"}</h2>
    <p class="small" style="text-align:center">${internalAccess?"Use exclusivamente o e-mail Algarobalinefit@gmail.com e escolha sua senha. Após confirmar o e-mail, este acesso será reconhecido como Administrador.":"Primeiro crie seu acesso. Depois vamos pedir apenas nome, WhatsApp e endereço."}</p>
    <form onsubmit="window.signup(event)">
      <div class="field"><label>E-mail</label><input id="signupEmail" type="email" autocomplete="email" required></div>
      <div class="field"><label>Crie uma senha</label><input id="signupPassword" type="password" minlength="6" autocomplete="new-password" required></div>
      <div class="field"><label>Repita a senha</label><input id="signupPassword2" type="password" minlength="6" autocomplete="new-password" required></div>
      <button id="signupSubmit" class="button orange" style="width:100%" type="submit">Criar acesso →</button>
    </form>
    <div class="notice" style="margin-top:13px">Se a confirmação por e-mail estiver habilitada, você receberá uma mensagem para confirmar seu acesso antes de concluir o cadastro.</div>
  </div>`;
}

window.signup=async e=>{
  e.preventDefault();
  const email=$("#signupEmail").value.trim(),password=$("#signupPassword").value,password2=$("#signupPassword2").value;
  if(password!==password2){showToast("As senhas não são iguais.");return}
  const btn=$("#signupSubmit");btn.disabled=true;btn.textContent="Criando...";
  try{
    const r=await fetch(SUPABASE_URL+"/auth/v1/signup?redirect_to="+encodeURIComponent(AUTH_REDIRECT_URL),{
      method:"POST",
      headers:{"apikey":PUBLISHABLE_KEY,"Content-Type":"application/json"},
      body:JSON.stringify({email,password})
    });
    const data=await r.json();
    if(!r.ok)throw new Error(data.msg||data.error_description||data.message||"Não foi possível criar o acesso.");

    if(data.access_token&&data.refresh_token){
      state.session=data;
      localStorage.setItem("algaroba_session",JSON.stringify(data));
      await loadIdentity();
      const becameAdmin=await tryBootstrapFirstAdmin();
      setClientNavigation();
      if(becameAdmin){
        showToast("Acesso ADM criado.");
        go("internal");
      }else{
        showToast("Acesso criado. Agora complete seu cadastro.");
        go("complete-profile");
      }
    }else{
      localStorage.setItem("algaroba_pending_email",email);
      main.innerHTML=`<div class="login-card auth-success">
        <div class="success-icon">✉️</div>
        <h2>Confirme seu e-mail</h2>
        <p>Enviamos a confirmação para <b>${esc(email)}</b>.</p>
        <p class="small">${internalAccess?"Toque no botão de confirmação recebido no e-mail. Depois de confirmar, o Painel Algaroba abrirá e ativará automaticamente seu perfil Administrador.":"Toque no botão de confirmação recebido no e-mail. Depois de confirmar, o portal Algaroba abrirá novamente para você concluir nome, WhatsApp e endereço."}</p>
        <button class="button" style="width:100%" data-go="login">Já confirmei • Entrar</button>
      </div>`;
    }
  }catch(err){
    showToast(err.message);btn.disabled=false;btn.textContent="Criar acesso →";
  }
};

function renderCompleteProfile(){
  if(!state.session){go("login");return}
  if(state.role){go(state.role==="cliente"?"account":"internal");return}
  main.innerHTML=`<div class="login-card">
    <div class="login-mark"><img src="../algaroba-icon.svg" alt=""></div>
    <h2>Complete seu cadastro</h2>
    <p class="small" style="text-align:center">Informe seus dados. Se encontrarmos um cadastro antigo com os mesmos dados, ele será marcado para conferência sem liberar histórico automaticamente.</p>
    <form onsubmit="window.completeProfile(event)">
      <div class="field"><label>Nome / nome do estabelecimento</label><input id="profileName" autocomplete="name" required></div>
      <div class="field"><label>WhatsApp com DDD</label><input id="profileWhatsapp" inputmode="tel" autocomplete="tel" placeholder="(84) 99999-9999" required></div>
      <div class="field"><label>CPF ou CNPJ <span class="small">(opcional)</span></label><input id="profileDocument" inputmode="numeric" autocomplete="off"></div>
      <button id="profileSubmit" class="button orange" style="width:100%" type="submit">Continuar →</button>
    </form>
  </div>`;
}

window.completeProfile=async e=>{
  e.preventDefault();
  const btn=$("#profileSubmit");btn.disabled=true;btn.textContent="Salvando...";
  try{
    const result=await rpc("concluir_cadastro_cliente",{
      p_nome:$("#profileName").value.trim(),
      p_whatsapp:$("#profileWhatsapp").value.trim(),
      p_cpf_cnpj:$("#profileDocument").value.trim()||null
    },true);
    const row=Array.isArray(result)?result[0]:result;
    await loadIdentity();await loadCatalog();setClientNavigation();
    showToast(row?.cadastro_vinculado_existente?"Cadastro existente localizado e vinculado.":"Cadastro criado com sucesso.");
    go("address-setup");
  }catch(err){
    showToast(err.message);btn.disabled=false;btn.textContent="Continuar →";
  }
};

function renderAddressSetup(){
  if(!state.session||state.role!=="cliente"){go("login");return}
  main.innerHTML=`<div class="login-card address-setup-card">
    <div class="step-pill">Última etapa</div>
    <h2>Endereço principal</h2>
    <p class="small">Digite o CEP primeiro. Quando houver endereço específico, rua, bairro, cidade e UF serão preenchidos automaticamente. Todos os campos continuam editáveis.</p>
    <form onsubmit="window.savePrimaryAddress(event)">
      <div class="field">
        <label>CEP</label>
        <div class="cep-row">
          <input id="addressCep" inputmode="numeric" autocomplete="postal-code" maxlength="9" placeholder="00000-000">
          <button id="cepLookupButton" class="button soft" type="button">Buscar CEP</button>
        </div>
        <div id="cepStatus" class="cep-status" aria-live="polite">Digite os 8 números do CEP.</div>
      </div>
      <div class="field"><label>Rua / avenida</label><input id="addressStreet" autocomplete="street-address" required></div>
      <div class="grid address-grid">
        <div class="field"><label>Número</label><input id="addressNumber" required></div>
        <div class="field"><label>Complemento</label><input id="addressComplement" placeholder="Apto., sala, bloco..."></div>
      </div>
      <div class="field"><label>Bairro</label><input id="addressNeighborhood" required></div>
      <div class="grid address-grid">
        <div class="field"><label>Cidade</label><input id="addressCity" required></div>
        <div class="field"><label>UF</label><input id="addressUf" maxlength="2" required></div>
      </div>
      <div class="field"><label>Ponto de referência <span class="small">(opcional)</span></label><input id="addressReference"></div>
      <button id="addressSubmit" class="button orange" style="width:100%" type="submit">Salvar e continuar →</button>
    </form>
    <button class="button ghost" style="width:100%;margin-top:8px" type="button" onclick="window.skipAddress()">Cadastrar depois</button>
  </div>`;
  window.bindCepLookup();
}

window.bindCepLookup=()=>{
  const input=$("#addressCep"),button=$("#cepLookupButton");
  if(!input||!button)return;
  const format=()=>{
    const digits=input.value.replace(/\D/g,"").slice(0,8);
    input.value=digits.length>5?digits.slice(0,5)+"-"+digits.slice(5):digits;
    if(input.dataset.lookupCep&&input.dataset.lookupCep!==digits)delete input.dataset.lookupCep;
    if(digits.length===8)window.lookupCep(digits);
    else {
      const status=$("#cepStatus");
      if(status){status.textContent="Digite os 8 números do CEP.";status.className="cep-status"}
    }
  };
  input.addEventListener("input",format);
  input.addEventListener("blur",()=>{
    const digits=input.value.replace(/\D/g,"");
    if(digits.length===8)window.lookupCep(digits);
  });
  button.addEventListener("click",()=>{
    const digits=input.value.replace(/\D/g,"");
    if(digits.length!==8){showToast("Digite um CEP com 8 números.");input.focus();return}
    window.lookupCep(digits,true);
  });
};

window.lookupCep=async(cep,force=false)=>{
  const digits=String(cep||"").replace(/\D/g,"");
  if(digits.length!==8)return;
  const status=$("#cepStatus"),button=$("#cepLookupButton");
  const cepInput=$("#addressCep");
  if(!force&&cepInput?.dataset.lookupCep===digits)return;
  const requestId=(window.lookupCep.requestId||0)+1;window.lookupCep.requestId=requestId;
  if(status){status.textContent="Consultando CEP...";status.className="cep-status loading-cep"}
  if(button)button.disabled=true;
  try{
    const r=await fetch("https://viacep.com.br/ws/"+digits+"/json/");
    if(!r.ok)throw new Error("Não foi possível consultar o CEP.");
    const data=await r.json();
    if(requestId!==window.lookupCep.requestId)return;
    if(data.erro)throw new Error("CEP não encontrado.");

    const street=$("#addressStreet"),neighborhood=$("#addressNeighborhood"),city=$("#addressCity"),uf=$("#addressUf");
    if(data.logradouro)street.value=data.logradouro;
    if(data.bairro)neighborhood.value=data.bairro;
    if(data.localidade)city.value=data.localidade;
    if(data.uf)uf.value=data.uf;

    if(cepInput)cepInput.dataset.lookupCep=digits;
    const generic=!data.logradouro||!data.bairro;
    if(status){
      status.textContent=generic
        ?"CEP geral da cidade/região. Cidade e UF foram preenchidas; complete rua e bairro manualmente."
        :"Endereço localizado. Confira os dados e informe número/complemento.";
      status.className="cep-status "+(generic?"generic-cep":"ok-cep");
    }
    if(generic){
      if(!data.logradouro)street.focus();
      else if(!data.bairro)neighborhood.focus();
    }else{
      $("#addressNumber")?.focus();
    }
  }catch(err){
    if(cepInput)delete cepInput.dataset.lookupCep;
    if(status){status.textContent=err.message+" Preencha o endereço manualmente.";status.className="cep-status error-cep"}
  }finally{
    if(button)button.disabled=false;
  }
};
window.savePrimaryAddress=async e=>{
  e.preventDefault();
  const btn=$("#addressSubmit");btn.disabled=true;btn.textContent="Salvando...";
  try{
    await rpc("cliente_salvar_endereco_principal",{
      p_cep:$("#addressCep").value.trim()||null,
      p_logradouro:$("#addressStreet").value.trim(),
      p_numero:$("#addressNumber").value.trim(),
      p_complemento:$("#addressComplement").value.trim()||null,
      p_bairro:$("#addressNeighborhood").value.trim(),
      p_cidade:$("#addressCity").value.trim(),
      p_uf:$("#addressUf").value.trim(),
      p_referencia:$("#addressReference").value.trim()||null
    },true);
    showToast("Endereço salvo.");
    const target=state.returnView||"home";state.returnView=null;go(target);
  }catch(err){
    showToast(err.message);btn.disabled=false;btn.textContent="Salvar e continuar →";
  }
};
window.skipAddress=()=>{const target=state.returnView||"home";state.returnView=null;go(target)};

window.login=async e=>{
  e.preventDefault();const btn=$("#loginSubmit");btn.disabled=true;btn.textContent="Entrando...";
  try{
    const r=await fetch(SUPABASE_URL+"/auth/v1/token?grant_type=password",{method:"POST",headers:{"apikey":PUBLISHABLE_KEY,"Content-Type":"application/json"},body:JSON.stringify({email:$("#email").value.trim(),password:$("#password").value})});
    const data=await r.json();if(!r.ok)throw new Error(data.error_description||data.msg||"E-mail ou senha inválidos.");
    state.session=data;localStorage.setItem("algaroba_session",JSON.stringify(data));
    await loadIdentity();await loadCatalog();setClientNavigation();
    if(!state.role){go("complete-profile");return}
    let target=state.returnView|| (state.role==="cliente"?"home":"internal");
    if(target==="internal"&&state.role==="cliente"){state.returnView=null;showToast("Este acesso é exclusivo para a equipe Algaroba.");go("home");return}
    state.returnView=null;go(target);
  }catch(e2){showToast(e2.message);btn.disabled=false;btn.textContent="Entrar"}
};
window.logout=async()=>{
  try{if(state.session)await fetch(SUPABASE_URL+"/auth/v1/logout",{method:"POST",headers:authHeaders()})}catch{}
  localStorage.removeItem("algaroba_session");state.session=null;state.role=null;state.profile=null;await loadCatalog();setClientNavigation();go("home");
};
window.afterLogin=()=>go(state.role==="cliente"?"home":"internal");
window.startInternalSignup=()=>{state.returnView="internal";go("signup")};

async function renderInfo(){
  loading("Carregando informações...");
  try{
    const info=await rpc("informacoes_portal_cliente",{},false);
    const lines=info?.linhas||state.groups||[];
    main.innerHTML=`
      <div class="section-head"><div><h2>Informações</h2><p>Tudo o que você precisa saber para fazer seu pedido.</p></div></div>

      <div class="info-highlight">
        <div class="info-highlight-icon">🧾</div>
        <div><strong>Pedidos até ${esc(info?.pedido_limite||"11:00")}</strong><p>Os pedidos da rota do dia entram até esse horário para controle e produção pela manhã.</p></div>
      </div>

      <div class="info-highlight">
        <div class="info-highlight-icon">🚚</div>
        <div><strong>Rotas à tarde</strong><p>${esc(info?.mensagem_rota||"As rotas saem normalmente às 14h e não têm horário exato de chegada.")}</p></div>
      </div>

      <div class="info-highlight">
        <div class="info-highlight-icon">🏭</div>
        <div><strong>Produção sob encomenda</strong><p>${esc(info?.producao||"Os shakes são produzidos após o pedido.")}</p></div>
      </div>

      <div class="info-highlight">
        <div class="info-highlight-icon">📦</div>
        <div><strong>Retirada na fábrica</strong><p>${esc(info?.retirada||"Na retirada na fábrica, o preço de atacado vale em qualquer quantidade.")}</p></div>
      </div>

      <div class="info-highlight">
        <div class="info-highlight-icon">💰</div>
        <div><strong>Preço de atacado nas entregas</strong><p>${esc(info?.entrega||"Pedidos com 6 ou mais unidades utilizam preço de atacado.")}</p></div>
      </div>

      <div class="section-head"><div><h2>Conheça nossas linhas</h2><p>Toque em “Fazer pedido” para ver os produtos de cada uma.</p></div></div>
      <div class="info-lines">
        ${lines.map(g=>`<div class="info-line-card">
          <div class="info-line-icon">${groupIcon(g.chave)}</div>
          <div><strong>${esc(g.titulo)}</strong><span>${esc(g.subtitulo||"")}</span><p>${esc(g.descricao||"")}</p></div>
        </div>`).join("")}
      </div>

      <button class="button orange" style="width:100%;margin-top:14px" type="button" onclick="window.openGroups()">Fazer meu pedido →</button>
    `;
  }catch(e){
    main.innerHTML='<div class="empty"><div class="empty-icon">ⓘ</div>Não foi possível carregar as informações agora.</div>';
  }
}

async function renderAccount(){
  if(!state.session){renderLogin();return}
  if(state.role!=="cliente"){go("internal");return}
  loading("Carregando cadastro...");
  try{
    const [addresses,promotions,benefits,conditionRows]=await Promise.all([
      table("cliente_enderecos?select=id,identificacao,logradouro,numero,bairro,cidade,uf,recebimento_inicio,recebimento_fim,intervalo_inicio,intervalo_fim,observacao_recebimento,janela_recebimento_confirmada&ativo=eq.true&order=identificacao.asc"),
      rpc("minhas_promocoes",{},true),
      rpc("meus_beneficios_disponiveis",{},true),
      rpc("minha_condicao_comercial_resumo",{},true)
    ]);
    const condition=Array.isArray(conditionRows)?conditionRows[0]:conditionRows;
    const hasAdvantages=condition?.possui_desconto_especial||condition?.compra_prazo_habilitada||(promotions||[]).length||(benefits||[]).length;

    main.innerHTML=`
      <div class="account-card">
        <h2>Olá, ${esc(state.profile?.nome?.split(" ")[0]||"cliente")}</h2>
        <div class="small">${esc(state.profile?.whatsapp||state.profile?.telefone||"")}</div>
      </div>

      <div class="section-head"><div><h2>Minhas vantagens</h2><p>Mostramos apenas os benefícios disponíveis para você, sem expor métricas financeiras internas.</p></div></div>
      <div class="advantages-grid">
        ${condition?.possui_desconto_especial?`<div class="advantage-card"><span>🏷️</span><div><b>Condição especial ativa</b><small>Seus preços elegíveis já aparecem ajustados no catálogo.</small></div></div>`:""}
        ${condition?.compra_prazo_habilitada?`<div class="advantage-card"><span>🧾</span><div><b>Compra a prazo habilitada</b><small>A opção aparece quando o pedido estiver pronto e elegível.</small></div></div>`:""}
        ${(promotions||[]).map(p=>`<div class="advantage-card"><span>🎯</span><div><b>${esc(p.nome)}</b><small>${esc(p.descricao||p.condicao_texto||"Promoção disponível para seu cadastro.")}</small>${p.tem_desconto?'<em>Condição promocional disponível</em>':""}</div></div>`).join("")}
        ${(benefits||[]).map(b=>`<div class="advantage-card"><span>🎁</span><div><b>${esc(b.nome)}</b><small>${esc(b.descricao||"Brinde disponível para resgate.")}</small><em>Brinde disponível</em></div></div>`).join("")}
        ${!hasAdvantages?'<div class="advantage-empty">As vantagens disponíveis para seu cadastro aparecerão aqui.</div>':""}
      </div>

      <div class="section-head"><div><h2>Horário de recebimento</h2><p>Ajuda a Expedição a organizar a sequência da rota, sem prometer horário de chegada.</p></div></div>
      ${addresses.length?addresses.map(a=>`<div class="account-card"><b>${esc(a.identificacao||"Endereço")}</b><div class="small">${esc(a.logradouro||"")}, ${esc(a.numero||"")} • ${esc(a.bairro||"")}, ${esc(a.cidade||"")}/${esc(a.uf||"")}</div><div class="grid" style="margin-top:8px"><div class="field"><label>Recebe a partir de</label><input id="ini-${a.id}" type="time" value="${fmtTime(a.recebimento_inicio)}"></div><div class="field"><label>Recebe até</label><input id="fim-${a.id}" type="time" value="${fmtTime(a.recebimento_fim)}"></div><div class="field"><label>Intervalo início</label><input id="intini-${a.id}" type="time" value="${fmtTime(a.intervalo_inicio)}"></div><div class="field"><label>Intervalo fim</label><input id="intfim-${a.id}" type="time" value="${fmtTime(a.intervalo_fim)}"></div></div><div class="field"><label>Observação</label><input id="obs-${a.id}" value="${esc(a.observacao_recebimento||"")}" placeholder="Ex.: receber pela porta lateral"></div><button class="button" onclick="window.saveReceiving('${a.id}')">Salvar horário</button></div>`).join(""):'<div class="empty"><div class="empty-icon">📍</div>Nenhum endereço cadastrado.<br><br><button class="button" onclick="window.goAddressSetup()">Cadastrar endereço</button></div>'}
      <div class="actions" style="max-width:470px;margin:14px auto"><button class="button ghost" onclick="window.logout()">Sair da conta</button></div>
    `;
  }catch(e){main.innerHTML='<div class="empty">'+esc(e.message)+'</div>'}
}
window.goAddressSetup=()=>go("address-setup");
window.saveReceiving=async id=>{
  const v=x=>$("#"+x+"-"+id)?.value||null;
  try{await rpc("cliente_salvar_horario_recebimento",{p_endereco_id:id,p_recebimento_inicio:v("ini"),p_recebimento_fim:v("fim"),p_intervalo_inicio:v("intini"),p_intervalo_fim:v("intfim"),p_observacao:$("#obs-"+id)?.value||null},true);showToast("Horário de recebimento salvo.")}
  catch(e){showToast(e.message)}
};

function roleDisplay(role){
  return ({
    administrador:"ADM",
    gerente:"Gerência",
    vendas:"Administrativo",
    financeiro:"Financeiro",
    producao:"Produção",
    expedicao:"Expedição"
  })[role]||role||"Interno";
}
function internalModulesForRole(role){
  if(["administrador","gerente"].includes(role))return ["dashboard","producao","conferencia","expedicao","rota","caixa","estoque","relatorios"];
  if(role==="vendas")return ["dashboard","relatorios"];
  if(role==="financeiro")return ["caixa","relatorios"];
  if(role==="producao")return ["producao"];
  if(role==="expedicao")return ["conferencia","expedicao","rota"];
  return [];
}
function internalModuleMeta(key){
  return ({
    dashboard:{label:"Visão geral",icon:"⌂",desc:"Resumo do dia"},
    producao:{label:"Produção",icon:"◫",desc:"Produzir e separar"},
    conferencia:{label:"Conferência",icon:"✓",desc:"Segunda checagem"},
    expedicao:{label:"Expedição",icon:"▤",desc:"Pedidos prontos"},
    rota:{label:"Rota",icon:"⇢",desc:"Entregas em campo"},
    caixa:{label:"Caixa",icon:"▣",desc:"Recebimentos"},
    estoque:{label:"Estoque",icon:"▦",desc:"Produtos e insumos"},
    relatorios:{label:"Relatórios",icon:"≡",desc:"Vendas e gestão"}
  })[key]||{label:key,icon:"•",desc:""};
}
function internalShell(active){
  const safeRole=typeof state.role==="string"?state.role:"administrador";
  const modules=internalModulesForRole(safeRole);
  return `
    <section class="internal-shell-head">
      <div class="internal-brand">
        <img src="../algaroba-icon.svg" alt="">
        <div><strong>Algaroba Fábrica</strong><span>Painel interno • ${esc(roleDisplay(safeRole))}</span></div>
      </div>
      <div class="internal-head-actions">
        <button class="internal-refresh" type="button" onclick="window.refreshInternal()">↻ Atualizar</button>
        <button class="internal-logout" type="button" onclick="window.logout()">Sair</button>
      </div>
    </section>
    <nav class="internal-nav" aria-label="Módulos internos">
      ${modules.map(key=>{const m=internalModuleMeta(key);return `<button type="button" class="${active===key?"active":""}" onclick="window.openInternalModule('${key}')"><b>${m.icon}</b><span>${m.label}</span><small>${m.desc}</small></button>`}).join("")}
    </nav>
  `;
}
window.openInternalModule=key=>{
  if(!internalModulesForRole(state.role).includes(key)){showToast("Seu perfil não tem acesso a este módulo.");return}
  state.internalModule=key;
  localStorage.setItem("algaroba_internal_module",key);
  renderInternal();
};
window.refreshInternal=()=>renderInternal();
function renderInternal(){
  if(!state.session||!state.role){state.returnView="internal";go("login");return}
  setClientNavigation();
  const allowed=internalModulesForRole(state.role);
  if(!allowed.length){main.innerHTML='<div class="empty">Perfil interno sem módulo configurado.</div>';return}
  if(!allowed.includes(state.internalModule))state.internalModule=allowed[0];
  localStorage.setItem("algaroba_internal_module",state.internalModule);

  if(state.internalModule==="dashboard")return renderAdmin();
  if(state.internalModule==="producao")return renderProduction();
  if(state.internalModule==="conferencia")return renderConference();
  if(state.internalModule==="expedicao")return renderExpedition();
  if(state.internalModule==="rota")return renderRoute();
  if(state.internalModule==="caixa")return renderCash();
  if(state.internalModule==="estoque")return renderStock();
  if(state.internalModule==="relatorios")return renderReports();
  state.internalModule=allowed[0];return renderInternal();
}
async function renderAdministrative(){
  loading("Carregando Administrativo...");
  try{
    const [flow,rows]=await Promise.all([
      rpc("painel_fluxo_interno",{},true),
      rpc("administrativo_pedidos_fila",{p_limit:120},true)
    ]);
    const f=Array.isArray(flow)?flow[0]:flow||{};
    state.adminOrders=rows||[];
    const open=state.adminOrders.filter(x=>!["entregue","cancelado","devolvido"].includes(x.status)).length;
    main.innerHTML=`
      ${internalShell("administrativo")}
      <section class="internal-title">
        <div><span class="internal-eyebrow">CENTRAL ADMINISTRATIVA</span><h1>Pedidos e atendimento</h1><p>Acompanhe o pedido desde a entrada até a entrega.</p></div>
      </section>
      <div class="internal-kpis">
        <button onclick="window.adminSetFilter('')" class="internal-kpi"><span>Hoje</span><b>${f.pedidos_hoje||0}</b><small>${brl(f.total_pedidos_hoje||0)}</small></button>
        <button onclick="window.adminSetFilter('recebido')" class="internal-kpi"><span>Entrada</span><b>${f.recebidos||0}</b><small>recebidos</small></button>
        <button onclick="window.adminSetFilter('em_producao')" class="internal-kpi"><span>Produção</span><b>${f.em_producao||0}</b><small>em andamento</small></button>
        <button onclick="window.adminSetFilter('pronto')" class="internal-kpi"><span>Prontos</span><b>${f.prontos_aguardando_pagamento||0}</b><small>aguardando pagamento</small></button>
        <button onclick="window.adminSetFilter('pagamento_confirmado')" class="internal-kpi"><span>Expedição</span><b>${f.liberados_expedicao||0}</b><small>liberados</small></button>
      </div>
      <section class="internal-toolbar">
        <label class="internal-search"><span>⌕</span><input id="adminOrderSearch" type="search" value="${esc(state.adminQuery)}" placeholder="Buscar pedido, cliente ou WhatsApp" oninput="window.adminFilterOrders(this.value)"></label>
        <div class="internal-chip-row">
          <button onclick="window.adminSetFilter('')">Todos</button>
          <button onclick="window.adminSetFilter('recebido')">Recebidos</button>
          <button onclick="window.adminSetFilter('em_producao')">Produção</button>
          <button onclick="window.adminSetFilter('pronto')">Prontos</button>
          <button onclick="window.adminSetFilter('pagamento_confirmado')">Liberados</button>
          <button onclick="window.adminSetFilter('entregue')">Entregues</button>
        </div>
      </section>
      <div id="adminOrdersList"></div>
      <div class="internal-footnote">${open} pedidos ainda em fluxo • os módulos Produção, Financeiro e Expedição atualizam esta tela automaticamente.</div>
      <div class="section-head"><div><h2>Histórico unificado do cliente</h2><p>Sistema antigo + sistema novo, somente para uso administrativo.</p></div></div>
      <div class="admin-client-tool">
        <div class="admin-client-search">
          <input id="adminClientSearch" type="search" placeholder="Buscar por nome, WhatsApp ou CPF/CNPJ">
          <button class="button" type="button" onclick="window.adminSearchClients()">Buscar</button>
        </div>
        <div class="admin-period">
          <label>De <input id="adminClientStart" type="date" value="${new Date().getFullYear()}-01-01"></label>
          <label>Até <input id="adminClientEnd" type="date" value="${new Date().getFullYear()}-12-31"></label>
        </div>
        <div id="adminClientResults" class="admin-client-results"><div class="small">Pesquise um cliente para abrir o relatório anual unificado.</div></div>
        <div id="adminClientReport"></div>
      </div>
    `;
    renderAdministrativeRows();
  }catch(e){main.innerHTML=internalShell("administrativo")+'<div class="empty">'+esc(e.message)+'</div>'}
}
function renderAdministrativeRows(){
  const box=document.querySelector("#adminOrdersList");if(!box)return;
  const q=(state.adminQuery||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
  const rows=state.adminOrders.filter(x=>{
    if(!q)return true;
    const hay=[x.numero,x.cliente_nome,x.whatsapp,x.status,x.status_financeiro,x.modalidade_entrega,x.rota_nome].filter(Boolean).join(" ").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
    return hay.includes(q);
  });
  box.innerHTML=`<section class="internal-list">
    ${rows.length?rows.map(x=>`<article class="internal-order-card">
      <div class="internal-order-main">
        <div class="internal-order-number">${esc(x.numero)}</div>
        <h3>${esc(x.cliente_nome)}</h3>
        <p>${fmtDateTime(x.data_pedido)} • ${esc(x.itens)} itens / ${Number(x.unidades||0).toLocaleString("pt-BR")} un.</p>
        <div class="internal-statuses"><span class="status ${statusClass(x.status)}">${esc(x.status)}</span><span class="status ${statusClass(x.status_financeiro)}">${esc(x.status_financeiro)}</span></div>
      </div>
      <div class="internal-order-logistics"><span>${x.modalidade_entrega==="retirada_fabrica"?"Retirada na fábrica":esc(x.rota_nome||x.modalidade_entrega||"Entrega a definir")}</span><small>${x.data_entrega_prevista?fmtDate(x.data_entrega_prevista):"Sem data prevista"}</small></div>
      <div class="internal-order-money"><b>${brl(x.total)}</b><small>Pago ${brl(x.valor_pago)}</small><small>Pendente ${brl(x.valor_pendente)}</small></div>
    </article>`).join(""):'<div class="empty">Nenhum pedido encontrado.</div>'}
  </section>`;
}
window.adminFilterOrders=v=>{state.adminQuery=v;renderAdministrativeRows()};
window.adminSetFilter=status=>{state.adminQuery=status;const e=document.querySelector("#adminOrderSearch");if(e)e.value=status;renderAdministrativeRows()};
async function renderProduction(){
  loading("Carregando Produção...");
  try{
    const rows=await rpc("producao_fila",{},true)||[],groups={};
    rows.forEach(x=>(groups[x.pedido_id]??=[]).push(x));
    const ids=Object.keys(groups);
    main.innerHTML=internalShell("producao")+`
      <section class="internal-title">
        <div><span class="internal-eyebrow">PRODUÇÃO</span><h1>Pedidos para produzir</h1><p>Abra um pedido e confira item por item.</p></div>
      </section>
      <section class="production-order-list">
        ${ids.length?ids.map(pid=>{
          const it=groups[pid],first=it[0];
          const done=it.filter(x=>["pronto","separado","indisponivel"].includes(x.status_item)).length;
          const allDone=done===it.length;
          const open=state.productionOpenOrder===pid;
          return `<article class="production-order-card ${allDone?"complete":""}">
            <button class="production-order-summary" type="button" onclick="window.toggleProductionOrder('${pid}')">
              <div>
                <span class="production-order-no">${esc(first.numero)}</span>
                <strong>${esc(first.cliente_nome)}</strong>
                <small>${it.length} itens • ${done} conferidos</small>
              </div>
              <div class="production-progress">
                <b>${done}/${it.length}</b>
                <span>${allDone?"✓ Pronto":open?"Fechar":"Abrir"} ${open?"⌃":"⌄"}</span>
              </div>
            </button>
            ${open?`<div class="production-order-body">
              ${it.map(x=>{
                const resolved=["pronto","separado","indisponivel"].includes(x.status_item);
                const unavailable=x.status_item==="indisponivel";
                const ready=x.status_item==="pronto"||x.status_item==="separado";
                return `<div class="production-item ${resolved?"resolved":""} ${unavailable?"unavailable":""}">
                  <div class="production-item-check">${ready?"✓":unavailable?"!":"○"}</div>
                  <div class="production-item-copy">
                    <strong>${esc(x.produto)}</strong>
                    <small>Solicitado: ${Number(x.quantidade_solicitada).toLocaleString("pt-BR")} • ${x.modelo_fornecimento==="estoque"?"estoque":"produção"}</small>
                    ${ready?`<span class="prod-done">${x.status_item==="separado"?"Separado e pronto":"Pronto"}</span>`:""}
                    ${unavailable?'<span class="prod-missing">Produto em falta • estoque indisponível</span>':""}
                  </div>
                  <div class="production-item-actions">
                    ${!resolved&&x.modelo_fornecimento==="estoque"?`
                      <button class="prod-primary" onclick="window.prodUpdate('${x.item_id}','${pid}','separado',${Number(x.quantidade_solicitada)})">✓ Separado</button>
                      <button onclick="window.prodAdjust('${x.item_id}','${pid}',${Number(x.quantidade_solicitada)},${Number(x.quantidade_faturada||x.quantidade_solicitada)})">Ajustar qtd.</button>
                      <button class="prod-missing-btn" onclick="window.prodUpdate('${x.item_id}','${pid}','indisponivel',0)">Em falta</button>
                    `:!resolved?`
                      <button class="prod-primary" onclick="window.prodUpdate('${x.item_id}','${pid}','pronto',${Number(x.quantidade_solicitada)})">✓ Pronto</button>
                    `:""}
                  </div>
                </div>`;
              }).join("")}
              <div class="production-order-footer">
                <span>${done} de ${it.length} itens concluídos</span>
                ${allDone?'<b>✓ Pedido pronto para seguir à Expedição</b>':'<small>Conclua todos os itens para finalizar automaticamente.</small>'}
              </div>
            </div>`:""}
          </article>`;
        }).join(""):'<div class="empty">Nenhum pedido aguardando produção.</div>'}
      </section>
    `;
  }catch(e){main.innerHTML=internalShell("producao")+'<div class="empty">'+esc(e.message)+'</div>'}
}
window.toggleProductionOrder=id=>{
  state.productionOpenOrder=state.productionOpenOrder===id?null:id;
  renderProduction();
};
window.prodUpdate=async(id,pedidoId,status,q)=>{
  const obs=status==="indisponivel"?"Estoque indisponível — produto em falta.":null;
  const y=window.scrollY;
  try{
    await rpc("producao_atualizar_item",{p_item_id:id,p_status:status,p_quantidade_faturada:q,p_observacao:obs},true);
    const rows=await rpc("producao_fila",{},true)||[];
    const orderItems=rows.filter(x=>x.pedido_id===pedidoId);
    const allDone=orderItems.length&&orderItems.every(x=>["pronto","separado","indisponivel"].includes(x.status_item));    if(allDone){
      await rpc("producao_finalizar_pedido",{p_pedido_id:pedidoId},true);
      state.productionOpenOrder=null;
      showToast("Pedido pronto e enviado para a Expedição.");    }else{
      state.productionOpenOrder=pedidoId;
      showToast(status==="indisponivel"?"Produto marcado em falta.":"Item concluído.");
    }
    await renderProduction();
    requestAnimationFrame(()=>window.scrollTo(0,y));
  }catch(e){showToast(e.message)}
};
window.prodAdjust=async(id,pedidoId,solicitada,atual)=>{
  const raw=prompt("Quantidade realmente disponível (máximo "+solicitada+"):",String(atual).replace(".",","));
  if(raw===null)return;
  const qtd=Number(raw.replace(",","."));
  if(!Number.isFinite(qtd)||qtd<0||qtd>solicitada){showToast("Quantidade inválida.");return}
  const obs=qtd<=0?"Estoque indisponível — produto em falta.":qtd<solicitada?"Quantidade parcial disponível em estoque.":null;
  const status=qtd<=0?"indisponivel":"separado";
  const y=window.scrollY;
  try{
    await rpc("producao_atualizar_item",{p_item_id:id,p_status:status,p_quantidade_faturada:qtd,p_observacao:obs},true);
    const rows=await rpc("producao_fila",{},true)||[];
    const orderItems=rows.filter(x=>x.pedido_id===pedidoId);
    const allDone=orderItems.length&&orderItems.every(x=>["pronto","separado","indisponivel"].includes(x.status_item));
    if(allDone){
      await rpc("producao_finalizar_pedido",{p_pedido_id:pedidoId},true);
      state.productionOpenOrder=null;
      showToast("Pedido pronto e enviado para a Expedição.");
    }else{
      state.productionOpenOrder=pedidoId;
      showToast("Quantidade confirmada.");
    }
    await renderProduction();
    requestAnimationFrame(()=>window.scrollTo(0,y));
  }catch(e){showToast(e.message)}
};
window.prodFinish=async id=>{
  try{await rpc("producao_finalizar_pedido",{p_pedido_id:id},true);showToast("Pedido pronto e enviado para a Expedição.");await renderProduction()}catch(e){showToast(e.message)}
};


async function renderExpedition(){
  loading("Carregando Expedição...");
  try{
    const today=localDateISO();
    const [rows,planning,executions]=await Promise.all([
      rpc("expedicao_conferencia_fila",{},true),
      rpc("expedicao_planejamento_rota",{p_data:today},true),
      table("rota_execucoes?select=id,rota_id,data_rota,status,hora_saida_prevista,saiu_em,finalizada_em,motorista,veiculo,odometro_inicio,odometro_fim,entregas_planejadas,entregas_concluidas,entregas_pendentes&data_rota=eq."+today)
    ]);
    const groups={};(rows||[]).forEach(x=>(groups[x.pedido_id]??=[]).push(x));
    const routeGroups={};(planning||[]).forEach(x=>(routeGroups[x.rota_id]??={meta:x,items:[]}).items.push(x));

    main.innerHTML=internalShell("expedicao")+`
      <section class="internal-title">
        <div><span class="internal-eyebrow">EXPEDIÇÃO</span><h1>Conferência e saída</h1><p>Segunda conferência: abra o pedido, confira cada item e finalize.</p></div>
      </section>
      <section class="expedition-order-list">
        ${Object.keys(groups).length?Object.entries(groups).map(([pid,it])=>{
          const first=it[0],checked=it.filter(x=>x.expedicao_conferido).length,all=checked===it.length;
          const open=state.expeditionOpenOrder===pid;
          const expReady=["pronto_rota","pronto_retirada","conferido"].includes(first.expedicao_status);
          const readyLabel=first.modalidade_entrega==="retirada_fabrica"?"Pronto para retirada":first.modalidade_entrega==="rota"?"Pronto para rota":"Conferência concluída";
          const finalLabel=first.modalidade_entrega==="retirada_fabrica"?"Pedido pronto para retirada":first.modalidade_entrega==="rota"?"Pedido pronto para rota":"Concluir conferência";
          return `<article class="expedition-order-card ${expReady?"ready":""}">
            <button class="expedition-order-summary" type="button" onclick="window.toggleExpeditionOrder('${pid}')">
              <div>
                <span>${esc(first.numero)}</span>
                <strong>${esc(first.cliente_nome)}</strong>
                <small>${first.modalidade_entrega==="retirada_fabrica"?"Retirada na fábrica":esc(first.rota_nome||"Rota")} • ${checked}/${it.length} conferidos</small>
              </div>
              <div class="expedition-summary-status">
                <b class="${expReady?"ok":all?"warn":""}">${expReady?"✓ "+readyLabel:checked+"/"+it.length}</b>
                <small>${first.liberado_financeiro?"Financeiro liberado":"Aguardando financeiro"}</small>
                <em>${open?"⌃":"⌄"}</em>
              </div>
            </button>
            ${open?`<div class="expedition-order-body">
              <div class="expedition-address">${esc(first.endereco||"")}</div>
              ${it.map(x=>`<button class="expedition-item ${x.expedicao_conferido?"checked":""}" type="button" onclick="window.expCheckItem('${x.item_id}','${pid}',${x.expedicao_conferido?"false":"true"})">
                <span class="expedition-check">${x.expedicao_conferido?"✓":"○"}</span>
                <div><strong>${esc(x.produto)}</strong><small>${Number(x.quantidade).toLocaleString("pt-BR")} un.</small></div>
                <b>${x.expedicao_conferido?"Conferido":"Conferir"}</b>
              </button>`).join("")}
              <div class="expedition-order-footer">
                ${!expReady&&all?`<button class="button orange" onclick="window.expFinishCheck('${pid}')">${finalLabel}</button>`:""}
                ${expReady?`<div class="expedition-ready"><b>✓ ${readyLabel}</b><small>${first.liberado_financeiro?"Pedido liberado pelo Financeiro.":"Conferência física concluída. Aguarde a liberação financeira para saída/retirada."}</small></div>`:""}
                ${expReady&&first.liberado_financeiro&&first.status_pedido==="pagamento_confirmado"&&first.modalidade_entrega==="rota"?`<button class="button" onclick="window.expUpdate('${pid}','saiu_entrega')">Saiu para entrega →</button>`:""}
                ${expReady&&first.liberado_financeiro&&first.status_pedido==="pagamento_confirmado"&&first.modalidade_entrega==="retirada_fabrica"?`<button class="button" onclick="window.expUpdate('${pid}','entregue')">Confirmar retirada ✓</button>`:""}
                ${first.status_pedido==="saiu_entrega"?'<div class="notice green">Pedido em rota.</div>':""}
              </div>
            </div>`:""}
          </article>`;
        }).join(""):'<div class="empty">Nenhum pedido aguardando conferência na Expedição.</div>'}
      </section>

      <div class="section-head"><div><h2>Planejamento de hoje</h2><p>${fmtDate(today)} • rotas liberadas para organização</p></div></div>
      ${Object.values(routeGroups).length?Object.values(routeGroups).map(g=>{
        const x=executions.find(e=>e.rota_id===g.meta.rota_id);
        return `<div class="panel expedition-route-panel">
          <div class="summary"><div><b>${esc(g.meta.rota_nome)}</b><span class="status ${x?.status==="em_rota"?"warn":x?.status==="finalizada"?"ok":""}">${esc(x?.status||"planejada")}</span></div>
          <div class="small">${g.items.length} entregas • saída padrão ${fmtTime(g.meta.hora_saida_padrao)}</div>
          <div class="inline-actions">
            ${!x||x.status==="planejada"?`<button class="button" onclick="window.startRoute('${g.meta.rota_id}','${today}')">Iniciar rota</button>`:""}
            ${x?.status==="em_rota"?`<button class="button orange" onclick="window.finishRoute('${x.id}')">Finalizar rota</button>`:""}
          </div></div>
        </div>`;
      }).join(""):'<div class="empty compact">Nenhuma rota planejada para hoje.</div>'}
    `;
  }catch(e){main.innerHTML=internalShell("expedicao")+'<div class="empty">'+esc(e.message)+'</div>'}
}
window.toggleExpeditionOrder=id=>{
  state.expeditionOpenOrder=state.expeditionOpenOrder===id?null:id;
  renderExpedition();
};
window.expCheckItem=async(id,pedidoId,checked)=>{
  const y=window.scrollY;
  try{
    await rpc("expedicao_conferir_item",{p_item_id:id,p_conferido:checked,p_observacao:null},true);
    state.expeditionOpenOrder=pedidoId;
    await renderExpedition();
    requestAnimationFrame(()=>window.scrollTo(0,y));
  }catch(e){showToast(e.message)}
};
window.expFinishCheck=async pedidoId=>{
  try{
    const status=await rpc("expedicao_finalizar_conferencia",{p_pedido_id:pedidoId},true);
    state.expeditionOpenOrder=pedidoId;
    showToast(status==="pronto_retirada"?"Pedido pronto para retirada.":status==="pronto_rota"?"Pedido pronto para rota.":"Conferência concluída.");
    await renderExpedition();
  }catch(e){showToast(e.message)}
};
window.expUpdate=async(id,status)=>{
  try{await rpc("expedicao_atualizar_status",{p_pedido_id:id,p_novo_status:status},true);showToast("Status atualizado.");state.internalModule="expedicao";state.expeditionOpenOrder=id;await renderExpedition()}catch(e){showToast(e.message)}
};
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
    main.innerHTML=internalShell("financeiro")+`
      <div class="internal-title"><div><span class="internal-eyebrow">FINANCEIRO</span><h1>Pagamentos e liberação</h1><p>Conferência financeira antes da Expedição.</p></div></div>
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
window.approveProof=async id=>{try{await rpc("financeiro_aprovar_comprovante",{p_comprovante_id:id,p_observacao:"Aprovado pelo painel"},true);showToast("Pagamento aprovado.");state.internalModule="financeiro";await renderFinance()}catch(e){showToast(e.message)}};
window.rejectProof=async id=>{const motivo=prompt("Motivo da rejeição:");if(!motivo)return;try{await rpc("financeiro_rejeitar_comprovante",{p_comprovante_id:id,p_motivo:motivo},true);showToast("Comprovante rejeitado.");await renderFinance()}catch(e){showToast(e.message)}};

async function renderCash(){
  loading("Carregando Caixa...");
  try{
    const [panelRows,moves,pendingRows,deliveryPendingRows]=await Promise.all([
      rpc("caixa_painel",{},true),
      rpc("caixa_movimentos_recentes",{p_limit:40},true),
      rpc("financeiro_pagamentos_pendentes",{},true),
      rpc("financeiro_pendencias_entrega",{},true)
    ]);
    const c=Array.isArray(panelRows)?panelRows[0]:panelRows;
    const pending=pendingRows||[];
    const deliveryPending=deliveryPendingRows||[];
    main.innerHTML=internalShell("caixa")+`
      <section class="internal-title"><div><span class="internal-eyebrow">CAIXA</span><h1>Movimento do caixa</h1><p>Abertura, recebimentos, sangrias e fechamento.</p></div></section>
      ${c?`
        <section class="cash-balance">
          <span>Saldo calculado</span><b>${brl(c.saldo_calculado)}</b><small>Aberto em ${fmtDateTime(c.aberto_em)} • ${c.movimentos||0} movimentos</small>
        </section>
        <section class="cash-mini-kpis">
          <div><span>Inicial</span><b>${brl(c.saldo_inicial)}</b></div>
          <div><span>Entradas</span><b>${brl(c.entradas)}</b></div>
          <div><span>Saídas</span><b>${brl(c.saidas)}</b></div>
        </section>
        <div class="cash-actions">
          <button onclick="window.cashMove('suprimento')"><b>＋</b><span>Suprimento</span></button>
          <button onclick="window.cashMove('sangria')"><b>−</b><span>Sangria</span></button>
          <button onclick="window.cashMove('entrada')"><b>↧</b><span>Entrada</span></button>
          <button onclick="window.cashMove('saida')"><b>↥</b><span>Saída</span></button>
          <button class="close" onclick="window.cashClose(${Number(c.saldo_calculado||0)})"><b>✓</b><span>Fechar caixa</span></button>
        </div>
      `:`
        <section class="cash-closed"><b>Caixa fechado</b><p>Abra o caixa para começar a registrar os movimentos.</p><button class="button orange" onclick="window.cashOpen()">Abrir caixa</button></section>
      `}
      <div class="section-head"><div><h2>Pendências vindas da entrega</h2><p>Pedidos já entregues que ficaram com saldo em aberto.</p></div></div>
      <div class="cash-pending delivery-finance-pending">
        ${deliveryPending.length?deliveryPending.map(x=>`<article><div><b>${esc(x.numero)} • ${esc(x.cliente_nome)}</b><small>Entregue ${fmtDateTime(x.entregue_em)} • saldo ${brl(x.valor_pendente)}</small></div><button onclick="window.cashReceiveDelivery('${x.pedido_id}',${Number(x.valor_pendente)})">Receber</button></article>`).join(""):'<div class="empty compact">Nenhuma pendência financeira vinda da rota.</div>'}
      </div>
      <div class="section-head"><div><h2>Recebimentos pendentes</h2><p>Pedidos prontos aguardando confirmação.</p></div></div>
      <div class="cash-pending">
        ${pending.length?pending.slice(0,8).map(x=>`<article><div><b>${esc(x.numero)} • ${esc(x.cliente_nome)}</b><small>${esc(x.metodo)} • pendente ${brl(x.valor_pendente)}</small></div><button onclick="window.cashReceive('${x.pedido_id}',${Number(x.valor_pendente)})">Dar recebido</button></article>`).join(""):'<div class="empty compact">Nenhum recebimento manual pendente.</div>'}
      </div>
      <div class="section-head"><div><h2>Movimentos recentes</h2><p>Últimos lançamentos deste caixa e anteriores.</p></div></div>
      <div class="cash-movements">
        ${(moves||[]).length?(moves||[]).map(m=>`<article class="${["saida","sangria","estorno"].includes(m.tipo)?"out":"in"}"><div><b>${esc(m.descricao||m.tipo)}</b><small>${m.pedido_numero?esc(m.pedido_numero)+" • ":""}${fmtDateTime(m.created_at)}</small></div><strong>${["saida","sangria","estorno"].includes(m.tipo)?"−":"＋"}${brl(m.valor)}</strong></article>`).join(""):'<div class="empty compact">Sem movimentos registrados.</div>'}
      </div>
    `;
  }catch(e){main.innerHTML=internalShell("caixa")+'<div class="empty">'+esc(e.message)+'</div>'}
}
window.cashOpen=async()=>{
  const raw=prompt("Saldo inicial do caixa:","0");if(raw===null)return;
  const value=Number(raw.replace(",","."));if(!Number.isFinite(value)||value<0){showToast("Saldo inválido.");return}
  const obs=prompt("Observação da abertura (opcional):")||null;
  try{await rpc("caixa_abrir",{p_saldo_inicial:value,p_observacao:obs},true);showToast("Caixa aberto.");await renderCash()}catch(e){showToast(e.message)}
};
window.cashMove=async tipo=>{
  const labels={suprimento:"Suprimento",sangria:"Sangria",entrada:"Entrada",saida:"Saída"};
  const raw=prompt("Valor da "+labels[tipo]+":","0,00");if(raw===null)return;
  const value=Number(raw.replace(".","").replace(",","."));if(!Number.isFinite(value)||value<=0){showToast("Valor inválido.");return}
  const desc=prompt("Descrição / observação:")||labels[tipo];
  try{await rpc("caixa_registrar_movimento",{p_tipo:tipo,p_valor:value,p_metodo:null,p_descricao:desc},true);showToast(labels[tipo]+" registrada.");await renderCash()}catch(e){showToast(e.message)}
};
window.cashClose=async expected=>{
  const raw=prompt("Valor contado no caixa:",String(expected.toFixed(2)).replace(".",","));if(raw===null)return;
  const value=Number(raw.replace(".","").replace(",","."));if(!Number.isFinite(value)||value<0){showToast("Valor inválido.");return}
  const obs=prompt("Observação do fechamento (opcional):")||null;
  try{
    const rows=await rpc("caixa_fechar",{p_saldo_final_informado:value,p_observacao:obs},true);
    const x=Array.isArray(rows)?rows[0]:rows;
    showToast("Caixa fechado. Diferença: "+brl(x?.diferenca||0));
    await renderCash();
  }catch(e){showToast(e.message)}
};
window.cashReceive=async(id,pending)=>{
  const raw=prompt("Valor recebido:",String(pending).replace(".",","));if(raw===null)return;
  const value=Number(raw.replace(",","."));if(!Number.isFinite(value)||value<=0||value>pending){showToast("Valor inválido.");return}
  const obs=prompt("Observação / nº da nota (opcional):")||null;
  try{await rpc("financeiro_registrar_pagamento_manual",{p_pedido_id:id,p_valor:value,p_observacao:obs},true);showToast("Recebimento registrado.");await renderCash()}catch(e){showToast(e.message)}
};
window.cashReceiveDelivery=async(id,pending)=>{
  const choice=prompt("Forma recebida: 1 Dinheiro • 2 Pix • 3 Crédito • 4 Débito","1");if(choice===null)return;
  const method=({"1":"dinheiro","2":"pix","3":"credito","4":"debito"})[choice.trim()];
  if(!method){showToast("Forma de pagamento inválida.");return}
  const raw=prompt("Valor recebido:",String(pending).replace(".",","));if(raw===null)return;
  const value=Number(raw.replace(",","."));if(!Number.isFinite(value)||value<=0||value>pending){showToast("Valor inválido.");return}
  const obs=prompt("Observação / nº da nota (opcional):")||null;
  try{
    await rpc("financeiro_receber_pendencia_entrega",{p_pedido_id:id,p_metodo:method,p_valor:value,p_observacao:obs},true);
    showToast("Recebimento registrado e cliente notificado.");
    await renderCash();
  }catch(e){showToast(e.message)}
};

async function renderStock(){
  loading("Carregando Estoque...");
  try{
    const [products,inputs]=await Promise.all([
      rpc("estoque_painel",{},true),
      rpc("estoque_insumos_painel",{},true)
    ]);
    main.innerHTML=internalShell("estoque")+`
      <section class="internal-title"><div><span class="internal-eyebrow">ESTOQUE</span><h1>Estoque atual</h1><p>Produtos prontos e matérias-primas da fábrica.</p></div></section>
      <div class="stock-section-head"><div><h2>Produtos prontos</h2><p>Xaropes, coberturas, grãos e complementos.</p></div><span>${(products||[]).length} itens</span></div>
      <section class="stock-big-grid">
        ${(products||[]).length?(products||[]).map(s=>`<article class="stock-big-card ${s.abaixo_minimo?"low":""}">
          <div class="stock-big-name"><strong>${esc(s.produto)}</strong><small>${esc(s.categoria||"")}</small></div>
          <div class="stock-big-number"><b>${Number(s.quantidade_atual).toLocaleString("pt-BR")}</b><span>em estoque</span></div>
          <div class="stock-big-meta"><span>Mínimo <b>${Number(s.estoque_minimo).toLocaleString("pt-BR")}</b></span><span class="status ${s.disponibilidade_catalogo==="disponivel"?"ok":"bad"}">${esc(s.disponibilidade_catalogo)}</span></div>
          <div class="stock-big-actions">
            <button onclick="window.adminStockEntry('${s.produto_id}',${Number(s.quantidade_atual)})"><b>＋</b><span>Entrada</span></button>
            <button onclick="window.adminSetStock('${s.produto_id}',${Number(s.quantidade_atual)},${Number(s.estoque_minimo)})"><b>↕</b><span>Ajustar</span></button>
          </div>
        </article>`).join(""):'<div class="empty compact">Nenhum produto de estoque cadastrado.</div>'}
      </section>
      <div class="stock-section-head"><div><h2>Matérias-primas</h2><p>Saborizantes, embalagens, etiquetas e ingredientes.</p></div><span>${(inputs||[]).length} itens</span></div>
      <section class="stock-big-grid raw-materials">
        ${(inputs||[]).length?(inputs||[]).map(s=>`<article class="stock-big-card ${s.abaixo_minimo?"low":""}">
          <div class="stock-big-name"><strong>${esc(s.insumo)}</strong><small>${esc(s.categoria)} • ${esc(s.unidade)}</small></div>
          <div class="stock-big-number"><b>${Number(s.quantidade_atual).toLocaleString("pt-BR")}</b><span>${esc(s.unidade)} em estoque</span></div>
          <div class="stock-big-meta"><span>Mínimo <b>${Number(s.estoque_minimo).toLocaleString("pt-BR")}</b></span>${s.abaixo_minimo?'<span class="status warn">baixo</span>':""}</div>
        </article>`).join(""):'<div class="raw-material-placeholder"><b>Pronto para cadastrar</b><p>Quando você me passar a relação de matérias-primas e as receitas, elas entram aqui e passam a alimentar o controle automático de consumo.</p></div>'}
      </section>
    `;
  }catch(e){main.innerHTML=internalShell("estoque")+'<div class="empty">'+esc(e.message)+'</div>'}
}

async function renderAdmin(){
  loading("Carregando visão geral...");
  try{
    const [flowRows,allRows]=await Promise.all([
      rpc("painel_fluxo_interno",{},true),
      rpc("administrativo_pedidos_fila",{p_limit:80},true)
    ]);
    const flow=Array.isArray(flowRows)?flowRows[0]:flowRows||{};
    const now=new Date();
    const today=(allRows||[]).filter(x=>{
      const d=new Date(x.data_pedido);
      return d.getFullYear()===now.getFullYear()&&d.getMonth()===now.getMonth()&&d.getDate()===now.getDate();
    });
    const clients=new Set(today.map(x=>x.cliente_id||x.cliente_nome).filter(Boolean));
    const total=today.reduce((s,x)=>s+Number(x.total||0),0);
    const pending=today.filter(x=>!["pago","cancelado","estornado"].includes(x.status_financeiro)).length;
    const received=today.filter(x=>["recebido","confirmado"].includes(x.status)).length;
    const production=today.filter(x=>x.status==="em_producao").length;
    const ready=today.filter(x=>x.status==="pronto").length;
    const released=today.filter(x=>["pagamento_confirmado","saiu_entrega"].includes(x.status)).length;

    main.innerHTML=internalShell("dashboard")+`
      <section class="internal-title dashboard-title">
        <div><span class="internal-eyebrow">HOJE • ${new Date().toLocaleDateString("pt-BR")}</span><h1>Visão geral</h1><p>O que está acontecendo na fábrica agora.</p></div>
      </section>
      <section class="today-kpis">
        <div><span>Pedidos</span><b>${today.length}</b></div>
        <div><span>Clientes</span><b>${clients.size}</b></div>
        <div><span>Valor do dia</span><b>${brl(total)}</b></div>
        <div><span>Financeiro pendente</span><b>${pending}</b></div>
      </section>
      <section class="today-flow">
        <span><b>${received}</b> Entrada</span>
        <span><b>${production}</b> Produção</span>
        <span><b>${ready}</b> Prontos</span>
        <span><b>${released}</b> Liberados</span>
      </section>
      ${["administrador","gerente"].includes(state.role)?`<button class="test-lab-entry" type="button" onclick="window.openTestClient()"><div><span>AMBIENTE DE TESTE</span><b>Entrar como Cliente Teste Algaroba</b><small>Faça um pedido e acompanhe todo o fluxo sem misturar com dados reais.</small></div><strong>Testar →</strong></button>`:""}
      <section class="today-orders-card">
        <div class="today-orders-head"><div><strong>Pedidos de hoje</strong><small>${today.length} pedidos</small></div><button type="button" onclick="window.openInternalModule('relatorios')">Relatórios →</button></div>
        <div class="today-orders-scroll">
          ${today.length?today.map(x=>`<article class="today-order">
            <div><b>${esc(x.cliente_nome)}</b><small>${esc(x.numero)} • ${fmtDateTime(x.data_pedido)}</small></div>
            <div class="today-order-status"><span class="status ${statusClass(x.status)}">${esc(x.status)}</span><strong>${brl(x.total)}</strong></div>
          </article>`).join(""):'<div class="empty compact">Nenhum pedido feito hoje.</div>'}
        </div>
      </section>
    `;
  }catch(e){main.innerHTML=internalShell("dashboard")+'<div class="empty">'+esc(e.message)+'</div>'}
}
window.adminSearchClients=async()=>{
  const box=document.querySelector("#adminClientResults");
  const term=document.querySelector("#adminClientSearch")?.value?.trim()||"";
  if(box)box.innerHTML='<div class="loading"><span class="spinner"></span><span>Buscando clientes...</span></div>';
  try{
    const rows=await rpc("admin_buscar_clientes_unificados",{p_busca:term||null},true)||[];
    if(!box)return;
    box.innerHTML=rows.length?rows.slice(0,30).map(c=>`<button class="admin-client-result" type="button" onclick="window.adminOpenUnifiedClient('${c.cliente_referencia_id}')"><div><b>${esc(c.nome_exibicao)}</b><small>${esc(c.whatsapp||c.cpf_cnpj||"Sem telefone/documento")}</small><small>${c.registros_vinculados>1?c.registros_vinculados+" cadastros administrativos unificados":esc(c.nomes_registros||"")}</small></div><span>Ver relatório →</span></button>`).join(""):'<div class="empty">Nenhum cliente encontrado.</div>';
  }catch(e){if(box)box.innerHTML='<div class="empty">'+esc(e.message)+'</div>'}
};
window.adminOpenUnifiedClient=async clientId=>{
  const reportBox=document.querySelector("#adminClientReport");
  const start=document.querySelector("#adminClientStart")?.value||null;
  const end=document.querySelector("#adminClientEnd")?.value||null;
  if(reportBox)reportBox.innerHTML='<div class="loading"><span class="spinner"></span><span>Montando histórico unificado...</span></div>';
  try{
    const [summaryRows,history]=await Promise.all([
      rpc("admin_resumo_cliente_unificado",{p_cliente_id:clientId,p_inicio:start,p_fim:end},true),
      rpc("admin_relatorio_cliente_unificado",{p_cliente_id:clientId,p_inicio:start,p_fim:end},true)
    ]);
    const s=Array.isArray(summaryRows)?summaryRows[0]:summaryRows;
    if(!reportBox)return;
    reportBox.innerHTML=`
      <div class="admin-unified-report">
        <div class="section-head compact"><div><h3>${esc(s?.nome_exibicao||"Cliente")}</h3><p>${start?fmtDate(start):"Início"} a ${end?fmtDate(end):"Hoje"}</p></div></div>
        <div class="kpis admin-client-kpis">
          <div class="kpi"><b>${s?.pedidos||0}</b><small>Pedidos no período</small></div>
          <div class="kpi"><b>${brl(s?.total_comprado||0)}</b><small>Total comprado</small></div>
          <div class="kpi"><b>${brl(s?.total_pago||0)}</b><small>Total pago</small></div>
          <div class="kpi"><b>${brl(s?.saldo_pendente||0)}</b><small>Saldo pendente</small></div>
        </div>
        <div class="panel admin-history-list">
          ${(history||[]).length?(history||[]).map(o=>`<div class="row"><div><div class="row-title">${esc(o.numero)} • ${esc(o.cliente_nome_registro)}</div><div class="row-sub">${fmtDateTime(o.data_pedido)} • ${o.origem==="my_loja_store"?"Sistema antigo":"Sistema novo"}</div><div style="margin-top:6px"><span class="status ${statusClass(o.status)}">${esc(o.status)}</span> <span class="status ${o.visivel_no_portal?"ok":"warn"}">${o.visivel_no_portal?"Visível no portal":"Somente administrativo"}</span></div></div><div style="text-align:right"><b>${brl(o.total)}</b><div class="row-sub">Pago ${brl(o.valor_pago)}</div></div></div>`).join(""):'<div class="empty">Sem compras neste período.</div>'}
        </div>
      </div>
    `;
  }catch(e){if(reportBox)reportBox.innerHTML='<div class="empty">'+esc(e.message)+'</div>'}
};

window.adminStockEntry=async(id,current)=>{
  const raw=prompt("Quantidade que está entrando no estoque:","1");if(raw===null)return;
  const qtd=Number(raw.replace(",","."));if(!Number.isFinite(qtd)||qtd<=0){showToast("Quantidade inválida.");return}
  const obs=prompt("Observação da entrada (opcional):")||null;
  try{await rpc("admin_movimentar_estoque",{p_produto_id:id,p_quantidade:qtd,p_tipo:"entrada",p_observacao:obs},true);showToast("Entrada registrada.");await loadCatalog();await renderStock()}catch(e){showToast(e.message)}
};
window.adminSetStock=async(id,current,minCurrent)=>{
  const raw=prompt("Saldo físico atual:",String(current).replace(".",","));if(raw===null)return;
  const qtd=Number(raw.replace(",","."));if(!Number.isFinite(qtd)||qtd<0){showToast("Quantidade inválida.");return}
  const rawMin=prompt("Estoque mínimo:",String(minCurrent).replace(".",","));if(rawMin===null)return;
  const minimo=Number(rawMin.replace(",","."));if(!Number.isFinite(minimo)||minimo<0){showToast("Estoque mínimo inválido.");return}
  const obs=prompt("Motivo do ajuste (opcional):")||null;
  try{await rpc("admin_ajustar_estoque",{p_produto_id:id,p_nova_quantidade:qtd,p_estoque_minimo:minimo,p_observacao:obs},true);showToast("Estoque ajustado.");await loadCatalog();await renderStock()}catch(e){showToast(e.message)}
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

const __internalFlow=installInternalFlow({
  state,main,rpc,table,internalShell,loading,esc,showToast,localDateISO,fmtDate,fmtTime,brl,renderFinance,renderInternal
});
renderProduction=__internalFlow.renderProduction;
renderConference=__internalFlow.renderConference;
renderExpedition=__internalFlow.renderExpedition;
renderRoute=__internalFlow.renderRoute;
renderFinance=__internalFlow.renderFinance;

const __internalAdmin=installInternalAdmin({
  state,main,rpc,internalShell,loading,esc,showToast,brl,fmtDate,fmtDateTime,loadCatalog,statusClass,
  renderDashboard:renderAdmin,renderInternal
});
renderTestClient=__internalAdmin.renderTestClient;
renderReports=__internalAdmin.renderReports;
window.openTestClient=()=>renderTestClient();

boot();
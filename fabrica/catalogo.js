const SUPABASE_URL="https://zqyehddgyiqtbynnoecz.supabase.co";
const PUBLISHABLE_KEY="sb_publishable_WERTeRIu5m88f89HfjSdWg_AlI91sb5";
const $=s=>document.querySelector(s);
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const brl=v=>Number(v||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
const collator=new Intl.Collator("pt-BR",{sensitivity:"base"});
let catalog=[],query="",lineFilter="all";

function lineInfo(line){
  const map={
    Tradicional:{code:"T",cls:"tradicional",label:"Linha Tradicional"},
    Zero:{code:"Z",cls:"zero",label:"Linha Zero"},
    Classic:{code:"C",cls:"classic",label:"Linha Classic"},
    Intense:{code:"I",cls:"intense",label:"Linha Intense"},
    Raiz:{code:"R",cls:"raiz",label:"Linha Raiz"}
  };
  return map[line]||{code:"•",cls:"classic",label:line||""};
}
function normalized(v){return String(v||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase()}
function measure(p){
  const n=Number(p.peso_volume); if(!n)return"";
  if(p.unidade==="kg")return n===1?"1 kg":n.toLocaleString("pt-BR")+" kg";
  if(p.unidade==="L")return n===1?"1 L":n.toLocaleString("pt-BR")+" L";
  return n.toLocaleString("pt-BR")+" "+(p.unidade||"");
}
function baseVisible(p){
  if(!query)return true;
  return normalized([p.produto,p.sabor,p.linha,p.categoria].join(" ")).includes(normalized(query));
}
function shakeGroups(){
  const map=new Map();
  catalog.filter(p=>p.categoria==="Shakes").forEach(p=>{
    const key=(p.linha||"")+"|"+(p.sabor||p.produto);
    if(!map.has(key))map.set(key,{line:p.linha,name:p.sabor||p.produto,variants:[]});
    map.get(key).variants.push(p);
  });
  return [...map.values()].sort((a,b)=>collator.compare(a.name,b.name));
}
function groupVisible(g){
  const matchesLine=lineFilter==="all"||g.line===lineFilter;
  const matchesSearch=baseVisible({produto:g.name,sabor:g.name,linha:g.line,categoria:"Shakes"});
  return matchesLine&&matchesSearch;
}
function priceText(group){
  const variants=[...group.variants].sort((a,b)=>Number(a.peso_volume)-Number(b.peso_volume));
  if(variants.length===1){
    const p=variants[0];
    return `${measure(p)} • Atacado ${brl(p.preco_atacado)} • Varejo ${brl(p.preco_varejo)}`;
  }
  return variants.map(p=>`${measure(p)} • Atacado ${brl(p.preco_atacado)} • Varejo ${brl(p.preco_varejo)}`).join(" | ");
}
function renderFilters(){
  const filters=[
    ["all","Todos"],
    ["Tradicional","Tradicional"],
    ["Zero","Zero"],
    ["Classic","Classic"],
    ["Intense","Intense"],
    ["Raiz","Raiz"]
  ];
  return `<div class="catalog-filters">${filters.map(([key,label])=>`<button type="button" class="${lineFilter===key?"active":""}" data-line-filter="${key}">${label}</button>`).join("")}</div>`;
}
function renderShakes(){
  const all=shakeGroups();
  const groups=all.filter(groupVisible);
  const baseCount=all.filter(g=>g.line!=="Raiz").length;
  const raizCount=all.filter(g=>g.line==="Raiz").length;
  return `<section id="shakes" class="catalog-section">
    <div class="section-title"><div><h2>Nossos sabores</h2><small>${baseCount} sabores + ${raizCount} Tradicional Raiz • em ordem alfabética</small></div></div>
    ${renderFilters()}
    <div class="shake-grid official-shake-list">
      ${groups.map(g=>{
        const l=lineInfo(g.line);
        return `<article class="shake-item official-shake-card">
          <span class="catalog-thumb thumb-${l.cls}" aria-hidden="true"></span>
          <div class="shake-copy">
            <strong>${esc(g.name)}</strong>
            <small>${esc(l.label)}</small>
            <em>${esc(priceText(g))}</em>
          </div>
          <b class="line-badge ${l.cls}" title="${esc(l.label)}">${l.code}</b>
        </article>`;
      }).join("")||'<div class="status-box">Nenhum shake encontrado com este filtro.</div>'}
    </div>
  </section>`;
}
function productTile(p,thumbClass){
  return `<article class="product-tile official-product-tile ${p.disponibilidade_catalogo==="em_falta"?"unavailable":""}">
    <span class="catalog-thumb ${thumbClass}" aria-hidden="true"></span>
    <div>
      <strong>${esc(p.sabor||p.produto)}</strong>
      <small>${esc(p.produto)} • ${esc(measure(p))}</small>
      <em>Atacado ${brl(p.preco_atacado)} • Varejo ${brl(p.preco_varejo)}</em>
    </div>
  </article>`;
}
function renderOther(){
  const syrup=catalog.filter(p=>p.categoria==="Xaropes"&&baseVisible(p)).sort((a,b)=>collator.compare(a.sabor||a.produto,b.sabor||b.produto));
  const cover=catalog.filter(p=>p.categoria==="Coberturas"&&baseVisible(p)).sort((a,b)=>collator.compare(a.sabor||a.produto,b.sabor||b.produto));
  const grains=catalog.filter(p=>p.categoria==="Grãos e Farináceos"&&baseVisible(p)).sort((a,b)=>collator.compare(a.sabor||a.produto,b.sabor||b.produto));
  return `
    <section id="syrups" class="catalog-section">
      <div class="section-title"><div><h2>Xaropes e Coberturas</h2><small>${syrup.length+cover.length} produtos</small></div></div>
      <div class="product-groups">
        <div class="subgroup"><h3>Xaropes</h3><div class="tile-grid">${syrup.map(p=>productTile(p,"thumb-syrup")).join("")||'<div class="status-box">Nenhum xarope encontrado.</div>'}</div></div>
        <div class="subgroup"><h3>Coberturas</h3><div class="tile-grid">${cover.map(p=>productTile(p,"thumb-syrup")).join("")||'<div class="status-box">Nenhuma cobertura encontrada.</div>'}</div></div>
      </div>
    </section>
    <section id="grains" class="catalog-section">
      <div class="section-title"><div><h2>Grãos e Farináceos</h2><small>${grains.length} produtos</small></div></div>
      <div class="tile-grid">${grains.map(p=>productTile(p,"thumb-grain")).join("")||'<div class="status-box">Nenhum produto encontrado.</div>'}</div>
    </section>`;
}
function bindDynamic(){
  document.querySelectorAll("[data-line-filter]").forEach(b=>b.addEventListener("click",()=>{
    lineFilter=b.dataset.lineFilter;
    render();
    document.getElementById("shakes")?.scrollIntoView({behavior:"smooth",block:"start"});
  }));
}
function render(){
  $("#catalogStatus").classList.add("hidden");
  $("#catalogContent").innerHTML=renderShakes()+renderOther();
  bindDynamic();
}
async function load(){
  try{
    const r=await fetch(SUPABASE_URL+"/rest/v1/rpc/catalogo_publico",{
      method:"POST",
      headers:{"apikey":PUBLISHABLE_KEY,"Content-Type":"application/json"},
      body:"{}"
    });
    if(!r.ok)throw new Error("Não foi possível carregar o catálogo.");
    catalog=await r.json();
    render();
  }catch(e){$("#catalogStatus").textContent=e.message}
}
$("#catalogSearch").addEventListener("input",e=>{query=e.target.value.trim();render()});
document.querySelectorAll("[data-jump]").forEach(b=>b.addEventListener("click",()=>document.getElementById(b.dataset.jump)?.scrollIntoView({behavior:"smooth",block:"start"})));
load();
const SUPABASE_URL="https://zqyehddgyiqtbynnoecz.supabase.co";
const PUBLISHABLE_KEY="sb_publishable_WERTeRIu5m88f89HfjSdWg_AlI91sb5";
const $=s=>document.querySelector(s);
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const brl=v=>Number(v||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
const collator=new Intl.Collator("pt-BR",{sensitivity:"base"});
let catalog=[],query="";

function lineInfo(line){
  const m={
    Tradicional:{code:"T",cls:"tradicional",label:"Linha Tradicional"},
    Zero:{code:"Z",cls:"zero",label:"Linha Zero"},
    Classic:{code:"C",cls:"classic",label:"Linha Classic"},
    Intense:{code:"I",cls:"intense",label:"Linha Intense"},
    Raiz:{code:"R",cls:"raiz",label:"Linha Raiz"}
  };
  return m[line]||{code:"•",cls:"classic",label:line||""};
}
function normalized(v){return String(v||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase()}
function measure(p){const n=Number(p.peso_volume);if(!n)return"";return p.unidade==="kg"?(n===1?"1 kg":n.toLocaleString("pt-BR")+" kg"):(n===1?"1 L":n.toLocaleString("pt-BR")+" L")}
function baseVisible(p){if(!query)return true;return normalized([p.produto,p.sabor,p.linha,p.categoria].join(" ")).includes(normalized(query))}

function shakeGroups(){
  const map=new Map();
  catalog.filter(p=>p.categoria==="Shakes").forEach(p=>{
    const key=(p.linha||"")+"|"+(p.sabor||p.produto);
    if(!map.has(key))map.set(key,{line:p.linha,name:p.sabor||p.produto,variants:[]});
    map.get(key).variants.push(p);
  });
  return [...map.values()].sort((a,b)=>collator.compare(a.name,b.name));
}
function priceText(group){
  const variants=[...group.variants].sort((a,b)=>Number(a.peso_volume)-Number(b.peso_volume));
  if(variants.length===1){
    const p=variants[0];return `${measure(p)} • Atac. ${brl(p.preco_atacado)} • Var. ${brl(p.preco_varejo)}`;
  }
  return variants.map(p=>`${measure(p)} ${brl(p.preco_atacado)}/${brl(p.preco_varejo)}`).join(" • ");
}
function renderShakes(){
  const groups=shakeGroups().filter(g=>baseVisible({produto:g.name,sabor:g.name,linha:g.line,categoria:"Shakes"}));
  const baseCount=shakeGroups().filter(g=>g.line!=="Raiz").length;
  const raizCount=shakeGroups().filter(g=>g.line==="Raiz").length;
  return `<section id="shakes" class="catalog-section">
    <div class="section-title"><div><h2>Shakes</h2><small>${baseCount} sabores + ${raizCount} Tradicional Raiz • ${baseCount+raizCount} opções</small></div></div>
    <div class="shake-grid">${groups.map(g=>{const l=lineInfo(g.line);return `<article class="shake-item"><b class="line-badge ${l.cls}" title="${esc(l.label)}">${l.code}</b><div class="shake-copy"><strong>${esc(g.name)}</strong><small>${esc(l.label)}</small><em>${esc(priceText(g))}</em></div></article>`}).join("")||'<div class="status-box">Nenhum shake encontrado.</div>'}</div>
  </section>`;
}
function productTile(p){
  return `<article class="product-tile ${p.disponibilidade_catalogo==="em_falta"?"unavailable":""}"><strong>${esc(p.sabor||p.produto)}</strong><small>${esc(p.produto)} • ${esc(measure(p))}</small><em>Atacado ${brl(p.preco_atacado)} • Varejo ${brl(p.preco_varejo)}</em></article>`;
}
function renderOther(){
  const syrup=catalog.filter(p=>p.categoria==="Xaropes"&&baseVisible(p)).sort((a,b)=>collator.compare(a.sabor||a.produto,b.sabor||b.produto));
  const cover=catalog.filter(p=>p.categoria==="Coberturas"&&baseVisible(p)).sort((a,b)=>collator.compare(a.sabor||a.produto,b.sabor||b.produto));
  const grains=catalog.filter(p=>p.categoria==="Grãos e Farináceos"&&baseVisible(p)).sort((a,b)=>collator.compare(a.sabor||a.produto,b.sabor||b.produto));
  return `<section id="syrups" class="catalog-section"><div class="section-title"><div><h2>Xaropes e Coberturas</h2><small>${syrup.length+cover.length} produtos</small></div></div><div class="product-groups"><div class="subgroup"><h3>Xaropes</h3><div class="tile-grid">${syrup.map(productTile).join("")||'<div class="status-box">Nenhum xarope encontrado.</div>'}</div></div><div class="subgroup"><h3>Coberturas</h3><div class="tile-grid">${cover.map(productTile).join("")||'<div class="status-box">Nenhuma cobertura encontrada.</div>'}</div></div></div></section>
  <section id="grains" class="catalog-section"><div class="section-title"><div><h2>Grãos e Farináceos</h2><small>${grains.length} produtos</small></div></div><div class="tile-grid">${grains.map(productTile).join("")||'<div class="status-box">Nenhum produto encontrado.</div>'}</div></section>`;
}
function render(){
  $("#catalogStatus").classList.add("hidden");
  $("#catalogContent").innerHTML=renderShakes()+renderOther();
}
async function load(){
  try{
    const r=await fetch(SUPABASE_URL+"/rest/v1/rpc/catalogo_publico",{method:"POST",headers:{"apikey":PUBLISHABLE_KEY,"Content-Type":"application/json"},body:"{}"});
    if(!r.ok)throw new Error("Não foi possível carregar o catálogo.");
    catalog=await r.json();
    render();
  }catch(e){$("#catalogStatus").textContent=e.message}
}
$("#catalogSearch").addEventListener("input",e=>{query=e.target.value.trim();render()});
document.querySelectorAll("[data-jump]").forEach(b=>b.addEventListener("click",()=>document.getElementById(b.dataset.jump)?.scrollIntoView({behavior:"smooth",block:"start"})));
load();
export function installInternalOrders(ctx){
  const {state,main,rpc,internalShell,loading,esc,showToast,brl,fmtDate,groupScene,productVisualClass,measure,displayProductName}=ctx;
  if(!state.deskOrder)state.deskOrder={source:"whatsapp",client:null,results:[],catalog:[],deliveryOptions:[],selectedDelivery:null,selectedGroup:null,drafts:{},cart:{},query:""};

  function d(){return state.deskOrder}
  function reset(){
    var source=d().source||"whatsapp";
    state.deskOrder={source:source,client:null,results:[],catalog:[],deliveryOptions:[],selectedDelivery:null,selectedGroup:null,drafts:{},cart:{},query:""};
  }
  function cartItems(){
    return Object.entries(d().cart||{}).map(function(pair){
      var p=(d().catalog||[]).find(function(x){return x.produto_id===pair[0]});
      return p?{p:p,q:Number(pair[1])}:null;
    }).filter(Boolean).filter(function(x){return x.q>0});
  }
  function units(){return cartItems().reduce(function(s,x){return s+x.q},0)}
  function price(p,mode){return Number(mode==="retirada_fabrica"||units()>=6?p.preco_atacado:p.preco_varejo)}
  function productsOf(group){
    var catalog=d().catalog||[];
    if(!group)return[];
    if(group.chave==="tradicional")return catalog.filter(function(p){return ["Tradicional","Zero","Raiz"].includes(p.linha)});
    if(group.chave==="classic")return catalog.filter(function(p){return p.linha==="Classic"});
    if(group.chave==="intense")return catalog.filter(function(p){return p.linha==="Intense"});
    if(group.chave==="graos-farinaceos")return catalog.filter(function(p){return p.categoria==="Grãos e Farináceos"});
    if(group.chave==="xaropes-coberturas")return catalog.filter(function(p){return ["Xaropes","Coberturas"].includes(p.categoria)});
    return[];
  }
  function draft(key){return d().drafts[key]||(d().drafts[key]={})}
  function clientBar(){
    var c=d().client;if(!c)return"";
    return "<section class='desk-client-bar'><div><small>CLIENTE SELECIONADO</small><strong>"+esc(c.nome)+"</strong><span>"+(c.codigo_cliente?"Código "+esc(c.codigo_cliente)+" • ":"")+esc(c.whatsapp||"sem WhatsApp")+"</span></div><button type='button' data-desk-action='change-client'>Trocar</button></section>";
  }

  function searchScreen(){
    var x=d();
    main.innerHTML=internalShell("pedidos")+
      "<section class='internal-title'><div><span class='internal-eyebrow'>NOVO PEDIDO</span><h1>Tirar pedido</h1><p>Venda de WhatsApp ou atendimento de balcão.</p></div></section>"+
      "<section class='desk-source'>"+
        "<button class='"+(x.source==="whatsapp"?"active":"")+"' data-desk-source='whatsapp'><b>◉</b><span>WhatsApp</span><small>Pedido recebido pelo atendimento</small></button>"+
        "<button class='"+(x.source==="pdv"?"active":"")+"' data-desk-source='pdv'><b>▣</b><span>Balcão</span><small>Cliente atendido na fábrica</small></button>"+
      "</section>"+
      "<form class='desk-search' data-desk-form='search'><label>Quem está comprando?</label><div><input id='deskClientQuery' value='"+esc(x.query||"")+"' placeholder='Código, nome, WhatsApp ou CPF/CNPJ' autocomplete='off'><button type='submit'>Buscar</button></div><small>Ex.: digite <b>10</b> para procurar o cliente de código 10.</small></form>"+
      "<section class='desk-client-results'>"+
        (x.results.length?x.results.map(function(c){
          return "<article><div class='desk-code'>"+esc(c.codigo_cliente||"—")+"</div><div><strong>"+esc(c.nome)+"</strong><span>"+esc(c.whatsapp||"Sem WhatsApp")+(c.cidade?" • "+esc(c.cidade):"")+"</span></div><button type='button' data-desk-client='"+c.cliente_id+"'>Tirar pedido →</button></article>";
        }).join(""):"<div class='desk-search-hint'>Pesquise o cliente para começar o pedido.</div>")+
      "</section>";
    bind();
  }

  function categoriesScreen(){
    var x=d(),its=cartItems(),u=units(),mode=x.selectedDelivery?x.selectedDelivery.modalidade:null;
    var total=its.reduce(function(s,it){return s+it.q*price(it.p,mode)},0);
    main.innerHTML=internalShell("pedidos")+clientBar()+
      "<section class='desk-step-head'><div><span>PASSO 2</span><h1>Escolha a linha</h1><p>Adicione produtos de quantas linhas precisar.</p></div><b>"+(x.source==="pdv"?"Balcão":"WhatsApp")+"</b></section>"+
      "<div class='desk-category-grid'>"+
        (state.groups||[]).map(function(g){
          return "<button class='desk-category-card category-"+g.chave+"' type='button' data-desk-group='"+g.chave+"'>"+groupScene(g.chave)+"<div><strong>"+esc(g.titulo)+"</strong><span>"+esc(g.subtitulo||"")+"</span><small>Abrir produtos</small></div><i>›</i></button>";
        }).join("")+
      "</div>"+
      (its.length?"<section class='desk-cart-strip'><div><b>"+u+" "+(u===1?"item":"itens")+"</b><span>Total estimado "+brl(total)+"</span></div><button data-desk-action='review'>Revisar e finalizar →</button></section>":"");
    bind();
  }

  function productsScreen(){
    var x=d(),g=(state.groups||[]).find(function(z){return z.chave===x.selectedGroup});
    if(!g){x.selectedGroup=null;return categoriesScreen()}
    var list=productsOf(g),dr=draft(g.chave);
    main.innerHTML=internalShell("pedidos")+clientBar()+
      "<div class='desk-product-head'><button data-desk-action='back-groups'>‹</button><div><small>ADICIONANDO AO PEDIDO</small><h1>"+esc(g.titulo)+"</h1><p>"+esc(g.subtitulo||"")+"</p></div></div>"+
      "<div class='desk-products'>"+
        list.map(function(p){
          var unavailable=p.disponibilidade_catalogo==="em_falta";
          return "<article class='desk-product'><div class='desk-product-photo "+productVisualClass(p)+"'>"+(p.imagem_url?"<img src='"+esc(p.imagem_url)+"' alt=''>":"")+"</div><div class='desk-product-copy'><small>"+(measure(p)||"1 kg")+"</small><strong>"+esc(displayProductName(p,g))+"</strong><span>Atac. <b>"+brl(p.preco_atacado)+"</b> • Var. <b>"+brl(p.preco_varejo)+"</b></span></div><div class='desk-product-qty'>"+
            (unavailable?"<em>Em falta</em>":"<button data-desk-qty='"+p.produto_id+"' data-delta='-1' "+(!dr[p.produto_id]?"disabled":"")+">−</button><output>"+(dr[p.produto_id]||0)+"</output><button class='plus' data-desk-qty='"+p.produto_id+"' data-delta='1'>+</button>")+
          "</div></article>";
        }).join("")+
      "</div><section class='desk-add-footer'><button data-desk-action='commit-group'>Adicionar itens e voltar às linhas →</button></section>";
    bind();
  }

  function reviewScreen(){
    var x=d(),its=cartItems(),u=units();
    if(!its.length)return categoriesScreen();
    var mode=x.selectedDelivery?x.selectedDelivery.modalidade:null;
    var total=its.reduce(function(s,it){return s+it.q*price(it.p,mode)},0);
    main.innerHTML=internalShell("pedidos")+clientBar()+
      "<section class='desk-step-head'><div><span>PASSO 3</span><h1>Revisar pedido</h1><p>Confira os produtos e escolha como o cliente receberá.</p></div><b>"+u+" itens</b></section>"+
      "<section class='desk-review-list'>"+
        its.map(function(it){
          return "<article><div><strong>"+esc(it.p.produto)+"</strong><span>"+measure(it.p)+" • "+brl(price(it.p,mode))+" un.</span></div><div class='desk-review-qty'><button data-desk-cart='"+it.p.produto_id+"' data-delta='-1'>−</button><b>"+it.q+"</b><button data-desk-cart='"+it.p.produto_id+"' data-delta='1'>+</button></div><strong>"+brl(it.q*price(it.p,mode))+"</strong></article>";
        }).join("")+
      "</section>"+
      "<section class='desk-delivery'><h2>Como vai receber?</h2><div>"+
        (x.deliveryOptions||[]).map(function(o,i){
          var title=o.modalidade==="retirada_fabrica"?"Retirada na fábrica":o.modalidade==="rota"?"Rota • "+esc(o.rota_nome||""):"Entrega a combinar";
          var info=o.cidade?esc(o.cidade)+(o.bairro?" • "+esc(o.bairro):""):esc(o.observacao||"");
          if(o.proxima_data)info+=" • "+fmtDate(o.proxima_data);
          return "<button class='"+(x.selectedDelivery===o?"active":"")+"' data-desk-delivery='"+i+"'><b>"+title+"</b><span>"+info+"</span></button>";
        }).join("")+
      "</div></section>"+
      "<label class='desk-note'>Observação do pedido<textarea id='deskOrderNote' rows='2' placeholder='Opcional'></textarea></label>"+
      "<section class='desk-total'><div><span>Total estimado</span><small>"+(u>=6||mode==="retirada_fabrica"?"Preço atacado":"Preço varejo")+"</small></div><b>"+brl(total)+"</b></section>"+
      "<div class='desk-review-actions'><button class='secondary' data-desk-action='back-groups'>← Continuar comprando</button><button class='primary' data-desk-action='submit' "+(!x.selectedDelivery?"disabled":"")+">Finalizar pedido →</button></div>";
    bind();
  }

  async function selectClient(id){
    var x=d(),c=x.results.find(function(z){return z.cliente_id===id});if(!c)return;
    loading("Abrindo cliente...");
    try{
      var data=await Promise.all([
        rpc("administrativo_catalogo_cliente",{p_cliente_id:id},true),
        rpc("administrativo_opcoes_entrega_cliente",{p_cliente_id:id},true)
      ]);
      x.client=c;x.catalog=data[0]||[];x.deliveryOptions=data[1]||[];
      x.selectedDelivery=x.source==="pdv"?(x.deliveryOptions.find(function(o){return o.modalidade==="retirada_fabrica"})||null):null;
      x.selectedGroup=null;x.drafts={};x.cart={};categoriesScreen();
    }catch(e){showToast(e.message);searchScreen()}
  }

  async function submit(){
    var x=d(),its=cartItems();
    if(!x.client||!its.length||!x.selectedDelivery){showToast("Complete o pedido antes de finalizar.");return}
    var btn=document.querySelector("[data-desk-action='submit']");if(btn){btn.disabled=true;btn.textContent="Enviando..."}
    try{
      var rows=await rpc("administrativo_criar_pedido",{
        p_cliente_id:x.client.cliente_id,
        p_itens:its.map(function(it){return {produto_id:it.p.produto_id,quantidade:it.q}}),
        p_modalidade_entrega:x.selectedDelivery.modalidade,
        p_endereco_id:x.selectedDelivery.endereco_id||null,
        p_origem:x.source,
        p_observacao:(document.querySelector("#deskOrderNote")||{}).value||null
      },true);
      var order=Array.isArray(rows)?rows[0]:rows,client=x.client,source=x.source;
      reset();d().source=source;
      main.innerHTML=internalShell("pedidos")+"<section class='desk-success'><div>✓</div><h1>Pedido registrado</h1><p><b>"+esc(order.numero)+"</b><br>"+esc(client.nome)+"</p><strong>"+brl(order.total)+"</strong><span>O pedido já entrou na fila operacional.</span><button data-desk-action='new'>Tirar próximo pedido</button></section>";
      bind();
    }catch(e){showToast(e.message);if(btn){btn.disabled=false;btn.textContent="Finalizar pedido →"}}
  }

  function bind(){
    document.querySelectorAll("[data-desk-source]").forEach(function(b){b.onclick=function(){d().source=b.dataset.deskSource;searchScreen()}});
    var form=document.querySelector("[data-desk-form='search']");
    if(form)form.onsubmit=async function(ev){
      ev.preventDefault();var q=(document.querySelector("#deskClientQuery").value||"").trim();
      if(!q){showToast("Digite o código, nome ou telefone do cliente.");return}
      try{d().query=q;d().results=await rpc("administrativo_buscar_clientes",{p_busca:q},true)||[];searchScreen();if(!d().results.length)showToast("Nenhum cliente encontrado.")}catch(e){showToast(e.message)}
    };
    document.querySelectorAll("[data-desk-client]").forEach(function(b){b.onclick=function(){selectClient(b.dataset.deskClient)}});
    document.querySelectorAll("[data-desk-group]").forEach(function(b){b.onclick=function(){d().selectedGroup=b.dataset.deskGroup;productsScreen()}});
    document.querySelectorAll("[data-desk-qty]").forEach(function(b){b.onclick=function(){var dr=draft(d().selectedGroup),id=b.dataset.deskQty,next=Math.max(0,Number(dr[id]||0)+Number(b.dataset.delta||0));if(next)dr[id]=next;else delete dr[id];productsScreen()}});
    document.querySelectorAll("[data-desk-cart]").forEach(function(b){b.onclick=function(){var id=b.dataset.deskCart,next=Math.max(0,Number(d().cart[id]||0)+Number(b.dataset.delta||0));if(next)d().cart[id]=next;else delete d().cart[id];reviewScreen()}});
    document.querySelectorAll("[data-desk-delivery]").forEach(function(b){b.onclick=function(){d().selectedDelivery=d().deliveryOptions[Number(b.dataset.deskDelivery)]||null;reviewScreen()}});
    document.querySelectorAll("[data-desk-action]").forEach(function(b){b.onclick=function(){
      var a=b.dataset.deskAction;
      if(a==="change-client"){reset();searchScreen()}
      else if(a==="back-groups"){d().selectedGroup=null;categoriesScreen()}
      else if(a==="commit-group"){var key=d().selectedGroup,dr=draft(key);Object.entries(dr).forEach(function(pair){if(Number(pair[1])>0)d().cart[pair[0]]=Number(d().cart[pair[0]]||0)+Number(pair[1])});d().drafts[key]={};d().selectedGroup=null;categoriesScreen()}
      else if(a==="review")reviewScreen();
      else if(a==="submit")submit();
      else if(a==="new"){reset();searchScreen()}
    }});
  }

  function renderDeskOrders(){
    if(!d().client)return searchScreen();
    if(d().selectedGroup)return productsScreen();
    return categoriesScreen();
  }

  return {renderDeskOrders:renderDeskOrders};
}

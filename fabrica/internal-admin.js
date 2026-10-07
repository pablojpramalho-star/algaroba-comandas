
export function installInternalAdmin(ctx){
  const state=ctx.state,main=ctx.main,rpc=ctx.rpc,internalShell=ctx.internalShell,loading=ctx.loading,esc=ctx.esc,showToast=ctx.showToast,brl=ctx.brl,fmtDateTime=ctx.fmtDateTime,loadCatalog=ctx.loadCatalog,statusClass=ctx.statusClass;
  if(!state.testCart)state.testCart={};
  if(!state.testLastOrder)state.testLastOrder=null;

  function productName(p){return p.sabor||p.produto||"Produto"}
  function testItems(){
    return Object.entries(state.testCart).map(function(pair){
      var p=(state.catalog||[]).find(function(x){return x.produto_id===pair[0]});
      return p?{p:p,q:Number(pair[1])}:null;
    }).filter(Boolean);
  }
  function testQty(id,delta){
    var next=Math.max(0,Number(state.testCart[id]||0)+delta);
    if(next)state.testCart[id]=next;else delete state.testCart[id];
  }

  async function renderTestClient(){
    loading("Abrindo cliente de teste...");
    try{
      if(!state.catalog||!state.catalog.length)await loadCatalog();
      var data=await Promise.all([rpc("admin_teste_cliente_info",{},true),rpc("admin_teste_notificacoes",{},true)]);
      var info=Array.isArray(data[0])?data[0][0]:data[0],notifications=data[1]||[];
      var products=(state.catalog||[]).filter(function(p){return p.categoria==="Shakes"&&p.disponibilidade_catalogo!=="em_falta"}).sort(function(a,b){return productName(a).localeCompare(productName(b),"pt-BR")});
      var items=testItems(),units=items.reduce(function(s,x){return s+x.q},0);
      var mode=state.testDeliveryMode||"rota";
      var estimated=items.reduce(function(s,x){var wholesale=mode==="retirada_fabrica"||units>=6;return s+x.q*Number(wholesale?x.p.preco_atacado:x.p.preco_varejo)},0);
      var productsHtml=products.map(function(p){
        var q=Number(state.testCart[p.produto_id]||0);
        return "<article class='test-product' data-search='"+esc((productName(p)+" "+(p.linha||"")).toLowerCase())+"'><div><strong>"+esc(productName(p))+"</strong><small>"+esc(p.linha||p.categoria)+" • 1 kg</small><span>Atacado "+brl(p.preco_atacado)+" • Varejo "+brl(p.preco_varejo)+"</span></div><div class='test-product-qty'><button type='button' data-test-action='qty' data-id='"+p.produto_id+"' data-delta='-1'>−</button><b>"+q+"</b><button type='button' data-test-action='qty' data-id='"+p.produto_id+"' data-delta='1'>＋</button></div></article>";
      }).join("");
      var last=state.testLastOrder?"<section class='test-success'><div><span>ÚLTIMO PEDIDO</span><h2>"+esc(state.testLastOrder.numero)+"</h2><p>"+brl(state.testLastOrder.total)+" • "+esc(state.testLastOrder.modalidade_entrega)+"</p></div><div class='test-success-actions'><button type='button' data-test-action='pdf' data-id='"+state.testLastOrder.pedido_id+"'>PDF inicial</button><button type='button' data-test-action='production'>Abrir Produção →</button></div></section>":"";
      var notifHtml=notifications.length?notifications.slice(0,20).map(function(n){return "<article><div><b>"+esc(n.titulo)+"</b><small>"+esc(n.numero||"")+" • "+fmtDateTime(n.created_at)+" • "+esc(n.canal)+"</small><p>"+esc(n.mensagem)+"</p></div><span>"+esc(n.tipo)+"</span></article>"}).join(""):"<div class='empty compact'>Nenhuma notificação de teste ainda.</div>";
      main.innerHTML=internalShell("dashboard")+"<section class='test-client-head'><button type='button' class='work-back' data-test-action='back'>← Visão geral</button><div><span>AMBIENTE ISOLADO</span><h1>Cliente Teste Algaroba</h1><p>Simule um pedido real sem misturar com os dados dos clientes.</p></div><b>TESTE</b></section>"+
        "<section class='test-info-strip'><div><span>Cliente</span><b>"+esc(info&&info.cliente_nome||"Cliente Teste Algaroba")+"</b></div><div><span>Rota</span><b>"+esc(info&&info.rota_nome||"Rota Teste Interna")+"</b></div><div><span>Pedidos criados</span><b>"+Number(info&&info.pedidos_teste||0)+"</b></div></section>"+last+
        "<section class='test-order-box'><div class='test-order-title'><div><h2>Fazer pedido como cliente</h2><p>Use os mesmos produtos e preços do catálogo real. Produtos de estoque físico ficam bloqueados para não alterar o saldo real.</p></div><label>Recebimento<select id='testDeliveryMode'><option value='rota' "+(mode==="rota"?"selected":"")+">Rota Teste Interna</option><option value='retirada_fabrica' "+(mode==="retirada_fabrica"?"selected":"")+">Retirada na fábrica</option></select></label></div>"+
        "<label class='internal-search test-search'><span>⌕</span><input id='testProductSearch' type='search' placeholder='Buscar sabor'></label><div class='test-product-list'>"+productsHtml+"</div>"+
        "<div class='test-cart-summary'><div><span>"+units+" unidades</span><small>"+items.length+" produtos diferentes</small></div><b>"+brl(estimated)+"</b></div><button class='test-submit' type='button' data-test-action='submit' "+(units?"":"disabled")+">Enviar pedido de teste →</button></section>"+
        "<section class='test-notifications'><div class='section-head'><div><h2>O que o sistema notificou</h2><p>Mensagens geradas pelo fluxo do cliente de teste.</p></div></div>"+notifHtml+"</section>"+
        "<button class='test-clean' type='button' data-test-action='clean'>Limpar todos os pedidos de teste</button>";
      bindTestClient();
    }catch(e){main.innerHTML=internalShell("dashboard")+"<div class='empty'>"+esc(e.message)+"</div>"}
  }

  function bindTestClient(){
    main.onclick=async function(ev){
      var b=ev.target.closest("[data-test-action]");if(!b)return;
      var a=b.dataset.testAction;
      if(a==="back"){state.testLastOrder=null;state.internalModule="dashboard";return ctx.renderDashboard()}
      if(a==="qty"){testQty(b.dataset.id,Number(b.dataset.delta));return renderTestClient()}
      if(a==="pdf"){if(window.downloadPdf)window.downloadPdf(b.dataset.id);return}
      if(a==="production"){state.internalModule="producao";localStorage.setItem("algaroba_internal_module","producao");return ctx.renderInternal()}
      if(a==="submit"){
        var items=testItems();if(!items.length){showToast("Adicione produtos ao pedido.");return}
        try{
          b.disabled=true;
          var rows=await rpc("admin_teste_criar_pedido",{p_itens:items.map(function(x){return {produto_id:x.p.produto_id,quantidade:x.q}}),p_modalidade_entrega:state.testDeliveryMode||"rota",p_observacao:"Simulação completa do fluxo administrativo"},true);
          state.testLastOrder=Array.isArray(rows)?rows[0]:rows;state.testCart={};showToast("Pedido de teste criado.");await renderTestClient();
        }catch(e){showToast(e.message);b.disabled=false}
      }
      if(a==="clean"){
        if(!confirm("Apagar todos os pedidos do ambiente de teste?"))return;
        try{var count=await rpc("admin_teste_limpar_pedidos",{},true);state.testLastOrder=null;state.testCart={};showToast(Number(count||0)+" pedido(s) de teste apagado(s).");await renderTestClient()}catch(e){showToast(e.message)}
      }
    };
    var mode=document.querySelector("#testDeliveryMode");
    if(mode)mode.onchange=function(){state.testDeliveryMode=mode.value;renderTestClient()};
    var search=document.querySelector("#testProductSearch");
    if(search)search.oninput=function(){var q=search.value.trim().toLowerCase();document.querySelectorAll(".test-product").forEach(function(el){el.classList.toggle("hidden",!!q&&!el.dataset.search.includes(q))})};
  }

  async function renderReports(){
    loading("Carregando Relatórios...");
    try{
      var now=new Date(),startDefault=new Date(now.getFullYear(),now.getMonth(),1).toISOString().slice(0,10),endDefault=now.toISOString().slice(0,10);
      var start=state.reportStart||startDefault,end=state.reportEnd||endDefault;
      var data=await Promise.all([rpc("administrativo_pedidos_fila",{p_limit:300},true),rpc("estoque_painel",{},true),rpc("relatorio_desempenho_rotas",{p_inicio:start,p_fim:end},true),rpc("caixa_painel",{},true)]);
      var orders=data[0]||[],stock=data[1]||[],routes=data[2]||[],cash=Array.isArray(data[3])?data[3][0]:data[3];
      var filtered=orders.filter(function(o){var d=String(o.data_pedido||"").slice(0,10);return d>=start&&d<=end&&!String(o.numero||"").startsWith("TESTE-")});
      var clients=new Set(filtered.map(function(x){return x.cliente_id}).filter(Boolean));
      var total=filtered.reduce(function(s,x){return s+Number(x.total||0)},0),paid=filtered.reduce(function(s,x){return s+Number(x.valor_pago||0)},0),pending=filtered.reduce(function(s,x){return s+Number(x.valor_pendente||0)},0);
      var low=stock.filter(function(x){return x.abaixo_minimo}).length,delivered=filtered.filter(function(x){return x.status==="entregue"}).length;
      main.innerHTML=internalShell("relatorios")+"<section class='internal-title'><div><span class='internal-eyebrow'>RELATÓRIOS</span><h1>Central de relatórios</h1><p>Vendas, pedidos, clientes, rotas, caixa, estoque e CMV.</p></div></section>"+
        "<section class='report-period'><label>De<input id='reportStart' type='date' value='"+start+"'></label><label>Até<input id='reportEnd' type='date' value='"+end+"'></label><button type='button' data-report-action='apply'>Atualizar</button></section>"+
        "<section class='report-kpis'><div><span>Pedidos</span><b>"+filtered.length+"</b></div><div><span>Faturamento</span><b>"+brl(total)+"</b></div><div><span>Recebido</span><b>"+brl(paid)+"</b></div><div><span>A receber</span><b>"+brl(pending)+"</b></div><div><span>Clientes</span><b>"+clients.size+"</b></div><div><span>Entregues</span><b>"+delivered+"</b></div></section>"+
        "<section class='report-grid'><article><b>Vendas e pedidos</b><p>"+filtered.length+" pedidos no período, total de "+brl(total)+".</p></article><article><b>Estoque</b><p>"+stock.length+" produtos controlados • "+low+" abaixo do mínimo.</p></article><article><b>Rotas</b><p>"+routes.length+" registros de desempenho no período.</p></article><article><b>Caixa atual</b><p>"+(cash?"Saldo calculado "+brl(cash.saldo_calculado):"Nenhum caixa aberto.")+"</p></article><article class='report-cmv'><b>CMV / matéria-prima</b><p>A estrutura está preparada. O CMV automático será ativado quando cadastrarmos as matérias-primas e receitas por produto.</p></article><article><b>Clientes</b><p>Use a pesquisa abaixo para o histórico unificado antigo + novo.</p></article></section>"+
        "<div class='section-head'><div><h2>Histórico unificado do cliente</h2><p>Uso exclusivamente administrativo.</p></div></div><div class='admin-client-tool'><div class='admin-client-search'><input id='adminClientSearch' type='search' placeholder='Buscar por nome, WhatsApp ou CPF/CNPJ'><button class='button' type='button' onclick='window.adminSearchClients()'>Buscar</button></div><div class='admin-period'><label>De <input id='adminClientStart' type='date' value='"+start+"'></label><label>Até <input id='adminClientEnd' type='date' value='"+end+"'></label></div><div id='adminClientResults' class='admin-client-results'><div class='small'>Pesquise um cliente para abrir o relatório unificado.</div></div><div id='adminClientReport'></div></div>";
      main.onclick=function(ev){var b=ev.target.closest("[data-report-action]");if(!b)return;if(b.dataset.reportAction==="apply"){state.reportStart=document.querySelector("#reportStart").value;state.reportEnd=document.querySelector("#reportEnd").value;renderReports()}};
    }catch(e){main.innerHTML=internalShell("relatorios")+"<div class='empty'>"+esc(e.message)+"</div>"}
  }

  return {renderTestClient:renderTestClient,renderReports:renderReports};
}

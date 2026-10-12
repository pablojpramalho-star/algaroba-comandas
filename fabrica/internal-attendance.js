export function installInternalAttendance(ctx){
  const {state,main,rpc,internalShell,loading,esc,showToast,fmtDate,fmtDateTime}=ctx;

  function defaultPeriod(){
    const now=new Date();
    const start=new Date(now.getFullYear(),now.getMonth(),1);
    const iso=d=>d.toISOString().slice(0,10);
    return {start:iso(start),end:iso(now)};
  }

  function daysLabel(v){
    if(v===null||v===undefined)return "Sem compra registrada";
    const n=Number(v);
    if(n===0)return "Comprou hoje";
    if(n===1)return "1 dia sem comprar";
    return n+" dias sem comprar";
  }

  async function renderAttendanceReport(){
    loading("Carregando relatório de atendimento...");
    try{
      const d=defaultPeriod();
      const start=state.attendanceReportStart||d.start;
      const end=state.attendanceReportEnd||d.end;
      const query=state.attendanceReportQuery||"";
      const [orders,clients]=await Promise.all([
        rpc("atendimento_relatorio_pedidos",{p_inicio:start,p_fim:end,p_busca:query||null},true),
        rpc("atendimento_clientes_sinais",{p_busca:query||null},true)
      ]);
      const rows=orders||[],signals=clients||[];
      const uniqueClients=new Set(rows.map(x=>x.cliente_id).filter(Boolean)).size;
      const inactive30=signals.filter(x=>x.dias_sem_compra===null||Number(x.dias_sem_compra)>=30).length;
      const incomplete=signals.filter(x=>x.cadastro_pendente).length;
      const recurring=signals.filter(x=>x.tipo_cliente==="recorrente").length;

      main.innerHTML=internalShell("atendimento_relatorio")+
        "<section class='internal-title attendance-title'><div><span class='internal-eyebrow'>ATENDIMENTO</span><h1>Relatório comercial</h1><p>Pedidos tirados, recorrência, endereço e qualidade do cadastro. Sem informações financeiras.</p></div></section>"+
        "<section class='attendance-report-filter'><label>De<input id='attReportStart' type='date' value='"+esc(start)+"'></label><label>Até<input id='attReportEnd' type='date' value='"+esc(end)+"'></label><label class='search'>Buscar<input id='attReportQuery' type='search' value='"+esc(query)+"' placeholder='Cliente, pedido ou WhatsApp'></label><button type='button' data-att-report='apply'>Atualizar</button></section>"+
        "<section class='attendance-kpis'><div><span>Pedidos tirados</span><b>"+rows.length+"</b></div><div><span>Clientes atendidos</span><b>"+uniqueClients+"</b></div><div><span>Sem comprar 30+ dias</span><b>"+inactive30+"</b></div><div><span>Cadastro incompleto</span><b>"+incomplete+"</b></div><div><span>Recorrentes</span><b>"+recurring+"</b></div></section>"+

        "<div class='section-head'><div><h2>Pedidos do atendimento</h2><p>Pedidos registrados pela equipe no período selecionado.</p></div></div>"+
        "<section class='attendance-order-report'>"+
          (rows.length?rows.slice(0,150).map(function(o){
            return "<article><div class='att-order-no'>"+esc(o.numero)+"</div><div class='att-order-main'><strong>"+esc(o.cliente_nome)+"</strong><small>"+fmtDateTime(o.data_pedido)+" • "+esc(o.origem||"")+"</small><span>"+esc(o.endereco||"Sem endereço de entrega")+"</span></div><div class='att-order-side'><b>"+esc(o.status)+"</b><small>"+Number(o.pedidos_cliente_periodo||0)+" pedido(s) do cliente no período</small>"+(state.role==="administrador"||state.role==="gerente"?"<em>Atendente: "+esc(o.atendente_nome||"—")+"</em>":"")+"</div></article>";
          }).join(""):"<div class='empty compact'>Nenhum pedido do Atendimento neste período.</div>")+
        "</section>"+

        "<div class='section-head'><div><h2>Acompanhamento dos clientes</h2><p>Quem não está comprando, quem compra recorrente e quais cadastros precisam ser completados.</p></div></div>"+
        "<div class='attendance-signal-tabs'><button class='active' data-att-signal='all'>Todos</button><button data-att-signal='inactive'>Sem compra 30+ dias</button><button data-att-signal='incomplete'>Cadastro incompleto</button><button data-att-signal='recurring'>Recorrentes</button></div>"+
        "<section id='attendanceSignals' class='attendance-client-signals'></section>";
      state.attendanceSignals=signals;
      renderSignals("all");
      bindReport();
    }catch(e){
      main.innerHTML=internalShell("atendimento_relatorio")+"<div class='empty'>"+esc(e.message)+"</div>";
    }
  }

  function renderSignals(mode){
    const box=document.querySelector("#attendanceSignals");if(!box)return;
    let rows=state.attendanceSignals||[];
    if(mode==="inactive")rows=rows.filter(x=>x.dias_sem_compra===null||Number(x.dias_sem_compra)>=30);
    if(mode==="incomplete")rows=rows.filter(x=>x.cadastro_pendente);
    if(mode==="recurring")rows=rows.filter(x=>x.tipo_cliente==="recorrente");
    box.innerHTML=rows.slice(0,120).map(function(c){
      const rec=Number(c.pedidos_90_dias||0);
      return "<article class='"+(c.cadastro_pendente?"needs-attention":"")+"'><div class='att-client-avatar'>"+esc((c.cliente_nome||"?").slice(0,1).toUpperCase())+"</div><div class='att-client-main'><strong>"+esc(c.cliente_nome)+"</strong><small>"+esc(c.codigo_cliente||"Cadastro novo")+(c.whatsapp?" • "+esc(c.whatsapp):"")+"</small><span>"+esc(c.endereco||"Endereço ainda não cadastrado")+"</span>"+(c.pendencias?"<em>⚠ "+esc(c.pendencias)+"</em>":"")+"</div><div class='att-client-side'><b>"+rec+"</b><small>pedidos em 90 dias</small><span>"+esc(daysLabel(c.dias_sem_compra))+"</span></div></article>";
    }).join("")||"<div class='empty compact'>Nenhum cliente neste filtro.</div>";
  }

  function bindReport(){
    const apply=document.querySelector("[data-att-report='apply']");
    if(apply)apply.onclick=function(){
      state.attendanceReportStart=document.querySelector("#attReportStart").value;
      state.attendanceReportEnd=document.querySelector("#attReportEnd").value;
      state.attendanceReportQuery=document.querySelector("#attReportQuery").value.trim();
      renderAttendanceReport();
    };
    document.querySelectorAll("[data-att-signal]").forEach(function(b){
      b.onclick=function(){
        document.querySelectorAll("[data-att-signal]").forEach(x=>x.classList.toggle("active",x===b));
        renderSignals(b.dataset.attSignal);
      };
    });
  }

  async function renderAttendancePromotions(){
    loading("Carregando promoções...");
    try{
      const rows=await rpc("atendimento_promocoes",{},true)||[];
      const active=rows.filter(x=>x.situacao==="ativa").length;
      const scheduled=rows.filter(x=>x.situacao==="programada").length;
      main.innerHTML=internalShell("promocoes")+
        "<section class='internal-title'><div><span class='internal-eyebrow'>ATENDIMENTO</span><h1>Promoções</h1><p>Condições comerciais que a equipe pode apresentar aos clientes.</p></div></section>"+
        "<section class='promo-kpis'><div><span>Ativas agora</span><b>"+active+"</b></div><div><span>Programadas</span><b>"+scheduled+"</b></div></section>"+
        "<section class='attendance-promos'>"+
        (rows.length?rows.map(function(p){
          let benefit="";
          if(Number(p.desconto_percentual||0)>0)benefit=Number(p.desconto_percentual).toLocaleString("pt-BR")+"% de desconto";
          else if(Number(p.desconto_valor||0)>0)benefit="Desconto de R$ "+Number(p.desconto_valor).toLocaleString("pt-BR",{minimumFractionDigits:2});
          else benefit=esc(p.tipo||"Condição promocional");
          const target=p.produto||p.linha||"Catálogo Algaroba";
          return "<article class='promo-card "+esc(p.situacao)+"'><div class='promo-status'>"+esc(p.situacao)+"</div><div><strong>"+esc(p.nome)+"</strong><span>"+esc(target)+"</span><p>"+esc(p.descricao||"Promoção cadastrada para o Atendimento.")+"</p><div class='promo-terms'><b>"+benefit+"</b>"+(Number(p.quantidade_minima||0)>0?"<small>Mínimo "+Number(p.quantidade_minima).toLocaleString("pt-BR")+" un.</small>":"")+"</div><small>"+fmtDate(String(p.inicio).slice(0,10))+" → "+fmtDate(String(p.fim).slice(0,10))+"</small></div></article>";
        }).join(""):"<div class='empty'>Nenhuma promoção cadastrada no momento.</div>")+
        "</section>"+
        "<div class='notice green attendance-promo-note'><b>Regra do Atendimento</b><br>A equipe consulta e apresenta as promoções cadastradas. Criação de descontos e regras financeiras permanece na gestão.</div>";
    }catch(e){
      main.innerHTML=internalShell("promocoes")+"<div class='empty'>"+esc(e.message)+"</div>";
    }
  }

  return {renderAttendanceReport,renderAttendancePromotions};
}

(function(){
  if(!("productionOpenOrder" in state)) state.productionOpenOrder=null;
  if(!("expeditionOpenOrder" in state)) state.expeditionOpenOrder=null;
  if(!("deliveryOpenOrder" in state)) state.deliveryOpenOrder=null;
  if(!("deliveryMode" in state)) state.deliveryMode=null;
  if(!("deliveryReference" in state)) state.deliveryReference=null;
  if(!("deliveryPayment" in state)) state.deliveryPayment=null;

  function groupsBy(rows,key){
    var out={};
    (rows||[]).forEach(function(x){(out[x[key]]||(out[x[key]]=[])).push(x)});
    return out;
  }
  function doneProduction(x){return ["pronto","separado","indisponivel","cancelado"].includes(x.status_item)}
  function percent(a,b){return Math.round((a/Math.max(b,1))*100)}
  function conferenceLabel(v){
    return v==="por_item"?"por item":v==="por_sacola"?"por sacola/volume":"conferência total";
  }

  renderProduction=async function(){
    loading("Carregando Produção...");
    try{
      var rows=await rpc("producao_fila",{},true)||[];
      var groups=groupsBy(rows,"pedido_id");
      if(state.productionOpenOrder&&!groups[state.productionOpenOrder]) state.productionOpenOrder=null;

      if(!state.productionOpenOrder){
        var cards=Object.keys(groups).map(function(pid){
          var it=groups[pid],done=it.filter(doneProduction).length;
          return "<button type='button' class='order-work-card' data-prod-action='open' data-id='"+pid+"'>"+
            "<div><span>"+esc(it[0].numero)+"</span><strong>"+esc(it[0].cliente_nome)+"</strong><small>"+it.length+" itens • "+done+" concluídos</small></div>"+
            "<div class='order-work-progress'><b>"+done+"/"+it.length+"</b><i><em style='width:"+percent(done,it.length)+"%'></em></i></div>"+
            "<strong class='order-work-arrow'>›</strong></button>";
        }).join("");
        main.innerHTML=internalShell("producao")+
          "<div class='internal-title'><div><span class='internal-eyebrow'>PRODUÇÃO</span><h1>Pedidos para produção</h1><p>"+Object.keys(groups).length+" pedidos aguardando conferência.</p></div></div>"+
          "<section class='order-work-list'>"+(cards||"<div class='empty'>Nenhum pedido aguardando produção.</div>")+"</section>";
        bindProduction();
        return;
      }

      var it=groups[state.productionOpenOrder],completed=it.filter(doneProduction).length,allDone=completed===it.length;
      var itemHtml=it.map(function(x){
        var finished=doneProduction(x),missing=x.status_item==="indisponivel",separated=x.status_item==="separado";
        var actions="";
        if(finished){
          actions="<button class='work-undo' data-prod-action='reopen' data-id='"+x.item_id+"' data-q='"+Number(x.quantidade_solicitada)+"'>↶</button>";
        }else if(x.modelo_fornecimento==="estoque"){
          actions="<button class='work-ready' data-prod-action='update' data-id='"+x.item_id+"' data-status='separado' data-q='"+Number(x.quantidade_solicitada)+"'>✓ Separar</button>"+
            "<button class='work-adjust' data-prod-action='adjust' data-id='"+x.item_id+"' data-max='"+Number(x.quantidade_solicitada)+"' data-current='"+Number(x.quantidade_faturada||x.quantidade_solicitada)+"'>Ajustar</button>"+
            "<button class='work-missing' data-prod-action='update' data-id='"+x.item_id+"' data-status='indisponivel' data-q='0'>Em falta</button>";
        }else{
          actions="<button class='work-ready' data-prod-action='update' data-id='"+x.item_id+"' data-status='pronto' data-q='"+Number(x.quantidade_solicitada)+"'>✓ Pronto</button>";
        }
        return "<article class='work-item "+(finished?"done ":"")+(missing?"missing":"")+"'>"+
          "<div class='work-item-check'>"+(finished?(missing?"!":"✓"):"")+"</div>"+
          "<div class='work-item-copy'><strong>"+esc(x.produto)+"</strong><small>Solicitado: "+Number(x.quantidade_solicitada).toLocaleString("pt-BR")+" • "+(x.modelo_fornecimento==="estoque"?"Separação de estoque":"Produção sob encomenda")+"</small>"+
          (finished?"<span class='"+(missing?"missing-label":"done-label")+"'>"+(missing?"Produto em falta":separated?"Separado e pronto":"Pronto")+"</span>":"<span class='pending-label'>Pendente</span>")+"</div>"+
          "<div class='work-item-actions'>"+actions+"</div></article>";
      }).join("");
      main.innerHTML=internalShell("producao")+
        "<section class='work-order-head'><button type='button' class='work-back' data-prod-action='back'>← Pedidos</button>"+
        "<div><span>PRODUÇÃO</span><h1>"+esc(it[0].numero)+"</h1><p>"+esc(it[0].cliente_nome)+" • "+completed+"/"+it.length+" itens conferidos</p></div>"+
        "<strong>"+percent(completed,it.length)+"%</strong></section>"+
        "<section class='work-progress'><i style='width:"+percent(completed,it.length)+"%'></i></section>"+
        "<section class='work-items'>"+itemHtml+"</section>"+
        "<button class='work-finish "+(allDone?"ready":"")+"' "+(allDone?"":"disabled")+" data-prod-action='finish' data-id='"+state.productionOpenOrder+"'>"+(allDone?"Concluir produção do pedido →":"Conclua todos os itens")+"</button>";
      bindProduction();
    }catch(e){main.innerHTML=internalShell("producao")+"<div class='empty'>"+esc(e.message)+"</div>"}
  };

  function bindProduction(){
    main.onclick=async function(ev){
      var b=ev.target.closest("[data-prod-action]"); if(!b)return;
      var a=b.dataset.prodAction,id=b.dataset.id;
      if(a==="open"){state.productionOpenOrder=id;return renderProduction()}
      if(a==="back"){state.productionOpenOrder=null;return renderProduction()}
      if(a==="update"){
        var status=b.dataset.status,q=Number(b.dataset.q);
        var obs=status==="indisponivel"?"Estoque indisponível - produto em falta.":null;
        try{await rpc("producao_atualizar_item",{p_item_id:id,p_status:status,p_quantidade_faturada:q,p_observacao:obs},true);showToast(status==="indisponivel"?"Produto marcado em falta.":"Item conferido.");await renderProduction()}catch(e){showToast(e.message)}
      }
      if(a==="reopen"){
        try{await rpc("producao_atualizar_item",{p_item_id:id,p_status:"em_producao",p_quantidade_faturada:Number(b.dataset.q),p_observacao:"Item reaberto para conferência"},true);showToast("Item reaberto.");await renderProduction()}catch(e){showToast(e.message)}
      }
      if(a==="adjust"){
        var max=Number(b.dataset.max),current=Number(b.dataset.current);
        var raw=prompt("Quantidade realmente disponível (máximo "+max+"):",String(current).replace(".",","));
        if(raw===null)return;
        var q=Number(raw.replace(",","."));
        if(!Number.isFinite(q)||q<0||q>max){showToast("Quantidade inválida.");return}
        var status=q<=0?"indisponivel":"separado";
        var obs=q<=0?"Estoque indisponível - produto em falta.":q<max?"Estoque insuficiente - quantidade parcial disponível.":null;
        try{await rpc("producao_atualizar_item",{p_item_id:id,p_status:status,p_quantidade_faturada:q,p_observacao:obs},true);showToast("Quantidade confirmada.");await renderProduction()}catch(e){showToast(e.message)}
      }
      if(a==="finish"){
        try{await rpc("producao_finalizar_pedido",{p_pedido_id:id},true);state.productionOpenOrder=null;showToast("Produção concluída. Pedido enviado para a Expedição.");await renderProduction()}catch(e){showToast(e.message)}
      }
    };
  }

  renderExpedition=async function(){
    loading("Carregando Expedição...");
    try{
      var today=localDateISO();
      var result=await Promise.all([
        rpc("expedicao_conferencia_fila",{},true),
        rpc("entrega_operacao_fila",{},true),
        rpc("expedicao_planejamento_rota",{p_data:today},true),
        table("rota_execucoes?select=id,rota_id,data_rota,status,hora_saida_prevista,saiu_em,finalizada_em,motorista,veiculo,odometro_inicio,odometro_fim,entregas_planejadas,entregas_concluidas,entregas_pendentes&data_rota=eq."+today),
        rpc("expedicao_entregas_concluidas_hoje",{p_data:today},true)
      ]);
      var prepGroups=groupsBy(result[0],"pedido_id"),deliveryGroups=groupsBy(result[1],"pedido_id"),planning=result[2]||[],executions=result[3]||[],delivered=result[4]||[];
      var routeGroups={}; planning.forEach(function(x){var g=routeGroups[x.rota_id]||(routeGroups[x.rota_id]={meta:x,items:[]});g.items.push(x)});

      if(state.expeditionOpenOrder&&!prepGroups[state.expeditionOpenOrder])state.expeditionOpenOrder=null;
      if(state.deliveryOpenOrder&&!deliveryGroups[state.deliveryOpenOrder])state.deliveryOpenOrder=null;

      if(state.expeditionOpenOrder){
        var pit=prepGroups[state.expeditionOpenOrder],checked=pit.filter(function(x){return x.expedicao_conferido}).length;
        var all=checked===pit.length,ready=["pronto_rota","pronto_retirada"].includes(pit[0].expedicao_status);
        var items=pit.map(function(x){
          return "<article class='work-item "+(x.expedicao_conferido?"done":"")+"'><div class='work-item-check'>"+(x.expedicao_conferido?"✓":"")+"</div>"+
            "<div class='work-item-copy'><strong>"+esc(x.produto)+"</strong><small>"+Number(x.quantidade).toLocaleString("pt-BR")+" un.</small><span class='"+(x.expedicao_conferido?"done-label":"pending-label")+"'>"+(x.expedicao_conferido?"Conferido":"A conferir")+"</span></div>"+
            "<div class='work-item-actions'><button class='"+(x.expedicao_conferido?"work-undo":"work-ready")+"' data-exp-action='check-prep' data-id='"+x.item_id+"' data-current='"+(x.expedicao_conferido?"1":"0")+"'>"+(x.expedicao_conferido?"↶":"✓ Conferir")+"</button></div></article>";
        }).join("");
        main.innerHTML=internalShell("expedicao")+
          "<section class='work-order-head expedition'><button class='work-back' data-exp-action='back-prep'>← Expedição</button><div><span>CONFERÊNCIA DA EXPEDIÇÃO</span><h1>"+esc(pit[0].numero)+"</h1><p>"+esc(pit[0].cliente_nome)+" • "+checked+"/"+pit.length+" itens</p></div><strong>"+(ready?"✓":percent(checked,pit.length)+"%")+"</strong></section>"+
          "<div class='dispatch-destination'><b>"+(pit[0].modalidade_entrega==="retirada_fabrica"?"Retirada na fábrica":esc(pit[0].rota_nome||"Rota"))+"</b><span>"+esc(pit[0].endereco||"")+"</span></div>"+
          "<section class='work-items'>"+items+"</section>"+
          (ready?"<div class='dispatch-ready'>✓ "+(pit[0].expedicao_status==="pronto_retirada"?"Pedido pronto para retirada":"Pedido pronto para a rota")+"</div>":
            "<button class='work-finish "+(all?"ready":"")+"' "+(all?"":"disabled")+" data-exp-action='finish-prep' data-id='"+state.expeditionOpenOrder+"'>"+(all?(pit[0].modalidade_entrega==="retirada_fabrica"?"Pronto para retirada →":"Pronto para a rota →"):"Confira todos os itens")+"</button>");
        bindExpedition();
        return;
      }

      if(state.deliveryOpenOrder){
        var dit=deliveryGroups[state.deliveryOpenOrder],dx=dit[0],pending=Number(dx.valor_pendente||0);
        var itemChecked=dit.filter(function(v){return v.entrega_cliente_conferido}).length,itemAll=itemChecked===dit.length;
        var mode=state.deliveryMode,payment=state.deliveryPayment;
        var canFinish=!!mode&&(mode!=="por_item"||itemAll)&&(pending<=0||!!payment);
        var itemSection="";
        if(mode==="por_item"){
          itemSection="<section class='work-items delivery-client-items'>"+dit.map(function(v){
            return "<article class='work-item "+(v.entrega_cliente_conferido?"done":"")+"'><div class='work-item-check'>"+(v.entrega_cliente_conferido?"✓":"")+"</div>"+
              "<div class='work-item-copy'><strong>"+esc(v.produto)+"</strong><small>"+Number(v.quantidade).toLocaleString("pt-BR")+" un.</small></div>"+
              "<div class='work-item-actions'><button class='"+(v.entrega_cliente_conferido?"work-undo":"work-ready")+"' data-exp-action='check-client' data-id='"+v.item_id+"' data-current='"+(v.entrega_cliente_conferido?"1":"0")+"'>"+(v.entrega_cliente_conferido?"↶":"✓ Conferir")+"</button></div></article>";
          }).join("")+"</section>";
        }
        var paymentHtml=pending<=0?"<div class='payment-paid'>✓ Pedido já está quitado</div>":
          "<div class='delivery-pending'>Saldo a receber <b>"+brl(pending)+"</b></div><div class='delivery-payment-row'>"+
          ["dinheiro","pix","credito","debito","em_aberto"].map(function(m){
            var lab={dinheiro:"Dinheiro",pix:"Pix",credito:"Crédito",debito:"Débito",em_aberto:"Ficou em aberto"}[m];
            return "<button class='"+(m==="em_aberto"?"open ":"")+(payment===m?"active":"")+"' data-exp-action='payment' data-method='"+m+"'>"+lab+"</button>";
          }).join("")+"</div>";

        main.innerHTML=internalShell("expedicao")+
          "<section class='work-order-head delivery'><button class='work-back' data-exp-action='back-delivery'>← Entregas</button><div><span>CONFERÊNCIA COM O CLIENTE</span><h1>"+esc(dx.numero)+"</h1><p>"+esc(dx.cliente_nome)+"</p></div><strong>"+(dx.modalidade_entrega==="retirada_fabrica"?"RET":"ROTA")+"</strong></section>"+
          "<div class='dispatch-destination'><b>"+(dx.modalidade_entrega==="retirada_fabrica"?"Retirada na fábrica":esc(dx.rota_nome||"Entrega"))+"</b><span>"+esc(dx.endereco||"")+"</span></div>"+
          "<section class='delivery-step'><h2>1. Como foi feita a conferência?</h2><div class='delivery-choice-row'>"+
          "<button class='"+(mode==="total"?"active":"")+"' data-exp-action='mode' data-mode='total'><b>✓</b><span>Conferido total</span></button>"+
          "<button class='"+(mode==="por_item"?"active":"")+"' data-exp-action='mode' data-mode='por_item'><b>▤</b><span>Por item</span></button>"+
          "<button class='"+(mode==="por_sacola"?"active":"")+"' data-exp-action='mode' data-mode='por_sacola'><b>▣</b><span>Por sacola</span></button></div>"+
          (state.deliveryReference?"<div class='delivery-reference'>Referência: <b>"+esc(state.deliveryReference)+"</b></div>":"")+"</section>"+
          itemSection+
          "<section class='delivery-step'><h2>2. Recebimento</h2>"+paymentHtml+"</section>"+
          "<button class='work-finish "+(canFinish?"ready":"")+"' "+(canFinish?"":"disabled")+" data-exp-action='finish-delivery' data-id='"+state.deliveryOpenOrder+"' data-pending='"+pending+"'>Confirmar entrega/retirada →</button>";
        bindExpedition();
        return;
      }

      var pendingPrep=Object.keys(prepGroups).filter(function(pid){return !["pronto_rota","pronto_retirada"].includes(prepGroups[pid][0].expedicao_status)});
      var activeRoute=Object.keys(deliveryGroups).filter(function(pid){return deliveryGroups[pid][0].status_pedido==="saiu_entrega"});
      var pickups=Object.keys(deliveryGroups).filter(function(pid){var x=deliveryGroups[pid][0];return x.modalidade_entrega==="retirada_fabrica"&&x.status_pedido!=="entregue"});

      var prepHtml=pendingPrep.map(function(pid){
        var it=prepGroups[pid],checked=it.filter(function(x){return x.expedicao_conferido}).length;
        return "<button class='order-work-card' data-exp-action='open-prep' data-id='"+pid+"'><div><span>"+esc(it[0].numero)+"</span><strong>"+esc(it[0].cliente_nome)+"</strong><small>"+(it[0].modalidade_entrega==="retirada_fabrica"?"Retirada":esc(it[0].rota_nome||"Rota"))+" • "+checked+"/"+it.length+" conferidos</small></div><div class='order-work-progress'><b>"+checked+"/"+it.length+"</b></div><strong class='order-work-arrow'>›</strong></button>";
      }).join("");

      var routesHtml=Object.keys(routeGroups).map(function(rid){
        var g=routeGroups[rid],x=executions.find(function(e){return e.rota_id===rid}),safe=rid.replaceAll("-","");
        var control="";
        if(!x||x.status==="planejada"){
          control="<div class='route-start-form'><label>Veículo<select id='routeVehicle-"+safe+"'><option value=''>Selecione</option><option value='Fiat Cronos'>Carro • Fiat Cronos</option><option value='Yamaha Crosser XTZ'>Moto • Yamaha Crosser XTZ</option></select></label><label>Motorista<input id='routeDriver-"+safe+"' placeholder='Nome'></label><label>Odômetro inicial *<input id='routeKmStart-"+safe+"' type='number' min='0' step='0.1' inputmode='decimal' placeholder='Obrigatório'></label><button data-exp-action='start-route' data-route='"+rid+"' data-date='"+today+"'>Iniciar rota →</button></div>";
        }else if(x.status==="em_rota"){
          control="<div class='route-running'><span>"+esc(x.veiculo||"")+" • km inicial <b>"+Number(x.odometro_inicio||0).toLocaleString("pt-BR")+"</b></span><div><input id='routeKmEnd-"+safe+"' type='number' min='"+Number(x.odometro_inicio||0)+"' step='0.1' inputmode='decimal' placeholder='Odômetro final *'><button data-exp-action='finish-route' data-id='"+x.id+"' data-route='"+rid+"'>Finalizar rota</button></div></div>";
        }else{
          control="<div class='route-finished'>✓ Rota finalizada • "+Number(x.odometro_inicio||0).toLocaleString("pt-BR")+" → "+Number(x.odometro_fim||0).toLocaleString("pt-BR")+" km</div>";
        }
        return "<section class='route-card'><div class='route-card-head'><div><strong>"+esc(g.meta.rota_nome)+"</strong><small>"+g.items.length+" entregas planejadas • saída "+fmtTime(g.meta.hora_saida_padrao)+"</small></div><span class='status "+(x&&x.status==="em_rota"?"warn":x&&x.status==="finalizada"?"ok":"")+"'>"+esc(x?x.status:"planejada")+"</span></div>"+control+"</section>";
      }).join("");

      var activeHtml=activeRoute.map(function(pid){
        var it=deliveryGroups[pid];
        return "<button data-exp-action='open-delivery' data-id='"+pid+"'><div><span>"+esc(it[0].numero)+"</span><strong>"+esc(it[0].cliente_nome)+"</strong><small>"+esc(it[0].endereco||"")+"</small></div><b>Entregar ›</b></button>";
      }).join("");
      var pickupHtml=pickups.map(function(pid){
        var it=deliveryGroups[pid];
        return "<button data-exp-action='open-delivery' data-id='"+pid+"'><div><span>"+esc(it[0].numero)+"</span><strong>"+esc(it[0].cliente_nome)+"</strong><small>Retirada na fábrica • pendente "+brl(it[0].valor_pendente)+"</small></div><b>Retirar ›</b></button>";
      }).join("");
      var deliveredHtml=delivered.map(function(x){
        return "<article><div><b>✓ "+esc(x.numero)+" • "+esc(x.cliente_nome)+"</b><small>"+fmtDateTime(x.entregue_em)+" • "+conferenceLabel(x.conferencia_tipo)+"</small></div><span>"+(Number(x.valor_em_aberto||0)>0?"Em aberto "+brl(x.valor_em_aberto):"Concluído")+"</span></article>";
      }).join("");

      main.innerHTML=internalShell("expedicao")+
        "<div class='internal-title'><div><span class='internal-eyebrow'>EXPEDIÇÃO</span><h1>Conferência e entregas</h1><p>Segunda conferência antes da saída e conferência final com o cliente.</p></div></div>"+
        "<section class='exp-kpis'><div><b>"+pendingPrep.length+"</b><span>Aguardando conferência</span></div><div><b>"+activeRoute.length+"</b><span>Em rota agora</span></div><div><b>"+pickups.length+"</b><span>Prontos para retirada</span></div><div><b>"+delivered.length+"</b><span>Entregues hoje</span></div></section>"+
        "<div class='section-head'><div><h2>Conferir antes da saída</h2><p>Abra o pedido e confira item por item.</p></div></div><section class='order-work-list compact'>"+(prepHtml||"<div class='empty compact'>Nenhum pedido aguardando conferência.</div>")+"</section>"+
        "<div class='section-head'><div><h2>Rotas de hoje</h2><p>"+fmtDate(today)+" • veículo e odômetro são obrigatórios.</p></div></div>"+(routesHtml||"<div class='empty compact'>Nenhuma rota planejada para hoje.</div>")+
        "<div class='section-head'><div><h2>Em rota</h2><p>Clique ao chegar no cliente.</p></div></div><section class='delivery-list'>"+(activeHtml||"<div class='empty compact'>Nenhum pedido em rota.</div>")+"</section>"+
        "<div class='section-head'><div><h2>Prontos para retirada</h2><p>Conferência final no balcão.</p></div></div><section class='delivery-list'>"+(pickupHtml||"<div class='empty compact'>Nenhum pedido aguardando retirada.</div>")+"</section>"+
        "<div class='section-head'><div><h2>Entregues hoje</h2><p>Baixas feitas durante a rota.</p></div></div><section class='delivered-list'>"+(deliveredHtml||"<div class='empty compact'>Nenhuma entrega concluída hoje.</div>")+"</section>";
      bindExpedition();
    }catch(e){main.innerHTML=internalShell("expedicao")+"<div class='empty'>"+esc(e.message)+"</div>"}
  };

  function bindExpedition(){
    main.onclick=async function(ev){
      var b=ev.target.closest("[data-exp-action]"); if(!b)return;
      var a=b.dataset.expAction,id=b.dataset.id;
      if(a==="open-prep"){state.expeditionOpenOrder=id;return renderExpedition()}
      if(a==="back-prep"){state.expeditionOpenOrder=null;return renderExpedition()}
      if(a==="check-prep"){
        try{await rpc("expedicao_conferir_item",{p_item_id:id,p_conferido:b.dataset.current!=="1",p_observacao:null},true);await renderExpedition()}catch(e){showToast(e.message)}
      }
      if(a==="finish-prep"){
        try{var s=await rpc("expedicao_finalizar_conferencia",{p_pedido_id:id},true);state.expeditionOpenOrder=null;showToast(s==="pronto_retirada"?"Pedido pronto para retirada.":"Pedido pronto para a rota.");await renderExpedition()}catch(e){showToast(e.message)}
      }
      if(a==="open-delivery"){
        state.deliveryOpenOrder=id;state.deliveryMode=null;state.deliveryReference=null;state.deliveryPayment=null;return renderExpedition();
      }
      if(a==="back-delivery"){
        state.deliveryOpenOrder=null;state.deliveryMode=null;state.deliveryReference=null;state.deliveryPayment=null;return renderExpedition();
      }
      if(a==="mode"){
        var mode=b.dataset.mode;state.deliveryMode=mode;
        if(mode==="total"){
          var ref=prompt("Referência da conferência (opcional). Ex.: 22 kg","");
          if(ref!==null)state.deliveryReference=ref.trim()||null;
        }else if(mode==="por_sacola"){
          var bags=prompt("Informe a quantidade/referência das sacolas ou volumes. Ex.: 4 sacolas","");
          if(bags===null||!bags.trim()){state.deliveryMode=null;showToast("Informe as sacolas/volumes.");return}
          state.deliveryReference=bags.trim();
        }else state.deliveryReference=null;
        return renderExpedition();
      }
      if(a==="payment"){state.deliveryPayment=b.dataset.method;return renderExpedition()}
      if(a==="check-client"){
        try{await rpc("entrega_conferir_item_cliente",{p_item_id:id,p_conferido:b.dataset.current!=="1"},true);await renderExpedition()}catch(e){showToast(e.message)}
      }
      if(a==="finish-delivery"){
        var pending=Number(b.dataset.pending||0);
        if(!state.deliveryMode){showToast("Escolha como o pedido foi conferido.");return}
        if(pending>0&&!state.deliveryPayment){showToast("Informe como ficou o pagamento.");return}
        var open=state.deliveryPayment==="em_aberto",method=open||pending<=0?null:state.deliveryPayment;
        try{
          var result=await rpc("entrega_finalizar_cliente",{p_pedido_id:id,p_tipo_conferencia:state.deliveryMode,p_referencia:state.deliveryReference,p_pagamento_metodo:method,p_ficou_em_aberto:open,p_observacao:null},true);
          state.deliveryOpenOrder=null;state.deliveryMode=null;state.deliveryReference=null;state.deliveryPayment=null;
          showToast(result==="entregue_em_aberto"?"Entrega concluída com saldo em aberto.":"Entrega concluída e cliente notificado.");
          await renderExpedition();
        }catch(e){showToast(e.message)}
      }
      if(a==="start-route"){
        var rid=b.dataset.route,safe=rid.replaceAll("-","");
        var vehicle=document.getElementById("routeVehicle-"+safe).value;
        var driver=document.getElementById("routeDriver-"+safe).value.trim()||null;
        var raw=document.getElementById("routeKmStart-"+safe).value;
        if(!vehicle){showToast("Selecione carro ou moto.");return}
        if(raw===""){showToast("Odômetro inicial é obrigatório.");return}
        var km=Number(raw.replace(",","."));
        if(!Number.isFinite(km)||km<0){showToast("Odômetro inicial inválido.");return}
        try{await rpc("expedicao_iniciar_rota",{p_rota_id:rid,p_data:b.dataset.date,p_motorista:driver,p_veiculo:vehicle,p_odometro_inicio:km},true);showToast("Rota iniciada. Clientes notificados.");await renderExpedition()}catch(e){showToast(e.message)}
      }
      if(a==="finish-route"){
        var rid2=b.dataset.route,safe2=rid2.replaceAll("-"),raw2=document.getElementById("routeKmEnd-"+safe2).value;
        if(raw2===""){showToast("Odômetro final é obrigatório.");return}
        var km2=Number(raw2.replace(",","."));
        if(!Number.isFinite(km2)||km2<0){showToast("Odômetro final inválido.");return}
        try{await rpc("expedicao_finalizar_rota",{p_execucao_id:id,p_odometro_fim:km2,p_observacao:null},true);showToast("Rota finalizada.");await renderExpedition()}catch(e){showToast(e.message)}
      }
    };
  }

  var baseFinance=renderFinance;
  renderFinance=async function(){
    await baseFinance();
    try{
      var alerts=await rpc("financeiro_alertas_entrega",{},true)||[];
      if(!alerts.length)return;
      var title=main.querySelector(".internal-title");
      if(!title)return;
      var box=document.createElement("section");
      box.className="finance-delivery-alerts";
      box.innerHTML="<h3>⚠ Pendências vindas da entrega</h3>"+alerts.map(function(x){
        return "<article><div><b>"+esc(x.numero)+" • "+esc(x.cliente_nome)+"</b><small>Entregue "+fmtDateTime(x.entregue_em)+" • "+conferenceLabel(x.conferencia_tipo)+"</small></div><strong>"+brl(x.valor_em_aberto)+"</strong><button data-fin-delivery='"+x.pedido_id+"' data-value='"+Number(x.valor_em_aberto)+"'>Receber</button></article>";
      }).join("");
      title.insertAdjacentElement("afterend",box);
      box.onclick=async function(ev){
        var b=ev.target.closest("[data-fin-delivery]");if(!b)return;
        var choice=prompt("Forma recebida: 1 Dinheiro • 2 Pix • 3 Crédito • 4 Débito","1");if(choice===null)return;
        var method=({"1":"dinheiro","2":"pix","3":"credito","4":"debito"})[choice.trim()];
        if(!method){showToast("Forma de pagamento inválida.");return}
        var max=Number(b.dataset.value),raw=prompt("Valor recebido:",String(max).replace(".",","));if(raw===null)return;
        var value=Number(raw.replace(",","."));
        if(!Number.isFinite(value)||value<=0||value>max){showToast("Valor inválido.");return}
        try{await rpc("financeiro_receber_pendencia_entrega",{p_pedido_id:b.dataset.finDelivery,p_metodo:method,p_valor:value,p_observacao:null},true);showToast("Recebimento registrado. Cliente notificado.");await renderFinance()}catch(e){showToast(e.message)}
      };
    }catch(e){console.warn("Alertas da entrega:",e.message)}
  };
})();
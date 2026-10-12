export function installInternalManagement(ctx){
  const state=ctx.state,main=ctx.main,rpc=ctx.rpc,internalShell=ctx.internalShell,loading=ctx.loading,esc=ctx.esc,showToast=ctx.showToast,fmtTime=ctx.fmtTime,fmtDate=ctx.fmtDate,fmtDateTime=ctx.fmtDateTime,brl=ctx.brl;

  function dayName(n){ return ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"][Number(n)]||""; }

  async function renderAttendanceRoutes(){
    loading("Carregando rotas...");
    try{
      const rows=await rpc("atendimento_rotas_lista",{},true)||[];
      let html=internalShell("rotas_atendimento");
      html+="<section class='internal-title'><div><span class='internal-eyebrow'>ATENDIMENTO</span><h1>Rotas de entrega</h1><p>Consulte dias e horários para orientar o cliente. Alterações são feitas pelo Administrativo.</p></div></section>";
      html+="<section class='route-read-list'>";
      html+=rows.length?rows.map(function(r){
        return "<article class='route-read-card'>"+
          "<div class='route-read-main'><span>ROTA</span><strong>"+esc(r.nome)+"</strong><p>"+esc(r.descricao||r.mensagem_cliente||"Entrega programada pela Algaroba.")+"</p></div>"+
          "<div class='route-read-facts'>"+
            "<div><small>Dias</small><b>"+esc(r.dias||"—")+"</b></div>"+
            "<div><small>Pedidos até</small><b>"+(fmtTime(r.hora_limite_pedido)||"11:00")+"</b></div>"+
            "<div><small>Saída padrão</small><b>"+(fmtTime(r.hora_inicio_padrao)||"14:00")+"</b></div>"+
          "</div>"+
          "<button type='button' class='route-suggest-btn' data-route-suggest='"+r.rota_id+"' data-route-name='"+esc(r.nome)+"'>Sugerir alteração →</button>"+
        "</article>";
      }).join(""):"<div class='empty'>Nenhuma rota ativa.</div>";
      html+="</section><div class='notice green'><b>Atendimento</b><br>Você pode informar a rota ao cliente e enviar uma sugestão. Mudança de dia, horário ou criação de rota fica sob controle do Administrativo.</div>";
      main.innerHTML=html;
      main.onclick=async function(ev){
        const b=ev.target.closest("[data-route-suggest]");
        if(!b)return;
        const suggestion=prompt("Sugestão para "+b.dataset.routeName+":");
        if(!suggestion||!suggestion.trim())return;
        try{
          await rpc("atendimento_sugerir_rota",{p_rota_id:b.dataset.routeSuggest,p_sugestao:suggestion.trim()},true);
          showToast("Sugestão enviada ao Administrativo.");
        }catch(e){showToast(e.message)}
      };
    }catch(e){main.innerHTML=internalShell("rotas_atendimento")+"<div class='empty'>"+esc(e.message)+"</div>"}
  }

  async function renderAdminRoutes(){
    loading("Carregando rotas...");
    try{
      const data=await Promise.all([rpc("admin_rotas_lista",{},true),rpc("admin_rota_sugestoes_lista",{},true)]);
      const routes=data[0]||[],suggestions=data[1]||[];
      state.adminRoutes=routes;
      let html=internalShell("rotas_admin");
      html+="<section class='internal-title'><div><span class='internal-eyebrow'>ADMINISTRATIVO</span><h1>Rotas</h1><p>Crie rotas e altere dia, horário e situação operacional.</p></div><button class='button orange' data-route-new='1'>＋ Nova rota</button></section>";
      html+="<section id='routeEditorBox'></section><section class='admin-route-list'>";
      html+=routes.length?routes.map(function(r){
        return "<article class='admin-route-card "+(r.ativo?"":"inactive")+"'><div><span>"+(r.ativo?"ATIVA":"INATIVA")+"</span><strong>"+esc(r.nome)+"</strong><small>"+esc(r.dias_texto||"Sem dia")+" • pedidos até "+fmtTime(r.hora_limite_pedido)+" • saída "+fmtTime(r.hora_inicio_padrao)+"</small></div><button type='button' data-route-edit='"+r.rota_id+"'>Editar</button></article>";
      }).join(""):"<div class='empty'>Nenhuma rota cadastrada.</div>";
      html+="</section><div class='section-head'><div><h2>Sugestões do Atendimento</h2><p>Ideias enviadas pela equipe para análise do ADM.</p></div></div><section class='route-suggestion-list'>";
      html+=suggestions.length?suggestions.map(function(s){
        const actions=s.status==="pendente"?"<div class='route-suggestion-actions'><button data-suggestion-id='"+s.sugestao_id+"' data-suggestion-status='aprovada'>Aprovar</button><button data-suggestion-id='"+s.sugestao_id+"' data-suggestion-status='recusada'>Recusar</button></div>":"";
        return "<article><div><span class='status "+(s.status==="aprovada"?"ok":s.status==="recusada"?"bad":"warn")+"'>"+esc(s.status)+"</span><strong>"+esc(s.rota_nome)+"</strong><p>"+esc(s.sugestao)+"</p><small>"+esc(s.autor)+" • "+fmtDateTime(s.created_at)+"</small>"+(s.resposta?"<em>Resposta: "+esc(s.resposta)+"</em>":"")+"</div>"+actions+"</article>";
      }).join(""):"<div class='empty compact'>Nenhuma sugestão pendente.</div>";
      html+="</section>";
      main.innerHTML=html;

      main.onclick=async function(ev){
        const newBtn=ev.target.closest("[data-route-new]");
        if(newBtn){openRouteEditor(null);return}
        const edit=ev.target.closest("[data-route-edit]");
        if(edit){openRouteEditor(edit.dataset.routeEdit);return}
        const answer=ev.target.closest("[data-suggestion-id]");
        if(answer){
          const status=answer.dataset.suggestionStatus;
          const response=prompt(status==="aprovada"?"Observação da aprovação (opcional):":"Motivo / resposta (opcional):")||null;
          try{
            await rpc("admin_responder_sugestao_rota",{p_sugestao_id:answer.dataset.suggestionId,p_status:status,p_resposta:response},true);
            showToast("Sugestão atualizada.");
            await renderAdminRoutes();
          }catch(e){showToast(e.message)}
        }
      };
    }catch(e){main.innerHTML=internalShell("rotas_admin")+"<div class='empty'>"+esc(e.message)+"</div>"}
  }

  function openRouteEditor(id){
    const r=id?(state.adminRoutes||[]).find(function(x){return x.rota_id===id}):null;
    const days=r&&Array.isArray(r.dias)?r.dias:[2];
    const box=document.querySelector("#routeEditorBox");if(!box)return;
    let html="<form id='routeAdminForm' class='route-admin-form'>"+
      "<input type='hidden' name='rota_id' value='"+esc(r&&r.rota_id||"")+"'>"+
      "<div class='route-form-head'><div><b>"+(r?"Editar rota":"Nova rota")+"</b><small>Dia, horários e nome da operação</small></div><button type='button' data-route-close='1'>×</button></div>"+
      "<div class='route-form-grid'>"+
        "<label class='wide'><span>Nome da rota</span><input name='nome' required value='"+esc(r&&r.nome||"")+"'></label>"+
        "<label class='wide'><span>Descrição</span><input name='descricao' value='"+esc(r&&r.descricao||"")+"'></label>"+
        "<label><span>Pedidos até</span><input name='limite' type='time' required value='"+(fmtTime(r&&r.hora_limite_pedido)||"11:00")+"'></label>"+
        "<label><span>Saída padrão</span><input name='saida' type='time' required value='"+(fmtTime(r&&r.hora_inicio_padrao)||"14:00")+"'></label>"+
        "<label><span>Saída antecipada</span><input name='antecipada' type='time' required value='"+(fmtTime(r&&r.hora_inicio_antecipada)||"13:00")+"'></label>"+
        "<label><span>Situação</span><select name='ativo'><option value='true' "+(!r||r.ativo!==false?"selected":"")+">Ativa</option><option value='false' "+(r&&r.ativo===false?"selected":"")+">Inativa</option></select></label>"+
        "<label class='wide'><span>Observação operacional</span><input name='observacao' value='"+esc(r&&r.observacao_operacional||"")+"'></label>"+
      "</div><div class='route-days'>";
    [0,1,2,3,4,5,6].forEach(function(d){
      html+="<label><input type='checkbox' name='dias' value='"+d+"' "+(days.includes(d)?"checked":"")+"><span>"+dayName(d)+"</span></label>";
    });
    html+="</div><button class='button orange route-save-btn' type='submit'>Salvar rota</button></form>";
    box.innerHTML=html;
    const close=box.querySelector("[data-route-close]");if(close)close.onclick=function(){box.innerHTML=""};
    const form=box.querySelector("#routeAdminForm");
    form.onsubmit=async function(ev){
      ev.preventDefault();
      const fd=new FormData(form);
      const dias=[...form.querySelectorAll("input[name='dias']:checked")].map(function(x){return Number(x.value)});
      if(!dias.length){showToast("Selecione pelo menos um dia.");return}
      try{
        await rpc("admin_salvar_rota",{
          p_rota_id:fd.get("rota_id")||null,
          p_nome:fd.get("nome"),
          p_descricao:fd.get("descricao")||null,
          p_dias:dias,
          p_hora_limite_pedido:fd.get("limite"),
          p_hora_inicio_padrao:fd.get("saida"),
          p_hora_inicio_antecipada:fd.get("antecipada"),
          p_ativo:fd.get("ativo")==="true",
          p_observacao_operacional:fd.get("observacao")||null
        },true);
        showToast("Rota salva.");
        await renderAdminRoutes();
      }catch(e){showToast(e.message)}
    };
    box.scrollIntoView({behavior:"smooth",block:"start"});
  }

  async function renderAdministrativeReports(){
    loading("Carregando relatórios administrativos...");
    try{
      const now=new Date(),start=new Date(now.getFullYear(),now.getMonth(),1).toISOString().slice(0,10),end=now.toISOString().slice(0,10);
      const data=await Promise.all([
        rpc("admin_relatorio_estoque",{},true),
        rpc("admin_relatorio_caixa",{p_inicio:start,p_fim:end},true),
        rpc("admin_relatorio_cmv_produtos",{},true),
        rpc("relatorio_desempenho_rotas",{p_inicio:start,p_fim:end},true)
      ]);
      const stock=data[0]||[],cash=data[1]||[],cmv=data[2]||[],routes=data[3]||[];
      const low=stock.filter(function(x){return x.abaixo_minimo}).length;
      const cashIn=cash.reduce(function(s,x){return s+Number(x.entradas||0)},0);
      const cashOut=cash.reduce(function(s,x){return s+Number(x.saidas||0)},0);
      const cmvOk=cmv.filter(function(x){return x.custo_cadastrado}).length;
      let html=internalShell("relatorios_admin");
      html+="<section class='internal-title'><div><span class='internal-eyebrow'>ADMINISTRATIVO</span><h1>Relatórios operacionais</h1><p>Estoque, caixa, CMV e desempenho de rotas. Relatórios financeiros finais permanecem no Financeiro.</p></div></section>";
      html+="<section class='admin-report-grid'><article><span>Estoque</span><b>"+stock.length+"</b><small>"+low+" abaixo do mínimo</small></article><article><span>Entradas de caixa</span><b>"+brl(cashIn)+"</b><small>Mês atual</small></article><article><span>Saídas de caixa</span><b>"+brl(cashOut)+"</b><small>Mês atual</small></article><article><span>CMV cadastrado</span><b>"+cmvOk+"/"+cmv.length+"</b><small>"+(cmvOk?"Produtos com custo":"Aguardando custos/receitas")+"</small></article></section>";
      html+="<div class='section-head'><div><h2>Estoque</h2><p>Itens com atenção de saldo.</p></div></div><section class='admin-report-list'>";
      html+=stock.filter(function(x){return x.abaixo_minimo}).slice(0,30).map(function(x){return "<article><b>"+esc(x.produto)+"</b><span>"+Number(x.quantidade_atual).toLocaleString("pt-BR")+" atual • mínimo "+Number(x.estoque_minimo).toLocaleString("pt-BR")+"</span></article>"}).join("")||"<div class='empty compact'>Nenhum item abaixo do mínimo.</div>";
      html+="</section><div class='section-head'><div><h2>Caixa</h2><p>Movimento diário do mês atual.</p></div></div><section class='admin-report-list'>";
      html+=cash.map(function(x){return "<article><b>"+fmtDate(x.data)+"</b><span>Entrada "+brl(x.entradas)+" • Saída "+brl(x.saidas)+" • Saldo "+brl(x.saldo_movimentos)+"</span></article>"}).join("")||"<div class='empty compact'>Sem movimentos no período.</div>";
      html+="</section><div class='section-head'><div><h2>CMV</h2><p>Baseado nos custos cadastrados, sem estimativas fictícias.</p></div></div><section class='admin-report-list cmv'>";
      html+=cmv.filter(function(x){return x.custo_cadastrado}).slice(0,40).map(function(x){return "<article><b>"+esc(x.produto)+"</b><span>Custo "+brl(x.custo_unitario)+" • CMV atacado "+(x.cmv_atacado_pct==null?"—":x.cmv_atacado_pct+"%")+" • varejo "+(x.cmv_varejo_pct==null?"—":x.cmv_varejo_pct+"%")+"</span></article>"}).join("")||"<div class='raw-material-placeholder'><b>CMV ainda sem base de custo</b><p>Quando cadastrarmos matérias-primas, receitas e custos, este relatório será calculado com dados reais.</p></div>";
      html+="</section><div class='section-head'><div><h2>Rotas</h2><p>Desempenho operacional do mês.</p></div></div><section class='admin-report-list'>";
      html+=routes.slice(0,30).map(function(x){return "<article><b>"+fmtDate(x.data_rota)+" • "+esc(x.rota_nome)+"</b><span>"+Number(x.entregas_concluidas||0)+"/"+Number(x.entregas_planejadas||0)+" entregas • "+(x.km_rodados==null?"km pendente":Number(x.km_rodados).toLocaleString("pt-BR")+" km")+" • "+Number(x.taxa_conclusao||0).toLocaleString("pt-BR")+"%</span></article>"}).join("")||"<div class='empty compact'>Sem rotas finalizadas no período.</div>";
      html+="</section>";
      main.innerHTML=html;
    }catch(e){main.innerHTML=internalShell("relatorios_admin")+"<div class='empty'>"+esc(e.message)+"</div>"}
  }

  return {renderAttendanceRoutes,renderAdminRoutes,renderAdministrativeReports};
}

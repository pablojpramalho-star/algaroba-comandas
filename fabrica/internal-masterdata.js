import { installReceitasLote } from "./internal-receitas.js?v=20261012-lote2";
export function installInternalMasterData(ctx){
  const state=ctx.state,main=ctx.main,rpc=ctx.rpc,internalShell=ctx.internalShell,loading=ctx.loading,esc=ctx.esc,showToast=ctx.showToast,brl=ctx.brl,fmtDate=ctx.fmtDate,loadCatalog=ctx.loadCatalog;
  const receitasLote=installReceitasLote(ctx);
  if(!("clientTypeFilter" in state))state.clientTypeFilter=localStorage.getItem("algaroba_client_type")||"recorrente";

  function clientStatus(c){
    if(!c.ativo)return "<span class='status bad'>inativo</span>";
    if(c.portal_ativado_em)return "<span class='status ok'>portal ativo</span>";
    if(c.origem==="my_loja_store")return "<span class='status warn'>base antiga</span>";
    return "<span class='status'>cadastro novo</span>";
  }

  async function renderClients(query){
    if(typeof query==="string")state.clientSearch=query;
    loading("Carregando clientes...");
    try{
      var rows=await rpc("admin_clientes_lista_v2",{p_busca:null,p_limit:500},true)||[];
      var type=state.clientTypeFilter||"recorrente";
      var q=(state.clientSearch||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
      var counts={
        recorrente:rows.filter(function(c){return c.tipo_cliente==="recorrente"}).length,
        avulso:rows.filter(function(c){return c.tipo_cliente==="avulso"}).length,
        nao_classificado:rows.filter(function(c){return !c.tipo_cliente||c.tipo_cliente==="nao_classificado"}).length
      };
      var filtered=rows.filter(function(c){
        var ct=c.tipo_cliente||"nao_classificado";
        if(ct!==type)return false;
        if(!q)return true;
        return [c.nome,c.nome_fantasia,c.whatsapp,c.telefone,c.cpf_cnpj,c.email,c.codigo_cliente]
          .filter(Boolean).join(" ").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().includes(q);
      });
      var shown=filtered.slice(0,150);
      function typeLabel(v){return v==="recorrente"?"Recorrente":v==="avulso"?"Avulso":"Não classificado"}
      main.innerHTML=internalShell("clientes")+
        "<section class='internal-title clients-title'><div><span class='internal-eyebrow'>CLIENTES</span><h1>Cadastro de clientes</h1><p>Organize recorrentes, avulsos e cadastros ainda não classificados.</p></div></section>"+
        "<section class='client-type-grid'>"+
          "<button type='button' class='"+(type==="recorrente"?"active":"")+"' data-client-type='recorrente'><i>↻</i><div><strong>Recorrentes</strong><span>Relacionamento contínuo</span></div><b>"+counts.recorrente+"</b></button>"+
          "<button type='button' class='"+(type==="avulso"?"active":"")+"' data-client-type='avulso'><i>•</i><div><strong>Avulsos</strong><span>Compras pontuais</span></div><b>"+counts.avulso+"</b></button>"+
          "<button type='button' class='"+(type==="nao_classificado"?"active":"")+"' data-client-type='nao_classificado'><i>?</i><div><strong>Não classificados</strong><span>Aguardando definição</span></div><b>"+counts.nao_classificado+"</b></button>"+
        "</section>"+
        "<section class='master-toolbar client-toolbar'><form id='clientSearchForm' class='master-search'><span>⌕</span><input id='clientSearchInput' type='search' value='"+esc(state.clientSearch||"")+"' placeholder='Buscar nome, estabelecimento, WhatsApp, CPF/CNPJ ou código'><button>Buscar</button></form><button type='button' class='master-new-client' data-client-new='1'>＋ Novo cliente</button><div class='master-count'><b>"+filtered.length+"</b><span>"+typeLabel(type)+"</span></div></section>"+
        "<div class='client-list-caption'>"+filtered.length+" "+(filtered.length===1?"cliente":"clientes")+(filtered.length>150?" • mostrando os primeiros 150":"")+"</div>"+
        "<section class='client-directory'>"+
          (shown.length?shown.map(function(c){
            return "<button type='button' class='client-directory-card' data-client-id='"+c.cliente_id+"'>"+
              "<div class='client-avatar'>"+esc((c.nome_fantasia||c.nome||"?").trim().slice(0,1).toUpperCase())+"</div>"+
              "<div class='client-directory-copy'><strong>"+esc(c.nome_fantasia||c.nome)+"</strong>"+
              "<small>"+(c.nome_fantasia?esc(c.nome)+" • ":"")+esc(c.codigo_cliente||"Cadastro novo")+(c.whatsapp?" • "+esc(c.whatsapp):"")+"</small>"+
              "<div>"+clientStatus(c)+" <span class='client-type-badge "+esc(c.tipo_cliente||"nao_classificado")+"'>"+typeLabel(c.tipo_cliente)+"</span>"+(c.status_migracao&&c.status_migracao!=="OK"?" <span class='status warn'>"+esc(c.status_migracao)+"</span>":"")+"</div></div>"+
              "<span class='client-open'>›</span></button>";
          }).join(""):"<div class='empty'>Nenhum cliente nesta classificação.</div>")+
        "</section>";
      var form=document.querySelector("#clientSearchForm");
      if(form)form.onsubmit=function(ev){ev.preventDefault();state.clientSearch=document.querySelector("#clientSearchInput").value.trim();renderClients()};
      var search=document.querySelector("#clientSearchInput");
      if(search)search.oninput=function(){state.clientSearch=search.value;renderClients()};
      main.onclick=function(ev){
        var newButton=ev.target.closest("[data-client-new]");
        if(newButton)return renderNewClient();
        var typeButton=ev.target.closest("[data-client-type]");
        if(typeButton){
          state.clientTypeFilter=typeButton.dataset.clientType;
          localStorage.setItem("algaroba_client_type",state.clientTypeFilter);
          return renderClients();
        }
        var b=ev.target.closest("[data-client-id]");
        if(b)renderClientDetail(b.dataset.clientId);
      };
    }catch(e){main.innerHTML=internalShell("clientes")+"<div class='empty'>"+esc(e.message)+"</div>"}
  }


  function renderNewClient(){
    main.innerHTML=internalShell("clientes")+
      "<button type='button' class='work-back master-back' id='newClientBack'>← Clientes</button>"+
      "<section class='client-profile-head new-client-head'><div class='client-avatar large'>＋</div><div><span>NOVO CADASTRO</span><h1>Novo cliente</h1><p>Cadastre os dados básicos e depois complete endereço, rota e horário de recebimento.</p></div></section>"+
      "<form id='newClientForm' class='master-form'>"+
        "<section class='master-form-section'><div class='master-form-title'><h2>Dados iniciais</h2><p>O nome é obrigatório. Os demais dados podem ser completados na ficha do cliente.</p></div><div class='master-form-grid'>"+
          field("Nome / responsável","nome","",true)+
          field("Nome fantasia","nome_fantasia","")+
          "<label class='master-field'><span>Tipo de cliente</span><select name='tipo_cliente'><option value='nao_classificado'>Não classificado</option><option value='recorrente'>Recorrente / revenda</option><option value='avulso'>Avulso / consumidor final</option></select></label>"+
          field("WhatsApp","whatsapp","")+
          field("CPF/CNPJ","cpf_cnpj","")+
          field("E-mail","email","","email")+
        "</div></section>"+
        "<section class='master-form-footer'><div><b>Próximo passo</b><small>Após criar, abriremos a ficha completa para cadastrar o endereço.</small></div><button class='master-save' type='submit'>Criar cliente →</button></section>"+
      "</form>";
    document.querySelector("#newClientBack").onclick=function(){renderClients()};
    document.querySelector("#newClientForm").onsubmit=async function(ev){
      ev.preventDefault();
      var fd=new FormData(ev.currentTarget),btn=ev.currentTarget.querySelector("button[type='submit']");
      try{
        btn.disabled=true;btn.textContent="Criando...";
        var id=await rpc("atendimento_criar_cliente",{
          p_nome:fd.get("nome"),
          p_nome_fantasia:fd.get("nome_fantasia")||null,
          p_whatsapp:fd.get("whatsapp")||null,
          p_cpf_cnpj:fd.get("cpf_cnpj")||null,
          p_email:fd.get("email")||null,
          p_tipo_cliente:fd.get("tipo_cliente")||"nao_classificado"
        },true);
        showToast("Cliente criado. Complete o cadastro e o endereço.");
        await renderClientDetail(id);
      }catch(e){showToast(e.message);btn.disabled=false;btn.textContent="Criar cliente →"}
    };
  }

  async function renderClientDetail(id){
    loading("Abrindo cadastro...");
    try{
      var payload=await rpc("admin_cliente_ficha_completa",{p_cliente_id:id},true);
      var f=Array.isArray(payload)?payload[0]:payload;
      if(f&&f.admin_cliente_ficha_completa)f=f.admin_cliente_ficha_completa;
      if(!f||!f.cliente)throw new Error("Cliente não encontrado.");

      var c=f.cliente||{},addresses=f.enderecos||[],conditions=f.condicoes||{},clientRoutes=f.rotas_cliente||[],routes=f.rotas_disponiveis||[];
      var address=addresses.find(function(x){return x.entrega&&x.ativo})||addresses.find(function(x){return x.ativo})||addresses[0]||{};
      var route=clientRoutes.find(function(x){return x.principal})||clientRoutes[0]||{};
      var canCommercial=["administrador","gerente"].includes(state.role);
      var routeOptions="<option value=''>Sem rota definida</option>"+routes.map(function(r){
        return "<option value='"+r.rota_id+"' "+(route.rota_id===r.rota_id?"selected":"")+">"+esc(r.nome+(r.dia_semana?" • "+r.dia_semana:""))+"</option>";
      }).join("");

      main.innerHTML=internalShell("clientes")+
        "<button type='button' class='work-back master-back' id='clientBack'>← Clientes</button>"+
        "<section class='client-profile-head'><div class='client-avatar large'>"+esc((c.nome_fantasia||c.nome||"?").trim().slice(0,1).toUpperCase())+"</div><div><span>"+esc(c.codigo_cliente||"CADASTRO NOVO")+"</span><h1>"+esc(c.nome_fantasia||c.nome)+"</h1><p>"+(c.nome_fantasia?"Responsável: "+esc(c.nome)+" • ":"")+esc(c.origem==="my_loja_store"?"Importado do My Loja Store":"Cadastro do novo sistema")+(c.portal_ativado_em?" • Portal ativado":"")+"</p></div></section>"+
        "<form id='clientFullForm' class='master-form client-full-form'>"+
          "<section class='master-form-section'><div class='master-form-title'><h2>Dados cadastrais</h2><p>Identificação e contato do cliente.</p></div><div class='master-form-grid'>"+
            field("Nome / responsável","nome",c.nome,true)+
            field("Nome fantasia","nome_fantasia",c.nome_fantasia)+
            "<label class='master-field'><span>Tipo de cliente</span><select name='tipo_cliente'><option value='nao_classificado' "+(c.tipo_cliente==="nao_classificado"?"selected":"")+">Não classificado</option><option value='recorrente' "+(c.tipo_cliente==="recorrente"?"selected":"")+">Recorrente / revenda</option><option value='avulso' "+(c.tipo_cliente==="avulso"?"selected":"")+">Avulso / consumidor final</option></select></label>"+
            field("CPF/CNPJ","cpf_cnpj",c.cpf_cnpj)+
            field("WhatsApp","whatsapp",c.whatsapp)+
            field("Telefone","telefone",c.telefone)+
            field("E-mail","email",c.email,"email")+
            field("Nascimento","nascimento",c.nascimento,"date")+
          "</div></section>"+

          "<section class='master-form-section client-section-highlight'><div class='master-form-title'><h2>Endereço e entrega</h2><p>Dados usados para rota, expedição e recebimento.</p></div>"+
            "<input type='hidden' name='endereco_id' value='"+esc(address.id||"")+"'>"+
            "<div class='master-form-grid'>"+
              field("Identificação","identificacao",address.identificacao||"Principal")+
              field("CEP","cep",address.cep)+
              field("Rua / logradouro","logradouro",address.logradouro)+
              field("Número","numero",address.numero)+
              field("Complemento","complemento",address.complemento)+
              field("Conjunto / condomínio","conjunto",address.conjunto)+
              field("Bairro","bairro",address.bairro)+
              field("Cidade","cidade",address.cidade)+
              field("UF","uf",address.uf)+
              field("Referência","referencia",address.referencia)+
            "</div>"+
            "<div class='master-check-row'>"+
              "<label class='master-toggle'><input type='checkbox' name='sem_numero' "+(address.sem_numero?"checked":"")+"><span>Sem número</span></label>"+
              "<label class='master-toggle'><input type='checkbox' name='cobranca' "+(address.cobranca?"checked":"")+"><span>Também endereço de cobrança</span></label>"+
            "</div>"+
            (c.endereco_legado?"<div class='client-legacy-note'><b>Endereço antigo:</b> "+esc(c.endereco_legado)+"</div>":"")+
          "</section>"+

          "<section class='master-form-section'><div class='master-form-title'><h2>Rota e horário de recebimento</h2><p>Informações operacionais para organizar as entregas.</p></div><div class='master-form-grid'>"+
            "<label class='master-field'><span>Rota principal</span><select name='rota_id'>"+routeOptions+"</select></label>"+
            field("Horário de funcionamento","horario_funcionamento",c.horario_funcionamento)+
            field("Recebe a partir de","recebimento_inicio",timeValue(address.recebimento_inicio),"time")+
            field("Recebe até","recebimento_fim",timeValue(address.recebimento_fim),"time")+
            field("Início do intervalo","intervalo_inicio",timeValue(address.intervalo_inicio),"time")+
            field("Fim do intervalo","intervalo_fim",timeValue(address.intervalo_fim),"time")+
            field("Prioridade logística (0–100)","prioridade_logistica",address.prioridade_logistica||0,"number")+
          "</div>"+
          "<div class='master-check-row'>"+
            "<label class='master-toggle'><input type='checkbox' name='recebe_sem_horario_fixo' "+(address.recebe_sem_horario_fixo!==false?"checked":"")+"><span>Recebe sem horário fixo</span></label>"+
            "<label class='master-toggle'><input type='checkbox' name='janela_recebimento_confirmada' "+(address.janela_recebimento_confirmada?"checked":"")+"><span>Horário confirmado com cliente</span></label>"+
          "</div>"+
          "<label class='master-field full'><span>Observação de recebimento</span><textarea name='observacao_recebimento' rows='3' placeholder='Ex.: fecha para almoço, receber no depósito, falar com João...'>"+esc(address.observacao_recebimento||c.observacao_recebimento||"")+"</textarea></label>"+
          "<label class='master-field full'><span>Observação da rota</span><input name='rota_observacao' value='"+esc(route.observacao||"")+"' placeholder='Informação específica para esta rota'></label>"+
          "</section>"+

          "<section class='master-form-section commercial-section "+(canCommercial?"":"readonly")+"'><div class='master-form-title'><h2>Condições comerciais</h2><p>"+(canCommercial?"Visível somente para a equipe interna.":"Somente ADM/Gerência pode alterar estes campos.")+"</p></div><div class='master-form-grid'>"+
            "<label class='master-field'><span>Segmento comercial</span><select name='segmento_comercial' "+(canCommercial?"":"disabled")+"><option value='padrao' "+(conditions.segmento_comercial==="padrao"?"selected":"")+">Padrão</option><option value='recorrente' "+(conditions.segmento_comercial==="recorrente"?"selected":"")+">Recorrente</option><option value='super_atacado' "+(conditions.segmento_comercial==="super_atacado"?"selected":"")+">Super atacado</option><option value='estrategico' "+(conditions.segmento_comercial==="estrategico"?"selected":"")+">Estratégico</option><option value='personalizado' "+(conditions.segmento_comercial==="personalizado"?"selected":"")+">Personalizado</option></select></label>"+
            fieldDisabled("Desconto (%)","desconto_percentual",conditions.desconto_percentual||0,"number",!canCommercial)+
            fieldDisabled("Bônus (%)","bonus_percentual",conditions.bonus_percentual||0,"number",!canCommercial)+
            fieldDisabled("Limite de crédito","limite_credito",conditions.limite_credito||0,"number",!canCommercial)+
            fieldDisabled("Dias de prazo","dias_prazo",conditions.dias_prazo||0,"number",!canCommercial)+
          "</div>"+
          "<div class='master-check-row'>"+
            "<label class='master-toggle'><input type='checkbox' name='prazo_habilitado' "+(conditions.prazo_habilitado?"checked":"")+" "+(canCommercial?"":"disabled")+"><span>Compra a prazo habilitada</span></label>"+
            "<label class='master-toggle'><input type='checkbox' name='beneficios_bloqueados' "+(conditions.beneficios_bloqueados?"checked":"")+" "+(canCommercial?"":"disabled")+"><span>Benefícios bloqueados</span></label>"+
          "</div>"+
          "<label class='master-field full'><span>Motivo do bloqueio</span><input name='motivo_bloqueio' value='"+esc(conditions.motivo_bloqueio||"")+"' "+(canCommercial?"":"disabled")+"></label>"+
          "<label class='master-field full'><span>Observação comercial interna</span><textarea name='condicao_observacao' rows='3' "+(canCommercial?"":"disabled")+">"+esc(conditions.observacao_interna||"")+"</textarea></label>"+
          "</section>"+

          "<section class='master-form-section internal-notes'><div class='master-form-title'><h2>Observações internas</h2><p>Não aparecem para o cliente.</p></div>"+
            "<label class='master-field full'><span>Ponto de referência interno</span><input name='referencia_interna' value='"+esc(c.referencia_interna||"")+"' placeholder='Ex.: box ao lado da farmácia, falar com Maria'></label>"+
            "<label class='master-field full'><span>Características / particularidades</span><textarea name='caracteristicas_internas' rows='3' placeholder='Ex.: prefere contato pelo WhatsApp, responsável pelo recebimento...'>"+esc(c.caracteristicas_internas||"")+"</textarea></label>"+
            "<label class='master-field full'><span>Observações internas</span><textarea name='observacao_interna' rows='4'>"+esc(c.observacao_interna||"")+"</textarea></label>"+
          "</section>"+

          "<section class='master-form-footer'><label class='master-toggle'><input type='checkbox' name='ativo' "+(c.ativo?"checked":"")+"><span>Cliente ativo</span></label><button class='master-save' type='submit'>Salvar cadastro completo</button></section>"+
        "</form>"+
        "<section class='client-history-shortcut'><div><b>Histórico administrativo</b><span>Compras antigas e novas continuam unificadas apenas para a equipe.</span></div><button type='button' id='clientHistoryBtn'>Abrir histórico</button></section>"+
        "<div id='clientHistoryBox'></div>";

      document.querySelector("#clientBack").onclick=function(){renderClients()};
      document.querySelector("#clientHistoryBtn").onclick=function(){renderClientHistory(id,c.nome_fantasia||c.nome)};

      document.querySelector("#clientFullForm").onsubmit=async function(ev){
        ev.preventDefault();
        var fd=new FormData(ev.currentTarget);
        var enderecoId=fd.get("endereco_id")||null;
        try{
          await rpc("admin_salvar_cliente_basico_v3",{
            p_cliente_id:id,
            p_nome:fd.get("nome"),
            p_nome_fantasia:fd.get("nome_fantasia")||null,
            p_tipo_cliente:fd.get("tipo_cliente")||"nao_classificado",
            p_whatsapp:fd.get("whatsapp")||null,
            p_telefone:fd.get("telefone")||null,
            p_cpf_cnpj:fd.get("cpf_cnpj")||null,
            p_email:fd.get("email")||null,
            p_nascimento:fd.get("nascimento")||null,
            p_horario_funcionamento:fd.get("horario_funcionamento")||null,
            p_observacao_recebimento:fd.get("observacao_recebimento")||null,
            p_referencia_interna:fd.get("referencia_interna")||null,
            p_caracteristicas_internas:fd.get("caracteristicas_internas")||null,
            p_observacao_interna:fd.get("observacao_interna")||null,
            p_ativo:fd.get("ativo")==="on"
          },true);
          await rpc("admin_salvar_endereco_cliente",{
            p_cliente_id:id,
            p_endereco_id:enderecoId,
            p_identificacao:fd.get("identificacao")||"Principal",
            p_cep:fd.get("cep")||null,
            p_logradouro:fd.get("logradouro")||null,
            p_numero:fd.get("numero")||null,
            p_sem_numero:fd.get("sem_numero")==="on",
            p_complemento:fd.get("complemento")||null,
            p_conjunto:fd.get("conjunto")||null,
            p_bairro:fd.get("bairro")||null,
            p_cidade:fd.get("cidade")||null,
            p_uf:fd.get("uf")||null,
            p_referencia:fd.get("referencia")||null,
            p_entrega:true,
            p_cobranca:fd.get("cobranca")==="on",
            p_recebimento_inicio:fd.get("recebimento_inicio")||null,
            p_recebimento_fim:fd.get("recebimento_fim")||null,
            p_intervalo_inicio:fd.get("intervalo_inicio")||null,
            p_intervalo_fim:fd.get("intervalo_fim")||null,
            p_recebe_sem_horario_fixo:fd.get("recebe_sem_horario_fixo")==="on",
            p_observacao_recebimento:fd.get("observacao_recebimento")||null,
            p_prioridade_logistica:Number(fd.get("prioridade_logistica")||0),
            p_janela_recebimento_confirmada:fd.get("janela_recebimento_confirmada")==="on"
          },true);
          await rpc("admin_salvar_rota_cliente",{p_cliente_id:id,p_rota_id:fd.get("rota_id")||null,p_observacao:fd.get("rota_observacao")||null},true);
          if(canCommercial){
            await rpc("admin_salvar_condicoes_cliente",{
              p_cliente_id:id,
              p_segmento_comercial:fd.get("segmento_comercial")||"padrao",
              p_desconto_percentual:Number(fd.get("desconto_percentual")||0),
              p_bonus_percentual:Number(fd.get("bonus_percentual")||0),
              p_prazo_habilitado:fd.get("prazo_habilitado")==="on",
              p_limite_credito:Number(fd.get("limite_credito")||0),
              p_dias_prazo:Number(fd.get("dias_prazo")||0),
              p_beneficios_bloqueados:fd.get("beneficios_bloqueados")==="on",
              p_motivo_bloqueio:fd.get("motivo_bloqueio")||null,
              p_observacao_interna:fd.get("condicao_observacao")||null
            },true);
          }
          showToast("Cadastro completo atualizado.");
          await renderClientDetail(id);
        }catch(e){showToast(e.message)}
      };
    }catch(e){main.innerHTML=internalShell("clientes")+"<div class='empty'>"+esc(e.message)+"</div>"}
  }

  async function renderClientHistory(id,name){
    var box=document.querySelector("#clientHistoryBox");if(!box)return;
    box.innerHTML="<div class='loading'><span class='spinner'></span><span>Carregando histórico...</span></div>";
    try{
      var year=new Date().getFullYear(),start=year+"-01-01",end=year+"-12-31";
      var parts=await Promise.all([
        rpc("admin_resumo_cliente_unificado",{p_cliente_id:id,p_inicio:start,p_fim:end},true),
        rpc("admin_relatorio_cliente_unificado",{p_cliente_id:id,p_inicio:start,p_fim:end},true)
      ]);
      var summary=Array.isArray(parts[0])?parts[0][0]:parts[0],history=parts[1]||[];
      box.innerHTML="<section class='client-history-panel'><div class='master-form-title'><h2>Histórico de "+esc(name||"cliente")+"</h2><p>"+year+" • uso administrativo</p></div>"+
        "<div class='client-history-kpis'><div><b>"+(summary?.pedidos||0)+"</b><span>pedidos</span></div><div><b>"+brl(summary?.total_comprado||0)+"</b><span>comprado</span></div><div><b>"+brl(summary?.saldo_pendente||0)+"</b><span>pendente</span></div></div>"+
        "<div class='client-history-orders'>"+(history.length?history.slice(0,20).map(function(o){return "<article><div><b>"+esc(o.numero)+"</b><small>"+esc(o.origem==="my_loja_store"?"Sistema antigo":"Sistema novo")+" • "+esc(o.cliente_nome_registro||"")+"</small></div><strong>"+brl(o.total)+"</strong></article>"}).join(""):"<div class='empty'>Sem compras neste período.</div>")+"</div></section>";
    }catch(e){box.innerHTML="<div class='empty'>"+esc(e.message)+"</div>"}
  }

  function timeValue(v){return v?String(v).slice(0,5):""}

  function fieldDisabled(label,name,value,type,disabled){
    return "<label class='master-field'><span>"+label+"</span><input type='"+(type||"text")+"' name='"+name+"' value='"+esc(value??"")+"' "+(disabled?"disabled":"")+"></label>";
  }

  function field(label,name,value,requiredOrType,typeArg){
    var required=requiredOrType===true,type=typeof requiredOrType==="string"?requiredOrType:(typeArg||"text");
    return "<label class='master-field'><span>"+label+"</span><input type='"+type+"' name='"+name+"' value='"+esc(value??"")+"' "+(type==="number"?"step='any' inputmode='decimal' ":"")+(required?"required":"")+"></label>";
  }

  function productAvailability(v){
    if(v==="disponivel")return "<span class='status ok'>disponível</span>";
    if(v==="em_falta")return "<span class='status bad'>em falta</span>";
    return "<span class='status warn'>"+esc(v||"indefinido")+"</span>";
  }

  function productAdminGroupKey(p){
    if(p.linha==="Tradicional")return "tradicional";
    if(p.linha==="Zero")return "zero";
    if(p.linha==="Classic")return "classic";
    if(p.linha==="Intense")return "intense";
    if(p.linha==="Raiz")return "raiz";
    if(p.categoria==="Xaropes")return "xaropes";
    if(p.categoria==="Coberturas")return "coberturas";
    if(p.categoria==="Grãos e Farináceos")return "graos";
    return "outros";
  }

  function productAdminGroups(){
    return [
      {key:"tradicional",label:"Tradicional",sub:"Linha Tradicional"},
      {key:"zero",label:"Zero",sub:"Linha Zero"},
      {key:"classic",label:"Classic",sub:"Linha Classic"},
      {key:"intense",label:"Intense",sub:"Linha Intense"},
      {key:"raiz",label:"Raiz",sub:"Linha Raiz"},
      {key:"xaropes",label:"Xaropes",sub:"Xaropes"},
      {key:"coberturas",label:"Coberturas",sub:"Coberturas"},
      {key:"graos",label:"Grãos",sub:"Grãos e Farináceos"},
      {key:"outros",label:"Outros",sub:"Outros produtos"}
    ];
  }

  async function renderProducts(query){
    if(typeof query==="string")state.productAdminSearch=query;
    if(!state.productAdminGroup)state.productAdminGroup="all";
    loading("Carregando produtos...");
    try{
      var rows=await rpc("admin_produtos_lista",{p_busca:state.productAdminSearch||null},true)||[];
      var defs=productAdminGroups();
      var grouped={};
      rows.forEach(function(p){
        var key=productAdminGroupKey(p);
        (grouped[key]||(grouped[key]=[])).push(p);
      });
      var visibleDefs=defs.filter(function(g){return (grouped[g.key]||[]).length>0});
      if(state.productAdminGroup!=="all"&&!grouped[state.productAdminGroup])state.productAdminGroup="all";

      function productCard(p){
        return "<button type='button' class='product-admin-card' data-product-id='"+p.produto_id+"'><div class='product-admin-copy'><span>"+esc([p.categoria,p.linha].filter(Boolean).join(" • "))+"</span><strong>"+esc(p.sabor||p.nome)+"</strong><small>"+esc(p.nome)+" • "+(p.peso_volume?Number(p.peso_volume).toLocaleString("pt-BR")+" "+esc(p.unidade||""):"")+"</small><div>"+productAvailability(p.disponibilidade_catalogo)+(p.destaque?" <span class='status warn'>destaque</span>":"")+(!p.ativo?" <span class='status bad'>inativo</span>":"")+"</div></div><div class='product-admin-price'><small>Atacado</small><b>"+brl(p.preco_atacado)+"</b><small>Varejo</small><b>"+brl(p.preco_varejo)+"</b></div><span class='client-open'>›</span></button>";
      }

      function groupSection(g){
        var list=grouped[g.key]||[];
        if(!list.length)return "";
        return "<section class='product-line-section product-line-"+g.key+"'><div class='product-line-head'><div><span>PRODUTOS</span><h2>"+esc(g.sub)+"</h2></div><b>"+list.length+" "+(list.length===1?"item":"itens")+"</b></div><div class='product-admin-list'>"+list.map(productCard).join("")+"</div></section>";
      }

      var displayed=state.productAdminGroup==="all"
        ? visibleDefs.map(groupSection).join("")
        : groupSection(defs.find(function(g){return g.key===state.productAdminGroup})||{key:state.productAdminGroup,label:state.productAdminGroup,sub:state.productAdminGroup});

      main.innerHTML=internalShell("produtos")+
        "<section class='internal-title'><div><span class='internal-eyebrow'>PRODUTOS</span><h1>Catálogo da Algaroba</h1><p>Edite o que o cliente vê sem misturar com o controle de estoque.</p></div></section>"+
        "<div class='recipe-inventory-shortcut'><button type='button' id='openStockInventory'>📦 Estoque primário: matérias-primas, embalagens e etiquetas</button></div>"+
        "<section class='master-toolbar'><form id='productSearchForm' class='master-search'><span>⌕</span><input id='productSearchInput' type='search' value='"+esc(state.productAdminSearch||"")+"' placeholder='Buscar produto, sabor, linha ou categoria'><button>Buscar</button></form><a class='master-preview-link' href='./catalogo.html' target='_blank' rel='noopener'>Ver catálogo público ↗</a></section>"+
        "<nav class='product-line-nav' aria-label='Filtrar produtos por linha'>"+
          "<button type='button' class='"+(state.productAdminGroup==="all"?"active":"")+"' data-product-group='all'><span>Todos</span><b>"+rows.length+"</b></button>"+
          visibleDefs.map(function(g){var count=(grouped[g.key]||[]).length;return "<button type='button' class='"+(state.productAdminGroup===g.key?"active":"")+"' data-product-group='"+g.key+"'><span>"+esc(g.label)+"</span><b>"+count+"</b></button>"}).join("")+
        "</nav>"+
        "<div class='product-grouped-list'>"+(displayed||"<div class='empty'>Nenhum produto encontrado.</div>")+"</div>";

      document.querySelector("#openStockInventory").onclick=function(){receitasLote.renderEstoquePrimario("Etiquetas",renderProducts)};
      var form=document.querySelector("#productSearchForm");
      if(form)form.onsubmit=function(ev){
        ev.preventDefault();
        state.productAdminSearch=document.querySelector("#productSearchInput").value.trim();
        renderProducts();
      };
      main.onclick=function(ev){
        var groupBtn=ev.target.closest("[data-product-group]");
        if(groupBtn){
          state.productAdminGroup=groupBtn.dataset.productGroup;
          renderProducts();
          return;
        }
        var b=ev.target.closest("[data-product-id]");
        if(b)renderProductDetail(b.dataset.productId);
      };
    }catch(e){main.innerHTML=internalShell("produtos")+"<div class='empty'>"+esc(e.message)+"</div>"}
  }

  function receitaLinha(x){
    x=x||{};
    var unidade=x.unidade||"g";
    var opts=["g","kg","ml","L","un"].map(function(u){return "<option value='"+u+"' "+(unidade===u?"selected":"")+">"+u+"</option>"}).join("");
    var qtd=x.quantidade===null||x.quantidade===undefined?"":String(x.quantidade);
    var preco=x.custo_referencia===null||x.custo_referencia===undefined?"":String(x.custo_referencia);
    var saldo=x.insumo_id===undefined?"":("<small class='recipe-stock-info'>Estoque: "+Number(x.estoque_atual||0).toLocaleString("pt-BR")+" "+esc(unidade)+"</small>");
    var entrada=x.insumo_id?"<button type='button' class='recipe-stock-btn' data-insumo-entrada='"+esc(x.insumo_id)+"' data-insumo-unidade='"+esc(unidade)+"'>+ Entrada no estoque</button>":"<small class='recipe-stock-info'>Salve para lançar estoque</small>";
    return "<div class='recipe-line' data-recipe-row>"+
      "<label class='master-field recipe-name'><span>Ingrediente</span><input data-recipe-name value='"+esc(x.nome||"")+"' placeholder='Nome da matéria-prima' maxlength='160'></label>"+
      "<label class='master-field recipe-quantity'><span>Quantidade por produto</span><input data-recipe-qty inputmode='decimal' type='number' min='0.00001' step='any' value='"+esc(qtd)+"' placeholder='Ex.: 400'></label>"+
      "<label class='master-field recipe-unit'><span>Un.</span><select data-recipe-unit>"+opts+"</select></label>"+
      "<label class='master-field recipe-cost'><span>Custo compra (R$/kg, L ou un.)</span><input data-recipe-cost inputmode='decimal' type='number' min='0' step='any' value='"+esc(preco)+"' placeholder='Ex.: 12,00'></label>"+
      "<div class='recipe-row-actions'>"+saldo+entrada+"<button type='button' class='recipe-remove' data-recipe-remove title='Remover ingrediente'>Remover</button></div>"+
    "</div>";
  }

  function calcularReceitaNaTela(p){
    var linhas=Array.from(document.querySelectorAll("[data-recipe-row]"));
    var incompleto=linhas.length===0;
    var custo=0;
    linhas.forEach(function(row){
      var nome=row.querySelector("[data-recipe-name]").value.trim();
      var quantidade=Number(row.querySelector("[data-recipe-qty]").value);
      var precoEl=row.querySelector("[data-recipe-cost]");
      var preco=Number(precoEl.value);
      var u=row.querySelector("[data-recipe-unit]").value;
      if(!nome||!Number.isFinite(quantidade)||quantidade<=0||!precoEl.value.trim()||!Number.isFinite(preco)||preco<0){incompleto=true;return}
      custo+=quantidade*preco/(u==="g"||u==="ml"?1000:1);
    });
    var extraEl=document.querySelector("[name='custo_extra']");
    var extra=extraEl?Number(extraEl.value||0):0;
    var total=custo+extra;
    var el=document.querySelector("#recipeCmvValue");
    if(el)el.textContent=incompleto?"A definir":brl(total);
    var atacado=document.querySelector("#recipeCmvWholesale");
    var varejo=document.querySelector("#recipeCmvRetail");
    if(atacado)atacado.textContent=incompleto||Number(p.preco_atacado)<=0?"—":(total/Number(document.querySelector("[name='preco_atacado']").value||p.preco_atacado)*100).toFixed(1).replace(".",",")+"%";
    if(varejo)varejo.textContent=incompleto||Number(p.preco_varejo)<=0?"—":(total/Number(document.querySelector("[name='preco_varejo']").value||p.preco_varejo)*100).toFixed(1).replace(".",",")+"%";
    var aviso=document.querySelector("#recipeCmvNotice");
    if(aviso)aviso.textContent=incompleto?"Cadastre as quantidades e os custos de todos os ingredientes para fechar o CMV.":"CMV calculado pelos ingredientes e pelo custo adicional por embalagem.";
  }

  async function renderProductDetail(id){
    return receitasLote.renderProductDetail(id,renderProducts);
    loading("Abrindo produto...");
    try{
      var dados=await Promise.all([
        rpc("admin_produtos_lista",{p_busca:null},true),
        rpc("admin_ficha_tecnica_produto",{p_produto_id:id},true)
      ]);
      var p=(dados[0]||[]).find(function(x){return x.produto_id===id});
      var ficha=dados[1]||{ingredientes:[],custo_extra:0,controle_insumos_ativo:false};
      if(!p)throw new Error("Produto não encontrado.");
      var receitasIniciais=ficha.ingredientes||[];
      if(receitasIniciais.length===0&&/tradicional.*açúcar mascavo/i.test(p.nome||"")){
        receitasIniciais=["Amendoim","Açúcar mascavo","Amendoim torrado","Liga neutra","Sal"].map(function(nome){return {nome:nome,quantidade:"",unidade:"g",custo_referencia:""};});
      }
      main.innerHTML=internalShell("produtos")+
        "<button type='button' class='work-back master-back' id='productBack'>← Produtos</button>"+
        "<section class='product-profile-head'><div><span>"+esc([p.categoria,p.linha].filter(Boolean).join(" • "))+"</span><h1>"+esc(p.sabor||p.nome)+"</h1><p>"+esc(p.modelo_fornecimento||"")+"</p></div>"+productAvailability(p.disponibilidade_catalogo)+"</section>"+
        "<form id='productEditForm' class='master-form'>"+
          "<section class='master-form-section'><div class='master-form-title'><h2>Dados do catálogo</h2><p>Alterações feitas aqui aparecem no catálogo e no pedido do cliente.</p></div><div class='master-form-grid'>"+
            field("Nome do produto","nome",p.nome,true)+field("Sabor / nome curto","sabor",p.sabor)+field("Preço atacado","preco_atacado",Number(p.preco_atacado||0).toFixed(2),"number")+field("Preço varejo","preco_varejo",Number(p.preco_varejo||0).toFixed(2),"number")+field("Ordem de exibição","ordem_exibicao",p.ordem_exibicao,"number")+
            "<label class='master-field'><span>Disponibilidade</span><select name='disponibilidade_catalogo'><option value='disponivel' "+(p.disponibilidade_catalogo==="disponivel"?"selected":"")+">Disponível</option><option value='em_falta' "+(p.disponibilidade_catalogo==="em_falta"?"selected":"")+">Em falta</option><option value='indisponivel_temporario' "+(p.disponibilidade_catalogo==="indisponivel_temporario"?"selected":"")+">Indisponível temporariamente</option></select></label>"+
          "</div><label class='master-field full'><span>Descrição para o cliente</span><textarea name='descricao_cliente' rows='3'>"+esc(p.descricao_cliente||"")+"</textarea></label><label class='master-field full'><span>URL da imagem</span><input name='imagem_url' value='"+esc(p.imagem_url||"")+"' placeholder='https://...'></label></section>"+
          "<section class='master-form-section recipe-section'><div class='master-form-title'><h2>Ingredientes e CMV</h2><p>Ficha técnica privada da fábrica. As quantidades informadas correspondem a uma unidade deste produto vendido.</p></div>"+
          "<div class='recipe-help'>No custo da compra, informe o preço de <b>1 kg</b> (ingredientes em g), de <b>1 litro</b> (ingredientes em ml) ou de <b>1 unidade</b>. Ingredientes com o mesmo nome compartilham esse custo entre as receitas.</div>"+
          "<div id='recipeRows' class='recipe-rows'>"+receitasIniciais.map(receitaLinha).join("")+"</div>"+
          "<button class='recipe-add' type='button' id='recipeAdd'>+ Adicionar ingrediente</button>"+
          "<label class='master-field recipe-extra'><span>Outros custos por unidade (embalagem, energia, perdas etc.) — R$</span><input name='custo_extra' type='number' min='0' step='any' inputmode='decimal' value='"+esc(ficha.custo_extra||0)+"'></label>"+
          "<div class='recipe-cmv-box'><div><span>CMV por unidade</span><strong id='recipeCmvValue'>—</strong></div><div><span>CMV atacado</span><strong id='recipeCmvWholesale'>—</strong></div><div><span>CMV varejo</span><strong id='recipeCmvRetail'>—</strong></div><small id='recipeCmvNotice'></small></div>"+
          "<label class='master-toggle recipe-enable'><input type='checkbox' name='ativar_baixa' "+(ficha.controle_insumos_ativo?"checked":"")+"><span>Ativar baixa automática de ingredientes ao finalizar a produção</span></label>"+
          "<p class='recipe-help'>Antes de ativar, cadastre as quantidades em estoque de cada ingrediente. Pedidos de teste não descontam insumos. O estoque não fica negativo: a finalização avisa quando faltar matéria-prima.</p></section>"+
          "<section class='master-form-footer'><div class='master-toggles'><label class='master-toggle'><input type='checkbox' name='destaque' "+(p.destaque?"checked":"")+"><span>Produto em destaque</span></label><label class='master-toggle'><input type='checkbox' name='ativo' "+(p.ativo?"checked":"")+"><span>Produto ativo</span></label></div><button class='master-save' type='submit'>Salvar produto e ficha técnica</button></section>"+
        "</form>";
      document.querySelector("#productBack").onclick=function(){renderProducts()};
      var form=document.querySelector("#productEditForm");
      document.querySelector("#recipeAdd").onclick=function(){
        document.querySelector("#recipeRows").insertAdjacentHTML("beforeend",receitaLinha({}));
        calcularReceitaNaTela(p);
      };
      form.oninput=function(){calcularReceitaNaTela(p)};
      form.onchange=function(){calcularReceitaNaTela(p)};
      form.onclick=async function(ev){
        var rem=ev.target.closest("[data-recipe-remove]");
        if(rem){rem.closest("[data-recipe-row]").remove();calcularReceitaNaTela(p);return}
        var entrada=ev.target.closest("[data-insumo-entrada]");
        if(entrada){
          var unidade=entrada.dataset.insumoUnidade;
          var insumoId=entrada.dataset.insumoEntrada;
          var raw=window.prompt("Quanto deseja adicionar ao estoque? Informe em "+unidade+" (ex.: 2000 para 2 kg, se a unidade é g).");
          if(raw===null)return;
          var qtd=Number(raw.replace(",","."));
          if(!Number.isFinite(qtd)||qtd<=0){showToast("Quantidade de entrada inválida.");return}
          try{
            await rpc("admin_entrada_estoque_insumo",{p_insumo_id:insumoId,p_quantidade:qtd},true);
            showToast("Entrada registrada no estoque.");
            await renderProductDetail(id);
          }catch(e){showToast(e.message)}
        }
      };
      calcularReceitaNaTela(p);
      form.onsubmit=async function(ev){
        ev.preventDefault();
        var fd=new FormData(form);
        var ingredientes=[];
        try{
          Array.from(form.querySelectorAll("[data-recipe-row]")).forEach(function(row){
            var nome=row.querySelector("[data-recipe-name]").value.trim();
            var qtdInput=row.querySelector("[data-recipe-qty]").value.trim();
            var precoInput=row.querySelector("[data-recipe-cost]").value.trim();
            if(!nome&&!qtdInput&&!precoInput)return;
            if(!nome||!qtdInput||!Number.isFinite(Number(qtdInput))||Number(qtdInput)<=0||!["g","kg","ml","L","un"].includes(row.querySelector("[data-recipe-unit]").value)){
              throw new Error("Preencha o nome, a quantidade e a unidade de todos os ingredientes.");
            }
            if(precoInput&&(!Number.isFinite(Number(precoInput))||Number(precoInput)<0))throw new Error("Preço do ingrediente inválido.");
            ingredientes.push({nome:nome,quantidade:Number(qtdInput),unidade:row.querySelector("[data-recipe-unit]").value,custo_referencia:precoInput?Number(precoInput):null});
          });
          await rpc("admin_salvar_produto_com_ficha",{
            p_produto_id:id,
            p_nome:fd.get("nome"),
            p_sabor:fd.get("sabor")||null,
            p_preco_atacado:Number(fd.get("preco_atacado")||0),
            p_preco_varejo:Number(fd.get("preco_varejo")||0),
            p_descricao_cliente:String(fd.get("descricao_cliente")||""),
            p_imagem_url:String(fd.get("imagem_url")||""),
            p_ordem_exibicao:Number(fd.get("ordem_exibicao")||9999),
            p_destaque:fd.get("destaque")==="on",
            p_disponibilidade_catalogo:fd.get("disponibilidade_catalogo"),
            p_ativo:fd.get("ativo")==="on",
            p_ingredientes:ingredientes,
            p_custo_extra:Number(fd.get("custo_extra")||0),
            p_ativar_baixa:fd.get("ativar_baixa")==="on"
          },true);
          await loadCatalog();
          showToast("Cadastro, ingredientes e CMV atualizados.");
          await renderProductDetail(id);
        }catch(e){showToast(e.message)}
      };
    }catch(e){main.innerHTML=internalShell("produtos")+"<div class='empty'>"+esc(e.message)+"</div>"}
  }

  return {renderClients:renderClients,renderProducts:renderProducts};
}

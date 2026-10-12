export function installInternalMasterData(ctx){
  const state=ctx.state,main=ctx.main,rpc=ctx.rpc,internalShell=ctx.internalShell,loading=ctx.loading,esc=ctx.esc,showToast=ctx.showToast,brl=ctx.brl,fmtDate=ctx.fmtDate,loadCatalog=ctx.loadCatalog;

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
      var rows=await rpc("admin_clientes_lista_v2",{p_busca:state.clientSearch||null,p_limit:500},true)||[];
      main.innerHTML=internalShell("clientes")+
        "<section class='internal-title'><div><span class='internal-eyebrow'>CLIENTES</span><h1>Cadastro de clientes</h1><p>Base antiga e novos cadastros em um único lugar. As observações internas não aparecem para o cliente.</p></div></section>"+
        "<section class='master-toolbar'><form id='clientSearchForm' class='master-search'><span>⌕</span><input id='clientSearchInput' type='search' value='"+esc(state.clientSearch||"")+"' placeholder='Buscar nome, WhatsApp, CPF/CNPJ ou código'><button>Buscar</button></form><div class='master-count'><b>"+rows.length+"</b><span>clientes encontrados</span></div></section>"+
        "<section class='client-directory'>"+
          (rows.length?rows.map(function(c){
            return "<button type='button' class='client-directory-card' data-client-id='"+c.cliente_id+"'><div class='client-avatar'>"+esc((c.nome||"?").trim().slice(0,1).toUpperCase())+"</div><div class='client-directory-copy'><strong>"+esc(c.nome_fantasia||c.nome)+"</strong><small>"+(c.nome_fantasia?esc(c.nome)+" • ":"")+esc(c.codigo_cliente||"Cadastro novo")+(c.whatsapp?" • "+esc(c.whatsapp):"")+"</small><div>"+clientStatus(c)+(c.tipo_cliente==="recorrente"?" <span class='status ok'>recorrente</span>":c.tipo_cliente==="avulso"?" <span class='status'>avulso</span>":" <span class='status warn'>não classificado</span>")+(c.status_migracao&&c.status_migracao!=="OK"?" <span class='status warn'>"+esc(c.status_migracao)+"</span>":"")+"</div></div><span class='client-open'>›</span></button>";
          }).join(""):"<div class='empty'>Nenhum cliente encontrado.</div>")+
        "</section>";
      var form=document.querySelector("#clientSearchForm");
      if(form)form.onsubmit=function(ev){ev.preventDefault();state.clientSearch=document.querySelector("#clientSearchInput").value.trim();renderClients()};
      main.onclick=function(ev){
        var b=ev.target.closest("[data-client-id]");
        if(b)renderClientDetail(b.dataset.clientId);
      };
    }catch(e){main.innerHTML=internalShell("clientes")+"<div class='empty'>"+esc(e.message)+"</div>"}
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
    return "<label class='master-field'><span>"+label+"</span><input type='"+type+"' name='"+name+"' value='"+esc(value||"")+"' "+(required?"required":"")+"></label>";
  }

  function productAvailability(v){
    if(v==="disponivel")return "<span class='status ok'>disponível</span>";
    if(v==="em_falta")return "<span class='status bad'>em falta</span>";
    return "<span class='status warn'>"+esc(v||"indefinido")+"</span>";
  }

  async function renderProducts(query){
    if(typeof query==="string")state.productAdminSearch=query;
    loading("Carregando produtos...");
    try{
      var rows=await rpc("admin_produtos_lista",{p_busca:state.productAdminSearch||null},true)||[];
      main.innerHTML=internalShell("produtos")+
        "<section class='internal-title'><div><span class='internal-eyebrow'>PRODUTOS</span><h1>Catálogo da Algaroba</h1><p>Edite o que o cliente vê sem misturar com o controle de estoque.</p></div></section>"+
        "<section class='master-toolbar'><form id='productSearchForm' class='master-search'><span>⌕</span><input id='productSearchInput' type='search' value='"+esc(state.productAdminSearch||"")+"' placeholder='Buscar produto, sabor, linha ou categoria'><button>Buscar</button></form><a class='master-preview-link' href='./catalogo.html' target='_blank' rel='noopener'>Ver catálogo público ↗</a></section>"+
        "<section class='product-admin-list'>"+
          (rows.length?rows.map(function(p){
            return "<button type='button' class='product-admin-card' data-product-id='"+p.produto_id+"'><div class='product-admin-copy'><span>"+esc([p.categoria,p.linha].filter(Boolean).join(" • "))+"</span><strong>"+esc(p.sabor||p.nome)+"</strong><small>"+esc(p.nome)+" • "+(p.peso_volume?Number(p.peso_volume).toLocaleString("pt-BR")+" "+esc(p.unidade||""):"")+"</small><div>"+productAvailability(p.disponibilidade_catalogo)+(p.destaque?" <span class='status warn'>destaque</span>":"")+(!p.ativo?" <span class='status bad'>inativo</span>":"")+"</div></div><div class='product-admin-price'><small>Atacado</small><b>"+brl(p.preco_atacado)+"</b><small>Varejo</small><b>"+brl(p.preco_varejo)+"</b></div><span class='client-open'>›</span></button>";
          }).join(""):"<div class='empty'>Nenhum produto encontrado.</div>")+
        "</section>";
      var form=document.querySelector("#productSearchForm");
      if(form)form.onsubmit=function(ev){ev.preventDefault();state.productAdminSearch=document.querySelector("#productSearchInput").value.trim();renderProducts()};
      main.onclick=function(ev){var b=ev.target.closest("[data-product-id]");if(b)renderProductDetail(b.dataset.productId)};
    }catch(e){main.innerHTML=internalShell("produtos")+"<div class='empty'>"+esc(e.message)+"</div>"}
  }

  async function renderProductDetail(id){
    loading("Abrindo produto...");
    try{
      var rows=await rpc("admin_produtos_lista",{p_busca:null},true),p=(rows||[]).find(function(x){return x.produto_id===id});
      if(!p)throw new Error("Produto não encontrado.");
      main.innerHTML=internalShell("produtos")+
        "<button type='button' class='work-back master-back' id='productBack'>← Produtos</button>"+
        "<section class='product-profile-head'><div><span>"+esc([p.categoria,p.linha].filter(Boolean).join(" • "))+"</span><h1>"+esc(p.sabor||p.nome)+"</h1><p>"+esc(p.modelo_fornecimento||"")+"</p></div>"+productAvailability(p.disponibilidade_catalogo)+"</section>"+
        "<form id='productEditForm' class='master-form'>"+
          "<section class='master-form-section'><div class='master-form-title'><h2>Dados do catálogo</h2><p>Alterações feitas aqui aparecem no catálogo e no pedido do cliente.</p></div><div class='master-form-grid'>"+
            field("Nome do produto","nome",p.nome,true)+field("Sabor / nome curto","sabor",p.sabor)+field("Preço atacado","preco_atacado",Number(p.preco_atacado||0).toFixed(2),"number")+field("Preço varejo","preco_varejo",Number(p.preco_varejo||0).toFixed(2),"number")+field("Ordem de exibição","ordem_exibicao",p.ordem_exibicao,"number")+
            "<label class='master-field'><span>Disponibilidade</span><select name='disponibilidade_catalogo'><option value='disponivel' "+(p.disponibilidade_catalogo==="disponivel"?"selected":"")+">Disponível</option><option value='em_falta' "+(p.disponibilidade_catalogo==="em_falta"?"selected":"")+">Em falta</option><option value='indisponivel_temporario' "+(p.disponibilidade_catalogo==="indisponivel_temporario"?"selected":"")+">Indisponível temporariamente</option></select></label>"+
          "</div><label class='master-field full'><span>Descrição para o cliente</span><textarea name='descricao_cliente' rows='3'>"+esc(p.descricao_cliente||"")+"</textarea></label><label class='master-field full'><span>URL da imagem</span><input name='imagem_url' value='"+esc(p.imagem_url||"")+"' placeholder='https://...'></label></section>"+
          "<section class='master-form-footer'><div class='master-toggles'><label class='master-toggle'><input type='checkbox' name='destaque' "+(p.destaque?"checked":"")+"><span>Produto em destaque</span></label><label class='master-toggle'><input type='checkbox' name='ativo' "+(p.ativo?"checked":"")+"><span>Produto ativo</span></label></div><button class='master-save' type='submit'>Salvar produto</button></section>"+
        "</form>";
      document.querySelector("#productBack").onclick=function(){renderProducts()};
      document.querySelector("#productEditForm").onsubmit=async function(ev){
        ev.preventDefault();
        var fd=new FormData(ev.currentTarget);
        try{
          await rpc("admin_atualizar_produto_completo",{
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
            p_ativo:fd.get("ativo")==="on"
          },true);
          await loadCatalog();
          showToast("Produto atualizado no catálogo.");
          await renderProductDetail(id);
        }catch(e){showToast(e.message)}
      };
    }catch(e){main.innerHTML=internalShell("produtos")+"<div class='empty'>"+esc(e.message)+"</div>"}
  }

  return {renderClients:renderClients,renderProducts:renderProducts};
}

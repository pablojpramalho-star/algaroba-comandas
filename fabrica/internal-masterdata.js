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
      var rows=await rpc("admin_clientes_lista",{p_busca:state.clientSearch||null,p_limit:500},true)||[];
      main.innerHTML=internalShell("clientes")+
        "<section class='internal-title'><div><span class='internal-eyebrow'>CLIENTES</span><h1>Cadastro de clientes</h1><p>Base antiga e novos cadastros em um único lugar. As observações internas não aparecem para o cliente.</p></div></section>"+
        "<section class='master-toolbar'><form id='clientSearchForm' class='master-search'><span>⌕</span><input id='clientSearchInput' type='search' value='"+esc(state.clientSearch||"")+"' placeholder='Buscar nome, WhatsApp, CPF/CNPJ ou código'><button>Buscar</button></form><div class='master-count'><b>"+rows.length+"</b><span>clientes encontrados</span></div></section>"+
        "<section class='client-directory'>"+
          (rows.length?rows.map(function(c){
            return "<button type='button' class='client-directory-card' data-client-id='"+c.cliente_id+"'><div class='client-avatar'>"+esc((c.nome||"?").trim().slice(0,1).toUpperCase())+"</div><div class='client-directory-copy'><strong>"+esc(c.nome)+"</strong><small>"+esc(c.codigo_cliente||"Cadastro novo")+(c.whatsapp?" • "+esc(c.whatsapp):"")+"</small><div>"+clientStatus(c)+(c.status_migracao&&c.status_migracao!=="OK"?" <span class='status warn'>"+esc(c.status_migracao)+"</span>":"")+"</div></div><span class='client-open'>›</span></button>";
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
      var rows=await rpc("admin_cliente_detalhe",{p_cliente_id:id},true),c=Array.isArray(rows)?rows[0]:rows;
      if(!c)throw new Error("Cliente não encontrado.");
      main.innerHTML=internalShell("clientes")+
        "<button type='button' class='work-back master-back' id='clientBack'>← Clientes</button>"+
        "<section class='client-profile-head'><div class='client-avatar large'>"+esc((c.nome||"?").trim().slice(0,1).toUpperCase())+"</div><div><span>"+esc(c.codigo_cliente||"CADASTRO NOVO")+"</span><h1>"+esc(c.nome)+"</h1><p>"+esc(c.origem==="my_loja_store"?"Importado do My Loja Store":"Cadastro do novo sistema")+(c.portal_ativado_em?" • Portal ativado":"")+"</p></div></section>"+
        "<form id='clientEditForm' class='master-form'>"+
          "<section class='master-form-section'><div class='master-form-title'><h2>Dados do cliente</h2><p>Informações cadastrais que podem ser corrigidas pelo administrativo.</p></div><div class='master-form-grid'>"+
            field("Nome","nome",c.nome,true)+field("WhatsApp","whatsapp",c.whatsapp)+field("Telefone","telefone",c.telefone)+field("CPF/CNPJ","cpf_cnpj",c.cpf_cnpj)+field("E-mail","email",c.email,"email")+field("Nascimento","nascimento",c.nascimento,"date")+
          "</div><label class='master-field full'><span>Endereço legado / informação cadastrada</span><textarea name='endereco_legado' rows='3'>"+esc(c.endereco_legado||"")+"</textarea></label></section>"+
          "<section class='master-form-section internal-notes'><div class='master-form-title'><h2>Uso interno da Algaroba</h2><p>Esses campos são exclusivos da equipe. O cliente não vê essas informações.</p></div>"+
            "<label class='master-field full'><span>Ponto de referência interno</span><input name='referencia_interna' value='"+esc(c.referencia_interna||"")+"' placeholder='Ex.: box ao lado da farmácia, falar com Maria'></label>"+
            "<label class='master-field full'><span>Características / particularidades</span><textarea name='caracteristicas_internas' rows='3' placeholder='Ex.: recebe só à tarde, prefere contato pelo WhatsApp...'>"+esc(c.caracteristicas_internas||"")+"</textarea></label>"+
            "<label class='master-field full'><span>Observações internas</span><textarea name='observacao_interna' rows='4' placeholder='Anotações administrativas sobre o atendimento'>"+esc(c.observacao_interna||"")+"</textarea></label>"+
          "</section>"+
          "<section class='master-form-footer'><label class='master-toggle'><input type='checkbox' name='ativo' "+(c.ativo?"checked":"")+"><span>Cliente ativo</span></label><button class='master-save' type='submit'>Salvar alterações</button></section>"+
        "</form>";
      document.querySelector("#clientBack").onclick=function(){renderClients()};
      document.querySelector("#clientEditForm").onsubmit=async function(ev){
        ev.preventDefault();
        var fd=new FormData(ev.currentTarget),birth=fd.get("nascimento")||null;
        try{
          await rpc("admin_atualizar_cliente_interno",{
            p_cliente_id:id,
            p_nome:fd.get("nome"),
            p_whatsapp:fd.get("whatsapp")||null,
            p_telefone:fd.get("telefone")||null,
            p_cpf_cnpj:fd.get("cpf_cnpj")||null,
            p_email:fd.get("email")||null,
            p_nascimento:birth,
            p_endereco_legado:fd.get("endereco_legado")||null,
            p_referencia_interna:fd.get("referencia_interna")||null,
            p_caracteristicas_internas:fd.get("caracteristicas_internas")||null,
            p_observacao_interna:fd.get("observacao_interna")||null,
            p_ativo:fd.get("ativo")==="on"
          },true);
          showToast("Cadastro do cliente atualizado.");
          await renderClientDetail(id);
        }catch(e){showToast(e.message)}
      };
    }catch(e){main.innerHTML=internalShell("clientes")+"<div class='empty'>"+esc(e.message)+"</div>"}
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

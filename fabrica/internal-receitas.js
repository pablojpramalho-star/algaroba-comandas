// Ficha técnica por lote e inventário primário — apenas módulo administrativo da fábrica.
export function installReceitasLote(ctx){
  const {main,rpc,internalShell,loading,esc,brl,showToast,loadCatalog}=ctx;
  const dnum=v=>v==null?"":String(v);
  function field(label,name,value,type="text",required=false){
    return "<label class='master-field'><span>"+esc(label)+"</span><input name='"+name+"' type='"+type+"' value='"+esc(value??"")+"' "+(type==="number"?"min='0' step='any' inputmode='decimal' ":"")+(required?"required ":"")+"></label>";
  }
  function ingrediente(x={}){
    var u=x.unidade||"kg",q=x.quantidade_lote??x.quantidade??"",price=x.custo_referencia??"";
    var saldo=x.insumo_id?"<small class='recipe-stock-info'>Saldo: "+(Number(x.estoque_atual||0)/(u==="kg"||u==="L"?1000:1)).toLocaleString("pt-BR",{maximumFractionDigits:3})+" "+esc(u)+"</small>":"<small class='recipe-stock-info'>Novo ingrediente</small>";
    return "<div class='recipe-line' data-recipe-row>"+
      "<label class='master-field recipe-name'><span>Ingrediente</span><input data-recipe-name maxlength='160' value='"+esc(x.nome||"")+"' placeholder='Ex.: amendoim' /></label>"+
      "<label class='master-field recipe-quantity'><span>Quantidade no lote</span><input type='number' min='0.000001' step='any' inputmode='decimal' data-recipe-qty value='"+esc(q)+"' placeholder='Ex.: 12'></label>"+
      "<label class='master-field recipe-unit'><span>Unidade</span><select data-recipe-unit>"+["kg","g","L","ml","un"].map(function(v){return "<option value='"+v+"' "+(u===v?"selected":"")+">"+v+"</option>"}).join("")+"</select></label>"+
      "<label class='master-field recipe-cost'><span>Preço de compra (R$/kg, L ou un.)</span><input type='number' min='0' step='any' inputmode='decimal' data-recipe-cost value='"+esc(price)+"' placeholder='Ex.: 15,90'></label>"+
      "<div class='recipe-row-actions'>"+saldo+"<button class='recipe-remove' type='button' data-remove-recipe>Remover</button></div></div>";
  }
  function calcular(p){
    var rows=Array.from(main.querySelectorAll("[data-recipe-row]"));
    var rendimento=Number(main.querySelector("[name='receita_rendimento_unidades']")?.value||0);
    var incompleto=!Number.isInteger(rendimento)||rendimento<=0||!rows.length;
    var insumos=0;
    rows.forEach(function(row){
      var qv=row.querySelector("[data-recipe-qty]").value.trim(),pv=row.querySelector("[data-recipe-cost]").value.trim();
      var q=Number(qv),preco=Number(pv),u=row.querySelector("[data-recipe-unit]").value,nome=row.querySelector("[data-recipe-name]").value.trim();
      if(!nome||!qv||!pv||!Number.isFinite(q)||q<=0||!Number.isFinite(preco)||preco<0){incompleto=true;return}
      insumos+=q*preco/((u==="g"||u==="ml")?1000:1);
    });
    var embalagem=main.querySelector("[name='embalagem_insumo_id']")?.value;
    var e=main.querySelector("[name='embalagem_preco']")?.value.trim();
    var t=main.querySelector("[name='etiqueta_preco']")?.value.trim();
    var x=main.querySelector("[name='custo_extra']")?.value.trim();
    if(!embalagem||!e||!t||Number(e)<0||Number(t)<0||Number(x)<0||!Number.isFinite(Number(e))||!Number.isFinite(Number(t))||!Number.isFinite(Number(x))){incompleto=true}
    var custoPorUnidade=(rendimento>0?insumos/rendimento:0)+Number(e||0)+Number(t||0)+Number(x||0);
    var custoLote=custoPorUnidade*rendimento;
    var atacado=Number(main.querySelector("[name='preco_atacado']")?.value||0);
    var varejo=Number(main.querySelector("[name='preco_varejo']")?.value||0);
    const write=(id,value)=>{var el=main.querySelector("#"+id);if(el)el.textContent=value};
    write("recipeBatchValue",incompleto?"A definir":brl(custoLote));
    write("recipeCmvValue",incompleto?"A definir":brl(custoPorUnidade));
    write("recipeCmvWholesale",incompleto||atacado<=0?"—":(100*custoPorUnidade/atacado).toFixed(1).replace(".",",")+"%");
    write("recipeCmvRetail",incompleto||varejo<=0?"—":(100*custoPorUnidade/varejo).toFixed(1).replace(".",",")+"%");
    write("recipeYieldTotal",(rendimento||0)+" embalagens • "+(rendimento*Number(p.peso_volume||1)).toLocaleString("pt-BR",{maximumFractionDigits:3})+" "+(p.unidade||"un"));
    write("recipeCmvNotice",incompleto?"Preencha quantidades, preço de compra, embalagem e etiqueta para calcular o CMV completo.":"Receita do lote ÷ rendimento + 1 embalagem + 1 etiqueta + custos extras por unidade.");
  }
  async function renderProductDetail(id,onBack){
    loading("Abrindo ficha técnica...");
    try{
      var [products,ficha,estoque]=await Promise.all([
        rpc("admin_produtos_lista",{p_busca:null},true),
        rpc("admin_ficha_tecnica_produto",{p_produto_id:id},true),
        rpc("admin_estoque_primario_listar",{},true)
      ]);
      var p=(products||[]).find(function(item){return item.produto_id===id});
      if(!p)throw new Error("Produto não encontrado.");
      var emb=(estoque||[]).filter(function(i){return i.categoria==="Embalagens"&&i.ativo});
      var recipe=ficha.ingredientes||[];
      var rendimento=Number(ficha.rendimento_unidades||1);
      if(!recipe.length&&/tradicional.*açúcar mascavo.*1 kg/i.test(p.nome)){
        rendimento=26;
        recipe=["Amendoim","Amendoim torrado","Açúcar mascavo","Liga neutra","Sal"].map(function(nome){return {nome,quantidade_lote:"",unidade:"kg",custo_referencia:""}});
      }
      var embOptions=emb.map(function(i){
        return "<option value='"+esc(i.insumo_id)+"' data-price='"+esc(i.custo_referencia??"")+"' "+(i.insumo_id===ficha.embalagem_insumo_id?"selected":"")+">"+esc(i.nome)+"</option>";
      }).join("");
      var disp=[["disponivel","Disponível"],["em_falta","Em falta"],["indisponivel_temporario","Indisponível temporariamente"]].map(function(pair){
        return "<option value='"+pair[0]+"' "+(p.disponibilidade_catalogo===pair[0]?"selected":"")+">"+pair[1]+"</option>";
      }).join("");
      main.innerHTML=internalShell("produtos")+
        "<button type='button' class='work-back master-back' id='recipeBack'>← Produtos</button>"+
        "<section class='product-profile-head'><div><span>"+esc([p.categoria,p.linha].filter(Boolean).join(" • "))+"</span><h1>"+esc(p.sabor||p.nome)+"</h1><p>"+esc(p.modelo_fornecimento||"")+"</p></div><span class='status ok'>Ficha técnica</span></section>"+
        "<form id='recipeProductForm' class='master-form'>"+
          "<section class='master-form-section'><div class='master-form-title'><h2>Dados do catálogo</h2><p>Visíveis ao cliente. Ingredientes, estoque e CMV são exclusivos do administrativo.</p></div><div class='master-form-grid'>"+
            field("Nome do produto","nome",p.nome,"text",true)+
            field("Sabor / nome curto","sabor",p.sabor)+
            field("Preço atacado","preco_atacado",Number(p.preco_atacado||0).toFixed(2),"number")+
            field("Preço varejo","preco_varejo",Number(p.preco_varejo||0).toFixed(2),"number")+
            field("Ordem de exibição","ordem_exibicao",p.ordem_exibicao,"number")+
            "<label class='master-field'><span>Disponibilidade</span><select name='disponibilidade_catalogo'>"+disp+"</select></label></div>"+
            "<label class='master-field full'><span>Descrição para o cliente</span><textarea name='descricao_cliente' rows='3'>"+esc(p.descricao_cliente||"")+"</textarea></label>"+
            field("URL da imagem","imagem_url",p.imagem_url)+
          "</section>"+
          "<section class='master-form-section recipe-section'><div class='master-form-title'><h2>Receita por lote</h2><p>Cadastre o que vai na produção inteira. O sistema divide a receita pelo número de embalagens produzidas.</p></div>"+
            "<div class='recipe-yield-grid'><label class='master-field'><span>Quantas unidades rende esta receita?</span><input name='receita_rendimento_unidades' type='number' min='1' max='100000' step='1' inputmode='numeric' required value='"+esc(rendimento)+"'></label><div class='recipe-yield-result'><b>Rendimento total</b><strong id='recipeYieldTotal'>—</strong></div></div>"+
            "<div class='recipe-help'>Exemplo: 26 unidades de 1 kg = 26 kg de produto. Coloque a quantidade de cada ingrediente usada no lote e o custo pago por quilo, litro ou unidade. Ingredientes iguais compartilham o custo de compra.</div>"+
            "<div id='recipeRows' class='recipe-rows'>"+recipe.map(ingrediente).join("")+"</div>"+
            "<button type='button' class='recipe-add' id='addRecipeIngredient'>+ Adicionar ingrediente</button>"+
          "</section>"+
          "<section class='master-form-section recipe-section'><div class='master-form-title'><h2>Embalagem e etiqueta</h2><p>O sistema consumirá uma embalagem do tipo escolhido e a etiqueta deste produto a cada unidade atendida.</p></div>"+
            "<div class='recipe-package-grid'><label class='master-field'><span>Especificação da embalagem</span><select name='embalagem_insumo_id' id='packChoice'><option value=''>Escolha o tamanho</option>"+embOptions+"</select></label>"+
            field("Custo da embalagem (R$/unidade)","embalagem_preco",ficha.embalagem_preco,"number")+"</div>"+
            "<label class='master-field'><span>Etiqueta vinculada ao produto</span><input disabled value='"+esc(ficha.etiqueta_nome||"Etiqueta não cadastrada")+"'></label>"+
            field("Custo da etiqueta (R$/unidade)","etiqueta_preco",ficha.etiqueta_preco,"number")+
            "<p class='recipe-help'>A etiqueta é exclusiva deste produto. O custo da embalagem é compartilhado por todos os produtos que usam a mesma especificação. Você também pode lançar entradas e consultar saldos no estoque primário.</p>"+
            "<button type='button' class='recipe-add' id='openRecipeStock'>📦 Abrir estoque de embalagens e etiquetas</button>"+
            field("Outros custos por unidade (energia, perdas, adicionais) — R$","custo_extra",ficha.custo_extra??0,"number")+
            "<div class='recipe-cmv-box'><div><span>Custo total do lote</span><strong id='recipeBatchValue'>—</strong></div><div><span>CMV por unidade</span><strong id='recipeCmvValue'>—</strong></div><div><span>CMV atacado</span><strong id='recipeCmvWholesale'>—</strong></div><div><span>CMV varejo</span><strong id='recipeCmvRetail'>—</strong></div><small id='recipeCmvNotice'></small></div>"+
            "<label class='master-toggle recipe-enable'><input type='checkbox' name='ativar_baixa' "+(ficha.controle_insumos_ativo?"checked":"")+"><span>Ativar baixa automática de ingredientes, embalagens e etiquetas</span></label>"+
            "<p class='recipe-help'>A baixa acontece quando a produção real é finalizada. Pedidos de teste não consomem estoque. Se faltar saldo, a finalização será bloqueada para conferência.</p>"+
          "</section>"+
          "<section class='master-form-footer'><div class='master-toggles'><label class='master-toggle'><input type='checkbox' name='destaque' "+(p.destaque?"checked":"")+"><span>Produto em destaque</span></label><label class='master-toggle'><input type='checkbox' name='ativo' "+(p.ativo?"checked":"")+"><span>Produto ativo</span></label></div><button class='master-save' type='submit'>Salvar produto e receita do lote</button></section>"+
        "</form>";
      var form=main.querySelector("#recipeProductForm");
      main.querySelector("#recipeBack").onclick=()=>onBack();
      main.querySelector("#addRecipeIngredient").onclick=function(){
        form.querySelector("#recipeRows").insertAdjacentHTML("beforeend",ingrediente());
        calcular(p);
      };
      main.querySelector("#packChoice").onchange=function(){
        form.querySelector("[name='embalagem_preco']").value=this.selectedOptions[0]?.dataset.price||"";
        calcular(p);
      };
      main.querySelector("#openRecipeStock").onclick=()=>renderEstoquePrimario("Embalagens",()=>renderProductDetail(id,onBack));
      form.addEventListener("input",()=>calcular(p));
      form.addEventListener("change",()=>calcular(p));
      form.addEventListener("click",function(ev){
        var remove=ev.target.closest("[data-remove-recipe]");
        if(remove){remove.closest("[data-recipe-row]").remove();calcular(p)}
      });
      calcular(p);
      form.onsubmit=async function(ev){
        ev.preventDefault();
        var fd=new FormData(form),ingredientes=[];
        try{
          Array.from(form.querySelectorAll("[data-recipe-row]")).forEach(function(row){
            var nome=row.querySelector("[data-recipe-name]").value.trim();
            var q=row.querySelector("[data-recipe-qty]").value.trim();
            var custo=row.querySelector("[data-recipe-cost]").value.trim();
            if(!nome&&!q&&!custo)return;
            if(!nome||!q||!Number.isFinite(Number(q))||Number(q)<=0)throw new Error("Informe nome e quantidade positiva para todos os ingredientes.");
            if(custo&&(!Number.isFinite(Number(custo))||Number(custo)<0))throw new Error("Custo do ingrediente inválido.");
            ingredientes.push({
              nome,quantidade_lote:Number(q),
              unidade:row.querySelector("[data-recipe-unit]").value,
              custo_referencia:custo===""?null:Number(custo)
            });
          });
          var rendimento=Number(fd.get("receita_rendimento_unidades"));
          if(!Number.isInteger(rendimento)||rendimento<1)throw new Error("Informe quantas embalagens a receita rende.");
          var packagedPrice=String(fd.get("embalagem_preco")||"").trim(),labelPrice=String(fd.get("etiqueta_preco")||"").trim();
          var submit=form.querySelector("[type='submit']");
          submit.disabled=true;
          try{
            await rpc("admin_salvar_produto_lote",{
              p_produto_id:id,
              p_nome:String(fd.get("nome")),
              p_sabor:String(fd.get("sabor")||"")||null,
              p_preco_atacado:Number(fd.get("preco_atacado")||0),
              p_preco_varejo:Number(fd.get("preco_varejo")||0),
              p_descricao_cliente:String(fd.get("descricao_cliente")||""),
              p_imagem_url:String(fd.get("imagem_url")||""),
              p_ordem_exibicao:Number(fd.get("ordem_exibicao")||9999),
              p_destaque:fd.get("destaque")==="on",
              p_disponibilidade_catalogo:fd.get("disponibilidade_catalogo"),
              p_ativo:fd.get("ativo")==="on",
              p_ingredientes_lote:ingredientes,
              p_rendimento_unidades:rendimento,
              p_custo_extra:Number(fd.get("custo_extra")||0),
              p_ativar_baixa:fd.get("ativar_baixa")==="on",
              p_embalagem_insumo_id:fd.get("embalagem_insumo_id")||null,
              p_embalagem_preco:packagedPrice===""?null:Number(packagedPrice),
              p_etiqueta_preco:labelPrice===""?null:Number(labelPrice)
            },true);
            await loadCatalog();
            showToast("Receita por lote, CMV, embalagem e etiqueta salvos.");
            await renderProductDetail(id,onBack);
          }finally{submit.disabled=false}
        }catch(e){showToast(e.message)}
      };
    }catch(e){main.innerHTML=internalShell("produtos")+"<div class='empty'>"+esc(e.message)+"</div>"}
  }
  async function renderEstoquePrimario(grupo,onBack){
    grupo=grupo||"Etiquetas";
    onBack=onBack||function(){};
    loading("Carregando estoque primário...");
    try{
      var items=await rpc("admin_estoque_primario_listar",{},true)||[];
      var categorias=["Matérias-primas","Embalagens","Etiquetas"];
      var filtered=items.filter(x=>x.categoria===grupo);
      main.innerHTML=internalShell("produtos")+
        "<button type='button' id='stockBack' class='work-back master-back'>← Voltar</button>"+
        "<section class='internal-title'><div><span class='internal-eyebrow'>ESTOQUE PRIMÁRIO</span><h1>"+esc(grupo)+"</h1><p>Controle separado de matérias-primas, cada tamanho de embalagem e etiquetas de cada produto.</p></div></section>"+
        "<nav class='product-line-nav'>"+categorias.map(function(g){return "<button type='button' data-stock-tab='"+esc(g)+"' class='"+(g===grupo?"active":"")+"'><span>"+esc(g)+"</span><b>"+items.filter(x=>x.categoria===g).length+"</b></button>"}).join("")+"</nav>"+
        "<label class='master-search stock-search'><span>⌕</span><input id='stockSearch' type='search' placeholder='Filtrar pelo nome'></label>"+
        "<div class='stock-primary-list'>"+(filtered.length?filtered.map(function(i){
          return "<article class='stock-primary-item' data-stock-name='"+esc(i.nome.toLowerCase())+"'>"+
            "<div class='stock-primary-title'><strong>"+esc(i.nome)+"</strong><span>"+esc(i.categoria)+"</span></div>"+
            "<div class='stock-primary-balance'><b>"+Number(i.quantidade_atual).toLocaleString("pt-BR",{maximumFractionDigits:3})+" "+esc(i.unidade)+"</b><small>"+(Number(i.quantidade_atual)<=Number(i.estoque_minimo)?"No mínimo / atenção":"Disponível")+"</small></div>"+
            "<label class='master-field'><span>Preço de compra — R$/"+(i.unidade==="g"?"kg":i.unidade==="ml"?"L":"un")+" </span><input type='number' step='any' min='0' inputmode='decimal' data-stock-cost='"+esc(i.insumo_id)+"' value='"+esc(i.custo_referencia??"")+"' placeholder='A definir'></label>"+
            "<div class='stock-primary-actions'><button type='button' data-stock-save='"+esc(i.insumo_id)+"'>Salvar custo</button><button type='button' data-stock-add='"+esc(i.insumo_id)+"' data-stock-unit='"+esc(i.unidade)+"'>+ Entrada no estoque</button></div></article>";
        }).join(""):"<div class='empty'>Nenhum material cadastrado nesta categoria.</div>")+"</div>";
      main.querySelector("#stockBack").onclick=onBack;
      main.querySelectorAll("[data-stock-tab]").forEach(b=>b.onclick=()=>renderEstoquePrimario(b.dataset.stockTab,onBack));
      main.querySelector("#stockSearch").oninput=function(){
        var q=this.value.trim().toLowerCase();
        main.querySelectorAll("[data-stock-name]").forEach(el=>el.classList.toggle("hidden",!el.dataset.stockName.includes(q)));
      };
      main.onclick=async function(ev){
        var save=ev.target.closest("[data-stock-save]"),add=ev.target.closest("[data-stock-add]");
        if(save){
          var input=main.querySelector("[data-stock-cost='"+save.dataset.stockSave+"']");
          var value=Number(input?.value);
          if(!input?.value.trim()||!Number.isFinite(value)||value<0){showToast("Informe um preço de compra válido.");return}
          try{
            await rpc("admin_atualizar_custo_insumo",{p_insumo_id:save.dataset.stockSave,p_custo_referencia:value},true);
            showToast("Preço de compra atualizado.");await renderEstoquePrimario(grupo,onBack);
          }catch(e){showToast(e.message)}
        }else if(add){
          var raw=window.prompt("Quantidade recebida em "+add.dataset.stockUnit+" (1000 g correspondem a 1 kg):");
          if(raw===null)return;
          var qtd=Number(raw.replace(",","."));
          if(!Number.isFinite(qtd)||qtd<=0){showToast("Quantidade inválida.");return}
          try{
            await rpc("admin_entrada_estoque_insumo",{p_insumo_id:add.dataset.stockAdd,p_quantidade:qtd},true);
            showToast("Entrada registrada no estoque.");await renderEstoquePrimario(grupo,onBack);
          }catch(e){showToast(e.message)}
        }
      };
    }catch(e){main.innerHTML=internalShell("produtos")+"<div class='empty'>"+esc(e.message)+"</div>"}
  }
  return {renderProductDetail,renderEstoquePrimario};
}

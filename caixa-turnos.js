(function caixaTurnosV65(){
 const TZ="America/Fortaleza";
 const financialMethods=["Dinheiro","Pix","Débito","Crédito"];
 function natalParts(input){
   const d=new Date(input);
   const fmt=new Intl.DateTimeFormat("en-GB",{timeZone:TZ,year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hourCycle:"h23"});
   const p={};
   for(const part of fmt.formatToParts(d))if(part.type!=="literal")p[part.type]=part.value;
   const day=p.year+"-"+p.month+"-"+p.day;
   return {day,hour:Number(p.hour),minute:Number(p.minute)};
 }
 function previousDay(s,n=1){const d=new Date(s+"T12:00:00Z");d.setUTCDate(d.getUTCDate()-n);return d.toISOString().slice(0,10)}
 function businessDay(openedAt){
   if(!openedAt||!Number.isFinite(new Date(openedAt).getTime()))return null;
   const p=natalParts(openedAt);return p.hour<7?previousDay(p.day):p.day;
 }
 function timeLabel(d){if(!d)return "—";const dt=new Date(d);return Number.isFinite(dt.getTime())?new Intl.DateTimeFormat("pt-BR",{timeZone:TZ,day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).format(dt):"—"}
 function dateLabel(day){if(!day)return "—";const p=day.split("-");return p[2]+"/"+p[1]+"/"+p[0]}
 const sum=(arr,fn)=>arr.reduce((t,x)=>t+Number(fn(x)||0),0);
 const paymentsOf=sale=>{
   const own=Array.isArray(sale.payments)&&sale.payments.length?sale.payments:[{method:sale.payment||"Outro",value:sale.total}];
   return own;
 };
 function turnSnapshot(cash,endAt,allSales,settlements){
   const start=new Date(cash?.openedAt||0),end=new Date(endAt||Date.now());
   if(!cash?.openedAt||!Number.isFinite(start.getTime())||!Number.isFinite(end.getTime())||end<start)return null;
   const day=businessDay(start),boundary=new Date(day+"T20:01:00Z"); // 17h01 em Natal/RN (UTC-03)
   const openedBeforeBoundary=start<boundary;
   const turn=(num)=>({id:num,label:num===1?"Turno 1 — 07h às 17h":"Turno 2 — 17h01 ao fechamento",
     sales:0,salesCount:0,settlements:0,payments:{Dinheiro:0,Pix:0,"Débito":0,"Crédito":0},
     entries:0,outflows:0,sangrias:0,despesas:0,movements:[],operators:{},openingCash:0,expectedCash:0});
   const list=[turn(1),turn(2)];
   const which=d=>d<boundary?list[0]:list[1];
   const isInPeriod=value=>{const d=new Date(value||0);return Number.isFinite(d.getTime())&&d>=start&&d<=end};
   for(const sale of allSales||[]){
     if(sale.voided||!isInPeriod(sale.closedAt))continue;
     const shift=which(new Date(sale.closedAt));const value=Number(sale.total||0);
     shift.sales+=value;shift.salesCount++;
     const operator=String(sale.operator||"Não identificado");
     shift.operators[operator]=(shift.operators[operator]||0)+value;
     for(const p of paymentsOf(sale)){
       const method=p.method||"Outro";
       shift.payments[method]=(shift.payments[method]||0)+Number(p.value||0);
     }
   }
   for(const settlement of settlements||[]){
     if(!isInPeriod(settlement.at))continue;
     const shift=which(new Date(settlement.at));
     const value=Number(settlement.value||0);shift.settlements+=value;
     const method=settlement.method||"Outro";
     shift.payments[method]=(shift.payments[method]||0)+value;
   }
   for(const m of cash.movements||[]){
     if(!isInPeriod(m.at))continue;
     const shift=which(new Date(m.at));const val=Number(m.value||0);
     if(m.type==="entrada")shift.entries+=val;
     else{shift.outflows+=val;if(m.type==="sangria")shift.sangrias+=val;else shift.despesas+=val;}
     shift.movements.push({at:m.at,type:m.type,value:val,note:m.note||"",operator:m.operator||""});
   }
   const shiftOne=list[0],shiftTwo=list[1],initial=Number(cash.opening||0);
   shiftOne.openingCash=openedBeforeBoundary?initial:0;
   shiftOne.expectedCash=shiftOne.openingCash+Number(shiftOne.payments.Dinheiro||0)+shiftOne.entries-shiftOne.outflows-
     // Dinheiro de acertos internos já aparece como entrada de movimento no caixa.
     sum((settlements||[]).filter(s=>s.method==="Dinheiro"&&isInPeriod(s.at)&&new Date(s.at)<boundary),s=>s.value);
   shiftTwo.openingCash=openedBeforeBoundary?shiftOne.expectedCash:initial;
   shiftTwo.expectedCash=shiftTwo.openingCash+Number(shiftTwo.payments.Dinheiro||0)+shiftTwo.entries-shiftTwo.outflows-
     sum((settlements||[]).filter(s=>s.method==="Dinheiro"&&isInPeriod(s.at)&&new Date(s.at)>=boundary),s=>s.value);
   return {businessDate:day,openedAt:start.toISOString(),endedAt:end.toISOString(),boundary:boundary.toISOString(),
     initial,turn1:shiftOne,turn2:shiftTwo,totalSales:shiftOne.sales+shiftTwo.sales,totalExpected:shiftTwo.expectedCash,
     openedBeforeBoundary};
 }
 window.cashShiftBreakdownV65=turnSnapshot;
 const cashData=(cash,cutoff)=>turnSnapshot(cash,cutoff,state.history||[],state.internalAccounts?.settlements||[]);
 function closureSnapshot(c){
   return c?.shiftBreakdown||turnSnapshot({openedAt:c?.openedAt,opening:c?.opening,movements:c?.movements||[]},c?.closedAt,state.history||[],state.internalAccounts?.settlements||[]);
 }
 function shiftMethodRows(t){
   const methods=[...new Set([...financialMethods,...Object.keys(t.payments||{})])];
   return methods.map(k=>'<div class="cart-row"><span>'+esc(k)+'</span><b>'+brl(Number(t.payments[k]||0))+'</b></div>').join("");
 }
 function shiftCard(t,number,report,options={}){
   const small=!!options.compact;
   const label=number===1?"Turno 1 — 07h às 17h":"Turno 2 — 17h01 ao fechamento";
   const op=Object.entries(t.operators||{});
   const movementList=t.movements||[];
   const shiftTime=number===1? "07:00 a 17:00" : "17:01 até "+timeLabel(report.endedAt);
   return '<section class="panel cash-shift-card">'+
    '<h3>'+ (number===1?"☀️ ":"🌙 ")+label+'</h3>'+
    '<div class="muted">'+shiftTime+' • Data operacional: '+dateLabel(report.businessDate)+'</div>'+
    '<div class="cart-row"><span>Vendas recebidas ('+t.salesCount+')</span><b>'+brl(t.sales)+'</b></div>'+
    (small?"":'<div class="cash-shift-payments">'+shiftMethodRows(t)+'</div>')+
    (t.settlements?'<div class="cart-row"><span>Acertos de contas internas (incluídos nos pagamentos)</span><b>'+brl(t.settlements)+'</b></div>':"")+
    '<div class="cart-row"><span>Entradas / suprimentos (incluem acertos internos em dinheiro)</span><b>'+brl(t.entries)+'</b></div>'+
    '<div class="cart-row"><span>Sangrias</span><b>'+brl(t.sangrias)+'</b></div>'+
    '<div class="cart-row"><span>Outras saídas / despesas</span><b>'+brl(t.despesas)+'</b></div>'+
    '<div class="cart-row"><span>'+(number===1?'Fundo inicial':'Dinheiro recebido do turno anterior')+'</span><b>'+brl(t.openingCash)+'</b></div>'+
    '<div class="cart-row cash-shift-total"><span>Saldo esperado em dinheiro</span><b>'+brl(t.expectedCash)+'</b></div>'+
    (small?"":(op.length?'<div class="muted">Operadores (vendas): '+op.map(([k,v])=>esc(k)+' '+brl(v)).join(' • ')+'</div>':"")+
    (movementList.length?'<details><summary>Movimentações deste turno ('+movementList.length+')</summary>'+movementList.map(m=>'<div class="cart-row"><span>'+esc(m.type||"")+' • '+esc(m.note||"")+'<div class="muted">'+timeLabel(m.at)+' • '+esc(m.operator||"-")+'</div></span><b>'+brl(m.value)+'</b></div>').join('')+'</details>':""))+
    '</section>';
 }
 function splitHtml(r,filter="all",compact=false){
   if(!r)return '<div class="panel">Não há informações de abertura de caixa para separar por turno.</div>';
   return '<div class="cash-shift-wrap">'+
    (filter==="all"||filter==="1"?shiftCard(r.turn1,1,r,{compact}):"")+
    (filter==="all"||filter==="2"?shiftCard(r.turn2,2,r,{compact}):"")+
    '</div>';
 }
 function shiftSummaryForPrint(c){
   const r=closureSnapshot(c);
   if(!r)return '<p>Sem informações suficientes para separar os turnos deste fechamento.</p>';
   const fmt=v=>brl(Number(v||0));
   function block(t,num){
     return '<div class="panel"><h2>'+(num===1?"Turno 1 • 07h–17h":"Turno 2 • 17h01–fechamento")+'</h2>'+
       '<div class="r"><span>Vendas ('+t.salesCount+')</span><b>'+fmt(t.sales)+'</b></div>'+
       Object.entries(t.payments).map(([method,v])=>'<div class="r"><span>'+esc(method)+'</span><b>'+fmt(v)+'</b></div>').join('')+
       '<div class="r"><span>Entradas</span><b>'+fmt(t.entries)+'</b></div>'+
       '<div class="r"><span>Sangrias</span><b>'+fmt(t.sangrias)+'</b></div>'+
       '<div class="r"><span>Despesas</span><b>'+fmt(t.despesas)+'</b></div>'+
       '<div class="r"><span>Início em dinheiro</span><b>'+fmt(t.openingCash)+'</b></div>'+
       '<div class="r"><span>Esperado em dinheiro</span><b>'+fmt(t.expectedCash)+'</b></div></div>';
   }
   return '<h2>Conferência por turno • '+dateLabel(r.businessDate)+'</h2>'+
      '<p class="muted">Horário de Natal/RN. As vendas são atribuídas ao turno pela hora do pagamento. A conferência física de dinheiro e a diferença pertencem ao fechamento geral.</p>'+
      block(r.turn1,1)+block(r.turn2,2);
 }
 const originalCashRender=renderCash;
 renderCash=function(){
   originalCashRender();
   if(!state.cash?.open)return;
   const panel=document.getElementById('cashStatus');
   if(!panel)return;
   const report=cashData(state.cash,new Date());
   if(!report)return;
   const outer=document.createElement('div');outer.className='cash-shift-summary';
   outer.innerHTML='<div class="panel"><b>🕒 Vendas por turno • '+dateLabel(report.businessDate)+'</b>'+
     '<div class="muted">Turno 1: 07h–17h • Turno 2: 17h01 até o fechamento, inclusive após a meia-noite.</div>'+
     '<div class="cash-shift-wrap">'+
       [report.turn1,report.turn2].map((x,i)=>'<div class="panel cash-shift-mini"><div>'+(i===0?'☀️ Turno 1':'🌙 Turno 2')+'</div><b>'+brl(x.sales)+'</b><div class="muted">'+x.salesCount+' venda(s)</div><div>Dinheiro '+brl(x.payments.Dinheiro||0)+'</div><div>Pix '+brl(x.payments.Pix||0)+'</div><div class="muted">Sangrias '+brl(x.sangrias)+'</div></div>').join("")+'</div>'+
     '<button class="btn" type="button" onclick="showLiveCashShiftV65()">🧾 VER DETALHAMENTO POR TURNO</button></div>';
   panel.appendChild(outer);
 };
 window.showLiveCashShiftV65=function(){
   if(!state.cash?.open)return alert('O caixa está fechado.');
   const r=cashData(state.cash,new Date());
   document.getElementById('modalContent').innerHTML='<h2>🕒 Caixa aberto — turnos</h2>'+splitHtml(r)+
     '<p class="muted">Os valores são parciais. O dinheiro contado e a diferença só são conferidos no fechamento geral.</p>'+
     '<div class="sheet-actions"><button class="btn" onclick="closeModal()">VOLTAR</button><button class="btn primary" onclick="printCurrentCashShiftV65()">🖨️ IMPRIMIR / PDF</button></div>';
   document.getElementById('modal').classList.remove('hide');
 };
 window.printCurrentCashShiftV65=function(){
   if(!state.cash?.open)return;
   const r=cashData(state.cash,new Date());
   const fake={openedAt:state.cash.openedAt,closedAt:new Date().toISOString(),opening:state.cash.opening,movements:state.cash.movements,shiftBreakdown:r};
   openPrintableReport('Caixa por turno • Algaroba','<h1>ALGAROBA SHAKES GRILLS</h1><p>Relatório parcial • '+timeLabel(new Date())+'</p>'+shiftSummaryForPrint(fake));
 };
 const originalCloseCash=closeCash;
 closeCash=function(){
   originalCloseCash();
   if(!state.cash?.open)return;
   const el=document.getElementById('modalContent'),r=cashData(state.cash,new Date());
   if(el&&r)el.insertAdjacentHTML('afterbegin','<div class="panel"><b>📋 Conferência separada por turno</b><div class="muted">A soma dos turnos será conciliada no fechamento geral.</div></div>'+splitHtml(r,"all",true));
 };
 const originalShare=showCashClosureShare;
 showCashClosureShare=function(c){
   originalShare(c);
   const el=document.getElementById('modalContent');
   if(el)el.insertAdjacentHTML('afterbegin','<div class="panel"><b>📊 Fechamento por turno • '+dateLabel(closureSnapshot(c)?.businessDate)+'</b></div>'+splitHtml(closureSnapshot(c),"all",true));
 };
 const originalClosureText=closureReportText;
 closureReportText=function(c){
   const base=originalClosureText(c).replace('Turno: ','Período do caixa: ');
   const r=closureSnapshot(c);if(!r)return base;
   const segment=(t,n)=>'\n'+(n===1?'TURNO 1 — 07h às 17h':'TURNO 2 — 17h01 ao fechamento')+
     '\nVendas ('+t.salesCount+'): '+brl(t.sales)+
     '\nDinheiro: '+brl(t.payments.Dinheiro||0)+
     '\nPix: '+brl(t.payments.Pix||0)+
     '\nDébito: '+brl(t.payments['Débito']||0)+
     '\nCrédito: '+brl(t.payments['Crédito']||0)+
     '\nEntradas: '+brl(t.entries)+
     '\nSangrias: '+brl(t.sangrias)+
     '\nDespesas: '+brl(t.despesas)+
     '\nSaldo esperado: '+brl(t.expectedCash)+'\n';
   return base+'\n\nCAIXA POR TURNOS — DATA OPERACIONAL '+dateLabel(r.businessDate)+
     segment(r.turn1,1)+segment(r.turn2,2)+
     '\nObs.: o caixa permanece aberto na virada dos turnos e da meia-noite. A diferença de dinheiro é apurada apenas no fechamento geral.';
 };
 const originalClosureHTML=closureReportHTML;
 closureReportHTML=function(c){
   let html=originalClosureHTML(c).replace('<b>Turno:</b>','<b>Período do caixa:</b>');
   const markup=shiftSummaryForPrint(c),idx=html.lastIndexOf('<script>');
   return idx<0?html.replace('</body>',markup+'</body>'):html.slice(0,idx)+markup+html.slice(idx);
 };
 const originalReportFilter=reportFilterHtml;
 let selectedCashShift='all';
 reportFilterHtml=function(k){
   const base=originalReportFilter(k);
   return k!=='cash'?base:base+'<div class="panel"><b>Conferência por turno</b><select id="cashShiftSelectV65" onchange="setCashShiftFilterV65(this.value)"><option value="all">Turnos 1 e 2</option><option value="1">Somente turno 1 • 07h–17h</option><option value="2">Somente turno 2 • 17h01–fechamento</option></select><div class="muted">No relatório de caixa, as vendas depois da meia-noite ficam na data operacional do turno noturno.</div></div>';
 };
 window.setCashShiftFilterV65=function(val){
   selectedCashShift=['1','2'].includes(val)?val:'all';
   generateModuleReport();
 };
 const originalGenerate=generateModuleReport;
 generateModuleReport=function(){
   if(activeReportModule!=='cash')return originalGenerate();
   const [a,b]=moduleDates();
   let from=isoLocalDate(a),to=isoLocalDate(b);
   const quick=reportUiState?.selectedPeriod||'today';
   // Após 00h, "Hoje" representa o expediente iniciado no dia anterior até as 06h59.
   if(quick==='today'||quick==='yesterday'){
     const today=businessDay(new Date());
     from=to=quick==='today'?today:previousDay(today);
   }
   const el=document.getElementById('moduleResult');if(!el)return;
   const closures=(state.cash?.closures||[]).filter(c=>{
     const day=c.businessDate||businessDay(c.openedAt||c.closedAt);
     return day&&day>=from&&day<=to;
   }).slice().sort((x,y)=>new Date(y.closedAt)-new Date(x.closedAt));
   const entries=closures.map(c=>{
     const report=closureSnapshot(c);
     const date=report?.businessDate||c.businessDate||businessDay(c.openedAt||c.closedAt);
     return '<div class="panel cash-shift-closure"><h3>🔒 Caixa de '+dateLabel(date)+'</h3>'+
       '<div class="muted">Abriu: '+timeLabel(c.openedAt)+' • Fechou: '+timeLabel(c.closedAt)+
       '<br>Responsáveis: '+esc(c.openedBy||'-')+' / '+esc(c.closedBy||'-')+'</div>'+
       splitHtml(report,selectedCashShift)+
       '<div class="cash-shift-overall"><b>Fechamento geral:</b> Vendas '+brl(c.sales||0)+
       ' • Esperado '+brl(c.expected||0)+' • Contado '+brl(c.counted||0)+
       ' • Diferença '+brl(c.difference||0)+'</div>'+
       (!c.shiftBreakdown?'<div class="muted">Registro antigo: distribuição reconstruída a partir do histórico disponível.</div>':'')+
       '</div>';
   });
   if(state.cash?.open){
     const report=cashData(state.cash,new Date());
     if(report&&report.businessDate>=from&&report.businessDate<=to){
       entries.unshift('<div class="panel cash-shift-closure"><h3>🟢 Caixa em andamento — '+dateLabel(report.businessDate)+'</h3>'+
         '<div class="muted">Aberto em '+timeLabel(report.openedAt)+' • Valores parciais (sem conferência física)</div>'+
         splitHtml(report,selectedCashShift)+'</div>');
     }
   }
   el.innerHTML='<div class="panel"><b>🏦 Fechamentos por turno • '+dateLabel(from)+(from!==to?' a '+dateLabel(to):'')+'</b>'+
     '<div class="muted">Turno 1: 07h–17h • Turno 2: 17h01 até o fechamento, mesmo após 02h do dia seguinte. Abertura e conferência de dinheiro são únicas por caixa.</div></div>'+
     (entries.join('')||'<div class="panel">Nenhum caixa aberto ou fechado na data operacional selecionada.</div>')+
     modulePrintButton();
 };
})();
'use strict';
/* Taller de averías: más fallos simulados con explicación de cómo se localizan y modo examen */
window.XT=window.XT||[];
const FLT={
 fuga:{n:'Fuga a tierra intermitente',sym:n=>`El diferencial de cabecera salta de vez en cuando (sobre todo con humedad o al usar «${n}»). Al rearmar, a veces aguanta horas.`,
  steps:['Desconecta todos los circuitos y rearma el diferencial: si aguanta, la fuga está en un circuito.','Conecta los circuitos de uno en uno y espera: el que provoca el disparo es el culpable.','Con el circuito desconectado, mide el aislamiento con el megóhmetro a 500 V (fase-tierra y neutro-tierra): debe superar 0,5 MΩ.','Revisa cajas de registro, tomas exteriores, el receptor y empalmes con humedad.'],fix:'Sustituir el cable o receptor con el aislamiento dañado y secar/sellar las cajas.',tool:'megohm'},
 sobretension:{n:'Sobretensión transitoria (protector agotado)',sym:n=>`Tras una tormenta se han averiado varios aparatos electrónicos a la vez (router, TV, placa de «${n}») pero los magnetotérmicos no han saltado.`,
  steps:['Observa si el piloto/ventana del protector de sobretensiones está en rojo (cartucho agotado).','Mide la tensión en varios puntos: puede ser normal porque el pico ya pasó.','Comprueba que el protector está en cabecera, bien conectado a tierra y con el magnetotérmico de respaldo.','Revisa la toma de tierra (resistencia < 37 Ω) y el cable de conexión del protector (corto y recto).'],fix:'Sustituir el cartucho del protector, comprobar la tierra y proteger los equipos sensibles con protectores en cascada.',tool:'visual'},
 neutro:{n:'Neutro cortado o flojo (aguas arriba)',sym:n=>`En los circuitos de «${n}» unas luces lucen mucho y se funden, otras casi no alumbran, y los aparatos se calientan o se estropean.`,
  steps:['Mide la tensión fase-neutro en distintos circuitos: verás valores entre 150 y 290 V cuando debería haber 230 V en todos.','Desconecta la carga: si el desequilibrio desaparece, el neutro se pierde aguas arriba.','Revisa el borne del neutro en cabecera y la barra de neutros del cuadro (tornillo flojo o quemado).','Aprieta o sustituye el borne y vuelve a medir.'],fix:'Reparar el borne o la barra de neutros y apretar todas las conexiones al par indicado.',tool:'volt'},
 borne:{n:'Borne flojo / falso contacto',sym:n=>`«${n}» funciona a ratos, la luz parpadea o el aparato rinde menos, y a veces hay olor a plástico caliente.`,
  steps:['Con la pinza, mide la intensidad: es normal, así que el problema no es la carga.','Mide la caída de tensión entre dos extremos de la conexión: más de 1-2 V indica mala conexión.','Con el termómetro infrarrojo (o termografía) busca el borne que está mucho más caliente que los demás.','Desconecta, revisa el borne (ennegrecido) y reapriétalo o cámbialo.'],fix:'Sustituir el borne o el terminal deteriorado y apretar al par correcto.',tool:'ir'},
 sobrecarga:{n:'Cable en sobrecarga',sym:n=>`El cable de «${n}» se calienta, a veces el magnetotérmico salta al cabo de un rato con varios aparatos conectados.`,
  steps:['Con la pinza amperimétrica mide la corriente real del circuito.','Compárala con la admisible del cable y con el calibre de la protección.','Cuenta los receptores enchufados a la vez: se ha conectado más carga de la prevista.','Reparte la carga en otro circuito o aumenta la sección y el calibre coherentemente.'],fix:'Repartir cargas en un circuito nuevo o aumentar la sección del cable y ajustar la protección.',tool:'amp'},
 calibre:{n:'Protección sobredimensionada',sym:n=>`El cable de «${n}» se pone caliente pero la protección nunca dispara; en una ocasión el aislante se derritió.`,
  steps:['Lee el calibre de la protección y compáralo con la sección del cable.','Con la pinza comprueba que la corriente supera la admisible del cable sin que salte.','Aplica la regla Ib ≤ In ≤ Iz: la protección debe ser menor o igual que lo que aguanta el cable.','Cambia la protección por una de calibre adecuado.'],fix:'Instalar un magnetotérmico de calibre coherente con la sección del cable (In ≤ Iz).',tool:'visual'},
 fase:{n:'Falta de una fase (trifásico)',sym:n=>`El motor/receptor trifásico «${n}» zumba, se calienta mucho y el relé térmico acaba disparando.`,
  steps:['Mide la tensión entre fases L1-L2, L2-L3 y L1-L3 aguas arriba y aguas abajo del contactor.','Con la pinza comprueba que las tres corrientes son parecidas: una a cero indica fase perdida.','Revisa el fusible o el polo del magnetotérmico y los bornes del contactor.','Sustituye el elemento que haya abierto la fase.'],fix:'Reparar el polo, fusible o borne que ha perdido la fase; añadir un relé de control de fases.',tool:'volt'},
 sintierra:{n:'Sin conductor de protección (tierra)',sym:n=>`Se nota un hormigueo al tocar la carcasa de «${n}», y al probar el diferencial no dispara con el pulsador de test de fuga.`,
  steps:['Con el polímetro mide continuidad entre la carcasa y la barra de tierra: debe ser < 1 Ω.','Mide la tensión entre la carcasa y tierra: si hay tensión, la carcasa está en tensión.','Con un comprobador de diferenciales verifica que dispara en < 300 ms a 30 mA.','Conecta el conductor de protección verde-amarillo y mide la resistencia de tierra.'],fix:'Conectar el conductor de protección al receptor y a la barra de tierra, y verificar la resistencia de tierra.',tool:'cont'}};
const TOOLS={volt:'Polímetro (tensión)',amp:'Pinza amperimétrica',megohm:'Megóhmetro (aislamiento)',ir:'Termómetro infrarrojo',cont:'Continuidad / tierra',visual:'Inspección visual'};
let E=null,ex={q:null,msg:''};
function nodesOf(b){const a=analyze(b),out=[];if(b.root)walk(b.root,(n,par,d)=>{out.push({n,par,d,i:a.info[n.id],id:n.id})});return{a,out}}
function pickFault(b){
  const {a,out}=nodesOf(b);if(!out.length)return null;
  const kinds=['fuga','sobretension','neutro','borne','sobrecarga','calibre','sintierra'];
  const loads=out.filter(x=>['load','motor'].includes(x.i.p.kind)),mot=loads.filter(x=>x.i.p.poles>=3);
  const k=(mot.length&&Math.random()<0.2)?'fase':kinds[Math.floor(Math.random()*kinds.length)];
  let F;
  if(k==='sobretension')F=out.find(x=>x.i.p.kind==='spd')||out[0];
  else if(k==='neutro'){const g=out.filter(x=>x.n.children.length>1&&x.par);F=g.length?g[Math.floor(Math.random()*g.length)]:out[0]}
  else if(k==='fase')F=mot[Math.floor(Math.random()*mot.length)];
  else F=loads.length?loads[Math.floor(Math.random()*loads.length)]:out[out.length-1];
  const ok=new Set([F.id]);if(F.par)ok.add(F.par.id);F.n.children.forEach(c=>ok.add(c.id));
  if(k==='sobretension'||k==='neutro')ok.clear(),ok.add(F.id);
  return{k,id:F.id,ok:[...ok],ib:F.i.ib,seed:Math.random()}}
function inSub(b,root,id){let r=false;const n=(function f(x){return x.id===root?x:x.children.map(f).find(Boolean)})(b.root);if(n)walk(n,x=>{if(x.id===id)r=true});return r}
function measure(b,tool,id){
  const {a,out}=nodesOf(b),X=out.find(x=>x.id===id);if(!X)return'—';const f=E.f,F=out.find(x=>x.id===f.id),r=(v,u)=>f1(v)+' '+u,jit=(v,p)=>v*(1+(Math.sin(f.seed*1000+id.length*7)*p));
  const three=X.i.p.poles>=3,V=three?400:230,belowF=inSub(b,f.id,id),aboveF=inSub(b,id,f.id),sameC=belowF||aboveF||id===f.id;
  if(tool==='volt'){
    if(f.k==='neutro'&&belowF)return`${r(jit(230,0.32),'V')} (inestable: oscila entre ${Math.round(150)} y ${Math.round(290)} V)`;
    if(f.k==='borne'&&belowF&&id!==f.id)return`${r(V*0.89,'V')} (cae ${r(V*0.11,'V')} respecto a aguas arriba)`;
    if(f.k==='fase'&&belowF)return`L1-L2 ${V} V · L2-L3 0 V · L1-L3 0 V (una fase ausente)`;
    return`${r(V*(0.995+Math.sin(id.length)*0.004),'V')}`}
  if(tool==='amp'){const ib=X.i.ib;
    if(f.k==='sobrecarga'&&(belowF||id===f.id))return`${r(ib*1.55,'A')} (el cable admite ${X.i.amp||'?'} A)`;
    if(f.k==='calibre'&&(belowF||id===f.id)&&X.i.p.kind!=='load')return`${r(Math.max(ib*1.8,(X.i.amp||16)*1.25),'A')} y la protección de ${X.i.p.in||'?'} A no dispara`;
    if(f.k==='fase'&&belowF)return`L1 ${r(ib*1.3,'A')} · L2 ${r(ib*1.3,'A')} · L3 0 A`;
    return`${r(ib,'A')}`}
  if(tool==='megohm'){if(f.k==='fuga'&&(belowF||id===f.id))return`${f1(0.18+Math.abs(Math.sin(f.seed))*0.2)} MΩ — por debajo de 0,5 MΩ: aislamiento defectuoso`;return'> 200 MΩ — correcto'}
  if(tool==='ir'){if(f.k==='borne'&&(id===f.id||(F&&F.par&&id===F.par.id)))return`${Math.round(82+Math.abs(Math.sin(f.seed))*14)} °C — muy por encima del resto (38 °C)`;if(f.k==='sobrecarga'&&belowF)return'58 °C — cable templado';return'36 °C — normal'}
  if(tool==='cont'){if(f.k==='sintierra'&&(belowF||id===f.id))return'∞ Ω — sin continuidad con la barra de tierra';return'0,3 Ω — correcto'}
  if(tool==='visual'){
    if(f.k==='sobretension'&&id===f.id)return(X.i.p.kind==='spd'?'Piloto del protector en ROJO: cartucho agotado.':'No hay protector de sobretensiones instalado.');
    if(f.k==='calibre'&&id===f.id)return`Protección de ${X.i.p.in||'?'} A para un cable de ${X.i.cl||'?'} mm²: no es coherente.`;
    if(f.k==='borne'&&id===f.id)return'Borne ennegrecido, aislante deformado.';
    if(f.k==='neutro'&&id===f.id)return'Barra de neutros con un tornillo flojo.';
    return'Sin anomalías visibles.'}
  return'—'}
window.avNew=()=>{const b=B();if(!b.root){ex.msg='El cuadro está vacío.';render();return}const f=pickFault(b);if(!f){ex.msg='No hay circuitos.';render();return}E={f,logm:[],used:0,hint:false,done:null,id:b.id};ex.msg='';render()};
window.avMeasure=()=>{const t=document.getElementById('av-tool').value,id=document.getElementById('av-node').value;const b=B();if(!E||E.done)return;ex.t=t;ex.nd=id;const r=measure(b,t,id),X=nodesOf(b).out.find(x=>x.id===id);E.logm.unshift({tool:t,node:label(X.n),r});E.used++;render()};
window.avHint=()=>{E.hint=true;render()};
window.avAnswer=()=>{const c=document.getElementById('av-cause').value,id=document.getElementById('av-where').value;if(!E||E.done)return;const f=E.f,okC=c===f.k,okW=f.ok.includes(id),pts=Math.max(0,(okC?60:0)+(okW?40:0)-Math.max(0,E.used-4)*5-(E.hint?15:0));E.done={okC,okW,pts,c,id};
  (S.stats=S.stats||{av:[]}).av.push({d:new Date().toISOString(),k:f.k,pts});render()};
window.avGive=()=>{if(E)E.done={gaveUp:true,pts:0};render()};
function vAverias(){
  const b=B();
  if(!b.root)return`<div class="card"><h3>Taller de averías</h3><p class="muted">Carga o genera un cuadro para poder provocar averías.</p></div>`;
  const {out}=nodesOf(b),hist=(S.stats&&S.stats.av)||[],avg=hist.length?Math.round(hist.reduce((s,x)=>s+x.pts,0)/hist.length):0;
  const head=`<div class="card"><h3>Taller de averías · modo examen</h3><p class="muted" style="margin:0 0 6px;font-size:12.5px">La app inventa una avería en el cuadro «${esc(b.name)}». Mide con las herramientas (cada medida extra resta), decide la causa y el punto donde está.</p>
   <div class="bar"><button class="b" onclick="avNew()">${E&&E.id===b.id&&!E.done?'Otra avería':'Nueva avería'}</button>${hist.length?`<span class="muted">${hist.length} intentos · media ${avg}/100</span>`:''}</div>${ex.msg?`<div class="chk warn">${esc(ex.msg)}</div>`:''}</div>`;
  if(!E||E.id!==b.id)return head+`<div class="card"><h3>Catálogo de averías (para estudiar)</h3>${Object.values(FLT).map(f=>`<details style="margin:4px 0"><summary><b>${f.n}</b></summary><p style="font-size:13px"><b>Síntoma:</b> ${esc(f.sym('el circuito'))}</p><ol style="font-size:13px;margin:4px 0 4px 18px">${f.steps.map(s=>`<li>${esc(s)}</li>`).join('')}</ol><p style="font-size:13px"><b>Solución:</b> ${esc(f.fix)}</p></details>`).join('')}</div>`;
  const f=E.f,F=out.find(x=>x.id===f.id);if(!F){E=null;return head}
  const sel=out.map(x=>`<option value="${x.id}">${'· '.repeat(x.d)}${esc(label(x.n))}</option>`).join('');
  const done=E.done;
  return head+`<div class="gc"><div><div class="card" style="border-left:5px solid var(--er)"><h3>Síntomas</h3><p style="font-size:14px;margin:0">${esc(FLT[f.k].sym(label(F.n)))}</p>${E.hint?`<div class="chk info" style="margin-top:6px">Pista: la avería afecta a ${F.n.children.length>1?'varios circuitos':'un único circuito'} y se detecta mejor con: <b>${TOOLS[FLT[f.k].tool]}</b>.</div>`:`<button class="b s" style="margin-top:6px" onclick="avHint()">Pedir pista (−15 puntos)</button>`}</div>
   ${done?'':`<div class="card"><h3>Mediciones <span class="muted" style="font-weight:400">(${E.used} hechas, las 4 primeras gratis)</span></h3><div class="bar"><select id="av-tool">${Object.entries(TOOLS).map(([k,v])=>`<option value="${k}" ${ex.t===k?'selected':''}>${v}</option>`).join('')}</select><select id="av-node" style="max-width:300px">${sel.replace('value="'+(ex.nd||'')+'"','value="'+(ex.nd||'')+'" selected')}</select><button class="b" onclick="avMeasure()">Medir</button></div>
    ${E.logm.length?`<table><tr><th>Herramienta</th><th>Punto</th><th>Lectura</th></tr>${E.logm.map(m=>`<tr><td>${TOOLS[m.tool]}</td><td>${esc(m.node)}</td><td>${esc(m.r)}</td></tr>`).join('')}</table>`:'<p class="muted">Todavía no has medido nada.</p>'}</div>
   <div class="card"><h3>Tu diagnóstico</h3><div class="bar"><select id="av-cause">${Object.entries(FLT).map(([k,v])=>`<option value="${k}">${v.n}</option>`).join('')}</select><span>en</span><select id="av-where" style="max-width:300px">${sel}</select><button class="b" onclick="avAnswer()">Comprobar</button><button class="b s" onclick="avGive()">Me rindo</button></div></div>`}
   ${done?`<div class="card" style="border:2px solid ${done.pts>=70?'#2e7d32':done.pts>0?'#e08a00':'#c62828'}"><h3>${done.gaveUp?'Solución':done.pts>=70?'¡Muy bien!':done.pts>0?'Casi':'Esta vez no'} · ${done.pts}/100</h3>
     ${done.gaveUp?'':`<div class="chk ${done.okC?'ok':'err'}">Causa: ${done.okC?'correcta':'incorrecta'}</div><div class="chk ${done.okW?'ok':'err'}">Punto: ${done.okW?'correcto':'incorrecto'}</div>`}
     <p style="font-size:13.5px"><b>Era:</b> ${FLT[f.k].n} en «${esc(label(F.n))}».</p><p style="font-size:13px;margin:0"><b>Cómo se localiza:</b></p><ol style="font-size:13px;margin:4px 0 4px 18px">${FLT[f.k].steps.map(s=>`<li>${esc(s)}</li>`).join('')}</ol><p style="font-size:13px"><b>Solución:</b> ${esc(FLT[f.k].fix)}</p><button class="b" onclick="avNew()">Otra avería</button></div>`:''}</div>
   <div class="card"><h3>Cuadro</h3><div style="font-size:12.5px">${out.map(x=>`<div style="padding-left:${x.d*14}px">${x.id===f.id&&done?'⚠ ':''}${esc(label(x.n))} <span class="muted">${x.i.p.in?x.i.p.in+' A':''}</span></div>`).join('')}</div></div></div>`}
window.XT.push({k:'aver',n:'Averías',v:vAverias,after:'m3d'});
window.avFLT=FLT;

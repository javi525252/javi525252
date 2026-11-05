'use strict';
/* Domótica con autómata programable (tipo LOGO!): editor de esquema de funciones, simulador en vivo,
   pantalla del autómata y escena de la casa. Independiente de cualquier marca. */
const LGT={
  and:{n:'Y (AND)',ins:['','',''],c:'#1565c0',d:'Salida activa si todas las entradas conectadas están activas.'},
  nand:{n:'NO-Y (NAND)',ins:['','',''],c:'#1565c0',d:'Inversa de la Y.'},
  or:{n:'O (OR)',ins:['','',''],c:'#1565c0',d:'Salida activa si alguna entrada está activa.'},
  nor:{n:'NO-O (NOR)',ins:['','',''],c:'#1565c0',d:'Inversa de la O.'},
  xor:{n:'O exclusiva (XOR)',ins:['',''],c:'#1565c0',d:'Activa si las dos entradas son distintas (conmutada).'},
  not:{n:'NO (NOT)',ins:[''],c:'#1565c0',d:'Invierte la señal.'},
  sr:{n:'Biestable SR',ins:['S','R'],c:'#6a1b9a',d:'S activa y memoriza; R desactiva (R domina).'},
  toggle:{n:'Telerruptor',ins:['Trg','R'],c:'#6a1b9a',d:'Cada pulso en Trg cambia la salida. R la apaga.'},
  ton:{n:'Retardo a la conexión',ins:['In'],p:{T:5},c:'#ef6c00',d:'La salida se activa T segundos después de activarse In.'},
  tof:{n:'Retardo a la desconexión',ins:['In'],p:{T:10},c:'#ef6c00',d:'Con In activa, la salida se activa; al soltar, se mantiene T segundos más.'},
  tp:{n:'Impulso',ins:['In'],p:{T:2},c:'#ef6c00',d:'Un pulso en In genera una salida de T segundos.'},
  flash:{n:'Intermitente',ins:['En'],p:{ton:0.5,toff:0.5},c:'#ef6c00',d:'Mientras En esté activa, la salida parpadea.'},
  count:{n:'Contador +/−',ins:['Cnt','Dir','R'],p:{N:3},c:'#00838f',d:'Cuenta pulsos de Cnt (Dir=1 resta). Salida activa si cuenta ≥ N.'},
  cmp:{n:'Comparador analógico',ins:['Ana'],p:{th:5,hy:0.5,mode:'>'},c:'#00838f',d:'Convierte una entrada analógica en señal digital con histéresis.'},
  week:{n:'Reloj semanal',ins:[],p:{days:[1,1,1,1,1,0,0],on:'07:00',off:'22:00'},c:'#558b2f',d:'Activa en los días y horas elegidos.'},
  edge:{n:'Flanco de subida',ins:['In'],c:'#00838f',d:'Un solo ciclo de salida cuando In pasa de 0 a 1.'}
};
const LGQT={lamp:'Lámpara',heater:'Calefactor',pump:'Bomba / riego',siren:'Sirena',lock:'Cerradura',fan:'Ventilador',blind_up:'Persiana · subir',blind_down:'Persiana · bajar',generic:'Otro'};
const LGDAYS=['Lu','Ma','Mi','Ju','Vi','Sá','Do'];
const LG={run:true,speed:1,t:0,clock:8*3600,I:{},AI:{AI1:5,AI2:20},out:{},st:{},Q:{},blind:0,blindFault:false,sel:null,wire:null,drag:null,sig:'',ex:null,tm:null};
function lgNew(){const ins={},q={};for(let i=1;i<=8;i++)ins['I'+i]={n:['Pulsador 1','Pulsador 2','Interruptor 3','Sensor de puerta','Llave de armado','Entrada 6','Entrada 7','Entrada 8'][i-1],t:i<=2?'push':'sw'};
  const qt=['lamp','lamp','blind_up','blind_down','heater','pump','siren','lock'],qn=['Luz 1','Luz 2','Persiana subir','Persiana bajar','Calefacción','Riego','Sirena','Cerradura'];for(let i=1;i<=8;i++)q['Q'+i]={n:qn[i-1],t:qt[i-1],kw:[0.1,0.1,0.25,0.25,1.5,0.4,0.1,0.02][i-1]};
  return{link:{},ins,ai:{AI1:{n:'Luz exterior',min:0,max:10,u:'V'},AI2:{n:'Temperatura',min:0,max:40,u:'°C'}},q,blocks:[],qin:{},nid:1}}
const lgProg=()=>{const p=P();if(!p.logo)p.logo=lgNew();if(!p.logo.link)p.logo.link={};return p.logo};
const hm=s=>{const [h,m]=String(s).split(':').map(Number);return (h||0)*60+(m||0)};
function lgVal(r){if(!r)return null;if(r==='hi')return 1;if(r==='lo')return 0;if(/^I\d/.test(r))return LG.I[r]?1:0;if(/^AI/.test(r))return LG.AI[r];return LG.out[r]||0}
function lgEval(g,dt){LG.t+=dt;LG.clock=(LG.clock+dt)%(7*86400);
  g.blocks.forEach(b=>{const st=LG.st[b.id]=LG.st[b.id]||{},vi=i=>{const r=b.in[i];return r==null||r===''?null:lgVal(r)},bin=i=>{const v=vi(i);return v==null?null:(v?1:0)},con=()=>[0,1,2].map(bin).filter(v=>v!==null);let o=0;
    switch(b.t){
      case 'and':{const a=con();o=a.length&&a.every(v=>v)?1:0;break}
      case 'nand':{const a=con();o=a.length&&a.every(v=>v)?0:1;break}
      case 'or':{o=con().some(v=>v)?1:0;break}
      case 'nor':{o=con().some(v=>v)?0:1;break}
      case 'xor':{o=con().reduce((a,v)=>a^v,0);break}
      case 'not':{o=bin(0)?0:1;break}
      case 'sr':{if(bin(1))st.q=0;else if(bin(0))st.q=1;o=st.q||0;break}
      case 'toggle':{const t=bin(0);if(t&&!st.last)st.q=st.q?0:1;if(bin(1))st.q=0;st.last=t;o=st.q||0;break}
      case 'ton':{if(bin(0))st.a=(st.a||0)+dt;else st.a=0;o=(st.a||0)>=b.p.T?1:0;break}
      case 'tof':{if(bin(0)){st.a=0;st.on=1}else if(st.on){st.a=(st.a||0)+dt;if(st.a>=b.p.T)st.on=0}o=st.on?1:0;break}
      case 'tp':{const i=bin(0);if(i&&!st.last){st.a=0;st.on=1}if(st.on){st.a=(st.a||0)+dt;if(st.a>=b.p.T)st.on=0}st.last=i;o=st.on?1:0;break}
      case 'flash':{if(bin(0)){st.a=(st.a||0)+dt;o=(st.a%(b.p.ton+b.p.toff))<b.p.ton?1:0}else{st.a=0;o=0}break}
      case 'count':{const c=bin(0);if(c&&!st.last)st.n=(st.n||0)+(bin(1)?-1:1);if(bin(2))st.n=0;st.last=c;st.n=Math.max(0,st.n||0);o=st.n>=b.p.N?1:0;break}
      case 'cmp':{const v=vi(0);if(v!=null){const hy=b.p.hy/2;if(b.p.mode==='>'){if(v>b.p.th+hy)st.q=1;else if(v<b.p.th-hy)st.q=0}else{if(v<b.p.th-hy)st.q=1;else if(v>b.p.th+hy)st.q=0}}o=st.q||0;break}
      case 'week':{const day=Math.floor(LG.clock/86400)%7,min=(LG.clock%86400)/60,on=hm(b.p.on),off=hm(b.p.off),act=on<=off?(min>=on&&min<off):(min>=on||min<off);o=(b.p.days[day]&&act)?1:0;break}
      case 'edge':{const i=bin(0);o=(i&&!st.last)?1:0;st.last=i;break}}
    LG.out[b.id]=o});
  for(let n=1;n<=8;n++)LG.Q['Q'+n]=lgVal(g.qin['Q'+n])?1:0;
  // persiana (recorrido 20 s) y avería por subir+bajar a la vez
  const up=Object.keys(g.q).some(k=>g.q[k].t==='blind_up'&&LG.Q[k]),dn=Object.keys(g.q).some(k=>g.q[k].t==='blind_down'&&LG.Q[k]);
  LG.blindFault=up&&dn;if(up&&!dn)LG.blind=Math.max(0,LG.blind-dt*5);if(dn&&!up)LG.blind=Math.min(100,LG.blind+dt*5)}
function lgStep(dtSim){const g=lgProg();let left=dtSim,n=0;while(left>1e-6&&n++<800){const d=Math.min(0.05,left);lgEval(g,d);left-=d}}
// ---------- programas de ejemplo ----------
const LGEX={
  telerruptor:{n:'Telerruptor (pulsador → luz)',d:'Cada pulsación de I1 enciende o apaga la luz Q1, como un telerruptor.',tip:'Pulsa I1 varias veces.',b:[['B1','toggle',['I1','lo']]],q:{Q1:'B1'}},
  escalera:{n:'Luz de escalera con temporizador',d:'Un pulsador (I1) enciende la luz 10 s; I3 la deja fija encendida.',tip:'Pulsa I1 y espera. Activa I3 para luz fija.',b:[['B1','tof',['I1'],{T:10}],['B2','or',['B1','I3']]],q:{Q1:'B2'}},
  persiana:{n:'Persiana con enclavamiento',d:'I1 sube, I2 baja, I3 para. Nunca pueden estar subir y bajar a la vez; tras 20 s se detiene sola.',tip:'Pulsa I1 y luego I2 durante el movimiento.',b:[['B1','not',['B4']],['B2','and',['I1','B1']],['B5','or',['I2','I3','B6']],['B3','sr',['B2','B5']],['B6','ton',['B3'],{T:20}],['B7','not',['B3']],['B8','and',['I2','B7']],['B9','or',['I1','I3','B10']],['B4','sr',['B8','B9']],['B10','ton',['B4'],{T:20}]],q:{Q3:'B3',Q4:'B4'}},
  crepuscular:{n:'Alumbrado crepuscular + reloj',d:'La luz exterior se enciende de noche (luz baja) solo entre las 18:00 y las 23:00.',tip:'Baja el sensor de luz y avanza el reloj.',b:[['B1','cmp',['AI1'],{th:3,hy:1,mode:'<'}],['B2','week',[],{days:[1,1,1,1,1,1,1],on:'18:00',off:'23:00'}],['B3','and',['B1','B2']],['B4','or',['B3','I3']]],q:{Q1:'B4'}},
  termostato:{n:'Termostato de calefacción',d:'Calefactor Q5 encendido si la temperatura baja de 20 °C (con histéresis 2 °C) y el interruptor I3 está activo.',tip:'Activa I3 y mueve la temperatura.',b:[['B1','cmp',['AI2'],{th:20,hy:2,mode:'<'}],['B2','and',['B1','I3']]],q:{Q5:'B2'}},
  alarma:{n:'Alarma con sirena intermitente',d:'Con la llave I5 armada, si se abre la puerta (I4) se memoriza la alarma y la sirena parpadea hasta rearmar con I1.',tip:'Activa I5, luego I4. Rearma con I1.',b:[['B1','and',['I4','I5']],['B2','sr',['B1','I1']],['B3','flash',['B2'],{ton:0.4,toff:0.4}]],q:{Q7:'B3',Q1:'B2'}},
  aforo:{n:'Contador de aforo',d:'I1 cuenta entradas, I2 salidas. Con 3 personas se enciende el aviso «completo» Q1. I3 reinicia.',tip:'Pulsa I1 tres veces.',b:[['B1','count',['I1','lo','I3'],{N:3}]],q:{Q1:'B1'}},
  riego:{n:'Riego programado',d:'La bomba Q6 riega de 07:00 a 07:10 lunes, miércoles y viernes, salvo que llueva (I3 activo).',tip:'Cambia el día/hora del reloj.',b:[['B1','week',[],{days:[1,0,1,0,1,0,0],on:'07:00',off:'07:10'}],['B2','not',['I3']],['B3','and',['B1','B2']]],q:{Q6:'B3'}}
};
function lgLoad(k){const e=LGEX[k],g=lgNew();let n=0;e.b.forEach(([id,t,ins,p])=>{n++;const def=LGT[t];const b={id,t,x:170+((n-1)%4)*170,y:40+Math.floor((n-1)/4)*140,in:(def.ins||[]).map((_,i)=>ins[i]||null),p:Object.assign({},JSON.parse(JSON.stringify(def.p||{})),p||{})};g.blocks.push(b)});
  Object.entries(e.q).forEach(([q,r])=>g.qin[q]=r);g.nid=n+1;g.ex=k;P().logo=g;LG.st={};LG.out={};LG.I={};LG.blind=0;LG.sel=null;LG.wire=null;LG.ex=k;render()}
// ---------- geometría del editor ----------
const NODE_W=96,QX=900;
const inY=n=>30+(n-1)*54,aiY=i=>30+8*54+(i-1)*54,qY=n=>30+(n-1)*54;
function lgOutPin(ref){const g=lgProg();if(ref==='hi')return{x:150,y:595};if(ref==='lo')return{x:250,y:595};
  if(/^I\d/.test(ref))return{x:NODE_W,y:inY(+ref.slice(1))+17};if(/^AI/.test(ref))return{x:NODE_W,y:aiY(+ref.slice(2))+17};
  const b=g.blocks.find(x=>x.id===ref);return b?{x:b.x+120,y:b.y+30+Math.max(1,(LGT[b.t].ins.length||1))*11}:null}
const lgInPin=(b,i)=>({x:b.x,y:b.y+34+i*22});
function blockH(b){return 40+Math.max(1,LGT[b.t].ins.length)*22}
// ---------- vista ----------
function vLogo(){
  const g=lgProg(),iss=lgIssues(g),errs=iss.filter(i=>i.lv==='err').length,warns=iss.filter(i=>i.lv==='warn').length;
  const pal=Object.entries(LGT).map(([k,d])=>`<span class="chip" title="${esc(d.d)}" onclick="lgAdd('${k}')" style="border-color:${d.c};color:${d.c};font-weight:600">+ ${d.n}</span>`).join('');
  const ex=Object.entries(LGEX).map(([k,e])=>`<option value="${k}" ${g.ex===k?'selected':''}>${e.n}</option>`).join('');
  return`<div class="bar noprint"><select onchange="if(this.value)lgLoad(this.value)"><option value="">Cargar programa de ejemplo…</option>${ex}</select><button class="b s" onclick="if(confirm('¿Borrar el programa?')){P().logo=lgNew();LG.st={};LG.out={};render()}">Borrar programa</button>
   <button class="b ${LG.run?'':'d'}" onclick="LG.run=!LG.run;render()">${LG.run?'⏸ Pausar':'▶ Ejecutar'}</button><label style="margin:0">Velocidad</label><select onchange="LG.speed=+this.value;render()">${[1,5,30,120,600].map(v=>`<option value="${v}" ${LG.speed===v?'selected':''}>×${v}</option>`).join('')}</select>
   <button class="b" style="background:#6a1b9a" onclick="lgHouseDemo()">🏠 Demo: casa domotizada</button><span class="muted">Autómata programable tipo LOGO!: programa el esquema de funciones y pruébalo en directo.</span></div>
  <div class="card noprint" style="padding:8px"><div style="font-weight:600;margin-bottom:4px">Bloques (toca para añadir)</div><div style="display:flex;flex-wrap:wrap;gap:5px">${pal}</div></div>
  <div class="gc"><div class="card m-center" style="padding:6px;align-self:start"><div style="overflow:auto;max-height:86vh;border:1px solid var(--bd);border-radius:6px"><svg id="lg-svg" viewBox="0 0 1000 640" style="width:100%;min-width:760px;height:auto;background:#fff;touch-action:none;display:block"><g id="lg-g"></g></svg></div>
    <p class="muted" style="font-size:12.5px;margin:6px 4px 0">Para unir: toca el <b>círculo de salida</b> (derecha de una entrada I, un bloque o un valor fijo) y después el <b>círculo de entrada</b> de otro bloque o de Q. Toca una conexión ya hecha para quitarla. Verde = señal activa.</p></div>
   <div><div id="lg-panel">${lgPanel()}</div>
   <div class="card"><h3>Comprobar la instalación</h3><p class="muted" style="font-size:12.5px;margin:0 0 6px">Prueba automáticamente todas las combinaciones de entradas y dice qué salidas funcionan y cuáles fallan.</p><button class="b" onclick="lgDoCheck()">🔍 Comprobar ahora</button>${LG.check?'<div style="margin-top:8px">'+LG.check.map(i=>`<div class="chk ${i.lv}">${esc(i.msg)}</div>`).join('')+'</div>':''}</div>
   <div class="card"><h3>Validación del programa</h3><div class="chk ${errs?'err':warns?'warn':'ok'}" style="font-weight:700;margin:0 0 6px">${errs?'✖ '+errs+' fallo'+(errs>1?'s':''):warns?'⚠ Con avisos ('+warns+')':'✔ Programa correcto'}</div>${iss.map(i=>`<div class="chk ${i.lv}">${esc(i.msg)}</div>`).join('')||'<div class="chk ok">Sin incidencias.</div>'}</div></div></div>`}
function lgIssues(g){const o=[],used=new Set();g.blocks.forEach(b=>b.in.forEach(r=>{if(r)used.add(r)}));Object.values(g.qin).forEach(r=>{if(r)used.add(r)});
  g.blocks.forEach(b=>{const d=LGT[b.t];(d.ins||[]).forEach((nm,i)=>{if(!b.in[i]&&(['sr','toggle','ton','tof','tp','flash','edge','cmp','count'].includes(b.t)&&i===0||b.t==='sr'&&i<2))o.push({lv:'warn',msg:`${d.n} (${b.id}): la entrada ${nm||i+1} no está conectada.`})});
    if(!used.has(b.id))o.push({lv:'info',msg:`${d.n} (${b.id}): su salida no se usa en ninguna parte.`})});
  const qs=Object.keys(g.qin).filter(q=>g.qin[q]);if(!qs.length)o.push({lv:'warn',msg:'Ninguna salida Q tiene señal conectada.'});
  qs.forEach(q=>{const d=g.q[q],A=d.kw*1000/230,ind=['pump','blind_up','blind_down','fan','lock','siren'].includes(d.t);
    if(A>(ind?3:10))o.push({lv:'warn',msg:`${q} (${d.n}): ${d.kw} kW = ${A.toFixed(1)} A supera lo que aguanta un relé del autómata (${ind?'3 A inductivo':'10 A resistivo'}). Usa un contactor.`})});
  const bu=Object.keys(g.q).find(q=>g.q[q].t==='blind_up'&&g.qin[q]),bd=Object.keys(g.q).find(q=>g.q[q].t==='blind_down'&&g.qin[q]);
  if(bu&&bd){let both=false;const s=JSON.stringify(g);/* comprobación estática simple: ¿comparten un enclavamiento? */const interl=g.blocks.some(b=>b.t==='not'&&(b.in[0]===g.qin[bu]||b.in[0]===g.qin[bd]));if(!interl)o.push({lv:'warn',msg:`Persiana: ${bu} (subir) y ${bd} (bajar) no tienen enclavamiento. Si se activan a la vez, el motor se daña. Usa un NO cruzado como en el ejemplo.`})}
  if(g.blocks.length>32)o.push({lv:'err',msg:'Demasiados bloques para un autómata de este tipo (máx. 32).'});
  // tipos de señal: digital / analógica
  g.blocks.forEach(b=>b.in.forEach((r,i)=>{if(!r)return;const d=LGT[b.t],isAI=/^AI/.test(r);
    if(b.t==='cmp'&&!isAI)o.push({lv:'err',msg:`Comparador ${b.id}: su entrada debe ser una señal analógica (AI1/AI2); has conectado ${r}, que es digital.`});
    else if(b.t!=='cmp'&&isAI)o.push({lv:'warn',msg:`${d.n} (${b.id}): conectas una entrada analógica (${r}) a una entrada digital. Pásala antes por un comparador analógico.`})}));
  Object.keys(g.qin).forEach(q=>{if(/^AI/.test(g.qin[q]||''))o.push({lv:'err',msg:`${q}: no se puede conectar una señal analógica directamente a una salida.`});if(g.qin[q]==='hi')o.push({lv:'info',msg:`${q} está fija en 1: siempre activa.`});if(g.qin[q]==='lo')o.push({lv:'info',msg:`${q} está fija en 0: nunca se activa.`})});
  // bloques que no influyen en ninguna salida
  const reach=new Set(),stack=Object.values(g.qin).filter(Boolean);while(stack.length){const r=stack.pop();if(reach.has(r))continue;reach.add(r);const b=g.blocks.find(x=>x.id===r);if(b)b.in.forEach(x=>{if(x)stack.push(x)})}
  g.blocks.forEach(b=>{if(!reach.has(b.id)&&used.has(b.id))o.push({lv:'warn',msg:`${LGT[b.t].n} (${b.id}): está cableado pero no llega a ninguna salida Q.`})});
  Object.keys(g.ins).forEach(k=>{if(!used.has(k)&&g.blocks.length)o.push({lv:'info',msg:`${k} (${g.ins[k].n}) no se usa en el programa.`})});
  // parámetros y lazos
  g.blocks.forEach(b=>{const p=b.p||{};if('T' in p&&!(p.T>0))o.push({lv:'err',msg:`${LGT[b.t].n} (${b.id}): el tiempo T debe ser mayor que 0.`});
    if(b.t==='week'&&!p.days.some(Boolean))o.push({lv:'warn',msg:`Reloj semanal (${b.id}): no tiene ningún día marcado, nunca se activará.`});
    if(b.t==='week'&&p.on===p.off)o.push({lv:'warn',msg:`Reloj semanal (${b.id}): la hora de conexión y desconexión es la misma.`});
    if(b.t==='sr'&&!b.in[1])o.push({lv:'warn',msg:`Biestable SR (${b.id}): sin entrada R, una vez activado nunca se desactiva.`});
    if(b.t==='count'&&!b.in[2])o.push({lv:'info',msg:`Contador (${b.id}): sin entrada de reset R, solo se puede bajar con la dirección.`});
    if(b.t==='cmp'&&b.p.hy<0)o.push({lv:'err',msg:`Comparador (${b.id}): histéresis negativa.`})});
  const memo=['sr','toggle','ton','tof','tp','flash','count','cmp','edge'],visiting={},loops=new Set();
  const dfs=id=>{const b=g.blocks.find(x=>x.id===id);if(!b)return;if(visiting[id]===1){loops.add(id);return}if(visiting[id]===2)return;visiting[id]=1;if(!memo.includes(b.t))b.in.forEach(r=>{if(r&&!/^(I|AI|hi|lo)/.test(r))dfs(r)});visiting[id]=2};
  g.blocks.forEach(b=>dfs(b.id));if(loops.size)o.push({lv:'err',msg:`Lazo sin memoria ni temporizador entre bloques (${[...loops].join(', ')}): la señal oscilaría. Añade un biestable o un retardo.`});
  const maxQ=Math.max(0,...qs.map(q=>+q.slice(1)));if(maxQ>4)o.push({lv:'info',msg:`Usas hasta Q${maxQ}: necesitas ${Math.ceil((maxQ-4)/4)} módulo(s) de ampliación de salidas.`});
  Object.entries(g.link||{}).forEach(([k,v])=>{if(!v)return;const h=HS(),isI=/^I/.test(k),exists=v.startsWith('item:')?h.items.some(i=>'item:'+i.id===v):h.rooms.some(r=>'lights:'+r.id===v);
    if(!exists)o.push({lv:'err',msg:`${k} está vinculada a un elemento de la casa que ya no existe.`});
    else if(!isI&&!g.qin[k])o.push({lv:'warn',msg:`${k} gobierna un elemento de la casa, pero no tiene ninguna señal conectada en el programa: nunca se activará.`});
    else if(isI&&!used.has(k))o.push({lv:'info',msg:`${k} está vinculada al plano, pero el programa no la usa.`});
    if(!isI&&v.startsWith('item:')){const it=h.items.find(i=>'item:'+i.id===v);if(it&&HI[it.k].sw)o.push({lv:'warn',msg:`${k} vinculada a un mando: las salidas deben gobernar luces o aparatos.`})}});
  if(LG.blindFault)o.push({lv:'err',msg:'EN DIRECTO: subir y bajar activos a la vez en la persiana. ¡Motor en riesgo!'});
  return o}
function lgPanel(){const g=lgProg(),on=n=>LG.I['I'+n],q=n=>LG.Q['Q'+n];
  const lcdI=[1,2,3,4,5,6,7,8].map(n=>`<span style="padding:0 2px;${on(n)?'background:#1d3b2a;color:#d8ffd8':'color:#1d3b2a'}">${n}</span>`).join('');
  const lcdQ=[1,2,3,4,5,6,7,8].map(n=>`<span style="padding:0 2px;${q(n)?'background:#1d3b2a;color:#d8ffd8':'color:#1d3b2a'}">${n}</span>`).join('');
  const day=Math.floor(LG.clock/86400)%7,hh=Math.floor(LG.clock%86400/3600),mm=Math.floor(LG.clock%3600/60),ss=Math.floor(LG.clock%60);
  const dev=`<div style="background:#2b3137;border-radius:10px;padding:10px;max-width:340px;color:#fff"><div style="background:#b5c9a6;border-radius:4px;padding:6px 8px;font:13px/1.35 ui-monospace,monospace;color:#1d3b2a">I ${lcdI}<br>Q ${lcdQ}<br>${LGDAYS[day]} ${String(hh).padStart(2,'0')}:${String(mm).padStart(2,'0')}:${String(ss).padStart(2,'0')}${LG.run?'':' · PAUSA'}</div>
    <div style="display:flex;gap:6px;margin-top:8px;font-size:11px;opacity:.8"><span style="border:1px solid #889;border-radius:4px;padding:2px 8px">ESC</span><span style="border:1px solid #889;border-radius:4px;padding:2px 8px">OK</span><span>◀ ▲ ▼ ▶</span><span style="flex:1"></span><span>${LG.run?'RUN':'STOP'}</span></div></div>`;
  const ctrl=Object.keys(g.ins).map(k=>{const d=g.ins[k],v=!!LG.I[k];return`<div style="display:flex;align-items:center;gap:6px;margin:3px 0"><button class="b ${v?'':'s'}" style="min-width:64px;${v?'background:#2e7d32':''}" onpointerdown="lgPress('${k}',1)" onpointerup="lgPress('${k}',0)" onpointerleave="lgPress('${k}',0)">${k} ${d.t==='push'?'⏺':v?'ON':'OFF'}</button><span style="font-size:12.5px;flex:1">${esc(d.n)} <small class="muted">${d.t==='push'?'(pulsador)':'(interruptor)'}</small></span></div>`}).join('')
    +Object.keys(g.ai).map(k=>{const a=g.ai[k];return`<div style="margin:6px 0 2px;font-size:12.5px">${k} · ${esc(a.n)}: <b>${(+LG.AI[k]).toFixed(1)} ${a.u}</b></div><input type="range" min="${a.min}" max="${a.max}" step="0.1" value="${LG.AI[k]}" style="width:100%" oninput="LG.AI['${k}']=+this.value;lgRefresh()">`}).join('');
  const clk=`<div class="bar" style="margin-top:6px"><label style="margin:0">Reloj</label><select onchange="lgSetClock(this.value,null)">${LGDAYS.map((d,i)=>`<option value="${i}" ${i===day?'selected':''}>${d}</option>`).join('')}</select><input type="time" value="${String(hh).padStart(2,'0')}:${String(mm).padStart(2,'0')}" onchange="lgSetClock(null,this.value)"></div>`;
  return`<div class="card"><h3>Autómata y entradas</h3>${dev}<div style="margin-top:8px">${ctrl}</div>${clk}</div>
   <div class="card"><h3>Escena de la casa (salidas)</h3>${lgScene(g)}${LG.blindFault?'<div class="chk err">¡Subir y bajar a la vez! Se bloquea la persiana.</div>':''}</div>
   ${LG.ex&&LGEX[LG.ex]?`<div class="card"><h3>${esc(LGEX[LG.ex].n)}</h3><p style="margin:0 0 4px">${esc(LGEX[LG.ex].d)}</p><div class="chk info">Pruébalo: ${esc(LGEX[LG.ex].tip)}</div></div>`:''}${lgInspector(g)}`}
function lgScene(g){const tile=(n,x,y)=>{const d=g.q['Q'+n],v=!!LG.Q['Q'+n],t=d.t;let ic='';const c=v?'#2e7d32':'#9aa';
  if(t==='lamp')ic=`<circle cx="45" cy="38" r="${v?20:12}" fill="${v?'#ffe066':'#ddd'}" stroke="#665" stroke-width="2"/>${v?'<circle cx="45" cy="38" r="34" fill="url(#lgg)"/>':''}<rect x="40" y="56" width="10" height="8" fill="#889"/>`;
  else if(t==='heater')ic=`<rect x="18" y="22" width="54" height="34" rx="4" fill="${v?'#ff7043':'#ddd'}" stroke="#665" stroke-width="2"/>${[0,1,2,3,4].map(i=>`<rect x="${24+i*10}" y="26" width="5" height="26" fill="${v?'#ffab91':'#bbb'}"/>`).join('')}`;
  else if(t==='pump')ic=`<circle cx="42" cy="40" r="16" fill="${v?'#42a5f5':'#ddd'}" stroke="#665" stroke-width="2"/>${v?'<circle cx="68" cy="32" r="3" fill="#1e88e5" class="drip"/><circle cx="72" cy="44" r="3" fill="#1e88e5" class="drip" style="animation-delay:.4s"/>':''}<rect x="56" y="36" width="14" height="8" fill="#889"/>`;
  else if(t==='siren')ic=`<path d="M30 30L52 22V58L30 50Z" fill="${v?'#ef5350':'#ddd'}" stroke="#665" stroke-width="2"/>${v?'<path d="M58 30Q68 40 58 50M64 24Q78 40 64 56" fill="none" stroke="#ef5350" stroke-width="3" class="pulse"/>':''}`;
  else if(t==='lock')ic=`<rect x="30" y="38" width="30" height="24" rx="4" fill="${v?'#66bb6a':'#ef9a9a'}" stroke="#665" stroke-width="2"/><path d="${v?'M36 38V28A9 9 0 0 1 54 24':'M36 38V28A9 9 0 0 1 54 28V38'}" fill="none" stroke="#665" stroke-width="3"/>`;
  else if(t==='fan')ic=`<g transform="translate(45 40)"><g class="${v?'spin':''}">${[0,90,180,270].map(a=>`<ellipse rx="5" ry="16" cy="-12" fill="${v?'#42a5f5':'#ccc'}" transform="rotate(${a})"/>`).join('')}</g></g>`;
  else if(t==='blind_up'||t==='blind_down'){const h=LG.blind*0.5;ic=`<rect x="22" y="14" width="46" height="52" fill="#cfe8ff" stroke="#665" stroke-width="2"/><rect x="22" y="14" width="46" height="${h+2}" fill="#8d6e63" stroke="#5d4037"/>${[0,1,2,3,4,5].map(i=>`<line x1="22" x2="68" y1="${14+i*9}" y2="${14+i*9}" stroke="#5d4037" stroke-width="1" opacity="${14+i*9<14+h?1:0}"/>`).join('')}<text x="45" y="78" text-anchor="middle" font-size="11" fill="#445">${t==='blind_up'?(v?'▲ sube':'▲'):(v?'▼ baja':'▼')} ${Math.round(100-LG.blind)}%</text>`}
  else ic=`<rect x="26" y="26" width="38" height="30" rx="6" fill="${v?'#66bb6a':'#ddd'}" stroke="#665" stroke-width="2"/>`;
  return`<g transform="translate(${x} ${y})"><rect width="90" height="96" rx="8" fill="#fafbfc" stroke="${c}" stroke-width="${v?3:1.5}"/>${ic}<text x="45" y="90" text-anchor="middle" font-size="11" font-weight="700" fill="#334">Q${n} ${esc(d.n).slice(0,12)}</text></g>`};
  return`<svg viewBox="0 0 380 200" style="width:100%;max-width:420px"><defs><radialGradient id="lgg"><stop offset="0" stop-color="#ffe680" stop-opacity=".9"/><stop offset="1" stop-color="#ffe680" stop-opacity="0"/></radialGradient></defs>${[1,2,3,4,5,6,7,8].map(n=>tile(n,(n-1)%4*95,Math.floor((n-1)/4)*100)).join('')}</svg>`}
function lgInspector(g){const s=LG.sel;if(!s)return'<div class="card muted">Toca un bloque, una entrada o una salida del esquema para editarlo.</div>';
  if(/^I\d/.test(s)){const d=g.ins[s];return`<div class="card"><h3>Entrada ${s}</h3><label>Nombre</label><input value="${esc(d.n)}" style="width:100%" onchange="lgProg().ins['${s}'].n=this.value;render()"><label>Tipo</label><select onchange="lgProg().ins['${s}'].t=this.value;render()"><option value="push" ${d.t==='push'?'selected':''}>Pulsador (mientras se mantiene)</option><option value="sw" ${d.t==='sw'?'selected':''}>Interruptor (queda fijo)</option></select>${lgLinkSel(s)}</div>`}
  if(/^Q\d/.test(s)){const d=g.q[s];return`<div class="card"><h3>Salida ${s}</h3><label>Nombre</label><input value="${esc(d.n)}" style="width:100%" onchange="lgProg().q['${s}'].n=this.value;render()"><label>Dispositivo</label><select style="width:100%" onchange="lgProg().q['${s}'].t=this.value;render()">${Object.entries(LGQT).map(([k,v])=>`<option value="${k}" ${d.t===k?'selected':''}>${v}</option>`).join('')}</select><label>Potencia de la carga (kW)</label><input type="number" step="0.05" value="${d.kw}" onchange="lgProg().q['${s}'].kw=num(this.value);render()">${lgLinkSel(s)}</div>`}
  const b=g.blocks.find(x=>x.id===s);if(!b)return'';const def=LGT[b.t],p=b.p;let f='';
  if('T' in p)f+=`<label>Tiempo T (s)</label><input type="number" min="0.1" step="0.5" value="${p.T}" onchange="lgSetP('${b.id}','T',num(this.value,1))">`;
  if(b.t==='flash')f+=`<label>Tiempo activa (s)</label><input type="number" step="0.1" value="${p.ton}" onchange="lgSetP('${b.id}','ton',num(this.value,0.5))"><label>Tiempo inactiva (s)</label><input type="number" step="0.1" value="${p.toff}" onchange="lgSetP('${b.id}','toff',num(this.value,0.5))">`;
  if(b.t==='count')f+=`<label>Umbral N</label><input type="number" min="1" value="${p.N}" onchange="lgSetP('${b.id}','N',num(this.value,3))">`;
  if(b.t==='cmp')f+=`<label>Condición</label><select onchange="lgSetP('${b.id}','mode',this.value)"><option value=">" ${p.mode==='>'?'selected':''}>mayor que</option><option value="<" ${p.mode==='<'?'selected':''}>menor que</option></select><label>Umbral</label><input type="number" step="0.5" value="${p.th}" onchange="lgSetP('${b.id}','th',num(this.value))"><label>Histéresis</label><input type="number" step="0.5" value="${p.hy}" onchange="lgSetP('${b.id}','hy',num(this.value))">`;
  if(b.t==='week')f+=`<label>Días</label><div class="bar">${LGDAYS.map((d,i)=>`<label style="margin:0"><input type="checkbox" ${p.days[i]?'checked':''} onchange="lgProg().blocks.find(x=>x.id==='${b.id}').p.days[${i}]=this.checked?1:0;save()"> ${d}</label>`).join('')}</div><div style="display:grid;grid-template-columns:1fr 1fr;gap:6px"><div><label>Conecta</label><input type="time" value="${p.on}" onchange="lgSetP('${b.id}','on',this.value)"></div><div><label>Desconecta</label><input type="time" value="${p.off}" onchange="lgSetP('${b.id}','off',this.value)"></div></div>`;
  return`<div class="card"><h3>${def.n} <small class="muted">${b.id}</small></h3><p class="muted" style="margin:0 0 6px;font-size:12.5px">${esc(def.d)}</p>${f}<div class="bar" style="margin-top:8px"><button class="b d" onclick="lgDel('${b.id}')">Eliminar bloque</button></div></div>`}
window.lgSetP=(id,k,v)=>{lgProg().blocks.find(b=>b.id===id).p[k]=v;LG.st[id]={};save();render()};
window.lgSetClock=(d,t)=>{const day=d!=null?+d:Math.floor(LG.clock/86400)%7,m=t?hm(t):Math.floor(LG.clock%86400/60);LG.clock=day*86400+m*60;lgRefresh(true)};
window.lgAdd=t=>{const g=lgProg(),def=LGT[t],n=g.blocks.length;let id;do{id='B'+g.nid++}while(g.blocks.some(b=>b.id===id));
  g.blocks.push({id,t,x:140+(n%5)*160,y:40+Math.floor(n/5)*130,in:(def.ins||[]).map(()=>null),p:JSON.parse(JSON.stringify(def.p||{}))});LG.sel=id;render()};
window.lgDel=id=>{const g=lgProg();g.blocks=g.blocks.filter(b=>b.id!==id);g.blocks.forEach(b=>b.in=b.in.map(r=>r===id?null:r));Object.keys(g.qin).forEach(q=>{if(g.qin[q]===id)g.qin[q]=null});LG.sel=null;render()};
window.lgPress=(k,v)=>{const d=lgProg().ins[k];if(!d)return;if(d.t==='push')LG.I[k]=v;else if(v)LG.I[k]=!LG.I[k];lgRefresh(true)};
// ---------- dibujo ----------
function lgDraw(){const g=lgProg(),el=document.getElementById('lg-g');if(!el)return;let s='';
  const wire=(a,b,on)=>{const dx=Math.max(40,(b.x-a.x)/2);return`<path d="M${a.x} ${a.y}C${a.x+dx} ${a.y} ${b.x-dx} ${b.y} ${b.x} ${b.y}" fill="none" stroke="${on?'#2e9e4f':'#9aa7b0'}" stroke-width="${on?4:3}" ${on?'':'stroke-dasharray=""'} opacity=".9"/>`};
  const links=[];g.blocks.forEach(b=>b.in.forEach((r,i)=>{if(r)links.push({from:r,to:{b,i}})}));Object.keys(g.qin).forEach(q=>{if(g.qin[q])links.push({from:g.qin[q],to:{q}})});
  links.forEach(l=>{const a=lgOutPin(l.from);if(!a)return;const bpin=l.to.q?{x:QX,y:qY(+l.to.q.slice(1))+17}:lgInPin(l.to.b,l.to.i);s+=`<g data-wire="${l.to.q?'q:'+l.to.q:'b:'+l.to.b.id+':'+l.to.i}" style="cursor:pointer">${wire(a,bpin,!!lgVal(l.from))}<path d="M${a.x} ${a.y}L${bpin.x} ${bpin.y}" stroke="transparent" stroke-width="14" fill="none"/></g>`});
  const pin=(x,y,id,kind,on,pend)=>`<circle cx="${x}" cy="${y}" r="9" fill="${pend?'#ffd54f':on?'#2e9e4f':'#fff'}" stroke="#37474f" stroke-width="2.5" data-pin="${kind}:${id}" style="cursor:crosshair"/>`;
  for(let n=1;n<=8;n++){const k='I'+n,d=g.ins[k],v=!!LG.I[k];s+=`<g data-in="${k}" style="cursor:pointer"><rect x="0" y="${inY(n)}" width="${NODE_W}" height="34" rx="6" fill="${v?'#dff5e3':'#f3f5f7'}" stroke="${LG.sel===k?'#0b7a4b':'#37474f'}" stroke-width="${LG.sel===k?4:2}"/><text x="8" y="${inY(n)+15}" font-size="13" font-weight="800" fill="#263238">${k}</text><text x="8" y="${inY(n)+28}" font-size="10.5" fill="#556">${esc(d.n).slice(0,15)}</text><text x="70" y="${inY(n)+15}" font-size="11" fill="${v?'#2e7d32':'#889'}">${v?'1':'0'}</text></g>${pin(NODE_W,inY(n)+17,k,'o',v,LG.wire===k)}`}
  [1,2].forEach(i=>{const k='AI'+i,a=g.ai[k];s+=`<g data-in="${k}"><rect x="0" y="${aiY(i)}" width="${NODE_W}" height="34" rx="6" fill="#eef6fb" stroke="${LG.sel===k?'#0b7a4b':'#37474f'}" stroke-width="2"/><text x="8" y="${aiY(i)+15}" font-size="13" font-weight="800" fill="#263238">${k}</text><text x="8" y="${aiY(i)+28}" font-size="10.5" fill="#556">${esc(a.n)} ${(+LG.AI[k]).toFixed(1)}${a.u}</text></g>${pin(NODE_W,aiY(i)+17,k,'o',false,LG.wire===k)}`});
  [['hi',150,'1 (alto)'],['lo',250,'0 (bajo)']].forEach(([k,x,l])=>{s+=`<rect x="${x-50}" y="578" width="100" height="34" rx="6" fill="#f3f5f7" stroke="#37474f" stroke-width="2"/><text x="${x-42}" y="600" font-size="12" font-weight="700" fill="#263238">${l}</text>${pin(x+50,595,k,'o',k==='hi',LG.wire===k)}`});
  for(let n=1;n<=8;n++){const k='Q'+n,d=g.q[k],v=!!LG.Q[k];s+=`<g data-q="${k}" style="cursor:pointer"><rect x="${QX}" y="${qY(n)}" width="100" height="34" rx="6" fill="${v?'#dff5e3':'#f3f5f7'}" stroke="${LG.sel===k?'#0b7a4b':'#37474f'}" stroke-width="${LG.sel===k?4:2}"/><text x="${QX+12}" y="${qY(n)+15}" font-size="13" font-weight="800" fill="#263238">${k} <tspan fill="${v?'#2e7d32':'#889'}">${v?'ON':'off'}</tspan></text><text x="${QX+12}" y="${qY(n)+28}" font-size="10.5" fill="#556">${esc(d.n).slice(0,14)}</text></g>${pin(QX,qY(n)+17,k,'i',v,false)}`}
  g.blocks.forEach(b=>{const def=LGT[b.t],h=blockH(b),v=!!LG.out[b.id],st=LG.st[b.id]||{};let info='';
    if('T' in b.p)info=`T=${b.p.T}s${st.a!==undefined&&(b.t==='ton'||b.t==='tof'||b.t==='tp')?` · ${st.a.toFixed(1)}`:''}`;else if(b.t==='count')info=`${st.n||0}/${b.p.N}`;else if(b.t==='cmp')info=`${b.p.mode}${b.p.th} ±${b.p.hy/2}`;else if(b.t==='week')info=`${b.p.on}–${b.p.off}`;else if(b.t==='flash')info=`${b.p.ton}/${b.p.toff}s`;
    s+=`<g data-blk="${b.id}" style="cursor:move"><rect x="${b.x}" y="${b.y}" width="120" height="${h-8}" rx="8" fill="#fff" stroke="${LG.sel===b.id?'#0b7a4b':def.c}" stroke-width="${LG.sel===b.id?5:3}"/><rect x="${b.x}" y="${b.y}" width="120" height="22" rx="8" fill="${def.c}"/><text x="${b.x+8}" y="${b.y+15}" font-size="11.5" font-weight="800" fill="#fff">${def.n.slice(0,17)}</text><text x="${b.x+60}" y="${b.y+h-14}" text-anchor="middle" font-size="11" fill="#445">${info}</text><text x="${b.x+112}" y="${b.y+17}" text-anchor="end" font-size="10" fill="#fff" opacity=".8">${b.id}</text></g>`;
    (def.ins||[]).forEach((nm,i)=>{const p=lgInPin(b,i);s+=pin(p.x,p.y,b.id+':'+i,'i',false,false)+`<text x="${b.x+14}" y="${p.y+4}" font-size="11" fill="#445">${nm}</text>`});
    const po=lgOutPin(b.id);s+=pin(po.x,po.y,b.id,'o',v,LG.wire===b.id)});
  el.innerHTML=s}
function lgMount(){const svg=document.getElementById('lg-svg');if(!svg)return;lgDraw();
  const pt=e=>{const p=svg.createSVGPoint();p.x=e.clientX;p.y=e.clientY;const q=p.matrixTransform(svg.getScreenCTM().inverse());return{x:q.x,y:q.y}};
  svg.onpointerdown=e=>{const t=e.target,g=lgProg();
    const pinEl=t.closest&&t.closest('[data-pin]');
    if(pinEl){const [kind,...rest]=pinEl.dataset.pin.split(':'),id=rest.join(':');
      if(kind==='o'){LG.wire=LG.wire===id?null:id}
      else if(LG.wire){if(/^Q\d/.test(id))g.qin[id]=LG.wire;else{const [bid,i]=id.split(':'),b=g.blocks.find(x=>x.id===bid);if(b&&LG.wire!==bid)b.in[+i]=LG.wire}LG.wire=null;save()}
      else{if(/^Q\d/.test(id))g.qin[id]=null;else{const [bid,i]=id.split(':'),b=g.blocks.find(x=>x.id===bid);if(b)b.in[+i]=null}save()}
      lgDraw();lgRefresh(true);return}
    const w=t.closest&&t.closest('[data-wire]');if(w){const [k,a,b]=w.dataset.wire.split(':');if(k==='q')g.qin[a]=null;else{const bl=g.blocks.find(x=>x.id===a);if(bl)bl.in[+b]=null}save();lgDraw();return}
    const bi=t.closest&&t.closest('[data-in]');if(bi){const k=bi.dataset.in;LG.sel=k;if(/^I/.test(k))lgPress(k,1);lgRefresh(true);if(/^I/.test(k)){svg.setPointerCapture(e.pointerId);LG.drag={press:k}}return}
    const bq=t.closest&&t.closest('[data-q]');if(bq){LG.sel=bq.dataset.q;lgRefresh(true);return}
    const bb=t.closest&&t.closest('[data-blk]');if(bb){const b=g.blocks.find(x=>x.id===bb.dataset.blk),q=pt(e);LG.sel=b.id;LG.drag={id:b.id,ox:q.x-b.x,oy:q.y-b.y};svg.setPointerCapture(e.pointerId);lgRefresh(true);return}
    LG.wire=null;LG.sel=null;lgDraw();lgRefresh(true)};
  svg.onpointermove=e=>{if(!LG.drag||!LG.drag.id)return;const q=pt(e),b=lgProg().blocks.find(x=>x.id===LG.drag.id);b.x=Math.max(110,Math.min(780,Math.round((q.x-LG.drag.ox)/10)*10));b.y=Math.max(10,Math.min(560,Math.round((q.y-LG.drag.oy)/10)*10));lgDraw()};
  svg.onpointerup=e=>{if(LG.drag&&LG.drag.press)lgPress(LG.drag.press,0);if(LG.drag&&LG.drag.id)save();LG.drag=null;lgRefresh(true)};
  document.onkeydown=e=>{if(tab!=='logo'||/INPUT|SELECT|TEXTAREA/.test((document.activeElement||{}).tagName||''))return;if((e.key==='Delete'||e.key==='Backspace')&&LG.sel&&lgProg().blocks.some(b=>b.id===LG.sel)){e.preventDefault();lgDel(LG.sel)}};
  if(!LG.tm)LG.tm=setInterval(()=>{if(!document.getElementById('lg-svg'))return;if(LG.run)lgStep(0.06*LG.speed);const sig=JSON.stringify([LG.I,LG.Q,LG.out,Math.floor(LG.t*4),LG.blind,LG.AI,LG.sel,LG.wire]);if(sig!==LG.sig){LG.sig=sig;lgRefresh()}},60)}
function lgRefresh(force){lgDraw();const p=document.getElementById('lg-panel');if(p){const a=document.activeElement;if(!(a&&/INPUT|SELECT/.test(a.tagName)&&p.contains(a)))p.innerHTML=lgPanel()}if(force)LG.sig=''}
// ---------- materiales ----------
function logoBOM(proj){const g=proj&&proj.logo;if(!g||!g.blocks.length&&!Object.values(g.qin).some(Boolean))return[];const qs=Object.keys(g.qin).filter(q=>g.qin[q]),maxQ=Math.max(0,...qs.map(q=>+q.slice(1))),rows=[];
  rows.push({p:{id:'lg_base',kind:'house',name:'Autómata programable 8 entradas / 4 salidas (tipo LOGO!)',price:190},qty:1});
  if(maxQ>4)rows.push({p:{id:'lg_ext',kind:'house',name:'Módulo de ampliación de 4 salidas por relé',price:95},qty:Math.ceil((maxQ-4)/4)});
  rows.push({p:{id:'lg_psu',kind:'house',name:'Fuente de alimentación 24 V (si el autómata es de 24 V)',price:38},qty:1});
  const ct=qs.filter(q=>{const d=g.q[q],A=d.kw*1000/230,ind=['pump','blind_up','blind_down','fan','lock','siren'].includes(d.t);return A>(ind?3:10)}).length;if(ct)rows.push({p:{id:'lg_ct',kind:'house',name:'Contactor para cargas que superan el relé',price:24},qty:ct});
  return rows}

// ---------- comprobador automático: prueba todas las combinaciones de entradas ----------
function lgCheck(){const g=lgProg(),res=[],used=new Set();g.blocks.forEach(b=>b.in.forEach(r=>{if(r)used.add(r)}));Object.values(g.qin).forEach(r=>{if(r)used.add(r)});
  const ins=Object.keys(g.ins).filter(k=>used.has(k)),ais=Object.keys(g.ai).filter(k=>used.has(k)),qs=Object.keys(g.qin).filter(q=>g.qin[q]);
  if(!qs.length)return[{lv:'err',msg:'No hay ninguna salida conectada: no hay nada que comprobar.'}];
  const snap={I:LG.I,AI:LG.AI,out:LG.out,st:LG.st,t:LG.t,clock:LG.clock,Q:LG.Q,blind:LG.blind,fault:LG.blindFault};
  const maxT=Math.max(5,...g.blocks.map(b=>(b.p&&(b.p.T||b.p.ton+b.p.toff))||0)),horizon=Math.min(120,maxT+6),dt=0.5,steps=Math.round(horizon/dt);
  const comb=1<<Math.min(ins.length,10),aiVals=ais.map(k=>[g.ai[k].min,(g.ai[k].min+g.ai[k].max)/2,g.ai[k].max]);
  const ever={},always={},osc={},both=[];qs.forEach(q=>{ever[q]=false;always[q]=true;osc[q]=0});let runs=0;
  const hasFlash=g.blocks.some(b=>b.t==='flash');
  const aiCombos=ais.length?aiVals.reduce((a,v)=>a.flatMap(x=>v.map(y=>x.concat([y]))),[[]]).slice(0,27):[[]];
  const upD=Object.keys(g.q).filter(q=>g.q[q].t==='blind_up'&&g.qin[q]),dnD=Object.keys(g.q).filter(q=>g.q[q].t==='blind_down'&&g.qin[q]);
  const sim=(clock,av,inFn,nsteps)=>{runs++;LG.I={};LG.AI=Object.assign({},snap.AI);ais.forEach((k,i)=>LG.AI[k]=av[i]);LG.out={};LG.st={};LG.t=0;LG.clock=clock;LG.blind=0;const last={},tog={};qs.forEach(q=>{tog[q]=0});
    for(let s=0;s<nsteps;s++){ins.forEach(k=>{LG.I[k]=!!inFn(k,s)});lgEval(g,dt);qs.forEach(q=>{if(LG.Q[q])ever[q]=true;else always[q]=false;if(s>nsteps-12&&last[q]!==undefined&&last[q]!==LG.Q[q])tog[q]++;last[q]=LG.Q[q]});
      if(upD.length&&dnD.length&&upD.some(q=>LG.Q[q])&&dnD.some(q=>LG.Q[q])&&both.length<3)both.push(ins.filter(k=>LG.I[k]).join('+')||'ninguna entrada')}
    qs.forEach(q=>{if(tog[q]>=8)osc[q]++})};
  // 1) todas las combinaciones fijas de entradas
  for(let m=0;m<comb;m++)for(const av of aiCombos)sim(snap.clock,av,k=>m>>ins.indexOf(k)&1,steps);
  // 2) pulsando cada entrada varias veces (contadores, telerruptores…)
  ins.forEach(k=>sim(snap.clock,aiCombos[0],(x,s)=>x===k&&s<24&&(Math.floor(s/2)%2===0),30));
  // 3) a la hora de cada reloj semanal
  g.blocks.filter(b=>b.t==='week').forEach(b=>{const d=Math.max(0,b.p.days.findIndex(Boolean));sim(d*86400+(hm(b.p.on)+1)*60,aiCombos[0],()=>0,steps);sim(d*86400+(hm(b.p.on)+1)*60,aiCombos[0],k=>ins.indexOf(k)%2,steps)});
  res.push({lv:'info',msg:`Se han probado ${runs} situaciones: todas las combinaciones de ${ins.length} entradas${ais.length?', valores bajo/medio/alto de las analógicas':''}, pulsaciones repetidas y las horas de los relojes semanales (hasta ${horizon} s cada una).`});
  LG.I=snap.I;LG.AI=snap.AI;LG.out=snap.out;LG.st=snap.st;LG.t=snap.t;LG.clock=snap.clock;LG.Q=snap.Q;LG.blind=snap.blind;LG.blindFault=snap.fault;
  qs.forEach(q=>{const n=g.q[q].n;if(!ever[q])res.push({lv:'err',msg:`${q} (${n}) NO se activa nunca con ninguna combinación de entradas: el programa no funciona para esa salida.`});
    else if(always[q])res.push({lv:'warn',msg:`${q} (${n}) está SIEMPRE activa, hagas lo que hagas con las entradas.`});
    else res.push({lv:'ok',msg:`${q} (${n}) responde bien: se activa y se desactiva según las entradas.`});
    if(osc[q]&&!hasFlash)res.push({lv:'warn',msg:`${q} (${n}) parpadea sola en ${osc[q]} situaciones sin que haya un bloque intermitente: revisa realimentaciones.`})});
  if(both.length)res.push({lv:'err',msg:`PERSIANA: subir y bajar se activan a la vez con: ${[...new Set(both)].join(' | ')}. Falta enclavamiento: el motor se dañaría.`});
  else if(upD.length&&dnD.length)res.push({lv:'ok',msg:'Persiana: con ninguna combinación se activan subir y bajar a la vez (enclavamiento correcto).'});
  return res}
window.lgDoCheck=()=>{LG.check=lgCheck();render()};

// ---------- vínculo con la casa ----------
const LGIN_K=['interruptor','conmutador','cruzamiento','pulsador','regulador','detector','sensor','timbre'];
const LGOUT_K=['luz','foco','radiador','split_i','termo','suelo','extractor','toma_horno','toma_lav','toma_lvj','toma_sec'];
function lgOutOf(it){const g=P().logo;if(!g||!g.link)return null;for(const q of Object.keys(g.link)){if(!/^Q\d/.test(q))continue;const v=g.link[q];if(!v)continue;
  if(v==='item:'+it.id)return q;if(v.startsWith('lights:')&&(it.k==='luz'||it.k==='foco')){const r=roomAt(HS(),it.x,it.y);if(r&&r.id===v.slice(7))return q}}return null}
function lgInOf(it){const g=P().logo;if(!g||!g.link)return null;for(const k of Object.keys(g.link))if(/^I\d/.test(k)&&g.link[k]==='item:'+it.id)return k;return null}
const lgHasLinks=()=>{const g=P().logo;return !!(g&&g.link&&Object.values(g.link).some(Boolean))};
function lgFromHouse(it){const k=lgInOf(it);if(!k)return;const d=lgProg().ins[k];
  if(it.k==='pulsador'||it.k==='timbre'||(d&&d.t==='push')){LG.I[k]=true;setTimeout(()=>{LG.I[k]=false},450)}else LG.I[k]=!!SIMH.sw[it.id]}
function lgHouseStep(dt){if(!lgHasLinks()||!LG.run||document.getElementById('lg-svg'))return;lgStep(dt*LG.speed)}
function lgLinkOptions(k){const h=HS();if(/^I\d/.test(k))return h.items.filter(i=>LGIN_K.includes(i.k)).map(i=>[`item:${i.id}`,`${HI[i.k].n} · ${(roomAt(h,i.x,i.y)||{name:'fuera'}).name}`]);
  const o=[];h.rooms.forEach(r=>{if(h.items.some(i=>(i.k==='luz'||i.k==='foco')&&roomAt(h,i.x,i.y)===r))o.push([`lights:${r.id}`,`Todas las luces de ${r.name||RT[r.type]}`])});
  h.items.filter(i=>LGOUT_K.includes(i.k)).forEach(i=>o.push([`item:${i.id}`,`${HI[i.k].n} · ${(roomAt(h,i.x,i.y)||{name:'fuera'}).name}`]));return o}
window.lgSetLink=(k,v)=>{const g=lgProg();if(v)g.link[k]=v;else delete g.link[k];save();render()};
function lgLinkSel(k){const g=lgProg(),cur=g.link[k]||'',opts=lgLinkOptions(k);
  return`<label>Vinculado a la casa</label><select style="width:100%" onchange="lgSetLink('${k}',this.value)"><option value="">— sin vincular —</option>${opts.map(([v,l])=>`<option value="${v}" ${cur===v?'selected':''}>${esc(l)}</option>`).join('')}</select><p class="muted" style="font-size:12px;margin:2px 0 0">${/^I/.test(k)?'Al pulsarlo en el plano de la casa, el autómata recibe esta entrada.':'La salida del autómata gobierna este elemento de la casa.'}</p>`}
window.lgHouseDemo=()=>{const h=HS();if(!h.rooms.length)return alert('Carga antes una plantilla de casa en la pestaña «Casa (plano)».');
  const room=t=>h.rooms.find(r=>r.type===t&&h.items.some(i=>(i.k==='luz')&&roomAt(h,i.x,i.y)===r)),sal=room('salon')||h.rooms.find(r=>h.items.some(i=>i.k==='luz'&&roomAt(h,i.x,i.y)===r)),pas=room('pasillo')||h.rooms.filter(r=>h.items.some(i=>i.k==='luz'&&roomAt(h,i.x,i.y)===r))[1]||sal,ves=h.rooms.find(r=>r.type==='vestibulo')||sal;
  const mk=(k,r)=>{let it=h.items.find(i=>i.k===k&&roomAt(h,i.x,i.y)===r&&!Object.values((P().logo&&P().logo.link)||{}).includes('item:'+i.id));if(!it){const p=freeSpot(h,r,k);it={id:uid(),k,x:p.x,y:p.y};h.items.push(it)}return it};
  const b1=mk('pulsador',sal),b2=mk('pulsador',ves),b3=mk('pulsador',pas);
  const g=lgNew();g.ins.I1.n='Pulsador del salón';g.ins.I2.n='Apagar todo (entrada)';g.ins.I3.n='Pulsador del pasillo';g.q.Q1.n='Luces del salón';g.q.Q2.n='Luces del pasillo';
  g.blocks=[{id:'B1',t:'toggle',x:200,y:60,in:['I1','I2'],p:{}},{id:'B2',t:'tof',x:200,y:200,in:['I3'],p:{T:15}},{id:'B3',t:'not',x:380,y:200,in:['I2'],p:{}},{id:'B4',t:'and',x:540,y:200,in:['B2','B3',null],p:{}}];g.qin={Q1:'B1',Q2:'B4'};g.nid=5;g.ex=null;
  g.link={I1:'item:'+b1.id,I2:'item:'+b2.id,I3:'item:'+b3.id,Q1:'lights:'+sal.id,Q2:'lights:'+pas.id};P().logo=g;LG.st={};LG.out={};LG.I={};LG.Q={};LG.run=true;LG.speed=1;
  hsInit();CS.sim=true;tab='casa';
  SIMH.ex={t:'Casa domotizada con autómata',s:[`1. Los tres pulsadores del plano (${sal.name}, ${ves.name}, ${pas.name}) ya no encienden la luz directamente: son entradas I1, I2 e I3 del autómata.`,`2. Pulsa el del ${sal.name}: el telerruptor del autómata enciende las luces del salón (Q1). Púlsalo otra vez y se apagan.`,`3. Pulsa el del ${pas.name}: la luz del pasillo (Q2) se enciende y se apaga sola a los 15 s.`,`4. Pulsa «Apagar todo» (${ves.name}): apaga el salón y el pasillo. Mira las señales I y Q en el panel del autómata.`,'5. Cambia el cableado en la pestaña «Domótica (autómata)» y la casa responde al instante.']};
  hsAfterEdit();render()};

'use strict';
/* Simulación de funcionamiento de la casa: interruptores, enchufes, aparatos, protecciones, agua y gas.
   La usan el plano 2D y la vista Casa 3D. */
const PLUGS={'':{n:'Sin aparato',kw:0},lam:{n:'Lámpara',kw:0.06},tv:{n:'Televisor',kw:0.12},mov:{n:'Cargador de móvil',kw:0.02},sec:{n:'Secador de pelo',kw:2},mic:{n:'Microondas',kw:1.2},cal:{n:'Calefactor',kw:2},her:{n:'Hervidor',kw:2.2},pla:{n:'Plancha',kw:2.4}};
const PLUGKEYS=Object.keys(PLUGS),PLUGGABLE=['toma','toma_enc','toma_bano','toma_ext'];
const RUNNABLE=['toma_horno','toma_lav','toma_lvj','toma_sec','split_i','radiador','suelo','termo','aerot','extractor','caldera'];
const SIMH={latch:{},dim:{},ring:{},room:null,delMode:false,main:true,trip:{},off:{},heat:{},sw:{},plug:{},run:{},leak:{},short:{},log:[],ex:null,t:0,speed:5,m:null,sel:null,warned:{},cur:{I:{}},sig:''};
function hsMap(){
  const h=HS(),H=houseCalc(h),codeOf={};Object.values(H.circ).forEach(c=>c.items.forEach(i=>codeOf[i.id]=c.code));
  const b=B(),groups=[],known=Object.keys(H.circ);let igaIn=40;
  if(b.root&&b.root.children){igaIn=(prod(b.root.pid)||{}).in||40;
    b.root.children.forEach(n=>{const p=prod(n.pid)||{};if(n.circ&&known.includes(n.circ))groups.push({id:n.id,label:n.label||'Circuito',diff:null,codes:[n.circ]});
      else if(p.kind==='rcd'){const cs=n.children.filter(c=>c.circ&&known.includes(c.circ)).map(c=>c.circ);if(cs.length)groups.push({id:n.id,label:n.label||'Diferencial',diff:n,codes:cs})}})}
  const have=new Set(groups.flatMap(g=>g.codes)),rest=known.filter(c=>!have.has(c));
  for(let i=0;i<rest.length;i+=5)groups.push({id:'g'+i,label:'Diferencial '+(groups.length+1),diff:{id:'d'+i},codes:rest.slice(i,i+5)});
  const gOf={};groups.forEach(g=>g.codes.forEach(c=>gOf[c]=g));
  return{h,H,codeOf,groups,gOf,igaIn}}
function hsInit(keep){const m=hsMap();Object.assign(SIMH,{latch:{},dim:{},ring:{},delMode:false,main:true,trip:{},off:{},heat:{},sw:{},plug:{},run:{},leak:{},short:{},log:[],ex:null,t:0,warned:{},cur:{I:{}},sig:'',m});if(!keep)SIMH.sel=null;hsStart();hsSay('Simulación lista. Pulsa interruptores, enchufa aparatos o prueba un ejemplo.')}
function hsSay(txt,lv){SIMH.log.unshift({t:SIMH.t,txt,lv:lv||''});if(SIMH.log.length>30)SIMH.log.pop()}
const itemCode=(m,it)=>m.codeOf[it.id]||(HI[it.k].sw?'C1':HI[it.k].pw?'C2':null);
function hsLive(code){const m=SIMH.m;if(!m||!code)return !!SIMH.main&&!SIMH.trip.iga;const g=m.gOf[code];
  return SIMH.main&&!SIMH.off.iga&&!SIMH.trip.iga&&!SIMH.off['b_'+code]&&!SIMH.trip['b_'+code]&&!(g&&g.diff&&(SIMH.trip['d_'+g.id]||SIMH.off['d_'+g.id]))}
const CTRL=['interruptor','conmutador','cruzamiento','pulsador','regulador','detector'];
function roomSwitches(m,r){return m.h.items.filter(i=>CTRL.includes(i.k)&&roomAt(m.h,i.x,i.y)===r)}
function lightOn(m,it){const r=roomAt(m.h,it.x,it.y),sw=r?roomSwitches(m,r):[];if(!sw.length)return true;
  const two=sw.filter(s=>s.k==='conmutador'||s.k==='cruzamiento'),pul=sw.filter(s=>s.k==='pulsador');let on=false;
  if(two.length>=2)on=two.reduce((a,s)=>a^(SIMH.sw[s.id]?1:0),0)===1;else if(two.length===1)on=!!SIMH.sw[two[0].id];
  return on||sw.some(s=>(s.k==='interruptor'||s.k==='regulador'||s.k==='detector')&&SIMH.sw[s.id])||(pul.length>0&&!!SIMH.latch[r.id])}
function brightness(m,it){const r=roomAt(m.h,it.x,it.y);const reg=r&&roomSwitches(m,r).find(s=>s.k==='regulador'&&SIMH.sw[s.id]);return reg?(SIMH.dim[reg.id]||100)/100:1}
function ctrlText(m,r){const sw=roomSwitches(m,r),n=k=>sw.filter(s=>s.k===k).length;const parts=[];['interruptor','conmutador','cruzamiento','pulsador','regulador','detector'].forEach(k=>{if(n(k))parts.push(`${n(k)} ${HI[k].n.toLowerCase()}`)});
  return parts.length?`La luz de ${r.name||RT[r.type]} se maneja con: ${parts.join(', ')}.`:`${r.name||RT[r.type]} no tiene ningún mecanismo de maniobra: la luz queda SIEMPRE encendida y no se puede apagar.`}
function kwNow(m,it){const k=it.k;
  if(k==='luz'||k==='foco')return lightOn(m,it)?itemKw(it)*brightness(m,it):0;
  if(PLUGGABLE.includes(k))return SIMH.plug[it.id]?PLUGS[SIMH.plug[it.id]].kw:0;
  if(RUNNABLE.includes(k))return SIMH.run[it.id]?(k==='caldera'?0.1:itemKw(it)):0;return 0}
function hsCurrents(m){const I={},kw={};m.h.items.forEach(it=>{const code=m.codeOf[it.id];if(!code)return;if(!hsLive(code))return;const k=kwNow(m,it);if(k){kw[code]=(kw[code]||0)+k;I[code]=(I[code]||0)+k*1000/230}});return{I,kw}}
function hsTrip(k,msg){if(SIMH.trip[k])return;SIMH.trip[k]=true;hsSay('🔴 '+msg,'err')}
function hsTick(dt){const m=SIMH.m;if(!m)return false;SIMH.t+=dt;let ch=false;const sp=SIMH.speed,cur=hsCurrents(m);SIMH.cur=cur;let tot=0;
  Object.keys(m.H.circ).forEach(code=>{const In=m.H.circ[code].def.In,I=cur.I[code]||0;
    if(!hsLive(code)){SIMH.heat[code]=Math.max(0,(SIMH.heat[code]||0)-dt*0.3);return}tot+=I;
    if(SIMH.short[code]){hsTrip('b_'+code,`Cortocircuito en ${code}: dispara AL INSTANTE el magnetotérmico de ${code}. El resto de circuitos sigue con tensión (selectividad correcta).`);ch=true;return}
    const r=I/In;if(r>1.13){SIMH.heat[code]=(SIMH.heat[code]||0)+dt*sp*(r*r-1.2769)/12;if(SIMH.heat[code]>=1){hsTrip('b_'+code,`Sobrecarga en ${code}: ${f1(I)} A en un circuito de ${In} A (${Math.round(r*100)} %). El bimetal se calienta y dispara el magnetotérmico ${code}.`);ch=true}}
    else SIMH.heat[code]=Math.max(0,(SIMH.heat[code]||0)-dt*0.15)});
  Object.keys(SIMH.leak).forEach(code=>{const lk=SIMH.leak[code];if(!lk||!hsLive(code))return;const g=m.gOf[code];
    if(g&&g.diff){if(lk>=0.015){hsTrip('d_'+g.id,`Fuga a tierra de ${Math.round(lk*1000)} mA en ${code}: dispara el diferencial «${g.label}» (30 mA). Se quedan sin tensión TODOS sus circuitos: ${g.codes.join(', ')}.`);ch=true}}
    else if(!SIMH.warned['l'+code]){SIMH.warned['l'+code]=1;hsSay(`⚠ Fuga a tierra en ${code} y no hay diferencial: nadie corta la corriente. Riesgo de electrocución o incendio.`,'err');ch=true}});
  if(SIMH.main&&!SIMH.trip.iga&&!SIMH.off.iga&&tot>m.igaIn){SIMH.heat.iga=(SIMH.heat.iga||0)+dt*sp*(Math.pow(tot/m.igaIn,2)-1.2769)/12;if(SIMH.heat.iga>=1){hsTrip('iga',`El consumo total (${f1(tot)} A) supera el interruptor general de ${m.igaIn} A: salta el IGA y toda la casa se queda sin luz.`);ch=true}}
  else SIMH.heat.iga=Math.max(0,(SIMH.heat.iga||0)-dt*0.15);
  return ch}
// ---------- acciones del usuario ----------
function hsClick(id){const m=SIMH.m;if(!m)return;const it=m.h.items.find(i=>i.id===id);if(!it)return;SIMH.sel=id;const k=it.k,d=HI[k],code=itemCode(m,it),rn=(roomAt(m.h,it.x,it.y)||{}).name||'la estancia';SIMH.ex=null;
  const In=code&&m.H.circ[code]?m.H.circ[code].def.In:0,amps=kw=>f1(kw*1000/230);
  if(k==='interruptor'||k==='conmutador'){SIMH.sw[id]=!SIMH.sw[id];const lights=m.h.items.filter(i=>(i.k==='luz'||i.k==='foco')&&roomAt(m.h,i.x,i.y)===roomAt(m.h,it.x,it.y)),on=lights.filter(l=>lightOn(m,l)),kw=on.reduce((s,l)=>s+itemKw(l),0);
    hsSay(`${SIMH.sw[id]?'Cierras':'Abres'} el ${d.n.toLowerCase()} de ${rn}. `+(k==='conmutador'&&roomSwitches(m,roomAt(m.h,it.x,it.y)).filter(s=>s.k==='conmutador'||s.k==='cruzamiento').length>1?'Está conmutado con otro punto: cualquiera de ellos enciende o apaga. ':'')+(on.length?(hsLive('C1')?`La corriente sale del cuadro por el circuito C1 (${m.H.circ.C1?m.H.circ.C1.def.In:10} A) y se encienden ${on.length} luz(es): ${f1(kw)} kW = ${amps(kw)} A.`:'Se cierra el circuito, pero C1 está sin tensión: no se enciende nada.'):'El circuito de luz se abre: las luces se apagan.'),hsLive('C1')?'':'err')}
  else if(k==='cruzamiento'){SIMH.sw[id]=!SIMH.sw[id];hsSay(`Accionas el conmutador de cruce de ${rn}: invierte el camino de la corriente entre los conmutadores. `+ctrlText(m,roomAt(m.h,it.x,it.y))+' Cada uno de ellos cambia el estado de la luz.')}
  else if(k==='pulsador'){const r=roomAt(m.h,it.x,it.y);SIMH.latch[r.id]=!SIMH.latch[r.id];hsSay(`Pulsas el pulsador de ${rn}: el telerruptor memoriza el pulso y ${SIMH.latch[r.id]?'ENCIENDE':'APAGA'} la luz. Cualquier pulsador de la estancia hace lo mismo.`)}
  else if(k==='regulador'){const lv=[0,30,60,100],cur=SIMH.sw[id]?(SIMH.dim[id]||100):0,nx=lv[(lv.indexOf(cur)+1)%lv.length];SIMH.sw[id]=nx>0;SIMH.dim[id]=nx||100;hsSay(nx?`Regulador de ${rn} al ${nx} %: la luz da menos y el circuito consume ${nx} % de la potencia.`:`Regulador de ${rn} apagado.`)}
  else if(k==='detector'){SIMH.sw[id]=!SIMH.sw[id];hsSay(SIMH.sw[id]?`El detector de ${rn} ve a alguien: enciende la luz automáticamente.`:`El detector de ${rn} ya no detecta presencia: apaga la luz tras el temporizador.`)}
  else if(k==='timbre'){SIMH.ring[id]=SIMH.t;hsSay('Pulsas el timbre: suena el zumbador (ding-dong). El pulsador cierra un circuito de poca potencia.');try{const A=window.AudioContext||window.webkitAudioContext,c=new A(),o=c.createOscillator(),g=c.createGain();o.frequency.value=880;o.connect(g);g.connect(c.destination);g.gain.setValueAtTime(0.15,c.currentTime);g.gain.exponentialRampToValueAtTime(0.001,c.currentTime+0.6);o.start();o.stop(c.currentTime+0.6)}catch(e){}}
  else if(PLUGGABLE.includes(k)){const cur=SIMH.plug[id]||'';const nx=PLUGKEYS[(PLUGKEYS.indexOf(cur)+1)%PLUGKEYS.length];SIMH.plug[id]=nx;const p=PLUGS[nx];
    hsSay(p.kw?`Enchufas «${p.n}» (${p.kw} kW) en una toma de ${rn}. Añade ${amps(p.kw)} A al circuito ${code} (máx. ${In} A).`+(hsLive(code)?'':' Pero el circuito está sin tensión.'):'Desenchufas el aparato: el consumo vuelve a bajar.')}
  else if(RUNNABLE.includes(k)){SIMH.run[id]=!SIMH.run[id];const kw=itemKw(it);hsSay(`${d.n} ${SIMH.run[id]?'conectado':'apagado'}${SIMH.run[id]&&kw?`: consume ${f1(kw)} kW = ${amps(kw)} A en ${code} (máx. ${In} A)`:''}.`+(SIMH.run[id]&&!hsLive(code)?' Pero el circuito está sin tensión.':''))}
  else if(d.ud||k==='gas_cocina'||k==='gas_calentador'){SIMH.run[id]=!SIMH.run[id];
    if(d.ud){const hotOk=hsHotOk(m);hsSay(`${d.n} ${SIMH.run[id]?'abierto':'cerrado'}${SIMH.run[id]?`: caudal ${d.ud} L/s. `+(d.hot?(hotOk?'Sale agua caliente: el termo/caldera está funcionando.':'El agua sale FRÍA: no hay termo o caldera en marcha. Enciende el termo.'):'Agua fría.'):'.'}`,SIMH.run[id]&&d.hot&&!hotOk?'err':'')}
    else{const r=roomAt(m.h,it.x,it.y),vent=m.h.items.some(i=>i.k==='gas_rejilla'&&roomAt(m.h,i.x,i.y)===r),has=m.h.items.some(i=>i.k==='gas_cont');hsSay(`${d.n} ${SIMH.run[id]?'encendido':'apagado'}.`+(SIMH.run[id]?(!has?' ⚠ No hay llave/contador de gas: sin suministro.':vent?` Consume ${d.kwg} kW de gas. Hay rejilla de ventilación: correcto.`:' ⚠ NO hay rejilla de ventilación en la estancia: riesgo de monóxido de carbono.'):''),SIMH.run[id]&&(!has||!vent)?'err':'')}}
  else if(k==='cuadro'){hsSay('Cuadro general: usa el panel de protecciones para abrir, cerrar o rearmar los aparatos.')}
  else hsSay(`${d.n}: elemento sin función en la simulación.`)}
function hsHotOk(m){return m.h.items.some(i=>{if(!SIMH.run[i.id])return false;if(i.k==='termo'||i.k==='aerot')return hsLive(itemCode(m,i));if(i.k==='caldera')return m.h.items.some(g=>g.k==='gas_cont');return i.k==='gas_calentador'})}
function hsBrk(k){if(SIMH.trip[k]){SIMH.trip[k]=false;SIMH.heat[k.replace('b_','')]=0;if(k==='iga')SIMH.heat.iga=0;hsSay('Rearmas '+hsName(k)+'.'+(hsStillFault(k)?' ⚠ El fallo sigue presente: vuelve a saltar.':''))}else{SIMH.off[k]=!SIMH.off[k];hsSay(hsName(k)+(SIMH.off[k]?' abierto: se corta la corriente aguas abajo.':' cerrado.'))}}
function hsStillFault(k){return k.startsWith('b_')&&SIMH.short[k.slice(2)]||k.startsWith('d_')&&Object.keys(SIMH.leak).some(c=>SIMH.leak[c]&&SIMH.m.gOf[c]&&'d_'+SIMH.m.gOf[c].id===k)}
function hsName(k){if(k==='iga')return 'el interruptor general (IGA)';if(k.startsWith('b_'))return 'el magnetotérmico '+k.slice(2);const g=SIMH.m.groups.find(x=>'d_'+x.id===k);return g?'el diferencial «'+g.label+'»':k}
function hsFault(kind){const m=SIMH.m,it=m&&m.h.items.find(i=>i.id===SIMH.sel);if(!it)return alert('Selecciona primero un elemento del plano (una toma, una luz o un aparato).');const code=itemCode(m,it);if(!code)return alert('Ese elemento no está en un circuito eléctrico. Elige una toma o un aparato.');
  SIMH.ex=null;if(kind==='short'){SIMH.short[code]=true;hsSay(`⚡ Provocas un cortocircuito en ${HI[it.k].n.toLowerCase()} (circuito ${code}).`,'err')}
  else{SIMH.leak[code]=0.1;hsSay(`⚡ Provocas una fuga a tierra de 100 mA en ${HI[it.k].n.toLowerCase()} (circuito ${code}).`,'err')}}
function hsClearFaults(){SIMH.short={};SIMH.leak={};SIMH.warned={};hsSay('Fallos eliminados. Rearma las protecciones disparadas.')}
function hsReset(){hsInit(true);hsRefresh(true)}
function hsExample(n){const m=SIMH.m;hsInit(true);const M=SIMH.m;const h=M.h,find=(k,room)=>h.items.filter(i=>i.k===k&&(!room||roomAt(h,i.x,i.y)===room));
  const room=t=>h.rooms.find(r=>r.type===t),steps=[];
  const done=(t,s)=>{SIMH.ex={t,s}};
  if(n==='luz'){const sw=h.items.find(i=>i.k==='interruptor'&&roomAt(h,i.x,i.y)&&roomAt(h,i.x,i.y).type==='salon')||h.items.find(i=>i.k==='interruptor');if(!sw)return alert('Coloca un interruptor y una luz en el plano.');
    SIMH.sel=sw.id;hsClick(sw.id);done('Encender la luz del salón',['1. Pulsas el interruptor: cierra el circuito.','2. La corriente sale del cuadro por el magnetotérmico C1 (10 A), pasa por el cable del techo y llega al punto de luz.','3. Se enciende la luz y el cuadro muestra el consumo de C1 (0,1 kW ≈ 0,4 A).','Prueba: pulsa otra vez el interruptor y la luz se apaga.'])}
  else if(n==='sobrecarga'){const r=room('salon')||h.rooms[0],ts=find('toma',r).slice(0,3);if(ts.length<3)return alert('Necesitas 3 tomas en el salón. Usa «Equipar según normativa».');
    ['mic','her','cal'].forEach((p,i)=>SIMH.plug[ts[i].id]=p);SIMH.sel=ts[0].id;SIMH.speed=5;hsSay('Enchufas microondas, hervidor y calefactor en tomas del mismo circuito (C2).');
    done('Sobrecargar los enchufes',['1. Enchufas microondas (1,2 kW), hervidor (2,2 kW) y calefactor (2 kW) en el mismo circuito C2.','2. Suman 5,4 kW = 23 A, y el circuito C2 solo admite 16 A.','3. El bimetal del magnetotérmico se calienta (mira la barra de carga) y, pasados unos segundos, salta C2.','4. Solo se apagan las tomas de C2; el resto de la casa sigue con luz.','Para arreglarlo: rearma C2 y desenchufa algún aparato.'])}
  else if(n==='corto'){const t=find('toma').find(i=>m.codeOf[i.id]==='C2')||find('toma')[0];if(!t)return alert('Coloca una toma en el plano.');SIMH.sel=t.id;SIMH.plug[t.id]='her';hsFault('short');
    done('Cortocircuito en una toma',['1. Se unen fase y neutro en la toma: la corriente se dispara a miles de amperios.','2. El magnetotérmico de C2 detecta el pico (disparo magnético) y salta en milésimas de segundo.','3. Solo se queda sin tensión el circuito C2: es una protección SELECTIVA.','Si lo rearmas con el fallo presente, vuelve a saltar. Quita el fallo primero.'])}
  else if(n==='fuga'){const r=room('bano')||room('cocina'),t=(r?find('toma_bano',r).concat(find('toma',r)):find('toma'))[0]||find('toma')[0];if(!t)return alert('Coloca una toma en el plano.');SIMH.sel=t.id;hsFault('earth');
    done('Fuga a tierra en el baño',['1. Una corriente de 100 mA se escapa a tierra por una persona o un aparato defectuoso.','2. El diferencial de 30 mA detecta la diferencia entre la corriente que entra y la que sale.','3. Salta el diferencial y se corta TODO lo que cuelga de él (mira qué circuitos se apagan).','Esto es lo que evita la electrocución: un magnetotérmico solo no detecta esta fuga.'])}
  else if(n==='agua'){const f=h.items.find(i=>i.k==='ducha')||h.items.find(i=>i.k==='lavabo');if(!f)return alert('Coloca una ducha o un lavabo.');SIMH.sel=f.id;hsClick(f.id);
    done('Ducha con el termo apagado',['1. Abres el grifo: el agua circula por la tubería azul desde la llave general.','2. La ducha pide agua caliente, pero el termo está apagado.','3. El agua sale FRÍA. Pulsa el termo (y asegúrate de que C4 tiene tensión) y repite: saldrá caliente.','El panel muestra el caudal y la velocidad del agua en la tubería principal.'])}
  else if(n==='gas'){const c=h.items.find(i=>i.k==='gas_cocina');if(!c)return alert('Esta casa no tiene cocina de gas. Usa la plantilla «Piso con climatización y gas».');SIMH.sel=c.id;hsClick(c.id);
    done('Encender la cocina de gas',['1. Abres el gas: la llama aparece en la cocina.','2. El sistema comprueba la rejilla de ventilación de la estancia: si falta, avisa de riesgo de monóxido de carbono.','3. El consumo de gas se suma a la potencia de la instalación (mira la tubería naranja).','Prueba: borra la rejilla en modo edición y repite el ejemplo.'])}
  hsRefresh(true)}
// ---------- panel ----------
function hsStatus(m){const s=[];const lit=m.h.items.filter(i=>(i.k==='luz'||i.k==='foco')&&lightOn(m,i)&&hsLive(itemCode(m,i)||'C1')).length;s.push(`Luces encendidas: <b>${lit}</b>`);
  const pl=Object.keys(SIMH.plug).filter(k=>SIMH.plug[k]).length,rn=Object.keys(SIMH.run).filter(k=>SIMH.run[k]).length;s.push(`Aparatos enchufados: <b>${pl}</b> · en marcha: <b>${rn}</b>`);
  const open=m.h.items.filter(i=>HI[i.k].ud&&SIMH.run[i.id]),Q=open.reduce((a,i)=>a+HI[i.k].ud,0);if(open.length){const e=m.H.cold&&m.H.cold.edges[0],dn=e?e.dn:16,v=4*(Q/1000)/(Math.PI*Math.pow(dn*0.8/1000,2));s.push(`Agua: <b>${Q.toFixed(2)} L/s</b> por tubería Ø${dn} mm → ${v.toFixed(1)} m/s`)}
  const g=m.h.items.filter(i=>HI[i.k].kwg&&SIMH.run[i.id]).reduce((a,i)=>a+HI[i.k].kwg,0);if(g)s.push(`Gas: <b>${g} kW</b> en uso`);
  const tot=Object.values(SIMH.cur.I).reduce((a,b)=>a+b,0);s.push(`Consumo total: <b>${f1(tot)} A</b> (${f1(tot*0.23)} kW) de ${m.igaIn} A del IGA`);return s}
function brkRow(k,label,I,In,heat,extra){const tr=SIMH.trip[k],off=SIMH.off[k],cls=tr?'trip':off?'off':'on',pct=In?Math.min(100,I/In*100):0,col=pct>100?'#c62828':pct>80?'#e08a00':'#2e7d32';
  return`<div onpointerdown="hsBrk('${k}')" style="display:flex;align-items:center;gap:6px;padding:4px 6px;margin:2px 0;border:1px solid var(--bd);border-radius:6px;cursor:pointer;background:${tr?'#fde8e8':off?'#eee':'#fff'}${extra||''}"><span style="width:34px;height:18px;border-radius:9px;background:${tr?'#c62828':off?'#999':'#2e7d32'};position:relative;flex:none"><span style="position:absolute;top:2px;${tr?'left:10px':off?'left:2px':'left:18px'};width:14px;height:14px;border-radius:7px;background:#fff"></span></span><span style="flex:1;font-size:12.5px">${label}${tr?' <b style="color:#c62828">DISPARADO</b>':''}</span><span style="width:70px"><span style="display:block;height:6px;background:#e5e8eb;border-radius:3px"><span style="display:block;height:6px;width:${pct}%;background:${col};border-radius:3px"></span></span><small style="font-size:10.5px;color:var(--mu)">${In?f1(I)+'/'+In+' A':''}</small></span></div>`}
function hsPanel(){const m=SIMH.m;if(!m)return'';const I=SIMH.cur.I,tot=Object.values(I).reduce((a,b)=>a+b,0);
  const rows=brkRow('iga','Interruptor general (IGA)',tot,m.igaIn)+m.groups.map(g=>(g.diff?brkRow('d_'+g.id,'↳ '+esc(g.label)+' · 30 mA',0,0,0,';margin-left:8px'):'')+g.codes.map(c=>brkRow('b_'+c,`<b style="color:${hexs(CIRCCOL[c])}">${c}</b> ${esc(m.H.circ[c].def.n)}`,I[c]||0,m.H.circ[c].def.In,0,';margin-left:'+(g.diff?22:8)+'px')).join('')).join('');
  const exs=[['luz','Encender una luz'],['sobrecarga','Sobrecargar enchufes'],['corto','Cortocircuito'],['fuga','Fuga a tierra'],['agua','Ducha con termo apagado'],['gas','Cocina de gas']].map(([k,l])=>`<button class="b s" onpointerdown="hsExample('${k}')">${l}</button>`).join('');
  const sel=SIMH.sel&&m.h.items.find(i=>i.id===SIMH.sel),rm=hsRoom();
  const ex2=[['conmutada','Luz desde 2 puntos'],['cruce','Luz desde 3 puntos'],['regulador','Regulador'],['pulsador','Pulsadores'],['detector','Detector'],['timbre','Timbre'],['quitar','Quitar interruptor']].map(([k,l])=>`<button class="b s" onpointerdown="hsExample2('${k}')">${l}</button>`).join('');
  const edit=`<div style="font-weight:600;margin:10px 0 4px">Poner o quitar mecanismos</div><div class="bar"><label style="margin:0">Estancia</label><select onchange="SIMH.room=this.value;hsRefresh(true)">${m.h.rooms.map(r=>`<option value="${r.id}" ${rm&&rm.id===r.id?'selected':''}>${esc(r.name||RT[r.type])}</option>`).join('')}</select></div>
   <div class="bar" style="gap:4px">${ADDABLE.map(([k,l])=>`<button class="b s" onpointerdown="hsAdd('${k}')">+ ${l}</button>`).join('')}</div>
   <div class="bar"><button class="b d" onpointerdown="hsDel()">🗑 Quitar el seleccionado${sel?' ('+esc(SHORT[sel.k]||HI[sel.k].n)+')':''}</button><button class="b ${SIMH.delMode?'':'s'}" onpointerdown="SIMH.delMode=!SIMH.delMode;hsRefresh(true)">Modo quitar: ${SIMH.delMode?'SÍ (toca un mecanismo)':'no'}</button></div>
   <p class="muted" style="font-size:12px;margin:2px 0">${rm?esc(ctrlText(m,rm)):''}</p>`;
  return`<div class="card" id="hs-panel-in"><h3>Simulación de la casa</h3>
   <div class="bar"><button class="b ${SIMH.main?'':'d'}" onpointerdown="SIMH.main=!SIMH.main;hsSay('Acometida '+(SIMH.main?'conectada.':'cortada: toda la casa sin tensión.'));hsRefresh(true)">Red: ${SIMH.main?'CONECTADA':'CORTADA'}</button><button class="b s" onpointerdown="hsReset()">Reiniciar</button>
   <select onchange="SIMH.speed=num(this.value,5)"><option value="1" ${SIMH.speed===1?'selected':''}>×1</option><option value="5" ${SIMH.speed===5?'selected':''}>×5</option><option value="20" ${SIMH.speed===20?'selected':''}>×20</option></select></div>
   <p class="muted" style="font-size:12px;margin:4px 0">Pulsa en el plano: interruptores (luz), tomas (enchufa aparatos), aparatos, grifos y cocina de gas.</p>
   <div style="font-weight:600;margin:6px 0 4px">Ejemplos de funcionamiento</div><div class="bar" style="gap:4px">${exs}</div><div class="bar" style="gap:4px">${ex2}</div>
   ${SIMH.ex?`<div class="chk info" style="margin-top:6px"><b>${SIMH.ex.t}</b>${SIMH.ex.s.map(x=>`<div>${esc(x)}</div>`).join('')}</div>`:''}
   ${edit}
   <div style="font-weight:600;margin:10px 0 4px">Cuadro eléctrico (pulsa para abrir / rearmar)</div>${rows}
   <div style="font-weight:600;margin:10px 0 4px">Estado</div>${hsStatus(m).map(x=>`<div style="font-size:12.5px">${x}</div>`).join('')}
   <div style="font-weight:600;margin:10px 0 4px">Provocar un fallo ${sel?'en «'+esc(HI[sel.k].n)+'»':''}</div>
   <div class="bar"><button class="b d" onpointerdown="hsFault('short');hsRefresh(true)">Cortocircuito</button><button class="b" style="background:#6a1b9a" onpointerdown="hsFault('leak');hsRefresh(true)">Fuga a tierra</button><button class="b s" onpointerdown="hsClearFaults();hsRefresh(true)">Quitar fallos</button></div>
   <div style="font-weight:600;margin:10px 0 4px">Registro</div><div style="max-height:180px;overflow:auto">${SIMH.log.map(l=>`<div class="chk ${l.lv||'info'}" style="font-size:12px">${esc(l.txt)}</div>`).join('')}</div></div>`}
let hsTimer=null;
function hsStart(){if(hsTimer)return;hsTimer=setInterval(()=>{if(!SIMH.m)return;const vis=document.getElementById('hs-panel')||(document.getElementById('cs-svg'));if(!vis)return;
  const ch=hsTick(0.1),sig=JSON.stringify([SIMH.main,SIMH.trip,SIMH.off,SIMH.run,SIMH.plug,SIMH.sw,SIMH.short,SIMH.leak,Object.values(SIMH.heat).map(x=>Math.round(x*10)),Object.values(SIMH.cur.I).map(x=>Math.round(x*10)),SIMH.log.length,SIMH.sel]);
  if(sig!==SIMH.sig||ch){SIMH.sig=sig;hsRefresh()}},120)}
function hsRefresh(force){const p=document.getElementById('hs-panel');if(p)p.innerHTML=hsPanel();if(document.getElementById('cs-svg')&&typeof casaDraw==='function'&&CS.sim)casaDraw();if(force)SIMH.sig=''}

// ---------- poner y quitar mecanismos ----------
const ADDABLE=[['interruptor','Interruptor'],['conmutador','Conmutador'],['cruzamiento','Cruce'],['pulsador','Pulsador'],['regulador','Regulador'],['detector','Detector'],['timbre','Timbre'],['toma','Enchufe'],['luz','Luz'],['foco','Foco']];
function hsRoom(){const m=SIMH.m;let r=SIMH.room&&m.h.rooms.find(x=>x.id===SIMH.room);if(!r){const sel=SIMH.sel&&m.h.items.find(i=>i.id===SIMH.sel);r=sel?roomAt(m.h,sel.x,sel.y):null}return r||m.h.rooms.find(x=>x.type==='salon')||m.h.rooms[0]}
function freeSpot(h,r,k){const ceil=['luz','foco','detector'].includes(k),cand=[];
  if(ceil){for(let a=1;a<=3;a++)for(let b=1;b<=3;b++)cand.push({x:r.x+r.w*a/4,y:r.y+r.h*b/4})}else for(let i=0;i<36;i++)cand.push(perimPt(r,i,36));
  let best=null;cand.forEach(p=>{const d=Math.min(999,...h.items.filter(x=>roomAt(h,x.x,x.y)===r).map(x=>hdist(x,p)));if(!best||d>best.d)best={d,p}});return{x:Math.round(best.p.x),y:Math.round(best.p.y)}}
function hsAfterEdit(){const keep={sel:SIMH.sel,room:SIMH.room};SIMH.m=hsMap();if(typeof casaCalc==='function')casaCalc();try{save();if(typeof snap==='function')snap()}catch(e){}
  if(window.M3D&&M3D.R&&M3D.view==='casa')M3D.refreshCasa();hsRefresh(true)}
function hsAdd(k){const m=SIMH.m,r=hsRoom();if(!r)return alert('Dibuja una estancia primero.');const p=freeSpot(m.h,r,k),it={id:uid(),k,x:p.x,y:p.y};m.h.items.push(it);SIMH.sel=it.id;SIMH.room=r.id;hsAfterEdit();
  const sw=roomSwitches(SIMH.m,r).length;hsSay(`➕ Pones un ${HI[k].n.toLowerCase()} en ${r.name||RT[r.type]}. `+(CTRL.includes(k)?ctrlText(SIMH.m,r)+' Pruébalo.':k==='toma'?'Enchufa un aparato para ver el consumo.':k==='timbre'?'Púlsalo para que suene.':'Se conecta al circuito correspondiente.'))}
function hsDelId(id){const m=SIMH.m,i=m.h.items.findIndex(x=>x.id===id);if(i<0)return;const it=m.h.items[i];if(HI[it.k].unique&&it.k==='cuadro')return alert('El cuadro no se puede quitar en la demostración.');const r=roomAt(m.h,it.x,it.y);m.h.items.splice(i,1);delete SIMH.sw[id];delete SIMH.plug[id];delete SIMH.run[id];if(SIMH.sel===id)SIMH.sel=null;hsAfterEdit();
  hsSay(`➖ Quitas ${HI[it.k].n.toLowerCase()}${r?' de '+(r.name||RT[r.type]):''}. `+(CTRL.includes(it.k)&&r?ctrlText(SIMH.m,r):''),CTRL.includes(it.k)&&r&&!roomSwitches(SIMH.m,r).length&&m.h.items.some(x=>x.k==='luz'&&roomAt(m.h,x.x,x.y)===r)?'err':'')}
function hsDel(){if(!SIMH.sel)return alert('Selecciona primero un mecanismo del plano.');hsDelId(SIMH.sel)}
function hsClearCtrl(r){const m=SIMH.m;m.h.items=m.h.items.filter(i=>!(CTRL.includes(i.k)&&roomAt(m.h,i.x,i.y)===r));}
function hsSetup(room,kinds){const m=SIMH.m,r=room;hsClearCtrl(r);kinds.forEach(k=>{const p=freeSpot(m.h,r,k),it={id:uid(),k,x:p.x,y:p.y};m.h.items.push(it)});SIMH.room=r.id;hsAfterEdit();return roomSwitches(SIMH.m,r)}
function hsExample2(n){hsInit(true);const m=SIMH.m,h=m.h,withLight=h.rooms.filter(r=>h.items.some(i=>i.k==='luz'&&roomAt(h,i.x,i.y)===r));
  const pick=t=>withLight.find(r=>r.type===t)||withLight[0];if(!withLight.length)return alert('Coloca antes una luz en alguna estancia.');
  const note='(El plano se ha modificado: usa ↶ Deshacer para volver al original.)';let r,sw;
  if(n==='conmutada'){r=pick('salon');sw=hsSetup(r,['conmutador','conmutador']);SIMH.sel=sw[0].id;SIMH.ex={t:'Luz conmutada desde dos puntos',s:[`1. Quitamos el interruptor de ${r.name} y ponemos dos conmutadores en lados opuestos.`,'2. Pulsa uno: se enciende. Pulsa el otro: se apaga. Cada conmutador invierte el estado, así que se puede encender en una puerta y apagar en la otra.','3. Por el cable van fase y dos "viajeros" entre los conmutadores.',note]}}
  else if(n==='cruce'){r=pick('pasillo');sw=hsSetup(r,['conmutador','cruzamiento','conmutador']);SIMH.sel=sw[0].id;SIMH.ex={t:'Luz desde tres puntos (conmutador + cruce + conmutador)',s:[`1. En ${r.name} hay un conmutador en cada extremo y un conmutador de cruce en medio.`,'2. Pulsa cualquiera de los tres: la luz cambia siempre. El cruce permite añadir tantos puntos como quieras.','3. Puedes añadir más cruces con «Poner o quitar mecanismos».',note]}}
  else if(n==='regulador'){r=pick('salon');sw=hsSetup(r,['regulador']);SIMH.sel=sw[0].id;SIMH.ex={t:'Regulador de luz (dimmer)',s:[`1. Sustituimos el interruptor de ${r.name} por un regulador.`,'2. Cada pulsación sube el nivel: 30 %, 60 %, 100 % y apagado.','3. Mira cómo baja la intensidad de la luz y el consumo del circuito C1.',note]}}
  else if(n==='pulsador'){r=pick('pasillo');sw=hsSetup(r,['pulsador','pulsador']);SIMH.sel=sw[0].id;SIMH.ex={t:'Pulsadores con telerruptor',s:[`1. En ${r.name} hay dos pulsadores. Un telerruptor en el cuadro memoriza cada pulso.`,'2. Cualquier pulsador enciende o apaga la luz; sirve para pasillos o escaleras con muchos puntos.','3. El pulsador solo maneja corriente mínima; la potencia pasa por el telerruptor.',note]}}
  else if(n==='detector'){r=pick('pasillo');sw=hsSetup(r,['detector']);SIMH.sel=sw[0].id;SIMH.ex={t:'Detector de presencia',s:[`1. En ${r.name} un detector sustituye al interruptor.`,'2. Púlsalo para simular que entra alguien: la luz se enciende sola; púlsalo otra vez y se apaga.','3. Ahorra energía en pasillos, garajes y aseos.',note]}}
  else if(n==='quitar'){r=pick('salon');hsClearCtrl(r);hsAfterEdit();hsSay(ctrlText(SIMH.m,r),'err');SIMH.ex={t:'Quitar el interruptor',s:[`1. Hemos quitado todos los mecanismos de maniobra de ${r.name}.`,'2. Sin interruptor, la luz queda SIEMPRE encendida: no hay forma de apagarla.','3. Pon un mecanismo con «Poner o quitar mecanismos» y vuelve a probar.',note]}}
  else if(n==='timbre'){const v=h.rooms.find(x=>x.type==='vestibulo')||h.rooms[0];SIMH.room=v.id;hsAdd('timbre');SIMH.ex={t:'Timbre',s:['1. Hemos puesto un pulsador de timbre en la entrada.','2. Púlsalo: suena el zumbador y se anima la campana en el plano.','3. En la realidad el timbre va por un transformador de 12 V en el cuadro.',note]}}
  hsRefresh(true)}

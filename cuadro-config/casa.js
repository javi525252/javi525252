'use strict';
/* Casa completa: plano 2D, elementos de todas las instalaciones, rutas, validación y generación del cuadro */
const HCAT={ele:{n:'Eléctrica',c:'#f9a825'},tel:{n:'Telecom y domótica',c:'#00acc1'},cli:{n:'Climatización y ACS',c:'#e53935'},agu:{n:'Fontanería',c:'#1e88e5'},gas:{n:'Gas',c:'#fb8c00'}};
const RT={salon:'Salón / comedor',dormitorio:'Dormitorio',cocina:'Cocina',bano:'Baño / aseo',pasillo:'Pasillo',vestibulo:'Vestíbulo / entrada',terraza:'Terraza / exterior',garaje:'Garaje',trastero:'Trastero',lavadero:'Lavadero',otro:'Otra estancia'};
const RCOL={salon:'#fff3d6',dormitorio:'#e3f0ff',cocina:'#ffe5d9',bano:'#d9f4f1',pasillo:'#f0f0f0',vestibulo:'#f3e8ff',terraza:'#e6f4d9',garaje:'#e2e2e2',trastero:'#ece3d3',lavadero:'#d9ecf4',otro:'#f5f5f5'};
// kw: potencia eléctrica; ud: caudal de agua (L/s); dn: diámetro mínimo; kwg: potencia de gas; pw: necesita alimentación 230 V; hz: altura de montaje (cm)
const HI={
  luz:{cat:'ele',n:'Punto de luz',ab:'L',kw:0.1,circ:'C1',hz:250,pr:4.5},foco:{cat:'ele',n:'Foco empotrado',ab:'F',kw:0.02,circ:'C1',hz:250,pr:6},
  interruptor:{cat:'ele',n:'Interruptor',ab:'I',hz:110,pr:5,sw:1},conmutador:{cat:'ele',n:'Conmutador',ab:'Cm',hz:110,pr:6.5,sw:1},
  cruzamiento:{cat:'ele',n:'Conmutador de cruce',ab:'Cx',hz:110,pr:9,sw:1},pulsador:{cat:'ele',n:'Pulsador (telerruptor)',ab:'P',hz:110,pr:7,sw:1},
  regulador:{cat:'ele',n:'Regulador de luz (dimmer)',ab:'RG',hz:110,pr:28,sw:1},detector:{cat:'ele',n:'Detector de presencia',ab:'DP',hz:230,pr:32,sw:1},timbre:{cat:'ele',n:'Pulsador de timbre',ab:'TB',hz:130,pr:12},
  toma:{cat:'ele',n:'Toma 16 A uso general',ab:'T',circ:'C2',hz:30,pr:6.5},toma_ext:{cat:'ele',n:'Toma exterior',ab:'TE',circ:'C2',hz:40,pr:14},
  toma_bano:{cat:'ele',n:'Toma de baño',ab:'TB',circ:'C5',hz:110,pr:8},toma_enc:{cat:'ele',n:'Toma encimera cocina',ab:'TC',circ:'C5',hz:110,pr:8},
  toma_horno:{cat:'ele',n:'Toma cocina/horno 25 A',ab:'TH',kw:4.5,circ:'C3',hz:60,pr:14},toma_lav:{cat:'ele',n:'Toma lavadora',ab:'TL',kw:2.2,circ:'C4',hz:100,pr:8},
  toma_lvj:{cat:'ele',n:'Toma lavavajillas',ab:'TV',kw:2,circ:'C4',hz:30,pr:8},toma_sec:{cat:'ele',n:'Toma secadora',ab:'TS',kw:2.5,circ:'C10',hz:100,pr:8},
  extractor:{cat:'ele',n:'Extractor',ab:'EX',kw:0.03,circ:'C1',hz:230,pr:38},cuadro:{cat:'ele',n:'Cuadro general',ab:'CG',hz:150,pr:0,unique:true},
  tv:{cat:'tel',n:'Toma TV/antena',ab:'TV',hz:30,pr:8},rj45:{cat:'tel',n:'Toma de datos RJ45',ab:'RJ',hz:30,pr:11,net:1},router:{cat:'tel',n:'Router / registro de datos',ab:'RT',hz:150,pr:60,pw:1,net:1,unique:true},
  ap:{cat:'tel',n:'Punto WiFi',ab:'WF',hz:230,pr:70,pw:1,net:1},videop:{cat:'tel',n:'Videoportero',ab:'VP',hz:140,pr:190,pw:1},alarma:{cat:'tel',n:'Central de alarma',ab:'AL',hz:150,pr:240,pw:1},
  sensor:{cat:'tel',n:'Sensor / detector',ab:'SN',hz:220,pr:35},camara:{cat:'tel',n:'Cámara IP',ab:'CM',hz:230,pr:90,pw:1,net:1},dom:{cat:'tel',n:'Central domótica',ab:'DM',hz:150,pr:180,pw:1,dom:1},
  split_i:{cat:'cli',n:'Split interior (A/A)',ab:'AC',kw:0.9,circ:'C9',hz:200,pr:520},split_e:{cat:'cli',n:'Unidad exterior (A/A)',ab:'UE',hz:50,pr:380,ext:1},
  radiador:{cat:'cli',n:'Radiador eléctrico',ab:'RE',kw:1.5,circ:'C8',hz:40,pr:120},suelo:{cat:'cli',n:'Suelo radiante eléctrico',ab:'SR',circ:'C8',hz:0,pr:0,zone:1},
  termostato:{cat:'cli',n:'Termostato',ab:'TT',hz:150,pr:55},termo:{cat:'cli',n:'Termo eléctrico (ACS)',ab:'TM',kw:1.5,circ:'C4',hz:180,pr:210,ud:0.15,dn:12,hot:0,heater:1,l:80},
  aerot:{cat:'cli',n:'Aerotermia',ab:'AT',kw:2.5,circ:'C8',hz:60,pr:4200,ext:1,heater:1,ud:0.15,dn:16},caldera:{cat:'cli',n:'Caldera de gas',ab:'CA',pr:1500,heater:1,kwg:24,pw:1,ud:0.2,dn:16,hz:150},
  solar:{cat:'cli',n:'Panel solar térmico',ab:'ST',pr:700,ext:1},deposito:{cat:'cli',n:'Depósito / acumulador ACS',ab:'DP',pr:900,heater:1,l:200},rad_agua:{cat:'cli',n:'Radiador de agua',ab:'RA',pr:95,hz:40},
  llave:{cat:'agu',n:'Llave de paso general',ab:'LL',pr:14,unique:true,hz:60},cont_agua:{cat:'agu',n:'Contador de agua',ab:'CW',pr:45,unique:true,hz:60},
  lavabo:{cat:'agu',n:'Lavabo',ab:'LV',pr:120,ud:0.1,dn:12,hot:1,hz:80},ducha:{cat:'agu',n:'Ducha',ab:'DU',pr:160,ud:0.2,dn:12,hot:1,hz:100,wet:1},
  banera:{cat:'agu',n:'Bañera',ab:'BÑ',pr:240,ud:0.3,dn:20,hot:1,hz:50,wet:1},inodoro:{cat:'agu',n:'Inodoro',ab:'WC',pr:130,ud:0.1,dn:12,hz:30},
  bide:{cat:'agu',n:'Bidé',ab:'BD',pr:100,ud:0.1,dn:12,hot:1,hz:40},fregadero:{cat:'agu',n:'Fregadero',ab:'FR',pr:150,ud:0.2,dn:12,hot:1,hz:90},
  lav_agua:{cat:'agu',n:'Toma de agua lavadora',ab:'AL',pr:18,ud:0.2,dn:12,hz:90},lvj_agua:{cat:'agu',n:'Toma de agua lavavajillas',ab:'AV',pr:15,ud:0.15,dn:12,hz:40},
  grifo_ext:{cat:'agu',n:'Grifo exterior',ab:'GE',pr:12,ud:0.15,dn:12,hz:60,ext:1},
  gas_cont:{cat:'gas',n:'Contador / llave de abonado',ab:'GC',pr:90,unique:true,hz:120},gas_cocina:{cat:'gas',n:'Cocina de gas',ab:'CG',pr:280,kwg:8,hz:80},
  gas_calentador:{cat:'gas',n:'Calentador de gas',ab:'GA',pr:420,kwg:20,hz:150,heater:1,ud:0.2,dn:12},gas_rejilla:{cat:'gas',n:'Rejilla de ventilación',ab:'RV',pr:12,hz:20},gas_humos:{cat:'gas',n:'Salida de humos',ab:'SH',pr:60,hz:200}
};
const CIRC={
  C1:{n:'Alumbrado',lt:'alumbrado',In:10,sec:1.5,maxPts:30,max:1.8,extra:'C6'},C2:{n:'Tomas generales y frigorífico',lt:'tomas',In:16,sec:2.5,maxPts:20,max:2.9,extra:'C7'},
  C3:{n:'Cocina y horno',lt:'cocina',In:25,sec:6,maxPts:1,max:4.6},C4:{n:'Lavadora, lavavajillas y termo',lt:'lavadora',In:20,sec:4,maxPts:3,max:3.7},
  C5:{n:'Baño y auxiliares de cocina',lt:'tomas',In:16,sec:2.5,maxPts:6,max:2.9,extra:'C12'},C6:{n:'Alumbrado adicional',lt:'alumbrado',In:10,sec:1.5,maxPts:30,max:1.8},
  C7:{n:'Tomas adicionales',lt:'tomas',In:16,sec:2.5,maxPts:20,max:2.9},C8:{n:'Calefacción eléctrica',lt:'calefaccion',In:25,sec:6,max:4.6},
  C9:{n:'Aire acondicionado',lt:'aire',In:25,sec:6,max:4.6},C10:{n:'Secadora',lt:'lavadora',In:16,sec:2.5,max:2.9},C11:{n:'Automatización',lt:'tomas',In:10,sec:1.5,max:1.5},
  C12:{n:'Baño y cocina adicional',lt:'tomas',In:16,sec:2.5,maxPts:6,max:2.9}};
const CIRCCOL={C1:0xf9a825,C2:0x1565c0,C3:0xd84315,C4:0x6a1b9a,C5:0x00838f,C6:0xfbc02d,C7:0x42a5f5,C8:0xe53935,C9:0x26a69a,C10:0x8e24aa,C11:0x558b2f,C12:0x00acc1};
const NOM=[12,16,20,25,32,40,50],ISOL={salon:1};
function newHouse(){return{w:1000,h:800,persons:3,rooms:[],items:[]}}
const HS=()=>{const p=P();if(!p.house)p.house=newHouse();return p.house};
const roomAt=(h,x,y)=>h.rooms.find(r=>x>=r.x&&x<=r.x+r.w&&y>=r.y&&y<=r.y+r.h)||null;
const hdist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y),manh=(a,b)=>Math.abs(a.x-b.x)+Math.abs(a.y-b.y);
const itemKw=it=>{const d=HI[it.k]||{};if(it.k==='suelo')return Math.round((it.w||200)*(it.d||150)/10000*0.1*100)/100;return it.kw!=null?it.kw:(d.kw||0)};
function chainFrom(start,pts){const left=pts.slice(),order=[];let cur={x:start.x,y:start.y},c=0;
  while(left.length){let bi=0,bd=1e12;left.forEach((p,i)=>{const d=manh(cur,p);if(d<bd){bd=d;bi=i}});const p=left.splice(bi,1)[0];c+=bd;order.push({p,a:{x:cur.x,y:cur.y},cm:bd,cum:c});cur=p}
  return{order,total:c}}
function prim(root,pts){const inT=[{x:root.x,y:root.y,idx:-1,cum:0}],edges=[],left=pts.map((p,i)=>({x:p.x,y:p.y,idx:i}));
  while(left.length){let best=null;left.forEach((p,li)=>inT.forEach((t,ti)=>{const d=manh(p,t);if(!best||d<best.d)best={d,li,ti}}));
    const p=left.splice(best.li,1)[0],t=inT[best.ti];edges.push({a:{x:t.x,y:t.y},b:{x:p.x,y:p.y},cm:best.d,to:p.idx,from:t.idx});inT.push({x:p.x,y:p.y,idx:p.idx,cum:t.cum+best.d})}
  return{edges,nodes:inT}}
function subtree(edges,val){const kids={};edges.forEach(e=>{(kids[e.from]=kids[e.from]||[]).push(e.to)});const memo={};
  const f=i=>{if(memo[i])return memo[i];let s=val(i),n=1;(kids[i]||[]).forEach(c=>{const r=f(c);s+=r.sum;n+=r.n});return memo[i]={sum:s,n}};edges.forEach(e=>f(e.to));return memo}
function pickDn(Q,min){for(const d of NOM){if(d<min)continue;const di=d*0.8,v=4*(Q/1000)/(Math.PI*Math.pow(di/1000,2));if(v<=1.5)return{dn:d,v}}return{dn:50,v:2}}
const gasDn=kw=>kw<=20?15:kw<=40?18:kw<=70?22:28;
function isElevated(h){const area=h.rooms.filter(r=>r.type!=='terraza').reduce((s,r)=>s+r.w*r.h/10000,0);
  return area>160||h.items.some(i=>['split_i','radiador','suelo','aerot','dom','toma_sec'].includes(i.k))}

// ---------- circuitos, rutas y dimensionado ----------
function houseCalc(h){
  const Wc=h.wmode==='manual'?wiringCalc(h):null;
  const cab=h.items.find(i=>i.k==='cuadro')||{x:30,y:30},R={circ:{},elec:[],tel:[],cold:null,hot:null,gas:null,pipes:[],area:0};
  R.area=h.rooms.filter(r=>r.type!=='terraza').reduce((s,r)=>s+r.w*r.h/10000,0);R.elev=isElevated(h);
  const used={};h.items.forEach(it=>{const d=HI[it.k];if(!d||!d.circ)return;const code=Wc?(Wc.code[it.id]||null):(it.circ||d.circ);if(!code||!CIRC[code])return;(used[code]=used[code]||[]).push(it)});
  // desbordamiento a circuitos adicionales
  Object.keys(CIRC).forEach(c=>{const def=CIRC[c];if(def.maxPts&&def.extra&&used[c]&&used[c].length>def.maxPts){const sorted=used[c].slice().sort((a,b)=>(a.x+a.y*3)-(b.x+b.y*3));used[c]=sorted.slice(0,def.maxPts);used[def.extra]=(used[def.extra]||[]).concat(sorted.slice(def.maxPts))}});
  if(h.items.some(i=>i.k==='dom'))used.C11=(used.C11||[]).concat(h.items.filter(i=>i.k==='dom'));
  Object.keys(used).sort((a,b)=>parseInt(a.slice(1))-parseInt(b.slice(1))).forEach(code=>{const def=CIRC[code],pts=used[code];
    let kw=pts.reduce((s,i)=>s+itemKw(i),0);const raw=kw;
    if(['tomas','alumbrado'].includes(def.lt)&&code!=='C11')kw=Math.min(def.max,['C1','C6'].includes(code)?pts.reduce((s,i)=>s+itemKw(i),0)+0.3:0.35*pts.length);
    else kw=Math.min(kw,def.max);
    // el cableado incluye los mecanismos de maniobra del circuito de alumbrado
    let wire=pts.slice();if(code==='C1'||code==='C6'){const rooms=new Set(pts.map(p=>(roomAt(h,p.x,p.y)||{}).id));h.items.filter(i=>HI[i.k]&&HI[i.k].sw&&rooms.has((roomAt(h,i.x,i.y)||{}).id)).forEach(i=>wire.push(i))}
    const ch=chainFrom(cab,wire);let drops=0;wire.forEach(i=>{drops+=Math.max(0,(250-((HI[i.k]||{}).hz||30)))});
    let totalCm=ch.total+drops,maxCm=ch.order.length?Math.max(...ch.order.map(o=>o.cum))+200:0;if(Wc){totalCm=(Wc.len[code]||0)+drops;maxCm=Math.max(0,...pts.map(i=>Wc.cum[i.id]||0))+200}
    R.circ[code]={code,def,items:pts,pts:pts.length,kw,raw,lenM:Math.round(maxCm/100*1.1*10)/10,totM:Math.round(totalCm/100*1.1*10)/10,order:ch.order,segs:ch.order.map(o=>({a:o.a,b:{x:o.p.x,y:o.p.y},it:o.p}))}});
  // telecomunicaciones: topología en estrella desde el router (o el cuadro)
  const router=h.items.find(i=>i.k==='router')||cab;
  h.items.filter(i=>HI[i.k]&&(HI[i.k].net||i.k==='tv')&&i.k!=='router').forEach(i=>{const cm=manh(router,i)+200+Math.max(0,250-HI[i.k].hz);R.tel.push({it:i,a:{x:router.x,y:router.y},cm,m:Math.round(cm/100*1.1*10)/10,coax:i.k==='tv'})});
  // agua fría
  const llave=h.items.find(i=>i.k==='llave'),fx=h.items.filter(i=>HI[i.k]&&HI[i.k].ud);
  if(llave&&fx.length){const P=prim(llave,fx),st=subtree(P.edges,i=>HI[fx[i].k].ud);
    R.cold={edges:P.edges.map(e=>{const s=st[e.to],Q=s.sum*(s.n>1?1/Math.sqrt(s.n-1):1),mn=Math.max(HI[fx[e.to].k].dn||12,0),d=pickDn(Math.max(Q,HI[fx[e.to].k].ud),s.n>1?16:mn);return{...e,Q,dn:d.dn,v:d.v,n:s.n}}),total:P.edges.reduce((s,e)=>s+e.cm,0)};
    R.cold.edges.forEach(e=>R.pipes.push({a:e.a,b:e.b,dn:e.dn,t:'cold'}))}
  // agua caliente
  const heaters=h.items.filter(i=>HI[i.k]&&HI[i.k].heater&&i.k!=='solar');const hotfx=h.items.filter(i=>HI[i.k]&&HI[i.k].hot);
  if(heaters.length&&hotfx.length){const src=heaters[0],P=prim(src,hotfx);let far=0;P.nodes.forEach(n=>{if(n.idx>=0)far=Math.max(far,n.cum)});
    R.hot={edges:P.edges.map(e=>({...e,dn:12})),farM:Math.round(far/100*1.1*10)/10,src};R.hot.edges.forEach(e=>R.pipes.push({a:e.a,b:e.b,dn:12,t:'hot'}))}
  // gas
  const gc=h.items.find(i=>i.k==='gas_cont'),ga=h.items.filter(i=>HI[i.k]&&HI[i.k].kwg);
  if(gc&&ga.length){const P=prim(gc,ga),st=subtree(P.edges,i=>HI[ga[i].k].kwg);let far=0;P.nodes.forEach(n=>{if(n.idx>=0)far=Math.max(far,n.cum)});
    R.gas={edges:P.edges.map(e=>({...e,kw:st[e.to].sum,dn:gasDn(st[e.to].sum)})),farM:Math.round(far/100*1.1*10)/10,total:P.edges.reduce((s,e)=>s+e.cm,0),kw:ga.reduce((s,i)=>s+HI[i.k].kwg,0)};
    R.gas.edges.forEach(e=>R.pipes.push({a:e.a,b:e.b,dn:e.dn,t:'gas'}))}
  return R}

// ---------- validación normativa ----------
function roomNeeds(r){const area=r.w*r.h/10000,len=Math.max(r.w,r.h)/100;
  return({vestibulo:{luz:1,toma:1},pasillo:{luz:Math.max(1,Math.ceil(len/5)),toma:Math.max(1,Math.ceil(len/5))},salon:{luz:Math.max(1,Math.ceil(area/18)),toma:Math.max(3,Math.ceil(area/6)),tv:1,rj45:1},
    dormitorio:{luz:1,toma:3,tv:1,rj45:1},cocina:{luz:2,toma:1,toma_enc:3,toma_horno:1,tv:1,rj45:1},bano:{luz:1,toma_bano:1},terraza:{luz:1},garaje:{luz:1,toma:1},trastero:{luz:1},lavadero:{luz:1,toma_lav:1},otro:{luz:1}})[r.type]||{luz:1}}
function countIn(h,r,k){return h.items.filter(i=>{const x=roomAt(h,i.x,i.y);if(!x||x.id!==r.id)return false;if(k==='luz')return i.k==='luz'||i.k==='foco';if(k==='int')return HI[i.k].sw;return i.k===k}).length}
function houseIssues(h,C){
  const out=[],bad=(lv,cat,id,msg)=>out.push({lv,cat,id:id||null,msg});C=C||houseCalc(h);
  if(!h.rooms.length)return[{lv:'warn',cat:'ele',id:null,msg:'Dibuja al menos una estancia en el plano.'}];
  const roomOf=i=>roomAt(h,i.x,i.y),nm=i=>HI[i.k].n,ext=i=>HI[i.k].ext;
  const has=k=>h.items.some(i=>i.k===k),cnt=k=>h.items.filter(i=>i.k===k).length;
  // ---- eléctrica ----
  if(!has('cuadro'))bad('err','ele',null,'Falta colocar el cuadro general en el plano.');
  else{const r=roomOf(h.items.find(i=>i.k==='cuadro'));if(r&&['bano','cocina'].includes(r.type))bad('warn','ele',h.items.find(i=>i.k==='cuadro').id,`El cuadro está en ${RT[r.type].toLowerCase()}: colócalo en el vestíbulo o en un lugar seco y accesible (ITC-BT-17).`)}
  h.items.forEach(i=>{if(!roomOf(i)&&!ext(i)&&!['toma_ext','grifo_ext','solar'].includes(i.k))bad('warn',HI[i.k].cat,i.id,`${nm(i)} está fuera de cualquier estancia.`)});
  h.rooms.forEach(r=>{const need=roomNeeds(r),lab=r.name||RT[r.type];
    Object.entries(need).forEach(([k,n])=>{const c=countIn(h,r,k);if(c<n){const cat=k==='tv'||k==='rj45'?'tel':'ele',nmk=k==='luz'?'puntos de luz':HI[k].n.toLowerCase();bad('warn',cat,null,`${lab}: faltan elementos (${c}/${n} ${nmk}) según ITC-BT-25${cat==='tel'?' / ICT':''}.`)}});
    if(countIn(h,r,'luz')>0&&countIn(h,r,'int')===0)bad('warn','ele',null,`${lab}: tiene luz pero ningún interruptor.`)});
  const wet=h.items.filter(i=>HI[i.k].wet);
  h.items.filter(i=>(['toma','toma_bano','toma_enc'].includes(i.k)||HI[i.k].sw)&&(roomOf(i)||{}).type==='bano').forEach(i=>{const w=wet.find(x=>hdist(x,i)<60);if(w)bad('err','ele',i.id,`${nm(i)} a ${Math.round(hdist(w,i))} cm de ${HI[w.k].n.toLowerCase()}: dentro del volumen de seguridad del baño (mín. 60 cm, ITC-BT-27).`)});
  Object.values(C.circ).forEach(c=>{const def=c.def;
    if(def.maxPts&&c.pts>def.maxPts)bad('err','ele',null,`${c.code} ${def.n}: ${c.pts} puntos, máximo ${def.maxPts}. Reparte en otro circuito.`);
    if(c.code==='C4'&&c.raw>def.max)bad('info','ele',null,`C4: lavadora + lavavajillas + termo suman ${c.raw.toFixed(1)} kW; el circuito (${def.In} A) no los aguanta a la vez.`);
    if(['C8','C9'].includes(c.code)&&c.raw>def.max)bad('err','ele',null,`${c.code} ${def.n}: ${c.raw.toFixed(1)} kW superan los ${def.max} kW del circuito. Reparte en dos circuitos.`);
    if(c.lenM>60)bad('warn','ele',null,`${c.code}: recorrido de ${c.lenM} m; revisa la caída de tensión o sube la sección.`)});
  if(C.elev)bad('info','ele',null,`Electrificación ELEVADA (≥ 9.200 W, IGA ≥ 40 A): hay climatización eléctrica, domótica, secadora o más de 160 m².`);
  // ---- telecomunicaciones y domótica ----
  const toma=h.items.filter(i=>['toma','toma_bano','toma_enc','toma_ext'].includes(i.k));
  h.items.filter(i=>HI[i.k].pw).forEach(i=>{const t=toma.find(x=>hdist(x,i)<=150);if(!t)bad('warn',HI[i.k].cat,i.id,`${nm(i)}: no tiene una toma de corriente a menos de 1,5 m para alimentarlo.`)});
  if((has('tv')||has('rj45')||has('ap')||has('camara'))&&!has('router'))bad('warn','tel',null,'Hay tomas de datos pero falta el router / registro de datos.');
  C.tel.forEach(t=>{if(!t.coax&&t.m>90)bad('err','tel',t.it.id,`${nm(t.it)}: cable de red de ${t.m} m (máx. 90 m en cobre).`);else if(!t.coax&&t.m>70)bad('warn','tel',t.it.id,`${nm(t.it)}: cable de red de ${t.m} m (cerca del máximo de 90 m).`)});
  if(has('alarma')&&!has('sensor'))bad('warn','tel',null,'La alarma no tiene ningún sensor / detector.');
  if(has('dom')&&!has('router'))bad('warn','tel',null,'La domótica necesita red de datos: falta el router.');
  h.items.filter(i=>i.k==='camara').forEach(i=>{if(!h.items.some(x=>x.k==='rj45'&&hdist(x,i)<=250))bad('warn','tel',i.id,'Cámara IP sin toma de datos a menos de 2,5 m (o punto WiFi).')});
  // ---- climatización y agua caliente ----
  const si=h.items.filter(i=>i.k==='split_i'),se=h.items.filter(i=>i.k==='split_e');
  if(si.length!==se.length)bad('err','cli',null,`Splits: ${si.length} unidades interiores y ${se.length} exteriores; deben coincidir.`);
  const free=se.slice();si.forEach(i=>{if(!free.length)return;free.sort((a,b)=>hdist(a,i)-hdist(b,i));const e=free.shift(),d=Math.round(hdist(e,i)/10)/10*1.2;
    if(d>15)bad('err','cli',i.id,`Split a ${d.toFixed(1)} m de su unidad exterior (máx. 15 m de línea frigorífica).`);else if(d>10)bad('warn','cli',i.id,`Split a ${d.toFixed(1)} m de la unidad exterior: línea larga, pierde potencia.`)});
  h.items.filter(i=>i.k==='termo').forEach(i=>{if((i.l||80)<30*h.persons)bad('warn','cli',i.id,`Termo de ${i.l||80} L para ${h.persons} personas: se recomiendan ≥ ${30*h.persons} L (CTE HS-4).`)});
  const heaters=h.items.filter(i=>HI[i.k].heater);
  if(h.items.some(i=>HI[i.k].hot)&&!heaters.length)bad('err','cli',null,'Hay puntos de agua caliente pero ninguna producción de ACS (termo, caldera, calentador, aerotermia o depósito).');
  if(C.hot&&C.hot.farM>15)bad('warn','cli',null,`El punto de ACS más lejano está a ${C.hot.farM} m del generador (> 15 m): añade recirculación o acerca el generador (CTE HS-4).`);
  if(has('caldera')){if(!has('gas_humos'))bad('err','cli',null,'La caldera de gas necesita salida de humos.');if(!has('gas_cont'))bad('err','cli',null,'La caldera de gas necesita contador / llave de abonado.');if(!has('rad_agua')&&!has('suelo'))bad('warn','cli',null,'Caldera sin emisores de calefacción (radiadores de agua).')}
  if(has('aerot')&&!has('rad_agua')&&!has('suelo')&&!has('deposito'))bad('warn','cli',null,'Aerotermia sin emisores ni depósito de ACS.');
  if(has('solar')&&!has('deposito'))bad('err','cli',null,'El panel solar térmico necesita depósito / acumulador.');
  h.items.filter(i=>i.k==='suelo').forEach(i=>{const r=roomOf(i);if(!h.items.some(t=>t.k==='termostato'&&roomAt(h,t.x,t.y)===r))bad('warn','cli',i.id,'Suelo radiante sin termostato en la estancia.')});
  h.rooms.forEach(r=>{const rad=h.items.filter(i=>i.k==='radiador'&&roomAt(h,i.x,i.y)===r);if(rad.length){const kw=rad.reduce((s,i)=>s+itemKw(i),0),need=r.w*r.h/10000*0.07;if(kw<need)bad('warn','cli',rad[0].id,`${r.name||RT[r.type]}: ${kw.toFixed(1)} kW de radiadores para ${need.toFixed(1)} kW necesarios (70 W/m²).`)}});
  // ---- fontanería ----
  const fx=h.items.filter(i=>HI[i.k].ud);
  if(fx.length&&!has('llave'))bad('err','agu',null,'Falta la llave de paso general de agua.');
  h.rooms.filter(r=>r.type==='bano').forEach(r=>{const k=n=>countIn(h,r,n),lab=r.name||'Baño';if(!k('inodoro')&&r.w*r.h>40000)bad('warn','agu',null,`${lab}: falta el inodoro.`);if(!k('lavabo'))bad('warn','agu',null,`${lab}: falta el lavabo.`);if(r.w*r.h>40000&&!k('ducha')&&!k('banera'))bad('warn','agu',null,`${lab}: falta ducha o bañera.`)});
  h.rooms.filter(r=>r.type==='cocina').forEach(r=>{if(!countIn(h,r,'fregadero'))bad('warn','agu',null,`${r.name||'Cocina'}: falta el fregadero.`)});
  h.items.filter(i=>HI[i.k].ud&&!HI[i.k].ext&&(roomOf(i)||{}).type==='dormitorio').forEach(i=>bad('warn','agu',i.id,`${nm(i)} dentro de un dormitorio.`));
  if(C.cold)C.cold.edges.forEach(e=>{if(e.v>1.5)bad('warn','agu',null,`Tubería de agua con velocidad ${e.v.toFixed(1)} m/s (>1,5): sube el diámetro.`)});
  // ---- gas ----
  const ga=h.items.filter(i=>HI[i.k].kwg);
  if(ga.length&&!has('gas_cont'))bad('err','gas',null,'Hay aparatos de gas pero falta el contador / llave de abonado.');
  if(has('gas_cont')&&!ga.length)bad('info','gas',null,'Contador de gas sin ningún aparato conectado.');
  ga.forEach(i=>{const r=roomOf(i);if(r&&['dormitorio','bano'].includes(r.type))bad('err','gas',i.id,`${nm(i)} en ${RT[r.type].toLowerCase()}: prohibido (aparato de gas en dormitorio o baño).`);
    if(i.k==='gas_cocina'&&r&&!h.items.some(x=>x.k==='gas_rejilla'&&roomAt(h,x.x,x.y)===r))bad('err','gas',i.id,'Cocina de gas sin rejilla de ventilación en la estancia.');
    if(['caldera','gas_calentador'].includes(i.k)&&!has('gas_humos'))bad('err','gas',i.id,`${nm(i)} sin salida de humos.`)});
  if(C.gas){if(C.gas.farM>25)bad('warn','gas',null,`Tubería de gas de ${C.gas.farM} m hasta el aparato más lejano: revisa el diámetro y las pérdidas.`);bad('info','gas',null,`Gas: ${C.gas.kw} kW instalados, Ø ${C.gas.edges.map(e=>e.dn).filter((v,i,a)=>a.indexOf(v)===i).join('/')} mm de cobre. Requiere instalador autorizado y prueba de estanqueidad (UNE 60670).`)}
  return out.concat(wiringIssues(h))}

// ---------- generación del cuadro desde la casa ----------
function genBoard(b,h){
  const C=houseCalc(h),codes=Object.keys(C.circ).filter(c=>C.circ[c].pts>0);
  if(!codes.length)return false;
  const prodOf={C1:'Alumbrado',C6:'Alumbrado',C2:'Tomas de corriente',C5:'Tomas de corriente',C7:'Tomas de corriente',C12:'Tomas de corriente',C11:'Tomas de corriente',C3:'Cocina / horno',C4:'Lavadora / lavavajillas',C10:'Lavadora / lavavajillas',C8:'Calentador / termo eléctrico',C9:'Aire acondicionado monofásico'};
  const mcbOf=a=>nm(`Magnetotérmico ${a}A 1P+N C`);
  const circNode=code=>{const c=C.circ[code],kw=Math.max(0.1,Math.round(c.kw*100)/100);
    return N(`Magnetotérmico ${c.def.In}A 1P+N C`,{label:`${code} ${c.def.n}`,circ:code},[N(prodOf[code],{kw,len:Math.max(5,c.lenM),lenTot:c.totM,label:`${code} ${c.def.n}`,pf:0.95,circ:code,ltype:c.def.lt})])};
  const groups=[codes.filter(c=>['C1','C2','C3','C4','C5'].includes(c)),codes.filter(c=>!['C1','C2','C3','C4','C5'].includes(c))].filter(g=>g.length);
  b.use='vivienda';b.phases=1;b.ks=0.7;b.isc=6;b.layout={};b.name='Cuadro vivienda (desde la casa)';
  const chunks=[];groups.forEach(g=>{for(let i=0;i<g.length;i+=5)chunks.push(g.slice(i,i+5))});
  const diffs=chunks.map((g,i)=>{const nodes=g.map(circNode);const sum=g.reduce((s,c)=>s+C.circ[c].kw*1000/230/0.95,0)*0.7;
    return N(sum>36?'Diferencial 63A 2P 30mA':'Diferencial 40A 2P 30mA',{label:`Diferencial ${i+1}`},nodes)});
  const tot=codes.reduce((s,c)=>s+C.circ[c].kw*1000/230/0.95,0)*0.7;
  b.root=N(tot>40?'Interruptor general 63A 2P':'Interruptor general 40A 2P',{label:'IGA'},[N('Protector sobretensiones tipo 2 1P+N',{label:'Sobretensiones'})].concat(diffs));
  return true}

// ---------- equipado automático según normativa ----------
function perimPt(r,i,total){const ix=r.x+20,iy=r.y+20,iw=r.w-40,ih=r.h-40,P=2*(iw+ih),t=((i+0.5)/total)*P;
  if(t<iw)return{x:ix+t,y:iy};if(t<iw+ih)return{x:ix+iw,y:iy+(t-iw)};if(t<2*iw+ih)return{x:ix+iw-(t-iw-ih),y:iy+ih};return{x:ix,y:iy+ih-(t-2*iw-ih)}}
function autoEquip(h,opt={}){
  const add=(k,x,y,extra)=>{h.items.push({id:uid(),k,x:Math.round(x),y:Math.round(y),...(extra||{})});};
  const S=36,odd=(r,i)=>perimPt(r,(2*i+1)%S,S);
  h.rooms.forEach(r=>{let slot=0;const next=()=>perimPt(r,((slot++)*2)%S,S);
    const need=roomNeeds(r),cy=r.y+r.h/2;
    const ensure=(k,n,pos)=>{const c=countIn(h,r,k==='luz'?'luz':k);for(let i=c;i<n;i++){const p=pos?pos(i):next();add(k,p.x,p.y)}};
    const lightPos=n=>i=>({x:r.x+r.w*(i+1)/(n+1),y:cy});
    ensure('luz',need.luz||0,lightPos(need.luz||1));
    if(need.luz&&countIn(h,r,'int')===0){const p=next();add('interruptor',p.x,p.y)}
    ['toma','toma_enc','toma_horno','toma_bano','toma_lav','tv','rj45'].forEach(k=>{if(need[k])ensure(k,need[k])});
    if(r.type==='bano'){const pos={lavabo:3,inodoro:9,ducha:14};['lavabo','inodoro'].concat(r.w*r.h>40000?['ducha']:[]).forEach(k=>{if(!countIn(h,r,k)){const p=odd(r,pos[k]);add(k,p.x,p.y)}});
      h.items.filter(i=>i.k==='toma_bano'&&roomAt(h,i.x,i.y)===r).forEach(i=>{const w=h.items.find(x=>HI[x.k].wet&&roomAt(h,x.x,x.y)===r);if(w&&hdist(w,i)<70){const p=perimPt(r,8,S);i.x=Math.round(p.x);i.y=Math.round(p.y)}})}
    if(r.type==='cocina'){if(!countIn(h,r,'fregadero')){const p=odd(r,5);add('fregadero',p.x,p.y)}if(!countIn(h,r,'lvj_agua')){const p=odd(r,8);add('lvj_agua',p.x,p.y);const q=odd(r,9);add('toma_lvj',q.x,q.y)}if(!countIn(h,r,'lav_agua')){const p=odd(r,12);add('lav_agua',p.x,p.y)}}
  });
  const first=t=>h.rooms.find(r=>r.type===t),ves=first('vestibulo')||h.rooms[0],coc=first('cocina'),ban=first('bano');
  if(ves&&!h.items.some(i=>i.k==='cuadro')){const p=odd(ves,1);add('cuadro',p.x,p.y)}
  if(ves&&!h.items.some(i=>i.k==='router')){const p=odd(ves,6);add('router',p.x,p.y);const q=odd(ves,7);add('toma',q.x,q.y)}
  const wr=coc||ban;if(wr&&!h.items.some(i=>i.k==='llave')){const p=odd(wr,13);add('llave',p.x,p.y)}
  if(ban&&!h.items.some(i=>HI[i.k].heater)){const p=odd(ban,1);add('termo',p.x,p.y,{l:30*Math.max(h.persons,1)+30})}
  if(ves&&!h.items.some(i=>i.k==='videop')&&opt.dom){const p=odd(ves,3);add('videop',p.x,p.y)}
}
const HTPL={
  piso:{n:'Piso de 3 dormitorios (80 m²)',rooms:[['vestibulo',0,0,200,400],['salon',200,0,450,400],['cocina',650,0,350,400],['pasillo',0,400,1000,120],['dormitorio',0,520,300,280],['dormitorio',300,520,300,280],['dormitorio',600,520,250,280],['bano',850,520,150,280]],persons:3},
  estudio:{n:'Estudio (35 m²)',rooms:[['vestibulo',0,0,150,200],['salon',150,0,400,300],['cocina',550,0,200,300],['dormitorio',0,300,300,250],['bano',300,300,150,250]],persons:2},
  completo:{n:'Piso con climatización y gas',rooms:[['vestibulo',0,0,200,400],['salon',200,0,450,400],['cocina',650,0,350,400],['pasillo',0,400,1000,120],['dormitorio',0,520,300,280],['dormitorio',300,520,300,280],['bano',600,520,200,280],['terraza',1000,0,200,400]],persons:4,extra:true}
};
function loadHouse(key){const t=HTPL[key],h=newHouse();h.persons=t.persons;let n=0;
  t.rooms.forEach(([type,x,y,w,hh])=>{n++;const same=h.rooms.filter(r=>r.type===type).length;h.rooms.push({id:uid(),type,x,y,w,h:hh,name:RT[type].split(' /')[0]+(same||type==='dormitorio'?' '+(same+1):'')})});
  h.w=Math.max(...h.rooms.map(r=>r.x+r.w))+100;h.h=Math.max(...h.rooms.map(r=>r.y+r.h))+100;
  autoEquip(h);
  if(t.extra){const r=k=>h.rooms.find(x=>x.type===k),sal=r('salon'),coc=r('cocina'),ter=r('terraza');
    const put=(k,x,y,e)=>h.items.push({id:uid(),k,x,y,...(e||{})});
    put('split_i',sal.x+sal.w-30,sal.y+40);put('toma',sal.x+sal.w-60,sal.y+25);put('split_e',ter.x+60,ter.y+60);
    put('gas_cont',coc.x+coc.w-30,coc.y+40);put('gas_cocina',coc.x+coc.w-60,coc.y+120);put('gas_rejilla',coc.x+coc.w-30,coc.y+260);put('caldera',coc.x+coc.w-40,coc.y+330);put('gas_humos',coc.x+coc.w-20,coc.y+360);put('toma',coc.x+coc.w-90,coc.y+340);
    put('rad_agua',sal.x+120,sal.y+30);put('rad_agua',sal.x+300,sal.y+380);put('termostato',sal.x+30,sal.y+200);
    put('alarma',h.items.find(i=>i.k==='cuadro').x+10,h.items.find(i=>i.k==='cuadro').y+70);put('sensor',sal.x+200,sal.y+30);
    h.items=h.items.filter(i=>i.k!=='termo')}
  return h}

// ---------- materiales de la casa (para el presupuesto) ----------
function houseBOM(h){const rows=[];if(!h||!h.items.length)return rows;const C=houseCalc(h),cnt={};
  h.items.forEach(i=>{const d=HI[i.k];if(!d||!d.pr&&i.k!=='suelo')return;cnt[i.k]=(cnt[i.k]||0)+1});
  Object.entries(cnt).forEach(([k,q])=>{const d=HI[k];if(d.pr>0)rows.push({p:{id:'h_'+k,kind:'house',name:`Vivienda · ${d.n}`,price:d.pr},qty:q})});
  h.items.filter(i=>i.k==='suelo').forEach(i=>rows.push({p:{id:'h_suelo_'+i.id,kind:'house',name:'Vivienda · Suelo radiante eléctrico (m²)',price:45},qty:Math.round((i.w||200)*(i.d||150)/10000*10)/10}));
  const tub=Object.values(C.circ).reduce((s,c)=>s+c.totM,0);if(tub)rows.push({p:{id:'h_tubo',kind:'house',name:'Vivienda · Tubo corrugado y cajas (m)',price:0.55},qty:Math.ceil(tub)});
  const pm={};C.pipes.forEach(p=>{const k=p.t+p.dn;pm[k]=pm[k]||{t:p.t,dn:p.dn,m:0};pm[k].m+=manh(p.a,p.b)/100*1.1});
  Object.values(pm).forEach(x=>rows.push({p:{id:'h_pipe'+x.t+x.dn,kind:'house',name:`Vivienda · Tubería ${{cold:'agua fría',hot:'agua caliente',gas:'gas'}[x.t]} Ø${x.dn} (m)`,price:x.t==='gas'?7:0.9+0.06*x.dn},qty:Math.ceil(x.m)}));
  const tel=C.tel.reduce((s,t)=>s+t.m,0);if(tel)rows.push({p:{id:'h_tel',kind:'house',name:'Vivienda · Cable de datos / coaxial (m)',price:0.7},qty:Math.ceil(tel)});
  return rows}

// ---------- conexionado manual: cables dibujados por el usuario ----------
const needsWire=i=>{const d=HI[i.k];return !!d&&((d.cat==='ele'&&i.k!=='cuadro')||!!d.circ)};
const FAM={C1:['C1','C6'],C6:['C1','C6'],C2:['C2','C7'],C7:['C2','C7'],C5:['C5','C12'],C12:['C5','C12']};
const famOk=(want,got)=>want===got||(FAM[want]||[want]).includes(got);
function wiringCalc(h){const links=h.links||[],cab=h.items.find(i=>i.k==='cuadro'),R={code:{},conf:{},cum:{},len:{},adj:{},link:{}};const by={};h.items.forEach(i=>by[i.id]=i);
  links.forEach(l=>{if(!by[l.a]||!by[l.b])return;(R.adj[l.a]=R.adj[l.a]||[]).push(l);(R.adj[l.b]=R.adj[l.b]||[]).push(l)});
  if(cab)(R.adj[cab.id]||[]).forEach(l0=>{const code=l0.code||'C1',start=l0.a===cab.id?l0.b:l0.a,q=[{id:start,cum:manh(cab,by[start])}],seen=new Set([cab.id]);R.link[l0.id]=code;
    while(q.length){const {id,cum}=q.shift();if(seen.has(id))continue;seen.add(id);
      if(R.code[id]&&R.code[id]!==code)R.conf[id]=[R.code[id],code];else{R.code[id]=code;R.cum[id]=Math.min(R.cum[id]||1e9,cum)}
      (R.adj[id]||[]).forEach(l=>{const o=l.a===id?l.b:l.a;if(o===cab.id||seen.has(o))return;R.link[l.id]=code;const d=manh(by[id],by[o]);R.len[code]=(R.len[code]||0)+(seen.size<=1e6?d:0);q.push({id:o,cum:cum+d})})}
    R.len[code]=(R.len[code]||0)+manh(cab,by[start])});
  return R}
function wiringIssues(h){const out=[];if(h.wmode!=='manual')return out;const bad=(lv,tag,id,msg)=>out.push({lv,cat:'ele',tag,id:id||null,msg});
  const W=wiringCalc(h),cab=h.items.find(i=>i.k==='cuadro'),by={};h.items.forEach(i=>by[i.id]=i);const nm=i=>HI[i.k].n;
  if(cab&&!(W.adj[cab.id]||[]).length)bad('err','cable',cab.id,'El cuadro no tiene ningún cable de salida: ningún elemento recibe corriente.');
  const unw=[],conf={};
  h.items.filter(needsWire).forEach(i=>{const d=HI[i.k],code=W.code[i.id];
    if(!code){unw.push(i);return}
    if(W.conf[i.id]){const k=W.conf[i.id].slice().sort().join(' y ');(conf[k]=conf[k]||[]).push(i)}
    if(d.circ&&!famOk(d.circ,code)&&!W.conf[i.id])bad('err','circuito',i.id,`${nm(i)}: va en ${code} pero debe ir en ${d.circ} (${CIRC[d.circ].n}).`);
    if(d.sw&&!famOk('C1',code)&&!W.conf[i.id])bad('err','circuito',i.id,`${nm(i)}: un mando de luz no puede ir en ${code}; debe estar en el circuito de alumbrado.`)});
  if(unw.length<=3)unw.forEach(i=>{const r=roomAt(h,i.x,i.y);bad('err','cable',i.id,`${nm(i)}${r?' de '+(r.name||RT[r.type]):''}: sin cable, no está conectado al cuadro. No funcionará.`)});
  else{const byRoom={};unw.forEach(i=>{const r=roomAt(h,i.x,i.y),k=r?(r.name||RT[r.type]):'fuera';byRoom[k]=(byRoom[k]||0)+1});bad('err','cable',unw[0].id,`${unw.length} elementos sin cable (no funcionan): ${Object.entries(byRoom).map(([k,n])=>k+' '+n).join(', ')}. Dibuja el cable desde el cuadro o usa «Cablear automáticamente».`)}
  Object.entries(conf).forEach(([k,l])=>bad('err','circuito',l[0].id,`${l.length} elemento${l.length>1?'s':''} conectado${l.length>1?'s':''} a dos circuitos a la vez (${k}): hay un cable que puentea los dos circuitos. Revisa el cable que une una zona de cada uno.`));
  h.rooms.forEach(r=>{const inR=i=>roomAt(h,i.x,i.y)===r,lights=h.items.filter(i=>(i.k==='luz'||i.k==='foco')&&inR(i)&&W.code[i.id]),sw=h.items.filter(i=>HI[i.k].sw&&inR(i)&&W.code[i.id]);
    lights.forEach(l=>{if(!sw.some(s=>famOk(W.code[l.id],W.code[s.id])))bad('warn','mando',l.id,`${r.name||RT[r.type]}: la luz no tiene ningún mando en su circuito (quedará siempre encendida).`)});
    sw.forEach(s=>{if(!lights.some(l=>famOk(W.code[l.id],W.code[s.id])))bad('warn','mando',s.id,`${nm(s)} de ${r.name||RT[r.type]}: no hay ninguna luz conectada en su mismo circuito.`)});
    const two=sw.filter(s=>s.k==='conmutador'||s.k==='cruzamiento');if(two.length>=2&&!(h.links||[]).some(l=>two.some(t=>t.id===l.a)&&two.some(t=>t.id===l.b)&&l.a!==l.b))bad('warn','mando',two[0].id,`${r.name||RT[r.type]}: los conmutadores no están unidos entre sí por cable (faltan los viajeros).`)});
  // lazos
  const seen=new Set(),inLoop=new Set();const dfs=(id,from)=>{seen.add(id);(W.adj[id]||[]).forEach(l=>{const o=l.a===id?l.b:l.a;if(cab&&o===cab.id)return;if(o===from&&!(W.adj[id]||[]).some(x=>x!==l&&(x.a===o||x.b===o)))return;if(seen.has(o)){if(o!==from)inLoop.add(o)}else dfs(o,id)})};
  h.items.forEach(i=>{if(!seen.has(i.id)&&W.code[i.id])dfs(i.id,null)});if(inLoop.size)bad('warn','cable',[...inLoop][0],'El cableado forma un lazo cerrado: revisa que no haya cables de más.');
  (h.links||[]).forEach(l=>{const a=by[l.a],b=by[l.b];if(!a||!b)return;const code=W.link[l.id]||l.code,len=manh(a,b);
    if(len>2500)bad('warn','cable',l.a,`Cable muy largo (${(len/100).toFixed(0)} m) entre ${nm(a)} y ${nm(b)}.`);
    if(l.sec&&code&&CIRC[code]&&l.sec<CIRC[code].sec)bad('err','cable',l.a,`Cable de ${l.sec} mm² en ${code}: la sección mínima es ${CIRC[code].sec} mm².`);
    if(l.pe===false&&(a.k.startsWith('toma')||b.k.startsWith('toma')||HI[a.k].circ&&HI[a.k].kw||HI[b.k].circ&&HI[b.k].kw))bad('err','cable',l.a,`Cable sin conductor de protección (tierra) hacia ${nm(a.k.startsWith('toma')?a:b)}: peligro de electrocución.`)});
  return out}
function autoWire(h){const prev=h.wmode;h.wmode='auto';const C=houseCalc(h);h.wmode=prev||'manual';const cab=h.items.find(i=>i.k==='cuadro');h.links=[];if(!cab)return;
  Object.values(C.circ).forEach(c=>{let prevId=cab.id;c.order.forEach(o=>{const l={id:uid(),a:prevId,b:o.p.id};if(prevId===cab.id)l.code=c.code;h.links.push(l);prevId=o.p.id})});
  // los mandos de luz de cada estancia se unen a su luz más cercana
  h.items.filter(i=>HI[i.k].sw).forEach(sw=>{if(h.links.some(l=>l.a===sw.id||l.b===sw.id))return;const r=roomAt(h,sw.x,sw.y),ls=h.items.filter(i=>(i.k==='luz'||i.k==='foco')&&roomAt(h,i.x,i.y)===r).sort((a,b)=>hdist(a,sw)-hdist(b,sw));if(ls[0])h.links.push({id:uid(),a:ls[0].id,b:sw.id})})}

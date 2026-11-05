'use strict';
const KEY='cuadroconfig-v1';
const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const num=(v,d=0)=>{const x=parseFloat(String(v).replace(',','.'));return isFinite(x)?x:d};
const eur=v=>(v||0).toLocaleString('es-ES',{style:'currency',currency:'EUR'});
const f1=v=>(Math.round(v*10)/10).toLocaleString('es-ES');
let _id=Date.now()%1e7;const uid=()=>'n'+(++_id).toString(36);
const KINDS={incomer:'Cabecera / general',mcb:'Magnetotérmico',rcd:'Diferencial',rcbo:'Mag.+Diferencial',contactor:'Contactor',spd:'Sobretensiones',meter:'Contador',other:'Otros',mpcb:'Guardamotor',thermal:'Relé térmico',softstart:'Arrancador suave',vfd:'Variador de frecuencia',load:'Receptor',motor:'Motor'};
const KCOL={incomer:'#37474f',mcb:'#1565c0',rcd:'#6a1b9a',rcbo:'#8e24aa',contactor:'#ef6c00',spd:'#c62828',meter:'#00838f',other:'#6d4c41',mpcb:'#00695c',thermal:'#558b2f',softstart:'#ad1457',vfd:'#4527a0',load:'#455a64',motor:'#bf360c'};
const RULES={alumbrado:[10,1.5],tomas:[16,2.5],cocina:[25,6],lavadora:[20,4],aire:[25,6],calefaccion:[25,6]};
const LTYPES={alumbrado:'Alumbrado',tomas:'Tomas de corriente',cocina:'Cocina / horno',lavadora:'Lavadora / lavavajillas',aire:'Aire acondicionado',calefaccion:'Calefacción / termo',vehiculo:'Recarga vehículo eléctrico',fv:'Fotovoltaica',soldadura:'Soldadura',motor:'Motor',bomba:'Bomba',ventilador:'Ventilador',compresor:'Compresor',ascensor:'Ascensor / polipasto'};
const USES={general:'General',vivienda:'Vivienda (ITC-BT-25)',terciario:'Terciario / comercial',industrial:'Industrial',vehiculo:'Garaje / recarga VE'};
const PRICELISTS=[{n:'Tarifa estándar',k:1},{n:'Tarifa profesional (-12%)',k:0.88},{n:'Tarifa gran cuenta (-20%)',k:0.8}];

let S, tab='casa', selId=null, filter='', kindF='', dragId=null;

function newBoard(name='Cuadro general'){return{id:uid(),name,phases:3,isc:10,ks:0.8,reserve:25,encId:'auto',aux:8,hours:0.12,use:'general',root:null}}
function newProj(name='Proyecto nuevo'){return{id:uid(),name,client:'',list:0,discount:0,margin:15,vat:21,rate:38,mode:'4000',boards:[newBoard()],cur:0}}
function load(){
  try{const s=JSON.parse(localStorage.getItem(KEY));if(s&&s.projects&&s.projects.length){const have=new Set(s.catalog.map(p=>p.id));DEFAULT_CATALOG.forEach(p=>{if(!have.has(p.id))s.catalog.push(structuredClone(p))});return s}}catch(e){}
  S={projects:[],cur:0,catalog:structuredClone(DEFAULT_CATALOG),enclosures:structuredClone(ENCLOSURES)};
  const p=newProj('Proyecto de ejemplo');p.client='Cliente demo';p.house=loadHouse('piso');genBoard(p.boards[0],p.house);
  S.projects.push(p);return S;
}
function save(){try{localStorage.setItem(KEY,JSON.stringify(S))}catch(e){}}
const P=()=>S.projects[S.cur], B=()=>P().boards[P().cur]||P().boards[0];
const prod=id=>S.catalog.find(p=>p.id===id);
const findProd=(kind,inA,poles,ma)=>S.catalog.find(p=>p.kind===kind&&p.in===inA&&p.poles===poles&&(!ma||p.ma===ma));
function mk(p,o={}){return{id:uid(),pid:p.id,label:'',qty:1,kw:0,pf:0.9,len:20,children:[],...o}}
// ---------- plantillas ----------
const nm=s=>S.catalog.find(p=>p.name===s)||S.catalog.find(p=>p.name.includes(s));
const N=(s,o,ch)=>{const p=nm(s);if(!p)throw new Error('Catálogo: falta '+s);return mk(p,{...(o||{}),children:ch||[]})};
const m1=a=>`Magnetotérmico ${a}A 1P+N C`,m3=a=>`Magnetotérmico ${a}A 3P C`;
const circ=(a,load,o)=>N(m1(a),{label:o.label,qty:o.qty||1},[N(load,{kw:o.kw,len:o.len||20,label:o.label,pf:o.pf||0.95})]);
const circ3=(a,load,o)=>N(m3(a),{label:o.label,qty:o.qty||1},[N(load,{kw:o.kw,len:o.len||20,label:o.label,pf:o.pf||0.9})]);
const TPL={vivienda:'Vivienda (monofásica)',vivienda_ev:'Vivienda trifásica con coche eléctrico y fotovoltaica',local:'Local comercial trifásico',oficina:'Oficina',taller:'Taller industrial con motores',motor_dol:'Motor · arranque directo (0,75 kW)',motor_yd:'Motor · estrella-triángulo (11 kW)',motor_soft:'Motor · arrancador suave (7,5 kW)',motor_vfd:'Motor · variador de frecuencia (15 kW)',bombeo:'Grupo de bombeo (2 bombas)',garaje:'Garaje con recarga de vehículos',piscina:'Piscina y depuradora'};
function motorBranch(kw,start,label,o={}){
  const Ib=kw*1000/(Math.sqrt(3)*400*0.85*0.9),pick=(k,f)=>S.catalog.filter(p=>p.kind===k&&f(p)).sort((a,b)=>a.in-b.in)[0];
  const last=k=>S.catalog.filter(p=>p.kind===k).pop();
  const mp=pick('mpcb',p=>p.lo<=Ib&&Ib<=p.hi)||last('mpcb'),th=pick('thermal',p=>p.lo<=Ib&&Ib<=p.hi)||last('thermal');
  const ct=pick('contactor',p=>p.ac3&&p.in>=Ib*(start==='yd'?0.58:1)),ss=pick('softstart',p=>p.in>=Ib),vf=pick('vfd',p=>p.in>=1.1*Ib);
  const mcb=pick('mcb',p=>p.poles===3&&p.in>=Ib*1.15);
  let x=mk(nm(o.motor||'Motor eléctrico trifásico'),{label,kw,pf:0.85,eff:0.9,start,iarr:o.iarr||6,len:o.len||20});
  const up=(p,l)=>{x=mk(p,{label:l,children:[x]})};
  if(start==='soft'){up(ss,'Arrancador suave');up(mp,'Guardamotor')}
  else if(start==='vfd'){up(vf,'Variador');up(mp,'Guardamotor')}
  else if(start==='yd'){up(ct,'Contactor estrella');up(ct,'Contactor triángulo');up(ct,'Contactor de red');up(mp,'Guardamotor')}
  else if(o.classic){up(th,'Relé térmico');up(ct,'Contactor');up(mcb,'Protección')}
  else{up(ct,'Contactor');up(mp,'Guardamotor')}
  return x}
function template(b,t){
  b.use='general';b.phases=3;b.isc=6;b.ks=0.8;b.name=TPL[t]||b.name;b.layout={};
  const mccb=a=>`Automático caja moldeada ${a}A 4P`,dif=(a,ma=30)=>ma===30?`Diferencial ${a}A 4P 30mA`:`Diferencial ${a}A 4P 300mA selectivo`;
  if(t==='vivienda'){b.use='vivienda';b.phases=1;b.ks=0.7;b.name='Cuadro vivienda';
    b.root=N('Interruptor general 63A 2P',{label:'IGA'},[N('Protector sobretensiones tipo 2 1P+N',{label:'Sobretensiones'}),
      N('Diferencial 63A 2P 30mA',{label:'Diferencial A'},[circ(10,'Alumbrado',{label:'C1 Alumbrado',kw:1.2,len:25}),circ(16,'Tomas de corriente',{label:'C2 Tomas',kw:2.5}),circ(25,'Cocina / horno',{label:'C3 Cocina y horno',kw:4.5,len:12}),circ(20,'Lavadora / lavavajillas',{label:'C4 Lavadora',kw:3.5,len:10})]),
      N('Diferencial 40A 2P 30mA',{label:'Diferencial B'},[circ(16,'Tomas de corriente',{label:'C5 Baño y cocina',kw:2.5,len:12}),circ(25,'Aire acondicionado monofásico',{label:'C6 Aire acondicionado',kw:3,len:15}),circ(16,'Tomas de corriente',{label:'C7 Tomas auxiliares',kw:2.5})])])}
  else if(t==='vivienda_ev'){b.use='vivienda';b.name='Vivienda trifásica con VE y FV';
    b.root=N(mccb(100),{label:'IGA'},[N('Protector sobretensiones tipo 2 3P+N',{label:'Sobretensiones'}),
      N(dif(63),{label:'Dif. A'},[circ(10,'Alumbrado',{label:'C1 Alumbrado',kw:1.2,len:25}),circ(16,'Tomas de corriente',{label:'C2 Tomas',kw:2.5}),circ(25,'Cocina / horno',{label:'C3 Cocina y horno',kw:4.5,len:12}),circ(20,'Lavadora / lavavajillas',{label:'C4 Lavadora',kw:3.5,len:10})]),
      N(dif(63),{label:'Dif. B'},[circ(16,'Tomas de corriente',{label:'C5 Baño y cocina',kw:2.5,len:12}),circ(25,'Aire acondicionado monofásico',{label:'C6 Aire acondicionado',kw:3,len:15})]),
      N(dif(40),{label:'Dif. vehículo eléctrico'},[circ(32,'Cargador vehículo eléctrico monofásico',{label:'Cargador VE 6,6 kW',kw:6.6,len:15,pf:1})]),
      N(dif(25),{label:'Dif. fotovoltaica'},[circ(25,'Inversor fotovoltaico monofásico',{label:'Inversor FV 5 kW',kw:5,len:10,pf:1})])])}
  else if(t==='local'){b.name='Cuadro general local';
    b.root=N(mccb(160),{label:'General'},[N('Contador energía trifásico',{label:'Contador'}),N('Protector sobretensiones tipo 2 3P+N',{label:'Sobretensiones'}),
      N(dif(63,300),{label:'Dif. fuerza 300 mA'},[circ3(32,'Aire acondicionado trifásico',{label:'Clima 9 kW',kw:9,len:25}),motorBranch(5.5,'yd','Compresor 5,5 kW',{motor:'Compresor (motor trifásico)'})]),
      N(dif(40),{label:'Dif. alumbrado y tomas'},[circ(10,'Alumbrado',{label:'Alumbrado',kw:1.4,qty:3}),circ(16,'Tomas de corriente',{label:'Tomas',kw:2.3,qty:4}),circ(20,'Tomas de corriente',{label:'Tomas SAI',kw:3.2})])])}
  else if(t==='oficina'){b.use='terciario';b.name='Cuadro oficina';
    b.root=N(mccb(100),{label:'General'},[N('Contador energía trifásico',{label:'Contador'}),N('Protector sobretensiones tipo 2 3P+N',{label:'Sobretensiones'}),
      N(dif(63),{label:'Dif. alumbrado'},[circ(10,'Alumbrado',{label:'Alumbrado',kw:1.2,qty:4,len:30})]),
      N(dif(63),{label:'Dif. tomas'},[circ(16,'Tomas de corriente',{label:'Puestos de trabajo',kw:2.3,qty:6}),circ(20,'Tomas de corriente',{label:'Servidores / SAI',kw:3.2})]),
      N(dif(40),{label:'Dif. climatización'},[circ3(25,'Aire acondicionado trifásico',{label:'Climatización 9 kW',kw:9,len:30})])])}
  else if(t==='taller'){b.use='industrial';b.name='Taller industrial';
    b.root=N(mccb(250),{label:'General taller'},[N('Contador energía trifásico',{label:'Contador'}),N('Protector sobretensiones tipo 2 3P+N',{label:'Sobretensiones'}),
      motorBranch(4,'yd','Torno 4 kW',{len:25}),motorBranch(5.5,'yd','Fresadora 5,5 kW',{len:30}),motorBranch(11,'yd','Compresor 11 kW',{motor:'Compresor (motor trifásico)',len:15}),
      N(dif(40),{label:'Dif. alumbrado y soldadura'},[circ(10,'Alumbrado',{label:'Alumbrado nave',kw:1.5,qty:4,len:28}),N(m1(32),{label:'Soldadora'},[N('Soldadora',{kw:3,len:15,label:'Soldadora',pf:0.8})])])])}
  else if(t==='motor_dol'){b.use='industrial';b.isc=10;b.name='Motor · arranque directo';b.root=N(mccb(63),{label:'General'},[motorBranch(0.75,'dol','Motor 0,75 kW')])}
  else if(t==='motor_yd'){b.use='industrial';b.isc=10;b.name='Motor · estrella-triángulo';b.root=N(mccb(100),{label:'General'},[motorBranch(11,'yd','Motor 11 kW')])}
  else if(t==='motor_soft'){b.use='industrial';b.isc=10;b.name='Motor · arrancador suave';b.root=N(mccb(63),{label:'General'},[motorBranch(7.5,'soft','Motor 7,5 kW')])}
  else if(t==='motor_vfd'){b.use='industrial';b.isc=10;b.name='Motor · variador';b.root=N(mccb(100),{label:'General'},[motorBranch(15,'vfd','Motor 15 kW',{len:30})])}
  else if(t==='bombeo'){b.use='industrial';b.isc=10;b.name='Grupo de bombeo';b.root=N(mccb(63),{label:'General'},[N('Protector sobretensiones tipo 2 3P+N',{label:'Sobretensiones'}),motorBranch(3,'soft','Bomba 1 · 3 kW',{motor:'Bomba (motor trifásico)',len:30}),motorBranch(3,'soft','Bomba 2 · 3 kW',{motor:'Bomba (motor trifásico)',len:30})])}
  else if(t==='garaje'){b.use='vehiculo';b.name='Garaje con recarga VE';b.root=N(mccb(100),{label:'General garaje'},[N('Protector sobretensiones tipo 2 3P+N',{label:'Sobretensiones'}),
      N(dif(40),{label:'Dif. recarga 1'},[circ(32,'Cargador vehículo eléctrico monofásico',{label:'Cargador VE 1',kw:6.6,len:20,pf:1})]),N(dif(40),{label:'Dif. recarga 2'},[circ(32,'Cargador vehículo eléctrico monofásico',{label:'Cargador VE 2',kw:6.6,len:25,pf:1})]),N(dif(40),{label:'Dif. recarga 3'},[circ(32,'Cargador vehículo eléctrico monofásico',{label:'Cargador VE 3',kw:6.6,len:22,pf:1})]),
      N(dif(25),{label:'Dif. alumbrado'},[circ(10,'Alumbrado',{label:'Alumbrado garaje',kw:0.8,qty:3,len:30})])])}
  else if(t==='piscina'){b.use='general';b.name='Piscina';b.root=N(mccb(63),{label:'General piscina'},[N('Protector sobretensiones tipo 2 3P+N',{label:'Sobretensiones'}),
      motorBranch(1.1,'dol','Bomba depuradora 1,1 kW',{motor:'Bomba (motor trifásico)',iarr:4.4,len:25}),
      N(dif(25),{label:'Dif. alumbrado'},[circ(10,'Alumbrado',{label:'Focos piscina',kw:0.3,qty:4,len:20}),circ(16,'Calentador / termo eléctrico',{label:'Calentador 2 kW',kw:2,len:10})])])}
}
// ---------- árbol ----------
function walk(n,f,par=null,depth=0){if(!n)return;f(n,par,depth);n.children.forEach(c=>walk(c,f,n,depth+1))}
function find(id){let r=null,pr=null;walk(B().root,(n,p)=>{if(n.id===id){r=n;pr=p}});return{n:r,p:pr}}
function isDesc(a,id){let f=false;walk(a,n=>{if(n.id===id)f=true});return f}
function detach(id){const b=B();if(b.root&&b.root.id===id){const r=b.root;b.root=null;return r}
  let out=null;walk(b.root,(n)=>{const i=n.children.findIndex(c=>c.id===id);if(i>=0)out=n.children.splice(i,1)[0]});return out}
function clone(n){const c=structuredClone(n);walk(c,x=>x.id=uid());return c}
// ---------- análisis ----------
function analyze(b){
  const info={},issues=[],cables=[],V=b.phases===3?400:230,mode=num(P().mode,4000);
  const add=(lv,id,msg)=>{issues.push({lv,id,msg});if(id&&info[id]){const o=info[id];if(lv==='err'||(lv==='warn'&&o.lv!=='err'))o.lv=lv}};
  let hasSPD=false;
  function loadChecks(n,o,p,anc,ib,hasRcd,eq){
    const L=label(n),isM=p.kind==='motor',three=p.poles>=3,Vn=three?400:230,lt=n.ltype||p.ltype||'';
    const A=anc.map(a=>({n:a,p:(info[a.id]||{}).p||prod(a.pid)||{}})),near=A.slice().reverse();
    const prot=near.find(x=>['mcb','rcbo','mpcb'].includes(x.p.kind));
    if(!prot)add('err',n.id,`${L}: el receptor no tiene aparato de protección propio (magnetotérmico o guardamotor) aguas arriba.`);
    const nearIn=prot&&['mcb','rcbo'].includes(prot.p.kind)?prot.p.in:0;
    const need=Math.max(ib*(isM?1.25:1),nearIn);
    let c=CABLES.find(x=>x[1]>=need)||CABLES[CABLES.length-1];
    if(b.use==='vivienda'&&RULES[lt]&&!n.sec){c=CABLES.find(x=>x[0]>=RULES[lt][1]&&x[1]>=need)||c}
    if(n.sec){const m=CABLES.find(x=>x[0]===n.sec);if(m){c=m;if(m[1]<need)add('err',n.id,`${L}: cable de ${m[2]||m[0]} mm² admite ${m[1]} A y el circuito necesita ${f1(need)} A${isM?' (125 % de In, ITC-BT-47)':''}.`)}}
    const lim=lt==='alumbrado'?3:5,dvOf=s=>(three?Math.sqrt(3):2)*Math.max(ib,0)*n.len*0.0227/s/Vn*100;
    if(!n.sec){let k=CABLES.indexOf(c);while(dvOf(c[0])>lim&&k<CABLES.length-1){k++;c=CABLES[k]}}
    o.amp=c[1];o.sec=c[0];o.cl=c[2]||String(c[0]);o.cable=o.cl+' mm²';
    o.dv=dvOf(c[0]);
    cables.push({sec:c[0],cl:o.cl,m:eq*n.qty*(n.lenTot||n.len)});
    if(o.dv>lim)add('warn',n.id,`${L}: caída de tensión ${f1(o.dv)}% (límite ${lim}%). Aumenta la sección o acorta la línea.`);
    if(!isM&&p.poles<=2&&!hasRcd)add('warn',n.id,`${L}: receptor sin protección diferencial aguas arriba.`);
    if(b.use==='vivienda'&&RULES[lt]&&prot&&['mcb','rcbo'].includes(prot.p.kind)){const [mx,ms]=RULES[lt];
      if(prot.p.in>mx)add('warn',n.id,`${L}: en vivienda el circuito de ${LTYPES[lt]||lt} lleva como máximo ${mx} A (ITC-BT-25); hay ${prot.p.in} A.`);
      if(c[0]<ms)add('err',n.id,`${L}: sección mínima ${ms} mm² para ${LTYPES[lt]||lt} (ITC-BT-25).`)}
    if(lt==='vehiculo'&&!A.some(x=>['rcd','rcbo'].includes(x.p.kind)&&x.p.ma&&x.p.ma<=30))add('err',n.id,`${L}: la recarga de vehículo eléctrico exige diferencial de 30 mA (ITC-BT-52).`);
    if(lt==='fv'){if(!hasSPD)add('warn',n.id,`${L}: instala un protector de sobretensiones en la instalación fotovoltaica (ITC-BT-40).`);
      add('info',n.id,`${L}: si el inversor no tiene transformador, el diferencial debe ser tipo B.`)}
    if(!isM)return;
    const P=n.kw,start=n.start||'dol',iarr=n.iarr||6,has=k=>A.filter(x=>x.p.kind===k).map(x=>x.p);
    const mp=has('mpcb')[0],th=has('thermal')[0],ss=has('softstart')[0],vf=has('vfd')[0],cts=has('contactor');
    if(!(mp||th||ss||vf))add('err',n.id,`${L}: falta la protección contra sobrecarga del motor (relé térmico o guardamotor).`);
    [mp,th].forEach(d=>{if(d&&d.lo&&ib<d.lo)add('warn',n.id,`${L}: ${d.name} (${d.lo}–${d.hi} A) es demasiado grande para ${f1(ib)} A de corriente nominal: no protege bien el motor.`)});
    if(ss&&ss.in<ib)add('err',n.id,`${L}: ${ss.name} (${ss.in} A) insuficiente para ${f1(ib)} A.`);
    if(vf&&vf.in<1.1*ib)add('err',n.id,`${L}: ${vf.name} (${vf.in} A) insuficiente para ${f1(ib)} A (se recomienda un 10 % de margen).`);
    if(start==='yd'&&cts.length<3)add('err',n.id,`${L}: el arranque estrella-triángulo necesita 3 contactores (red, estrella y triángulo); hay ${cts.length}.`);
    if(start==='soft'&&!ss)add('err',n.id,`${L}: has elegido arranque suave pero falta el arrancador suave.`);
    if(start==='vfd'&&!vf)add('err',n.id,`${L}: has elegido variador pero falta el variador de frecuencia.`);
    if((start==='dol'||start==='yd')&&!cts.length)add('err',n.id,`${L}: falta el contactor de maniobra del motor.`);
    if(cts.length){if(!cts.some(x=>x.ac3))add('warn',n.id,`${L}: el contactor no es de categoría AC-3 (apto para motores).`);
      const mx=Math.max(...cts.map(x=>x.in)),req=start==='yd'?0.58*ib:ib;
      if(mx<req)add('err',n.id,`${L}: contactor de ${mx} A insuficiente (necesita ${f1(req)} A).`)}
    const ratio=start==='dol'?iarr:start==='yd'?iarr/3:start==='soft'?2:1.5;
    const limA=P<=0.75?Infinity:P<=1.5?4.5:P<=5?3:P<=15?2:1.5;
    o.iarr=ratio;o.iarrLim=limA;
    if(ratio>limA)add('warn',n.id,`${L}: arranque con Ia/In = ${f1(ratio)} supera el máximo ${limA} de la ITC-BT-47 para ${P} kW. Usa estrella-triángulo, arrancador suave o variador (o consulta a la distribuidora).`);
    if(prot&&prot.p.kind==='mcb'&&start==='dol'){const peak=iarr*ib*1.7;
      if(peak>10*prot.p.in)add('err',n.id,`${L}: el magnetotérmico de ${prot.p.in} A dispararía en cada arranque (pico ≈ ${f1(peak)} A). Usa un guardamotor.`);
      else if(peak>5*prot.p.in)add('warn',n.id,`${L}: el magnetotérmico de ${prot.p.in} A puede disparar al arrancar el motor (pico ≈ ${f1(peak)} A). Mejor un guardamotor.`)}
    if(o.dv*ratio>15)add('warn',n.id,`${L}: la caída de tensión durante el arranque (${f1(o.dv*ratio)}%) supera el 15 %.`);
    if(vf&&A.some(x=>['rcd','rcbo'].includes(x.p.kind)&&x.p.ma))add('info',n.id,`${L}: con variador el diferencial debe ser tipo B y el cable apantallado (EMC).`)}
  function calc(n,par,rcdUp,eq,anc=[]){
    const p=prod(n.pid)||{kind:'other',in:0,poles:2,icu:0,mod:1,name:'?'};
    const o=info[n.id]={p,ib:0,lv:'ok',eq,cable:null};
    const three=p.poles>=3;
    let ib=0;
    const hasRcd=rcdUp||p.kind==='rcd'||p.kind==='rcbo';
    if(n.children.length){
      let s=0;n.children.forEach(c=>{const cp=prod(c.pid);const ci=calc(c,n,hasRcd,eq*n.qty,anc.concat([n]));
        const single=cp&&cp.poles<=2;
        s+=ci*c.qty*((three&&b.phases===3&&single)?1/3:1);
        if(cp&&cp.poles>=3&&p.poles<=2&&p.kind!=='other')add('err',c.id,`Receptor trifásico (${cp.poles}P) bajo un aparato monofásico (${p.poles}P).`);
      });
      ib=n.children.length>1?s*b.ks:s;
    }else if(n.kw>0){
      const eff=p.kind==='motor'?(n.eff||0.9):1,pf=n.pf||0.9;
      ib=three?n.kw*1000/(Math.sqrt(3)*400*pf*eff):n.kw*1000/(230*pf*eff);
    }
    o.ib=ib;
    if(['mpcb','thermal'].includes(p.kind))o.setIn=Math.max(p.lo||0,Math.min(p.hi||p.in,ib));
    if(p.kind==='load'||p.kind==='motor')loadChecks(n,o,p,anc,ib,hasRcd,eq);
    if(p.in>0){
      const ydB=p.kind==='contactor'&&(function f(x){return x.start==='yd'||x.children.some(f)})(n),cmp=ydB?ib*0.58:ib;
      if(cmp>p.in)add('err',n.id,`${label(n)}: intensidad de cálculo ${f1(cmp)} A supera el calibre ${p.in} A.`);
      else if(cmp>0.9*p.in&&!['mpcb','thermal'].includes(p.kind))add('warn',n.id,`${label(n)}: carga al ${Math.round(ib/p.in*100)}% del calibre.`);
      if(par){const pp=prod(par.pid);if(pp&&pp.in>0&&p.in>pp.in&&['mcb','rcbo','rcd','incomer'].includes(p.kind))
        add('warn',n.id,`${label(n)}: calibre ${p.in} A mayor que el del aparato superior (${pp.in} A).`);
        else if(pp&&pp.in>0&&p.in>0&&pp.in/p.in<1.6&&pp.kind==='mcb'&&p.kind==='mcb')add('info',n.id,`${label(n)}: relación de calibres <1,6 con el superior; selectividad dudosa.`);}
      const need=Math.max(ib,0);
      const ampacity=Math.max(p.in,need);
      let c=CABLES.find(c=>c[1]>=ampacity)||CABLES[CABLES.length-1];
      if(n.sec){const m=CABLES.find(x=>x[0]===n.sec);if(m){c=m;if(m[1]<p.in)add('err',n.id,`${label(n)}: cable de ${m[2]||m[0]} mm² admite ${m[1]} A y la protección es de ${p.in} A: el cable queda sin proteger.`)}}
      o.amp=c[1];o.sec=c[0];o.cl=c[2]||String(c[0]);o.cable=o.cl+' mm²';
      if(!n.children.length&&['mcb','rcbo'].includes(p.kind)){
        const Vn=three?400:230,k=three?Math.sqrt(3):2;o.dv=k*Math.max(ib,0)*n.len*0.0227/c[0]/Vn*100;
        cables.push({sec:c[0],cl:o.cl,m:eq*n.qty*n.len});
        if(o.dv>5)add('warn',n.id,`${label(n)}: caída de tensión ${f1(o.dv)}% (>5%). Aumenta la sección o acorta la línea.`);
        else if(o.dv>3)add('info',n.id,`${label(n)}: caída de tensión ${f1(o.dv)}% (>3%).`);}
    }
    if(['mcb','rcbo','incomer','mpcb'].includes(p.kind)&&p.icu>0&&p.icu<b.isc)add('err',n.id,`${label(n)}: poder de corte ${p.icu} kA inferior a la Icc prevista (${b.isc} kA).`);
    if(['mcb'].includes(p.kind)&&!n.children.length&&!hasRcd&&p.poles<=2)add('warn',n.id,`${label(n)}: circuito final sin protección diferencial aguas arriba.`);
    if(!par&&p.kind!=='incomer')add('warn',n.id,'La cabecera del cuadro debería ser un aparato de corte general.');
    if(!par&&p.in>mode)add('err',n.id,`Calibre ${p.in} A supera el límite del modo ${mode===400?'EcoSet-400 (≤400 A)':'4000 (≤4000 A)'}.`);
    if(b.phases===1&&p.poles>=4&&p.kind!=='spd'&&p.kind!=='meter')add('info',n.id,`${label(n)}: aparato tetrapolar en cuadro monofásico.`);
    return ib;
  }
  if(!b.root){return{info,issues:[{lv:'warn',id:null,msg:'El cuadro está vacío: arrastra un aparato de cabecera.'}],mods:[],V,cables,ph:{L1:0,L2:0,L3:0}}}
  hasSPD=false;walk(b.root,x=>{if((prod(x.pid)||{}).kind==='spd')hasSPD=true});
  calc(b.root,null,false,1);
  const ph={L1:0,L2:0,L3:0};
  if(b.phases===3){const fixed=[],auto=[];
    walk(b.root,(n,par)=>{const i=info[n.id],pp=par&&prod(par.pid);if(par&&i.p.poles<=2&&pp&&pp.poles>=3){const l=i.ib*i.eq;
      if(['L1','L2','L3'].includes(n.ph)){ph[n.ph]+=l*n.qty;i.phase=n.ph}else auto.push({n,l})}});
    auto.sort((x,y)=>y.l-x.l).forEach(a=>{for(let q=0;q<a.n.qty;q++){const m=Object.keys(ph).sort((x,y)=>ph[x]-ph[y])[0];ph[m]+=a.l;if(!info[a.n.id].phase)info[a.n.id].phase=m}});
    const v=Object.values(ph),mx=Math.max(...v),mn=Math.min(...v);
    if(mx>10&&(mx-mn)>0.25*mx)add('warn',null,`Fases desequilibradas (L1 ${f1(ph.L1)} A, L2 ${f1(ph.L2)} A, L3 ${f1(ph.L3)} A). Reparte los circuitos monofásicos.`);}
  // módulos
  const mods=[];
  walk(b.root,(n)=>{const p=info[n.id]?.p;if(!p||!(p.mod>0))return;let q=1;let a=n;/* qty efectiva */q=info[n.id].eq*n.qty;for(let i=0;i<q;i++)mods.push({n,p})});
  return{info,issues,mods,V,cables,ph};
}
function verdict(a){const e=a.issues.filter(i=>i.lv==='err').length,w=a.issues.filter(i=>i.lv==='warn').length;
  return e?{lv:'err',txt:`NO VÁLIDA · ${e} fallo${e>1?'s':''}${w?` y ${w} aviso${w>1?'s':''}`:''}`}:w?{lv:'warn',txt:`VÁLIDA CON AVISOS · ${w}`}:{lv:'ok',txt:'INSTALACIÓN VÁLIDA · sin fallos'}}
const label=n=>n.label||(prod(n.pid)||{}).name||'?';
function chooseEnc(b,mods){
  const need=mods.reduce((s,m)=>s+m.p.mod,0)*(1+b.reserve/100);
  const list=[...S.enclosures].sort((a,b)=>a.rows*a.cols-b.rows*b.cols);
  if(b.encId!=='auto'){const e=list.find(e=>e.id===b.encId);if(e)return{enc:e,need,auto:false}}
  return{enc:list.find(e=>e.rows*e.cols>=need)||list[list.length-1],need,auto:true};
}
function bom(proj){
  const rows={};let mods=0,encCost=0,ok=true,devCost=0;
  proj.boards.forEach(b=>{const prevB=S.projects[S.cur].cur;
    const a=analyze(b);const {enc}=chooseEnc(b,a.mods);
    if(proj.cables!==false){const cm={};a.cables.forEach(c=>{cm[c.sec]=cm[c.sec]||{cl:c.cl,m:0};cm[c.sec].m+=c.m});
      Object.entries(cm).forEach(([sec,c])=>{const k='cab'+sec;rows[k]=rows[k]||{p:{id:k,kind:'cable',name:`Cable Cu ${c.cl} mm² (metros)`,price:0.4+0.11*sec},qty:0};rows[k].qty+=Math.ceil(c.m)})}
    a.mods.forEach(m=>{const r=rows[m.p.id]||(rows[m.p.id]={p:m.p,qty:0});r.qty++;mods+=m.p.mod});
    const k=enc.id;rows['enc'+k]=rows['enc'+k]||{p:{name:enc.name+' (envolvente)',price:enc.price,kind:'enc',id:'enc'+k},qty:0};rows['enc'+k].qty++;
    if(a.issues.some(i=>i.lv==='err'))ok=false;
  });
  if(typeof houseBOM==='function')houseBOM(proj.house).forEach(r=>{rows[r.p.id]=r});
  return{rows:Object.values(rows),mods,ok};
}
function budget(proj){
  const bm=bom(proj),k=PRICELISTS[proj.list]?.k||1;
  const lines=bm.rows.map(r=>({...r,unit:r.p.price*k,tot:r.p.price*k*r.qty}));
  const mat=lines.reduce((s,l)=>s+l.tot,0),disc=mat*proj.discount/100,matNet=mat-disc;
  const auxAvg=proj.boards.length?proj.boards.reduce((s,b)=>s+b.aux,0)/proj.boards.length:0;
  const aux=matNet*auxAvg/100;
  const hours=proj.boards.reduce((s,b)=>s+analyze(b).mods.reduce((t,m)=>t+m.p.mod,0)*b.hours,0);
  const labor=hours*proj.rate,sub=matNet+aux+labor,mg=sub*proj.margin/100,base=sub+mg,vat=base*proj.vat/100;
  return{lines,mat,disc,matNet,aux,hours,labor,sub,mg,base,vat,total:base+vat,mods:bm.mods,ok:bm.ok};
}
// ---------- UI ----------
function render(){
  save();
  const proj=P();
  $('#proj').innerHTML=S.projects.map((p,i)=>`<option value="${i}" ${i===S.cur?'selected':''}>${esc(p.name)}</option>`).join('');
  $('#proj').onchange=e=>{S.cur=+e.target.value;selId=null;render()};
  const tabs=[['casa','Casa (plano)'],['design','Cuadro'],['diagram','Esquema unifilar'],['encl','Envolvente'],['m3d','Montaje 3D'],['budget','Presupuesto'],['catalog','Catálogo y envolventes'],['labels','Etiquetas'],['report','Informe'],['project','Proyecto']];
  $('#nav').innerHTML=tabs.map(([k,n])=>`<button class="${k===tab?'on':''}" onclick="go('${k}')">${n}</button>`).join('');
  const f={casa:vCasa,design:vDesign,diagram:vDiagram,encl:vEncl,budget:vBudget,catalog:vCatalog,report:vReport,labels:vLabels,m3d:vM3D,project:vProject}[tab];
  $('#app').innerHTML=boardBar()+f();
  if(tab==='design')wireDnD();
  if(tab==='m3d')M3D.mount();
  if(tab==='casa')casaMount();
}
window.go=t=>{tab=t;render()};
function boardBar(){
  if(['catalog','project','casa'].includes(tab))return'';
  const p=P();
  return`<div class="bar noprint"><b>Cuadro:</b>${p.boards.map((b,i)=>`<button class="b ${i===p.cur?'':'s'}" onclick="P().cur=${i};selId=null;render()">${esc(b.name)}</button>`).join('')}
  <button class="b s" onclick="addBoard()">+ Cuadro</button><button class="b s" onclick="dupBoard()">Duplicar</button><button class="b s" onclick="delBoard()">Eliminar</button></div>`;
}
window.addBoard=()=>{const p=P();p.boards.push(newBoard('Cuadro '+(p.boards.length+1)));p.cur=p.boards.length-1;selId=null;render()};
window.dupBoard=()=>{const p=P(),b=structuredClone(B());b.id=uid();b.name+=' (copia)';if(b.root)walk(b.root,n=>n.id=uid());p.boards.push(b);p.cur=p.boards.length-1;render()};
window.delBoard=()=>{const p=P();if(p.boards.length<2)return alert('Debe quedar al menos un cuadro.');if(!confirm('¿Eliminar el cuadro?'))return;p.boards.splice(p.cur,1);p.cur=0;selId=null;render()};
window.newProject=()=>{const n=prompt('Nombre del proyecto','Proyecto '+(S.projects.length+1));if(!n)return;S.projects.push(newProj(n));S.cur=S.projects.length-1;tab='design';render()};
window.delProject=()=>{if(S.projects.length<2)return alert('Debe quedar al menos un proyecto.');if(!confirm('¿Eliminar el proyecto "'+P().name+'"?'))return;S.projects.splice(S.cur,1);S.cur=0;render()};
window.exportJSON=()=>{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(S,null,1)],{type:'application/json'}));a.download='cuadroconfig-'+new Date().toISOString().slice(0,10)+'.json';a.click()};
window.importJSON=i=>{const f=i.files[0];if(!f)return;f.text().then(t=>{try{const s=JSON.parse(t);if(!s.projects||!s.catalog)throw 0;S=s;S.cur=0;render()}catch(e){alert('Archivo no válido')}});i.value=''};

function vDesign(){
  const b=B(),a=analyze(b),sel=selId&&find(selId).n?selId:null;
  const list=S.catalog.filter(p=>(!kindF||p.kind===kindF)&&(!filter||p.name.toLowerCase().includes(filter.toLowerCase())));
  const pal=`<div class="card"><h3>Aparatos</h3>
   <input placeholder="Buscar…" value="${esc(filter)}" onchange="filter=this.value;render()" style="width:100%">
   <select onchange="kindF=this.value;render()" style="width:100%;margin-top:4px"><option value="">Todos los tipos</option>${Object.entries(KINDS).map(([k,n])=>`<option value="${k}" ${k===kindF?'selected':''}>${n}</option>`).join('')}</select>
   <p class="muted" style="font-size:12px">Arrastra al árbol, o doble clic para añadir bajo el elemento seleccionado.</p>
   <div class="pal">${list.map(p=>`<div class="pi" draggable="true" data-p="${p.id}" ondblclick="addTo('${p.id}')">${esc(p.name)}<br><small>${p.icu?p.icu+' kA · ':''}${p.mod} mód. · ${eur(p.price)}</small></div>`).join('')}</div></div>`;
  const treeHtml=b.root?`<ul class="tree root">${nodeHtml(b.root,a,sel)}</ul>`:`<div class="drop" data-root="1">Arrastra aquí el aparato de cabecera</div>`;
  const tpl=`<div class="bar"><select onchange="if(this.value){applyTpl(this.value);}"><option value="">Plantilla de instalación…</option>${Object.entries(TPL).map(([k,n])=>`<option value="${k}">${n}</option>`).join('')}</select><button class="b s" onclick="clearBoard()">Vaciar</button><span style="flex:1"></span><button class="b" onclick="fixSizes()">Corregir calibres insuficientes</button></div>`;
  const center=`<div class="card"><h3>${esc(b.name)} — red eléctrica</h3>${tpl}${treeHtml}</div>`;
  const nErr=a.issues.filter(i=>i.lv==='err').length,nW=a.issues.filter(i=>i.lv==='warn').length;
  const tot=a.mods.reduce((s,m)=>s+m.p.mod,0),ce=chooseEnc(b,a.mods);
  const rootIb=b.root?a.info[b.root.id].ib:0;
  const kpi=`<div class="kpi"><div><b>${f1(rootIb)} A</b>Intensidad total</div><div><b>${f1(rootIb*a.V*(b.phases===3?Math.sqrt(3):1)*0.9/1000)} kW</b>Potencia aprox.</div><div><b>${tot} mód.</b>${esc(ce.enc.name)}</div>${b.phases===3&&b.root?`<div><b>${f1(a.ph.L1)} / ${f1(a.ph.L2)} / ${f1(a.ph.L3)} A</b>Fases L1 / L2 / L3</div>`:''}<div><b style="color:${nErr?'var(--er)':'var(--ok)'}">${nErr} err · ${nW} av.</b>Verificación</div></div>`;
  const insp=sel?inspector(find(sel).n,a):boardProps(b);
  const checks=`<div class="card"><h3>Verificaciones</h3>${a.issues.length?a.issues.map(i=>`<div class="chk ${i.lv}" ${i.id?`onclick="selId='${i.id}';render()" style="cursor:pointer"`:''}>${esc(i.msg)}</div>`).join(''):'<div class="chk ok">Sin incidencias. El cuadro cumple las comprobaciones.</div>'}</div>`;
  const vd=verdict(a);
  return`<div class="card"><div class="chk ${vd.lv}" style="font-size:15px;font-weight:700;margin:0 0 10px">${vd.lv==='ok'?'✔':vd.lv==='warn'?'⚠':'✖'} ${vd.txt}</div>${kpi}</div><div class="grid g3">${pal}${center}<div>${insp}${checks}</div></div>`;
}
function nodeHtml(n,a,sel){
  const i=a.info[n.id]||{p:{},lv:'ok',ib:0},p=i.p;
  return`<li><span class="nd ${i.lv==='ok'?'':i.lv} ${n.id===sel?'sel':''}" draggable="true" data-n="${n.id}" onclick="selId='${n.id}';render()">
   <span class="dot ${i.lv==='ok'?'':i.lv}"></span><span style="color:${KCOL[p.kind]||'#000'};font-weight:600">${esc(label(n))}</span>
   <small class="muted">${p.in?p.in+'A ':''}${p.poles?p.poles+'P':''}${n.qty>1?' ×'+n.qty:''} · Ib ${f1(i.ib)}A${n.kw&&!n.children.length?' · '+n.kw+'kW':''}</small></span>
   ${n.children.length?`<ul class="tree">${n.children.map(c=>nodeHtml(c,a,sel)).join('')}</ul>`:''}</li>`;
}
const b0=()=>B();
function inspector(n,a){
  const i=a.info[n.id],p=i.p;
  const same=S.catalog.filter(x=>x.kind===p.kind&&x.poles===p.poles).sort((x,y)=>x.in-y.in);
  return`<div class="card"><h3>${esc(label(n))}</h3>
  <label>Nombre del circuito</label><input value="${esc(n.label)}" onchange="upd('label',this.value)" style="width:100%">
  <label>Aparato (cambiar calibre)</label><select onchange="upd('pid',this.value)" style="width:100%">${same.map(x=>`<option value="${x.id}" ${x.id===n.pid?'selected':''}>${esc(x.name)}</option>`).join('')}</select>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">
   <div><label>Cantidad (circuitos iguales)</label><input type="number" min="1" value="${n.qty}" onchange="upd('qty',Math.max(1,Math.round(num(this.value,1))))"></div>
   ${n.children.length?'':`<div><label>Potencia por circuito (kW)</label><input type="number" step="0.1" min="0" value="${n.kw}" onchange="upd('kw',num(this.value))"></div>
   <div><label>cos φ</label><input type="number" step="0.01" min="0.1" max="1" value="${n.pf}" onchange="upd('pf',num(this.value,0.9))"></div>`}
   ${['load','motor'].includes(p.kind)?`<div><label>Tipo de receptor</label><select onchange="upd('ltype',this.value)">${Object.entries(LTYPES).map(([k,v])=>`<option value="${k}" ${(n.ltype||p.ltype)===k?'selected':''}>${v}</option>`).join('')}</select></div>`:''}
   ${p.kind==='motor'?`<div><label>Rendimiento η</label><input type="number" step="0.01" min="0.5" max="1" value="${n.eff||0.9}" onchange="upd('eff',num(this.value,0.9))"></div>
   <div><label>Arranque</label><select onchange="upd('start',this.value)">${[['dol','Directo'],['yd','Estrella-triángulo'],['soft','Arrancador suave'],['vfd','Variador']].map(([k,v])=>`<option value="${k}" ${(n.start||'dol')===k?'selected':''}>${v}</option>`).join('')}</select></div>
   <div><label>Ia/In del motor</label><input type="number" step="0.1" min="2" max="12" value="${n.iarr||6}" onchange="upd('iarr',num(this.value,6))"></div>`:''}
   <div><label>Longitud línea (m)</label><input type="number" min="0" value="${n.len}" onchange="upd('len',num(this.value))"></div></div>
  ${b0().phases===3&&p.poles<=2?`<label>Fase</label><select onchange="upd('ph',this.value)"><option value="">Automática</option>${['L1','L2','L3'].map(f=>`<option ${n.ph===f?'selected':''}>${f}</option>`).join('')}</select>`:''}
  ${i.cable?`<label>Sección de cable (mm²)</label><select onchange="upd('sec',this.value?num(this.value):0)"><option value="">Automática (${i.cl})</option>${CABLES.map(c=>`<option value="${c[0]}" ${n.sec===c[0]?'selected':''}>${c[2]||c[0]} (${c[1]} A)</option>`).join('')}</select>`:''}
  ${i.dv!=null?`<p style="margin:6px 0 0">Caída de tensión: <b>${f1(i.dv)}%</b></p>`:''}
  <p style="margin:8px 0 2px">Intensidad de cálculo: <b>${f1(i.ib)} A</b>${i.cable?` · Cable orientativo: <b>${i.cable}</b> (Cu, ref. B1)`:''}</p>
  <div class="bar"><button class="b s" onclick="dupNode()">Duplicar</button><button class="b d" onclick="delNode()">Eliminar</button></div></div>`;
}
function boardProps(b){
  return`<div class="card"><h3>Datos del cuadro</h3>
  <label>Nombre</label><input value="${esc(b.name)}" onchange="B().name=this.value;render()" style="width:100%">
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">
  <div><label>Sistema</label><select onchange="B().phases=+this.value;render()"><option value="3" ${b.phases===3?'selected':''}>Trifásico 400 V</option><option value="1" ${b.phases===1?'selected':''}>Monofásico 230 V</option></select></div>
  <div><label>Icc prevista (kA)</label><input type="number" step="0.5" value="${b.isc}" onchange="B().isc=num(this.value,6);render()"></div>
  <div style="grid-column:1/-1"><label>Tipo de instalación</label><select onchange="B().use=this.value;render()" style="width:100%">${Object.entries(USES).map(([k,v])=>`<option value="${k}" ${b.use===k?'selected':''}>${v}</option>`).join('')}</select></div>
  <div><label>Simultaneidad</label><input type="number" step="0.05" min="0.1" max="1" value="${b.ks}" onchange="B().ks=num(this.value,0.8);render()"></div>
  <div><label>Reserva espacio (%)</label><input type="number" value="${b.reserve}" onchange="B().reserve=num(this.value,25);render()"></div></div>
  <p class="muted" style="font-size:12px">Selecciona un elemento del árbol para editarlo.</p></div>`;
}
function wireDnD(){
  document.querySelectorAll('.pi').forEach(e=>e.ondragstart=ev=>{ev.dataTransfer.setData('text/plain','p:'+e.dataset.p)});
  document.querySelectorAll('.nd').forEach(e=>{
    e.ondragstart=ev=>{ev.dataTransfer.setData('text/plain','n:'+e.dataset.n);ev.stopPropagation()};
    e.ondragover=ev=>{ev.preventDefault();e.classList.add('over')};e.ondragleave=()=>e.classList.remove('over');
    e.ondrop=ev=>{ev.preventDefault();ev.stopPropagation();drop(ev.dataTransfer.getData('text/plain'),e.dataset.n)};
  });
  const r=document.querySelector('.drop');
  if(r){r.ondragover=ev=>ev.preventDefault();r.ondrop=ev=>{ev.preventDefault();drop(ev.dataTransfer.getData('text/plain'),null)}}
}
function drop(d,target){
  const b=B();
  if(d.startsWith('p:')){const p=prod(d.slice(2));if(!p)return;const n=mk(p);
    if(!target){if(b.root)return alert('Ya existe cabecera. Suelta sobre un elemento.');b.root=n}else find(target).n.children.push(n);selId=n.id}
  else if(d.startsWith('n:')){const id=d.slice(2);if(id===target)return;const {n}=find(id);if(!n)return;
    if(target&&isDesc(n,target))return alert('No se puede mover un elemento dentro de sí mismo.');
    if(!target)return;detach(id);find(target).n.children.push(n);selId=id}
  render();
}
window.addTo=pid=>{const b=B(),p=prod(pid),n=mk(p);if(!b.root){b.root=n}else{const t=selId&&find(selId).n?find(selId).n:b.root;t.children.push(n)}selId=n.id;render()};
window.upd=(k,v)=>{const {n}=find(selId);n[k]=v;render()};
window.delNode=()=>{if(!confirm('¿Eliminar este elemento y todo lo que cuelga de él?'))return;detach(selId);selId=null;render()};
window.dupNode=()=>{const {n,p}=find(selId);const c=clone(n);if(p)p.children.push(c);else return alert('La cabecera no se puede duplicar; duplica el cuadro.');selId=c.id;render()};
window.applyTpl=t=>{if(B().root&&!confirm('Se reemplazará el contenido del cuadro.'))return;template(B(),t);selId=null;render()};
window.clearBoard=()=>{if(!confirm('¿Vaciar el cuadro?'))return;B().root=null;selId=null;render()};

// ---------- esquema unifilar ----------
function vDiagram(){
  const b=B(),a=analyze(b);if(!b.root)return`<div class="card">Cuadro vacío.</div>`;
  let row=0;const pos={};
  (function lay(n,d){if(!n.children.length){pos[n.id]={x:20+d*200,y:20+row*54};row++}else{n.children.forEach(c=>lay(c,d+1));const ys=n.children.map(c=>pos[c.id].y);pos[n.id]={x:20+d*200,y:(Math.min(...ys)+Math.max(...ys))/2}}})(b.root,0);
  let maxX=0,maxY=0,body='';
  walk(b.root,(n,par)=>{const q=pos[n.id],i=a.info[n.id],p=i.p;maxX=Math.max(maxX,q.x+180);maxY=Math.max(maxY,q.y+50);
    if(par){const pp=pos[par.id];body+=`<path d="M${pp.x+170} ${pp.y+20} H${pp.x+185} V${q.y+20} H${q.x}" fill="none" stroke="#889" />`}
    const col=i.lv==='err'?'#c62828':i.lv==='warn'?'#e08a00':'#90a4ae';
    body+=`<g onclick="selId='${n.id}';tab='design';render()" style="cursor:pointer"><rect x="${q.x}" y="${q.y}" width="170" height="40" rx="5" fill="#fff" stroke="${col}" stroke-width="1.6"/><rect x="${q.x}" y="${q.y}" width="5" height="40" fill="${KCOL[p.kind]||'#444'}"/>
    <text x="${q.x+11}" y="${q.y+16}" font-weight="600">${esc(label(n)).slice(0,26)}${n.qty>1?' ×'+n.qty:''}</text>
    <text x="${q.x+11}" y="${q.y+31}" fill="#667">${p.in?p.in+'A ':''}${p.poles?p.poles+'P ':''}· Ib ${f1(i.ib)}A${i.cable?' · '+i.cable:''}</text></g>`});
  return`<div class="card" style="overflow:auto"><h3>Esquema unifilar — ${esc(b.name)}</h3><svg width="${maxX+30}" height="${maxY+20}">${body}</svg>
  <p class="muted noprint">Clic en un aparato para editarlo. Colores: rojo = error, naranja = aviso.</p><button class="b s noprint" onclick="window.print()">Imprimir / PDF</button></div>`;
}
// ---------- envolvente ----------
function vEncl(){
  const b=B(),a=analyze(b),ce=chooseEnc(b,a.mods),e=ce.enc,used=a.mods.reduce((s,m)=>s+m.p.mod,0);
  const W=22,H=44,pad=10;let r=0,c=0,rects='';
  a.mods.forEach(m=>{if(c+m.p.mod>e.cols){r++;c=0}
    if(r<e.rows)rects+=`<rect x="${pad+c*W}" y="${pad+r*(H+8)}" width="${m.p.mod*W-2}" height="${H}" rx="2" fill="${KCOL[m.p.kind]||'#555'}"><title>${esc(m.p.name)}</title></rect><text x="${pad+c*W+3}" y="${pad+r*(H+8)+26}" fill="#fff" font-size="9">${m.p.in||''}</text>`;
    c+=m.p.mod});
  const over=used>e.rows*e.cols||r>=e.rows;
  return`<div class="card"><h3>Envolvente — ${esc(b.name)}</h3>
  <div class="bar"><label style="margin:0">Envolvente:</label><select onchange="B().encId=this.value;render()"><option value="auto" ${b.encId==='auto'?'selected':''}>Automática (selección óptima)</option>${S.enclosures.map(x=>`<option value="${x.id}" ${x.id===b.encId?'selected':''}>${esc(x.name)}</option>`).join('')}</select></div>
  <div class="kpi"><div><b>${esc(e.name)}</b>${ce.auto?'Elegida automáticamente':'Elegida manualmente'}</div><div><b>${used} / ${e.rows*e.cols}</b>módulos usados</div><div><b>${Math.round(used/(e.rows*e.cols)*100)}%</b>ocupación</div></div>
  ${over?'<div class="chk err">Los aparatos no caben en la envolvente elegida.</div>':''}
  <div style="overflow:auto;margin-top:10px"><svg width="${pad*2+e.cols*W}" height="${pad*2+e.rows*(H+8)}" style="background:#eef2f5;border:2px solid #90a4ae;border-radius:6px">${rects}</svg></div>
  <p class="muted">Distribución orientativa por filas en orden del árbol (reserva ${b.reserve}% incluida en la elección automática).</p></div>`;
}
// ---------- presupuesto ----------
function vBudget(){
  const p=P(),t=budget(p);
  return`<div class="card"><h3>Presupuesto — ${esc(p.name)}</h3>
  <div class="kpi"><div><b>${eur(t.total)}</b>Total con IVA</div><div><b>${eur(t.base)}</b>Base imponible</div><div><b>${t.mods}</b>módulos totales</div><div><b style="color:${t.ok?'var(--ok)':'var(--er)'}">${t.ok?'Correcto':'Con errores'}</b>Verificación</div></div></div>
  <div class="card"><table><tr><th>Referencia / descripción</th><th class="r">Cant.</th><th class="r">Precio ud.</th><th class="r">Importe</th></tr>
  ${t.lines.sort((x,y)=>x.p.name.localeCompare(y.p.name)).map(l=>`<tr><td>${esc(l.p.name)}</td><td class="r">${l.qty}</td><td class="r">${eur(l.unit)}</td><td class="r">${eur(l.tot)}</td></tr>`).join('')}
  <tr class="tot"><td colspan="3">Material (${PRICELISTS[p.list].n})</td><td class="r">${eur(t.mat)}</td></tr>
  <tr><td colspan="3">Descuento ${p.discount}%</td><td class="r">-${eur(t.disc)}</td></tr>
  <tr><td colspan="3">Pequeño material y cableado interno</td><td class="r">${eur(t.aux)}</td></tr>
  <tr><td colspan="3">Montaje y cableado (${f1(t.hours)} h × ${eur(p.rate)})</td><td class="r">${eur(t.labor)}</td></tr>
  <tr><td colspan="3">Margen comercial ${p.margin}%</td><td class="r">${eur(t.mg)}</td></tr>
  <tr class="tot"><td colspan="3">Base imponible</td><td class="r">${eur(t.base)}</td></tr>
  <tr><td colspan="3">IVA ${p.vat}%</td><td class="r">${eur(t.vat)}</td></tr>
  <tr class="tot"><td colspan="3">TOTAL</td><td class="r">${eur(t.total)}</td></tr></table>
  <div class="bar noprint" style="margin-top:10px"><button class="b" onclick="csv()">Exportar CSV</button><button class="b s" onclick="window.print()">Imprimir / PDF</button><span class="muted">Ajusta tarifa, descuento, margen e IVA en la pestaña «Proyecto».</span></div></div>`;
}
window.csv=()=>{const p=P(),t=budget(p);const q=s=>'"'+String(s).replace(/"/g,'""')+'"';
  const rows=[['Descripción','Cantidad','Precio ud.','Importe'],...t.lines.map(l=>[l.p.name,l.qty,l.unit.toFixed(2),l.tot.toFixed(2)]),['Material','','',t.mat.toFixed(2)],['Descuento','','',(-t.disc).toFixed(2)],['Pequeño material','','',t.aux.toFixed(2)],['Montaje','','',t.labor.toFixed(2)],['Margen','','',t.mg.toFixed(2)],['Base imponible','','',t.base.toFixed(2)],['IVA','','',t.vat.toFixed(2)],['TOTAL','','',t.total.toFixed(2)]];
  const a=document.createElement('a');a.href=URL.createObjectURL(new Blob(['﻿'+rows.map(r=>r.map(q).join(';')).join('\n')],{type:'text/csv'}));a.download=p.name+'.csv';a.click()};
// ---------- catálogo ----------
function vCatalog(){
  return`<div class="card"><h3>Catálogo de aparatos (precios editables)</h3>
  <div class="bar"><button class="b" onclick="addProd()">+ Aparato personalizado</button><button class="b s" onclick="if(confirm('¿Restaurar catálogo y envolventes por defecto?')){S.catalog=structuredClone(DEFAULT_CATALOG);S.enclosures=structuredClone(ENCLOSURES);render()}">Restaurar por defecto</button></div>
  <div style="max-height:60vh;overflow:auto"><table><tr><th>Nombre</th><th>Tipo</th><th>In (A)</th><th>Polos</th><th>Icu kA</th><th>Mód.</th><th>Precio €</th><th></th></tr>
  ${S.catalog.map(p=>`<tr><td><input value="${esc(p.name)}" style="width:100%" onchange="cp('${p.id}','name',this.value)"></td>
   <td><select onchange="cp('${p.id}','kind',this.value)">${Object.entries(KINDS).map(([k,n])=>`<option value="${k}" ${k===p.kind?'selected':''}>${n}</option>`).join('')}</select></td>
   ${['in','poles','icu','mod','price'].map(f=>`<td><input type="number" step="any" style="width:72px" value="${p[f]}" onchange="cp('${p.id}','${f}',num(this.value))"></td>`).join('')}
   <td><button class="b d" onclick="delProd('${p.id}')">✕</button></td></tr>`).join('')}</table></div></div>
  <div class="card"><h3>Envolventes</h3><table><tr><th>Nombre</th><th>Filas</th><th>Módulos/fila</th><th>Precio €</th></tr>
  ${S.enclosures.map(e=>`<tr><td><input value="${esc(e.name)}" style="width:100%" onchange="ce('${e.id}','name',this.value)"></td>${['rows','cols','price'].map(f=>`<td><input type="number" style="width:80px" value="${e[f]}" onchange="ce('${e.id}','${f}',num(this.value))"></td>`).join('')}</tr>`).join('')}</table></div>`;
}
window.cp=(id,f,v)=>{prod(id)[f]=v;render()};window.ce=(id,f,v)=>{S.enclosures.find(e=>e.id===id)[f]=v;render()};
window.addProd=()=>{S.catalog.unshift({id:'c'+uid(),name:'Aparato personalizado',kind:'other',in:0,poles:2,icu:0,mod:2,price:10});render()};
window.delProd=id=>{if(S.projects.some(p=>p.boards.some(b=>{let u=false;walk(b.root,n=>{if(n.pid===id)u=true});return u})))return alert('Este aparato se usa en un cuadro.');S.catalog=S.catalog.filter(p=>p.id!==id);render()};
// ---------- proyecto ----------
function vProject(){
  const p=P(),f=(l,k,t='text',st='')=>`<div><label>${l}</label><input type="${t}" ${st} value="${esc(p[k])}" onchange="P().${k}=${t==='number'?'num(this.value)':'this.value'};render()" style="width:100%"></div>`;
  return`<div class="card"><h3>Datos del proyecto</h3><div class="grid g2">${f('Nombre','name')}${f('Cliente','client')}
  <div><label>Lista de precios</label><select onchange="P().list=+this.value;render()" style="width:100%">${PRICELISTS.map((l,i)=>`<option value="${i}" ${i===p.list?'selected':''}>${l.n}</option>`).join('')}</select></div>
  <div><label>Modo (potencia máxima de cabecera)</label><select onchange="P().mode=this.value;render()" style="width:100%"><option value="400" ${p.mode==='400'?'selected':''}>Residencial / pequeño terciario (≤ 400 A)</option><option value="4000" ${p.mode!=='400'?'selected':''}>Terciario e industrial (≤ 4000 A)</option></select></div>
  ${f('Descuento (%)','discount','number','step="0.5"')}${f('Margen comercial (%)','margin','number','step="0.5"')}${f('IVA (%)','vat','number')}${f('Precio mano de obra (€/h)','rate','number')}</div></div>
  <div class="card"><h3>Por cuadro</h3><table><tr><th>Cuadro</th><th>Pequeño material (%)</th><th>Horas por módulo</th></tr>${p.boards.map(b=>`<tr><td>${esc(b.name)}</td><td><input type="number" value="${b.aux}" onchange="P().boards.find(x=>x.id=='${b.id}').aux=num(this.value);render()"></td><td><input type="number" step="0.01" value="${b.hours}" onchange="P().boards.find(x=>x.id=='${b.id}').hours=num(this.value);render()"></td></tr>`).join('')}</table></div>`;
}
// ---------- informe ----------
function vReport(){
  const p=P(),t=budget(p);
  const boards=p.boards.map(b=>{const a=analyze(b),ce=chooseEnc(b,a.mods);const rows=[];if(b.root)walk(b.root,(n,par,d)=>{const i=a.info[n.id];rows.push(`<tr><td style="padding-left:${6+d*16}px">${esc(label(n))}</td><td>${esc(i.p.name)}</td><td class="r">${n.qty}</td><td class="r">${f1(i.ib)}</td><td>${i.cable||''}</td><td>${i.lv==='ok'?'✔':i.lv==='warn'?'⚠':'✖'}</td></tr>`)});
    return`<div class="card"><h3>${esc(b.name)}</h3><p class="muted">${b.phases===3?'Trifásico 400 V':'Monofásico 230 V'} · Icc ${b.isc} kA · Simultaneidad ${b.ks} · ${esc(ce.enc.name)}</p>
    <table><tr><th>Circuito</th><th>Aparato</th><th class="r">Cant.</th><th class="r">Ib (A)</th><th>Cable</th><th></th></tr>${rows.join('')}</table>
    ${a.issues.map(i=>`<div class="chk ${i.lv}">${esc(i.msg)}</div>`).join('')}</div>`}).join('');
  const hs=p.house&&p.house.items.length?houseIssues(p.house):[];
  const hcard=hs.length||(p.house&&p.house.items.length)?`<div class="card"><h3>Casa: validación de todas las instalaciones</h3>${hs.length?hs.map(i=>`<div class="chk ${i.lv}"><b>${HCAT[i.cat].n}:</b> ${esc(i.msg)}</div>`).join(''):'<div class="chk ok">Sin fallos ni avisos.</div>'}</div>`:'';
  return hcard+`<div class="card"><h1 style="margin:0">${esc(p.name)}</h1><p>Cliente: ${esc(p.client||'—')} · Fecha: ${new Date().toLocaleDateString('es-ES')}</p>
  <div class="kpi"><div><b>${eur(t.total)}</b>Total con IVA</div><div><b>${p.boards.length}</b>cuadros</div><div><b>${t.mods}</b>módulos</div></div>
  <div class="bar noprint" style="margin-top:8px"><button class="b" onclick="window.print()">Imprimir / guardar PDF</button></div></div>${boards}
  <div class="card"><h3>Resumen económico</h3><table><tr><td>Material</td><td class="r">${eur(t.matNet)}</td></tr><tr><td>Pequeño material + montaje</td><td class="r">${eur(t.aux+t.labor)}</td></tr><tr><td>Margen</td><td class="r">${eur(t.mg)}</td></tr><tr class="tot"><td>Base imponible</td><td class="r">${eur(t.base)}</td></tr><tr><td>IVA ${p.vat}%</td><td class="r">${eur(t.vat)}</td></tr><tr class="tot"><td>TOTAL</td><td class="r">${eur(t.total)}</td></tr></table>
  <p class="muted" style="font-size:12px">Cálculos orientativos. Verificar por técnico competente conforme al REBT/IEC 61439 antes de fabricar o instalar.</p></div>`;
}
S=load();render();

// ---------- corrección automática de calibres ----------
window.fixSizes=()=>{const b=B();if(!b.root)return;const a=analyze(b);let n=0,fail=0;
  walk(b.root,x=>{const i=a.info[x.id],p=i.p;if(p.in>0&&i.ib>p.in&&['mcb','rcd','rcbo','incomer'].includes(p.kind)){
    const c=S.catalog.filter(q=>q.kind===p.kind&&q.poles===p.poles&&(q.ma||0)===(p.ma||0)&&q.in>=i.ib&&q.icu>=Math.min(p.icu,b.isc)).sort((u,v)=>u.in-v.in)[0];
    if(c){x.pid=c.id;n++}else fail++}});
  alert(n?`Se han corregido ${n} aparato(s).`+(fail?` ${fail} sin alternativa en el catálogo.`:''):(fail?`${fail} aparato(s) sin alternativa en el catálogo.`:'No hay calibres insuficientes.'));render()};
// ---------- deshacer / rehacer ----------
let hist=[],hi=-1,restoring=false;
function snap(){const j=JSON.stringify(S);if(restoring||hist[hi]===j)return;hist=hist.slice(0,hi+1);hist.push(j);if(hist.length>60)hist.shift();hi=hist.length-1}
window.undo=()=>{if(hi<=0)return;hi--;restoring=true;S=JSON.parse(hist[hi]);selId=null;render();restoring=false};
window.redo=()=>{if(hi>=hist.length-1)return;hi++;restoring=true;S=JSON.parse(hist[hi]);selId=null;render();restoring=false};
document.addEventListener('keydown',e=>{if(!(e.ctrlKey||e.metaKey)||/INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName))return;
  if(e.key==='z'){e.preventDefault();undo()}else if(e.key==='y'){e.preventDefault();redo()}});
const _render=render;render=function(){snap();_render()};
snap();
// ---------- etiquetas ----------
function vLabels(){
  const b=B(),a=analyze(b),items=[];
  if(b.root)walk(b.root,(n)=>{const i=a.info[n.id];if(i.p.in>0||['spd','meter'].includes(i.p.kind))for(let q=0;q<n.qty;q++)items.push({n,i,q})});
  return`<div class="card"><h3>Etiquetas de circuitos — ${esc(b.name)}</h3><div class="bar noprint"><button class="b" onclick="window.print()">Imprimir etiquetas</button></div>
  <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:6px">
  ${items.map(({n,i,q})=>`<div style="border:1.5px solid #333;border-radius:4px;padding:6px 8px"><b>${esc(label(n))}${n.qty>1?' '+(q+1):''}</b><br><span style="font-size:12px">${i.p.in?i.p.in+' A · ':''}${i.p.poles}P${i.p.ma?' · '+i.p.ma+' mA':''}${i.cable&&!n.children.length?' · '+i.cable:''}</span></div>`).join('')}</div></div>`;
}

// ---------- hoja de montaje (orden, calibre, sección) ----------
const PHC={L1:'marrón',L2:'negro',L3:'gris'};
function condText(i){const p=i.p;if(p.poles>=3)return 'L1 marrón, L2 negro, L3 gris'+(p.poles>=4?', N azul':'')+', PE verde-amarillo';return (PHC[i.phase||'L1'])+' ('+(i.phase||'L1')+'), N azul, PE verde-amarillo'}
function orderList(b){const a=analyze(b),rows=[];let k=0;
  walk(b.root,(n,par,d)=>{const i=a.info[n.id];k++;rows.push({ord:k,n,par,d,i,p:i.p})});return{rows,a}}
function vM3D(){
  return`<div class="bar noprint"><button class="b ${M3D.view==='cuadro'?'':'s'}" onclick="M3D.setView('cuadro');render()">Cuadro</button><button class="b ${M3D.view==='instalacion'?'':'s'}" onclick="M3D.setView('instalacion');render()">Instalación completa</button><button class="b ${M3D.view==='casa'?'':'s'}" onclick="M3D.setView('casa');render()">Casa 3D</button><span style="width:10px"></span><button class="b ${M3D.mode==='build'?'':'s'}" onclick="M3D.setMode('build')">1 · Montaje</button><button class="b ${M3D.mode==='demo'?'':'s'}" onclick="M3D.setMode('demo')">2 · Demostración y fallos</button>
  <label style="margin:0 0 0 10px"><input type="checkbox" id="m-door" onchange="M3D.door(this.checked)"> Puerta</label>
  <button class="b s" onclick="M3D.auto()">Montaje automático</button><button class="b s" onclick="M3D.clear()">Vaciar carril</button><button class="b s" onclick="M3D.resetCam()">Cámara</button></div>
  <div class="grid g3"><div class="card" id="m-left" style="max-height:72vh;overflow:auto"></div>
  <div class="card m-center" style="padding:0;overflow:hidden;align-self:start"><div id="m-wrap" style="position:relative;height:62vh;min-height:380px;background:#cfd8de"><canvas id="m-cv" style="width:100%;height:100%;display:block;touch-action:none"></canvas>
  <div id="m-banner" style="position:absolute;left:8px;right:8px;top:8px;pointer-events:none"></div><div id="m-hint" style="position:absolute;left:8px;bottom:6px;font-size:12px;color:#334;background:#fffc;padding:3px 7px;border-radius:5px"></div></div></div>
  <div id="m-right" style="max-height:72vh;overflow:auto"></div></div>`;
}

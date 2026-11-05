'use strict';
const KEY='cuadroconfig-v1';
const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const num=(v,d=0)=>{const x=parseFloat(String(v).replace(',','.'));return isFinite(x)?x:d};
const eur=v=>(v||0).toLocaleString('es-ES',{style:'currency',currency:'EUR'});
const f1=v=>(Math.round(v*10)/10).toLocaleString('es-ES');
let _id=Date.now()%1e7;const uid=()=>'n'+(++_id).toString(36);
const KINDS={incomer:'Cabecera / general',mcb:'Magnetotérmico',rcd:'Diferencial',rcbo:'Mag.+Diferencial',contactor:'Contactor',spd:'Sobretensiones',meter:'Contador',other:'Otros'};
const KCOL={incomer:'#37474f',mcb:'#1565c0',rcd:'#6a1b9a',rcbo:'#8e24aa',contactor:'#ef6c00',spd:'#c62828',meter:'#00838f',other:'#6d4c41'};
const PRICELISTS=[{n:'Tarifa estándar',k:1},{n:'Tarifa profesional (-12%)',k:0.88},{n:'Tarifa gran cuenta (-20%)',k:0.8}];

let S, tab='design', selId=null, filter='', kindF='', dragId=null;

function newBoard(name='Cuadro general'){return{id:uid(),name,phases:3,isc:10,ks:0.8,reserve:25,encId:'auto',aux:8,hours:0.12,root:null}}
function newProj(name='Proyecto nuevo'){return{id:uid(),name,client:'',list:0,discount:0,margin:15,vat:21,rate:38,mode:'4000',boards:[newBoard()],cur:0}}
function load(){
  try{const s=JSON.parse(localStorage.getItem(KEY));if(s&&s.projects&&s.projects.length)return s}catch(e){}
  S={projects:[],cur:0,catalog:structuredClone(DEFAULT_CATALOG),enclosures:structuredClone(ENCLOSURES)};
  const p=newProj('Proyecto de ejemplo');p.client='Cliente demo';template(p.boards[0],'local');
  S.projects.push(p);return S;
}
function save(){try{localStorage.setItem(KEY,JSON.stringify(S))}catch(e){}}
const P=()=>S.projects[S.cur], B=()=>P().boards[P().cur]||P().boards[0];
const prod=id=>S.catalog.find(p=>p.id===id);
const findProd=(kind,inA,poles,ma)=>S.catalog.find(p=>p.kind===kind&&p.in===inA&&p.poles===poles&&(!ma||p.ma===ma));
function mk(p,o={}){return{id:uid(),pid:p.id,label:'',qty:1,kw:0,pf:0.9,len:20,children:[],...o}}
// ---------- plantillas ----------
function template(b,t){
  const g=(k,i,p,ma)=>findProd(k,i,p,ma);
  if(t==='vivienda'){
    b.name='Cuadro vivienda';b.phases=1;b.isc=6;b.ks=0.7;
    const r=mk(g('incomer',63,2),{label:'IGA'});
    const d1=mk(g('rcd',40,2,30),{label:'Diferencial A'}),d2=mk(g('rcd',40,2,30),{label:'Diferencial B'});
    d1.children=[mk(g('mcb',10,2),{label:'C1 Alumbrado',kw:1.2}),mk(g('mcb',16,2),{label:'C2 Tomas',kw:2.5}),mk(g('mcb',25,2),{label:'C3 Cocina/horno',kw:4.5}),mk(g('mcb',20,2),{label:'C4 Lavadora/lavavajillas',kw:3.5})];
    d2.children=[mk(g('mcb',16,2),{label:'C5 Baño/cocina',kw:2.5}),mk(g('mcb',25,2),{label:'C6 Aire acondicionado',kw:3}),mk(g('mcb',16,2),{label:'C7 Tomas auxiliares',kw:2.5})];
    r.children=[mk(g('spd',0,2),{label:'Sobretensiones'}),d1,d2];b.root=r;
  }else{
    b.name='Cuadro general local';b.phases=3;b.isc=6;b.ks=0.8;
    const r=mk(g('incomer',160,4),{label:'General'});
    const m=mk(g('meter',0,4),{label:'Contador'});
    const dF=mk(g('rcd',63,4,300),{label:'Dif. fuerza 300mA'});
    dF.children=[mk(g('mcb',32,3),{label:'Motor / clima',kw:12}),mk(g('mcb',25,3),{label:'Compresor',kw:9})];
    const dL=mk(g('rcd',40,4,30),{label:'Dif. alumbrado/tomas 30mA'});
    dL.children=[mk(g('mcb',10,2),{label:'Alumbrado',kw:1.4,qty:3}),mk(g('mcb',16,2),{label:'Tomas',kw:2.3,qty:4}),mk(g('mcb',20,2),{label:'Tomas SAI',kw:3.2})];
    r.children=[m,mk(g('spd',0,4),{label:'Sobretensiones'}),dF,dL];b.root=r;
  }
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
  const info={},issues=[],V=b.phases===3?400:230,mode=num(P().mode,4000);
  const add=(lv,id,msg)=>{issues.push({lv,id,msg});if(id&&info[id]){const o=info[id];if(lv==='err'||(lv==='warn'&&o.lv!=='err'))o.lv=lv}};
  function calc(n,par,rcdUp,eq){
    const p=prod(n.pid)||{kind:'other',in:0,poles:2,icu:0,mod:1,name:'?'};
    const o=info[n.id]={p,ib:0,lv:'ok',eq,cable:null};
    const three=p.poles>=3;
    let ib=0;
    const hasRcd=rcdUp||p.kind==='rcd'||p.kind==='rcbo';
    if(n.children.length){
      let s=0;n.children.forEach(c=>{const cp=prod(c.pid);const ci=calc(c,n,hasRcd,eq*n.qty);
        const single=cp&&cp.poles<=2;
        s+=ci*c.qty*((three&&b.phases===3&&single)?1/3:1);
        if(cp&&cp.poles>=3&&p.poles<=2&&p.kind!=='other')add('err',c.id,`Receptor trifásico (${cp.poles}P) bajo un aparato monofásico (${p.poles}P).`);
      });
      ib=n.children.length>1?s*b.ks:s;
    }else if(n.kw>0){
      ib=three?n.kw*1000/(Math.sqrt(3)*400*(n.pf||0.9)):n.kw*1000/(230*(n.pf||0.9));
    }
    o.ib=ib;
    if(p.in>0){
      if(ib>p.in)add('err',n.id,`${label(n)}: intensidad de cálculo ${f1(ib)} A supera el calibre ${p.in} A.`);
      else if(ib>0.9*p.in)add('warn',n.id,`${label(n)}: carga al ${Math.round(ib/p.in*100)}% del calibre.`);
      if(par){const pp=prod(par.pid);if(pp&&pp.in>0&&p.in>pp.in&&['mcb','rcbo','rcd','incomer'].includes(p.kind))
        add('warn',n.id,`${label(n)}: calibre ${p.in} A mayor que el del aparato superior (${pp.in} A).`);
        else if(pp&&pp.in>0&&p.in>0&&pp.in/p.in<1.6&&pp.kind==='mcb'&&p.kind==='mcb')add('info',n.id,`${label(n)}: relación de calibres <1,6 con el superior; selectividad dudosa.`);}
      const need=Math.max(ib,0);
      const ampacity=Math.max(p.in,need);
      const c=CABLES.find(c=>c[1]>=ampacity)||CABLES[CABLES.length-1];o.cable=c[2]||(c[0]+' mm²');if(c[2])o.cable=c[2]+' mm²';
    }
    if(['mcb','rcbo','incomer'].includes(p.kind)&&p.icu>0&&p.icu<b.isc)add('err',n.id,`${label(n)}: poder de corte ${p.icu} kA inferior a la Icc prevista (${b.isc} kA).`);
    if(['mcb'].includes(p.kind)&&!n.children.length&&!hasRcd&&p.poles<=2)add('warn',n.id,`${label(n)}: circuito final sin protección diferencial aguas arriba.`);
    if(!par&&p.kind!=='incomer')add('warn',n.id,'La cabecera del cuadro debería ser un aparato de corte general.');
    if(!par&&p.in>mode)add('err',n.id,`Calibre ${p.in} A supera el límite del modo ${mode===400?'EcoSet-400 (≤400 A)':'4000 (≤4000 A)'}.`);
    if(b.phases===1&&p.poles>=4&&p.kind!=='spd'&&p.kind!=='meter')add('info',n.id,`${label(n)}: aparato tetrapolar en cuadro monofásico.`);
    return ib;
  }
  if(!b.root){return{info,issues:[{lv:'warn',id:null,msg:'El cuadro está vacío: arrastra un aparato de cabecera.'}],mods:[],V}}
  calc(b.root,null,false,1);
  // módulos
  const mods=[];
  walk(b.root,(n)=>{const p=info[n.id]?.p;if(!p)return;let q=1;let a=n;/* qty efectiva */q=info[n.id].eq*n.qty;for(let i=0;i<q;i++)mods.push({n,p})});
  return{info,issues,mods,V};
}
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
    a.mods.forEach(m=>{const r=rows[m.p.id]||(rows[m.p.id]={p:m.p,qty:0});r.qty++;mods+=m.p.mod});
    const k=enc.id;rows['enc'+k]=rows['enc'+k]||{p:{name:enc.name+' (envolvente)',price:enc.price,kind:'enc',id:'enc'+k},qty:0};rows['enc'+k].qty++;
    if(a.issues.some(i=>i.lv==='err'))ok=false;
  });
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
  const tabs=[['design','Diseño'],['diagram','Esquema unifilar'],['encl','Envolvente'],['budget','Presupuesto'],['catalog','Catálogo y envolventes'],['report','Informe'],['project','Proyecto']];
  $('#nav').innerHTML=tabs.map(([k,n])=>`<button class="${k===tab?'on':''}" onclick="go('${k}')">${n}</button>`).join('');
  const f={design:vDesign,diagram:vDiagram,encl:vEncl,budget:vBudget,catalog:vCatalog,report:vReport,project:vProject}[tab];
  $('#app').innerHTML=boardBar()+f();
  if(tab==='design')wireDnD();
}
window.go=t=>{tab=t;render()};
function boardBar(){
  if(['catalog','project'].includes(tab))return'';
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
  const tpl=`<div class="bar"><span class="muted">Plantillas:</span><button class="b s" onclick="applyTpl('vivienda')">Vivienda</button><button class="b s" onclick="applyTpl('local')">Local trifásico</button><button class="b s" onclick="clearBoard()">Vaciar</button></div>`;
  const center=`<div class="card"><h3>${esc(b.name)} — red eléctrica</h3>${tpl}${treeHtml}</div>`;
  const nErr=a.issues.filter(i=>i.lv==='err').length,nW=a.issues.filter(i=>i.lv==='warn').length;
  const tot=a.mods.reduce((s,m)=>s+m.p.mod,0),ce=chooseEnc(b,a.mods);
  const rootIb=b.root?a.info[b.root.id].ib:0;
  const kpi=`<div class="kpi"><div><b>${f1(rootIb)} A</b>Intensidad total</div><div><b>${f1(rootIb*a.V*(b.phases===3?Math.sqrt(3):1)*0.9/1000)} kW</b>Potencia aprox.</div><div><b>${tot} mód.</b>${esc(ce.enc.name)}</div><div><b style="color:${nErr?'var(--er)':'var(--ok)'}">${nErr} err · ${nW} av.</b>Verificación</div></div>`;
  const insp=sel?inspector(find(sel).n,a):boardProps(b);
  const checks=`<div class="card"><h3>Verificaciones</h3>${a.issues.length?a.issues.map(i=>`<div class="chk ${i.lv}" ${i.id?`onclick="selId='${i.id}';render()" style="cursor:pointer"`:''}>${esc(i.msg)}</div>`).join(''):'<div class="chk ok">Sin incidencias. El cuadro cumple las comprobaciones.</div>'}</div>`;
  return`<div class="card">${kpi}</div><div class="grid g3">${pal}${center}<div>${insp}${checks}</div></div>`;
}
function nodeHtml(n,a,sel){
  const i=a.info[n.id]||{p:{},lv:'ok',ib:0},p=i.p;
  return`<li><span class="nd ${i.lv==='ok'?'':i.lv} ${n.id===sel?'sel':''}" draggable="true" data-n="${n.id}" onclick="selId='${n.id}';render()">
   <span class="dot ${i.lv==='ok'?'':i.lv}"></span><span style="color:${KCOL[p.kind]||'#000'};font-weight:600">${esc(label(n))}</span>
   <small class="muted">${p.in?p.in+'A ':''}${p.poles?p.poles+'P':''}${n.qty>1?' ×'+n.qty:''} · Ib ${f1(i.ib)}A${n.kw&&!n.children.length?' · '+n.kw+'kW':''}</small></span>
   ${n.children.length?`<ul class="tree">${n.children.map(c=>nodeHtml(c,a,sel)).join('')}</ul>`:''}</li>`;
}
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
   <div><label>Longitud línea (m)</label><input type="number" min="0" value="${n.len}" onchange="upd('len',num(this.value))"></div></div>
  <p style="margin:8px 0 2px">Intensidad de cálculo: <b>${f1(i.ib)} A</b>${i.cable?` · Cable orientativo: <b>${i.cable}</b> (Cu, ref. B1)`:''}</p>
  <div class="bar"><button class="b s" onclick="dupNode()">Duplicar</button><button class="b d" onclick="delNode()">Eliminar</button></div></div>`;
}
function boardProps(b){
  return`<div class="card"><h3>Datos del cuadro</h3>
  <label>Nombre</label><input value="${esc(b.name)}" onchange="B().name=this.value;render()" style="width:100%">
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">
  <div><label>Sistema</label><select onchange="B().phases=+this.value;render()"><option value="3" ${b.phases===3?'selected':''}>Trifásico 400 V</option><option value="1" ${b.phases===1?'selected':''}>Monofásico 230 V</option></select></div>
  <div><label>Icc prevista (kA)</label><input type="number" step="0.5" value="${b.isc}" onchange="B().isc=num(this.value,6);render()"></div>
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
  return`<div class="card"><h1 style="margin:0">${esc(p.name)}</h1><p>Cliente: ${esc(p.client||'—')} · Fecha: ${new Date().toLocaleDateString('es-ES')}</p>
  <div class="kpi"><div><b>${eur(t.total)}</b>Total con IVA</div><div><b>${p.boards.length}</b>cuadros</div><div><b>${t.mods}</b>módulos</div></div>
  <div class="bar noprint" style="margin-top:8px"><button class="b" onclick="window.print()">Imprimir / guardar PDF</button></div></div>${boards}
  <div class="card"><h3>Resumen económico</h3><table><tr><td>Material</td><td class="r">${eur(t.matNet)}</td></tr><tr><td>Pequeño material + montaje</td><td class="r">${eur(t.aux+t.labor)}</td></tr><tr><td>Margen</td><td class="r">${eur(t.mg)}</td></tr><tr class="tot"><td>Base imponible</td><td class="r">${eur(t.base)}</td></tr><tr><td>IVA ${p.vat}%</td><td class="r">${eur(t.vat)}</td></tr><tr class="tot"><td>TOTAL</td><td class="r">${eur(t.total)}</td></tr></table>
  <p class="muted" style="font-size:12px">Cálculos orientativos. Verificar por técnico competente conforme al REBT/IEC 61439 antes de fabricar o instalar.</p></div>`;
}
S=load();render();

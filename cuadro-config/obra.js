'use strict';
/* Ofertas comparables (versiones del proyecto) y planificación de obra (mediciones y cronograma) */
window.XT=window.XT||[];
/* ---------- ofertas / variantes ---------- */
let ofA='',ofB='';
function strip(p){const q=structuredClone(p);delete q.variants;if(q.house)delete q.house.bg;return q}
function withProj(snap,fn){const tmp=structuredClone(snap);tmp.id='tmp_'+uid();S.projects.push(tmp);const sv=S.cur;S.cur=S.projects.length-1;try{return fn(tmp)}finally{S.cur=sv;S.projects.splice(S.projects.findIndex(x=>x.id===tmp.id),1)}}
function summarize(snap){return withProj(snap,tp=>{const t=budget(tp),errs=tp.boards.reduce((s,b)=>s+analyze(b).issues.filter(i=>i.lv==='err').length,0),warns=tp.boards.reduce((s,b)=>s+analyze(b).issues.filter(i=>i.lv==='warn').length,0),h=tp.house&&tp.house.items.length?houseIssues(tp.house):[];
  return{total:t.total,base:t.base,mat:t.matNet,labor:t.labor,hours:t.hours,mg:t.mg,mods:t.mods,errs:errs+h.filter(i=>i.lv==='err').length,warns:warns+h.filter(i=>i.lv==='warn').length,items:tp.house?tp.house.items.length:0,lines:Object.fromEntries(t.lines.map(l=>[l.p.name,l.qty]))}})}
const curSnap=()=>strip(P());
window.ofSave=()=>{const n=(document.getElementById('of-name').value||'').trim()||('Versión '+((P().variants||[]).length+1));(P().variants=P().variants||[]).push({id:uid(),name:n,at:new Date().toISOString(),snap:curSnap()});render()};
window.ofDel=i=>{if(!confirm('¿Borrar esta versión?'))return;P().variants.splice(i,1);render()};
window.ofRestore=i=>{if(!confirm('Se sustituirá el proyecto actual por «'+P().variants[i].name+'». Guarda antes la versión actual si la quieres conservar.'))return;const v=P().variants,s=structuredClone(v[i].snap),keep=P().id,nm=P().name;Object.keys(P()).forEach(k=>{if(k!=='variants')delete P()[k]});Object.assign(P(),s,{id:keep,name:nm,variants:v});render()};
window.ofAsProject=i=>{const s=structuredClone(P().variants[i].snap);s.id=uid();s.name=P().name+' · '+P().variants[i].name;S.projects.push(s);S.cur=S.projects.length-1;render()};
window.ofSel=(w,v)=>{if(w==='a')ofA=v;else ofB=v;render()};
function pick(id){return id==='cur'||!id?{name:'Proyecto actual',snap:curSnap()}:(P().variants||[]).find(v=>v.id===id)||{name:'Proyecto actual',snap:curSnap()}}
function vOfertas(){
  const vs=P().variants||[];if(!ofA)ofA='cur';if(!ofB)ofB=vs[0]?vs[0].id:'cur';
  const opts=sel=>`<option value="cur" ${sel==='cur'?'selected':''}>Proyecto actual</option>`+vs.map(v=>`<option value="${v.id}" ${sel===v.id?'selected':''}>${esc(v.name)}</option>`).join('');
  const A=pick(ofA),B=pick(ofB),sa=summarize(A.snap),sb=summarize(B.snap);
  const row=(l,f,fmt,good)=>{const a=f(sa),b=f(sb),d=b-a;return`<tr><td>${l}</td><td class="r">${fmt(a)}</td><td class="r">${fmt(b)}</td><td class="r" style="color:${d===0?'inherit':(good?d<0:d>0)?'#2e7d32':'#c62828'}">${d===0?'—':(d>0?'+':'')+fmt(d)}</td></tr>`};
  const names=[...new Set([...Object.keys(sa.lines),...Object.keys(sb.lines)])].filter(n=>(sa.lines[n]||0)!==(sb.lines[n]||0)).sort();
  return`<div class="card"><h3>Ofertas: compara versiones del mismo proyecto</h3><p class="muted" style="margin:0 0 6px;font-size:12.5px">Guarda la versión actual con un nombre (por ejemplo «Básica»), cambia el proyecto (otro cuadro, más puntos, otras protecciones…) y compáralas lado a lado.</p>
  <div class="bar"><input id="of-name" placeholder="Nombre de la versión (Básica, Confort…)" style="min-width:220px"><button class="b" onclick="ofSave()">Guardar versión actual</button></div>
  ${vs.length?`<table><tr><th>Versión</th><th>Guardada</th><th class="r">Total</th><th></th></tr>${vs.map((v,i)=>{const s=summarize(v.snap);return`<tr><td><b>${esc(v.name)}</b></td><td>${new Date(v.at).toLocaleDateString('es-ES')}</td><td class="r">${eur(s.total)}</td><td style="white-space:nowrap"><button class="b s" onclick="ofRestore(${i})">Restaurar</button> <button class="b s" onclick="ofAsProject(${i})">Como proyecto</button> <button class="b d" onclick="ofDel(${i})">✕</button></td></tr>`}).join('')}</table>`:'<p class="muted">Aún no hay versiones guardadas.</p>'}</div>
  <div class="card"><div class="bar" style="margin:0 0 8px"><b>Comparar</b><select onchange="ofSel('a',this.value)">${opts(ofA)}</select><span>con</span><select onchange="ofSel('b',this.value)">${opts(ofB)}</select></div>
  <table><tr><th></th><th class="r">${esc(A.name)}</th><th class="r">${esc(B.name)}</th><th class="r">Diferencia</th></tr>
  ${row('Total con IVA',s=>s.total,eur,1)}${row('Base imponible',s=>s.base,eur,1)}${row('Material (neto)',s=>s.mat,eur,1)}${row('Mano de obra',s=>s.labor,eur,1)}${row('Horas de montaje',s=>s.hours,v=>f1(v)+' h',1)}${row('Margen comercial',s=>s.mg,eur,0)}${row('Módulos de cuadro',s=>s.mods,v=>String(v),1)}${row('Elementos en la casa',s=>s.items,v=>String(v),0)}${row('Errores de normativa',s=>s.errs,v=>String(v),1)}${row('Avisos',s=>s.warns,v=>String(v),1)}</table>
  <h3 style="margin-top:12px">Material que cambia</h3>${names.length?`<table><tr><th>Artículo</th><th class="r">${esc(A.name)}</th><th class="r">${esc(B.name)}</th></tr>${names.map(n=>`<tr><td>${esc(n)}</td><td class="r">${sa.lines[n]||'—'}</td><td class="r">${sb.lines[n]||'—'}</td></tr>`).join('')}</table>`:'<p class="muted">Las dos versiones llevan el mismo material.</p>'}</div>`}
window.XT.push({k:'ofertas',n:'Ofertas',v:vOfertas,after:'budget'});
/* ---------- obra: mediciones y cronograma ---------- */
const WD=d=>{const x=new Date(d);while(x.getDay()===0||x.getDay()===6)x.setDate(x.getDate()+1);return x};
function addWork(d,n){const x=WD(d);let k=Math.max(0,Math.ceil(n)-1);while(k>0){x.setDate(x.getDate()+1);if(x.getDay()!==0&&x.getDay()!==6)k--}return x}
function nextWork(d){const x=new Date(d);x.setDate(x.getDate()+1);return WD(x)}
const fd=d=>d.toLocaleDateString('es-ES',{day:'2-digit',month:'2-digit'});
function obraData(){
  const p=P(),t=budget(p),h=p.house,ob=p.obra=p.obra||{workers:2,hday:8,start:p.startDate||'',ov:{}};
  const C=h&&h.items.length?houseCalc(h):null,cnt=(f)=>h?h.items.filter(f).length:0;
  const pts=cnt(i=>HI[i.k].cat==='ele'&&i.k!=='cuadro'),telp=cnt(i=>HI[i.k].cat==='tel'&&!['dom','router'].includes(i.k)),m=C?Object.values(C.circ).reduce((s,c)=>s+(c.lenM||0),0):0,
    clim=cnt(i=>['split_i','radiador','suelo','aerot','caldera','termo','solar','deposito'].includes(i.k)),agua=cnt(i=>HI[i.k].cat==='agu'),gas=cnt(i=>HI[i.k].cat==='gas'),
    ncirc=C?Object.keys(C.circ).length:0,lgb=p.logo?p.logo.blocks.length:0,fv=cnt(i=>['fv','bateria'].includes(i.k)),mods=t.mods;
  const T=[
   {id:'rep',n:'Replanteo y canalizaciones',ud:'pto',q:pts+telp,hu:0.35,after:[]},
   {id:'cab',n:'Tendido de cables y tubos',ud:'m',q:Math.round(m),hu:0.05,after:['rep']},
   {id:'mec',n:'Mecanismos y puntos de luz',ud:'pto',q:pts,hu:0.25,after:['cab']},
   {id:'tel',n:'Telecomunicaciones y datos',ud:'pto',q:telp,hu:0.4,after:['cab']},
   {id:'cua',n:'Montaje y cableado del cuadro',ud:'mód',q:mods,hu:t.mods?t.hours/t.mods:0.25,after:['cab']},
   {id:'cli',n:'Climatización y agua caliente',ud:'ud',q:clim,hu:4,after:['rep']},
   {id:'fon',n:'Fontanería y sanitarios',ud:'ud',q:agua,hu:1.5,after:['rep']},
   {id:'gas',n:'Instalación de gas',ud:'ud',q:gas,hu:2,after:['rep']},
   {id:'fv',n:'Fotovoltaica y baterías',ud:'ud',q:fv,hu:8,after:['cab']},
   {id:'dom',n:'Domótica: instalación y programación del autómata',ud:'bloque',q:lgb,hu:0.5,fix:lgb?6:0,after:['mec','cua']},
   {id:'pru',n:'Conexionado, pruebas y verificaciones (ITC-BT-05)',ud:'circ',q:ncirc||p.boards.length*6,hu:0.4,fix:3,after:['mec','tel','cua','cli','fon','gas','fv','dom']},
   {id:'leg',n:'Certificado y legalización',ud:'ud',q:1,hu:4,after:['pru']}].filter(x=>x.q>0||x.fix);
  T.forEach(x=>{x.h=x.ov!==undefined?x.ov:(ob.ov[x.id]!==undefined?ob.ov[x.id]:x.q*x.hu+(x.fix||0))});
  const wk=Math.max(1,ob.workers||1),hd=Math.max(1,ob.hday||8),st=ob.start?new Date(ob.start+'T00:00:00'):null,by={};
  T.forEach(x=>{x.dias=Math.max(1,Math.ceil(x.h/(wk*hd)));const aft=x.after.map(a=>by[a]).filter(Boolean);
    x.s=aft.length?nextWork(new Date(Math.max(...aft.map(a=>a.e)))):st?WD(st):new Date(2000,0,3);x.e=addWork(x.s,x.dias);by[x.id]=x;});
  const end=T.length?new Date(Math.max(...T.map(x=>x.e))):null,hours=T.reduce((s,x)=>s+x.h,0);
  return{T,ob,st,end,hours,t,total:T.length?Math.round((end-T.reduce((a,x)=>x.s<a?x.s:a,T[0].s))/864e5)+1:0}}
window.obSet=(k,v)=>{const o=P().obra=P().obra||{workers:2,hday:8,start:'',ov:{}};o[k]=k==='start'?v:num(v,1);if(k==='start')P().startDate=v;render()};
window.obH=(id,v)=>{const o=P().obra;if(v===''||v==null)delete o.ov[id];else o.ov[id]=num(v,0);render()};
window.obCopy=()=>{const D=obraData(),txt='CRONOGRAMA · '+P().name+'\n'+D.T.map(x=>`${fd(x.s)}–${fd(x.e)}  ${x.n} (${f1(x.h)} h, ${x.dias} d)`).join('\n')+'\nTotal: '+f1(D.hours)+' horas · '+D.ob.workers+' operario(s)';navigator.clipboard&&navigator.clipboard.writeText(txt).catch(()=>0);const m=document.getElementById('ob-msg');if(m)m.textContent='Cronograma copiado.'};
function gantt(D){
  if(!D.T.length)return'';const t0=D.T.reduce((a,x)=>x.s<a?x.s:a,D.T[0].s),nd=Math.max(5,Math.round((D.end-t0)/864e5)+2),W=720,L=250,rw=24,H=D.T.length*rw+34,sx=d=>L+(d-t0)/864e5/nd*(W-L-8);
  let g='';for(let i=0;i<=nd;i++){const d=new Date(t0.getTime()+i*864e5);if(d.getDay()===1||i===0)g+=`<line x1="${sx(d)}" y1="24" x2="${sx(d)}" y2="${H}" stroke="#e1e6eb"/><text x="${sx(d)+2}" y="16" font-size="10" fill="#667">${fd(d)}</text>`}
  D.T.forEach((x,i)=>{const y=30+i*rw;g+=`<text x="4" y="${y+14}" font-size="11.5" fill="#1d2733">${esc(x.n.length>38?x.n.slice(0,37)+'…':x.n)}</text><rect x="${sx(x.s)}" y="${y+2}" width="${Math.max(5,sx(new Date(x.e.getTime()+864e5))-sx(x.s))}" height="${rw-8}" rx="4" fill="${['pru','leg'].includes(x.id)?'#e08a00':'#0b7a4b'}"/><text x="${sx(x.s)+4}" y="${y+14}" font-size="10" fill="#fff">${x.dias} d</text>`});
  return`<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;background:#fff;border:1px solid var(--bd);border-radius:6px">${g}</svg>`}
function vObra(){
  const D=obraData(),p=P(),ob=D.ob,rate=p.rate||38;
  return`<div class="card"><h3>Planificación de obra</h3><p class="muted" style="margin:0 0 6px;font-size:12.5px">Mediciones y tiempos estimados a partir de lo que has diseñado. Cambia las horas de cualquier partida si conoces mejor el trabajo.</p>
  <div class="bar" style="align-items:flex-end"><div><label>Inicio de obra</label><input type="date" value="${ob.start||''}" onchange="obSet('start',this.value)"></div><div><label>Operarios</label><input type="number" min="1" style="width:70px" value="${ob.workers}" onchange="obSet('workers',this.value)"></div><div><label>Horas/día</label><input type="number" min="1" max="12" style="width:70px" value="${ob.hday}" onchange="obSet('hday',this.value)"></div></div>
  <div class="kpi"><div><b>${f1(D.hours)} h</b>mano de obra total</div><div><b>${D.total} días</b>de calendario</div><div><b>${D.end&&D.st?D.end.toLocaleDateString('es-ES'):'—'}</b>fin de obra${D.st?'':' (indica el inicio)'}</div><div><b>${eur(D.hours*rate)}</b>coste a ${eur(rate)}/h</div></div></div>
  <div class="card"><h3>Cronograma</h3>${gantt(D)}<div class="bar" style="margin-top:8px"><button class="b s" onclick="obCopy()">Copiar cronograma</button><span id="ob-msg" class="muted"></span></div></div>
  <div class="card"><h3>Mediciones y horas por partida</h3><div style="overflow:auto"><table><tr><th>Partida</th><th class="r">Medición</th><th class="r">h/ud</th><th class="r">Horas</th><th class="r">Días</th><th>Fechas</th></tr>
  ${D.T.map(x=>`<tr><td>${esc(x.n)}</td><td class="r">${f1(x.q)} ${x.ud}</td><td class="r">${f1(x.hu)}${x.fix?' +'+x.fix:''}</td><td class="r"><input type="number" step="0.5" style="width:70px;text-align:right" value="${f1(x.h).replace(',','.')}" onchange="obH('${x.id}',this.value)"></td><td class="r">${x.dias}</td><td>${D.st?fd(x.s)+' → '+fd(x.e):'—'}</td></tr>`).join('')}
  <tr class="tot"><td colspan="3">Total</td><td class="r">${f1(D.hours)} h</td><td></td><td></td></tr></table></div>
  <p class="muted" style="font-size:12px;margin:6px 0 0">El presupuesto usa ${f1(D.t.hours)} h sólo para el montaje del cuadro; esta planificación cubre toda la obra. Los días saltan fines de semana.</p></div>`}
window.XT.push({k:'obra',n:'Obra',v:vObra,after:'budget'});

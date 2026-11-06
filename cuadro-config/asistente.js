'use strict';
/* Asistente de proyecto: de la lista de estancias y opciones al plano, cableado, cuadro y material */
const ASP={
  piso:{n:'Piso de 3 dormitorios',persons:3,rooms:[['vestibulo',2,2,0],['salon',5,4,0],['cocina',3,3.5,0],['pasillo',8,1.2,0],['dormitorio',3.5,3,0],['dormitorio',3,3,0],['dormitorio',3,3,0],['bano',2.5,2.2,0]]},
  estudio:{n:'Estudio',persons:2,rooms:[['vestibulo',1.5,2,0],['salon',4,3,0],['cocina',2,3,0],['dormitorio',3,2.5,0],['bano',1.5,2.5,0]]},
  casa:{n:'Casa de 2 plantas',persons:4,rooms:[['vestibulo',2,3,0],['salon',5,4,0],['cocina',3,4,0],['bano',2,2,0],['escalera',1.5,3,0],['pasillo',9,1.2,1],['dormitorio',3.5,3,1],['dormitorio',3,3,1],['dormitorio',3,3,1],['bano',2.5,2.5,1],['escalera',1.5,3,1]]}
};
function asNew(){return{persons:3,heat:'electric',ac:false,dom:true,riego:false,ve:false,gas:false,rooms:ASP.piso.rooms.map(([t,w,l,f])=>({t,w,l,f}))}}
const asState=()=>{const p=P();if(!p.asist)p.asist=asNew();return p.asist};
window.asPreset=k=>{const A=asState(),pr=ASP[k];A.persons=pr.persons;A.rooms=pr.rooms.map(([t,w,l,f])=>({t,w,l,f}));render()};
window.asRoom=(i,f,v)=>{const A=asState();if(f==='t')A.rooms[i].t=v;else A.rooms[i][f]=Math.max(0,num(v,1));render()};
window.asAdd=()=>{asState().rooms.push({t:'dormitorio',w:3,l:3,f:0});render()};
window.asDel=i=>{asState().rooms.splice(i,1);render()};
window.asOpt=(k,v)=>{asState()[k]=v;render()};
function vAsistente(){
  const A=asState(),totalM2=A.rooms.reduce((s,r)=>s+r.w*r.l,0),nf=Math.max(1,...A.rooms.map(r=>r.f+1));
  const rows=A.rooms.map((r,i)=>`<tr><td><select onchange="asRoom(${i},'t',this.value)">${Object.entries(RT).map(([k,v])=>`<option value="${k}" ${r.t===k?'selected':''}>${v}</option>`).join('')}</select></td>
    <td><input type="number" step="0.1" min="0.5" value="${r.w}" style="width:70px" onchange="asRoom(${i},'w',this.value)"></td><td><input type="number" step="0.1" min="0.5" value="${r.l}" style="width:70px" onchange="asRoom(${i},'l',this.value)"></td>
    <td><select onchange="asRoom(${i},'f',+this.value)">${[0,1,2].map(f=>`<option value="${f}" ${r.f===f?'selected':''}>${f?'Planta '+f:'Planta baja'}</option>`).join('')}</select></td><td class="r">${(r.w*r.l).toFixed(1)}</td><td><button class="b d" onclick="asDel(${i})">✕</button></td></tr>`).join('');
  const chk=(k,l)=>`<label style="display:flex;gap:6px;align-items:center;margin:4px 0"><input type="checkbox" ${A[k]?'checked':''} onchange="asOpt('${k}',this.checked)"> ${l}</label>`;
  const res=asResult();
  return`<div class="card"><h3>Asistente de proyecto</h3><p class="muted" style="margin:0 0 8px">Dime las estancias y lo que necesitas: el asistente dibuja el plano, coloca los elementos según la normativa, calcula los circuitos y el cableado, genera el cuadro y el material. Después lo puedes cambiar todo a mano.</p>
   <div class="bar"><label style="margin:0">Partir de un modelo</label><select onchange="if(this.value)asPreset(this.value)"><option value="">Elegir…</option>${Object.entries(ASP).map(([k,v])=>`<option value="${k}">${v.n}</option>`).join('')}</select></div></div>
  <div class="gc wide"><div class="card"><h3>1 · Estancias <small class="muted">(${A.rooms.length} · ${totalM2.toFixed(0)} m² · ${nf} planta${nf>1?'s':''})</small></h3>
   <div style="overflow:auto"><table><tr><th>Estancia</th><th>Ancho (m)</th><th>Largo (m)</th><th>Planta</th><th class="r">m²</th><th></th></tr>${rows}</table></div><div class="bar" style="margin-top:8px"><button class="b s" onclick="asAdd()">+ Añadir estancia</button></div></div>
   <div class="card"><h3>2 · Qué necesitas</h3>
    <label>Personas en la vivienda</label><input type="number" min="1" value="${A.persons}" style="width:80px" onchange="asOpt('persons',num(this.value,3))">
    <label>Calefacción</label><select onchange="asOpt('heat',this.value)" style="width:100%"><option value="none" ${A.heat==='none'?'selected':''}>Ninguna</option><option value="electric" ${A.heat==='electric'?'selected':''}>Radiadores eléctricos</option><option value="aerot" ${A.heat==='aerot'?'selected':''}>Aerotermia (suelo/radiadores de agua + depósito)</option><option value="gas" ${A.heat==='gas'?'selected':''}>Caldera de gas con radiadores de agua</option></select>
    ${chk('ac','Aire acondicionado (split en salón y dormitorios)')}${chk('dom','Domótica con autómata (persianas motorizadas y sensores de luz y temperatura)')}${chk('riego','Riego automático (electroválvula en el exterior)')}${chk('ve','Recarga de vehículo eléctrico')}${chk('gas','Cocina de gas')}
    <button class="b" style="margin-top:10px;font-size:15px;padding:10px 16px" onclick="asGenerate()">⚙ Generar proyecto completo</button></div></div>${res}`}
function asResult(){const h=P().house;if(!h||!h.items.length||!P().asistDone)return'';
  const t=budget(P()),C=houseCalc(h),iss=houseIssues(h,C),errs=iss.filter(i=>i.lv==='err').length,warns=iss.filter(i=>i.lv==='warn').length,b=B(),bv=b.root?verdict(analyze(b)):null;
  const a=b.root?analyze(b):null,cab={};if(a)a.cables.forEach(c=>{cab[c.cl]=(cab[c.cl]||0)+c.m});
  const lg=P().logo&&(P().logo.blocks.length)?lgIssues(lgProg()).filter(i=>i.lv==='err'||i.lv==='warn').length:0;
  const lv=errs||(bv&&bv.lv==='err')?'err':warns||(bv&&bv.lv==='warn')?'warn':'ok';
  const lines=t.lines.slice().sort((x,y)=>y.tot-x.tot);
  return`<div class="card" style="border:2px solid ${lv==='ok'?'#2e7d32':lv==='warn'?'#e08a00':'#c62828'}"><h3>Resultado del proyecto</h3>
   <div style="font-size:17px;font-weight:800;color:${lv==='ok'?'#2e7d32':lv==='warn'?'#e08a00':'#c62828'}">${lv==='ok'?'✔ Proyecto correcto':lv==='warn'?'⚠ Correcto, con avisos':'✖ Hay fallos que revisar'}</div>
   <div class="kpi" style="margin-top:8px"><div><b>${C.area.toFixed(0)} m²</b>${C.elev?'electrificación elevada':'electrificación básica'}</div><div><b>${h.items.length}</b>elementos colocados</div><div><b>${Object.keys(C.circ).length}</b>circuitos</div><div><b>${eur(t.total)}</b>presupuesto con IVA</div>${lg?`<div><b>${lg}</b>avisos del autómata</div>`:''}</div>
   <div class="bar" style="margin-top:10px"><button class="b" onclick="tab='casa';render()">Ver y editar el plano</button><button class="b s" onclick="tab='m3d';M3D.setView('casa');render()">Ver en 3D</button><button class="b s" onclick="tab='report';render()">Informe completo</button><button class="b s" onclick="tab='budget';render()">Presupuesto</button></div></div>
  <div class="gc wide"><div class="card"><h3>Circuitos propuestos</h3><table><tr><th>Circuito</th><th>Uso</th><th class="r">Puntos</th><th class="r">kW</th><th class="r">In</th><th class="r">Sección</th><th class="r">Longitud</th></tr>${Object.values(C.circ).map(c=>`<tr><td><b>${c.code}</b></td><td>${esc(c.def.n)}</td><td class="r">${c.pts}</td><td class="r">${f1(c.kw)}</td><td class="r">${c.def.In} A</td><td class="r">${c.def.sec} mm²</td><td class="r">${c.lenM} m</td></tr>`).join('')}</table>
    ${Object.keys(cab).length?`<p style="font-size:12.5px;margin:8px 0 0">Cable necesario: ${Object.entries(cab).map(([k,v])=>`<b>${Math.ceil(v)} m</b> de ${k} mm²`).join(' · ')}</p>`:''}
    ${C.cold?`<p style="font-size:12.5px;margin:4px 0 0">Fontanería: ${Math.round(C.cold.total/100*1.1)} m (Ø ${[...new Set(C.cold.edges.map(e=>e.dn))].join('/')} mm)${C.gas?` · Gas: ${Math.round(C.gas.total/100*1.1)} m (Ø ${[...new Set(C.gas.edges.map(e=>e.dn))].join('/')} mm)`:''}</p>`:''}</div>
   <div class="card"><h3>Material propuesto</h3><div style="max-height:420px;overflow:auto"><table><tr><th>Descripción</th><th class="r">Ud.</th><th class="r">Importe</th></tr>${lines.map(l=>`<tr><td>${esc(l.p.name)}</td><td class="r">${l.qty}</td><td class="r">${eur(l.tot)}</td></tr>`).join('')}</table></div><p style="margin:8px 0 0"><b>Total con IVA: ${eur(t.total)}</b></p></div></div>
  <div class="card"><h3>Comprobaciones</h3>${iss.filter(i=>i.lv!=='info').map(i=>`<div class="chk ${i.lv}"><b>${HCAT[i.cat].n}:</b> ${esc(i.msg)}</div>`).join('')||'<div class="chk ok">La casa cumple todas las comprobaciones.</div>'}${bv?`<div class="chk ${bv.lv}">Cuadro: ${bv.txt}</div>`:''}</div>`}
function outsidePt(h,r){const cx=r.x+r.w/2,cy=lyOf(r.y)+r.h/2,fl=flOf(r.y),cand=[[r.x-45,cy],[r.x+r.w+45,cy],[cx,lyOf(r.y)-45],[cx,lyOf(r.y)+r.h+45]];let best=null,bd=1e9;
  cand.forEach(([x,y])=>{const ay=y+fl*FY;if(h.rooms.some(q=>x>=q.x&&x<=q.x+q.w&&ay>=q.y&&ay<=q.y+q.h))return;const d=Math.hypot(x-cx,y-cy);if(d<bd){bd=d;best={x:Math.round(x),y:Math.round(ay)}}});return best||{x:r.x+r.w+45,y:Math.round(r.y+r.h/2)}}
window.asGenerate=()=>{const A=asState();if(!A.rooms.length||A.rooms.some(r=>!(r.w>0&&r.l>0)))return alert('Revisa las estancias: todas necesitan ancho y largo.');
  const h=newHouse();h.persons=A.persons;const nf=Math.max(1,...A.rooms.map(r=>r.f+1));h.nf=nf;h.fn=Array.from({length:nf},(_,i)=>i?'Planta '+i:'Planta baja');const cnt={};
  for(let f=0;f<nf;f++){let x=0,y=0,rh=0;A.rooms.filter(r=>r.f===f).forEach(r=>{const w=Math.round(r.w*100),l=Math.round(r.l*100);if(x+w>1500&&x>0){x=0;y+=rh;rh=0}cnt[r.t]=(cnt[r.t]||0)+1;
    h.rooms.push({id:uid(),type:r.t,x,y:y+f*FY,w,h:l,name:RT[r.t].split(' /')[0]+(cnt[r.t]>1||r.t==='dormitorio'||r.t==='bano'?' '+cnt[r.t]:'')});x+=w;rh=Math.max(rh,l)})}
  const rooms=t=>h.rooms.filter(r=>r.type===t),f0=h.rooms.filter(r=>flOf(r.y)===0),maxX=Math.max(...f0.map(r=>r.x+r.w)),maxY=Math.max(...f0.map(r=>lyOf(r.y)+r.h));
  if((A.ac||A.riego||A.heat==='aerot'||A.dom||A.ve)&&!rooms('terraza').length)h.rooms.push({id:uid(),type:'terraza',x:maxX,y:0,w:400,h:300,name:'Terraza'});
  if(A.ve&&!rooms('garaje').length)h.rooms.push({id:uid(),type:'garaje',x:0,y:maxY,w:300,h:500,name:'Garaje'});
  autoEquip(h);
  const put=(k,r,extra)=>{const p=freeSpot(h,r,k),it={id:uid(),k,x:p.x,y:p.y,...(extra||{})};h.items.push(it);return it};
  const sal=rooms('salon')[0],coc=rooms('cocina')[0],ter=rooms('terraza')[0],gar=rooms('garaje')[0],bans=rooms('bano'),dorms=rooms('dormitorio'),area=r=>r.w*r.h/10000;
  const habit=[...rooms('salon'),...dorms];
  if(A.heat==='electric')habit.forEach(r=>{const n=Math.max(1,Math.ceil(area(r)*0.07/1.5));for(let i=0;i<n;i++)put('radiador',r)});
  if(A.heat==='aerot'&&ter){put('aerot',ter);h.items=h.items.filter(i=>i.k!=='termo');put('deposito',bans[0]||sal);habit.forEach(r=>put('rad_agua',r))}
  if(A.heat==='gas'&&coc){h.items=h.items.filter(i=>i.k!=='termo');put('caldera',coc);put('gas_humos',coc);if(!h.items.some(i=>i.k==='gas_cont'))put('gas_cont',coc);if(!h.items.some(i=>i.k==='gas_rejilla'))put('gas_rejilla',coc);habit.forEach(r=>put('rad_agua',r))}
  if(A.gas&&coc){if(!h.items.some(i=>i.k==='gas_cont'))put('gas_cont',coc);put('gas_cocina',coc);if(!h.items.some(i=>i.k==='gas_rejilla'&&roomAt(h,i.x,i.y)===coc))put('gas_rejilla',coc)}
  if(A.ac)habit.forEach(r=>{put('split_i',r);const o=outsidePt(h,r);h.items.push({id:uid(),k:'split_e',x:o.x,y:o.y})});
  if(A.ve)put('cargador_ve',gar||ter||sal);
  if(A.riego&&ter)put('electrovalvula',ter);
  P().house=h;P().asistDone=true;P().logo=undefined;
  const b=B();genBoard(b,h);try{M3D.autoB()}catch(e){}
  if(A.dom){dorms.concat(sal?[sal]:[]).forEach(r=>{if(!h.items.some(i=>i.k==='persiana'&&roomAt(h,i.x,i.y)===r))put('persiana',r)});lgHouseDemo2();h.wmode='auto';genBoard(B(),h);try{M3D.autoB()}catch(e){}hsInit(true)}
  CS.sim=false;CS.sel=null;CS.floor=0;tab='asistente';render()};

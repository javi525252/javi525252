'use strict';
/* Editor 2D de la casa: estancias, elementos de todas las instalaciones, rutas y validación */
const CS={tool:'sel',place:null,rtype:'salon',sel:null,cat:'ele',layers:{ele:1,tel:1,cli:1,agu:1,gas:1},routes:true,drag:null,prev:null,fcat:''};
const hexs=n=>'#'+n.toString(16).padStart(6,'0');
function csObj(){const h=HS();if(!CS.sel)return null;return CS.sel.t==='room'?h.rooms.find(r=>r.id===CS.sel.id):h.items.find(i=>i.id===CS.sel.id)}
function vCasa(){
  const h=HS(),C=houseCalc(h),iss=houseIssues(h,C),errs=iss.filter(i=>i.lv==='err').length,warns=iss.filter(i=>i.lv==='warn').length;
  const lv=errs?'err':warns?'warn':'ok';
  const b=B(),bv=b.root?verdict(analyze(b)):null;
  const tabs=Object.entries(HCAT).map(([k,v])=>`<button class="b ${CS.cat===k?'':'s'}" style="${CS.cat===k?`background:${v.c}`:''}" onclick="CS.cat='${k}';render()">${v.n}</button>`).join('');
  const items=Object.entries(HI).filter(([k,d])=>d.cat===CS.cat).map(([k,d])=>`<button class="pi" style="width:100%;text-align:left;${CS.tool==='item'&&CS.place===k?'outline:2px solid var(--pr);background:var(--pr2)':''}" onclick="CS.tool='item';CS.place='${k}';CS.sel=null;render()"><b style="color:${HCAT[d.cat].c}">${d.ab}</b> ${d.n}${d.kw?`<small> · ${d.kw} kW</small>`:''}${d.unique?'<small> · único</small>':''}</button>`).join('');
  const left=`<div class="card"><h3>Elementos</h3><div class="bar" style="gap:3px">${tabs}</div>
   <div class="bar"><select onchange="CS.rtype=this.value">${Object.entries(RT).map(([k,v])=>`<option value="${k}" ${CS.rtype===k?'selected':''}>${v}</option>`).join('')}</select><button class="b ${CS.tool==='room'?'':'s'}" onclick="CS.tool='room';CS.sel=null;render()">Dibujar estancia</button></div>
   <div class="bar"><button class="b ${CS.tool==='sel'?'':'s'}" onclick="CS.tool='sel';CS.place=null;render()">Seleccionar / mover</button></div>
   <div class="pal" style="max-height:48vh">${items}</div>
   <p class="muted" style="font-size:12px">${CS.tool==='room'?'Arrastra sobre el plano para dibujar la estancia.':CS.tool==='item'?'Toca el plano para colocar «'+esc(HI[CS.place].n)+'».':'Toca un elemento o una estancia para editarlo; arrástralo para moverlo.'}</p></div>`;
  const lay=Object.entries(HCAT).map(([k,v])=>`<label style="display:inline-flex;gap:3px;margin:0 8px 0 0;align-items:center;color:${v.c}"><input type="checkbox" ${CS.layers[k]?'checked':''} onchange="CS.layers['${k}']=this.checked?1:0;casaDraw()"> ${v.n}</label>`).join('');
  const center=`<div class="card m-center" style="padding:6px;align-self:start"><div class="bar" style="margin:2px 4px 6px">${lay}<label style="display:inline-flex;gap:3px;margin:0;align-items:center"><input type="checkbox" ${CS.routes?'checked':''} onchange="CS.routes=this.checked;casaDraw()"> Rutas</label></div>
   <svg id="cs-svg" viewBox="-40 -40 ${h.w+80} ${h.h+80}" style="width:100%;height:auto;max-height:72vh;background:#fff;touch-action:none;display:block;border-radius:6px"><g id="cs-g"></g></svg></div>`;
  const right=`<div>${inspCasa(h,C)}
   <div class="card"><div class="chk ${lv}" style="font-weight:700;margin:0 0 8px">${lv==='ok'?'✔ CASA VÁLIDA':lv==='warn'?'⚠ VÁLIDA CON AVISOS ('+warns+')':'✖ NO VÁLIDA · '+errs+' fallo'+(errs>1?'s':'')}</div>
   ${bv?`<div class="chk ${bv.lv}" style="margin:0 0 8px">Cuadro: ${bv.txt}</div>`:'<div class="chk info" style="margin:0 0 8px">Aún no hay cuadro: pulsa «Generar cuadro desde la casa».</div>'}
   <div class="bar"><button class="b" onclick="csEquip()">Equipar según normativa</button><button class="b" onclick="csGen()">Generar cuadro desde la casa</button></div>
   <label style="margin:2px 0">Personas en la vivienda</label><input type="number" min="1" value="${h.persons}" style="width:80px" onchange="HS().persons=num(this.value,3);render()">
   <p class="muted" style="font-size:12px;margin:6px 0 0">${C.area.toFixed(0)} m² útiles · electrificación ${C.elev?'<b>elevada</b>':'básica'} · ${h.items.length} elementos</p></div>
   <div class="card"><h3>Circuitos eléctricos (ITC-BT-25)</h3><table style="font-size:12.5px"><tr><th>Circ.</th><th>Pts</th><th>kW</th><th>In</th><th>mm²</th><th>m</th></tr>${Object.values(C.circ).map(c=>`<tr><td title="${esc(c.def.n)}"><b style="color:${hexs(CIRCCOL[c.code])}">${c.code}</b></td><td>${c.pts}</td><td>${f1(c.kw)}</td><td>${c.def.In}</td><td>${c.def.sec}</td><td>${c.lenM}</td></tr>`).join('')||'<tr><td colspan="6" class="muted">Sin circuitos todavía.</td></tr>'}</table>
   ${C.cold?`<p style="font-size:12.5px;margin:8px 0 0">Agua: ${Math.round(C.cold.total/100*1.1)} m de tubería, Ø ${[...new Set(C.cold.edges.map(e=>e.dn))].join('/')} mm${C.hot?` · ACS hasta ${C.hot.farM} m`:''}</p>`:''}
   ${C.gas?`<p style="font-size:12.5px;margin:4px 0 0">Gas: ${C.gas.kw} kW · ${Math.round(C.gas.total/100*1.1)} m · Ø ${[...new Set(C.gas.edges.map(e=>e.dn))].join('/')} mm</p>`:''}</div>
   <div class="card"><h3>Fallos y avisos</h3>${['ele','tel','cli','agu','gas'].map(cat=>{const l=iss.filter(i=>i.cat===cat);return l.length?`<div style="font-weight:600;color:${HCAT[cat].c};margin-top:6px">${HCAT[cat].n}</div>`+l.map(i=>`<div class="chk ${i.lv}" ${i.id?`style="cursor:pointer" onclick="CS.sel={t:'item',id:'${i.id}'};render()"`:''}>${esc(i.msg)}</div>`).join(''):''}).join('')||'<div class="chk ok">Sin fallos ni avisos.</div>'}</div></div>`;
  return`<div class="bar noprint"><select onchange="if(this.value){csTpl(this.value)}"><option value="">Plantilla de casa…</option>${Object.entries(HTPL).map(([k,v])=>`<option value="${k}">${v.n}</option>`).join('')}</select><button class="b s" onclick="csClear()">Vaciar casa</button><span class="muted">Dibuja el plano, coloca elementos y genera el cuadro. Valida eléctrica, telecom/domótica, climatización/ACS, fontanería y gas.</span></div>
  <div class="grid g3">${left}${center}${right}</div>`;
}
function inspCasa(h,C){const o=csObj();if(!o)return'<div class="card muted">Selecciona una estancia o un elemento del plano.</div>';
  if(CS.sel.t==='room')return`<div class="card"><h3>Estancia</h3><label>Nombre</label><input value="${esc(o.name)}" style="width:100%" onchange="csSet('name',this.value)">
   <label>Tipo</label><select style="width:100%" onchange="csSet('type',this.value)">${Object.entries(RT).map(([k,v])=>`<option value="${k}" ${o.type===k?'selected':''}>${v}</option>`).join('')}</select>
   <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">${['x','y','w','h'].map(f=>`<div><label>${{x:'X (cm)',y:'Y (cm)',w:'Ancho (cm)',h:'Alto (cm)'}[f]}</label><input type="number" step="10" value="${o[f]}" onchange="csSet('${f}',num(this.value))"></div>`).join('')}</div>
   <p class="muted">${(o.w*o.h/10000).toFixed(1)} m²</p><div class="bar"><button class="b d" onclick="csDel()">Eliminar estancia</button></div></div>`;
  const d=HI[o.k],r=roomAt(h,o.x,o.y);
  return`<div class="card"><h3>${esc(d.n)}</h3><p class="muted" style="margin:0 0 6px">${r?esc(r.name||RT[r.type]):'fuera de estancias'} · (${o.x}, ${o.y}) cm</p>
   ${d.circ?`<label>Circuito</label><select style="width:100%" onchange="csSet('circ',this.value)"><option value="">Automático (${d.circ})</option>${Object.entries(CIRC).map(([c,v])=>`<option value="${c}" ${o.circ===c?'selected':''}>${c} ${v.n}</option>`).join('')}</select>`:''}
   ${(d.kw!=null&&d.cat!=='ele'||['toma_horno','toma_lav','toma_lvj','toma_sec'].includes(o.k))&&o.k!=='suelo'?`<label>Potencia (kW)</label><input type="number" step="0.1" value="${itemKw(o)}" onchange="csSet('kw',num(this.value))">`:''}
   ${o.k==='suelo'?`<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px"><div><label>Ancho (cm)</label><input type="number" step="10" value="${o.w||200}" onchange="csSet('w',num(this.value))"></div><div><label>Fondo (cm)</label><input type="number" step="10" value="${o.d||150}" onchange="csSet('d',num(this.value))"></div></div><p class="muted">Potencia: ${itemKw(o)} kW (100 W/m²)</p>`:''}
   ${d.l!=null?`<label>Capacidad (litros)</label><input type="number" value="${o.l||d.l}" onchange="csSet('l',num(this.value))">`:''}
   ${d.kwg?`<p style="margin:6px 0 0">Gas: ${d.kwg} kW</p>`:''}${d.ud?`<p style="margin:2px 0 0">Caudal: ${d.ud} L/s</p>`:''}
   <div class="bar" style="margin-top:8px"><button class="b s" onclick="csDup()">Duplicar</button><button class="b d" onclick="csDel()">Eliminar</button></div></div>`}
window.csSet=(f,v)=>{const o=csObj();if(!o)return;o[f]=v||v===0?v:undefined;if(f==='circ'&&!v)delete o.circ;save();render()};
window.csDel=()=>{const h=HS();if(!CS.sel)return;if(CS.sel.t==='room')h.rooms=h.rooms.filter(r=>r.id!==CS.sel.id);else h.items=h.items.filter(i=>i.id!==CS.sel.id);CS.sel=null;render()};
window.csDup=()=>{const o=csObj();if(!o||CS.sel.t!=='item'||HI[o.k].unique)return;const n={...o,id:uid(),x:o.x+30,y:o.y+30};HS().items.push(n);CS.sel={t:'item',id:n.id};render()};
window.csClear=()=>{if(!confirm('¿Vaciar la casa?'))return;P().house=newHouse();CS.sel=null;render()};
window.csTpl=k=>{if(HS().rooms.length&&!confirm('Se reemplazará la casa actual.'))return;P().house=loadHouse(k);CS.sel=null;render()};
window.csEquip=()=>{autoEquip(HS());render()};
window.csGen=()=>{if(!HS().items.length)return alert('Coloca antes elementos en el plano (o usa «Equipar según normativa»).');
  if(B().root&&!confirm('Se reemplazará el contenido del cuadro actual.'))return;if(genBoard(B(),HS())){selId=null;M3D.autoB();alert('Cuadro generado desde la casa. Revísalo en «Diseño» y míralo en «Montaje 3D».');render()}else alert('No hay puntos eléctricos que alimentar.')};
function itemShape(it,sel,bad){const d=HI[it.k],c=HCAT[d.cat].c;
  if(it.k==='suelo')return`<rect x="${it.x}" y="${it.y}" width="${it.w||200}" height="${it.d||150}" fill="${c}" fill-opacity=".25" stroke="${c}" stroke-dasharray="8 6" stroke-width="3"/><text x="${it.x+8}" y="${it.y+22}" font-size="18" fill="${c}">suelo radiante</text>`;
  const sq=it.k==='cuadro'||it.k==='router';
  return`<g>${sq?`<rect x="${it.x-16}" y="${it.y-16}" width="32" height="32" rx="4" fill="${c}" stroke="${sel?'#000':'#fff'}" stroke-width="${sel?5:3}"/>`:`<circle cx="${it.x}" cy="${it.y}" r="15" fill="${c}" stroke="${sel?'#000':'#fff'}" stroke-width="${sel?5:3}"/>`}<text x="${it.x}" y="${it.y+5}" font-size="13" font-weight="700" text-anchor="middle" fill="#fff" pointer-events="none">${d.ab}</text>${bad?`<circle cx="${it.x+14}" cy="${it.y-14}" r="7" fill="${bad==='err'?'#c62828':'#e08a00'}" stroke="#fff" stroke-width="2"/>`:''}</g>`}
window.casaDraw=()=>{const g=document.getElementById('cs-g');if(!g)return;const h=HS(),C=houseCalc(h),iss=houseIssues(h,C),bad={};iss.forEach(i=>{if(i.id&&(!bad[i.id]||i.lv==='err'))bad[i.id]=i.lv});
  let s='';for(let x=0;x<=h.w;x+=100)s+=`<line x1="${x}" y1="0" x2="${x}" y2="${h.h}" stroke="#eef1f3" stroke-width="2"/>`;for(let y=0;y<=h.h;y+=100)s+=`<line x1="0" y1="${y}" x2="${h.w}" y2="${y}" stroke="#eef1f3" stroke-width="2"/>`;
  h.rooms.forEach(r=>{const sel=CS.sel&&CS.sel.t==='room'&&CS.sel.id===r.id;s+=`<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" fill="${RCOL[r.type]}" stroke="${sel?'#0b7a4b':'#445'}" stroke-width="${sel?8:5}"/><text x="${r.x+10}" y="${r.y+26}" font-size="22" font-weight="700" fill="#334" pointer-events="none">${esc(r.name||RT[r.type])}</text><text x="${r.x+10}" y="${r.y+50}" font-size="18" fill="#667" pointer-events="none">${(r.w*r.h/10000).toFixed(1)} m²</text>`;
    if(sel)s+=`<rect x="${r.x+r.w-16}" y="${r.y+r.h-16}" width="24" height="24" fill="#0b7a4b" stroke="#fff" stroke-width="3"/>`});
  const path=(a,b)=>`M${a.x} ${a.y} H${b.x} V${b.y}`;
  if(CS.routes){
    if(CS.layers.ele)Object.values(C.circ).forEach(c=>c.segs.forEach(sg=>{s+=`<path d="${path(sg.a,sg.b)}" fill="none" stroke="${hexs(CIRCCOL[c.code])}" stroke-width="4" stroke-opacity=".75" pointer-events="none"/>`}));
    if(CS.layers.tel)C.tel.forEach(t=>{s+=`<path d="${path(t.a,t.it)}" fill="none" stroke="${t.coax?'#7e57c2':'#00acc1'}" stroke-width="3" stroke-dasharray="10 8" pointer-events="none"/>`});
    C.pipes.forEach(p=>{const k=p.t==='gas'?'gas':'agu';if(!CS.layers[k])return;s+=`<path d="${path(p.a,p.b)}" fill="none" stroke="${p.t==='cold'?'#1e88e5':p.t==='hot'?'#e53935':'#fb8c00'}" stroke-width="${3+p.dn/6}" stroke-opacity=".8" pointer-events="none"/>`})}
  h.items.forEach(it=>{if(!CS.layers[HI[it.k].cat])return;s+=itemShape(it,CS.sel&&CS.sel.t==='item'&&CS.sel.id===it.id,bad[it.id])});
  if(CS.prev)s+=`<rect x="${CS.prev.x}" y="${CS.prev.y}" width="${CS.prev.w}" height="${CS.prev.h}" fill="#0b7a4b" fill-opacity=".15" stroke="#0b7a4b" stroke-width="4" stroke-dasharray="10 8"/>`;
  g.innerHTML=s};
function casaMount(){const svg=document.getElementById('cs-svg');if(!svg)return;casaDraw();
  const pt=e=>{const p=svg.createSVGPoint();p.x=e.clientX;p.y=e.clientY;const q=p.matrixTransform(svg.getScreenCTM().inverse());return{x:q.x,y:q.y}},sn=(v,s=10)=>Math.round(v/s)*s;
  const hit=q=>{const h=HS();
    for(let i=h.items.length-1;i>=0;i--){const it=h.items[i];if(!CS.layers[HI[it.k].cat])continue;if(it.k==='suelo'?(q.x>=it.x&&q.x<=it.x+(it.w||200)&&q.y>=it.y&&q.y<=it.y+(it.d||150)):hdist(it,q)<=20)return{t:'item',id:it.id}}
    if(CS.sel&&CS.sel.t==='room'){const r=h.rooms.find(x=>x.id===CS.sel.id);if(r&&Math.abs(q.x-(r.x+r.w))<=24&&Math.abs(q.y-(r.y+r.h))<=24)return{t:'room',id:r.id,resize:true}}
    const rs=h.rooms.filter(r=>q.x>=r.x&&q.x<=r.x+r.w&&q.y>=r.y&&q.y<=r.y+r.h).sort((a,b)=>a.w*a.h-b.w*b.h);return rs[0]?{t:'room',id:rs[0].id}:null};
  svg.onpointerdown=e=>{svg.setPointerCapture(e.pointerId);const q=pt(e),h=HS();
    if(CS.tool==='room'){CS.drag={m:'room',a:{x:sn(q.x),y:sn(q.y)}};CS.prev={x:sn(q.x),y:sn(q.y),w:0,h:0};return}
    if(CS.tool==='item'&&CS.place){const d=HI[CS.place];let it=d.unique?h.items.find(i=>i.k===CS.place):null;
      if(it){it.x=sn(q.x,5);it.y=sn(q.y,5)}else{it={id:uid(),k:CS.place,x:sn(q.x,5),y:sn(q.y,5)};if(CS.place==='suelo'){it.w=200;it.d=150}h.items.push(it)}
      CS.sel={t:'item',id:it.id};if(d.unique){CS.tool='sel';CS.place=null}render();return}
    const ht=hit(q);CS.sel=ht;
    if(ht){const o=csObj();CS.drag={m:ht.resize?'resize':'move',off:{x:q.x-o.x,y:q.y-o.y},moved:false}}else CS.drag=null;casaDraw()};
  svg.onpointermove=e=>{if(!CS.drag)return;const q=pt(e),h=HS(),d=CS.drag;
    if(d.m==='room'){CS.prev={x:Math.min(d.a.x,sn(q.x)),y:Math.min(d.a.y,sn(q.y)),w:Math.abs(sn(q.x)-d.a.x),h:Math.abs(sn(q.y)-d.a.y)};casaDraw();return}
    const o=csObj();if(!o)return;d.moved=true;
    if(d.m==='resize'){o.w=Math.max(100,sn(q.x)-o.x);o.h=Math.max(100,sn(q.y)-o.y)}
    else{const st=CS.sel.t==='room'?10:5;o.x=sn(q.x-d.off.x,st);o.y=sn(q.y-d.off.y,st)}
    casaDraw()};
  svg.onpointerup=e=>{const d=CS.drag;CS.drag=null;if(!d)return;const h=HS();
    if(d.m==='room'){const p=CS.prev;CS.prev=null;if(p&&p.w>=100&&p.h>=100){const n={id:uid(),type:CS.rtype,x:p.x,y:p.y,w:p.w,h:p.h,name:RT[CS.rtype].split(' /')[0]};h.rooms.push(n);CS.sel={t:'room',id:n.id};h.w=Math.max(h.w,p.x+p.w+100);h.h=Math.max(h.h,p.y+p.h+100)}CS.tool='sel';render();return}
    if(d.moved){const mx=Math.max(h.w,...h.rooms.map(r=>r.x+r.w+100)),my=Math.max(h.h,...h.rooms.map(r=>r.y+r.h+100));h.w=mx;h.h=my}
    render()};
  document.onkeydown=e=>{if(tab!=='casa'||/INPUT|SELECT|TEXTAREA/.test((document.activeElement||{}).tagName||''))return;if((e.key==='Delete'||e.key==='Backspace')&&CS.sel){e.preventDefault();csDel()}}}

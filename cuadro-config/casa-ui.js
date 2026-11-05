'use strict';
/* Editor 2D de la casa: plano grande y claro, símbolos, leyenda, rutas y modo simulación interactivo */
const CS={tool:'sel',place:null,rtype:'salon',sel:null,cat:'ele',layers:{ele:1,tel:1,cli:1,agu:1,gas:1},routes:true,labels:'main',drag:null,prev:null,sim:false,zoom:1,wide:false,cache:null};
const hexs=n=>'#'+n.toString(16).padStart(6,'0');
const SHORT={luz:'Luz',foco:'Foco',interruptor:'Interruptor',conmutador:'Conmutador',toma:'Enchufe',toma_ext:'Enchufe ext.',toma_bano:'Enchufe baño',toma_enc:'Enchufe encim.',toma_horno:'Horno',toma_lav:'Lavadora',toma_lvj:'Lavavajillas',toma_sec:'Secadora',extractor:'Extractor',cuadro:'CUADRO',tv:'TV',rj45:'Datos',router:'Router',ap:'WiFi',videop:'Videoport.',alarma:'Alarma',sensor:'Sensor',camara:'Cámara',dom:'Domótica',split_i:'Split',split_e:'Ud. ext.',radiador:'Radiador',suelo:'Suelo radiante',termostato:'Termostato',termo:'Termo',aerot:'Aerotermia',caldera:'Caldera',solar:'Solar',deposito:'Depósito',rad_agua:'Rad. agua',llave:'Llave agua',cont_agua:'Cont. agua',lavabo:'Lavabo',ducha:'Ducha',banera:'Bañera',inodoro:'WC',bide:'Bidé',fregadero:'Fregadero',lav_agua:'Agua lavad.',lvj_agua:'Agua lavav.',grifo_ext:'Grifo ext.',gas_cont:'Contador gas',gas_cocina:'Cocina gas',gas_calentador:'Calentador',gas_rejilla:'Rejilla vent.',gas_humos:'Humos'};
const COMMON=['luz','foco','interruptor','conmutador','toma','tv','rj45','toma_bano','toma_enc','sensor'];
const planBox=h=>({w:Math.max(300,...h.rooms.map(r=>r.x+r.w)),h:Math.max(300,...h.rooms.map(r=>r.y+r.h))});
function csObj(){const h=HS();if(!CS.sel)return null;return CS.sel.t==='room'?h.rooms.find(r=>r.id===CS.sel.id):h.items.find(i=>i.id===CS.sel.id)}
function casaCalc(){const h=HS(),C=houseCalc(h),codeOf={};Object.values(C.circ).forEach(c=>c.items.forEach(i=>codeOf[i.id]=c.code));CS.cache={C,iss:houseIssues(h,C),codeOf};return CS.cache}
function vCasa(){
  const h=HS(),K=casaCalc(),C=K.C,iss=K.iss,errs=iss.filter(i=>i.lv==='err').length,warns=iss.filter(i=>i.lv==='warn').length,lv=errs?'err':warns?'warn':'ok';
  const b=B(),bv=b.root?verdict(analyze(b)):null;
  const tabs=Object.entries(HCAT).map(([k,v])=>`<span class="chip ${CS.cat===k?'on':''}" style="${CS.cat===k?`border-color:${v.c}`:''};font-weight:600;color:${v.c}" onclick="CS.cat='${k}';render()">${v.n}</span>`).join('');
  const chips=Object.entries(HI).filter(([k,d])=>d.cat===CS.cat).map(([k,d])=>`<span class="chip ${CS.tool==='item'&&CS.place===k?'on':''}" onclick="CS.tool='item';CS.place='${k}';CS.sel=null;render()"><svg width="26" height="26" viewBox="-30 -30 60 60">${glyph({k,x:0,y:0},HCAT[d.cat].c,false)}</svg>${SHORT[k]||d.n}${d.kw?`<small class="muted"> ${d.kw} kW</small>`:''}</span>`).join('');
  const palette=CS.sim?'':`<div class="card noprint" style="padding:8px"><div class="bar" style="margin:0 0 6px">${tabs}<span style="flex:1"></span><select onchange="CS.rtype=this.value">${Object.entries(RT).map(([k,v])=>`<option value="${k}" ${CS.rtype===k?'selected':''}>${v}</option>`).join('')}</select><button class="b ${CS.tool==='room'?'':'s'}" onclick="CS.tool='room';CS.sel=null;render()">+ Dibujar estancia</button><button class="b ${CS.tool==='sel'?'':'s'}" onclick="CS.tool='sel';CS.place=null;render()">Seleccionar / mover</button></div>
    <div style="display:flex;flex-wrap:wrap;gap:5px">${chips}</div><p class="muted" style="font-size:12.5px;margin:6px 0 0">${CS.tool==='room'?'Arrastra sobre el plano para dibujar la estancia.':CS.tool==='item'?'Toca el plano para colocar «'+esc(HI[CS.place].n)+'».':'Toca un elemento o estancia para editarlo; arrástralo para moverlo.'}</p></div>`;
  const top=`<div class="bar noprint"><select onchange="if(this.value){csTpl(this.value)}"><option value="">Plantilla de casa…</option>${Object.entries(HTPL).map(([k,v])=>`<option value="${k}">${v.n}</option>`).join('')}</select><button class="b s" onclick="csClear()">Vaciar</button>
    <button class="b ${CS.sim?'s':''}" onclick="csSim(false)">✎ Editar plano</button><button class="b ${CS.sim?'':'s'}" style="${CS.sim?'background:#c62828':''}" onclick="csSim(true)">▶ Simular funcionamiento</button><span style="flex:1"></span>
    <button class="b s" onclick="CS.zoom=Math.max(0.6,CS.zoom-0.2);render()">−</button><span class="muted">${Math.round(CS.zoom*100)}%</span><button class="b s" onclick="CS.zoom=Math.min(3,CS.zoom+0.2);render()">+</button>
    <button class="b s" onclick="CS.wide=!CS.wide;render()">${CS.wide?'Plano + paneles':'Ampliar plano'}</button></div>`;
  const lay=Object.entries(HCAT).map(([k,v])=>`<label style="display:inline-flex;gap:3px;margin:0 10px 0 0;align-items:center;color:${v.c};font-weight:600"><input type="checkbox" ${CS.layers[k]?'checked':''} onchange="CS.layers['${k}']=this.checked?1:0;casaDraw()"> ${v.n}</label>`).join('');
  const legend=`<details style="margin:6px 4px 2px"><summary style="cursor:pointer;font-weight:600">Leyenda: cómo leer el plano</summary><div style="font-size:12.5px;line-height:1.7;margin-top:4px">
    <b>Cables eléctricos:</b> un color por circuito (${Object.keys(CIRC).slice(0,6).map(c=>`<b style="color:${hexs(CIRCCOL[c])}">${c}</b>`).join(' ')}…). El símbolo de cada enchufe/luz lleva el color de su circuito.<br>
    <span style="color:#00acc1"><b>- - -</b></span> datos/TV · <span style="color:#1e88e5"><b>━</b></span> agua fría · <span style="color:#e53935"><b>━</b></span> agua caliente · <span style="color:#fb8c00"><b>━</b></span> gas (el grosor indica el diámetro).<br>
    <b>Símbolos:</b> ⊗ luz · ● foco · ◜ interruptor · ⊃ enchufe · ▭ aparato. En <b>Simular</b>, pulsa los interruptores, enchufes, aparatos y grifos.</div></details>`;
  const plan=`<div class="card m-center" style="padding:6px;align-self:start"><div class="bar" style="margin:2px 4px 6px">${lay}<label style="display:inline-flex;gap:3px;margin:0 10px 0 0;align-items:center"><input type="checkbox" ${CS.routes?'checked':''} onchange="CS.routes=this.checked;casaDraw()"> Rutas</label><label style="display:inline-flex;gap:4px;margin:0;align-items:center">Nombres <select onchange="CS.labels=this.value;casaDraw()"><option value="main" ${CS.labels==='main'?'selected':''}>Solo aparatos</option><option value="all" ${CS.labels==='all'?'selected':''}>Todos</option><option value="off" ${CS.labels==='off'?'selected':''}>Ninguno</option></select></label></div>
    <div style="overflow:auto;max-height:${CS.wide?'88vh':'80vh'};border-radius:6px;border:1px solid var(--bd)"><svg id="cs-svg" viewBox="-80 -80 ${planBox(h).w+160} ${planBox(h).h+150}" style="width:${CS.zoom*100}%;min-width:${CS.wide?'100%':'560px'};height:auto;background:#fff;touch-action:${CS.zoom>1?'pan-x pan-y':'none'};display:block">
    <defs><radialGradient id="glw"><stop offset="0" stop-color="#ffe680" stop-opacity=".95"/><stop offset="1" stop-color="#ffe680" stop-opacity="0"/></radialGradient><pattern id="hat" width="14" height="14" patternUnits="userSpaceOnUse"><path d="M0 14L14 0" stroke="#e5a" stroke-width="2"/></pattern></defs><g id="cs-g"></g></svg></div>${legend}</div>`;
  const side=CS.sim?`<div id="hs-panel">${hsPanel()}</div>`:inspCasa(h,C);
  const right=`<div>${side}
   <div class="card"><div class="chk ${lv}" style="font-weight:700;margin:0 0 8px">${lv==='ok'?'✔ CASA VÁLIDA':lv==='warn'?'⚠ VÁLIDA CON AVISOS ('+warns+')':'✖ NO VÁLIDA · '+errs+' fallo'+(errs>1?'s':'')}</div>
   ${bv?`<div class="chk ${bv.lv}" style="margin:0 0 8px">Cuadro: ${bv.txt}</div>`:'<div class="chk info" style="margin:0 0 8px">Aún no hay cuadro: pulsa «Generar cuadro desde la casa».</div>'}
   <div class="bar"><button class="b" onclick="csEquip()">Equipar según normativa</button><button class="b" onclick="csGen()">Generar cuadro desde la casa</button></div>
   <label style="margin:2px 0">Personas en la vivienda</label><input type="number" min="1" value="${h.persons}" style="width:80px" onchange="HS().persons=num(this.value,3);render()">
   <p class="muted" style="font-size:12px;margin:6px 0 0">${C.area.toFixed(0)} m² útiles · electrificación ${C.elev?'<b>elevada</b>':'básica'} · ${h.items.length} elementos</p></div>
   <div class="card"><h3>Circuitos eléctricos (ITC-BT-25)</h3><table style="font-size:12.5px"><tr><th>Circ.</th><th>Pts</th><th>kW</th><th>In</th><th>mm²</th><th>m</th></tr>${Object.values(C.circ).map(c=>`<tr><td title="${esc(c.def.n)}"><b style="color:${hexs(CIRCCOL[c.code])}">${c.code}</b> <small class="muted">${esc(c.def.n)}</small></td><td>${c.pts}</td><td>${f1(c.kw)}</td><td>${c.def.In}</td><td>${c.def.sec}</td><td>${c.lenM}</td></tr>`).join('')||'<tr><td colspan="6" class="muted">Sin circuitos todavía.</td></tr>'}</table>
   ${C.cold?`<p style="font-size:12.5px;margin:8px 0 0">Agua: ${Math.round(C.cold.total/100*1.1)} m de tubería, Ø ${[...new Set(C.cold.edges.map(e=>e.dn))].join('/')} mm${C.hot?` · ACS hasta ${C.hot.farM} m`:''}</p>`:''}
   ${C.gas?`<p style="font-size:12.5px;margin:4px 0 0">Gas: ${C.gas.kw} kW · ${Math.round(C.gas.total/100*1.1)} m · Ø ${[...new Set(C.gas.edges.map(e=>e.dn))].join('/')} mm</p>`:''}</div>
   <div class="card"><h3>Fallos y avisos</h3>${['ele','tel','cli','agu','gas'].map(cat=>{const l=iss.filter(i=>i.cat===cat);return l.length?`<div style="font-weight:600;color:${HCAT[cat].c};margin-top:6px">${HCAT[cat].n}</div>`+l.map(i=>`<div class="chk ${i.lv}" ${i.id?`style="cursor:pointer" onclick="CS.sel={t:'item',id:'${i.id}'};render()"`:''}>${esc(i.msg)}</div>`).join(''):''}).join('')||'<div class="chk ok">Sin fallos ni avisos.</div>'}</div></div>`;
  return top+palette+`<div class="gc ${CS.wide?'wide':''}">${plan}${right}</div>`;
}
window.csSim=on=>{if(on){hsInit();CS.sim=true;CS.sel=null;CS.tool='sel'}else CS.sim=false;render()};
function inspCasa(h,C){const o=csObj();if(!o)return'<div class="card muted">Selecciona una estancia o un elemento del plano para editarlo.</div>';
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
window.csTpl=k=>{if(HS().rooms.length&&!confirm('Se reemplazará la casa actual.'))return;P().house=loadHouse(k);CS.sel=null;CS.sim=false;render()};
window.csEquip=()=>{autoEquip(HS());render()};
window.csGen=()=>{if(!HS().items.length)return alert('Coloca antes elementos en el plano (o usa «Equipar según normativa»).');
  if(B().root&&!confirm('Se reemplazará el contenido del cuadro actual.'))return;if(genBoard(B(),HS())){selId=null;M3D.autoB();alert('Cuadro generado desde la casa. Revísalo en «Cuadro» y míralo en «Montaje 3D».');render()}else alert('No hay puntos eléctricos que alimentar.')};

// ---------- símbolos ----------
function glyph(it,c,lit,ring){const k=it.k,S=`stroke="${c}" stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round"`,rg=ring||c;
  const circ=(r,f)=>`<circle r="${r}" fill="${f||'#fff'}" stroke="${rg}" stroke-width="4.5"/>`;
  switch(k){
    case 'luz':return circ(17,lit?'#ffe066':'#fff')+`<path d="M-11 -11L11 11M11 -11L-11 11" ${S}/>`;
    case 'foco':return circ(15,lit?'#ffe066':'#fff')+`<circle r="6" fill="${c}"/>`;
    case 'extractor':return circ(17)+`<path d="M0 -10V10M-10 0H10M-7 -7L7 7M7 -7L-7 7" ${S}/>`;
    case 'interruptor':return `<circle r="10" fill="#fff" stroke="${rg}" stroke-width="4.5"/><path d="M7 -7L22 -22" ${S}/>`;
    case 'conmutador':return `<circle r="10" fill="#fff" stroke="${rg}" stroke-width="4.5"/><path d="M7 -7L22 -22M11 -1L26 -16" ${S}/>`;
    case 'toma':case 'toma_ext':case 'toma_bano':case 'toma_enc':case 'toma_horno':case 'toma_lav':case 'toma_lvj':case 'toma_sec':
      return circ(17)+`<path d="M-9 1A9 9 0 0 1 9 1M-9 1H9M-4 1V9M4 1V9" ${S}/>`+(k==='toma_horno'?'<text y="-20" text-anchor="middle" font-size="12" font-weight="700" fill="'+c+'">25A</text>':'');
    case 'tv':return `<rect x="-19" y="-14" width="38" height="28" rx="4" fill="#fff" stroke="${c}" stroke-width="4.5"/><text y="5" text-anchor="middle" font-size="14" font-weight="800" fill="${c}">TV</text>`;
    case 'rj45':return `<rect x="-17" y="-13" width="34" height="26" rx="4" fill="#fff" stroke="${c}" stroke-width="4.5"/><text y="5" text-anchor="middle" font-size="12" font-weight="800" fill="${c}">RJ</text>`;
    case 'router':case 'ap':return `<rect x="-19" y="-5" width="38" height="18" rx="4" fill="#fff" stroke="${c}" stroke-width="4.5"/><path d="M-10 -9A14 14 0 0 1 10 -9M-5 -14A8 8 0 0 1 5 -14" ${S}/>`;
    case 'cuadro':return `<rect x="-20" y="-22" width="40" height="44" rx="4" fill="#37474f" stroke="${rg}" stroke-width="4.5"/><path d="M-10 -10H10M-10 0H10M-10 10H10" stroke="#ffd54f" stroke-width="4"/>`;
    case 'split_i':return `<rect x="-24" y="-11" width="48" height="22" rx="5" fill="#fff" stroke="${c}" stroke-width="4.5"/><path d="M-14 3H14" ${S}/>`;
    case 'split_e':return circ(18)+`<path d="M0 -11V11M-11 0H11" ${S}/>`;
    case 'radiador':case 'rad_agua':return `<rect x="-22" y="-12" width="44" height="24" rx="3" fill="#fff" stroke="${c}" stroke-width="4.5"/><path d="M-12 -7V7M-4 -7V7M4 -7V7M12 -7V7" ${S}/>`;
    case 'termo':case 'deposito':return `<rect x="-14" y="-20" width="28" height="40" rx="12" fill="#fff" stroke="${c}" stroke-width="4.5"/><text y="6" text-anchor="middle" font-size="14" font-weight="800" fill="${c}">${k==='termo'?'T':'D'}</text>`;
    case 'caldera':case 'gas_calentador':return `<rect x="-19" y="-21" width="38" height="42" rx="5" fill="#fff" stroke="${c}" stroke-width="4.5"/><path d="M0 -10C8 -2 8 6 0 10C-8 6 -8 -2 0 -10Z" fill="${c}"/>`;
    case 'gas_cocina':return `<rect x="-22" y="-22" width="44" height="44" rx="4" fill="#fff" stroke="${c}" stroke-width="4.5"/><circle cx="-9" cy="-9" r="5" fill="${c}"/><circle cx="9" cy="-9" r="5" fill="${c}"/><circle cx="-9" cy="9" r="5" fill="${c}"/><circle cx="9" cy="9" r="5" fill="${c}"/>`;
    case 'lavabo':return `<rect x="-22" y="-15" width="44" height="30" rx="14" fill="#fff" stroke="${c}" stroke-width="4.5"/><circle r="3" fill="${c}"/>`;
    case 'ducha':return `<rect x="-22" y="-22" width="44" height="44" rx="3" fill="#fff" stroke="${c}" stroke-width="4.5"/><circle r="9" fill="none" stroke="${c}" stroke-width="3"/><path d="M-5 -2L-8 6M0 -2V8M5 -2L8 6" ${S}/>`;
    case 'banera':return `<rect x="-28" y="-15" width="56" height="30" rx="12" fill="#fff" stroke="${c}" stroke-width="4.5"/>`;
    case 'inodoro':case 'bide':return `<ellipse rx="14" ry="19" fill="#fff" stroke="${c}" stroke-width="4.5"/><rect x="-10" y="-26" width="20" height="9" fill="#fff" stroke="${c}" stroke-width="3.5"/>`;
    case 'fregadero':return `<rect x="-26" y="-16" width="52" height="32" rx="3" fill="#fff" stroke="${c}" stroke-width="4.5"/><rect x="-19" y="-10" width="38" height="20" rx="3" fill="none" stroke="${c}" stroke-width="3"/>`;
    case 'llave':case 'cont_agua':case 'gas_cont':return `<circle r="16" fill="#fff" stroke="${c}" stroke-width="4.5"/><path d="M-9 -9L9 9M9 -9L-9 9" ${S}/>`;
    default:return `<rect x="-18" y="-18" width="36" height="36" rx="8" fill="#fff" stroke="${c}" stroke-width="4.5"/><text y="5" text-anchor="middle" font-size="14" font-weight="800" fill="${c}">${(HI[k]||{}).ab||'?'}</text>`}}
function itemSVG(it,sel,bad,K){const d=HI[it.k],cat=HCAT[d.cat].c,code=K.codeOf[it.id]||(d.sw?'C1':null),col=code&&d.cat==='ele'&&it.k!=='cuadro'?hexs(CIRCCOL[code]):cat;
  if(it.k==='suelo')return`<rect x="${it.x}" y="${it.y}" width="${it.w||200}" height="${it.d||150}" fill="url(#hat)" stroke="${cat}" stroke-dasharray="10 6" stroke-width="3" opacity=".7"/><text x="${it.x+8}" y="${it.y+22}" font-size="18" fill="${cat}">suelo radiante</text>`;
  let pre='',post='',lit=false,dead=false,op=1;const S=CS.sim?SIMH.m:null;
  if(S){const live=hsLive(code||(d.pw?'C2':null));
    if(it.k==='luz'||it.k==='foco'){lit=live&&lightOn(S,it);if(lit)pre=`<circle r="${it.k==='foco'?55:85}" fill="url(#glw)"/>`}
    else if(it.k==='interruptor'||it.k==='conmutador'){const on=!!SIMH.sw[it.id];post=`<text y="-30" text-anchor="middle" font-size="15" font-weight="800" fill="${on?'#2e7d32':'#777'}">${on?'ON':'OFF'}</text>`+(on?'<circle r="26" fill="none" stroke="#2e7d32" stroke-width="3"/>':'')}
    else if(PLUGGABLE.includes(it.k)){const p=SIMH.plug[it.id];post=live?'<circle cx="19" cy="-19" r="6" fill="#2e7d32" stroke="#fff" stroke-width="2"/>':'<circle cx="19" cy="-19" r="6" fill="#999" stroke="#fff" stroke-width="2"/>';if(p)post+=`<rect x="-52" y="44" width="104" height="22" rx="6" fill="#ff9800" stroke="#fff" stroke-width="2"/><text y="60" text-anchor="middle" font-size="13" font-weight="700" fill="#fff">${esc(PLUGS[p].n)}</text>`}
    else if(RUNNABLE.includes(it.k)||HI[it.k].ud||it.k==='gas_cocina'||it.k==='gas_calentador'){const on=!!SIMH.run[it.id];if(on){const c2=HI[it.k].ud?'#1e88e5':HI[it.k].kwg?'#fb8c00':it.k==='split_i'?'#26a6d1':'#e53935';post=`<circle r="32" fill="none" stroke="${c2}" stroke-width="4" class="pulse"/><text y="-36" text-anchor="middle" font-size="15" font-weight="800" fill="${c2}">ON</text>`+(HI[it.k].ud?'<circle cx="-6" cy="30" r="4" fill="#1e88e5" class="drip"/><circle cx="6" cy="30" r="4" fill="#1e88e5" class="drip" style="animation-delay:.4s"/>':'')+(HI[it.k].kwg?'<path d="M0 -36C8 -26 8 -20 0 -14C-8 -20 -8 -26 0 -36Z" fill="#ff9800" class="pulse"/>':'')}
      if(on&&code&&!live)post+='<text y="48" text-anchor="middle" font-size="13" font-weight="700" fill="#c62828">sin tensión</text>'}
    else if(it.k==='cuadro'){const any=Object.keys(SIMH.trip).some(k=>SIMH.trip[k]);if(any)post='<rect x="-26" y="-28" width="52" height="56" rx="6" fill="none" stroke="#c62828" stroke-width="5" class="pulse"/><text y="-36" text-anchor="middle" font-size="15" font-weight="800" fill="#c62828">DISPARO</text>'}
    if(code&&!live&&d.cat==='ele'&&it.k!=='cuadro')op=0.45;if(SIMH.sel===it.id)pre+='<circle r="34" fill="none" stroke="#0b7a4b" stroke-width="4" stroke-dasharray="6 5"/>'}
  const label=(CS.labels==='all'||(CS.labels==='main'&&!COMMON.includes(it.k)))?`<text y="${it.k==='cuadro'?42:38}" text-anchor="middle" font-size="14" font-weight="600" fill="#334" stroke="#fff" stroke-width="4" paint-order="stroke">${SHORT[it.k]||d.n}${code&&d.cat==='ele'&&it.k!=='cuadro'&&!CS.sim?' · '+code:''}</text>`:'';
  const selMark=!CS.sim&&sel?'<circle r="32" fill="none" stroke="#0b7a4b" stroke-width="5"/>':'';
  const badge=bad?`<circle cx="22" cy="-22" r="9" fill="${bad==='err'?'#c62828':'#e08a00'}" stroke="#fff" stroke-width="3"/><text x="22" y="-17" text-anchor="middle" font-size="13" font-weight="800" fill="#fff">!</text>`:'';
  return`<g transform="translate(${it.x} ${it.y}) scale(1.15)" opacity="${op}" data-id="${it.id}">${pre}${selMark}${glyph(it,cat,lit,col)}${label}${post}${badge}</g>`}
window.casaDraw=()=>{const g=document.getElementById('cs-g');if(!g)return;const h=HS(),K=CS.cache||casaCalc(),C=K.C,bad={};K.iss.forEach(i=>{if(i.id&&(!bad[i.id]||i.lv==='err'))bad[i.id]=i.lv});const S=CS.sim?SIMH.m:null;
  const pb=planBox(h);let s='';for(let x=0;x<=pb.w;x+=100){s+=`<line x1="${x}" y1="0" x2="${x}" y2="${pb.h}" stroke="#eef1f3" stroke-width="2"/><line x1="${x}" y1="-14" x2="${x}" y2="0" stroke="#889" stroke-width="2"/>${x%200===0?`<text x="${x}" y="-24" text-anchor="middle" font-size="20" fill="#667">${x/100} m</text>`:''}`}
  for(let y=0;y<=pb.h;y+=100)s+=`<line x1="0" y1="${y}" x2="${pb.w}" y2="${y}" stroke="#eef1f3" stroke-width="2"/><line x1="-14" y1="${y}" x2="0" y2="${y}" stroke="#889" stroke-width="2"/>${y%200===0?`<text x="-22" y="${y+7}" text-anchor="end" font-size="20" fill="#667">${y/100} m</text>`:''}`;
  const litRooms=new Set();if(S)h.items.forEach(i=>{if((i.k==='luz'||i.k==='foco')&&hsLive(S.codeOf[i.id]||'C1')&&lightOn(S,i)){const r=roomAt(h,i.x,i.y);if(r)litRooms.add(r.id)}});
  h.rooms.forEach(r=>{const sel=CS.sel&&CS.sel.t==='room'&&CS.sel.id===r.id;s+=`<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" fill="${RCOL[r.type]}" stroke="${sel?'#0b7a4b':'#37474f'}" stroke-width="${sel?10:8}" stroke-linejoin="round"/>`;
    if(litRooms.has(r.id))s+=`<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" fill="#ffe680" opacity=".38" pointer-events="none"/>`;
    s+=`<text x="${r.x+r.w/2}" y="${r.y+r.h-26}" text-anchor="middle" font-size="30" font-weight="800" fill="#37474f" opacity=".85" pointer-events="none" stroke="#fff" stroke-width="5" paint-order="stroke">${esc(r.name||RT[r.type])}</text><text x="${r.x+r.w/2}" y="${r.y+r.h-62}" text-anchor="middle" font-size="22" fill="#667" pointer-events="none" stroke="#fff" stroke-width="4" paint-order="stroke">${(r.w/100).toFixed(1)} × ${(r.h/100).toFixed(1)} m · ${(r.w*r.h/10000).toFixed(1)} m²</text>`;
    if(sel&&!CS.sim)s+=`<rect x="${r.x+r.w-16}" y="${r.y+r.h-16}" width="28" height="28" fill="#0b7a4b" stroke="#fff" stroke-width="3"/>`});
  const path=(a,b)=>`M${a.x} ${a.y} H${b.x} V${b.y}`;
  if(CS.routes){
    if(CS.layers.ele)Object.values(C.circ).forEach(c=>c.segs.forEach(sg=>{const live=!S||hsLive(c.code),act=S&&live&&(SIMH.cur.I[c.code]||0)>0.01;
      s+=`<path d="${path(sg.a,sg.b)}" fill="none" stroke="${live?hexs(CIRCCOL[c.code]):'#b0b6bb'}" stroke-width="${act?7:4.5}" stroke-opacity="${live?0.85:0.5}" ${act?'class="flow"':''} ${!live?'stroke-dasharray="4 8"':''} pointer-events="none"/>`}));
    if(CS.layers.tel)C.tel.forEach(t=>{s+=`<path d="${path(t.a,t.it)}" fill="none" stroke="${t.coax?'#7e57c2':'#00acc1'}" stroke-width="3.5" stroke-dasharray="12 9" pointer-events="none"/>`});
    const wOpen=S&&h.items.some(i=>HI[i.k].ud&&SIMH.run[i.id]),hOpen=S&&h.items.some(i=>HI[i.k].hot&&SIMH.run[i.id]&&hsHotOk(S)),gOpen=S&&h.items.some(i=>HI[i.k].kwg&&SIMH.run[i.id]);
    C.pipes.forEach(p=>{const k=p.t==='gas'?'gas':'agu';if(!CS.layers[k])return;const act=p.t==='gas'?gOpen:p.t==='hot'?hOpen:wOpen;
      s+=`<path d="${path(p.a,p.b)}" fill="none" stroke="${p.t==='cold'?'#1e88e5':p.t==='hot'?'#e53935':'#fb8c00'}" stroke-width="${3.5+p.dn/5}" stroke-opacity="${act?1:0.75}" ${act?'class="flow"':''} pointer-events="none"/>`})}
  h.items.forEach(it=>{if(!CS.layers[HI[it.k].cat])return;s+=itemSVG(it,CS.sel&&CS.sel.t==='item'&&CS.sel.id===it.id,bad[it.id],K)});
  if(CS.prev)s+=`<rect x="${CS.prev.x}" y="${CS.prev.y}" width="${CS.prev.w}" height="${CS.prev.h}" fill="#0b7a4b" fill-opacity=".15" stroke="#0b7a4b" stroke-width="5" stroke-dasharray="12 9"/>`;
  g.innerHTML=s};
function casaMount(){const svg=document.getElementById('cs-svg');if(!svg)return;casaDraw();
  const pt=e=>{const p=svg.createSVGPoint();p.x=e.clientX;p.y=e.clientY;const q=p.matrixTransform(svg.getScreenCTM().inverse());return{x:q.x,y:q.y}},sn=(v,s=10)=>Math.round(v/s)*s;
  const hit=q=>{const h=HS();
    let best=null,bd=1e9;h.items.forEach(it=>{if(!CS.layers[HI[it.k].cat])return;if(it.k==='suelo'){if(q.x>=it.x&&q.x<=it.x+(it.w||200)&&q.y>=it.y&&q.y<=it.y+(it.d||150)&&bd>60){best=it;bd=60}return}const d=hdist(it,q);if(d<=32&&d<bd){best=it;bd=d}});if(best)return{t:'item',id:best.id};
    if(CS.sim)return null;
    if(CS.sel&&CS.sel.t==='room'){const r=h.rooms.find(x=>x.id===CS.sel.id);if(r&&Math.abs(q.x-(r.x+r.w))<=30&&Math.abs(q.y-(r.y+r.h))<=30)return{t:'room',id:r.id,resize:true}}
    const rs=h.rooms.filter(r=>q.x>=r.x&&q.x<=r.x+r.w&&q.y>=r.y&&q.y<=r.y+r.h).sort((a,b)=>a.w*a.h-b.w*b.h);return rs[0]?{t:'room',id:rs[0].id}:null};
  svg.onpointerdown=e=>{const q=pt(e),h=HS();
    if(CS.sim){const ht=hit(q);if(ht&&ht.t==='item'){hsClick(ht.id);hsRefresh(true);casaDraw()}return}
    svg.setPointerCapture(e.pointerId);
    if(CS.tool==='room'){CS.drag={m:'room',a:{x:sn(q.x),y:sn(q.y)}};CS.prev={x:sn(q.x),y:sn(q.y),w:0,h:0};return}
    if(CS.tool==='item'&&CS.place){const d=HI[CS.place];let it=d.unique?h.items.find(i=>i.k===CS.place):null;
      if(it){it.x=sn(q.x,5);it.y=sn(q.y,5)}else{it={id:uid(),k:CS.place,x:sn(q.x,5),y:sn(q.y,5)};if(CS.place==='suelo'){it.w=200;it.d=150}h.items.push(it)}
      CS.sel={t:'item',id:it.id};if(d.unique){CS.tool='sel';CS.place=null}render();return}
    const ht=hit(q);CS.sel=ht;
    if(ht){const o=csObj();CS.drag={m:ht.resize?'resize':'move',off:{x:q.x-o.x,y:q.y-o.y},moved:false}}else CS.drag=null;casaDraw()};
  svg.onpointermove=e=>{if(!CS.drag)return;const q=pt(e),d=CS.drag;
    if(d.m==='room'){CS.prev={x:Math.min(d.a.x,sn(q.x)),y:Math.min(d.a.y,sn(q.y)),w:Math.abs(sn(q.x)-d.a.x),h:Math.abs(sn(q.y)-d.a.y)};casaDraw();return}
    const o=csObj();if(!o)return;d.moved=true;
    if(d.m==='resize'){o.w=Math.max(100,sn(q.x)-o.x);o.h=Math.max(100,sn(q.y)-o.y)}
    else{const st=CS.sel.t==='room'?10:5;o.x=sn(q.x-d.off.x,st);o.y=sn(q.y-d.off.y,st)}
    casaDraw()};
  svg.onpointerup=e=>{const d=CS.drag;CS.drag=null;if(!d)return;const h=HS();
    if(d.m==='room'){const p=CS.prev;CS.prev=null;if(p&&p.w>=100&&p.h>=100){const n={id:uid(),type:CS.rtype,x:p.x,y:p.y,w:p.w,h:p.h,name:RT[CS.rtype].split(' /')[0]};h.rooms.push(n);CS.sel={t:'room',id:n.id};h.w=Math.max(h.w,p.x+p.w+100);h.h=Math.max(h.h,p.y+p.h+100)}CS.tool='sel';render();return}
    if(d.moved){h.w=Math.max(h.w,...h.rooms.map(r=>r.x+r.w+100));h.h=Math.max(h.h,...h.rooms.map(r=>r.y+r.h+100))}
    render()};
  document.onkeydown=e=>{if(tab!=='casa'||CS.sim||/INPUT|SELECT|TEXTAREA/.test((document.activeElement||{}).tagName||''))return;if((e.key==='Delete'||e.key==='Backspace')&&CS.sel){e.preventDefault();csDel()}}}

'use strict';
/* Documentos para el cliente: presupuesto con logo, memoria técnica de diseño y borrador de certificado de instalación */
window.XT=window.XT||[];
let dtab='presu';
const CO=()=>S.company||(S.company={name:'',nif:'',addr:'',phone:'',email:'',inst:'',carnet:'',logo:'',cond:'Validez de la oferta: 30 días. Forma de pago: 40 % a la aceptación, 60 % a la finalización. Garantía de 2 años en mano de obra. No incluye ayudas de albañilería ni tasas de legalización salvo indicación.'});
const DOC=()=>P().doc||(P().doc={ref:'',site:'',ownerNif:'',valid:30,pay:''});
window.coSet=(k,v)=>{CO()[k]=v;save()};
window.docSet=(k,v)=>{DOC()[k]=v;save()};
window.coLogo=inp=>{const f=inp.files[0];if(!f)return;const r=new FileReader();r.onload=()=>{const im=new Image();im.onload=()=>{const k=Math.min(1,320/Math.max(im.width,im.height)),c=document.createElement('canvas');c.width=Math.round(im.width*k);c.height=Math.round(im.height*k);c.getContext('2d').drawImage(im,0,0,c.width,c.height);CO().logo=c.toDataURL('image/png');render()};im.src=r.result};r.readAsDataURL(f);inp.value=''};
window.coLogoDel=()=>{CO().logo='';render()};
window.docTab=t=>{dtab=t;render()};
const dFecha=()=>new Date().toLocaleDateString('es-ES',{day:'numeric',month:'long',year:'numeric'});
function companyHead(){const c=CO();if(!(c.name||c.logo))return'';
  return`<div style="display:flex;gap:14px;align-items:center;border-bottom:2px solid #0f2a3d;padding-bottom:8px;margin-bottom:10px">${c.logo?`<img src="${c.logo}" style="max-height:64px;max-width:180px">`:''}<div style="flex:1"><b style="font-size:17px">${esc(c.name)}</b><div class="muted" style="font-size:12px">${[c.nif&&'NIF '+esc(c.nif),esc(c.addr),c.phone&&'Tel. '+esc(c.phone),esc(c.email)].filter(Boolean).join(' · ')}</div>${c.inst?`<div class="muted" style="font-size:12px">Instalador: ${esc(c.inst)}${c.carnet?' · Carné/Empresa instaladora nº '+esc(c.carnet):''}</div>`:''}</div></div>`}
window.companyHead=companyHead;
function budgetClient(){
  const p=P(),t=budget(p),dk=1-p.discount/100,chap={};
  t.lines.forEach(l=>{const c=l.cat||'Otros materiales',m=l.mpct!==null?l.mpct:p.margin;const k=(c==='eléctrico'||!c)?'Material eléctrico':c;chap[k]=chap[k]||{tot:0,n:0,rows:[]};chap[k].tot+=l.tot*dk*(1+m/100);chap[k].n+=l.qty;chap[k].rows.push({n:l.p.name,q:l.qty,t:l.tot*dk*(1+m/100)})});
  const name=k=>(typeof COMPRA_CATS!=='undefined'&&COMPRA_CATS[k]&&(COMPRA_CATS[k].n||COMPRA_CATS[k]))||k;
  const aux=t.aux*(1+p.margin/100),lab=t.labor*(1+p.margin/100);
  return{t,chap,aux,lab,name}}
function docPresu(){
  const p=P(),d=DOC(),c=CO(),{t,chap,aux,lab,name}=budgetClient();
  return`<div class="card doc">${companyHead()}
  <div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap"><div><h2 style="margin:0">Presupuesto${d.ref?' nº '+esc(d.ref):''}</h2><div class="muted">${esc(p.name)}</div></div><div style="text-align:right"><div>Fecha: ${dFecha()}</div><div>Validez: ${d.valid||30} días</div></div></div>
  <div style="margin:10px 0;padding:8px;background:#f4f6f8;border-radius:6px"><b>Cliente:</b> ${esc(p.client||'—')}${d.ownerNif?' · NIF '+esc(d.ownerNif):''}<br><b>Obra:</b> ${esc(d.site||'—')}</div>
  <table><tr><th>Capítulo</th><th class="r">Ud.</th><th class="r">Importe</th></tr>
  ${Object.entries(chap).map(([k,v])=>`<tr><td><b>${esc(name(k))}</b><div class="muted" style="font-size:11.5px">${v.rows.slice(0,6).map(r=>r.q+' × '+esc(r.n)).join(' · ')}${v.rows.length>6?' · …':''}</div></td><td class="r">${v.n}</td><td class="r">${eur(v.tot)}</td></tr>`).join('')}
  <tr><td>Pequeño material, cableado y conexionado</td><td></td><td class="r">${eur(aux)}</td></tr>
  <tr><td>Mano de obra de montaje y puesta en servicio (${f1(t.hours)} h)</td><td></td><td class="r">${eur(lab)}</td></tr>
  <tr class="tot"><td colspan="2">Base imponible</td><td class="r">${eur(t.base)}</td></tr><tr><td colspan="2">IVA ${p.vat}%</td><td class="r">${eur(t.vat)}</td></tr>
  <tr class="tot"><td colspan="2" style="font-size:16px">TOTAL</td><td class="r" style="font-size:16px">${eur(t.total)}</td></tr></table>
  <p style="font-size:12.5px;margin-top:10px"><b>Condiciones:</b> ${esc(d.pay||c.cond)}</p>
  <div style="display:flex;gap:30px;margin-top:26px"><div style="flex:1;border-top:1px solid #888;padding-top:4px;font-size:12px">Por la empresa${c.inst?': '+esc(c.inst):''}</div><div style="flex:1;border-top:1px solid #888;padding-top:4px;font-size:12px">Aceptación del cliente (firma y fecha)</div></div></div>`}
function docMemoria(){
  const p=P(),d=DOC(),h=p.house;
  const secs=p.boards.filter(b=>b.root).map(b=>{const a=analyze(b),R=typeof scCalc==='function'?scCalc(b):null,rows=[];
    walk(b.root,(n,par,dep)=>{const i=a.info[n.id];if(!i||!['mcb','rcbo','mpcb','incomer','rcd'].includes(i.p.kind)&&!['load','motor'].includes(i.p.kind))return;rows.push(`<tr><td style="padding-left:${6+dep*12}px">${esc(label(n))}</td><td>${esc(i.p.name)}</td><td class="r">${f1(i.ib)}</td><td>${i.cable||'—'}</td><td class="r">${i.dv?f1(i.dv)+'%':'—'}</td></tr>`)});
    const e=a.issues.filter(x=>x.lv==='err');
    return`<h3>${esc(b.name)}</h3><p>${b.phases===3?'Trifásico 400 V':'Monofásico 230 V'}, intensidad de cortocircuito prevista en cabecera ${b.isc} kA, coeficiente de simultaneidad ${b.ks}.${R?` Potencia prevista ${f1(R.pot.kw)} kW (a contratar ${f1(R.pot.contr)} kW), interruptor general recomendado ${R.pot.iga} A.`:''}</p>
    <table><tr><th>Circuito / aparato</th><th>Característica</th><th class="r">Ib (A)</th><th>Cable Cu</th><th class="r">c.d.t.</th></tr>${rows.join('')}</table>
    <p>${e.length?`<b style="color:#c62828">Atención: ${e.length} incumplimiento(s) pendientes de corregir.</b>`:'Verificación automática: sin incumplimientos de calibres, secciones, caídas de tensión ni poder de corte.'}${R&&R.issues.filter(x=>x.lv==='warn').length?` ${R.issues.filter(x=>x.lv==='warn').length} aviso(s) de cortocircuito/selectividad.`:''}</p>`}).join('');
  const hn=h&&h.items.length?`<p>La instalación incluye ${h.items.length} elementos repartidos en ${h.rooms.length} estancias (${(typeof casaCalc==='function'?'ver plano en el informe':'')}) con instalación eléctrica, telecomunicaciones/domótica, climatización y agua caliente, fontanería y gas.</p>`:'';
  return`<div class="card doc">${companyHead()}<h2 style="margin:0">Memoria técnica de diseño</h2><div class="muted">${esc(p.name)} · ${dFecha()}</div>
  <h3>1. Datos generales</h3><table><tr><td>Titular</td><td>${esc(p.client||'—')}${d.ownerNif?' (NIF '+esc(d.ownerNif)+')':''}</td></tr><tr><td>Emplazamiento</td><td>${esc(d.site||'—')}</td></tr><tr><td>Uso</td><td>${esc(Object.values(USES)[Object.keys(USES).indexOf(p.boards[0].use)]||'General')}</td></tr><tr><td>Expediente</td><td>${esc(d.ref||'—')}</td></tr></table>
  <h3>2. Normativa aplicable</h3><p style="font-size:13px">Reglamento Electrotécnico para Baja Tensión (RD 842/2002) y sus ITC: BT-05 (verificaciones), BT-17 y 22 (protecciones), BT-18 (puesta a tierra), BT-19 (prescripciones generales), BT-20 y 21 (instalaciones interiores y tubos), BT-24 (contactos), BT-25 (viviendas), BT-27 (cuartos de baño), BT-47 (motores), BT-52 (recarga VE) y BT-40 (generadores). Código Técnico de la Edificación (CTE) para fontanería y gas cuando proceda.</p>
  <h3>3. Descripción de la instalación</h3>${hn}${secs||'<p class="muted">Sin cuadros definidos.</p>'}
  <h3>4. Puesta a tierra y protección contra contactos</h3><p style="font-size:13px">Esquema de distribución TT. Toda masa metálica se conecta al conductor de protección. Con diferenciales de 30 mA la resistencia de tierra no superará 37 Ω (ITC-BT-18) y se medirá en la verificación inicial.</p>
  <h3>5. Cálculos justificativos</h3><p style="font-size:13px">Intensidad de cálculo con simultaneidad, sección de cable por intensidad admisible y caída de tensión (cobre, ρ = 0,0227 Ω·mm²/m), límites 3 % alumbrado y 5 % resto. Cortocircuito: poder de corte ≥ Icc prevista; disparo magnético garantizado al final de cada línea con U×0,8; selectividad estimada entre protecciones. Los valores definitivos deben contrastarse con los datos del fabricante.</p>
  <div style="display:flex;gap:30px;margin-top:26px"><div style="flex:1;border-top:1px solid #888;padding-top:4px;font-size:12px">El instalador / técnico: ${esc(CO().inst||'')}</div><div style="flex:1;border-top:1px solid #888;padding-top:4px;font-size:12px">Fecha y firma</div></div></div>`}
function docCIE(){
  const p=P(),d=DOC(),c=CO(),b=p.boards[0],R=typeof scCalc==='function'&&b.root?scCalc(b):null;
  return`<div class="card doc">${companyHead()}<h2 style="margin:0">Certificado de instalación eléctrica en baja tensión</h2><div class="chk warn" style="margin:6px 0">Borrador de apoyo: el certificado oficial se presenta en el modelo de tu Comunidad Autónoma y lo firma el instalador autorizado.</div>
  <h3>Titular</h3><table><tr><td>Nombre</td><td>${esc(p.client||'—')}</td><td>NIF</td><td>${esc(d.ownerNif||'—')}</td></tr><tr><td>Emplazamiento</td><td colspan="3">${esc(d.site||'—')}</td></tr></table>
  <h3>Características de la instalación</h3><table><tr><td>Tensión</td><td>${b.phases===3?'400/230 V trifásica':'230 V monofásica'}</td><td>Potencia prevista</td><td>${R?f1(R.pot.kw)+' kW':'—'}</td></tr><tr><td>Interruptor general</td><td>${R?R.pot.iga+' A':'—'}</td><td>Icc en cabecera</td><td>${b.isc} kA</td></tr><tr><td>Nº de cuadros</td><td>${p.boards.length}</td><td>Uso</td><td>${esc(USES[b.use]||'General')}</td></tr></table>
  <h3>Verificaciones (ITC-BT-05)</h3><table><tr><th>Medida</th><th>Valor</th><th>Resultado</th></tr>${['Resistencia de tierra (Ω)','Aislamiento entre conductores y masa (MΩ)','Continuidad del conductor de protección','Disparo de diferenciales (ms / mA)','Caída de tensión en el circuito más desfavorable (%)'].map(x=>`<tr><td>${x}</td><td style="min-width:120px">&nbsp;</td><td>☐ Correcto &nbsp; ☐ Incorrecto</td></tr>`).join('')}</table>
  <h3>Declaración</h3><p style="font-size:13px">El instalador abajo firmante, ${esc(c.inst||'________')}${c.carnet?' (nº '+esc(c.carnet)+')':''}, certifica que la instalación descrita ha sido ejecutada conforme al Reglamento Electrotécnico para Baja Tensión (RD 842/2002) y sus instrucciones técnicas complementarias, y se ajusta a la memoria técnica de diseño adjunta.</p>
  <div style="display:flex;gap:30px;margin-top:26px"><div style="flex:1;border-top:1px solid #888;padding-top:4px;font-size:12px">Instalador autorizado — ${dFecha()}</div><div style="flex:1;border-top:1px solid #888;padding-top:4px;font-size:12px">Sello de la empresa</div></div></div>`}
function vDocs(){
  const c=CO(),d=DOC(),art=!!window.__ART,inp=(k,l,v,w)=>`<div style="flex:${w||1};min-width:150px"><label>${l}</label><input style="width:100%" value="${esc(v||'')}" onchange="coSet('${k}',this.value)"></div>`,inp2=(k,l,v,w)=>`<div style="flex:${w||1};min-width:150px"><label>${l}</label><input style="width:100%" value="${esc(v||'')}" onchange="docSet('${k}',this.value)"></div>`;
  const tb=[['presu','Presupuesto cliente'],['mem','Memoria técnica'],['cie','Certificado (borrador)']];
  return`<div class="card noprint"><h3>Tu empresa y la obra</h3><p class="muted" style="margin:0 0 4px;font-size:12.5px">Estos datos salen en los documentos y en el informe.</p>
  <div class="bar" style="align-items:flex-end">${inp('name','Empresa',c.name,2)}${inp('nif','NIF',c.nif)}${inp('phone','Teléfono',c.phone)}${inp('email','Correo',c.email,2)}</div>
  <div class="bar" style="align-items:flex-end">${inp('addr','Dirección',c.addr,3)}${inp('inst','Instalador',c.inst,2)}${inp('carnet','Nº carné / empresa instaladora',c.carnet,2)}</div>
  <div class="bar" style="align-items:flex-end">${c.logo?`<img src="${c.logo}" style="max-height:48px"><button class="b s" onclick="coLogoDel()">Quitar logo</button>`:''}<button class="b s" onclick="document.getElementById('co-logo').click()">${c.logo?'Cambiar':'Subir'} logo</button><input type="file" id="co-logo" accept="image/*" hidden onchange="coLogo(this)"></div>
  <div class="bar" style="align-items:flex-end">${inp2('ref','Nº de expediente / presupuesto',d.ref)}${inp2('site','Emplazamiento de la obra',d.site,3)}${inp2('ownerNif','NIF del cliente',d.ownerNif)}${inp2('valid','Validez (días)',d.valid)}</div>
  <label>Condiciones de pago y garantía</label><textarea style="width:100%;height:56px" onchange="docSet('pay',this.value)">${esc(d.pay||c.cond)}</textarea></div>
  <div class="bar noprint">${tb.map(([k,n])=>`<button class="b ${dtab===k?'':'s'}" onclick="docTab('${k}')">${n}</button>`).join('')}${art?'':'<button class="b" onclick="window.print()">Imprimir / guardar PDF</button>'}</div>
  ${dtab==='mem'?docMemoria():dtab==='cie'?docCIE():docPresu()}`}
window.docsReport=()=>dtab;
window.XT.push({k:'docs',n:'Documentos',v:vDocs,after:'budget'});

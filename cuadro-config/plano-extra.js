'use strict';
/* Plano de casa: selección múltiple, copiar/pegar, alinear/distribuir y plano de fondo para calcar */
CS.multi=[];CS.mm=false;CS.clip=null;CS.pasteN=0;CS.band=null;
const inMulti=id=>CS.multi.includes(id);
const mItems=()=>HS().items.filter(i=>inMulti(i.id));
window.mmToggle=()=>{CS.mm=!CS.mm;if(CS.mm){CS.tool='sel';CS.place=null;if(CS.sel&&CS.sel.t==='item'&&!inMulti(CS.sel.id))CS.multi.push(CS.sel.id)}render()};
window.mmClear=()=>{CS.multi=[];render()};
window.mmAll=()=>{CS.multi=HS().items.filter(onFl).map(i=>i.id);render()};
window.mmCopy=()=>{const its=mItems().filter(i=>i.k!=='cuadro');if(!its.length)return;const ids=new Set(its.map(i=>i.id));
  CS.clip={items:structuredClone(its),links:structuredClone((HS().links||[]).filter(l=>ids.has(l.a)&&ids.has(l.b))),fl:flOf(Math.min(...its.map(i=>i.y)))};CS.pasteN=0;
  const m=document.getElementById('mm-msg');if(m)m.textContent=its.length+' elemento(s) copiados.'};
window.mmPaste=()=>{if(!CS.clip)return;const h=HS(),map={},dy=(CS.floor-CS.clip.fl)*FY,off=40*(++CS.pasteN),nw=[];
  CS.clip.items.forEach(it=>{const n={...structuredClone(it),id:uid(),x:it.x+off,y:it.y+dy+off};delete n.circ;map[it.id]=n.id;h.items.push(n);nw.push(n.id)});
  CS.clip.links.forEach(l=>{if(map[l.a]&&map[l.b]){const n={...structuredClone(l),id:uid(),a:map[l.a],b:map[l.b]};delete n.code;(h.links=h.links||[]).push(n)}});
  CS.multi=nw;CS.mm=true;render()};
window.mmDup=()=>{mmCopy();mmPaste()};
window.mmDel=()=>{if(!CS.multi.length)return;if(!confirm('¿Borrar los '+CS.multi.length+' elementos seleccionados?'))return;const h=HS(),s=new Set(CS.multi);h.items=h.items.filter(i=>!s.has(i.id));h.links=(h.links||[]).filter(l=>!s.has(l.a)&&!s.has(l.b));CS.multi=[];CS.sel=null;render()};
window.mmMove=(dx,dy)=>{mItems().forEach(i=>{i.x+=dx;i.y+=dy});render()};
window.mmAlign=m=>{const a=mItems();if(a.length<2)return;const f=m==='l'?Math.min(...a.map(i=>i.x)):m==='r'?Math.max(...a.map(i=>i.x)):m==='t'?Math.min(...a.map(i=>i.y)):m==='b'?Math.max(...a.map(i=>i.y)):m==='ch'?a.reduce((s,i)=>s+i.x,0)/a.length:a.reduce((s,i)=>s+i.y,0)/a.length;
  a.forEach(i=>{if('lrch'.includes(m))i.x=Math.round(f/5)*5;else i.y=Math.round(f/5)*5});render()};
window.mmDist=ax=>{const a=mItems().sort((p,q)=>p[ax]-q[ax]);if(a.length<3)return;const lo=a[0][ax],hi=a[a.length-1][ax];a.forEach((i,k)=>{i[ax]=Math.round((lo+(hi-lo)*k/(a.length-1))/5)*5});render()};
function mmBar(){
  if(CS.sim)return'';
  const n=CS.multi.length,b=(f,t,d)=>`<button class="b s" ${d?'disabled':''} onclick="${f}">${t}</button>`;
  return`<div class="card noprint" style="padding:8px;border:2px solid var(--in)"><div class="bar" style="margin:0 0 4px"><b style="color:var(--in)">Selección múltiple</b><span class="muted">${n} elemento(s). Toca elementos para añadir o quitar, o arrastra un recuadro sobre el plano.</span><span id="mm-msg" class="muted"></span></div>
  <div class="bar" style="margin:0">${b('mmAll()','Todos de la planta')}${b('mmClear()','Ninguno',!n)}${b('mmCopy()','Copiar',!n)}${b('mmPaste()','Pegar'+(CS.clip?' ('+CS.clip.items.length+')':''),!CS.clip)}${b('mmDup()','Duplicar',!n)}<span class="muted">Alinear:</span>${b("mmAlign('l')",'⇤',n<2)}${b("mmAlign('ch')",'↔ centro',n<2)}${b("mmAlign('r')",'⇥',n<2)}${b("mmAlign('t')",'⤒',n<2)}${b("mmAlign('cv')",'↕ centro',n<2)}${b("mmAlign('b')",'⤓',n<2)}<span class="muted">Repartir:</span>${b("mmDist('x')",'↔',n<3)}${b("mmDist('y')",'↕',n<3)}<span class="muted">Mover 10 cm:</span>${b('mmMove(-10,0)','←',!n)}${b('mmMove(10,0)','→',!n)}${b('mmMove(0,-10)','↑',!n)}${b('mmMove(0,10)','↓',!n)}<button class="b d" ${n?'':'disabled'} onclick="mmDel()">Borrar</button></div></div>`}
/* ---- plano de fondo ---- */
window.bgFile=inp=>{const f=inp.files[0];if(!f)return;const r=new FileReader();r.onload=()=>{const im=new Image();im.onload=()=>{const k=Math.min(1,1100/Math.max(im.width,im.height)),c=document.createElement('canvas');c.width=Math.round(im.width*k);c.height=Math.round(im.height*k);const x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,c.width,c.height);x.drawImage(im,0,0,c.width,c.height);
  const h=HS();h.bg={data:c.toDataURL('image/jpeg',0.6),ar:c.height/c.width,x:0,y:0,w:Math.max(8,(h.w||1000)/100),op:0.45,on:true};render()};im.src=r.result};r.readAsDataURL(f);inp.value=''};
window.bgSet=(k,v)=>{const h=HS();if(!h.bg)return;h.bg[k]=k==='on'?!!v:num(v,h.bg[k]);casaDraw();if(k!=='op')render()};
window.bgDel=()=>{HS().bg=null;render()};
function bgBar(){
  if(CS.sim)return'';const h=HS(),g=h.bg;
  const nu=(k,l,st)=>`<label style="display:inline-flex;gap:4px;margin:0 8px 0 0;align-items:center;color:var(--tx)">${l}<input type="number" step="${st}" style="width:70px" value="${g[k]}" onchange="bgSet('${k}',this.value)"></label>`;
  return`<details class="card noprint" style="padding:8px" ${g?'open':''}><summary style="cursor:pointer;font-weight:600">Plano de fondo para calcar${g?' (activo)':''}</summary>
  <p class="muted" style="font-size:12.5px;margin:6px 0">Sube una foto o plano de la vivienda y calca encima las estancias a escala. Indica el ancho real de la imagen en metros (mide una pared conocida) para ajustar la escala.</p>
  <div class="bar" style="margin:0"><button class="b s" onclick="document.getElementById('bg-file').click()">${g?'Cambiar imagen':'Subir imagen'}</button><input type="file" id="bg-file" accept="image/*" hidden onchange="bgFile(this)">
  ${g?`<label style="display:inline-flex;gap:4px;margin:0 8px 0 0;align-items:center;color:var(--tx)"><input type="checkbox" ${g.on?'checked':''} onchange="bgSet('on',this.checked)"> Mostrar</label>${nu('w','Ancho (m)',0.1)}${nu('x','X (m)',0.1)}${nu('y','Y (m)',0.1)}<label style="display:inline-flex;gap:4px;margin:0;align-items:center;color:var(--tx)">Opacidad<input type="range" min="0.1" max="1" step="0.05" value="${g.op}" oninput="bgSet('op',this.value)"></label><button class="b d" onclick="bgDel()">Quitar</button>`:''}</div></details>`}
/* ---- enganches en la UI existente ---- */
const _vCasa=vCasa;window.vCasa=function(){let s=_vCasa();
  s=s.replace('Seleccionar / mover</button></div>',m=>'Seleccionar / mover</button><button class="b '+(CS.mm?'':'s')+'" onclick="mmToggle()">☑ Varios</button></div>');
  const mk='<div class="card noprint" style="padding:8px"><div class="bar" style="margin:0 0 6px">';
  const i=s.indexOf(mk);if(i>=0)s=s.slice(0,i)+(CS.mm?mmBar():'')+bgBar()+s.slice(i);return s};
const _casaBuild=casaBuild;window.casaBuild=function(){let s=_casaBuild();const h=HS(),g=h.bg;
  if(g&&g.on&&g.data&&!CS.sim){const k=s.indexOf('<g transform="translate(0 ');if(k>=0){const e=s.indexOf('>',k)+1;s=s.slice(0,e)+`<image href="${g.data}" x="${g.x*100}" y="${g.y*100}" width="${g.w*100}" height="${g.w*100*g.ar}" opacity="${g.op}" preserveAspectRatio="none" pointer-events="none"/>`+s.slice(e)}}
  if(CS.mm&&!CS.sim&&!CS.rep){let o='';h.items.filter(i=>inMulti(i.id)&&onFl(i)).forEach(i=>{o+=`<rect x="${i.x-30}" y="${i.y-30}" width="60" height="60" rx="10" fill="#1565c0" fill-opacity=".12" stroke="#1565c0" stroke-width="5" stroke-dasharray="9 6" pointer-events="none"/>`});
    if(CS.band){const b=CS.band;o+=`<rect x="${Math.min(b.x0,b.x1)}" y="${Math.min(b.y0,b.y1)}" width="${Math.abs(b.x1-b.x0)}" height="${Math.abs(b.y1-b.y0)}" fill="#1565c0" fill-opacity=".1" stroke="#1565c0" stroke-width="4" stroke-dasharray="10 6"/>`}
    const e=s.lastIndexOf('</g>');if(e>=0)s=s.slice(0,e)+o+s.slice(e)}
  return s};
const _casaMount=casaMount;window.casaMount=function(){_casaMount();const svg=document.getElementById('cs-svg');if(!svg)return;
  const old=svg.onpointerdown,pt=e=>{const p=svg.createSVGPoint();p.x=e.clientX;p.y=e.clientY;const q=p.matrixTransform(svg.getScreenCTM().inverse());return{x:q.x,y:q.y+CS.floor*FY}};
  const nearest=q=>{let best=null,bd=34;HS().items.forEach(it=>{if(!CS.layers[HI[it.k].cat]||!onFl(it)||it.k==='suelo')return;const d=hdist(it,q);if(d<bd){bd=d;best=it}});return best};
  svg.onpointerdown=e=>{if(CS.sim||!(CS.mm||e.shiftKey||e.ctrlKey||e.metaKey)||CS.tool!=='sel')return old(e);
    const q=pt(e),it=nearest(q);svg.setPointerCapture(e.pointerId);
    if(it){const i=CS.multi.indexOf(it.id);if(i>=0)CS.multi.splice(i,1);else CS.multi.push(it.id);CS.mm=true;render();return}
    CS.band={x0:q.x,y0:q.y,x1:q.x,y1:q.y,add:e.shiftKey||e.ctrlKey};casaDraw()};
  const om=svg.onpointermove,ou=svg.onpointerup;
  svg.onpointermove=e=>{if(CS.band){const q=pt(e);CS.band.x1=q.x;CS.band.y1=q.y;casaDraw();return}om&&om(e)};
  svg.onpointerup=e=>{if(CS.band){const b=CS.band;CS.band=null;const x0=Math.min(b.x0,b.x1),x1=Math.max(b.x0,b.x1),y0=Math.min(b.y0,b.y1),y1=Math.max(b.y0,b.y1);
    if(x1-x0>20||y1-y0>20){const sel=HS().items.filter(i=>onFl(i)&&CS.layers[HI[i.k].cat]&&i.k!=='suelo'&&i.x>=x0&&i.x<=x1&&i.y>=y0&&i.y<=y1).map(i=>i.id);CS.multi=b.add?[...new Set([...CS.multi,...sel])]:sel}
    render();return}ou&&ou(e)};
  const kd=document.onkeydown;document.onkeydown=e=>{const ed=/INPUT|SELECT|TEXTAREA/.test((document.activeElement||{}).tagName||'');
    if(tab==='casa'&&!CS.sim&&!ed&&(e.ctrlKey||e.metaKey)){const k=e.key.toLowerCase();if(k==='c'&&CS.multi.length){e.preventDefault();mmCopy();return}if(k==='v'&&CS.clip){e.preventDefault();mmPaste();return}if(k==='d'&&CS.multi.length){e.preventDefault();mmDup();return}if(k==='a'){e.preventDefault();CS.mm=true;mmAll();return}}
    if(tab==='casa'&&!CS.sim&&!ed&&CS.mm&&CS.multi.length&&(e.key==='Delete'||e.key==='Backspace')){e.preventDefault();mmDel();return}
    if(tab==='casa'&&!CS.sim&&!ed&&CS.mm&&CS.multi.length&&e.key.startsWith('Arrow')){e.preventDefault();const s=e.shiftKey?50:10;mmMove(e.key==='ArrowLeft'?-s:e.key==='ArrowRight'?s:0,e.key==='ArrowUp'?-s:e.key==='ArrowDown'?s:0);return}
    kd&&kd(e)}};

const _crs=casaReportSVG;window.casaReportSVG=function(){CS.rep=1;try{return _crs()}finally{CS.rep=0}};

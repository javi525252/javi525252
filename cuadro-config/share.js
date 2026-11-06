'use strict';
/* Guardar y compartir proyectos: archivo, código de texto y enlace; copias y lista de proyectos */
const ART=()=>!!window.__ART;
function b64u(bytes){let s='';for(let i=0;i<bytes.length;i+=0x8000)s+=String.fromCharCode.apply(null,bytes.subarray(i,i+0x8000));return btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')}
function ub64u(t){t=t.replace(/-/g,'+').replace(/_/g,'/');while(t.length%4)t+='=';const s=atob(t),b=new Uint8Array(s.length);for(let i=0;i<s.length;i++)b[i]=s.charCodeAt(i);return b}
async function zipStr(str){const enc=new TextEncoder().encode(str);
  if(typeof CompressionStream==='function'){const cs=new CompressionStream('deflate-raw'),w=cs.writable.getWriter();w.write(enc);w.close();return 'z'+b64u(new Uint8Array(await new Response(cs.readable).arrayBuffer()))}
  return 'r'+b64u(enc)}
async function unzipStr(code){const t=code[0],bytes=ub64u(code.slice(1));
  if(t==='z'){if(typeof DecompressionStream!=='function')throw new Error('Tu navegador no puede abrir este código comprimido.');const ds=new DecompressionStream('deflate-raw'),w=ds.writable.getWriter();w.write(bytes);w.close();return new TextDecoder().decode(await new Response(ds.readable).arrayBuffer())}
  return new TextDecoder().decode(bytes)}
function projectPack(p){p=p||P();const defIds=new Set(DEFAULT_CATALOG.map(x=>x.id)),defEnc=new Set(ENCLOSURES.map(x=>x.id));
  return{v:1,app:'CuadroConfig',project:p,catalogExtra:S.catalog.filter(x=>!defIds.has(x.id)),catalogEdits:S.catalog.filter(x=>defIds.has(x.id)).map(x=>({id:x.id,price:x.price})).filter(x=>{const d=DEFAULT_CATALOG.find(y=>y.id===x.id);return d&&d.price!==x.price}),enclExtra:S.enclosures.filter(x=>!defEnc.has(x.id))}}
async function projectCode(p){return 'CC1:'+await zipStr(JSON.stringify(projectPack(p)))}
function projectUnpack(o){if(!o||o.app!=='CuadroConfig'||!o.project||!o.project.boards)throw new Error('El contenido no es un proyecto de CuadroConfig.');
  const have=new Set(S.catalog.map(x=>x.id));(o.catalogExtra||[]).forEach(x=>{if(!have.has(x.id))S.catalog.push(x)});(o.catalogEdits||[]).forEach(e=>{const x=S.catalog.find(y=>y.id===e.id);if(x)x.price=e.price});
  const he=new Set(S.enclosures.map(x=>x.id));(o.enclExtra||[]).forEach(x=>{if(!he.has(x.id))S.enclosures.push(x)});
  const p=o.project;p.id=uid();p.name=(p.name||'Proyecto')+(S.projects.some(q=>q.name===p.name)?' (importado)':'');p.cur=0;S.projects.push(p);S.cur=S.projects.length-1;return p}
async function projectFromCode(code){code=String(code||'').trim().replace(/\s+/g,'');if(!code.startsWith('CC1:'))throw new Error('Código no válido: debe empezar por CC1:');
  return projectUnpack(JSON.parse(await unzipStr(code.slice(4))))}
function copyText(txt){return(navigator.clipboard&&navigator.clipboard.writeText?navigator.clipboard.writeText(txt):Promise.reject()).then(()=>true).catch(()=>{const t=document.getElementById('sh-code')||document.getElementById('cp-txt');if(t){t.value=txt;t.select();try{return document.execCommand('copy')}catch(e){return false}}return false})}
window.shMsg=(t,ok)=>{const el=document.getElementById('sh-msg');if(el)el.innerHTML=`<div class="chk ${ok===false?'err':'ok'}">${esc(t)}</div>`};
window.shGen=async()=>{try{const c=await projectCode();const t=document.getElementById('sh-code');t.value=c;shMsg(`Código generado (${c.length.toLocaleString('es-ES')} caracteres). Cópialo y guárdalo o envíalo.`)}catch(e){shMsg(e.message,false)}};
window.shCopy=async()=>{const t=document.getElementById('sh-code');if(!t.value)await shGen();const ok=await copyText(t.value);shMsg(ok?'Código copiado al portapapeles.':'No se pudo copiar solo: el código está seleccionado, cópialo a mano.',ok)};
window.shOpen=async()=>{try{const code=document.getElementById('sh-in').value;const p=await projectFromCode(code);shMsg(`Proyecto «${p.name}» abierto.`);tab='asistente';render()}catch(e){shMsg(e.message||'Código no válido',false)}};
window.shLink=async()=>{try{const c=await projectCode(),url=location.href.split('#')[0]+'#p='+encodeURIComponent(c);const t=document.getElementById('sh-code');t.value=url;const ok=await copyText(url);shMsg(ok?`Enlace copiado (${url.length.toLocaleString('es-ES')} caracteres). Quien lo abra verá una copia del proyecto.`:'Enlace generado: cópialo desde el cuadro de texto.',ok)}catch(e){shMsg(e.message,false)}};
window.shFile=()=>{const blob=new Blob([JSON.stringify(projectPack(),null,1)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=(P().name||'proyecto').replace(/[^\w\-áéíóúñ ]+/g,'').trim().replace(/\s+/g,'-')+'.cuadroconfig.json';a.click()};
window.shFileIn=input=>{const f=input.files[0];if(!f)return;f.text().then(t=>{try{const o=JSON.parse(t);const p=projectUnpack(o.project?o:{app:'CuadroConfig',project:o.projects?o.projects[0]:null});shMsg(`Proyecto «${p.name}» abierto.`);tab='asistente';render()}catch(e){shMsg(e.message||'Archivo no válido',false)}});input.value=''};
window.shDup=i=>{const q=structuredClone(S.projects[i]);q.id=uid();q.name+=' (copia)';S.projects.push(q);S.cur=S.projects.length-1;render()};
window.shDel=i=>{if(S.projects.length<2)return alert('Debe quedar al menos un proyecto.');if(!confirm('¿Eliminar «'+S.projects[i].name+'»?'))return;S.projects.splice(i,1);S.cur=Math.min(S.cur,S.projects.length-1);render()};
window.shSel=i=>{S.cur=i;render()};
window.shRename=(i,v)=>{S.projects[i].name=v||S.projects[i].name;render()};
function vGuardar(){
  const art=ART();
  return`<div class="card"><h3>Guardar y compartir</h3><p class="muted" style="margin:0">Tus proyectos se guardan solos en este navegador. Para llevarlos a otro dispositivo o enviarlos, usa un código de texto${art?'':', un archivo o un enlace'}.</p><div id="sh-msg" style="margin-top:8px"></div></div>
  <div class="gc wide"><div class="card"><h3>Código del proyecto</h3><p class="muted" style="font-size:12.5px;margin:0 0 6px">Texto comprimido que contiene todo: plano, cuadro, autómata y catálogo editado. Funciona en cualquier sitio donde puedas pegar texto.</p>
    <div class="bar"><button class="b" onclick="shGen()">Generar código</button><button class="b s" onclick="shCopy()">Copiar</button>${art?'':'<button class="b s" onclick="shLink()">Copiar enlace compartible</button>'}</div>
    <textarea id="sh-code" readonly style="width:100%;height:90px;font:11px ui-monospace,monospace;margin-top:6px" placeholder="Pulsa «Generar código»"></textarea>
    <h3 style="margin-top:14px">Abrir un proyecto</h3><textarea id="sh-in" style="width:100%;height:80px;font:11px ui-monospace,monospace" placeholder="Pega aquí un código que empiece por CC1:"></textarea>
    <div class="bar"><button class="b" onclick="shOpen()">Abrir código</button>${art?'':'<button class="b s" onclick="document.getElementById(\'sh-file\').click()">Abrir archivo…</button><button class="b s" onclick="shFile()">Descargar archivo</button><input type="file" id="sh-file" accept=".json" hidden onchange="shFileIn(this)">'}</div>
    ${art?'<p class="muted" style="font-size:12px">En esta vista no se pueden descargar archivos ni compartir enlaces; en la versión alojada en Netlify sí.</p>':''}</div>
   <div class="card"><h3>Mis proyectos</h3><table><tr><th>Nombre</th><th class="r">Elementos</th><th></th></tr>${S.projects.map((q,i)=>`<tr style="${i===S.cur?'background:var(--pr2)':''}"><td><input value="${esc(q.name)}" style="width:100%" onchange="shRename(${i},this.value)"></td><td class="r">${q.house?q.house.items.length:0}</td><td style="white-space:nowrap"><button class="b s" onclick="shSel(${i})">Abrir</button> <button class="b s" onclick="shDup(${i})">Duplicar</button> <button class="b d" onclick="shDel(${i})">✕</button></td></tr>`).join('')}</table>
    <div class="bar" style="margin-top:8px"><button class="b" onclick="newProject()">+ Proyecto vacío</button></div></div></div>
  <textarea id="cp-txt" style="position:fixed;left:-9999px;top:0"></textarea>`}
async function shareBoot(){const h=location.hash;if(!h.startsWith('#p='))return;try{const code=decodeURIComponent(h.slice(3));if(!confirm('Este enlace contiene un proyecto de CuadroConfig. ¿Abrirlo como copia nueva en tu navegador?'))return;const p=await projectFromCode(code);history.replaceState(null,'',location.pathname+location.search);tab='asistente';render();setTimeout(()=>alert('Proyecto «'+p.name+'» abierto.'),50)}catch(e){alert('No se pudo abrir el enlace: '+(e.message||e))}}

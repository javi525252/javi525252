'use strict';
/* Cálculos: cortocircuito, longitud máxima, selectividad, previsión de potencia y balance de fases */
window.XT=window.XT||[];
const RHO_MAX=0.018,RHO_MIN=0.027; // Ω·mm²/m (cobre en frío / a temperatura de régimen ×1,5)
const POT_CONTR=[[1,2.3],[1,3.45],[1,4.6],[1,5.75],[1,6.9],[1,8.05],[1,9.2],[1,10.35],[1,11.5],[1,14.49],[3,10.39],[3,13.86],[3,17.32],[3,20.78],[3,27.7],[3,34.64],[3,43.3],[3,69.28]];
const IGA_STD=[10,15,20,25,32,40,50,63,80,100,125,160,200,250,400,630];
function magTrip(p){ // intensidad de disparo magnético máxima garantizada (A)
  if(p.kind==='mpcb')return 13*p.in;
  if(p.kind==='incomer')return 10*p.in;
  return (/ B(\s|$)/.test(p.name)?5:/ D(\s|$)/.test(p.name)?20:10)*p.in}
function magTripMin(p){return p.kind==='incomer'?10*p.in*0.8:p.kind==='mpcb'?11*p.in:(/ B(\s|$)/.test(p.name)?3:/ D(\s|$)/.test(p.name)?10:5)*p.in}
const isBrk=p=>p&&['mcb','rcbo','incomer','mpcb'].includes(p.kind)&&p.in>0;
/* devuelve {rows, sel, pot, issues} */
function scCalc(b){
  const a=analyze(b),rows=[],sel=[],issues=[];
  if(!b.root)return{a,rows,sel,pot:null,issues};
  const three=b.phases===3,uo=230,zs=uo/(Math.max(b.isc,0.1)*1000); // impedancia de la fuente (Ω) para Icc en cabecera
  const rc=(r,l,s)=>r*l/s;
  walk(b.root,(n,par)=>{
    const i=a.info[n.id],p=i&&i.p;if(!p)return;
    if(isBrk(p)){
      // Icc máxima en bornes: la de la cabecera (conservador)
      const iccMax=b.isc*1000,ok=!(p.icu>0)||p.icu*1000>=iccMax;
      if(!ok)issues.push({lv:'err',msg:`${label(n)}: poder de corte ${p.icu} kA < Icc ${b.isc} kA en el cuadro.`});
      // circuito final: cables de las cargas cuyo protector más cercano es este aparato
      let worst=null;if(p.kind!=='incomer')walk(n,x=>{const ix=a.info[x.id];if(ix&&['load','motor'].includes(ix.p.kind)&&ix.sec){
        let q=find(x.id).p,nearest=null;while(q){const pq=a.info[q.id]&&a.info[q.id].p;if(pq&&['mcb','rcbo','mpcb'].includes(pq.kind)){nearest=q;break}q=find(q.id).p}
        if(!nearest||nearest.id!==n.id)return;
        const L=(x.lenTot||x.len||0),pol=ix.p.poles>=3?1:2,R=rc(RHO_MIN,L*pol,ix.sec);
        if(!worst||R>worst.R)worst={x,L,R,S:ix.sec,pol,three:ix.p.poles>=3}}});
      let iccMin=null,lmax=null;
      if(worst){
        const zfault=zs*(worst.three?1:2)+worst.R;iccMin=(0.8*uo)/zfault;
        const im=magTrip(p);lmax=((0.8*uo/im)-zs*(worst.three?1:2))*worst.S/(RHO_MIN*worst.pol);
        if(iccMin<im)issues.push({lv:'warn',msg:`${label(n)}: al final del cable (${f1(worst.L)} m, ${worst.S} mm²) la Icc mínima ${f1(iccMin)} A no garantiza el disparo magnético (${f1(im)} A). Longitud máxima protegida ≈ ${f1(Math.max(lmax,0))} m: sube la sección o usa curva B.`})}
      rows.push({n,p,iccMax,ok,iccMin,lmax,im:magTrip(p),imMin:magTripMin(p),worst})}
  });
  // selectividad: aparato frente al protector (no diferencial) inmediatamente superior; diferenciales entre sí
  const upOf=(n,test)=>{let q=find(n.id).p;while(q){const pq=a.info[q.id]&&a.info[q.id].p;if(pq&&test(pq))return{n:q,p:pq};q=find(q.id).p}return null};
  const out=(n,up,p,pu,st,txt)=>{sel.push({n,up,p,pu,st,txt,ratio:pu.in&&p.in?pu.in/p.in:0});if(st!=='total')issues.push({lv:st==='ninguna'?'warn':'info',msg:`Selectividad ${label(up)} → ${label(n)}: ${txt}`})};
  walk(b.root,(n,par)=>{
    const i=a.info[n.id],p=i&&i.p;if(!p||!par)return;
    if(isBrk(p)){const u=upOf(n,isBrk);if(u&&isBrk(u.p)){const pu=u.p,iccRef=b.isc*1000,ratio=pu.in/p.in,isLim=pu.kind==='incomer'?10*pu.in:5*pu.in;let st,txt;
      if(pu.in<=p.in){st='ninguna';txt=`El aparato superior (${pu.in} A) no es mayor que el inferior (${p.in} A).`}
      else if(ratio<1.6){st='ninguna';txt=`Relación de calibres ${f1(ratio)} < 1,6: no hay selectividad ni en sobrecarga.`}
      else if(isLim>=iccRef){st='total';txt=`Selectividad total hasta ${b.isc} kA (el superior no dispara magnéticamente por debajo de ${f1(isLim)} A).`}
      else if(isLim>magTrip(p)){st='parcial';txt=`Selectividad sólo hasta ${f1(isLim/1000)} kA; por encima disparan ambos. Para ser total usa un superior con retardo (selectivo) o más calibre.`}
      else{st='ninguna';txt='Las curvas se cruzan: ante un cortocircuito dispararán ambos.'}
      out(n,u.n,p,pu,st,txt)}}
    if(p.ma){const u=upOf(n,x=>x.ma);if(u){const sg=/selectivo/i.test(u.p.name)&&u.p.ma>=3*p.ma;
      out(n,u.n,p,u.p,sg?'total':'ninguna',sg?'Diferencial selectivo (S) aguas arriba: sólo dispara el de abajo.':`Ambos diferenciales disparan a la vez (${u.p.ma} mA sobre ${p.ma} mA, sin retardo). Pon el de cabecera selectivo (S) de 300 mA.`)}}
  });
  // previsión de potencia
  const rt=a.info[b.root.id],ib=rt?rt.ib:0,V=three?400:230,kva=(three?Math.sqrt(3):1)*V*ib/1000,kw=kva*0.9;
  const cand=POT_CONTR.filter(([ph,k])=>ph===(three?3:1)&&k>=kw)[0]||POT_CONTR.filter(([ph])=>ph===(three?3:1)).pop();
  const iga=IGA_STD.find(x=>x>=ib)||IGA_STD[IGA_STD.length-1];
  return{a,rows,sel,pot:{ib,kva,kw,contr:cand[1],iga,V,three},issues,ph:a.ph}}
const stCol={total:'#2e7d32',parcial:'#e08a00',ninguna:'#c62828'};
function calcHTML(){
  const b=B(),R=scCalc(b);
  if(!b.root)return`<div class="card"><h3>Cálculos</h3><p class="muted">El cuadro está vacío. Genera uno desde el asistente o la plantilla.</p></div>`;
  const pt=R.pot,v=Object.values(R.ph||{}),mx=Math.max(...v,1);
  const bars=b.phases===3?['L1','L2','L3'].map(k=>`<div style="display:flex;align-items:center;gap:6px;margin:3px 0"><b style="width:22px">${k}</b><div style="background:#e3e9ee;border-radius:4px;flex:1;height:16px"><div style="background:${k==='L1'?'#8d6e63':k==='L2'?'#37474f':'#9e9e9e'};width:${(R.ph[k]/mx*100).toFixed(0)}%;height:16px;border-radius:4px"></div></div><span style="width:64px;text-align:right">${f1(R.ph[k])} A</span></div>`).join(''):'<p class="muted">Cuadro monofásico: no hay reparto de fases.</p>';
  const unb=b.phases===3&&mx>0?Math.round((mx-Math.min(...v))/mx*100):0;
  const lim=R.issues.filter(i=>i.lv!=='info');
  return`<div class="card"><h3>Cálculos del cuadro «${esc(b.name)}»</h3><p class="muted" style="margin:0">Icc de cabecera ${b.isc} kA · ${b.phases===3?'trifásico 400 V':'monofásico 230 V'}. Cálculo simplificado (UNE-HD 60364 / ITC-BT-22 y 17); sirve para dimensionar y detectar problemas, no sustituye a la memoria técnica firmada.</p>
  ${lim.length?lim.map(i=>`<div class="chk ${i.lv}">${esc(i.msg)}</div>`).join(''):'<div class="chk ok">Sin problemas de cortocircuito ni selectividad.</div>'}</div>
  <div class="gc"><div>
  <div class="card"><h3>Cortocircuito y longitud máxima protegida</h3><div style="overflow:auto"><table><tr><th>Aparato</th><th class="r">In</th><th class="r">Poder de corte</th><th class="r">Icc máx. (kA)</th><th class="r">Disparo magnético (A)</th><th class="r">Icc mín. fin de línea (A)</th><th class="r">Long. máx. (m)</th><th></th></tr>
  ${R.rows.map(r=>{const bad=!r.ok,warn=r.iccMin!==null&&r.iccMin<r.im;return`<tr><td>${esc(label(r.n))}</td><td class="r">${r.p.in} A</td><td class="r">${r.p.icu||'—'} kA</td><td class="r">${f1(r.iccMax/1000)}</td><td class="r">${f1(r.imMin)}–${f1(r.im)}</td><td class="r">${r.iccMin===null?'—':f1(r.iccMin)}</td><td class="r">${r.lmax===null?'—':f1(Math.max(r.lmax,0))}${r.worst?` <span class="muted">(real ${f1(r.worst.L)})</span>`:''}</td><td style="color:${bad?'#c62828':warn?'#e08a00':'#2e7d32'};font-weight:700">${bad?'✗ poder de corte':warn?'⚠ longitud':'✓'}</td></tr>`}).join('')}</table></div>
  <p class="muted" style="font-size:12px;margin:6px 0 0">Icc máx.: en bornes de cada aparato (valor de cabecera, lado seguro). Icc mín.: fase-neutro al final del cable más largo, con U×0,8 y resistividad del cobre a temperatura de servicio.</p></div>
  <div class="card"><h3>Selectividad entre protecciones</h3>${R.sel.length?`<table><tr><th>Superior</th><th>Inferior</th><th class="r">Relación</th><th>Selectividad</th><th>Explicación</th></tr>${R.sel.map(s=>`<tr><td>${esc(label(s.up))}<br><small class="muted">${s.pu.in?s.pu.in+' A':s.pu.ma+' mA'}</small></td><td>${esc(label(s.n))}<br><small class="muted">${s.p.in?s.p.in+' A':s.p.ma+' mA'}</small></td><td class="r">${s.ratio?f1(s.ratio):'—'}</td><td style="color:${stCol[s.st]};font-weight:700">${s.st}</td><td style="font-size:12px">${esc(s.txt)}</td></tr>`).join('')}</table>`:'<p class="muted">No hay parejas de protecciones en serie.</p>'}</div></div>
  <div><div class="card"><h3>Previsión de potencia</h3><div class="kpi"><div><b>${f1(pt.ib)} A</b>Intensidad simultánea</div><div><b>${f1(pt.kw)} kW</b>Potencia (cos φ 0,9)</div></div>
  <table style="margin-top:8px"><tr><td>Simultaneidad aplicada</td><td class="r">${b.ks}</td></tr><tr><td>Potencia a contratar</td><td class="r"><b>${f1(pt.contr)} kW</b></td></tr><tr><td>Interruptor general (IGA) recomendado</td><td class="r"><b>${pt.iga} A</b></td></tr><tr><td>Cabecera actual</td><td class="r">${R.a.info[b.root.id].p.in||'—'} A</td></tr></table>
  ${R.a.info[b.root.id].p.in&&R.a.info[b.root.id].p.in<pt.ib?'<div class="chk err">La cabecera es menor que la intensidad prevista.</div>':''}</div>
  <div class="card"><h3>Balance de fases</h3>${bars}${b.phases===3?`<div class="chk ${unb>25&&mx>10?'warn':'ok'}">Desequilibrio ${unb}% ${unb>25&&mx>10?'· reparte mejor los circuitos monofásicos (no más de un 25 %).':'· correcto.'}</div>`:''}
  ${b.phases===3?'<button class="b s" onclick="calcBalance()">Equilibrar automáticamente</button>':''}</div></div></div>`}
window.calcBalance=()=>{const b=B();if(!b.root)return;walk(b.root,n=>{delete n.ph});render()};
window.XT.push({k:'calc',n:'Cálculos',v:calcHTML});
window.scCalc=scCalc;

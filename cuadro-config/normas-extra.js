'use strict';
/* Más normativa en la casa: baño por volúmenes (ITC-BT-27), garaje y recarga VE (ITC-BT-52), exteriores y locales mojados (ITC-BT-30), autoconsumo fotovoltaico con batería (ITC-BT-40, RD 244/2019) */
HI.fv={cat:'ele',n:'Paneles fotovoltaicos + inversor',ab:'FV',pr:4200,ext:1,kwp:3};
HI.bateria={cat:'ele',n:'Batería de almacenamiento',ab:'BT',pr:3600,kwh:5};
const _hiX=houseIssues;
window.houseIssues=function(h,C){
  const out=_hiX(h,C);if(!h.rooms.length)return out;
  const bad=(lv,cat,id,msg)=>out.push({lv,cat,id:id||null,msg}),roomOf=i=>roomAt(h,i.x,i.y),inR=(r,k)=>h.items.filter(i=>i.k===k&&roomOf(i)===r),lab=r=>r.name||RT[r.type];
  // ---- baño: volúmenes ----
  h.rooms.filter(r=>r.type==='bano').forEach(r=>{
    const wet=h.items.filter(i=>['ducha','banera'].includes(i.k)&&roomOf(i)===r);
    if(wet.length){
      inR(r,'luz').concat(inR(r,'foco')).forEach(l=>{const w=wet.find(x=>hdist(x,l)<120);if(w)bad('info','ele',l.id,`${lab(r)}: la luminaria queda en el volumen 1-2 de ${HI[w.k].n.toLowerCase()} (< 1,2 m): debe ser IPX4 y de clase II (ITC-BT-27).`)});
      inR(r,'termo').forEach(t=>{const w=wet.find(x=>hdist(x,t)<120);if(w)bad('info','cli',t.id,`${lab(r)}: el termo está en el volumen 1-2; debe ser IPX4 y con protección diferencial de 30 mA.`)});
      inR(r,'radiador').forEach(t=>{const w=wet.find(x=>hdist(x,t)<60);if(w)bad('err','cli',t.id,`${lab(r)}: radiador eléctrico a menos de 60 cm de ${HI[w.k].n.toLowerCase()} (volumen 1-2).`)});
      bad('info','ele',null,`${lab(r)}: es obligatoria la conexión equipotencial suplementaria de todas las masas metálicas (tuberías, desagües, marcos) en el baño (ITC-BT-27).`)}});
  // ---- garaje y recarga ----
  h.rooms.filter(r=>r.type==='garaje').forEach(r=>{
    if(!inR(r,'luz').length&&!inR(r,'foco').length)bad('warn','ele',null,`${lab(r)}: falta al menos un punto de luz.`);
    if(!h.items.some(i=>['toma','toma_enc','toma_ext'].includes(i.k)&&roomOf(i)===r))bad('info','ele',null,`${lab(r)}: se recomienda una toma de corriente.`);
    if(r.w*r.h/10000<10)bad('info','ele',null,`${lab(r)}: menos de 10 m², no cabe un coche con holgura.`)});
  const ve=h.items.filter(i=>i.k==='cargador_ve');
  if(ve.length){bad('info','ele',null,`Recarga de vehículo eléctrico: circuito exclusivo con diferencial de 30 mA y protección contra sobretensiones (ITC-BT-52). Si hay otras cargas grandes, instala gestión dinámica de potencia.`);
    ve.forEach(v=>{const r=roomOf(v);if(r&&!['garaje','terraza'].includes(r.type))bad('warn','ele',v.id,`Cargador de VE en ${RT[r.type].toLowerCase()}: colócalo en el garaje o en el exterior, cerca de la plaza.`)});
    if(ve.length>1)bad('warn','ele',null,`${ve.length} cargadores de VE: añade gestión dinámica de carga o el contrato no aguantará todos a la vez.`)}
  // ---- exteriores y locales mojados ----
  h.rooms.filter(r=>['terraza','lavadero'].includes(r.type)).forEach(r=>{
    h.items.filter(i=>['toma','toma_enc'].includes(i.k)&&roomOf(i)===r).forEach(i=>bad('warn','ele',i.id,`${lab(r)}: usa toma exterior (IP44) en lugar de una toma normal (ITC-BT-30, locales mojados).`));
    if(inR(r,'luz').length||inR(r,'foco').length||inR(r,'toma_ext').length)bad('info','ele',null,`${lab(r)}: toda la aparamenta y luminarias deben ser como mínimo IPX4 y con diferencial de 30 mA (ITC-BT-30).`)});
  // ---- autoconsumo fotovoltaico ----
  const fv=h.items.filter(i=>i.k==='fv'),bt=h.items.filter(i=>i.k==='bateria');
  if(fv.length){const kwp=fv.reduce((s,i)=>s+(i.kwp||HI.fv.kwp),0),cab=h.items.some(i=>i.k==='cuadro');
    if(!cab)bad('err','ele',null,'La instalación fotovoltaica necesita el cuadro general al que conectarse.');
    bad('info','ele',null,`Autoconsumo de ${f1(kwp)} kWp: protección diferencial (tipo A o B según inversor), protección de sobretensiones CC/CA y contador bidireccional o de excedentes (ITC-BT-40, RD 244/2019). Hay que comunicarlo a la distribuidora.`);
    const iga=(C||houseCalc(h)).iga||0;if(iga&&kwp*1000/230>iga*1.0)bad('warn','ele',null,`La potencia fotovoltaica (${f1(kwp)} kWp) es mayor que la potencia contratada; revisa la instalación o la inyección (límite del inversor).`);
    if(kwp>100)bad('err','ele',null,`El autoconsumo simplificado se limita a 100 kW (${f1(kwp)} kWp).`)}
  if(bt.length&&!fv.length)bad('err','ele',null,'Hay batería de almacenamiento pero no hay paneles fotovoltaicos que la carguen.');
  if(bt.length&&fv.length&&!h.items.some(i=>i.k==='cuadro'))bad('err','ele',null,'La batería necesita el cuadro general.');
  return out};
const _inspX=inspCasa;window.inspCasa=function(h,C){let s=_inspX(h,C);const o=typeof csObj==='function'?csObj():null;
  if(o&&CS.sel&&CS.sel.t==='item'&&o.k==='fv')s=s.replace('</p>','</p><label>Potencia de pico (kWp)</label><input type="number" step="0.5" value="'+(o.kwp||HI.fv.kwp)+'" onchange="csSet(\'kwp\',num(this.value))">');
  if(o&&CS.sel&&CS.sel.t==='item'&&o.k==='bateria')s=s.replace('</p>','</p><label>Capacidad (kWh)</label><input type="number" step="0.5" value="'+(o.kwh||HI.bateria.kwh)+'" onchange="csSet(\'kwh\',num(this.value))">');
  return s};

// Catálogo genérico (precios de ejemplo en €, editables desde la pestaña "Catálogo")
(function(){
  const P=[]; let n=0;
  const add=(name,kind,inA,poles,icu,mod,price,extra={})=>P.push({id:'p'+(++n),name,kind,in:inA,poles,icu,mod,price,...extra});
  // Interruptores generales / de cabecera
  [[40,2,6,2,28],[63,2,6,2,34],[100,2,10,3,52]].forEach(([i,p,k,m,pr])=>add(`Interruptor general ${i}A ${p}P`,'incomer',i,p,k,m,pr));
  [[63,4,10,4,95],[100,4,25,6,210],[160,4,36,8,285],[250,4,36,8,390],[400,4,50,10,720],[630,4,50,14,1180],[800,4,50,14,1650],[1000,4,65,18,2100],[1250,4,65,18,2850],[1600,4,70,22,3900],[2000,4,70,26,5400],[2500,4,70,30,7600],[3200,4,85,34,11800],[4000,4,100,38,16500]]
    .forEach(([i,p,k,m,pr])=>add(`Automático caja moldeada ${i}A ${p}P`,'incomer',i,p,k,m,pr));
  // Magnetotérmicos
  [6,10,16,20,25,32,40,50,63].forEach((i,x)=>add(`Magnetotérmico ${i}A 1P+N C`,'mcb',i,2,6,2,8+x*1.8));
  [10,16,20,25,32,40,50,63,80,100,125].forEach((i,x)=>add(`Magnetotérmico ${i}A 3P C`,'mcb',i,3,10,3,22+x*4.5));
  [16,25,40,63].forEach((i,x)=>add(`Magnetotérmico ${i}A 3P+N C`,'mcb',i,4,10,4,36+x*9));
  // Diferenciales
  [[25,2],[40,2],[63,2]].forEach(([i,p],x)=>add(`Diferencial ${i}A ${p}P 30mA`,'rcd',i,p,6,2,38+x*12,{ma:30}));
  [[25,4],[40,4],[63,4],[80,4],[100,4]].forEach(([i,p],x)=>add(`Diferencial ${i}A ${p}P 30mA`,'rcd',i,p,10,4,72+x*22,{ma:30}));
  [[63,4],[100,4]].forEach(([i,p],x)=>add(`Diferencial ${i}A ${p}P 300mA selectivo`,'rcd',i,p,10,4,160+x*45,{ma:300}));
  [6,10,16,20,25,32].forEach((i,x)=>add(`Mag.+Diferencial ${i}A 1P+N 30mA`,'rcbo',i,2,6,2,34+x*3,{ma:30}));
  // Maniobra y otros
  [[25,2,1],[40,4,2],[63,4,3],[100,4,5]].forEach(([i,p,m],x)=>add(`Contactor ${i}A ${p}P`,'contactor',i,p,0,m,26+x*30));
  add('Protector sobretensiones tipo 2 1P+N','spd',0,2,0,2,95);
  add('Protector sobretensiones tipo 2 3P+N','spd',0,4,0,4,185);
  add('Contador energía trifásico','meter',0,4,0,4,120);
  add('Reloj programador','other',0,2,0,2,42);
  add('Piloto/Señalizador','other',0,1,0,1,6);
  add('Seccionador portafusibles 32A','other',32,2,0,2,18);
  window.DEFAULT_CATALOG=P;
  window.ENCLOSURES=[
    {id:'e1',name:'Caja empotrar 1 fila 12 mód.',rows:1,cols:12,price:14},
    {id:'e2',name:'Caja 2 filas 24 mód.',rows:2,cols:12,price:32},
    {id:'e3',name:'Caja 3 filas 36 mód.',rows:3,cols:12,price:48},
    {id:'e4',name:'Cuadro 3 filas 54 mód.',rows:3,cols:18,price:96},
    {id:'e5',name:'Cuadro 4 filas 72 mód.',rows:4,cols:18,price:150},
    {id:'e6',name:'Armario 5 filas 120 mód.',rows:5,cols:24,price:310},
    {id:'e7',name:'Armario 7 filas 168 mód.',rows:7,cols:24,price:520},
    {id:'e8',name:'Armario industrial 240 mód.',rows:10,cols:24,price:890},
    {id:'e9',name:'Armario industrial 2 cuerpos 480 mód.',rows:20,cols:24,price:1750}
  ];
  // Sección de cable orientativa Cu/PVC (intensidad admisible A)
  window.CABLES=[[1.5,15],[2.5,21],[4,27],[6,36],[10,50],[16,68],[25,89],[35,111],[50,134],[70,171],[95,207],[120,239],[185,299],[240,350],[300,400],[370,598,'2×185'],[480,700,'2×240'],[720,1050,'3×240']];
})();

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
  // ---- Motores, arranque y receptores (añadidos al final para conservar los ids anteriores) ----
  [[0.63,1],[1,1.6],[1.6,2.5],[2.5,4],[4,6.3],[6,10],[9,14],[13,18],[17,23],[20,25],[24,32],[30,40],[37,50],[48,65]]
    .forEach(([lo,hi],x)=>add(`Guardamotor ${lo}–${hi} A 3P`,'mpcb',hi,3,50,3,42+x*6,{lo,hi}));
  [[1,1.6],[1.6,2.5],[2.5,4],[4,6],[5.5,8],[7,10],[9,13],[12,18],[16,24],[23,32],[30,40],[37,50],[48,65],[63,80],[80,104]]
    .forEach(([lo,hi],x)=>add(`Relé térmico ${lo}–${hi} A`,'thermal',hi,3,0,2,28+x*5,{lo,hi}));
  [[9,4],[12,5.5],[18,7.5],[25,11],[32,15],[40,18.5],[50,22],[65,30],[80,37],[95,45],[115,55],[150,75],[185,90],[225,110],[265,132],[330,160],[400,200]]
    .forEach(([i,kw],x)=>add(`Contactor AC-3 ${i} A (${kw} kW)`,'contactor',i,3,0,i<=40?3:i<=115?5:8,24+x*14,{ac3:true,kw}));
  [[16,7.5],[32,15],[61,30],[110,55],[170,90]].forEach(([i,kw],x)=>add(`Arrancador suave ${kw} kW ${i} A`,'softstart',i,3,0,6+x*2,190+x*160,{kw}));
  [[2.3,0.75],[5.8,2.2],[13,5.5],[24,11],[46,22],[75,37],[145,75]].forEach(([i,kw],x)=>add(`Variador de frecuencia ${kw} kW ${i} A`,'vfd',i,3,0,8+x*2,260+x*190,{kw}));
  const load=(name,lt,poles,kind='load')=>add(name,kind,0,poles,0,0,0,{ltype:lt});
  load('Alumbrado','alumbrado',2);load('Tomas de corriente','tomas',2);load('Cocina / horno','cocina',2);load('Lavadora / lavavajillas','lavadora',2);
  load('Aire acondicionado monofásico','aire',2);load('Aire acondicionado trifásico','aire',3);load('Calentador / termo eléctrico','calefaccion',2);load('Calefacción trifásica','calefaccion',3);
  load('Cargador vehículo eléctrico monofásico','vehiculo',2);load('Cargador vehículo eléctrico trifásico','vehiculo',3);
  load('Inversor fotovoltaico monofásico','fv',2);load('Inversor fotovoltaico trifásico','fv',3);load('Soldadora','soldadura',2);
  load('Motor eléctrico trifásico','motor',3,'motor');load('Motor eléctrico monofásico','motor',2,'motor');load('Bomba (motor trifásico)','bomba',3,'motor');
  load('Ventilador (motor trifásico)','ventilador',3,'motor');load('Compresor (motor trifásico)','compresor',3,'motor');load('Ascensor / polipasto (motor)','ascensor',3,'motor');
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

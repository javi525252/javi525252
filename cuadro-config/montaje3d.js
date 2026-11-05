'use strict';
/* Montaje 3D y demostración de funcionamiento / fallos del cuadro */
(function(){
const MW=1.8, RP=15, DH=9, DD=6, Z0=0.6;           // cm: ancho de módulo, paso de fila, alto/fondo de aparato
const CC={L1:0x7a4a1c,L2:0x1a1a1a,L3:0x8a8a8a,N:0x1e63d6};
const M=window.M3D={mode:'build',door_:false,ui:{carry:null,sel:null},R:null,sim:null,C:null};
const hexc=s=>parseInt(String(s).slice(1),16);
const $q=id=>document.getElementById(id);

// ---------- contexto del cuadro ----------
function ctx(){
  const b=B(),a=analyze(b),ce=chooseEnc(b,a.mods),e=ce.enc;b.layout=b.layout||{};
  const par={},nodes=[],inst=[],by={};let ord=0;
  walk(b.root,(n,p)=>{par[n.id]=p;nodes.push(n)});
  nodes.forEach(n=>{ord++;const i=a.info[n.id];const q=Math.max(1,Math.round(i.eq*n.qty));
    for(let k=0;k<q;k++){const it={key:n.id+'#'+k,n,q:k,p:i.p,i,ord};inst.push(it);by[it.key]=it}});
  return{b,a,e,rows:e.rows,cols:e.cols,par,nodes,inst,by,layout:b.layout};
}
function prune(C){const L=C.layout;let ch=false;
  Object.keys(L).forEach(k=>{const it=C.by[k],q=L[k];
    const bad=!it||q.r<0||q.r>=C.rows||q.c<0||q.c+it.p.mod>C.cols||Object.keys(L).some(o=>o!==k&&L[o]&&C.by[o]&&L[o].r===q.r&&q.c<L[o].c+C.by[o].p.mod&&L[o].c<q.c+it.p.mod&&o<k);
    if(bad){delete L[k];ch=true}});
  if(ch)save()}
function fits(C,key,r,c){const it=C.by[key];if(!it||r<0||r>=C.rows||c<0||c+it.p.mod>C.cols)return false;
  for(const k in C.layout){if(k===key||!C.by[k])continue;const q=C.layout[k];if(q.r===r&&c<q.c+C.by[k].p.mod&&q.c<c+it.p.mod)return false}return true}
const geo=C=>({x0:-C.cols*MW/2,yTop:(C.rows-1)*RP/2});
function devPos(C,it){const q=C.layout[it.key];if(!q)return null;const g=geo(C);return{x:g.x0+(q.c+it.p.mod/2)*MW,y:g.yTop-q.r*RP}}
const nameOf=n=>label(n);
const locOf=(C,it)=>{const q=C.layout[it.key];return q?`fila ${q.r+1}, módulos ${q.c+1}–${q.c+it.p.mod}`:'sin montar'};

// ---------- interfaz pública ----------
M.setMode=m=>{M.mode=m;M.ui.carry=null;rebuild();panels();const b=M.sim&&M.sim.banner;banner(m==='demo'&&b?b.txt:'',b?b.lv:'');if(m==='build'&&M.sim)M.sim.banner=b};
M.door=v=>{M.door_=v;if(M.R&&M.R.doorMesh)M.R.doorMesh.visible=v};
M.resetCam=()=>{if(M.R){const C=M.C,H=C.rows*RP+8,W=C.cols*MW+10;M.R.cam={th:0.28,ph:1.4,r:Math.max(H*1.45,W*1.5,60),t:new THREE.Vector3(0,0,3)}}};
M.auto=()=>{const C=M.C;C.inst.forEach(it=>delete C.layout[it.key]);let r=0,c=0;
  C.inst.slice().sort((x,y)=>x.ord-y.ord||x.q-y.q).forEach(it=>{if(c+it.p.mod>C.cols){r++;c=0}if(r<C.rows){C.layout[it.key]={r,c};c+=it.p.mod}});
  save();M.ui.carry=null;rebuild();panels()};
M.clear=()=>{M.C.inst.forEach(it=>delete M.C.layout[it.key]);save();rebuild();panels()};
M.pick=key=>{const C=M.C;if(!C.by[key])return;M.ui.sel=key;
  if(M.mode==='build'&&!C.layout[key])M.ui.carry=key;else M.ui.carry=null;panels();updHint()};
M.move=()=>{M.ui.carry=M.ui.sel;panels();updHint()};
M.remove=()=>{const k=M.ui.sel;if(k){delete M.C.layout[k];save();rebuild();panels()}};
M.cancel=()=>{M.ui.carry=null;panels();updHint()};
M.setSec=v=>{const it=M.C.by[M.ui.sel];if(!it)return;it.n.sec=v?num(v):0;save();rebuild();panels()};

// ---------- montaje de la escena ----------
M.dispose=()=>{const R=M.R;if(!R)return;cancelAnimationFrame(R.raf);R.alive=false;try{R.renderer.dispose()}catch(e){}M.R=null};
M.mount=()=>{
  M.dispose();const cv=$q('m-cv');if(!cv)return;
  if(!window.THREE){$q('m-wrap').innerHTML='<p style="padding:16px">No se pudo cargar la librería 3D. Comprueba la conexión a internet y recarga.</p>';return}
  const renderer=new THREE.WebGLRenderer({canvas:cv,antialias:true});renderer.setPixelRatio(Math.min(2,window.devicePixelRatio||1));
  const scene=new THREE.Scene();scene.background=new THREE.Color(0xcfd8de);
  scene.add(new THREE.HemisphereLight(0xffffff,0x8899aa,0.85));const dl=new THREE.DirectionalLight(0xffffff,0.6);dl.position.set(40,80,120);scene.add(dl);
  const camera=new THREE.PerspectiveCamera(40,1,1,2000);
  M.R={renderer,scene,camera,root:new THREE.Group(),devs:{},cabs:[],marks:[],alive:true,raf:0,ray:new THREE.Raycaster(),ptr:new THREE.Vector2(),ghost:null,plane:null,doorMesh:null,last:0,cam:null};
  scene.add(M.R.root);
  M.C=ctx();prune(M.C);M.resetCam();
  if(!M.sim||M.sim.bid!==M.C.b.id)initSim();
  bindEvents(cv);rebuild();panels();
  const tick=ts=>{const R=M.R;if(!R||!R.alive)return;if(!document.body.contains(cv)){M.dispose();return}
    const dt=Math.min(0.05,(ts-R.last)/1000||0.016);R.last=ts;stepSim(dt);visuals(ts/1000);resize();
    const c=R.cam;camera.position.set(c.t.x+c.r*Math.sin(c.ph)*Math.sin(c.th),c.t.y+c.r*Math.cos(c.ph),c.t.z+c.r*Math.sin(c.ph)*Math.cos(c.th));camera.lookAt(c.t);
    renderer.render(scene,camera);R.raf=requestAnimationFrame(tick)};
  M.R.raf=requestAnimationFrame(tick);
};
function resize(){const R=M.R,cv=R.renderer.domElement,w=cv.clientWidth,h=cv.clientHeight;
  if(w&&h&&(cv.width!==Math.round(w*R.renderer.getPixelRatio())||cv.height!==Math.round(h*R.renderer.getPixelRatio()))){R.renderer.setSize(w,h,false);R.camera.aspect=w/h;R.camera.updateProjectionMatrix()}}
function rebuild(){
  const R=M.R;if(!R)return;const root=R.root;
  while(root.children.length){const o=root.children[0];root.remove(o)}
  R.devs={};R.cabs=[];R.marks=[];R.ghost=null;
  M.C=ctx();const C=M.C;prune(C);
  const W=C.cols*MW+8,H=C.rows*RP+4;
  // placa de montaje y carriles
  const plate=new THREE.Mesh(new THREE.BoxGeometry(W,H,0.6),new THREE.MeshLambertMaterial({color:0xb9c3ca}));plate.position.z=-0.3;root.add(plate);
  const fr=new THREE.MeshLambertMaterial({color:0x8d99a3});
  [[W+1.6,1.2,0,H/2+0.4],[W+1.6,1.2,0,-H/2-0.4],[1.2,H+1.6,W/2+0.4,0],[1.2,H+1.6,-W/2-0.4,0]].forEach(([w,h,x,y])=>{const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,DD+4),fr);m.position.set(x,y,(DD+4)/2-1);root.add(m)});
  const g=geo(C);
  for(let r=0;r<C.rows;r++){const rail=new THREE.Mesh(new THREE.BoxGeometry(C.cols*MW+1,3.5,0.5),new THREE.MeshLambertMaterial({color:0xdfe6ea}));rail.position.set(0,g.yTop-r*RP,0.35);root.add(rail)}
  const door=new THREE.Mesh(new THREE.BoxGeometry(W,H,0.4),new THREE.MeshLambertMaterial({color:0x9fc4e0,transparent:true,opacity:0.28}));door.position.z=DD+5;door.visible=M.door_;root.add(door);R.doorMesh=door;
  const plane=new THREE.Mesh(new THREE.PlaneGeometry(W,H),new THREE.MeshBasicMaterial({transparent:true,opacity:0,depthWrite:false}));plane.position.z=Z0;root.add(plane);R.plane=plane;
  // aparatos
  const issues=issueMap(C);
  C.inst.forEach(it=>{const pos=devPos(C,it);if(!pos)return;const d=mkDevice(it);d.position.set(pos.x,pos.y,Z0);root.add(d);R.devs[it.key]=d});
  // cables
  C.inst.forEach(it=>{const p=C.par[it.n.id];if(!p)return;const pit=C.by[p.id+'#0'];if(!pit)return;const a=devPos(C,pit),b=devPos(C,it);if(!a||!b)return;mkCable(it,pit,a,b,root,R)});
  // marcadores de error
  C.inst.forEach(it=>{const pos=devPos(C,it),lv=issues[it.n.id];if(!pos||!lv)return;
    const s=mkSprite('!',lv==='err'?'#c62828':'#e08a00');s.position.set(pos.x,pos.y+DH/2+2.6,Z0+DD+1);root.add(s);R.marks.push({s,lv})});
  // fantasma
  const gh=new THREE.Mesh(new THREE.BoxGeometry(1,DH,DD),new THREE.MeshBasicMaterial({color:0x2e7d32,transparent:true,opacity:0.45}));gh.visible=false;root.add(gh);R.ghost=gh;
  updHint();
}
function mkSprite(txt,col){const c=document.createElement('canvas');c.width=c.height=64;const x=c.getContext('2d');x.fillStyle=col;x.beginPath();x.arc(32,32,28,0,7);x.fill();x.fillStyle='#fff';x.font='bold 40px sans-serif';x.textAlign='center';x.textBaseline='middle';x.fillText(txt,32,34);
  const s=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(c),depthTest:false}));s.scale.set(3.2,3.2,1);s.renderOrder=10;return s}
function labelTex(it){
  const W=Math.max(48,it.p.mod*44),H=200,c=document.createElement('canvas');c.width=W;c.height=H;const x=c.getContext('2d');
  x.fillStyle='#f4f6f7';x.fillRect(0,0,W,H);x.fillStyle='#111';x.textAlign='center';
  x.font=`bold ${Math.min(34,W*0.55)}px sans-serif`;x.fillText(it.p.in?String(it.p.in):'',W/2,44);
  x.font=`bold ${Math.min(16,W*0.3)}px sans-serif`;x.fillText(it.p.poles+'P'+(it.p.ma?' '+it.p.ma+'mA':''),W/2,66);
  x.save();x.translate(W/2+5,H-8);x.rotate(-Math.PI/2);x.textAlign='left';x.font='15px sans-serif';x.fillText(nameOf(it.n).slice(0,13),0,0);x.restore();
  x.fillStyle='#fff';x.strokeStyle='#445';x.beginPath();x.arc(11,H-14,10,0,7);x.fill();x.stroke();x.fillStyle='#111';x.font='bold 12px sans-serif';x.textAlign='center';x.fillText(it.ord,11,H-10);
  return new THREE.CanvasTexture(c)}
function mkDevice(it){
  const w=it.p.mod*MW-0.14,g=new THREE.Group();
  const body=new THREE.Mesh(new THREE.BoxGeometry(w,DH,DD),new THREE.MeshLambertMaterial({color:0xe3e8eb}));body.position.z=DD/2;g.add(body);
  const band=new THREE.Mesh(new THREE.BoxGeometry(w+0.03,1.3,DD+0.03),new THREE.MeshLambertMaterial({color:hexc(KCOL[it.p.kind]||'#555')}));band.position.set(0,DH/2-0.65,DD/2);g.add(band);
  const lab=new THREE.Mesh(new THREE.PlaneGeometry(w-0.1,DH-3.4),new THREE.MeshBasicMaterial({map:labelTex(it)}));lab.position.set(0,-0.55,DD+0.02);g.add(lab);
  const lever=new THREE.Group();lever.position.set(0,-DH/2+1.3,DD);
  const lm=new THREE.Mesh(new THREE.BoxGeometry(Math.min(w*0.55,1.3),1.9,1.1),new THREE.MeshLambertMaterial({color:hexc(KCOL[it.p.kind]||'#555')}));lm.position.set(0,0.95,0.5);lever.add(lm);g.add(lever);
  const led=new THREE.Mesh(new THREE.SphereGeometry(0.28,10,8),new THREE.MeshBasicMaterial({color:0x888888}));led.position.set(0,DH/2-0.65,DD+0.2);g.add(led);
  g.userData={key:it.key,lever,led,body};g.traverse(o=>{o.userData.dev=g});return g}
function conds(it){const p=it.p;if(p.poles>=3)return['L1','L2','L3'].concat(p.poles>=4?['N']:[]);return[it.i.phase||'L1','N']}
function mkCable(it,pit,a,b,root,R){
  const sec=it.i.sec||2.5,rad=0.1+0.035*Math.sqrt(sec),cs=conds(pit.p.poles>=3&&it.p.poles>=3?it:it.p.poles<=2?it:pit);
  const lane=DD+1.5+(it.ord%6)*0.55;
  cs.forEach((cn,ix)=>{const dx=(ix-(cs.length-1)/2)*Math.max(0.3,rad*2.4);
    const pts=[new THREE.Vector3(a.x+dx,a.y-DH/2,Z0+DD),new THREE.Vector3(a.x+dx,a.y-DH/2-1.8,Z0+lane),new THREE.Vector3(b.x+dx,b.y+DH/2+1.8,Z0+lane),new THREE.Vector3(b.x+dx,b.y+DH/2,Z0+DD)];
    const mat=new THREE.MeshLambertMaterial({color:CC[cn],emissive:0x000000});
    const m=new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts),24,rad,6),mat);root.add(m);R.cabs.push({m,mat,id:it.n.id,base:CC[cn],cn})});
}
function issueMap(C){const mp={};const rank={err:2,warn:1};
  C.a.issues.forEach(i=>{if(i.id&&rank[i.lv]&&(!mp[i.id]||rank[i.lv]>rank[mp[i.id]]))mp[i.id]=i.lv});
  placeIssues(C).forEach(i=>{if(i.id&&rank[i.lv]&&(!mp[i.id]||rank[i.lv]>rank[mp[i.id]]))mp[i.id]=i.lv});return mp}
function placeIssues(C){const out=[];const pos=it=>{const q=C.layout[it.key];return q?q.r*1000+q.c:null};
  const miss=C.inst.filter(it=>!C.layout[it.key]);
  if(miss.length)out.push({lv:'warn',id:null,msg:`Faltan por montar ${miss.length} aparato(s) en el carril.`});
  C.nodes.forEach(n=>{const p=C.par[n.id];if(!p)return;const a=C.by[p.id+'#0'],b=C.by[n.id+'#0'];if(!a||!b)return;const pa=pos(a),pb=pos(b);
    if(pa!=null&&pb!=null&&pb<pa)out.push({lv:'warn',id:n.id,msg:`«${nameOf(n)}» está montado antes que su aparato de cabecera «${nameOf(p)}». Orden recomendado: de arriba a abajo y de izquierda a derecha, siguiendo el número de orden.`})});
  const root=C.by[(C.b.root||{}).id+'#0'];if(root&&C.layout[root.key]&&(C.layout[root.key].r!==0||C.layout[root.key].c!==0))out.push({lv:'info',id:root.n.id,msg:'La cabecera debería ocupar la primera posición (fila 1, módulo 1).'});
  return out}

// ---------- visuales por fotograma ----------
function visuals(t){
  const R=M.R,C=M.C,S=M.sim;if(!S)return;const fl=flow(S.delta,true);S.fl=fl;
  Object.values(R.devs).forEach(d=>{const key=d.userData.key,it=C.by[key];if(!it)return;const st=S.st[it.n.id],live=fl.live[it.n.id];
    const sel=M.ui.sel===key;
    d.userData.lever.rotation.x=st.destroyed?0.2:st.trip?0.12:(st.closed?-0.5:0.5);
    const I=fl.I[it.n.id],ov=it.p.in>0&&I>0.9*it.p.in;
    let col=0x888888;if(st.destroyed)col=0x000000;else if(st.trip)col=(Math.sin(t*8)>0)?0xff2222:0x661111;else if(live&&st.closed)col=ov?0xffa000:0x25d366;
    d.userData.led.material.color.setHex(col);
    d.userData.body.material.color.setHex(st.destroyed?0x3a3330:sel?0xcdeedd:0xe3e8eb);
    if(S.fault&&S.fault.id===it.n.id)d.userData.led.scale.setScalar(1+0.6*Math.abs(Math.sin(t*10)))});
  R.cabs.forEach(c=>{const live=fl.live[c.id]&&S.on,burn=S.burn[c.id],I=fl.I[c.id]||0,info=C.a.info[c.id];
    if(burn){c.mat.emissive.setHex(0xff3300);c.mat.color.setHex(0x331100)}
    else{c.mat.color.setHex(c.base);const hot=info&&info.amp&&I>info.amp*1.05;
      if(live&&S.mode!=='off'){const k=0.25+0.25*Math.sin(t*5+c.id.length);c.mat.emissive.setRGB(hot?0.9*k*2:0.1*k,hot?0.35*k*2:0.35*k,hot?0:0.7*k)}else c.mat.emissive.setHex(0)}});
  R.marks.forEach(m=>{const s=1+0.15*Math.sin(t*5);m.s.scale.set(3.2*s,3.2*s,1)});
  if(S.fault&&S.fault.mk){const s=1+0.25*Math.sin(t*9);S.fault.mk.scale.set(3.6*s,3.6*s,1)}
  if(M.mode==='demo'&&(S.fault||M.ui.sel)&&Math.floor(t*2)!==S.lastRef){S.lastRef=Math.floor(t*2);reading()}
}

// ---------- simulación ----------
function initSim(){const C=M.C;M.sim={bid:C.b.id,on:true,speed:5,t:0,st:{},delta:{},burn:{},fault:null,log:[],banner:null,lastRef:0};
  C.nodes.forEach(n=>M.sim.st[n.id]={closed:true,trip:null,destroyed:false})}
function flow(delta,useState){const C=M.C,S=M.sim,live={},I={};
  (function rec(n,up){const info=C.a.info[n.id],p=info.p,st=S.st[n.id]||{closed:true};live[n.id]=up;
    const out=up&&(!useState||(st.closed&&!st.trip&&!st.destroyed));let Iv;
    if(!n.children.length)Iv=info.ib;else{let s=0;n.children.forEach(c=>{const ci=rec(c,out),cp=C.a.info[c.id].p;s+=ci*c.qty*((p.poles>=3&&C.b.phases===3&&cp.poles<=2)?1/3:1)});Iv=n.children.length>1?s*C.b.ks:s}
    Iv+=(delta&&delta[n.id])||0;I[n.id]=up?Iv:0;return up?Iv:0})(C.b.root,useState?S.on:true);
  return{live,I}}
function say(txt,lv){const S=M.sim;S.log.unshift({t:S.t,txt,lv:lv||''});if(S.log.length>40)S.log.pop();logUI()}
function banner(txt,lv){if(M.mode==='demo'||txt)M.sim.banner={txt,lv};const el=$q('m-banner');if(el)el.innerHTML=txt?`<div style="background:${lv==='err'?'#b71c1c':lv==='ok'?'#1b5e20':'#0f2a3d'};color:#fff;padding:8px 12px;border-radius:8px;font-size:13px;line-height:1.35">${txt}</div>`:''}
function chainOf(C,id){const out=[];let n=C.nodes.find(x=>x.id===id);while(n){out.push(n);n=C.par[n.id]}return out}
function planFault(type,leak,mult){
  const C=M.C,S=M.sim,F=C.nodes.find(n=>n.id===S.fault.id),chain=chainOf(C,F.id),Ik=C.b.isc*1000;
  const refIn=(chain.map(n=>C.a.info[n.id].p.in).find(x=>x>0))||0,Fi=C.a.info[F.id];
  S.delta={};if(type==='over'){S.delta[F.id]=Math.max(0,mult*refIn-Fi.ib)||Fi.ib*(mult-1)}
  const fl=flow(S.delta,false);S.flAll=fl;
  const cands=[];
  chain.forEach((n,idx)=>{const i=C.a.info[n.id],p=i.p,st=S.st[n.id];if(st.trip||!st.closed||st.destroyed)return;
    const prot=['mcb','rcbo','incomer'].includes(p.kind)&&p.in>0,rcd=['rcd','rcbo'].includes(p.kind)&&p.ma>0;let t=Infinity,why='',fail=false;
    if(type==='short'&&prot){t=Ik>=10*p.in?0.02:5;why=`cortocircuito de ${f1(Ik/1000)} kA ≥ umbral magnético (10×${p.in} A)`;fail=p.icu*1000<Ik}
    if(type==='over'&&prot){const r=fl.I[n.id]/p.in;if(r>=7.5){t=0.02;why=`sobrecorriente de ${f1(fl.I[n.id])} A`}else if(r>1.13){t=12/(r*r-1.2769);why=`sobrecarga: ${f1(fl.I[n.id])} A frente a un calibre de ${p.in} A (${Math.round(r*100)}%)`}}
    if(type==='earth'&&rcd&&leak>=0.5*p.ma/1000){t=p.ma>=300?0.15:0.03;why=`fuga a tierra de ${Math.round(leak*1000)} mA ≥ ½ de la sensibilidad (${p.ma} mA)`}
    if(t<Infinity)cands.push({n,idx,t,why,fail,p})});
  const ev=[],notes=[];cands.sort((a,b)=>a.t-b.t||a.idx-b.idx);
  const first=cands[0];
  const nearest=chain.find(n=>{const p=C.a.info[n.id].p;return type==='earth'?(['rcd','rcbo'].includes(p.kind)&&p.ma):(['mcb','rcbo','incomer'].includes(p.kind)&&p.in>0)});
  if(!first){notes.push(type==='earth'?'No hay ningún diferencial aguas arriba: la fuga NO se corta. Riesgo de electrocución o incendio.':'Ninguna protección detecta este fallo con el calibre actual: la corriente se mantiene.');ev.push({time:1,type:'none'})}
  else if(type==='short'&&first.fail){ev.push({time:first.t,type:'destroy',id:first.n.id,msg:`«${nameOf(first.n)}» NO tiene poder de corte suficiente (${first.p.icu} kA < ${f1(Ik/1000)} kA): el aparato se destruye.`});
    const up=cands.find(c=>c.idx>first.idx);
    if(up)ev.push({time:first.t+0.15,type:'trip',id:up.n.id,msg:`Dispara «${nameOf(up.n)}» (respaldo): ${up.why}.`,why:up.why});
    else notes.push('Ninguna protección aguas arriba despeja el fallo: riesgo de incendio.')}
  else ev.push({time:first.t,type:'trip',id:first.n.id,msg:`Dispara «${nameOf(first.n)}» tras ${first.t<0.1?'<0,1':f1(first.t)} s: ${first.why}.`,why:first.why});
  const trigId=(ev.find(e=>e.type==='trip')||{}).id,tripT=(ev.find(e=>e.type==='trip')||{time:Infinity}).time;
  if(trigId&&nearest&&trigId!==nearest.id)notes.push(`Falta selectividad: disparó «${nameOf(C.nodes.find(n=>n.id===trigId))}» (aguas arriba) y no «${nameOf(nearest)}». Se queda sin servicio todo lo que cuelga de él.`);
  // quemado de cable por sobrecorriente sostenida
  if(type==='over')chain.forEach(n=>{const i=C.a.info[n.id];if(!i.amp)return;const r=fl.I[n.id]/i.amp;if(r>1.05){const tb=40/(r*r-1);if(tb<tripT)ev.push({time:tb,type:'burn',id:n.id,msg:`El cable de «${nameOf(n)}» (${i.cl} mm², admite ${i.amp} A) soporta ${f1(fl.I[n.id])} A: se calienta y se quema antes de que dispare la protección.`})}});
  ev.sort((a,b)=>a.time-b.time);return{events:ev,notes}}
function startFault(type,leak,mult){
  const C=M.C,S=M.sim,id=M.ui.sel?C.by[M.ui.sel].n.id:null;if(!id){alert('Selecciona primero el circuito donde quieres provocar el fallo (clic en un aparato).');return}
  clearFault(true);const fl=flow(S.delta,true);
  S.fault={id,type,t0:S.t,done:false,mk:null};const n=C.nodes.find(x=>x.id===id),it=C.by[id+'#0'];
  const nm={short:'Cortocircuito',over:`Sobrecarga ${Math.round(mult*100)}%`,earth:`Fuga a tierra ${Math.round(leak*1000)} mA`}[type];
  if(!fl.live[id]){say(`${nm} en «${nameOf(n)}»: el circuito está sin tensión, no pasa nada.`);S.fault=null;banner('El circuito está sin tensión (aparato aguas arriba abierto o sin alimentación).','');return}
  S.fault.plan=planFault(type,leak,mult);S.fault.params={leak,mult};
  const pos=devPos(C,it);if(pos&&M.R){const s=mkSprite('⚡','#f9a825');s.position.set(pos.x,pos.y+DH/2+2.6,Z0+DD+1.5);M.R.root.add(s);S.fault.mk=s}
  say(`Fallo inyectado: ${nm} en «${nameOf(n)}» (${locOf(C,it)}).`);banner(`FALLO: ${nm} en «${nameOf(n)}» — ${locOf(C,it)}`,'');
  S.fault.plan.notes.forEach(t=>say('⚠ '+t,'err'));
  if(!S.fault.plan.events.some(e=>e.type!=='none'))banner(`FALLO: ${nm} en «${nameOf(n)}» — ${locOf(C,it)}<br>${S.fault.plan.notes.join(' ')}`,'err');
  panels()}
function clearFault(silent){const S=M.sim;if(S.fault&&S.fault.mk&&M.R)M.R.root.remove(S.fault.mk);if(S.fault&&!silent)say('Fallo eliminado.');S.fault=null;S.delta={};if(!silent)banner('','')}
M.fault=(t,leak,mult)=>startFault(t,leak,mult);M.clearFault=()=>{clearFault();panels()};
M.supply=()=>{M.sim.on=!M.sim.on;say('Alimentación '+(M.sim.on?'conectada.':'desconectada.'));panels()};
M.speed=v=>{M.sim.speed=num(v,5)};
M.rearm=()=>{const S=M.sim;Object.values(S.st).forEach(s=>{s.trip=null;s.closed=true;s.destroyed=false});S.burn={};say('Todas las protecciones rearmadas y aparatos repuestos.');if(S.fault)replan();panels()};
M.resetAll=()=>{const keepSel=M.ui.sel;clearFault(true);initSim();M.ui.sel=keepSel;banner('','');rebuild();panels()};
function replan(){const S=M.sim,f=S.fault;if(!f)return;f.t0=S.t;f.plan=planFault(f.type,f.params.leak,f.params.mult)}
function stepSim(dt){const S=M.sim;if(!S)return;S.t+=dt*S.speed;const f=S.fault;if(!f||!f.plan)return;const el=S.t-f.t0;
  f.plan.events.forEach(e=>{if(e.done||el<e.time)return;e.done=true;
    if(e.type==='destroy'){S.st[e.id].destroyed=true;say('💥 '+e.msg,'err');banner(e.msg,'err')}
    else if(e.type==='trip'){S.st[e.id].trip=e.why;say('🔴 '+e.msg,'err');const C=M.C,n=C.nodes.find(x=>x.id===e.id),F=C.nodes.find(x=>x.id===f.id);
      const sel=f.plan.notes.length?'<br>⚠ '+f.plan.notes[0]:'<br>✔ Disparo selectivo: actuó la protección más cercana al fallo.';
      banner(`${e.msg}<br>Fallo en «${nameOf(F)}» (${locOf(C,C.by[F.id+'#0'])}). Disparó «${nameOf(n)}» (${locOf(C,C.by[n.id+'#0'])}).${sel}`,f.plan.notes.length?'err':'ok');S.delta={}}
    else if(e.type==='burn'){S.burn[e.id]=true;say('🔥 '+e.msg,'err');banner(e.msg,'err')}
    else if(e.type==='none'){say('⚠ '+f.plan.notes.join(' '),'err');banner(f.plan.notes.join(' '),'err')}});
}

// ---------- paneles HTML ----------
function updHint(){const h=$q('m-hint');if(!h)return;const u=M.ui;
  h.textContent=M.mode==='build'?(u.carry?'Toca un hueco del carril para colocar «'+nameOf(M.C.by[u.carry].n)+'» (Esc cancela)':'Elige un aparato de la lista y toca el carril. Arrastra para girar · rueda/pellizco para zoom'):'Toca un aparato para conectar/desconectar (o rearmar). Selecciona un circuito y provoca un fallo.'}
function panels(){const L=$q('m-left'),Rg=$q('m-right');if(!L||!M.C)return;const C=M.C,u=M.ui;
  const placed=C.inst.filter(it=>C.layout[it.key]).length;
  L.innerHTML=`<h3>Orden de montaje (${placed}/${C.inst.length})</h3><p class="muted" style="font-size:12px;margin:0 0 6px">De cabecera a circuitos finales. Pulsa uno para colocarlo.</p>
  <table style="font-size:12.5px"><tr><th>#</th><th>Aparato</th><th>In</th><th>Cable</th><th></th></tr>${C.inst.map(it=>`<tr style="cursor:pointer;${u.sel===it.key?'background:var(--pr2)':''}" onclick="M3D.pick('${it.key}')"><td>${it.ord}</td><td>${esc(nameOf(it.n))}${it.n.qty>1||it.q?' '+(it.q+1):''}<br><small class="muted">${esc(it.p.name)}</small></td><td>${it.p.in||'—'}</td><td>${it.i.cable&&it.i.cl?it.i.cl+' mm²':'—'}</td><td>${C.layout[it.key]?'✔':'○'}</td></tr>`).join('')}</table>`;
  if(!Rg)return;
  if(!C.b.root){Rg.innerHTML='<div class="card">El cuadro está vacío. Diseña primero la red en la pestaña «Diseño».</div>';return}
  Rg.innerHTML=(M.mode==='build'?buildPanel(C):demoPanel(C));updHint();
}
function selInfo(C,it){const i=it.i,p=it.p,par=C.par[it.n.id];
  return`<div class="card"><h3>${esc(nameOf(it.n))} <small class="muted">#${it.ord}</small></h3>
  <p style="margin:0 0 6px">${esc(p.name)}<br><small class="muted">${C.layout[it.key]?locOf(C,it):'sin montar'}</small></p>
  <table style="font-size:13px"><tr><td>Calibre</td><td><b>${p.in?p.in+' A':'—'}</b> · ${p.poles}P${p.ma?' · '+p.ma+' mA':''}</td></tr>
  <tr><td>Poder de corte</td><td>${p.icu?p.icu+' kA':'—'} (Icc ${C.b.isc} kA)</td></tr>
  <tr><td>Intensidad de cálculo</td><td><b>${f1(i.ib)} A</b></td></tr>
  <tr><td>Alimentado desde</td><td>${par?esc(nameOf(par)):'Red / acometida'}</td></tr>
  <tr><td>Cable</td><td><b>${i.cable||'—'}</b> (admite ${i.amp||'—'} A)</td></tr>
  <tr><td>Conductores</td><td style="font-size:12px">${esc(condText(i))}</td></tr>
  ${i.dv!=null?`<tr><td>Caída tensión</td><td>${f1(i.dv)}% (${it.n.len} m)</td></tr>`:''}</table></div>`}
function issuesBox(C){const all=C.a.issues.concat(placeIssues(C));
  return`<div class="card"><h3>Fallos y avisos</h3>${all.length?all.map(i=>`<div class="chk ${i.lv}" ${i.id?`style="cursor:pointer" onclick="M3D.pick('${i.id}#0')"`:''}>${esc(i.msg)}</div>`).join(''):'<div class="chk ok">Sin fallos. El montaje y el diseño son correctos.</div>'}</div>`}
function buildPanel(C){const u=M.ui,it=u.sel?C.by[u.sel]:null;
  return(it?selInfo(C,it)+`<div class="card"><div class="bar"><button class="b s" onclick="M3D.move()">Mover</button><button class="b d" onclick="M3D.remove()">Quitar del carril</button>${u.carry?'<button class="b s" onclick="M3D.cancel()">Cancelar</button>':''}</div>
  <label>Sección de cable (mm²)</label><select onchange="M3D.setSec(this.value)" style="width:100%"><option value="">Automática (${it.i.cl||'—'} mm²)</option>${CABLES.map(c=>`<option value="${c[0]}" ${it.n.sec===c[0]?'selected':''}>${c[2]||c[0]} mm² (${c[1]} A)</option>`).join('')}</select>
  <p class="muted" style="font-size:12px">Prueba una sección menor para ver cómo el sistema detecta el fallo.</p></div>`:'<div class="card muted">Selecciona un aparato (lista o 3D) para ver su calibre, cable, colores y orden.</div>')+issuesBox(C)}
function demoPanel(C){const S=M.sim,it=M.ui.sel?C.by[M.ui.sel]:null;
  return`<div class="card"><h3>Demostración</h3><div class="bar"><button class="b ${S.on?'':'d'}" onclick="M3D.supply()">Alimentación: ${S.on?'CONECTADA':'DESCONECTADA'}</button><button class="b s" onclick="M3D.rearm()">Rearmar todo</button><button class="b s" onclick="M3D.resetAll()">Reiniciar</button></div>
  <label>Velocidad de simulación</label><select onchange="M3D.speed(this.value)">${[1,5,20].map(v=>`<option value="${v}" ${S.speed===v?'selected':''}>×${v}</option>`).join('')}</select>
  <p class="muted" style="font-size:12px">LED verde = en servicio · naranja = >90% · rojo parpadeante = disparado. Los cables brillan cuando llevan corriente.</p></div>
  <div class="card"><h3>Provocar un fallo</h3><p style="margin:0 0 6px;font-size:13px">En: <b>${it?esc(nameOf(it.n)):'(selecciona un aparato)'}</b></p>
  <div class="bar"><button class="b d" onclick="M3D.fault('short',0,0)">Cortocircuito</button><button class="b" style="background:#e08a00" onclick="M3D.fault('over',0,1.3)">Sobrecarga 130%</button><button class="b" style="background:#e08a00" onclick="M3D.fault('over',0,2)">Sobrecarga 200%</button>
  <button class="b" style="background:#6a1b9a" onclick="M3D.fault('earth',0.1,0)">Fuga 100 mA</button><button class="b" style="background:#6a1b9a" onclick="M3D.fault('earth',0.5,0)">Fuga 500 mA</button><button class="b s" onclick="M3D.clearFault()">Quitar fallo</button></div></div>
  <div class="card" id="m-read"></div><div class="card"><h3>Registro</h3><div id="m-log" style="font-size:12.5px;max-height:200px;overflow:auto"></div></div>${issuesBox(C)}`}
function logUI(){const el=$q('m-log');if(!el||!M.sim)return;el.innerHTML=M.sim.log.length?M.sim.log.map(l=>`<div class="chk ${l.lv||'info'}">[${f1(l.t)} s] ${esc(l.txt)}</div>`).join(''):'<span class="muted">Sin eventos todavía.</span>'}
function reading(){const el=$q('m-read');if(!el||!M.sim||!M.sim.fl)return;const C=M.C,S=M.sim,it=M.ui.sel?C.by[M.ui.sel]:null;
  if(!it){el.innerHTML='<h3>Lectura</h3><span class="muted">Selecciona un aparato.</span>';logUI();return}
  const st=S.st[it.n.id],I=S.fl.I[it.n.id]||0,live=S.fl.live[it.n.id]&&S.on;
  const estado=st.destroyed?'DESTRUIDO':st.trip?'DISPARADO ('+esc(st.trip)+')':!st.closed?'ABIERTO':live?'EN SERVICIO':'SIN TENSIÓN';
  el.innerHTML=`<h3>Lectura: ${esc(nameOf(it.n))}</h3><p style="margin:0">Estado: <b>${estado}</b></p><p style="margin:2px 0">Corriente: <b>${f1(I)} A</b>${it.p.in?` (${Math.round(I/it.p.in*100)}% de ${it.p.in} A)`:''}</p><p style="margin:2px 0">Cable: <b>${it.i.cable||'—'}</b>${it.i.amp?` (admite ${it.i.amp} A)`:''}${S.burn[it.n.id]?' <b style="color:#c62828">QUEMADO</b>':''}</p>`;logUI()}

// ---------- interacción 3D ----------
function bindEvents(cv){
  const R=M.R,P={};let moved=0,last=null,pinch=0;
  const ndc=e=>{const r=cv.getBoundingClientRect();R.ptr.set(((e.clientX-r.left)/r.width)*2-1,-((e.clientY-r.top)/r.height)*2+1)};
  const slotAt=e=>{ndc(e);R.ray.setFromCamera(R.ptr,R.camera);const h=R.ray.intersectObject(R.plane)[0];if(!h)return null;
    const C=M.C,key=M.ui.carry;if(!key)return null;const it=C.by[key],g=geo(C);
    const c=Math.max(0,Math.min(C.cols-it.p.mod,Math.round((h.point.x-g.x0)/MW-it.p.mod/2))),r=Math.max(0,Math.min(C.rows-1,Math.round((g.yTop-h.point.y)/RP)));
    return{r,c,ok:fits(C,key,r,c)}};
  const ghost=s=>{const gh=R.ghost,C=M.C;if(!s||!M.ui.carry){gh.visible=false;return}const it=C.by[M.ui.carry],g=geo(C);
    gh.visible=true;gh.scale.x=it.p.mod*MW-0.14;gh.position.set(g.x0+(s.c+it.p.mod/2)*MW,g.yTop-s.r*RP,Z0+DD/2);gh.material.color.setHex(s.ok?0x2e7d32:0xc62828)};
  const place=e=>{const s=slotAt(e);if(!s)return false;if(!s.ok){const h=$q('m-hint');if(h)h.textContent='Ahí no cabe o está ocupado.';return true}
    M.C.layout[M.ui.carry]={r:s.r,c:s.c};save();M.ui.sel=M.ui.carry;M.ui.carry=null;rebuild();panels();return true};
  const pickDev=e=>{ndc(e);R.ray.setFromCamera(R.ptr,R.camera);const h=R.ray.intersectObjects(Object.values(R.devs),true)[0];return h?h.object.userData.dev.userData.key:null};
  cv.addEventListener('pointerdown',e=>{cv.setPointerCapture(e.pointerId);P[e.pointerId]={x:e.clientX,y:e.clientY};moved=0;last={x:e.clientX,y:e.clientY};if(Object.keys(P).length===2){const a=Object.values(P);pinch=Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y)}});
  cv.addEventListener('pointermove',e=>{
    if(!P[e.pointerId]){if(M.ui.carry)ghost(slotAt(e));return}
    P[e.pointerId]={x:e.clientX,y:e.clientY};const n=Object.keys(P).length,c=R.cam;
    if(n===2){const a=Object.values(P),d=Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y);c.r=Math.max(30,Math.min(400,c.r*pinch/d));pinch=d;moved=99;return}
    const dx=e.clientX-last.x,dy=e.clientY-last.y;moved+=Math.abs(dx)+Math.abs(dy);last={x:e.clientX,y:e.clientY};
    if(moved>6){if(e.shiftKey||e.buttons===2){c.t.x-=dx*c.r*0.0016;c.t.y+=dy*c.r*0.0016}else{c.th-=dx*0.006;c.ph=Math.max(0.25,Math.min(2.2,c.ph-dy*0.006))}}
    else if(M.ui.carry)ghost(slotAt(e))});
  cv.addEventListener('pointerup',e=>{const wasMoved=moved>6;delete P[e.pointerId];if(wasMoved)return;
    if(M.mode==='build'){if(M.ui.carry){if(place(e))return}const k=pickDev(e);if(k){M.ui.sel=k;M.ui.carry=null}else if(!M.ui.carry)M.ui.sel=null;panels();return}
    const k=pickDev(e);if(!k){return}M.ui.sel=k;const it=M.C.by[k],st=M.sim.st[it.n.id];
    if(st.destroyed){say('«'+nameOf(it.n)+'» está destruido: usa «Rearmar todo» para reponerlo.')}
    else if(st.trip){st.trip=null;st.closed=true;say('Rearmado «'+nameOf(it.n)+'».');if(M.sim.fault)replan()}
    else{st.closed=!st.closed;say(`«${nameOf(it.n)}» ${st.closed?'conectado':'desconectado'}.`);if(M.sim.fault&&st.closed)replan()}
    panels()});
  cv.addEventListener('pointercancel',e=>{delete P[e.pointerId]});
  cv.addEventListener('wheel',e=>{e.preventDefault();R.cam.r=Math.max(30,Math.min(400,R.cam.r*(1+Math.sign(e.deltaY)*0.1)))},{passive:false});
  cv.addEventListener('contextmenu',e=>e.preventDefault());
  cv.addEventListener('dragover',e=>{e.preventDefault();ghost(slotAt(e))});
  cv.addEventListener('drop',e=>{e.preventDefault();place(e)});
  document.addEventListener('keydown',function esc_(e){if(!M.R||!M.R.alive){document.removeEventListener('keydown',esc_);return}if(e.key==='Escape')M.cancel()});
}
})();

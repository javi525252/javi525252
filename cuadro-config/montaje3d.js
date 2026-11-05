'use strict';
/* Montaje 3D del cuadro + vista de la instalación completa + simulación de funcionamiento y fallos */
(function(){
const MW=1.8, RP=18, DH=9, DD=6, Z0=0.6;            // cm: ancho de módulo, paso de fila, alto/fondo de aparato
const CC={L1:0x7a4a1c,L2:0x1a1a1a,L3:0x8a8a8a,N:0x1e63d6};
const SC=['mcb','rcbo','incomer','mpcb'], OL=['mcb','rcbo','incomer','mpcb','thermal','softstart','vfd'];
const M=window.M3D={mode:'build',view:'cuadro',door_:false,ui:{carry:null,sel:null},R:null,sim:null,C:null};
const hexc=s=>parseInt(String(s).slice(1),16);
const $q=id=>document.getElementById(id);
const nameOf=n=>label(n);

// ---------- contexto del cuadro ----------
function ctx(){
  const b=B(),a=analyze(b),ce=chooseEnc(b,a.mods),e=ce.enc;b.layout=b.layout||{};
  const par={},nodes=[],inst=[],loads=[],by={};let ord=0;
  walk(b.root,(n,p)=>{par[n.id]=p;nodes.push(n)});
  nodes.forEach(n=>{const i=a.info[n.id],p=i.p,q=Math.max(1,Math.round(i.eq*n.qty));
    if(p.mod>0){ord++;for(let k=0;k<q;k++){const it={key:n.id+'#'+k,n,q:k,p,i,ord};inst.push(it);by[it.key]=it}}
    else for(let k=0;k<Math.min(q,8);k++){const it={key:n.id+'#'+k,n,q:k,p,i,ord:0,isLoad:true};loads.push(it);by[it.key]=it}});
  return{b,a,e,rows:e.rows,cols:e.cols,par,nodes,inst,loads,by,layout:b.layout};
}
function prune(C){const L=C.layout;let ch=false;
  Object.keys(L).forEach(k=>{const it=C.by[k],q=L[k];
    const bad=!it||it.isLoad||q.r<0||q.r>=C.rows||q.c<0||q.c+it.p.mod>C.cols||Object.keys(L).some(o=>o!==k&&L[o]&&C.by[o]&&!C.by[o].isLoad&&L[o].r===q.r&&q.c<L[o].c+C.by[o].p.mod&&L[o].c<q.c+it.p.mod&&o<k);
    if(bad){delete L[k];ch=true}});
  if(ch)save()}
function fits(C,key,r,c){const it=C.by[key];if(!it||it.isLoad||r<0||r>=C.rows||c<0||c+it.p.mod>C.cols)return false;
  for(const k in C.layout){if(k===key||!C.by[k])continue;const q=C.layout[k];if(q.r===r&&c<q.c+C.by[k].p.mod&&q.c<c+it.p.mod)return false}return true}
const geo=C=>({x0:-C.cols*MW/2,yTop:(C.rows-1)*RP/2});
function devPos(C,it){const q=C.layout[it.key];if(!q)return null;const g=geo(C);return{x:g.x0+(q.c+it.p.mod/2)*MW,y:g.yTop-q.r*RP}}
const locOf=(C,it)=>{if(!it)return '—';if(it.isLoad)return 'receptor de la instalación';const q=C.layout[it.key];return q?`fila ${q.r+1}, módulos ${q.c+1}–${q.c+it.p.mod}`:'sin montar'};
const ltOf=it=>it.n.ltype||it.p.ltype||'';
function phaseOf(C,it){let n=it.n;while(n){const i=C.a.info[n.id];if(i&&i.phase)return i.phase;n=C.par[n.id]}return 'L1'}

// ---------- interfaz pública ----------
M.setMode=m=>{M.mode=m;M.ui.carry=null;rebuild();panels();const b=M.sim&&M.sim.banner;banner(m==='demo'&&b?b.txt:'',b?b.lv:'')};
M.setView=v=>{M.view=v;M.ui.carry=null;if(M.R){M.resetCam();rebuild()}panels()};
M.door=v=>{M.door_=v;if(M.R&&M.R.doorG)M.R.doorG.visible=v};
M.resetCam=()=>{const R=M.R;if(!R)return;const C=M.C;
  if(M.view==='instalacion'){const d=R.dim||{W:520,D:320};R.cam={th:0.5,ph:1.12,r:Math.max(d.W,d.D)*1.15,t:new THREE.Vector3(d.W/2,100,d.D/2.4)}}
  else{const H=C.rows*RP+8,W=C.cols*MW+10;R.cam={th:0.28,ph:1.4,r:Math.max(H*1.45,W*1.5,60),t:new THREE.Vector3(0,0,3)}}};
M.auto=()=>{const C=M.C;C.inst.forEach(it=>delete C.layout[it.key]);let r=0,c=0;
  C.inst.slice().sort((x,y)=>x.ord-y.ord||x.q-y.q).forEach(it=>{if(c+it.p.mod>C.cols){r++;c=0}if(r<C.rows){C.layout[it.key]={r,c};c+=it.p.mod}});
  save();M.ui.carry=null;rebuild();panels()};
M.clear=()=>{M.C.inst.forEach(it=>delete M.C.layout[it.key]);save();rebuild();panels()};
M.pick=key=>{const C=M.C;if(!C.by[key])return;M.ui.sel=key;
  if(M.mode==='build'&&M.view==='cuadro'&&!C.by[key].isLoad&&!C.layout[key])M.ui.carry=key;else M.ui.carry=null;panels();updHint()};
M.move=()=>{M.ui.carry=M.ui.sel;panels();updHint()};
M.remove=()=>{const k=M.ui.sel;if(k){delete M.C.layout[k];save();rebuild();panels()}};
M.cancel=()=>{M.ui.carry=null;panels();updHint()};
M.setSec=v=>{const it=M.C.by[M.ui.sel];if(!it)return;it.n.sec=v?num(v):0;save();rebuild();panels()};

// ---------- escena ----------
M.dispose=()=>{const R=M.R;if(!R)return;cancelAnimationFrame(R.raf);R.alive=false;try{R.renderer.dispose()}catch(e){}M.R=null};
M.mount=()=>{
  M.dispose();const cv=$q('m-cv');if(!cv)return;
  if(!window.THREE){$q('m-wrap').innerHTML='<p style="padding:16px">No se pudo cargar la librería 3D. Comprueba la conexión a internet y recarga.</p>';return}
  const renderer=new THREE.WebGLRenderer({canvas:cv,antialias:true});renderer.setPixelRatio(Math.min(2,window.devicePixelRatio||1));
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  const scene=new THREE.Scene();scene.background=new THREE.Color(0xcfd8de);
  scene.add(new THREE.HemisphereLight(0xffffff,0x8899aa,0.75));
  const dl=new THREE.DirectionalLight(0xffffff,0.65);dl.position.set(60,160,140);dl.castShadow=true;dl.shadow.mapSize.set(1024,1024);
  const sc=dl.shadow.camera;sc.left=-420;sc.right=420;sc.top=420;sc.bottom=-420;sc.near=10;sc.far=900;scene.add(dl);scene.add(dl.target);
  const camera=new THREE.PerspectiveCamera(40,1,1,3000);
  M.R={renderer,scene,camera,root:new THREE.Group(),devs:{},cabs:[],marks:[],loads:[],alive:true,raf:0,ray:new THREE.Raycaster(),ptr:new THREE.Vector2(),ghost:null,plane:null,doorG:null,last:0,cam:null,dim:null,dl};
  scene.add(M.R.root);
  M.C=ctx();prune(M.C);rebuild();M.resetCam();
  if(!M.sim||M.sim.bid!==M.C.b.id){initSim();rebuild()}
  bindEvents(cv);panels();
  const tick=ts=>{const R=M.R;if(!R||!R.alive)return;if(!document.body.contains(cv)){M.dispose();return}
    const dt=Math.min(0.05,(ts-R.last)/1000||0.016);R.last=ts;stepSim(dt);visuals(ts/1000,dt);resize();
    const c=R.cam;camera.position.set(c.t.x+c.r*Math.sin(c.ph)*Math.sin(c.th),c.t.y+c.r*Math.cos(c.ph),c.t.z+c.r*Math.sin(c.ph)*Math.cos(c.th));camera.lookAt(c.t);
    renderer.render(scene,camera);R.raf=requestAnimationFrame(tick)};
  M.R.raf=requestAnimationFrame(tick);
};
function resize(){const R=M.R,cv=R.renderer.domElement,w=cv.clientWidth,h=cv.clientHeight,pr=R.renderer.getPixelRatio();
  if(w&&h&&(cv.width!==Math.round(w*pr)||cv.height!==Math.round(h*pr))){R.renderer.setSize(w,h,false);R.camera.aspect=w/h;R.camera.updateProjectionMatrix()}}
const MAT=(c,e)=>new THREE.MeshLambertMaterial({color:c,emissive:e||0});
function box(w,h,d,c,x,y,z,parent,shadow=true){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),MAT(c));m.position.set(x,y,z);m.castShadow=shadow;m.receiveShadow=true;parent.add(m);return m}
function cyl(r1,r2,h,c,x,y,z,parent,rot,seg=18){const m=new THREE.Mesh(new THREE.CylinderGeometry(r1,r2,h,seg),MAT(c));m.position.set(x,y,z);if(rot==='x')m.rotation.z=Math.PI/2;if(rot==='z')m.rotation.x=Math.PI/2;m.castShadow=true;parent.add(m);return m}
function rebuild(){
  const R=M.R;if(!R)return;const root=R.root;
  while(root.children.length)root.remove(root.children[0]);
  R.devs={};R.cabs=[];R.marks=[];R.loads=[];R.ghost=null;R.doorG=null;R.plane=null;
  M.C=ctx();const C=M.C;prune(C);
  if(M.sim)C.nodes.forEach(n=>{if(!M.sim.st[n.id])M.sim.st[n.id]={closed:true,trip:null,destroyed:false}});
  if(M.view==='instalacion')buildInstall(C,R,root);else buildCabinet(C,R,root);
  // marcadores de fallo
  const iss=issueMap(C);
  C.nodes.forEach(n=>{const lv=iss[n.id];if(!lv)return;const k=n.id+'#0',g=R.devs[k];if(!g)return;
    const bb=new THREE.Box3().setFromObject(g),s=mkSprite('!',lv==='err'?'#c62828':'#e08a00');s.position.set((bb.min.x+bb.max.x)/2,bb.max.y+3,(M.view==='cuadro'?bb.max.z+1:(bb.min.z+bb.max.z)/2));root.add(s);R.marks.push({s,lv})});
  placeFaultMarker();updHint();
}
function dots(R,c,rad){c.dots=[];for(let k=0;k<2;k++){const d=new THREE.Mesh(new THREE.SphereGeometry(rad*1.5,6,5),new THREE.MeshBasicMaterial({color:0x66e0ff}));d.visible=false;R.root.add(d);c.dots.push(d)}c.u=Math.random()}
function conds(C,it){const p=it.p;if(p.poles>=3)return['L1','L2','L3'].concat(p.poles>=4?['N']:[]);return[phaseOf(C,it),'N']}
function buildCabinet(C,R,root){
  const W=C.cols*MW+8,H=C.rows*RP+4,g=geo(C);
  const wall=new THREE.Mesh(new THREE.PlaneGeometry(W*5,H*4),new THREE.MeshLambertMaterial({color:0xe6eaed}));wall.position.z=-1.5;wall.receiveShadow=true;root.add(wall);
  box(W,H,0.6,0xb9c3ca,0,0,-0.3,root);
  [[W+2,1.4,0,H/2+0.5],[W+2,1.4,0,-H/2-0.5],[1.4,H+2,W/2+0.5,0],[1.4,H+2,-W/2-0.5,0]].forEach(([w,h,x,y])=>box(w,h,DD+5,0x8d99a3,x,y,(DD+5)/2-1,root));
  const slotTex=(()=>{const c=document.createElement('canvas');c.width=32;c.height=32;const x=c.getContext('2d');x.fillStyle='#cfd6db';x.fillRect(0,0,32,32);x.fillStyle='#8f9aa3';x.fillRect(12,6,8,20);const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(C.cols*MW/3,1);return t})();
  for(let r=0;r<C.rows;r++){const y=g.yTop-r*RP;
    box(C.cols*MW+1,3.5,0.5,0xdfe6ea,0,y,0.35,root);
    const d=new THREE.Mesh(new THREE.BoxGeometry(C.cols*MW+1,4.2,3.4),new THREE.MeshLambertMaterial({map:slotTex}));d.position.set(0,y-RP/2,Z0+1.7);d.receiveShadow=true;d.castShadow=true;root.add(d)}
  { const y=g.yTop+RP/2,d=new THREE.Mesh(new THREE.BoxGeometry(C.cols*MW+1,4.2,3.4),new THREE.MeshLambertMaterial({map:slotTex}));d.position.set(0,y,Z0+1.7);root.add(d)}
  // puerta con ventana y maneta
  const door=new THREE.Group();door.position.z=DD+6;door.visible=M.door_;
  [[W+2,2.5,0,H/2],[W+2,2.5,0,-H/2],[2.5,H,W/2,0],[2.5,H,-W/2,0]].forEach(([w,h,x,y])=>box(w,h,0.8,0xaeb8bf,x,y,0,door,false));
  const gl=new THREE.Mesh(new THREE.BoxGeometry(W-2,H-2,0.3),new THREE.MeshLambertMaterial({color:0x9fc4e0,transparent:true,opacity:0.25}));door.add(gl);
  cyl(0.9,0.9,2.4,0x444444,W/2-3,0,1.2,door,'z');root.add(door);R.doorG=door;
  const plane=new THREE.Mesh(new THREE.PlaneGeometry(W,H),new THREE.MeshBasicMaterial({transparent:true,opacity:0,depthWrite:false}));plane.position.z=Z0;root.add(plane);R.plane=plane;
  C.inst.forEach(it=>{const pos=devPos(C,it);if(!pos)return;const d=mkDevice(it);d.position.set(pos.x,pos.y,Z0);root.add(d);R.devs[it.key]=d});
  // cables entre aparatos
  C.inst.forEach(it=>{const p=C.par[it.n.id];if(!p)return;const pit=C.by[p.id+'#0'];if(!pit||pit.isLoad)return;const a=devPos(C,pit),b=devPos(C,it);if(!a||!b)return;
    const sec=it.i.sec||2.5,rad=0.1+0.035*Math.sqrt(sec),cs=conds(C,pit.p.poles>=3&&it.p.poles>=3?it:it.p.poles<=2?it:pit),lane=DD+1.5+(it.ord%6)*0.55;
    cs.forEach((cn,ix)=>{const dx=(ix-(cs.length-1)/2)*Math.max(0.3,rad*2.4);
      const pts=[new THREE.Vector3(a.x+dx,a.y-DH/2,Z0+DD),new THREE.Vector3(a.x+dx,a.y-DH/2-1.8,Z0+lane),new THREE.Vector3(b.x+dx,b.y+DH/2+1.8,Z0+lane),new THREE.Vector3(b.x+dx,b.y+DH/2,Z0+DD)];
      addCable(R,root,pts,rad,cn,it.n.id,24)})});
  // salidas hacia receptores (pequeños tramos con la sección)
  C.loads.filter(l=>l.q===0).forEach(l=>{const p=C.par[l.n.id];if(!p)return;const pit=C.by[p.id+'#0'];if(!pit||pit.isLoad)return;const a=devPos(C,pit);if(!a)return;
    const sec=l.i.sec||2.5,rad=0.1+0.035*Math.sqrt(sec),cs=conds(C,l);
    cs.forEach((cn,ix)=>{const dx=(ix-(cs.length-1)/2)*Math.max(0.3,rad*2.4);
      const pts=[new THREE.Vector3(a.x+dx,a.y-DH/2,Z0+DD),new THREE.Vector3(a.x+dx,a.y-DH/2-2.2,Z0+DD+1.6),new THREE.Vector3(a.x+dx,a.y-RP/2-0.5,Z0+DD+1.2)];
      addCable(R,root,pts,rad,cn,l.n.id,10)});
    const s=mkText(`${nameOf(l.n).slice(0,16)} · ${l.i.cl||''} mm²`);s.position.set(a.x,a.y-RP/2-3.2,Z0+DD+3);root.add(s)});
  const gh=new THREE.Mesh(new THREE.BoxGeometry(1,DH,DD),new THREE.MeshBasicMaterial({color:0x2e7d32,transparent:true,opacity:0.45}));gh.visible=false;root.add(gh);R.ghost=gh;
}
function addCable(R,root,pts,rad,cn,id,seg){const curve=new THREE.CatmullRomCurve3(pts),mat=new THREE.MeshLambertMaterial({color:CC[cn],emissive:0});
  const m=new THREE.Mesh(new THREE.TubeGeometry(curve,seg,rad,6),mat);m.castShadow=true;root.add(m);const c={m,mat,id,base:CC[cn],cn,curve};dots(R,c,rad);R.cabs.push(c)}
function mkSprite(txt,col){const c=document.createElement('canvas');c.width=c.height=64;const x=c.getContext('2d');x.fillStyle=col;x.beginPath();x.arc(32,32,28,0,7);x.fill();x.fillStyle='#fff';x.font='bold 40px sans-serif';x.textAlign='center';x.textBaseline='middle';x.fillText(txt,32,34);
  const s=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(c),depthTest:false}));s.scale.set(3.2,3.2,1);s.renderOrder=10;s.userData.base=3.2;return s}
function mkText(txt){const c=document.createElement('canvas');c.width=256;c.height=40;const x=c.getContext('2d');x.fillStyle='rgba(15,42,61,.88)';x.fillRect(0,0,256,40);x.fillStyle='#fff';x.font='bold 20px sans-serif';x.textAlign='center';x.textBaseline='middle';x.fillText(txt,128,21);
  const s=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(c)}));s.scale.set(11,1.7,1);return s}
function labelTex(it){
  const W=Math.max(48,it.p.mod*44),H=200,c=document.createElement('canvas');c.width=W;c.height=H;const x=c.getContext('2d');
  x.fillStyle='#f4f6f7';x.fillRect(0,0,W,H);x.fillStyle='#111';x.textAlign='center';
  const big=it.p.in||(it.p.hi?it.p.hi:'');
  x.font=`bold ${Math.min(34,W*0.55)}px sans-serif`;x.fillText(String(big),W/2,44);
  x.font=`bold ${Math.min(16,W*0.3)}px sans-serif`;x.fillText(it.p.poles+'P'+(it.p.ma?' '+it.p.ma+'mA':''),W/2,66);
  x.save();x.translate(W/2+5,H-8);x.rotate(-Math.PI/2);x.textAlign='left';x.font='15px sans-serif';x.fillText(nameOf(it.n).slice(0,13),0,0);x.restore();
  x.fillStyle='#fff';x.strokeStyle='#445';x.beginPath();x.arc(11,H-14,10,0,7);x.fill();x.stroke();x.fillStyle='#111';x.font='bold 12px sans-serif';x.textAlign='center';x.fillText(it.ord,11,H-10);
  return new THREE.CanvasTexture(c)}
function mkDevice(it){
  const w=it.p.mod*MW-0.14,g=new THREE.Group(),kc=hexc(KCOL[it.p.kind]||'#555');
  const body=box(w,DH,DD,0xd3d9de,0,0,DD/2,g);
  box(w-0.5,DH-0.8,0.6,0xf1f4f6,0,0,DD+0.15,g,false);                       // placa frontal
  box(w+0.03,1.3,DD+0.03,kc,0,DH/2-0.65,DD/2,g,false);                      // franja de color
  for(let k=1;k<it.p.mod;k++)box(0.05,DH-0.6,0.2,0x9aa4ac,-w/2+k*MW-0.07,0,DD+0.35,g,false);   // juntas entre módulos
  box(w*0.78,0.9,1.6,0x3a3f44,0,DH/2+0.4,DD-1.4,g,false);box(w*0.78,0.9,1.6,0x3a3f44,0,-DH/2-0.4,DD-1.4,g,false);   // bornas
  [-1,1].forEach(s=>{if(w>2.4)cyl(0.28,0.28,0.4,0xb0b7bd,s*w*0.22,DH/2+0.9,DD-1.4,g,'z',8)});
  const lab=new THREE.Mesh(new THREE.PlaneGeometry(w-0.4,DH-3.4),new THREE.MeshBasicMaterial({map:labelTex(it)}));lab.position.set(0,-0.55,DD+0.5);g.add(lab);
  const lever=new THREE.Group();lever.position.set(0,-DH/2+1.3,DD+0.4);
  const lm=new THREE.Mesh(new THREE.BoxGeometry(Math.min(w*0.55,1.3),1.9,1.1),MAT(kc));lm.position.set(0,0.95,0.5);lm.castShadow=true;lever.add(lm);g.add(lever);
  const led=new THREE.Mesh(new THREE.SphereGeometry(0.28,10,8),new THREE.MeshBasicMaterial({color:0x888888}));led.position.set(0,DH/2-0.65,DD+0.45);g.add(led);
  g.userData={key:it.key,lever,led,body};g.traverse(o=>{o.userData.dev=g});return g}

// ---------- vista de la instalación completa ----------
function buildInstall(C,R,root){
  const L=C.loads,zone=lt=>['tomas','aire','vehiculo','fv'].includes(lt)?'wall':lt==='alumbrado'?'ceil':'floor';
  const slots={wall:0,ceil:0,floor:0},pos={},cols=7;
  L.forEach(it=>{const z=zone(ltOf(it));let x,zz;
    if(z==='wall'){x=190+slots.wall*95;zz=3;slots.wall++}else if(z==='ceil'){x=190+slots.ceil*85;zz=150;slots.ceil++}else{x=170+(slots.floor%cols)*105;zz=250+Math.floor(slots.floor/cols)*115;slots.floor++}
    pos[it.key]={x,z:zz,zone:z}});
  const W=Math.max(560,190+Math.max(slots.wall,slots.ceil,Math.min(cols,slots.floor))*100+40),D=Math.max(340,250+Math.ceil(slots.floor/cols)*115+70);R.dim={W,D};
  const fl=new THREE.Mesh(new THREE.PlaneGeometry(W,D),new THREE.MeshLambertMaterial({color:0xd9dde0}));fl.rotation.x=-Math.PI/2;fl.position.set(W/2,0,D/2);fl.receiveShadow=true;root.add(fl);
  const gr=new THREE.GridHelper(Math.max(W,D),Math.round(Math.max(W,D)/50),0xb4bcc2,0xc6cdd2);gr.position.set(W/2,0.2,D/2);root.add(gr);
  const wl=new THREE.Mesh(new THREE.PlaneGeometry(W,270),new THREE.MeshLambertMaterial({color:0xf0f2f4}));wl.position.set(W/2,135,0);wl.receiveShadow=true;root.add(wl);
  const wl2=new THREE.Mesh(new THREE.PlaneGeometry(D,270),new THREE.MeshLambertMaterial({color:0xe4e8eb}));wl2.rotation.y=Math.PI/2;wl2.position.set(0,135,D/2);root.add(wl2);
  box(W-20,5,10,0x9aa4ac,W/2+5,240,6,root);                                   // bandeja de cables
  // cuadro
  const cab=new THREE.Group();cab.position.set(70,115,0);root.add(cab);
  box(52,84,22,0x6f7d88,0,0,11,cab);box(48,78,1.6,0x8fa1ad,0,0,23,cab);box(30,34,0.4,0x9fc4e0,0,8,24,cab,false);cyl(1,1,3,0x333,19,-10,24.5,cab,'z');
  const led=new THREE.Mesh(new THREE.SphereGeometry(2,10,8),new THREE.MeshBasicMaterial({color:0x25d366}));led.position.set(-16,-30,24.2);cab.add(led);R.cabLed=led;
  const ts=mkText('CUADRO ELÉCTRICO');ts.scale.set(40,6,1);ts.position.set(70,170,12);root.add(ts);
  R.devs['__cab']=cab;
  // receptores y cables
  L.forEach((it,idx)=>{const ps=pos[it.key],lt=ltOf(it),m=mkLoad(it);const g=m.g;
    g.position.set(ps.x,ps.zone==='ceil'?262:0,ps.zone==='ceil'?ps.z:ps.zone==='wall'?3:ps.z);
    if(ps.zone==='wall'&&lt==='vehiculo'){g.position.z=3}
    g.userData.key=it.key;g.traverse(o=>{o.userData.dev=g});root.add(g);R.devs[it.key]=g;R.loads.push({it,g,upd:m.upd});
    const bb=new THREE.Box3().setFromObject(g),topY=ps.zone==='ceil'?252:Math.min(bb.max.y,ps.zone==='wall'?bb.max.y:bb.max.y),sec=it.i.sec||2.5,rad=0.25+0.06*Math.sqrt(sec),cs=conds(C,it);
    const lane=14+(idx%8)*2.2,tray=238-(idx%5)*1.4;
    cs.forEach((cn,ix)=>{const dx=(ix-(cs.length-1)/2)*Math.max(1,rad*2.6);
      const tz=ps.zone==='wall'?8+(idx%3):ps.z;
      const pts=[new THREE.Vector3(70+dx,158,11),new THREE.Vector3(70+dx,tray,lane),new THREE.Vector3(ps.x+dx,tray,lane)];
      if(ps.zone==='wall')pts.push(new THREE.Vector3(ps.x+dx,topY+12,tz),new THREE.Vector3(ps.x+dx,topY+2,6));
      else if(ps.zone==='ceil')pts.push(new THREE.Vector3(ps.x+dx,tray,ps.z),new THREE.Vector3(ps.x+dx,258,ps.z));
      else pts.push(new THREE.Vector3(ps.x+dx,tray,ps.z),new THREE.Vector3(ps.x+dx,topY+14,ps.z),new THREE.Vector3(ps.x+dx,topY+1,ps.z));
      addCable(R,root,pts,rad,cn,it.n.id,40)});
    const lb=mkText(`${nameOf(it.n).slice(0,18)}${it.n.kw?` ${it.n.kw} kW`:''}`);lb.position.set(ps.x,ps.zone==='ceil'?196:Math.max(bb.max.y+22,34),ps.zone==='wall'?10:ps.z);lb.scale.set(34,5,1);root.add(lb)});
}
function mkLoad(it){
  const lt=ltOf(it),g=new THREE.Group(),isM=it.p.kind==='motor';let upd=()=>{};
  const glowTex=(()=>{const c=document.createElement('canvas');c.width=c.height=64;const x=c.getContext('2d'),gr=x.createRadialGradient(32,32,2,32,32,32);gr.addColorStop(0,'rgba(255,240,160,1)');gr.addColorStop(1,'rgba(255,240,160,0)');x.fillStyle=gr;x.fillRect(0,0,64,64);return new THREE.CanvasTexture(c)})();
  const glow=(s,y)=>{const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:glowTex,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false}));sp.scale.set(s,s,1);sp.position.y=y;sp.visible=false;g.add(sp);return sp};
  if(lt==='alumbrado'){
    cyl(0.3,0.3,40,0x333333,0,-20,0,g);cyl(5,13,10,0xe8e8e8,0,-45,0,g);
    const bulb=new THREE.Mesh(new THREE.SphereGeometry(5,12,10),new THREE.MeshBasicMaterial({color:0x666666}));bulb.position.y=-49;g.add(bulb);const gl=glow(50,-49);
    upd=c=>{bulb.material.color.setHex(c.live?0xfff2a8:0x666666);gl.visible=c.live;gl.material.opacity=0.55+0.05*Math.sin(c.t*30)}
  }else if(lt==='tomas'){
    box(14,14,2.2,0xf4f4f4,0,40,1.1,g);[-2.6,2.6].forEach(x=>cyl(1,1,0.6,0x222222,x,40,2.3,g,'z',10));const led=new THREE.Mesh(new THREE.SphereGeometry(0.7,8,6),new THREE.MeshBasicMaterial({color:0x888888}));led.position.set(0,45,2.4);g.add(led);
    upd=c=>led.material.color.setHex(c.live?0x25d366:0x888888)
  }else if(lt==='cocina'){
    box(60,62,60,0xcfd4d8,0,31,30,g);box(48,36,1.5,0x222,0,26,60.6,g,false);const burners=[[-14,-14],[14,-14],[-14,14],[14,14]].map(([x,z])=>cyl(8,8,0.6,0x333,x,62.3,30+z,g));
    upd=c=>burners.forEach(b=>{b.material.emissive.setHex(c.live?0xff3300:0);b.material.color.setHex(c.live?0xcc2200:0x333333)})
  }else if(lt==='lavadora'){
    box(60,85,60,0xf3f5f6,0,42,30,g);cyl(19,19,2,0x2a3946,0,40,60.5,g,'z',24);const drum=new THREE.Group();drum.position.set(0,40,61.6);g.add(drum);
    for(let k=0;k<3;k++){const b=box(30,3,1,0xaaccee,0,0,0,drum,false);b.rotation.z=k*Math.PI/3}
    upd=c=>{if(c.live)drum.rotation.z+=c.dt*6}
  }else if(lt==='aire'){
    box(92,28,22,0xf5f7f8,0,190,11,g);const lv=box(80,3,10,0xdfe4e8,0,180,21,g,false);const led=new THREE.Mesh(new THREE.SphereGeometry(1.2,8,6),new THREE.MeshBasicMaterial({color:0x888888}));led.position.set(36,196,22.5);g.add(led);
    upd=c=>{led.material.color.setHex(c.live?0x2f9dff:0x888888);lv.rotation.x=c.live?-0.5:0}
  }else if(lt==='calefaccion'){
    const fins=[];for(let k=0;k<9;k++)fins.push(box(5,52,7,0xe6e8ea,-32+k*8,32,6,g));
    upd=c=>fins.forEach(f=>{f.material.emissive.setHex(c.live?0x7a2a00:0)})
  }else if(lt==='vehiculo'){
    box(22,34,12,0x2f3b44,0,85,6,g);const led=new THREE.Mesh(new THREE.BoxGeometry(14,2,1),new THREE.MeshBasicMaterial({color:0x888888}));led.position.set(0,95,12.5);g.add(led);
    const car=new THREE.Group();car.position.set(0,0,125);g.add(car);box(86,26,170,0x3b6ea8,0,24,0,car);box(78,22,90,0x4f86c6,0,46,-4,car);[[-38,48],[38,48],[-38,-48],[38,-48]].forEach(([x,z])=>cyl(14,14,10,0x1c1c1c,x*1.03,14,z*1.6,car,'x'));
    upd=c=>led.material.color.setHex(c.live?(Math.sin(c.t*4)>0?0x25d366:0x0f6b32):0x888888)
  }else if(lt==='fv'){
    box(28,38,12,0xdadfe3,0,90,6,g);const led=new THREE.Mesh(new THREE.SphereGeometry(1.2,8,6),new THREE.MeshBasicMaterial({color:0x888888}));led.position.set(0,100,12.5);g.add(led);
    const pn=[];{const p=box(64,3,100,0x1f4aa8,0,30,55,g);p.rotation.x=-0.45;pn.push(p)}
    upd=c=>{led.material.color.setHex(c.live?0x25d366:0x888888);pn.forEach(p=>p.material.emissive.setHex(c.live?0x0a1f55:0))}
  }else if(lt==='soldadura'){
    box(50,40,40,0xe0b400,0,20,20,g);const sp=glow(60,48);sp.material.color.setHex(0x9fd4ff);
    upd=c=>{sp.visible=c.live&&Math.sin(c.t*47)>-0.2;sp.scale.setScalar(40+30*Math.random())}
  }else if(isM){
    box(70,3,34,0x555d63,0,1.5,0,g);const mb=cyl(15,15,44,0x25576b,0,24,0,g,'x');[-14,-7,0,7,14].forEach(x=>cyl(15.8,15.8,2.2,0x1d4556,x,24,0,g,'x'));
    box(14,14,5,0xcfd4d8,0,24,16,g);cyl(15,15,3,0x151515,-23,24,0,g,'x');
    const rot=new THREE.Group();rot.position.set(30,24,0);g.add(rot);cyl(2,2,18,0xaaaaaa,0,0,0,rot,'x');
    for(let k=0;k<4;k++){const b=box(2,18,2.2,k%2?0xff5722:0xffffff,9,0,0,rot,false);b.rotation.x=k*Math.PI/4;b.position.x=9}
    let extra=null;
    if(lt==='bomba'){cyl(14,14,22,0x1565c0,52,24,0,g,'x');const v=new THREE.Mesh(new THREE.SphereGeometry(17,16,12),MAT(0x1976d2));v.position.set(62,24,0);g.add(v);cyl(4,4,60,0x90a4ae,62,48,0,g)}
    else if(lt==='ventilador'){extra=new THREE.Group();extra.position.set(-30,24,0);g.add(extra);for(let k=0;k<4;k++){const b=box(2,30,9,0x9fb4c2,0,0,0,extra,false);b.rotation.x=k*Math.PI/2}}
    else if(lt==='compresor'){cyl(22,22,90,0xc62828,0,52,-46,g,'x');box(8,8,8,0x444,0,76,-46,g)}
    else if(lt==='ascensor'){const hoist=box(30,14,30,0x546e7a,0,50,0,g);extra=box(36,40,36,0xb0bec5,52,70,0,g);box(4,140,4,0x777,52,70,-22,g,false)}
    const spr=mkText(`${it.n.kw||'?'} kW`);spr.scale.set(18,3,1);spr.position.set(0,52,0);g.add(spr);
    g.userData.w=0;
    upd=c=>{const u=g.userData,st=c.n.start||'dol',acc=st==='dol'?5:st==='yd'?2.2:st==='soft'?0.35:0.28;
      let target=c.live?1:0;if(c.stall)target=0;if(c.phase)target*=0.55;
      if(st==='yd'&&c.live&&u.run<1.6)target=Math.min(target,0.62);u.run=c.live?(u.run||0)+c.dt:0;
      const rate=target>u.w?acc:0.35;u.w+=Math.sign(target-u.w)*Math.min(Math.abs(target-u.w),rate*c.dt);
      rot.rotation.x+=u.w*c.dt*28;if(extra){if(lt==='ascensor'){extra.position.y=70+Math.sin(c.t*0.8)*(u.w>0.05?30:0)}else extra.rotation.x+=u.w*c.dt*26}
      mb.material.emissive.setHex(c.stall?0x661100:c.live&&c.ratio>0.9?0x552200:0);
      g.position.y=c.stall?Math.sin(c.t*80)*0.6:0}
  }else{box(40,40,40,0x90a4ae,0,20,20,g);upd=()=>{}}
  g.userData.upd=upd;return{g,upd};
}
function placeFaultMarker(){const S=M.sim,R=M.R;if(!S||!S.fault||!R)return;S.fault.mk=null;const g=R.devs[S.fault.id+'#0'];if(!g)return;
  const bb=new THREE.Box3().setFromObject(g),s=mkSprite('⚡','#f9a825');s.position.set((bb.min.x+bb.max.x)/2,bb.max.y+(M.view==='cuadro'?5.6:18),M.view==='cuadro'?bb.max.z+1.5:(bb.min.z+bb.max.z)/2);if(M.view==='instalacion')s.userData.base=14;R.root.add(s);S.fault.mk=s}
function issueMap(C){const mp={},rank={err:2,warn:1};
  C.a.issues.concat(placeIssues(C)).forEach(i=>{if(i.id&&rank[i.lv]&&(!mp[i.id]||rank[i.lv]>rank[mp[i.id]]))mp[i.id]=i.lv});return mp}
function placeIssues(C){const out=[];if(M.view!=='cuadro'&&M.view!=='instalacion')return out;const pos=it=>{const q=C.layout[it.key];return q?q.r*1000+q.c:null};
  const miss=C.inst.filter(it=>!C.layout[it.key]);
  if(miss.length)out.push({lv:'warn',id:null,msg:`Faltan por montar ${miss.length} aparato(s) en el carril.`});
  C.nodes.forEach(n=>{const p=C.par[n.id];if(!p)return;const a=C.by[p.id+'#0'],b=C.by[n.id+'#0'];if(!a||!b||a.isLoad||b.isLoad)return;const pa=pos(a),pb=pos(b);
    if(pa!=null&&pb!=null&&pb<pa)out.push({lv:'warn',id:n.id,msg:`«${nameOf(n)}» está montado antes que su aparato de cabecera «${nameOf(p)}». Orden recomendado: de arriba a abajo y de izquierda a derecha, siguiendo el número de orden.`})});
  const root=C.by[(C.b.root||{}).id+'#0'];if(root&&C.layout[root.key]&&(C.layout[root.key].r!==0||C.layout[root.key].c!==0))out.push({lv:'info',id:root.n.id,msg:'La cabecera debería ocupar la primera posición (fila 1, módulo 1).'});
  return out}

// ---------- visuales por fotograma ----------
function visuals(t,dt){
  const R=M.R,C=M.C,S=M.sim;if(!S)return;const fl=flow(S.delta,true);S.fl=fl;
  Object.values(R.devs).forEach(d=>{const key=d.userData.key;if(!key)return;const it=C.by[key];if(!it||it.isLoad)return;const st=S.st[it.n.id],live=fl.live[it.n.id];
    const sel=M.ui.sel===key;
    d.userData.lever.rotation.x=st.destroyed?0.2:st.trip?0.12:(st.closed?-0.5:0.5);
    const I=fl.I[it.n.id],ref=it.i.setIn||it.p.in,ov=ref>0&&I>0.9*ref&&!['mpcb','thermal'].includes(it.p.kind);
    let col=0x888888;if(st.destroyed)col=0x000000;else if(st.trip)col=(Math.sin(t*8)>0)?0xff2222:0x661111;else if(live&&st.closed)col=ov?0xffa000:0x25d366;
    d.userData.led.material.color.setHex(col);
    d.userData.body.material.color.setHex(st.destroyed?0x3a3330:sel?0xbfe8d0:0xd3d9de);
    if(S.fault&&S.fault.id===it.n.id)d.userData.led.scale.setScalar(1+0.6*Math.abs(Math.sin(t*10)))});
  R.loads.forEach(l=>{const n=l.it.n,live=!!(fl.live[n.id]&&S.on),st=S.fault&&S.fault.id===n.id?S.fault:null;
    const stall=!!(st&&st.opt&&st.opt.rotor&&live),phase=!!(st&&st.opt&&st.opt.phase&&live),ref=l.it.i.amp||0;
    l.upd({live:live&&!S.burn[n.id],t,dt,n,stall,phase,ratio:ref?(fl.I[n.id]||0)/ref:0});
    if(M.ui.sel===l.it.key)l.g.traverse(o=>{if(o.material&&o.material.emissive&&!o.userData.hl){}})});
  if(R.cabLed){const any=Object.values(S.st).some(s=>s.trip||s.destroyed);R.cabLed.material.color.setHex(!S.on?0x888888:any?(Math.sin(t*8)>0?0xff2222:0x661111):0x25d366)}
  R.cabs.forEach(c=>{const live=fl.live[c.id]&&S.on,burn=S.burn[c.id],I=fl.I[c.id]||0,info=C.a.info[c.id];
    if(burn){c.mat.emissive.setHex(0xff3300);c.mat.color.setHex(0x331100)}
    else{c.mat.color.setHex(c.base);const hot=info&&info.amp&&I>info.amp*1.05;
      if(live){const k=0.25+0.25*Math.sin(t*5+c.id.length);c.mat.emissive.setRGB(hot?0.9*k*2:0.1*k,hot?0.35*k*2:0.35*k,hot?0:0.7*k)}else c.mat.emissive.setHex(0)}
    const run=live&&!burn&&c.cn!=='N';
    if(c.dots){c.dots.forEach((d,k)=>{d.visible=!!run;if(run){const amp=info&&info.amp?I/info.amp:0.3;c.u=(c.u+dt*(0.05+Math.min(1.5,amp)*0.25)/c.dots.length)%1;d.position.copy(c.curve.getPoint((c.u+k/c.dots.length)%1))}})}});
  R.marks.forEach(m=>{const s=1+0.15*Math.sin(t*5),b=m.s.userData.base||3.2;m.s.scale.set(b*s,b*s,1)});
  if(S.fault&&S.fault.mk){const s=1+0.25*Math.sin(t*9),b=S.fault.mk.userData.base||3.2;S.fault.mk.scale.set(b*1.12*s,b*1.12*s,1)}
  if(M.mode==='demo'&&Math.floor(t*2)!==S.lastRef){S.lastRef=Math.floor(t*2);reading()}
}

// ---------- simulación ----------
function initSim(){const C=M.C;M.sim={bid:C.b.id,on:true,speed:5,t:0,st:{},delta:{},burn:{},fault:null,log:[],banner:null,lastRef:0};
  C.nodes.forEach(n=>M.sim.st[n.id]={closed:true,trip:null,destroyed:false})}
function flow(delta,useState){const C=M.C,S=M.sim,live={},I={};
  (function rec(n,up){const info=C.a.info[n.id],p=info.p,st=S.st[n.id]||{closed:true};const upl=up&&!(useState&&S.burn[n.id]);live[n.id]=upl;
    const out=upl&&(!useState||(st.closed&&!st.trip&&!st.destroyed));let Iv;
    if(!n.children.length)Iv=info.ib;else{let s=0;n.children.forEach(c=>{const ci=rec(c,out),cp=C.a.info[c.id].p;s+=ci*c.qty*((p.poles>=3&&C.b.phases===3&&cp.poles<=2)?1/3:1)});Iv=n.children.length>1?s*C.b.ks:s}
    Iv+=(delta&&delta[n.id])||0;I[n.id]=upl?Iv:0;return upl?Iv:0})(C.b.root,useState?S.on:true);
  return{live,I}}
function say(txt,lv){const S=M.sim;S.log.unshift({t:S.t,txt,lv:lv||''});if(S.log.length>40)S.log.pop();logUI()}
function banner(txt,lv){if(M.mode==='demo'||txt)M.sim.banner={txt,lv};const el=$q('m-banner');if(el)el.innerHTML=txt?`<div style="background:${lv==='err'?'#b71c1c':lv==='ok'?'#1b5e20':'#0f2a3d'};color:#fff;padding:8px 12px;border-radius:8px;font-size:13px;line-height:1.35">${txt}</div>`:''}
function chainOf(C,id){const out=[];let n=C.nodes.find(x=>x.id===id);while(n){out.push(n);n=C.par[n.id]}return out}
function planFault(type,leak,mult,opt){
  const C=M.C,S=M.sim,F=C.nodes.find(n=>n.id===S.fault.id),chain=chainOf(C,F.id),Ik=C.b.isc*1000,Fi=C.a.info[F.id];
  const refIn=(chain.map(n=>{const i=C.a.info[n.id];return OL.includes(i.p.kind)?(i.setIn||i.p.in):0}).find(x=>x>0))||0;
  S.delta={};
  if(type==='over'){if(opt&&opt.rotor)S.delta[F.id]=((F.iarr||6)-1)*Fi.ib;
    else if(opt&&opt.phase)S.delta[F.id]=0.8*Fi.ib;else S.delta[F.id]=Math.max(0,mult*refIn-Fi.ib)||Fi.ib*(mult-1)}
  const fl=flow(S.delta,false);
  const cands=[];
  chain.forEach((n,idx)=>{const i=C.a.info[n.id],p=i.p,st=S.st[n.id];if(st.trip||!st.closed||st.destroyed)return;
    const In=i.setIn||p.in,rcd=['rcd','rcbo'].includes(p.kind)&&p.ma>0,motor=['mpcb','thermal','softstart','vfd'].includes(p.kind);let t=Infinity,why='',fail=false;
    if(type==='short'){
      if(SC.includes(p.kind)&&In>0){t=Ik>=(p.kind==='mpcb'?12:10)*In?0.02:5;why=`cortocircuito de ${f1(Ik/1000)} kA ≥ umbral magnético`;fail=p.icu*1000<Ik}
      else if(['softstart','vfd'].includes(p.kind)){t=0.015;why='protección interna del equipo contra cortocircuito'}}
    if(type==='over'&&OL.includes(p.kind)&&In>0){const r=fl.I[n.id]/In;
      if(motor){if(r>1.2){t=Math.max(0.02,7*Math.pow(7.2/r,2));why=`sobrecarga del motor: ${f1(fl.I[n.id])} A frente a ${f1(In)} A de ajuste (${Math.round(r*100)}%)`}}
      else if(r>=7.5){t=0.02;why=`sobrecorriente de ${f1(fl.I[n.id])} A`}
      else if(r>1.13){t=12/(r*r-1.2769);why=`sobrecarga: ${f1(fl.I[n.id])} A frente a un calibre de ${p.in} A (${Math.round(r*100)}%)`}}
    if(type==='earth'&&rcd&&leak>=0.5*p.ma/1000){t=p.ma>=300?0.15:0.03;why=`fuga a tierra de ${Math.round(leak*1000)} mA ≥ ½ de la sensibilidad (${p.ma} mA)`}
    if(t<Infinity)cands.push({n,idx,t,why,fail,p})});
  const ev=[],notes=[];cands.sort((a,b)=>a.t-b.t||a.idx-b.idx);const first=cands[0];
  const nearest=chain.find(n=>{const p=C.a.info[n.id].p;return type==='earth'?(['rcd','rcbo'].includes(p.kind)&&p.ma):(OL.includes(p.kind)&&(C.a.info[n.id].setIn||p.in)>0)});
  if(!first){notes.push(type==='earth'?'No hay ningún diferencial aguas arriba: la fuga NO se corta. Riesgo de electrocución o incendio.':'Ninguna protección detecta este fallo con los aparatos actuales: la corriente se mantiene.');ev.push({time:1,type:'none'})}
  else if(type==='short'&&first.fail){ev.push({time:first.t,type:'destroy',id:first.n.id,msg:`«${nameOf(first.n)}» NO tiene poder de corte suficiente (${first.p.icu} kA < ${f1(Ik/1000)} kA): el aparato se destruye.`});
    const up=cands.find(c=>c.idx>first.idx);
    if(up)ev.push({time:first.t+0.15,type:'trip',id:up.n.id,msg:`Dispara «${nameOf(up.n)}» (respaldo): ${up.why}.`,why:up.why});
    else notes.push('Ninguna protección aguas arriba despeja el fallo: riesgo de incendio.')}
  else ev.push({time:first.t,type:'trip',id:first.n.id,msg:`Dispara «${nameOf(first.n)}» tras ${first.t<0.1?'<0,1':f1(first.t)} s: ${first.why}.`,why:first.why});
  const trip=ev.find(e=>e.type==='trip'),tripT=trip?trip.time:Infinity;
  if(trip&&nearest&&trip.id!==nearest.id)notes.push(`Falta selectividad: disparó «${nameOf(C.nodes.find(n=>n.id===trip.id))}» (aguas arriba) y no «${nameOf(nearest)}». Se queda sin servicio todo lo que cuelga de él.`);
  if(type==='over'){let bn=null;chain.forEach(n=>{const i=C.a.info[n.id];if(!i.amp)return;const I=fl.I[n.id],r=I/i.amp;if(r>1.05){const ad=Math.pow(143*(i.sec||2.5)/I,2),tb=r<=4?Math.min(ad,40/(r*r-1)):ad;if(tb<tripT&&(!bn||tb<bn.time))bn={time:tb,type:'burn',id:n.id,msg:`El cable de «${nameOf(n)}» (${i.cl} mm², admite ${i.amp} A) soporta ${f1(I)} A: se calienta y se quema antes de que dispare la protección.`}}});if(bn)ev.push(bn)}
  ev.sort((a,b)=>a.time-b.time);return{events:ev,notes}}
function startFault(type,leak,mult,opt){
  const C=M.C,S=M.sim,id=M.ui.sel?C.by[M.ui.sel].n.id:null;if(!id){alert('Selecciona primero el circuito donde quieres provocar el fallo (clic en un aparato o receptor).');return}
  clearFault(true);const fl=flow(S.delta,true);
  S.fault={id,type,t0:S.t,done:false,mk:null,opt:opt||null,params:{leak,mult,opt}};const n=C.nodes.find(x=>x.id===id),it=C.by[id+'#0'];
  const nm=opt&&opt.rotor?'Rotor bloqueado':opt&&opt.phase?'Falta de una fase':{short:'Cortocircuito',over:`Sobrecarga ${Math.round(mult*100)}%`,earth:`Fuga a tierra ${Math.round(leak*1000)} mA`}[type];
  S.fault.nm=nm;
  if(!fl.live[id]){say(`${nm} en «${nameOf(n)}»: el circuito está sin tensión, no pasa nada.`);S.fault=null;banner('El circuito está sin tensión (aparato aguas arriba abierto o sin alimentación).','');return}
  S.fault.plan=planFault(type,leak,mult,opt);placeFaultMarker();
  say(`Fallo inyectado: ${nm} en «${nameOf(n)}» (${locOf(C,it)}).`);banner(`FALLO: ${nm} en «${nameOf(n)}» — ${locOf(C,it)}`,'');
  S.fault.plan.notes.forEach(t=>say('⚠ '+t,'err'));
  if(!S.fault.plan.events.some(e=>e.type!=='none'))banner(`FALLO: ${nm} en «${nameOf(n)}» — ${locOf(C,it)}<br>${S.fault.plan.notes.join(' ')}`,'err');
  panels()}
function clearFault(silent){const S=M.sim,R=M.R;if(S.fault&&S.fault.mk&&R)R.root.remove(S.fault.mk);if(S.fault&&!silent)say('Fallo eliminado.');S.fault=null;S.delta={};if(!silent)banner('','')}
M.fault=(t,leak,mult,opt)=>startFault(t,leak,mult,opt);M.clearFault=()=>{clearFault();panels()};
M.supply=()=>{M.sim.on=!M.sim.on;say('Alimentación '+(M.sim.on?'conectada.':'desconectada.'));panels()};
M.speed=v=>{M.sim.speed=num(v,5)};
M.rearm=()=>{const S=M.sim;Object.values(S.st).forEach(s=>{s.trip=null;s.closed=true;s.destroyed=false});S.burn={};say('Todas las protecciones rearmadas y aparatos repuestos.');if(S.fault)replan();panels()};
M.resetAll=()=>{const keep=M.ui.sel;clearFault(true);initSim();M.ui.sel=keep;banner('','');rebuild();panels()};
function replan(){const S=M.sim,f=S.fault;if(!f)return;f.t0=S.t;f.plan=planFault(f.type,f.params.leak,f.params.mult,f.params.opt)}
function stepSim(dt){const S=M.sim;if(!S)return;S.t+=dt*S.speed;const f=S.fault;if(!f||!f.plan)return;const el=S.t-f.t0;
  f.plan.events.forEach(e=>{if(e.done||el<e.time)return;e.done=true;
    if(e.type==='destroy'){S.st[e.id].destroyed=true;say('💥 '+e.msg,'err');banner(e.msg,'err')}
    else if(e.type==='trip'){S.st[e.id].trip=e.why;say('🔴 '+e.msg,'err');const C=M.C,n=C.nodes.find(x=>x.id===e.id),F=C.nodes.find(x=>x.id===f.id);
      const sel=f.plan.notes.length?'<br>⚠ '+f.plan.notes[0]:'<br>✔ Disparo selectivo: actuó la protección más cercana al fallo.';
      banner(`${e.msg}<br>Fallo en «${nameOf(F)}». Disparó «${nameOf(n)}» (${locOf(C,C.by[n.id+'#0'])}).${sel}`,f.plan.notes.length?'err':'ok');S.delta={}}
    else if(e.type==='burn'){S.burn[e.id]=true;say('🔥 '+e.msg,'err');banner(e.msg,'err')}
    else if(e.type==='none'){say('⚠ '+f.plan.notes.join(' '),'err');banner(f.plan.notes.join(' '),'err')}})}

// ---------- paneles HTML ----------
function updHint(){const h=$q('m-hint');if(!h)return;const u=M.ui;
  h.textContent=M.view==='instalacion'?'Vista de la instalación: motores, lámparas y cargas se activan al haber tensión. Toca un receptor para seleccionarlo y provocar fallos.':
    M.mode==='build'?(u.carry?'Toca un hueco del carril para colocar «'+nameOf(M.C.by[u.carry].n)+'» (Esc cancela)':'Elige un aparato de la lista y toca el carril. Arrastra para girar · rueda/pellizco para zoom'):'Toca un aparato para conectar/desconectar (o rearmar). Selecciona un circuito y provoca un fallo.'}
function panels(){const L=$q('m-left'),Rg=$q('m-right');if(!L||!M.C)return;const C=M.C,u=M.ui;
  const placed=C.inst.filter(it=>C.layout[it.key]).length;
  const row=it=>`<tr style="cursor:pointer;${u.sel===it.key?'background:var(--pr2)':''}" onclick="M3D.pick('${it.key}')"><td>${it.ord||''}</td><td>${esc(nameOf(it.n))}${it.n.qty>1||it.q?' '+(it.q+1):''}<br><small class="muted">${esc(it.p.name)}</small></td><td>${it.p.in||(it.p.hi||'—')}</td><td>${it.i.cable&&it.i.cl?it.i.cl+' mm²':'—'}</td><td>${it.isLoad?'':C.layout[it.key]?'✔':'○'}</td></tr>`;
  L.innerHTML=`<h3>Orden de montaje (${placed}/${C.inst.length})</h3><p class="muted" style="font-size:12px;margin:0 0 6px">De cabecera a circuitos finales. Pulsa uno para colocarlo.</p>
  <table style="font-size:12.5px"><tr><th>#</th><th>Aparato</th><th>In</th><th>Cable</th><th></th></tr>${C.inst.map(row).join('')}</table>
  ${C.loads.length?`<h3 style="margin-top:12px">Receptores (${C.loads.length})</h3><table style="font-size:12.5px"><tr><th></th><th>Receptor</th><th>kW</th><th>Cable</th><th></th></tr>${C.loads.map(row).join('')}</table>`:''}`;
  if(!Rg)return;
  if(!C.b.root){Rg.innerHTML='<div class="card">El cuadro está vacío. Diseña primero la red en la pestaña «Diseño» o elige una plantilla.</div>';return}
  Rg.innerHTML=verdictBox(C)+(M.mode==='build'?buildPanel(C):demoPanel(C));updHint();
}
function verdictBox(C){const all=C.a.issues.concat(placeIssues(C)),e=all.filter(i=>i.lv==='err').length,w=all.filter(i=>i.lv==='warn').length;
  const lv=e?'err':w?'warn':'ok';return`<div class="chk ${lv}" style="font-weight:700;margin:0 0 10px;background:var(--card);padding:8px 10px">${lv==='ok'?'✔ INSTALACIÓN VÁLIDA':lv==='warn'?'⚠ VÁLIDA CON AVISOS ('+w+')':'✖ NO VÁLIDA · '+e+' fallo'+(e>1?'s':'')}</div>`}
function selInfo(C,it){const i=it.i,p=it.p,par=C.par[it.n.id];
  const mot=p.kind==='motor'?`<tr><td>Motor</td><td>${it.n.kw} kW · η ${it.n.eff||0.9} · cos φ ${it.n.pf} · Ia/In ${f1(i.iarr||0)} (máx. ${i.iarrLim===Infinity?'sin límite':f1(i.iarrLim||0)})</td></tr><tr><td>Arranque</td><td>${{dol:'Directo',yd:'Estrella-triángulo',soft:'Arrancador suave',vfd:'Variador'}[it.n.start||'dol']}</td></tr>`:'';
  return`<div class="card"><h3>${esc(nameOf(it.n))} <small class="muted">${it.ord?'#'+it.ord:''}</small></h3>
  <p style="margin:0 0 6px">${esc(p.name)}<br><small class="muted">${it.isLoad?esc(LTYPES[ltOf(it)]||'Receptor'):C.layout[it.key]?locOf(C,it):'sin montar'}</small></p>
  <table style="font-size:13px"><tr><td>Calibre</td><td><b>${p.in||p.hi?(p.in||p.hi)+' A':'—'}</b> · ${p.poles}P${p.ma?' · '+p.ma+' mA':''}${i.setIn?` · ajuste ${f1(i.setIn)} A`:''}</td></tr>
  ${p.icu?`<tr><td>Poder de corte</td><td>${p.icu} kA (Icc ${C.b.isc} kA)</td></tr>`:''}
  <tr><td>Intensidad de cálculo</td><td><b>${f1(i.ib)} A</b></td></tr>${mot}
  <tr><td>Alimentado desde</td><td>${par?esc(nameOf(par)):'Red / acometida'}</td></tr>
  <tr><td>Cable</td><td><b>${i.cable||'—'}</b> (admite ${i.amp||'—'} A)</td></tr>
  ${i.cable?`<tr><td>Conductores</td><td style="font-size:12px">${esc(condText(Object.assign({phase:phaseOf(C,it)},i)))}</td></tr>`:''}
  ${i.dv!=null?`<tr><td>Caída tensión</td><td>${f1(i.dv)}% (${it.n.len} m)</td></tr>`:''}</table></div>`}
function issuesBox(C){const all=C.a.issues.concat(placeIssues(C));
  return`<div class="card"><h3>Fallos y avisos</h3>${all.length?all.map(i=>`<div class="chk ${i.lv}" ${i.id?`style="cursor:pointer" onclick="M3D.pick('${i.id}#0')"`:''}>${esc(i.msg)}</div>`).join(''):'<div class="chk ok">Sin fallos. El montaje y el diseño son correctos.</div>'}</div>`}
function buildPanel(C){const u=M.ui,it=u.sel?C.by[u.sel]:null;
  return(it?selInfo(C,it)+`<div class="card"><div class="bar">${it.isLoad?'':`<button class="b s" onclick="M3D.move()">Mover</button><button class="b d" onclick="M3D.remove()">Quitar del carril</button>`}${u.carry?'<button class="b s" onclick="M3D.cancel()">Cancelar</button>':''}</div>
  ${it.i.cable?`<label>Sección de cable (mm²)</label><select onchange="M3D.setSec(this.value)" style="width:100%"><option value="">Automática (${it.i.cl||'—'} mm²)</option>${CABLES.map(c=>`<option value="${c[0]}" ${it.n.sec===c[0]?'selected':''}>${c[2]||c[0]} mm² (${c[1]} A)</option>`).join('')}</select><p class="muted" style="font-size:12px">Prueba una sección menor para ver cómo el sistema detecta el fallo.</p>`:''}</div>`:'<div class="card muted">Selecciona un aparato o receptor (lista o 3D) para ver su calibre, cable, colores y orden.</div>')+issuesBox(C)}
function demoPanel(C){const S=M.sim,it=M.ui.sel?C.by[M.ui.sel]:null,isM=it&&it.p.kind==='motor';
  return`<div class="card"><h3>Demostración</h3><div class="bar"><button class="b ${S.on?'':'d'}" onclick="M3D.supply()">Alimentación: ${S.on?'CONECTADA':'DESCONECTADA'}</button><button class="b s" onclick="M3D.rearm()">Rearmar todo</button><button class="b s" onclick="M3D.resetAll()">Reiniciar</button></div>
  <label>Velocidad de simulación</label><select onchange="M3D.speed(this.value)">${[1,5,20].map(v=>`<option value="${v}" ${S.speed===v?'selected':''}>×${v}</option>`).join('')}</select>
  <p class="muted" style="font-size:12px">LED verde = en servicio · naranja = >90% · rojo parpadeante = disparado. Los cables brillan y se mueven puntos cuando llevan corriente.</p></div>
  <div class="card"><h3>Provocar un fallo</h3><p style="margin:0 0 6px;font-size:13px">En: <b>${it?esc(nameOf(it.n)):'(selecciona un aparato o receptor)'}</b></p>
  <div class="bar"><button class="b d" onclick="M3D.fault('short',0,0)">Cortocircuito</button><button class="b" style="background:#e08a00" onclick="M3D.fault('over',0,1.3)">Sobrecarga 130%</button><button class="b" style="background:#e08a00" onclick="M3D.fault('over',0,2)">Sobrecarga 200%</button>
  <button class="b" style="background:#6a1b9a" onclick="M3D.fault('earth',0.1,0)">Fuga 100 mA</button><button class="b" style="background:#6a1b9a" onclick="M3D.fault('earth',0.5,0)">Fuga 500 mA</button>
  ${isM?`<button class="b" style="background:#bf360c" onclick="M3D.fault('over',0,0,{rotor:true})">Rotor bloqueado</button><button class="b" style="background:#bf360c" onclick="M3D.fault('over',0,0,{phase:true})">Falta de fase</button>`:''}
  <button class="b s" onclick="M3D.clearFault()">Quitar fallo</button></div></div>
  <div class="card" id="m-read"></div><div class="card"><h3>Registro</h3><div id="m-log" style="font-size:12.5px;max-height:200px;overflow:auto"></div></div>${issuesBox(C)}`}
function logUI(){const el=$q('m-log');if(!el||!M.sim)return;el.innerHTML=M.sim.log.length?M.sim.log.map(l=>`<div class="chk ${l.lv||'info'}">[${f1(l.t)} s] ${esc(l.txt)}</div>`).join(''):'<span class="muted">Sin eventos todavía.</span>'}
function reading(){const el=$q('m-read');if(!el||!M.sim||!M.sim.fl)return;const C=M.C,S=M.sim,it=M.ui.sel?C.by[M.ui.sel]:null;
  if(!it){el.innerHTML='<h3>Lectura</h3><span class="muted">Selecciona un aparato.</span>';logUI();return}
  const st=S.st[it.n.id],I=S.fl.I[it.n.id]||0,live=S.fl.live[it.n.id]&&S.on,ref=it.i.setIn||it.p.in;
  const estado=st.destroyed?'DESTRUIDO':st.trip?'DISPARADO ('+esc(st.trip)+')':!st.closed?'ABIERTO':live?(it.isLoad?'FUNCIONANDO':'EN SERVICIO'):'SIN TENSIÓN';
  el.innerHTML=`<h3>Lectura: ${esc(nameOf(it.n))}</h3><p style="margin:0">Estado: <b>${estado}</b></p><p style="margin:2px 0">Corriente: <b>${f1(I)} A</b>${ref?` (${Math.round(I/ref*100)}% de ${f1(ref)} A)`:''}</p><p style="margin:2px 0">Cable: <b>${it.i.cable||'—'}</b>${it.i.amp?` (admite ${it.i.amp} A)`:''}${S.burn[it.n.id]?' <b style="color:#c62828">QUEMADO</b>':''}</p>`;logUI()}

// ---------- interacción 3D ----------
function bindEvents(cv){
  const R=M.R,P={};let moved=0,last=null,pinch=0;
  const ndc=e=>{const r=cv.getBoundingClientRect();R.ptr.set(((e.clientX-r.left)/r.width)*2-1,-((e.clientY-r.top)/r.height)*2+1)};
  const slotAt=e=>{if(M.view!=='cuadro'||!R.plane)return null;ndc(e);R.ray.setFromCamera(R.ptr,R.camera);const h=R.ray.intersectObject(R.plane)[0];if(!h)return null;
    const C=M.C,key=M.ui.carry;if(!key)return null;const it=C.by[key],g=geo(C);
    const c=Math.max(0,Math.min(C.cols-it.p.mod,Math.round((h.point.x-g.x0)/MW-it.p.mod/2))),r=Math.max(0,Math.min(C.rows-1,Math.round((g.yTop-h.point.y)/RP)));
    return{r,c,ok:fits(C,key,r,c)}};
  const ghost=s=>{const gh=R.ghost,C=M.C;if(!gh)return;if(!s||!M.ui.carry){gh.visible=false;return}const it=C.by[M.ui.carry],g=geo(C);
    gh.visible=true;gh.scale.x=it.p.mod*MW-0.14;gh.position.set(g.x0+(s.c+it.p.mod/2)*MW,g.yTop-s.r*RP,Z0+DD/2);gh.material.color.setHex(s.ok?0x2e7d32:0xc62828)};
  const place=e=>{const s=slotAt(e);if(!s)return false;if(!s.ok){const h=$q('m-hint');if(h)h.textContent='Ahí no cabe o está ocupado.';return true}
    M.C.layout[M.ui.carry]={r:s.r,c:s.c};save();M.ui.sel=M.ui.carry;M.ui.carry=null;rebuild();panels();return true};
  const pickDev=e=>{ndc(e);R.ray.setFromCamera(R.ptr,R.camera);const h=R.ray.intersectObjects(Object.values(R.devs),true)[0];return h&&h.object.userData.dev?h.object.userData.dev.userData.key:null};
  cv.addEventListener('pointerdown',e=>{cv.setPointerCapture(e.pointerId);P[e.pointerId]={x:e.clientX,y:e.clientY};moved=0;last={x:e.clientX,y:e.clientY};if(Object.keys(P).length===2){const a=Object.values(P);pinch=Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y)}});
  cv.addEventListener('pointermove',e=>{
    if(!P[e.pointerId]){if(M.ui.carry)ghost(slotAt(e));return}
    P[e.pointerId]={x:e.clientX,y:e.clientY};const n=Object.keys(P).length,c=R.cam;
    if(n===2){const a=Object.values(P),d=Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y);c.r=Math.max(30,Math.min(2000,c.r*pinch/d));pinch=d;moved=99;return}
    const dx=e.clientX-last.x,dy=e.clientY-last.y;moved+=Math.abs(dx)+Math.abs(dy);last={x:e.clientX,y:e.clientY};
    if(moved>6){if(e.shiftKey||e.buttons===2){c.t.x-=dx*c.r*0.0016;c.t.y+=dy*c.r*0.0016}else{c.th-=dx*0.006;c.ph=Math.max(0.25,Math.min(2.2,c.ph-dy*0.006))}}
    else if(M.ui.carry)ghost(slotAt(e))});
  cv.addEventListener('pointerup',e=>{const wasMoved=moved>6;delete P[e.pointerId];if(wasMoved)return;
    if(M.mode==='build'){if(M.ui.carry){if(place(e))return}const k=pickDev(e);if(k&&M.C.by[k]){M.ui.sel=k;M.ui.carry=null}else if(!M.ui.carry)M.ui.sel=null;panels();return}
    const k=pickDev(e);if(!k||!M.C.by[k])return;M.ui.sel=k;const it=M.C.by[k];
    if(!it.isLoad){const st=M.sim.st[it.n.id];
      if(st.destroyed){say('«'+nameOf(it.n)+'» está destruido: usa «Rearmar todo» para reponerlo.')}
      else if(st.trip){st.trip=null;st.closed=true;say('Rearmado «'+nameOf(it.n)+'».');if(M.sim.fault)replan()}
      else{st.closed=!st.closed;say(`«${nameOf(it.n)}» ${st.closed?'conectado':'desconectado'}.`);if(M.sim.fault&&st.closed)replan()}}
    panels()});
  cv.addEventListener('pointercancel',e=>{delete P[e.pointerId]});
  cv.addEventListener('wheel',e=>{e.preventDefault();R.cam.r=Math.max(30,Math.min(2000,R.cam.r*(1+Math.sign(e.deltaY)*0.1)))},{passive:false});
  cv.addEventListener('contextmenu',e=>e.preventDefault());
  cv.addEventListener('dragover',e=>{e.preventDefault();ghost(slotAt(e))});
  cv.addEventListener('drop',e=>{e.preventDefault();place(e)});
  document.addEventListener('keydown',function esc_(e){if(!M.R||!M.R.alive){document.removeEventListener('keydown',esc_);return}if(e.key==='Escape')M.cancel()});
}
})();

import * as THREE from 'three';
import { START_NG, getCurrentUser, onUserChange, signIn } from './platform.js';
import { DEFAULT_STYLE, normalizeStyle, playerKey, profileFor, recordRun, leaderboardFor } from './player.js';
import { HEROES,WAVES,withinSlash,clampArena,angleDelta,applyBlessing,waveScale,stored,save } from './rules.js';
const $=id=>document.getElementById(id), game=$('game');
let storage;try{storage=localStorage;}catch{storage=null;}
let selected=stored(storage,'relic-hero','fern');if(!HEROES[selected])selected='fern';
let currentUser=null, activeRunPlayer=null, identityReady=false, identityUnavailable=false;
let mode='menu',wave=0,kills=0,relics=0,elapsed=0,phaseTime=0,clock=0,last=0,spawnQueue=[],spawnTimer=0;
let stats,attackCooldown=0,dodgeCooldown=0,dodgeTime=0,invulnerable=0,attackVisual=0,shake=0,transitionTime=0,toastUntil=0;
let facing=0,aimTime=-100,mouseAim=null,attackHeld=false,audio,sound=false,guideWasRunning=false;
let dodgeVector=new THREE.Vector2(),moveVector=new THREE.Vector2();const keys=new Set(),touchDirs=new Set();
const enemies=[],projectiles=[],effects=[],pickups=[];
const scene=new THREE.Scene();scene.background=new THREE.Color('#cbd6bb');scene.fog=new THREE.Fog('#cbd6bb',38,100);
let renderer;try{renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});renderer.setPixelRatio(Math.min(devicePixelRatio,1.75));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.2;$('world').append(renderer.domElement);}catch{$('loading').hidden=true;$('error').hidden=false;throw Error('WebGL unavailable');}
const camera=new THREE.OrthographicCamera(-20,20,15,-15,.1,150);camera.position.set(24,29,31);
scene.add(new THREE.HemisphereLight('#fff1d2','#526f4d',2.5));
const sunlight=new THREE.DirectionalLight('#ffe5b1',3.2);sunlight.position.set(-18,32,15);sunlight.castShadow=true;sunlight.shadow.mapSize.set(2048,2048);Object.assign(sunlight.shadow.camera,{left:-24,right:24,top:24,bottom:-24,far:90});sunlight.shadow.normalBias=.04;scene.add(sunlight);
const fill=new THREE.DirectionalLight('#b9dfd1',1.2);fill.position.set(15,12,-15);scene.add(fill);
const materials=new Map(),boxGeometry=new THREE.BoxGeometry(1,1,1),cylinderGeometry=new THREE.CylinderGeometry(1,1,1,12),rockGeometry=new THREE.IcosahedronGeometry(1,0),sphereGeometry=new THREE.SphereGeometry(1,12,8);
function material(color){if(!materials.has(color))materials.set(color,new THREE.MeshStandardMaterial({color,roughness:.92,flatShading:true}));return materials.get(color);}
function mesh(parent,geometry,color,x,y,z,sx=1,sy=1,sz=1){const m=new THREE.Mesh(geometry,typeof color==='string'?material(color):color);m.position.set(x,y,z);m.scale.set(sx,sy,sz);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
function box(parent,color,x,y,z,sx,sy,sz){return mesh(parent,boxGeometry,color,x,y,z,sx,sy,sz);}
let seed=818;function rand(){seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;}
const island=new THREE.Group();scene.add(island);
mesh(island,new THREE.CylinderGeometry(15.6,13.4,3.6,12),'#8b9d7a',0,-2.2,0);
mesh(island,new THREE.CylinderGeometry(14.9,15.6,.55,12),'#b2bb94',0,-.48,0);
mesh(island,new THREE.CylinderGeometry(14.7,14.7,.35,48),'#b8c29a',0,-.08,0);
// Hand-laid stone tiles are instanced: hundreds of tiles, one draw call.
const tiles=[];for(let x=-13;x<=13;x+=1.6)for(let z=-13;z<=13;z+=1.6)if(Math.hypot(x,z)<13.6)tiles.push([x,z]);
const tileMesh=new THREE.InstancedMesh(boxGeometry,material('#c0c7a4'),tiles.length),dummy=new THREE.Object3D();
tiles.forEach(([x,z],i)=>{dummy.position.set(x,.13+(rand()-.5)*.035,z);dummy.scale.set(1.54,.13,1.54);dummy.rotation.y=(rand()-.5)*.025;dummy.updateMatrix();tileMesh.setMatrixAt(i,dummy.matrix);});tileMesh.receiveShadow=true;island.add(tileMesh);
const circle=new THREE.Mesh(new THREE.RingGeometry(12.8,12.87,96),material('#d0c58e'));circle.rotation.x=-Math.PI/2;circle.position.y=.23;island.add(circle);
const dais=mesh(island,new THREE.CylinderGeometry(2.4,2.7,.35,8),'#aaaF8e',0,.24,0);dais.rotation.y=Math.PI/8;
mesh(island,new THREE.CylinderGeometry(2.1,2.3,.12,8),'#c9c9a3',0,.48,0);
const runeMat=new THREE.MeshStandardMaterial({color:'#e6cb78',emissive:'#d0a450',emissiveIntensity:.8,roughness:.5});
const runeRing=new THREE.Mesh(new THREE.TorusGeometry(1.67,.035,5,64),runeMat);runeRing.rotation.x=Math.PI/2;runeRing.position.y=.56;scene.add(runeRing);
for(let i=0;i<8;i++){const a=i*Math.PI/4;const rune=box(island,runeMat,Math.sin(a)*1.7,.58,Math.cos(a)*1.7,.13,.025,.35);rune.rotation.y=a;}
function grass(parent,x,z,scale=1){for(let i=0;i<3;i++){const blade=mesh(parent,new THREE.ConeGeometry(.12*scale,.65*scale,3),i%2?'#7e945c':'#8a9e63',x+(i-1)*.18*scale,.4*scale,z+(i%2)*.15);blade.rotation.z=(i-1)*.3;}}
const grassGeo=new THREE.ConeGeometry(.13,.7,3),grassSpecs=[];
for(let i=0;i<240;i++){const a=rand()*Math.PI*2,r=12+rand()*3.2;grassSpecs.push([Math.sin(a)*r,Math.cos(a)*r,rand()]);}
const grassMesh=new THREE.InstancedMesh(grassGeo,material('#85995f'),grassSpecs.length);grassSpecs.forEach(([x,z,s],i)=>{dummy.position.set(x,.35,z);dummy.scale.setScalar(.6+s);dummy.rotation.set(0,s*7,(s-.5)*.4);dummy.updateMatrix();grassMesh.setMatrixAt(i,dummy.matrix);});island.add(grassMesh);
function pillar(x,z,height=5,broken=false){const g=new THREE.Group();g.position.set(x,0,z);island.add(g);box(g,'#a3af8a',0,.3,0,1.9,.6,1.9);box(g,'#c4c8a1',0,.7,0,1.5,.25,1.5);mesh(g,cylinderGeometry,'#b7bd98',0,height/2+.7,0,.62,height,.62);box(g,'#c9cba5',0,height+.75,0,1.65,.35,1.65);box(g,'#8c9c72',.2,height+1,0,1.35,.18,1.3);for(let j=1.5;j<height;j+=1.2)box(g,'#8e9e7b',.63,j,0,.025,.07,.6);if(broken){g.rotation.z=.12;mesh(g,rockGeometry,'#bbc19b',1.1,.6,1.2,.7,.6,.8);}return g;}
// A ruined gate frames the sanctuary without hiding the combat area.
pillar(-4,-11,5.9);pillar(4,-11,5.9);box(island,'#b9c19b',0,6.6,-11,9.8,.7,1.5);box(island,'#8da078',-1,7.05,-11,4,.25,1.6);box(island,'#c7caa3',0,7.1,-11,1.8,.65,1.9);
const gateGem=mesh(island,new THREE.OctahedronGeometry(.58,0),runeMat,0,7.18,-10.12,.6,1,.4);
pillar(-11,0,3.7,true);pillar(11,-1,3.2,true);pillar(-8,10,1.4,true);pillar(9,9,2.2,true);
function tree(x,z,s=1){const g=new THREE.Group();g.position.set(x,0,z);g.scale.setScalar(s);scene.add(g);mesh(g,cylinderGeometry,'#7e8160',0,1.8,0,.25,3.6,.25);for(let i=0;i<3;i++){const m=mesh(g,new THREE.ConeGeometry(1.7-i*.2,2.6,6),['#71865e','#7e9467','#91a575'][i],0,3+i*1.1,0);m.rotation.y=i*.5;}return g;}
for(let i=0;i<18;i++){const a=i*Math.PI*2/18,r=18+rand()*6;tree(Math.sin(a)*r,Math.cos(a)*r,.65+rand()*.75);}
for(let i=0;i<35;i++){const a=rand()*6.28,r=14+rand()*9;mesh(scene,rockGeometry,rand()>.5?'#a8b58f':'#8d9f7b',Math.sin(a)*r,-.3-rand()*2,Math.cos(a)*r,.5+rand()*1.2,.5+rand()*1.6,.5+rand());}
const mistPlane=new THREE.Mesh(new THREE.PlaneGeometry(300,300),material('#c3cfaf'));mistPlane.rotation.x=-Math.PI/2;mistPlane.position.y=-5;mistPlane.receiveShadow=true;scene.add(mistPlane);
// Drifting motes give the sanctuary life without external assets.
const motePositions=new Float32Array(80*3);for(let i=0;i<80;i++){motePositions[i*3]=(rand()-.5)*36;motePositions[i*3+1]=.8+rand()*7;motePositions[i*3+2]=(rand()-.5)*36;}
const motesGeometry=new THREE.BufferGeometry();motesGeometry.setAttribute('position',new THREE.BufferAttribute(motePositions,3));const motes=new THREE.Points(motesGeometry,new THREE.PointsMaterial({color:'#f1da8c',size:.08,transparent:true,opacity:.7}));scene.add(motes);
const relic=new THREE.Group();scene.add(relic);const crystal=mesh(relic,new THREE.OctahedronGeometry(.75,0),runeMat,0,1.8,0,.75,1.4,.75);const relicLight=new THREE.PointLight('#f9d781',3,9);relicLight.position.y=2;relic.add(relicLight);
const relicHalo=new THREE.Mesh(new THREE.TorusGeometry(1.1,.022,5,40),runeMat);relicHalo.position.y=1.8;relicHalo.rotation.x=.5;relic.add(relicHalo);
const relicBeam=new THREE.Mesh(new THREE.CylinderGeometry(.7,1.7,5,24,1,true),new THREE.MeshBasicMaterial({color:'#ffe4a0',transparent:true,opacity:.09,side:THREE.DoubleSide,depthWrite:false}));relicBeam.position.y=2.7;relic.add(relicBeam);
function createHero(color){
 const root=new THREE.Group(),body=new THREE.Group();root.add(body);
 const cloak=new THREE.MeshStandardMaterial({color,roughness:.9,flatShading:true});
 const secondary=new THREE.MeshStandardMaterial({color:DEFAULT_STYLE.secondaryColor,roughness:.9,flatShading:true}),skin=new THREE.MeshStandardMaterial({color:DEFAULT_STYLE.skinColor,roughness:.9,flatShading:true});
 box(body,secondary,-.25,.44,0,.37,.7,.42);box(body,secondary,.25,.44,0,.37,.7,.42);
 const legs=[];for(const side of [-1,1]){const leg=new THREE.Group();leg.position.set(side*.25,.87,0);body.add(leg);box(leg,secondary,0,-.25,0,.34,.6,.4);box(leg,'#66513c',0,-.68,.14,.39,.3,.65);box(leg,'#d1bb86',0,-.63,.16,.4,.08,.66);legs.push(leg);}
 box(body,cloak,0,1.35,0,.98,1.02,.65);box(body,'#c4a36c',0,.96,.02,1.04,.13,.71);box(body,'#e0cb8d',0,1,.4,.18,.18,.06);
 const cape=box(body,cloak,0,1.07,-.47,1.06,1.6,.12);cape.rotation.x=-.17;
 box(body,skin,0,1.82,0,.42,.25,.4);
 mesh(body,sphereGeometry,secondary,0,2.2,-.08,.55,.59,.5);
 box(body,skin,0,2.18,.28,.65,.61,.36);box(body,secondary,0,2.5,.22,.87,.19,.6);
 box(body,'#3c4936',-.17,2.22,.48,.09,.1,.04);box(body,'#3c4936',.17,2.22,.48,.09,.1,.04);
 box(body,'#efd69e',0,2.02,.49,.2,.045,.035);
 const arms=[];for(const side of [-1,1]){const arm=new THREE.Group();arm.position.set(side*.62,1.72,0);body.add(arm);mesh(arm,sphereGeometry,cloak,0,-.12,0,.25,.26,.25);box(arm,cloak,0,-.4,0,.29,.55,.31);box(arm,skin,0,-.7,0,.26,.25,.3);arms.push(arm);}
 const sword=new THREE.Group();arms[1].add(sword);sword.position.set(0,-.67,.18);sword.rotation.x=1.1;
 box(sword,'#65543b',0,.15,0,.12,.4,.12);box(sword,'#bd9d5e',0,.37,0,.58,.1,.16);box(sword,'#dde0c5',0,1.05,0,.19,1.28,.09);mesh(sword,new THREE.ConeGeometry(.135,.3,4),'#f2edce',0,1.8,0);box(sword,'#e4c475',0,.52,.055,.09,.25,.035);
 const shield=mesh(arms[0],new THREE.CylinderGeometry(.43,.43,.12,6),'#ab9967',-.15,-.45,.12);shield.rotation.x=Math.PI/2;box(arms[0],cloak,-.15,-.45,.21,.36,.43,.06);
 root.traverse(o=>{if(o.isMesh)o.castShadow=true;});
 const hats={},accessories={};
 for(const name of ['none','cap','beanie','tophat','crown']){hats[name]=new THREE.Group();body.add(hats[name]);}
 mesh(hats.cap,sphereGeometry,cloak,0,2.57,-.04,.57,.3,.53);box(hats.cap,cloak,0,2.58,.52,.9,.1,.55);
 mesh(hats.beanie,sphereGeometry,secondary,0,2.6,-.04,.58,.4,.54);box(hats.beanie,cloak,0,2.45,.06,1.08,.15,.95);mesh(hats.beanie,sphereGeometry,cloak,0,3.01,-.04,.13,.13,.13);
 mesh(hats.tophat,cylinderGeometry,secondary,0,2.51,-.02,.72,.1,.65);mesh(hats.tophat,cylinderGeometry,secondary,0,2.94,-.02,.45,.82,.43);mesh(hats.tophat,cylinderGeometry,cloak,0,2.67,-.02,.46,.18,.44);
 mesh(hats.crown,cylinderGeometry,'#d9b65c',0,2.59,-.02,.57,.25,.51);
 for(let i=0;i<7;i++){const a=i*Math.PI*2/7;mesh(hats.crown,new THREE.ConeGeometry(.14,.43,4),'#e1c576',Math.sin(a)*.51,2.91,Math.cos(a)*.46-.02);}
 for(const name of ['none','glasses','scarf','backpack']){accessories[name]=new THREE.Group();body.add(accessories[name]);}
 for(const x of [-.2,.2]){box(accessories.glasses,secondary,x,2.23,.51,.33,.22,.06);box(accessories.glasses,'#93b3a0',x,2.23,.55,.23,.12,.025);}box(accessories.glasses,secondary,0,2.23,.55,.12,.045,.045);
 const collar=mesh(accessories.scarf,new THREE.TorusGeometry(.34,.12,6,16),secondary,0,1.84,0);collar.rotation.x=Math.PI/2;box(accessories.scarf,secondary,.25,1.51,.43,.26,.7,.1);
 box(accessories.backpack,secondary,0,1.31,-.75,.92,1.1,.48);box(accessories.backpack,cloak,0,1.12,-1.02,.7,.4,.12);box(accessories.backpack,'#cbb17d',0,1.48,-1.02,.16,.25,.06);
 return {root,body,legs,arms,cape,cloak,secondary,skin,sword,hats,accessories};
}
const hero=createHero(HEROES[selected].color);scene.add(hero.root);hero.root.position.set(5,0,4);hero.root.scale.setScalar(1.65);hero.root.rotation.y=.35;
function applyPlayerStyle() {
 const look=normalizeStyle(currentUser?.style);
 hero.cloak.color.set(look.primaryColor);hero.secondary.color.set(look.secondaryColor);hero.skin.color.set(look.skinColor);
 for(const [name,group] of Object.entries(hero.hats))group.visible=name===look.hat;
 for(const [name,group] of Object.entries(hero.accessories))group.visible=name===look.accessory;
 game.dataset.player=playerKey(currentUser);game.dataset.hat=look.hat;game.dataset.accessory=look.accessory;
}
applyPlayerStyle();
const shadowMaterial=new THREE.MeshBasicMaterial({color:'#294b2d',transparent:true,opacity:.16,depthWrite:false});
const playerShadow=new THREE.Mesh(new THREE.CircleGeometry(.85,24),shadowMaterial);playerShadow.rotation.x=-Math.PI/2;playerShadow.position.y=.25;scene.add(playerShadow);
const hornGeometry=new THREE.ConeGeometry(.17,.65,5),hoodGeometry=new THREE.ConeGeometry(.66,1,6),bossCrystalGeometry=new THREE.OctahedronGeometry(.35,0);
const enemyBarGeometry=new THREE.PlaneGeometry(1.2,.085),barBackground=new THREE.MeshBasicMaterial({color:'#556648',transparent:true,opacity:.45}),barForeground=new THREE.MeshBasicMaterial({color:'#ab7050'});
const monsterColors={moss:'#788d52',wraith:'#8e8ba0',brute:'#9c8760',boss:'#8b8f79'};
function makeEnemy(kind,x,z,decorative=false){
 const root=new THREE.Group();root.position.set(x,.22,z);scene.add(root);const body=new THREE.Group();root.add(body);const col=monsterColors[kind],large=kind==='boss'?2.55:kind==='brute'?1.45:1;
 const size=kind==='boss'?2:kind==='brute'?1.1:.65;
 const legs=[];for(const side of [-1,1]){const leg=new THREE.Group();leg.position.set(side*.3,.8,0);body.add(leg);box(leg,'#596347',0,-.3,0,.4,.6,.45);box(leg,'#68734f',0,-.66,.15,.49,.28,.65);legs.push(leg);}
 box(body,col,0,1.18,0,1.05,.95,.72);mesh(body,rockGeometry,col,0,2.0,0,.69,.65,.6);
 if(kind==='wraith'){mesh(body,hoodGeometry,col,0,2.6,-.1);box(body,'#c6afcf',0,1.25,.39,.33,.5,.06);}else{
 for(const side of [-1,1]){const horn=mesh(body,hornGeometry,'#b7ba86',side*.51,2.55,0);horn.rotation.z=side*-.4;}
 }
 const eyeColor=kind==='boss'?'#ffd688':kind==='wraith'?'#f1d1fa':'#efdf95';
 const eyeMat=new THREE.MeshStandardMaterial({color:eyeColor,emissive:eyeColor,emissiveIntensity:.7});
 box(body,eyeMat,-.25,2.08,.53,.19,.1,.07);box(body,eyeMat,.25,2.08,.53,.19,.1,.07);box(body,'#4b5b3d',0,1.84,.55,.35,.09,.06);
 const arms=[];for(const side of [-1,1]){const arm=new THREE.Group();arm.position.set(side*.72,1.5,0);body.add(arm);mesh(arm,rockGeometry,col,0,-.1,0,.35,.4,.35);box(arm,col,0,-.5,0,.35,.6,.36);mesh(arm,rockGeometry,'#67724d',0,-.88,.1,.28,.28,.3);arms.push(arm);}
 if(kind==='boss'){const chest=mesh(body,bossCrystalGeometry,runeMat,0,1.35,.52,.8,1.2,.6);box(body,'#b7b58f',0,2.48,-.08,1.16,.2,.8);for(let j=-1;j<=1;j++)box(body,'#bca976',j*.35,2.74,-.08,.18,.4,.3);}
 root.scale.setScalar(large);const maxHp=decorative?1:(kind==='boss'?650:kind==='brute'?105:kind==='wraith'?52:45)*waveScale(wave);
 const healthBar=new THREE.Group();healthBar.position.y=3.35;root.add(healthBar);const healthBg=new THREE.Mesh(enemyBarGeometry,barBackground);healthBar.add(healthBg);const healthFill=new THREE.Mesh(enemyBarGeometry,barForeground);healthFill.position.z=.01;healthBar.add(healthFill);healthBar.visible=!decorative&&kind!=='boss';
 const warning=new THREE.Mesh(new THREE.RingGeometry(.78,1,48),new THREE.MeshBasicMaterial({color:'#cd704a',transparent:true,opacity:0,depthWrite:false,side:THREE.DoubleSide}));warning.rotation.x=-Math.PI/2;warning.position.y=.26;scene.add(warning);
 const e={kind,root,body,legs,arms,warning,healthBar,healthFill,hp:maxHp,maxHp,size,angle:0,speed:kind==='boss'?1.65:kind==='brute'?1.7:kind==='wraith'?2.3:2.7,cooldown:1.5+rand(),windup:0,attackType:'',attackPoint:new THREE.Vector2(),hitFlash:0,knock:new THREE.Vector2(),age:0,decorative};
 return e;
}
const menuMonsters=[makeEnemy('moss',9,-2,true),makeEnemy('wraith',-2,-6,true)];menuMonsters.forEach((e,i)=>{e.root.rotation.y=i?1.8:-1;e.warning.visible=false;});
const slashShape=new THREE.Shape();const r1=3.2,r2=2.65;for(let i=0;i<=28;i++){const a=-1.3+i/28*2.6;const x=Math.sin(a)*r1,z=-Math.cos(a)*r1;if(i===0)slashShape.moveTo(x,z);else slashShape.lineTo(x,z);}for(let i=28;i>=0;i--){const a=-1.3+i/28*2.6;slashShape.lineTo(Math.sin(a)*r2,-Math.cos(a)*r2);}slashShape.closePath();
const slash=new THREE.Mesh(new THREE.ShapeGeometry(slashShape),new THREE.MeshBasicMaterial({color:'#f8e5a4',transparent:true,opacity:0,side:THREE.DoubleSide,depthWrite:false}));slash.rotation.x=-Math.PI/2;const slashGroup=new THREE.Group();slashGroup.add(slash);scene.add(slashGroup);
const particleGeometry=new THREE.IcosahedronGeometry(.1,0),goldParticleMat=new THREE.MeshBasicMaterial({color:'#f8d889'}),hitParticleMat=new THREE.MeshBasicMaterial({color:'#d9e6a0'});
function burst(x,y,z,color=goldParticleMat,count=12){for(let i=0;i<count;i++){const m=new THREE.Mesh(particleGeometry,color);m.position.set(x,y,z);scene.add(m);effects.push({mesh:m,v:new THREE.Vector3((Math.random()-.5)*5,2+Math.random()*4,(Math.random()-.5)*5),life:.7,max:.7});}}
function tone(frequency,duration=.12,type='sine',volume=.035){if(!sound)return;try{audio??=new(window.AudioContext||window.webkitAudioContext)();if(audio.state==='suspended')audio.resume();const osc=audio.createOscillator(),gain=audio.createGain();osc.type=type;osc.frequency.setValueAtTime(frequency,audio.currentTime);osc.frequency.exponentialRampToValueAtTime(frequency*.5,audio.currentTime+duration);gain.gain.setValueAtTime(volume,audio.currentTime);gain.gain.exponentialRampToValueAtTime(.001,audio.currentTime+duration);osc.connect(gain);gain.connect(audio.destination);osc.start();osc.stop(audio.currentTime+duration);}catch{/* Audio is optional. */}}
function toast(message,seconds=2.6){$('toast').textContent=message;$('toast').hidden=false;toastUntil=clock+seconds;}
function setMode(next){mode=next;game.dataset.mode=next;const menu=next==='menu';['intro','chapter-card','scene-label'].forEach(id=>$(id).hidden=!menu);$('top-hud').hidden=menu;$('bottom-hud').hidden=menu;$('mobile-controls').hidden=next!=='playing';$('overlay').hidden=!['paused','over','won','upgrade'].includes(next);$('upgrade-panel').hidden=next!=='upgrade';$('result-panel').hidden=next==='upgrade';menuMonsters.forEach(e=>e.root.visible=menu);$('boss-hud').hidden=menu||wave!==4||!enemies.some(e=>e.kind==='boss');if(next!=='playing'){keys.clear();touchDirs.clear();attackHeld=false;}}
function disposeEnemy(e){scene.remove(e.root);scene.remove(e.warning);e.warning.geometry.dispose();e.warning.material.dispose();}
function clearRun(){for(const e of enemies)disposeEnemy(e);enemies.length=0;for(const p of projectiles){scene.remove(p.mesh);if(p.ring){scene.remove(p.ring);p.ring.geometry.dispose();p.ring.material.dispose();}}projectiles.length=0;for(const p of effects)scene.remove(p.mesh);effects.length=0;for(const p of pickups)scene.remove(p.mesh);pickups.length=0;}
function reset(){clearRun();const h=HEROES[selected];stats={maxHp:h.maxHp,hp:h.maxHp,damage:h.damage,speed:h.speed,attackDelay:.47,dodgeDelay:2.6};wave=kills=relics=elapsed=phaseTime=0;attackCooldown=dodgeCooldown=dodgeTime=invulnerable=attackVisual=shake=0;transitionTime=0;facing=0;aimTime=-100;mouseAim=null;hero.root.scale.setScalar(1);hero.root.position.set(0,.23,4);hero.root.rotation.set(0,0,0);hero.body.rotation.set(0,0,0);applyPlayerStyle();relic.visible=false;slash.material.opacity=0;spawnQueue=[];spawnTimer=0;$('announcement').hidden=true;$('toast').hidden=true;updateHUD();}
function start(){if(!identityReady)return;activeRunPlayer=currentPlayer();reset();setMode('playing');beginWave();tone(440,.25,'triangle');}
function beginWave(){phaseTime=0;spawnTimer=.6;spawnQueue=[...WAVES[wave].enemies];transitionTime=0;relic.visible=false;$('wave-label').textContent=`ENCOUNTER ${String(wave+1).padStart(2,'0')} / 05`;$('wave-name').textContent=WAVES[wave].name;$('announcement-top').textContent=`ENCOUNTER ${['I','II','III','IV','V'][wave]}`;$('announcement-name').textContent=WAVES[wave].name;$('announcement').hidden=false;toast(WAVES[wave].subtitle,2);}
function updateHUD(){if(!stats)return;$('hp-number').textContent=`${Math.ceil(stats.hp)} / ${stats.maxHp}`;$('hp-bar').style.width=`${Math.max(0,stats.hp/stats.maxHp*100)}%`;$('hp-bar').style.background=stats.hp/stats.maxHp<.3?'#bb7454':'#628b65';$('player-name').textContent=currentUser?.name||'Guest';$('dodge-label').innerHTML=dodgeCooldown<=0?'READY <kbd>SPACE</kbd>':`${dodgeCooldown.toFixed(1)}s <kbd>SPACE</kbd>`;$('dodge-bar').style.width=`${Math.max(0,1-dodgeCooldown/stats.dodgeDelay)*100}%`;Array.from($('relic-dots').children).forEach((el,i)=>{el.classList.toggle('awakened',i<relics);el.textContent=i<relics?'◆':'◇';});const boss=enemies.find(e=>e.kind==='boss');$('boss-hud').hidden=!boss||mode==='menu';if(boss)$('boss-health').style.width=`${boss.hp/boss.maxHp*100}%`;}
function pause(){if(mode!=='playing')return;setMode('paused');$('result-kicker').textContent='TAKE A BREATH';$('result-title').textContent='Even heroes rest.';$('result-description').textContent='Your adventure will be right here.';$('run-summary').hidden=true;$('score-summary').hidden=true;$('continue').firstElementChild.textContent='Back to the adventure';$('continue').focus();}
function resume(){if(mode==='paused'){setMode('playing');last=performance.now();}else start();}
function finish(won=false){if(mode!=='playing')return;setMode(won?'won':'over');$('result-kicker').textContent=won?'THE SANCTUARY REMEMBERS':'EVERY HERO STARTS SOMEWHERE';$('result-title').textContent=won?'The light returns.':'Your story isn’t over.';$('result-description').textContent=won?`${HEROES[selected].name} has defeated the Hollow Guardian. The ancient light is safe, and the grove is alive again.`:'A keeper falls, but courage stays. Keep moving, watch the warning circles, and dodge before they strike.';$('run-summary').hidden=false;const result=recordRun(storage,activeRunPlayer||currentPlayer(),{kills,relics,wave:wave+1,won});$('score-summary').hidden=false;$('score-summary').textContent=`${(activeRunPlayer||currentPlayer()).name} · ${result.score.toLocaleString()} points · Best ${result.best.toLocaleString()}${result.improved?' · New best!':''}${result.saved?'':' · Storage unavailable'}`;renderAccount();$('final-wave').textContent=`${wave+1} / 5`;$('final-kills').textContent=kills;$('final-time').textContent=`${Math.floor(elapsed/60)}:${String(Math.floor(elapsed%60)).padStart(2,'0')}`;$('continue').firstElementChild.textContent=won?'Begin another adventure':'Try again';$('continue').focus();tone(won?880:130,.5,'triangle');if(won){relic.visible=true;burst(0,2,0,goldParticleMat,45);}}
function home(){clearRun();setMode('menu');hero.root.position.set(5,0,4);hero.root.scale.setScalar(1.65);hero.root.rotation.set(0,.35,0);hero.body.rotation.set(0,0,0);applyPlayerStyle();renderAccount();relic.visible=true;slash.material.opacity=0;$('toast').hidden=true;$('announcement').hidden=true;$('begin').focus();}
function damagePlayer(amount,from){if(mode!=='playing'||invulnerable>0||dodgeTime>0)return;stats.hp=Math.max(0,stats.hp-amount);invulnerable=.9;shake=.18;burst(hero.root.position.x,1,hero.root.position.z,hitParticleMat,10);tone(110,.15,'triangle');if(from){const push=new THREE.Vector2(hero.root.position.x-from.x,hero.root.position.z-from.z).normalize().multiplyScalar(.5);const pos=clampArena(hero.root.position.x+push.x,hero.root.position.z+push.y);hero.root.position.x=pos.x;hero.root.position.z=pos.z;}if(stats.hp<=0)finish(false);}
function nearestEnemy(){let best=null,d=Infinity;for(const e of enemies){const next=hero.root.position.distanceTo(e.root.position);if(next<d){d=next;best=e;}}return best;}
function hitEnemy(e,damage){e.hp-=damage;e.hitFlash=.16;const dx=e.root.position.x-hero.root.position.x,dz=e.root.position.z-hero.root.position.z;const n=new THREE.Vector2(dx,dz).normalize();e.knock.addScaledVector(n,e.kind==='boss'?1.2:5);burst(e.root.position.x,1.2,e.root.position.z,hitParticleMat,7);}
function attack(){if(mode!=='playing'||attackCooldown>0||dodgeTime>0||transitionTime>0)return;attackCooldown=stats.attackDelay;attackVisual=.27;if(clock-aimTime>2){const target=nearestEnemy();if(target)facing=Math.atan2(target.root.position.x-hero.root.position.x,target.root.position.z-hero.root.position.z);}hero.root.rotation.y=facing;slashGroup.position.set(hero.root.position.x,1.05,hero.root.position.z);slashGroup.rotation.y=facing;tone(250,.1,'triangle',.018);for(const e of enemies)if(withinSlash(hero.root.position.x,hero.root.position.z,facing,e.root.position.x,e.root.position.z,3.25+e.size*.45))hitEnemy(e,stats.damage);}
function dodge(){if(mode!=='playing'||dodgeCooldown>0||dodgeTime>0)return;dodgeCooldown=stats.dodgeDelay;dodgeTime=.36;invulnerable=Math.max(invulnerable,.42);dodgeVector.copy(moveVector);if(dodgeVector.length()<.1)dodgeVector.set(Math.sin(facing),Math.cos(facing));dodgeVector.normalize();tone(190,.16,'sine',.025);burst(hero.root.position.x,.4,hero.root.position.z,hitParticleMat,8);}
const projectileGeometry=new THREE.SphereGeometry(.18,8,6),projectileMat=new THREE.MeshBasicMaterial({color:'#ae7f99'});
function fireProjectile(e,angle,velocity=5.1){const m=new THREE.Mesh(projectileGeometry,projectileMat);m.position.copy(e.root.position);m.position.y=1.1;scene.add(m);projectiles.push({mesh:m,v:new THREE.Vector2(Math.sin(angle),Math.cos(angle)).multiplyScalar(velocity),life:6,damage:e.kind==='boss'?15:10});}
function telegraph(e,type){e.windup=type==='slam'?1.25:type==='cast'?.85:.7;e.attackType=type;e.attackPoint.set(hero.root.position.x,hero.root.position.z);e.warning.position.set(e.root.position.x,.28,e.root.position.z);e.warning.scale.setScalar(type==='slam'?4.2:type==='cast'?1.1:1.9);e.warning.material.opacity=.3;}
function resolveEnemyAttack(e){const x=hero.root.position.x,z=hero.root.position.z,d=Math.hypot(x-e.root.position.x,z-e.root.position.z);if(e.attackType==='cast'){const angle=Math.atan2(e.attackPoint.x-e.root.position.x,e.attackPoint.y-e.root.position.z);fireProjectile(e,angle);if(e.kind==='boss'){fireProjectile(e,angle-.3);fireProjectile(e,angle+.3);}tone(160,.1,'sine',.012);}else if(e.attackType==='slam'){if(d<4.6)damagePlayer(24,{x:e.root.position.x,z:e.root.position.z});burst(e.root.position.x,.4,e.root.position.z,goldParticleMat,25);e.warning.material.opacity=.65;shake=.12;}else if(d<2.1+e.size*.3)damagePlayer(e.kind==='brute'?19:12,{x:e.root.position.x,z:e.root.position.z});e.cooldown=e.kind==='boss'?1.7:e.kind==='wraith'?2.4:1.25;e.warning.material.opacity=0;e.windup=0;}
const pickupGeometry=new THREE.OctahedronGeometry(.25,0),pickupMat=new THREE.MeshStandardMaterial({color:'#e7b39b',emissive:'#985c40',emissiveIntensity:.25});
function dropHeart(x,z){const m=new THREE.Mesh(pickupGeometry,pickupMat);m.position.set(x,.8,z);scene.add(m);pickups.push({mesh:m,age:0});}
function collectRelic(){if(transitionTime<=0||mode!=='playing')return;relics++;stats.hp=Math.min(stats.maxHp,stats.hp+22);setMode('upgrade');relic.visible=false;transitionTime=0;$('toast').hidden=true;tone(740,.3,'sine');document.querySelector('[data-upgrade]').focus();updateHUD();}
function bless(kind){if(mode!=='upgrade')return;stats=applyBlessing(stats,kind);wave++;setMode('playing');beginWave();toast(kind==='blade'?'Sunforged blade · Damage increased':kind==='heart'?'Heart of the grove · Fully healed':'Windwalker’s gift · Faster attacks and dodges');}
function spawnEnemy(kind){const angle=Math.random()*Math.PI*2;const e=makeEnemy(kind,Math.sin(angle)*11.8,Math.cos(angle)*11.8);enemies.push(e);burst(e.root.position.x,.5,e.root.position.z,hitParticleMat,8);}
function simulate(dt){
 elapsed+=dt;phaseTime+=dt;attackCooldown=Math.max(0,attackCooldown-dt);dodgeCooldown=Math.max(0,dodgeCooldown-dt);invulnerable=Math.max(0,invulnerable-dt);dodgeTime=Math.max(0,dodgeTime-dt);attackVisual=Math.max(0,attackVisual-dt);shake=Math.max(0,shake-dt);
 if(phaseTime>2.4)$('announcement').hidden=true;
 // Input is screen-relative to the isometric camera: up always moves up the screen.
 let inputX=(keys.has('KeyD')||keys.has('ArrowRight')||touchDirs.has('right')?1:0)-(keys.has('KeyA')||keys.has('ArrowLeft')||touchDirs.has('left')?1:0);
 let inputY=(keys.has('KeyS')||keys.has('ArrowDown')||touchDirs.has('down')?1:0)-(keys.has('KeyW')||keys.has('ArrowUp')||touchDirs.has('up')?1:0);
 moveVector.set(inputX*.707+inputY*.707,-inputX*.707+inputY*.707);if(moveVector.length()>1)moveVector.normalize();
 const movement=dodgeTime>0?dodgeVector:moveVector;const speed=dodgeTime>0?19:stats.speed;
 const pos=clampArena(hero.root.position.x+movement.x*speed*dt,hero.root.position.z+movement.y*speed*dt);hero.root.position.x=pos.x;hero.root.position.z=pos.z;
 if(dodgeTime<=0){if(clock-aimTime<2&&mouseAim){facing=Math.atan2(mouseAim.x-hero.root.position.x,mouseAim.z-hero.root.position.z);}else{const target=nearestEnemy();if(target&&hero.root.position.distanceTo(target.root.position)<8)facing=Math.atan2(target.root.position.x-hero.root.position.x,target.root.position.z-hero.root.position.z);else if(moveVector.length()>.1)facing=Math.atan2(moveVector.x,moveVector.y);}hero.root.rotation.y+=angleDelta(facing,hero.root.rotation.y)*Math.min(1,dt*14);}
 if(attackHeld||keys.has('KeyJ'))attack();
 if(spawnQueue.length){spawnTimer-=dt;if(spawnTimer<=0){spawnEnemy(spawnQueue.shift());spawnTimer=wave===4?1.8:.85;}}
 for(let i=enemies.length-1;i>=0;i--){const e=enemies[i];e.age+=dt;e.cooldown-=dt;e.hitFlash=Math.max(0,e.hitFlash-dt);e.healthFill.scale.x=Math.max(0,e.hp/e.maxHp);e.healthFill.position.x=-(1-e.hp/e.maxHp)*.6;e.healthBar.quaternion.copy(e.root.quaternion).invert().multiply(camera.quaternion);
  if(e.hp<=0){burst(e.root.position.x,1,e.root.position.z,goldParticleMat,e.kind==='boss'?45:15);if((kills%3===2||stats.hp<stats.maxHp*.5)&&e.kind!=='boss')dropHeart(e.root.position.x,e.root.position.z);disposeEnemy(e);enemies.splice(i,1);kills++;tone(520,.12,'sine',.02);continue;}
  const dx=hero.root.position.x-e.root.position.x,dz=hero.root.position.z-e.root.position.z,d=Math.hypot(dx,dz)||.001;e.angle=Math.atan2(dx,dz);e.root.rotation.y+=angleDelta(e.angle,e.root.rotation.y)*Math.min(1,dt*5);
  if(e.windup>0){e.windup-=dt;e.warning.material.opacity=.25+Math.sin(clock*22)*.12;e.warning.position.set(e.root.position.x,.29,e.root.position.z);e.body.rotation.x=-Math.sin(e.windup*4)*.12;if(e.windup<=0)resolveEnemyAttack(e);}
  else{e.body.rotation.x=0;const ideal=e.kind==='wraith'?6:e.kind==='boss'?3:1.7;if(d>ideal){e.root.position.x+=dx/d*e.speed*dt;e.root.position.z+=dz/d*e.speed*dt;}else if(e.kind==='wraith'&&d<4){e.root.position.x-=dx/d*e.speed*.6*dt;e.root.position.z-=dz/d*e.speed*.6*dt;}
   if(e.cooldown<=0){if(e.kind==='wraith'&&d<12)telegraph(e,'cast');else if(e.kind==='boss'&&d<8)telegraph(e,e.age%8<4?'slam':'cast');else if(d<2.3+e.size*.2)telegraph(e,'melee');}
  }
  e.root.position.x+=e.knock.x*dt;e.root.position.z+=e.knock.y*dt;e.knock.multiplyScalar(Math.exp(-dt*9));const ep=clampArena(e.root.position.x,e.root.position.z,13.3);e.root.position.x=ep.x;e.root.position.z=ep.z;
  // Soft separation prevents a stack of enemies from becoming unreadable.
  for(let j=0;j<i;j++){const other=enemies[j],sx=e.root.position.x-other.root.position.x,sz=e.root.position.z-other.root.position.z,sd=Math.hypot(sx,sz),limit=(e.size+other.size)*.85;if(sd<limit&&sd>.01){const push=(limit-sd)*dt*1.7;e.root.position.x+=sx/sd*push;e.root.position.z+=sz/sd*push;other.root.position.x-=sx/sd*push;other.root.position.z-=sz/sd*push;}}
  e.body.position.y=Math.sin(e.age*9)*.04;e.body.scale.setScalar(e.hitFlash>0?1.04:1);for(let j=0;j<2;j++){e.legs[j].rotation.x=e.windup>0?0:Math.sin(e.age*8+j*Math.PI)*.35;e.arms[j].rotation.x=e.windup>0?-1.3:Math.sin(e.age*8+j*Math.PI)*.25;}
 }
 for(let i=projectiles.length-1;i>=0;i--){const p=projectiles[i];p.life-=dt;p.mesh.position.x+=p.v.x*dt;p.mesh.position.z+=p.v.y*dt;if(Math.hypot(p.mesh.position.x-hero.root.position.x,p.mesh.position.z-hero.root.position.z)<.85){damagePlayer(p.damage,{x:p.mesh.position.x,z:p.mesh.position.z});p.life=0;}if(p.life<=0||Math.hypot(p.mesh.position.x,p.mesh.position.z)>16){scene.remove(p.mesh);projectiles.splice(i,1);}}
 for(let i=pickups.length-1;i>=0;i--){const p=pickups[i];p.age+=dt;p.mesh.rotation.y+=dt*1.5;p.mesh.position.y=.8+Math.sin(p.age*3)*.12;if(p.mesh.position.distanceTo(hero.root.position)<1.35){stats.hp=Math.min(stats.maxHp,stats.hp+18);burst(p.mesh.position.x,1,p.mesh.position.z,goldParticleMat,9);tone(660,.15);scene.remove(p.mesh);pickups.splice(i,1);toast('+18 health · A little kindness from the grove',1.5);}}
 if(!spawnQueue.length&&!enemies.length&&phaseTime>2&&mode==='playing'){
  if(wave===4){finish(true);return;}
  if(transitionTime===0){transitionTime=1;relic.visible=true;projectiles.forEach(p=>scene.remove(p.mesh));projectiles.length=0;toast('A relic awakens. Return to the glowing centre.',5);tone(620,.3,'sine');}
  transitionTime+=dt;if(Math.hypot(hero.root.position.x,hero.root.position.z)<2.3&&transitionTime>1.8)collectRelic();
 }
 $('combat-hint').textContent=transitionTime>0?'Walk to the glowing relic at the centre.':phaseTime<4?'Hold J or click to swing. Space to dodge.':stats.hp<stats.maxHp*.3?'Low health. Keep moving and pick up pink crystals.':wave===4?'Dodge the guardian’s wide circle before it strikes.':'Red circles mean danger. Dodge before the strike.';
 updateHUD();
}
$('begin').addEventListener('click',start);$('pause').addEventListener('click',pause);$('continue').addEventListener('click',resume);$('return-home').addEventListener('click',home);
function chooseHero(key){if(!HEROES[key])return;selected=key;applyPlayerStyle();$('hero-description').textContent=HEROES[key].description;document.querySelectorAll('[data-hero]').forEach(b=>{const active=b.dataset.hero===key;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));});save(storage,'relic-hero',key);}
document.querySelectorAll('[data-hero]').forEach(b=>b.addEventListener('click',()=>chooseHero(b.dataset.hero)));chooseHero(selected);
document.querySelectorAll('[data-upgrade]').forEach(b=>b.addEventListener('click',()=>bless(b.dataset.upgrade)));
$('sound').addEventListener('click',()=>{sound=!sound;$('sound').setAttribute('aria-label',sound?'Mute sound':'Enable sound');$('sound').title=sound?'Mute sound':'Enable sound';$('sound-path').setAttribute('d',sound?'M15 8c3 2 3 6 0 8m3-11c5 4 5 10 0 14':'m16 9 6 6m0-6-6 6');tone(600,.15);});
$('guide').addEventListener('click',()=>{guideWasRunning=mode==='playing';if(guideWasRunning)pause();$('guide-dialog').showModal();});
$('close-guide').addEventListener('click',()=>$('guide-dialog').close());$('guide-done').addEventListener('click',()=>$('guide-dialog').close());$('guide-dialog').addEventListener('close',()=>{if(guideWasRunning&&mode==='paused')resume();guideWasRunning=false;});
window.addEventListener('keydown',e=>{if($('guide-dialog').open||$('scores-dialog').open)return;if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code))e.preventDefault();if(e.code==='KeyP'||e.code==='Escape'){if(e.repeat)return;if(mode==='playing')pause();else if(mode==='paused')resume();return;}if(mode!=='playing')return;keys.add(e.code);if(!e.repeat&&(e.code==='Space'||e.code==='ShiftLeft'||e.code==='ShiftRight'))dodge();if(e.code==='KeyJ')attack();});
window.addEventListener('keyup',e=>keys.delete(e.code));
window.addEventListener('blur',()=>{keys.clear();attackHeld=false;pause();});document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();});
const raycaster=new THREE.Raycaster(),aimPlane=new THREE.Plane(new THREE.Vector3(0,1,0),0),aimPoint=new THREE.Vector3(),pointer=new THREE.Vector2();
renderer.domElement.addEventListener('pointermove',e=>{if(e.pointerType==='touch')return;const r=renderer.domElement.getBoundingClientRect();pointer.set((e.clientX-r.left)/r.width*2-1,-((e.clientY-r.top)/r.height)*2+1);raycaster.setFromCamera(pointer,camera);if(raycaster.ray.intersectPlane(aimPlane,aimPoint)){mouseAim=aimPoint.clone();aimTime=clock;}});
renderer.domElement.addEventListener('pointerdown',e=>{if(e.button===0&&mode==='playing'){attackHeld=true;attack();renderer.domElement.setPointerCapture(e.pointerId);}});
window.addEventListener('pointerup',()=>{attackHeld=false;});window.addEventListener('pointercancel',()=>{attackHeld=false;touchDirs.clear();});
for(const b of document.querySelectorAll('[data-dir]')){b.addEventListener('pointerdown',e=>{e.preventDefault();b.setPointerCapture(e.pointerId);touchDirs.add(b.dataset.dir);});for(const type of ['pointerup','pointercancel','lostpointercapture'])b.addEventListener(type,()=>touchDirs.delete(b.dataset.dir));}
$('mobile-attack').addEventListener('pointerdown',e=>{e.preventDefault();$('mobile-attack').setPointerCapture(e.pointerId);attackHeld=true;attack();});$('mobile-dodge').addEventListener('pointerdown',e=>{e.preventDefault();dodge();});
// Identity and styling come only from the start.ng /connect bridge.
function currentPlayer() { return {key:playerKey(currentUser),name:currentUser?.name||'Guest'}; }
function renderAccount() {
 const player=currentPlayer();
 $('identity').textContent=currentUser?`Welcome, ${player.name}. Your keeper is ready.`:!START_NG?'Playing as Guest. start.ng sign-in isn’t available here.':identityUnavailable?'start.ng hasn’t answered. You can retry sign-in or play as Guest.':'Welcome, Guest. Bring your start.ng character or explore as a guest.';
 $('account-style').textContent=currentUser?'YOUR START.NG LOOK':START_NG?'GUEST · DEFAULT LOOK':'GUEST DEMO';
 $('personal-best').textContent=`BEST ${profileFor(storage,player.key).best.toLocaleString()}`;
 $('sign-in').hidden=!START_NG||!!currentUser;
 $('begin').disabled=!identityReady;
 $('begin').firstElementChild.textContent=currentUser?'Enter the sanctuary':'Play as guest';
}
function setPlayer(user) {
 if(user===undefined){identityUnavailable=true;identityReady=true;renderAccount();return;}
 const changed=playerKey(user)!==playerKey(currentUser);
 if(changed&&mode==='playing')pause();
 currentUser=user;identityUnavailable=false;identityReady=true;
 applyPlayerStyle();renderAccount();
 if(changed&&mode!=='menu')toast(user?`Welcome back, ${user.name}. This run keeps its starting player.`:'Signed out. Your keeper now uses the Guest look.',4);
}
onUserChange(setPlayer);
getCurrentUser().then(setPlayer);
$('sign-in').addEventListener('click',signIn);
function refreshScores(){
 const p=currentPlayer(),profile=profileFor(storage,p.key);
 $('scores-player').textContent=`${p.name} · Best ${profile.best.toLocaleString()} · ${profile.runs} adventures · ${profile.wins} victories`;
 const list=$('score-list');list.replaceChildren();
 const rows=leaderboardFor(storage);
 if(!rows.length){const item=document.createElement('li');item.textContent='Your first adventure starts the story.';list.append(item);}
 rows.forEach((row,i)=>{const item=document.createElement('li'),name=document.createElement('span'),score=document.createElement('strong');name.textContent=`${i+1}. ${row.name}${row.key===p.key?' (you)':''}`;score.textContent=row.score.toLocaleString();item.append(name,score);list.append(item);});
}
let scoresWasRunning=false;
$('scores-button').addEventListener('click',()=>{scoresWasRunning=mode==='playing';if(scoresWasRunning)pause();refreshScores();$('scores-dialog').showModal();});
$('close-scores').addEventListener('click',()=>$('scores-dialog').close());
$('scores-dialog').addEventListener('close',()=>{if(scoresWasRunning&&mode==='paused')resume();scoresWasRunning=false;});
function resize(){const w=game.clientWidth,h=game.clientHeight;renderer.setSize(w,h);camera.aspect=w/h;}
new ResizeObserver(resize).observe(game);resize();
const cameraTarget=new THREE.Vector3(-4,0,0),desiredTarget=new THREE.Vector3();let viewHeight=26;
function updateCamera(dt){const mobile=game.clientWidth<700,menu=mode==='menu';desiredTarget.set(menu?(mobile?-2.5:-5):hero.root.position.x*(mobile?.78:.16),0,menu?(mobile?1:0):hero.root.position.z*(mobile?.78:.16));cameraTarget.lerp(desiredTarget,1-Math.exp(-dt*3));const desiredHeight=menu?(mobile?26:25):(mobile?43:34);viewHeight=THREE.MathUtils.damp(viewHeight,desiredHeight,3,dt);const aspect=game.clientWidth/game.clientHeight;camera.left=-viewHeight*aspect/2;camera.right=viewHeight*aspect/2;camera.top=viewHeight/2;camera.bottom=-viewHeight/2;camera.position.set(cameraTarget.x+23,29,cameraTarget.z+29);if(shake>0){camera.position.x+=(Math.random()-.5)*shake*2;camera.position.y+=(Math.random()-.5)*shake*2;}camera.lookAt(cameraTarget.x,0,cameraTarget.z);camera.updateProjectionMatrix();}
let accumulator=0;
function frame(now){const dt=Math.min((now-(last||now))/1000,.05);last=now;clock+=dt;if(mode==='playing'){accumulator+=dt;let steps=0;while(accumulator>=1/120&&steps++<8&&mode==='playing'){simulate(1/120);accumulator-=1/120;}}else accumulator=0;
 const active=mode==='playing',menu=mode==='menu',moving=active&&moveVector.length()>.1;
 if(menu){hero.body.position.y=Math.sin(clock*2)*.04;hero.body.rotation.x=0;hero.root.rotation.y=.35+Math.sin(clock*.35)*.12;hero.arms[0].rotation.x=-.12;hero.arms[1].rotation.x=-.12;hero.legs.forEach(l=>l.rotation.x=0);}else{
  hero.body.position.y=moving&&dodgeTime<=0?Math.abs(Math.sin(elapsed*13))*.08:0;
  hero.body.rotation.x=dodgeTime>0?-(1-dodgeTime/.36)*Math.PI*2:0;
  if(dodgeTime>0)hero.body.position.y=.35;
  hero.legs.forEach((l,i)=>l.rotation.x=moving?Math.sin(elapsed*13+i*Math.PI)*.65:0);
  hero.arms[0].rotation.x=moving?Math.sin(elapsed*13)*-.25:0;
  hero.arms[1].rotation.z=attackVisual>0?-Math.sin(attackVisual/.27*Math.PI)*1.3:0;
  hero.arms[1].rotation.x=attackVisual>0?-.9:-.1;
  hero.root.visible=!(active&&invulnerable>.2&&Math.floor(clock*18)%2===0&&dodgeTime<=0);
 }
 if(mode!=='playing')hero.root.visible=true;
 slash.material.opacity=active?Math.max(0,attackVisual/.27)*.7:0;if(attackVisual>0&&active)slashGroup.rotation.y=facing+(1-attackVisual/.27)*.3;
 playerShadow.position.set(hero.root.position.x,.26,hero.root.position.z);playerShadow.scale.setScalar(menu?1.65:1);playerShadow.visible=true;
 crystal.rotation.y=clock*.6;crystal.position.y=1.8+Math.sin(clock*2)*.15;relicHalo.rotation.y=clock*.4;relicLight.intensity=2.5+Math.sin(clock*2)*.5;runeRing.rotation.z=clock*.025;gateGem.rotation.y=Math.sin(clock*.3)*.15;motes.rotation.y=clock*.012;
 if(menu)menuMonsters.forEach((e,i)=>{e.body.position.y=Math.sin(clock*2+i)*.05;});
 if(active||mode==='won')for(let i=effects.length-1;i>=0;i--){const p=effects[i];p.life-=dt;p.v.y-=9*dt;p.mesh.position.addScaledVector(p.v,dt);p.mesh.scale.setScalar(Math.max(0,p.life/p.max));if(p.life<=0){scene.remove(p.mesh);effects.splice(i,1);}}
 if(clock>toastUntil)$('toast').hidden=true;updateCamera(dt);renderer.render(scene,camera);requestAnimationFrame(frame);
}
$('loading').hidden=true;updateCamera(1);requestAnimationFrame(frame);

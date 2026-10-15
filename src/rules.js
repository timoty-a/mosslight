export const HEROES = {
 fern:{name:'Fern',title:'The Wayfarer',color:'#397f70',maxHp:110,speed:6.8,damage:26,description:'A steady blade, a brave heart. Balanced in every way.'},
 ember:{name:'Ember',title:'The Swiftblade',color:'#bb674b',maxHp:85,speed:8.1,damage:29,description:'Quick on her feet. Fierce with a blade. Built to keep moving.'},
 aurelia:{name:'Aurelia',title:'The Guardian',color:'#b59b59',maxHp:145,speed:6,damage:24,description:'An unshakable protector. More heart, more time to be brave.'}
};
export const WAVES = [
 {name:'The overgrowth',subtitle:'The sanctuary stirs.',enemies:['moss','moss','moss','moss']},
 {name:'Whispers in stone',subtitle:'Something watches from the ruins.',enemies:['moss','moss','wraith','wraith','moss']},
 {name:'Roots of the fallen',subtitle:'Old roots. New enemies.',enemies:['brute','moss','moss','wraith','moss','wraith']},
 {name:'The last ward',subtitle:'The light is almost within reach.',enemies:['brute','brute','wraith','wraith','moss','moss','moss']},
 {name:'The Hollow Guardian',subtitle:'Bring the light back.',enemies:['boss','wraith','moss','moss']}
];
export function withinSlash(px,pz,angle,ex,ez,range=3.35){const dx=ex-px,dz=ez-pz,distance=Math.hypot(dx,dz);if(distance>range)return false;if(distance<.7)return true;return (dx*Math.sin(angle)+dz*Math.cos(angle))/distance>Math.cos(Math.PI*.43);}
export function clampArena(x,z,radius=13.4){const d=Math.hypot(x,z);return d>radius?{x:x/d*radius,z:z/d*radius}:{x,z};}
export function angleDelta(target,current){return Math.atan2(Math.sin(target-current),Math.cos(target-current));}
export function applyBlessing(stats,kind){const result={...stats};if(kind==='blade')result.damage*=1.3;else if(kind==='heart'){result.maxHp+=30;result.hp=result.maxHp;}else if(kind==='wind'){result.attackDelay=Math.max(.18,result.attackDelay*.82);result.dodgeDelay=Math.max(.7,result.dodgeDelay*.8);}return result;}
export function waveScale(wave){return 1+wave*.09;}
export function stored(storage,key,fallback){try{return storage.getItem(key)??fallback;}catch{return fallback;}}
export function save(storage,key,value){try{storage.setItem(key,String(value));}catch{/* Optional persistence. */}}

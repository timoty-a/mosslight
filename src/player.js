export const DEFAULT_STYLE = Object.freeze({primaryColor:'#397f70',secondaryColor:'#4c5540',skinColor:'#c49469',hat:'none',accessory:'none'});
export function normalizeStyle(style = {}) {
  const result = {...DEFAULT_STYLE};
  for (const key of ['primaryColor','secondaryColor','skinColor']) if (typeof style?.[key] === 'string' && /^#[0-9a-f]{6}$/i.test(style[key])) result[key] = style[key];
  if (['none','cap','beanie','tophat','crown'].includes(style?.hat)) result.hat = style.hat;
  if (['none','glasses','scarf','backpack'].includes(style?.accessory)) result.accessory = style.accessory;
  return result;
}
export const playerKey = user => user ? `user:${String(user.id)}` : 'guest';
export function runScore({kills,relics,wave,won}) { return kills*100 + relics*250 + wave*150 + (won ? 1500 : 0); }
function read(storage,key,fallback) { try { return JSON.parse(storage.getItem(key)) ?? fallback; } catch { return fallback; } }
function write(storage,key,value) { try { storage.setItem(key,JSON.stringify(value)); return true; } catch { return false; } }
const PREFIX='relic-keepers:v1:';
export function profileFor(storage,key) {
 const p=read(storage,`${PREFIX}player:${encodeURIComponent(key)}`,{});
 return {best:Number.isSafeInteger(p.best)&&p.best>=0?p.best:0,runs:Number.isSafeInteger(p.runs)&&p.runs>=0?p.runs:0,wins:Number.isSafeInteger(p.wins)&&p.wins>=0?p.wins:0};
}
export function recordRun(storage,player,run) {
 const score=runScore(run),key=player.key,previous=profileFor(storage,key);
 const profile={best:Math.max(previous.best,score),runs:previous.runs+1,wins:previous.wins+(run.won?1:0)};
 write(storage,`${PREFIX}player:${encodeURIComponent(key)}`,profile);
 let board=read(storage,`${PREFIX}leaderboard`,[]);if(!Array.isArray(board))board=[];
 board=board.filter(r=>r&&typeof r.key==='string'&&r.key!==key&&typeof r.name==='string'&&Number.isSafeInteger(r.score)&&r.score>=0);
 board.push({key,name:String(player.name).slice(0,80),score:profile.best});
 board.sort((a,b)=>b.score-a.score||a.name.localeCompare(b.name));
 const saved=write(storage,`${PREFIX}leaderboard`,board.slice(0,10));
 return {score,best:profile.best,improved:score>previous.best,saved};
}
export function leaderboardFor(storage) {
 const board=read(storage,`${PREFIX}leaderboard`,[]);
 return Array.isArray(board)?board.filter(r=>r&&typeof r.key==='string'&&typeof r.name==='string'&&Number.isSafeInteger(r.score)&&r.score>=0).sort((a,b)=>b.score-a.score).slice(0,5):[];
}

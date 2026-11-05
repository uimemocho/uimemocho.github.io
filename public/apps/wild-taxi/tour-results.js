import {rankRun} from './tour.js';
import {settlement} from './settlement.js';
const GRADES=['SSS','SS','S','A','B','C','D'];
export function normalizeTourResults(value){
 return Array.from({length:30},(_,i)=>{const r=value?.[i];if(!r||!GRADES.includes(r.grade)||!['elapsed','score','safety','speed','fare','damage','people','crashes'].every(k=>Number.isFinite(r[k])&&r[k]>=0)||r.elapsed<=0||r.score>100||r.safety>100||r.speed>100)return null;if(r.grade==='SSS'&&(!r.clean||r.score!==100||r.safety!==100||r.speed!==100||r.people||r.crashes))return null;return Object.fromEntries(['grade','elapsed','score','safety','speed','fare','damage','people','crashes','clean'].map(k=>[k,r[k]]))});
}
export function tourLegResult(run){if(run.status!=='delivered')return null;const rank=rankRun(run),bill=settlement(run);return {grade:rank.grade,elapsed:run.elapsed,score:rank.score,safety:rank.safety,speed:rank.speed,fare:bill.fare,damage:bill.damage,people:bill.people,crashes:run.crashes||0,clean:rank.clean}}
export function recordTourLeg(progress,index,run){
 if(!Number.isInteger(index)||index<0||index>29)throw new RangeError('Invalid tour stage');const result=tourLegResult(run);if(!result)return progress;
 const results=normalizeTourResults(progress?.results),old=results[index];if(!old||GRADES.indexOf(result.grade)<GRADES.indexOf(old.grade)||result.grade===old.grade&&(result.score>old.score||result.score===old.score&&result.elapsed<old.elapsed))results[index]=result;
 return {...progress,nextStage:index+1,results};
}
export function summarizeTour(progress){
 const results=normalizeTourResults(progress?.results),known=results.filter(Boolean),recorded=known.length,perfect=progress?.nextStage===30&&recorded===30&&known.every(r=>r.grade==='SSS'),sum=k=>known.reduce((n,r)=>n+r[k],0),average=k=>recorded?sum(k)/recorded:0,score=Math.round(average('score'));
 let grade=perfect?'SSS':!recorded?'—':score>=93?'SS':score>=85?'S':score>=72?'A':score>=58?'B':score>=42?'C':'D';if(sum('people')&&['SSS','SS','S','A','B'].includes(grade))grade='C';if(sum('crashes')&&['SSS','SS','S'].includes(grade))grade='A';
 return {perfect,grade,score,recorded,sss:known.filter(r=>r.grade==='SSS').length,elapsed:recorded?sum('elapsed'):null,fare:recorded?sum('fare'):null,damage:recorded?sum('damage'):null,net:recorded?sum('fare')-sum('damage'):null,safety:Math.round(average('safety')),speed:Math.round(average('speed'))};
}
export function tourTime(seconds){if(seconds===null)return '—';const hundredths=Math.round(seconds*100),minutes=Math.floor(hundredths/6000);return minutes+':'+String(Math.floor(hundredths/100)%60).padStart(2,'0')+'.'+String(hundredths%100).padStart(2,'0')}

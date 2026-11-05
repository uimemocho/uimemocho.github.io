import {clamp} from './track.js';

export function missionAt(index,total=30){
 if(!Number.isInteger(index)||index<0||index>=total)throw new RangeError('Invalid tour stage');
 return {from:index,to:(index+1)%total,number:index+1,total,last:index===total-1};
}
export const targetTime=length=>Math.round((length/48+3)*10)/10;
export function rankRun(run){
 const target=targetTime(run.length),counts=run.damageCounts||{},people=counts.pedestrian||0;
 const contacts=Math.max(run.smashes||0,Object.values(counts).reduce((a,b)=>a+b,0));
 const clean=contacts===0&&(run.hits||0)===0&&(run.crashes||0)===0;
 const speed=run.status==='delivered'?Math.round(clamp(60-(run.elapsed/target-1)*45,0,60)):0;
 const safety=Math.round(clamp(40-contacts*4-(run.hits||0)*3-(run.crashes||0)*12-people*18,0,40));
 const score=speed+safety;
 let grade=clean&&run.elapsed<=target?'SSS':score>=93?'SS':score>=85?'S':score>=72?'A':score>=58?'B':score>=42?'C':'D';
 if(people)grade=['SSS','SS','S','A','B'].includes(grade)?'C':grade;
 if((run.crashes||0)>0&&['SSS','SS','S'].includes(grade))grade='A';
 if(run.status!=='delivered')grade='F';
 const message=run.status==='wrecked'?'大転倒2回で営業終了。':grade==='SSS'?'無事故、そして爆速。':grade==='F'?'次はブーストを使ってみよう。':!clean?'ぶつけずに走れば、もっと上へ。':run.elapsed>target?'無事故クリア！ 次はタイムを縮めよう。':'ナイスドライブ！';
 return {grade,target,score,speed:Math.round(speed/60*100),safety:Math.round(safety/40*100),clean,message};
}

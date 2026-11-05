import {signal} from './simulation.js';
export const DASH_WINDOW=.4,STALL_SECONDS=1.8;
export class StartDash{
 constructor(){this.remaining=3;this.held=false;this.pressedAt=null;this.committed=false}
 get digit(){return this.remaining>0?Math.ceil(this.remaining):0}
 get elapsed(){return 3-this.remaining}
 get windowOpen(){return this.elapsed>=1&&this.elapsed<=1+DASH_WINDOW}
 get outcome(){return !this.held||this.pressedAt===null?'normal':this.pressedAt<1?'stall':this.pressedAt<=1+DASH_WINDOW?'dash':'normal'}
 setHeld(held){if(held&&!this.held)this.pressedAt=this.elapsed;if(!held)this.pressedAt=null;this.held=!!held}
 advance(dt){this.remaining=Math.max(0,this.remaining-Math.max(0,dt))}
 commit(run){if(this.committed)return run.startType;if(this.remaining>0)throw Error('Countdown is not finished');this.committed=true;run.startType=this.outcome;if(run.startType==='dash'){run.speed=66;run.boost=Math.max(run.boost,2.1);signal(run,'スタートダッシュ！','launch')}else if(run.startType==='stall'){run.speed=0;run.stall=STALL_SECONDS;run.boost=0;run.boostActive=false;signal(run,'エンスト！','stall')}else signal(run,'GO!','start');return run.startType}
}

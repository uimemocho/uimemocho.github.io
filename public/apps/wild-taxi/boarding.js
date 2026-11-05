export const BOARDING_SECONDS=2.2;
export const DOOR_CLOSE_TIME=2.12;
const clamp=n=>Math.max(0,Math.min(1,n));
export class Boarding{
 constructor(){this.elapsed=0}
 get progress(){return this.elapsed/BOARDING_SECONDS}
 get done(){return this.elapsed>=BOARDING_SECONDS}
 advance(dt){this.elapsed=Math.min(BOARDING_SECONDS,this.elapsed+Math.max(0,dt))}
}
export function boardingPose(progress){
 const t=clamp(progress)*BOARDING_SECONDS,walk=clamp((t-.2)/1.2),enter=clamp((t-1.4)/.3),smooth=enter*enter*(3-2*enter),opening=clamp((t-.12)/.4),closing=clamp((t-1.78)/(DOOR_CLOSE_TIME-1.78)),ease=n=>n*n*(3-2*n);
 return {visible:t<1.7,x:-6.8+4.55*walk+.65*smooth,z:-.96,y:Math.sin(walk*Math.PI*12)*.025*(1-enter),scale:1,stride:walk>0&&walk<1?Math.sin(t*17)*.75:0,wave:walk===0?1:0,door:1.3*ease(opening)*(1-ease(closing))};
}
export {makeBoardingPassenger} from './passengers.js';
export function updateBoardingPassenger(g,progress,at,angle){
 if(!Number.isFinite(progress)){g.visible=false;return}const p=boardingPose(progress);g.visible=p.visible;g.position.set(at.x+p.x*Math.cos(angle)+p.z*Math.sin(angle),.052+p.y,at.z-p.x*Math.sin(angle)+p.z*Math.cos(angle));g.rotation.y=angle+Math.PI/2;const profile=g.userData.profile,foot=.72-.72*Math.cos(p.stride)-.11*Math.abs(Math.sin(p.stride));g.position.y=.052+Math.max(p.y,-foot*(profile?.height||1));g.scale.set(p.scale*(profile?.width||1),p.scale*(profile?.height||1),p.scale*(profile?.width||1));
 g.userData.legs.forEach((leg,i)=>leg.rotation.x=p.stride*(i?1:-1));g.userData.arms.forEach((arm,i)=>{arm.rotation.x=p.stride*(i?-1:1);arm.rotation.z=i?-p.wave*1.9:0});
}

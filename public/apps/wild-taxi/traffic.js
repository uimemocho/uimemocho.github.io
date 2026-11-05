const COLORS=[0x75a8c8,0xe7e9e0,0xcd786c,0x72a997,0xa38dbb];
export function trafficProfile(seed,index){let n=(Math.imul(seed+index*71,1664525)+1013904223)>>>0;const truck=index%3===1;return {vehicleKind:truck?'truck':'car',cruiseSpeed:(truck?12:16)+(n%501)/100,color:COLORS[(n>>>8)%COLORS.length]}}
export const trafficHalfLength=o=>o.vehicleKind==='truck'?5.65:4.5;
export const trafficHalfWidth=o=>o.vehicleKind==='truck'?1.95:1.8;
export function advanceTraffic(run,dt){
 const lanes=[[],[],[]];for(const o of run.objects){if(o.type!=='traffic'||o.used)continue;o.previousD=o.d;if(Number.isFinite(o.cruiseSpeed))lanes[o.lane].push(o)}
 for(const lane of lanes){lane.sort((a,b)=>b.d-a.d);let front=null;for(const o of lane){const gap=front?trafficHalfLength(o)+trafficHalfLength(front)+7:0;o.d=Math.max(o.d,Math.min(o.d+o.cruiseSpeed*dt,front?front.d-gap:Infinity));o.trafficSpeed=dt?(o.d-o.previousD)/dt:0;if(o.d>=run.length+4)o.used=true;else front=o}}
}
// Swept relative-motion test: includes lateral steering and vehicles approaching from behind.
export function trafficContact(o,startD,endD,startX,endX,laneX){
 let enter=0,exit=1;const axis=(start,end,extent)=>{const delta=end-start;if(Math.abs(delta)<1e-9)return Math.abs(start)<=extent;let a=(-extent-start)/delta,b=(extent-start)/delta;if(a>b)[a,b]=[b,a];enter=Math.max(enter,a);exit=Math.min(exit,b);return enter<=exit};
 if(!axis(startD-(o.previousD??o.d),endD-o.d,trafficHalfLength(o))||!axis(startX-laneX,endX-laneX,trafficHalfWidth(o)))return null;return enter>=0&&enter<=1?enter:null;
}

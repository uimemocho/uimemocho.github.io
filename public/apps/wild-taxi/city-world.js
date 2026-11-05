import {clamp,roadOffset} from './track.js';
import {roadFootprint} from './road-mesh.js';
export function rng(seed){let n=seed>>>0;return()=>{n=(Math.imul(n,1664525)+1013904223)>>>0;return n/4294967296}}
export const BUILDING_COLORS=[0xb49c9d,0x8e8fa8,0xc19b8e,0x8e9aaa,0x778b9e,0xa291ae];
export function createStreetObjects(length,seed){const result=[];const rand=rng(seed*83+13);for(let key=0;key<=Math.ceil(length/180);key++)for(let d=key*180+8;d<(key+1)*180&&d<length;d+=25)for(const side of [-1,1]){
 const add=(type,off,delta=0)=>result.push({id:`s${key}-${d}-${side}-${type}`,type,d:d+delta,off:side*off,side,phase:rand()*6.28,color:Math.floor(rand()*6),used:false});
 if(Math.floor(d/25)%2===0)add('lamp',8.2);else add('tree',9.1);
 if(Math.floor(d/25)%4===1)add('vending',10.1);if(Math.floor(d/25)%4===3)add('bench',9.2);
 add('pedestrian',8.5+rand()*1.4,5+rand()*8);if(rand()>.5)add('pedestrian2',8.7+rand(),14);
 }return result}
export function streetPosition(o,time){const person=o.type.startsWith('pedestrian');return {d:o.d+(person?Math.sin(time*.72+o.phase)*2.4:0),off:o.off+(person?Math.sin(time*.43+o.phase)*.8:0)}}
export const personType=t=>t==='pedestrian'||t==='pedestrian2';
// Rendering and collision detection share this placement. Walkers never enter
// the asphalt, including the outer corners and overlapping route sections.
export function streetPlacement(o,time,environment){
 const p=streetPosition(o,time);if(!personType(o.type))return environment?{...p,...roadOffset(environment.sample(p.d),p.off)}:p;
 const side=Math.sign(o.off)||1,base=clamp(Math.abs(p.off),8.1,10.2);
 for(const off of [base,9.4,10.2]){const result={d:p.d,off:side*off};if(!environment)return result;const at=roadOffset(environment.sample(p.d),result.off);if(!environment.roadSurface.intersects(at.x,at.z,.6))return {...result,...at}}
 return null;
}
// A spatial index of the exact triangles used by the rendered road ribbon.
export class RoadSurface{
 constructor(track){this.cells=new Map();const footprint=roadFootprint(track);this.footprint=footprint;const mesh=footprint.roadMesh;for(let i=0;i<mesh.index.length;i+=3){const t=mesh.index.slice(i,i+3).map(n=>[mesh.position[n*3],mesh.position[n*3+2]]);for(let x=Math.floor(Math.min(...t.map(v=>v[0]))/20);x<=Math.floor(Math.max(...t.map(v=>v[0]))/20);x++)for(let z=Math.floor(Math.min(...t.map(v=>v[1]))/20);z<=Math.floor(Math.max(...t.map(v=>v[1]))/20);z++){const key=x+','+z;if(!this.cells.has(key))this.cells.set(key,[]);this.cells.get(key).push(t)}}}
 intersects(x,z,r=0){for(let cx=Math.floor((x-r)/20);cx<=Math.floor((x+r)/20);cx++)for(let cz=Math.floor((z-r)/20);cz<=Math.floor((z+r)/20);cz++)for(const t of this.cells.get(cx+','+cz)||[]){let pos=false,neg=false;for(let i=0;i<3;i++){const a=t[i],b=t[(i+1)%3],dx=b[0]-a[0],dz=b[1]-a[1],cross=dx*(z-a[1])-dz*(x-a[0]);pos||=cross>1e-7;neg||=cross< -1e-7;const q=clamp(((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz||1),0,1);if((x-a[0]-q*dx)**2+(z-a[1]-q*dz)**2<=r*r)return true}if(!(pos&&neg))return true}return false}
}
export function objectSize(type,vehicleKind){if(type==='traffic'&&vehicleKind==='truck')return [2.35,3.2,6.8];return ({taxiDebris:[.8,.36,1.1],lamp:[.4,7,.4],tree:[1.6,4.8,1.6],vending:[1,2.05,.85],bench:[2.8,1.1,.7],pedestrian:[.65,1.8,.5],pedestrian2:[.65,1.8,.5],traffic:[2.1,1.8,4.5],cone:[1.2,1.8,1.2],barrier:[2.9,1.3,.75]})[type]||[1,1,1]}
export class CityWorld{
 constructor(track,seed){this.track=track;this.sample=track.sample;this.length=track.length;this.seed=seed;this.roadSurface=new RoadSurface(track);this.cache=new Map();this.blockers=new Map();for(let d=-20;d<this.length+20;d+=7){const p=this.sample(d),key=Math.floor(p.x/45)+','+Math.floor(p.z/45);if(!this.blockers.has(key))this.blockers.set(key,[]);this.blockers.get(key).push(p)}}
 nearRoad(x,z,r){for(let a=-1;a<=1;a++)for(let b=-1;b<=1;b++){const list=this.blockers.get((Math.floor(x/45)+a)+','+(Math.floor(z/45)+b))||[];if(list.some(p=>(p.x-x)**2+(p.z-z)**2<(r+8)**2))return true}return false}
 keys(distance){const index=Math.floor(distance/180),keys=[];for(let key=Math.max(0,index-1);key<=Math.min(Math.ceil(this.length/180),index+3);key++)keys.push(key);return keys}
 section(key){if(this.cache.has(key))return this.cache.get(key);const random=rng(key*89317+this.seed*71),buildings=[];for(let dd=key*180+8;dd<(key+1)*180&&dd<this.length+120;dd+=25){const p=this.sample(dd);for(const side of [-1,1])for(let layer=0;layer<3;layer++){
  const depth=layer===0?12+random()*8:18+random()*16,front=18+random()*7,offset=side*(layer===0?12+depth/2:47+layer*29+random()*8),at=roadOffset(p,offset),height=layer===0?12+random()*25:24+random()*72;
  if(this.nearRoad(at.x,at.z,depth*.5+1))continue;const color=BUILDING_COLORS[Math.floor(random()*BUILDING_COLORS.length)];buildings.push({id:`b${key}-${dd}-${side}-${layer}`,x:at.x,z:at.z,w:depth,d:front,h:height,c:color,angle:p.angle,side,shop:Math.floor(random()*16),near:layer===0});
 }}const section={key,buildings};this.cache.set(key,section);return section}
}
export function speedIntensity(speed){return clamp((speed-10)/68,0,1)}

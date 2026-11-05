import * as T from './three.module.js';
import {mergeGeometries} from './merge.js';
export function pickupGeometry(kind){
 const pieces=[],add=(g,color,x=0,y=0,z=0)=>{const c=new T.Color(color),n=g.getAttribute('position').count,colors=new Float32Array(n*3);for(let i=0;i<n;i++)colors.set([c.r,c.g,c.b],i*3);g.setAttribute('color',new T.BufferAttribute(colors,3));g.translate(x,y,z);pieces.push(g.index?g.toNonIndexed():g);if(g.index)g.dispose()},box=(w,h,d,c,x=0,y=0,z=0)=>add(new T.BoxGeometry(w,h,d),c,x,y,z),disc=(r,h,c,x=0,y=0,z=0)=>{const g=new T.CylinderGeometry(r,r,h,20);g.rotateX(Math.PI/2);add(g,c,x,y,z)},shape=(points,depth,color,z=0)=>{const s=new T.Shape();points.forEach(([x,y],i)=>i?s.lineTo(x,y):s.moveTo(x,y));s.closePath();const g=new T.ExtrudeGeometry(s,{depth,bevelEnabled:true,bevelSize:.035,bevelThickness:.025,bevelSegments:1,steps:1,curveSegments:4});add(g,color,0,0,z)};
 if(kind==='star'){
  // 無敵：金色の星（厚みのある5角星＋内側の明るい星）
  const star=(R,r)=>Array.from({length:10},(_,i)=>{const a=Math.PI/2+i*Math.PI/5,k=i%2?r:R;return [Math.cos(a)*k,Math.sin(a)*k]});
  shape(star(.95,.42),.26,0xffc400,-.13);shape(star(.62,.28),.06,0xfff3a0,.14);box(.08,.2,.04,0x5a3a00,-.14,.06,.2);box(.08,.2,.04,0x5a3a00,.14,.06,.2);
 }else if(kind==='boost'){
  add(new T.CylinderGeometry(.28,.32,.95,10),0xe7faff,0,.05);add(new T.ConeGeometry(.29,.55,10),0xffae57,0,.8);add(new T.ConeGeometry(.25,.65,8).rotateZ(Math.PI),0x5cddff,0,-.91);
  for(const side of [-1,1])shape([[side*.24,-.17],[side*.62,-.58],[side*.62,-.82],[side*.24,-.53]],.15,0xffae57,-.075);
  disc(.14,.055,0x3db9d9,0,.24,-.29);box(.5,.12,.5,0x607b98,0,-.5);
 }else if(kind==='shield'){
  const points=[[-.82,.68],[0,1],[.82,.68],[.76,-.13],[.46,-.58],[0,-.94],[-.46,-.58],[-.76,-.13]];shape(points,.18,0x76e4ff,-.09);shape(points.map(([x,y])=>[x*.77,y*.77]),.035,0x234567,-.16);
  const a=new T.BoxGeometry(.12,.42,.055);a.rotateZ(.65);add(a,0xe8ffff,-.22,-.03,-.2);const b=new T.BoxGeometry(.12,.79,.055);b.rotateZ(-.6);add(b,0xe8ffff,.12,.12,-.2);
 }else if(kind==='clock'){
  disc(.87,.2,0xffd467);disc(.71,.035,0xfff8da,0,0,-.13);box(.1,.48,.04,0x294665,0,.2,-.17);const hand=new T.BoxGeometry(.1,.48,.04);hand.rotateZ(1);add(hand,0x294665,.18,-.11,-.18);box(.45,.16,.2,0xffd467,0,1.01);box(.13,.47,.1,0x69dfc2,.62,-.67,-.23);box(.47,.13,.1,0x69dfc2,.62,-.67,-.23);
 }else if(kind==='magnet'){
  const s=new T.Shape();s.moveTo(-.83,.84);s.lineTo(-.32,.84);s.lineTo(-.32,-.11);s.quadraticCurveTo(-.32,-.52,0,-.52);s.quadraticCurveTo(.32,-.52,.32,-.11);s.lineTo(.32,.84);s.lineTo(.83,.84);s.lineTo(.83,-.14);s.quadraticCurveTo(.83,-1.01,0,-1.01);s.quadraticCurveTo(-.83,-1.01,-.83,-.14);s.closePath();add(new T.ExtrudeGeometry(s,{depth:.24,bevelEnabled:true,bevelSize:.035,bevelThickness:.03,bevelSegments:1,steps:1,curveSegments:8}),0xee83ba,0,0,-.12);for(const side of [-1,1])box(.52,.35,.34,0xcaf6ff,side*.575,.67);
 }else throw new RangeError('Unknown pickup');
 const merged=mergeGeometries(pieces);for(const g of pieces)g.dispose();if(!merged)throw Error('Pickup merge failed');return merged;
}

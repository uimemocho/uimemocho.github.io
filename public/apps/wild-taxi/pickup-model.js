import * as T from './three.module.js';
import {mergeGeometries} from './merge.js';
export function pickupGeometry(kind){
 const pieces=[],add=(g,color,x=0,y=0,z=0)=>{const c=new T.Color(color),n=g.getAttribute('position').count,colors=new Float32Array(n*3);for(let i=0;i<n;i++)colors.set([c.r,c.g,c.b],i*3);g.setAttribute('color',new T.BufferAttribute(colors,3));g.translate(x,y,z);pieces.push(g.index?g.toNonIndexed():g);if(g.index)g.dispose()},box=(w,h,d,c,x=0,y=0,z=0)=>add(new T.BoxGeometry(w,h,d),c,x,y,z),disc=(r,h,c,x=0,y=0,z=0)=>{const g=new T.CylinderGeometry(r,r,h,20);g.rotateX(Math.PI/2);add(g,c,x,y,z)},shape=(points,depth,color,z=0)=>{const s=new T.Shape();points.forEach(([x,y],i)=>i?s.lineTo(x,y):s.moveTo(x,y));s.closePath();const g=new T.ExtrudeGeometry(s,{depth,bevelEnabled:true,bevelSize:.035,bevelThickness:.025,bevelSegments:1,steps:1,curveSegments:4});add(g,color,0,0,z)};
 if(kind==='star'){
  // 無敵：ネオン管の線の星を3重に巻く（ピンク／シアン／黄、1本ごとにも色が流れる）
  const loops=[[0xff3dbd,0x9a5cff,1.0,0,0],[0x2ef2ff,0x3d7bff,.8,.21,.07],[0xffe23a,0xff7a2e,.6,-.17,-.07]];
  for(const [c0,c1,scale,rot,z] of loops){
   const pts=[];
   for(let i=0;i<10;i++){
    const a0=Math.PI/2+rot+i*Math.PI/5,a1=Math.PI/2+rot+(i+1)*Math.PI/5,r0=(i%2?.42:.98)*scale,r1=((i+1)%2?.42:.98)*scale;
    const p0=[Math.cos(a0)*r0,Math.sin(a0)*r0],p1=[Math.cos(a1)*r1,Math.sin(a1)*r1];
    for(const t of [0,.18,.82])pts.push(new T.Vector3(p0[0]+(p1[0]-p0[0])*t,p0[1]+(p1[1]-p0[1])*t,z));
   }
   // 平たいリボン（星の面内に幅を持つ帯）で軽量に：1本50区間＝100三角形
   const curve=new T.CatmullRomCurve3(pts,true,'centripetal'),N=50,P=curve.getSpacedPoints(N),pos=[],col=[],idx=[],A=new T.Color(c0),B=new T.Color(c1),tmp=new T.Color(),w=.072;
   for(let i=0;i<N;i++){
    const p=P[i],q=P[(i+1)%N],o=P[(i+N-1)%N],tx=q.x-o.x,ty=q.y-o.y,l=Math.hypot(tx,ty)||1,nx=-ty/l*w,ny=tx/l*w;
    pos.push(p.x+nx,p.y+ny,z,p.x-nx,p.y-ny,z);
    tmp.copy(A).lerp(B,.5+.5*Math.sin(i/N*Math.PI*4));col.push(tmp.r,tmp.g,tmp.b,tmp.r,tmp.g,tmp.b);
    const a=i*2,b=((i+1)%N)*2;idx.push(a,a+1,b,a+1,b+1,b);
   }
   const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setAttribute('color',new T.Float32BufferAttribute(col,3));g.setIndex(idx);g.computeVertexNormals();
   pieces.push(g.toNonIndexed());g.dispose();
  }
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

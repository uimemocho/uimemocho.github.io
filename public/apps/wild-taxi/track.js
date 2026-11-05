// Shared camera-space convention: positive lateral values always mean screen-right.
export function roadOffset(p,x){return {x:p.x-Math.cos(p.angle)*x,z:p.z+Math.sin(p.angle)*x,angle:p.angle}}
export const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export function buildTrack(source){
  const clean=source.filter((p,i)=>!i||Math.hypot(p[0]-source[i-1][0],p[1]-source[i-1][1])>.05),rounded=[clean[0]];
  for(let i=1;i<clean.length-1;i++){
    const a=clean[i-1],b=clean[i],c=clean[i+1],d1=Math.hypot(b[0]-a[0],b[1]-a[1]),d2=Math.hypot(c[0]-b[0],c[1]-b[1]);
    const cut=Math.min(7,d1*.3,d2*.3),p=[b[0]+(a[0]-b[0])*cut/d1,b[1]+(a[1]-b[1])*cut/d1],q=[b[0]+(c[0]-b[0])*cut/d2,b[1]+(c[1]-b[1])*cut/d2];
    rounded.push(p);for(let j=1;j<=4;j++){const t=j/4;rounded.push([(1-t)**2*p[0]+2*(1-t)*t*b[0]+t*t*q[0],(1-t)**2*p[1]+2*(1-t)*t*b[1]+t*t*q[1]])}
  }
  rounded.push(clean.at(-1));const points=[rounded[0]];
  for(let i=1;i<rounded.length;i++){const a=points.at(-1),b=rounded[i],d=Math.hypot(b[0]-a[0],b[1]-a[1]);if(d<.02)continue;const count=Math.ceil(d/2.5);for(let j=1;j<=count;j++)points.push([a[0]+(b[0]-a[0])*j/count,a[1]+(b[1]-a[1])*j/count])}
  const distances=[0];for(let i=1;i<points.length;i++)distances.push(distances.at(-1)+Math.hypot(points[i][0]-points[i-1][0],points[i][1]-points[i-1][1]));
  const length=distances.at(-1);
  function raw(d){let lo=0,hi=points.length-2;if(d>=length)lo=hi;else if(d>0)while(lo<hi){const mid=(lo+hi)>>1;if(distances[mid+1]<d)lo=mid+1;else hi=mid}const a=points[lo],b=points[lo+1],t=(d-distances[lo])/(distances[lo+1]-distances[lo]);return{x:a[0]+(b[0]-a[0])*t,z:a[1]+(b[1]-a[1])*t}}
  function sample(d){const p=raw(d),a=raw(d-2),b=raw(d+2);return {...p,angle:Math.atan2(b.x-a.x,b.z-a.z)}}
  function closest(point,hint=0,range=140){let lo=0,hi=points.length-2;const start=Math.max(0,hint-range),end=Math.min(length,hint+range);while(lo<hi){const m=(lo+hi)>>1;if(distances[m+1]<start)lo=m+1;else hi=m}let best=Infinity,found=hint;for(let i=lo;i<points.length-1&&distances[i]<=end;i++){const a=points[i],b=points[i+1],dx=b[0]-a[0],dz=b[1]-a[1],l2=dx*dx+dz*dz,t=clamp(((point.x-a[0])*dx+(point.z-a[1])*dz)/l2,0,1),x=a[0]+dx*t,z=a[1]+dz*t,d=(point.x-x)**2+(point.z-z)**2;if(d<best){best=d;found=distances[i]+Math.sqrt(l2)*t}}const p=sample(found);return {distance:found,x:-(point.x-p.x)*Math.cos(p.angle)+(point.z-p.z)*Math.sin(p.angle),error:Math.sqrt(best)}}
  return {points,distances,length,sample,closest};
}
// Adjacent triangles share their actual edge vertices; no independent segment caps.
export function stripData(points,width,y=0,offset=0){
 const position=[],uv=[],index=[];let d=0;
 for(let i=0;i<points.length;i++){
  const p=points[i],a=points[Math.max(0,i-1)],b=points[Math.min(points.length-1,i+1)];
  const incoming=Math.atan2(p[0]-a[0],p[1]-a[1]),outgoing=Math.atan2(b[0]-p[0],b[1]-p[1]);
  let rx,rz,miter=1;if(i===0){rx=-Math.cos(outgoing);rz=Math.sin(outgoing)}else if(i===points.length-1){rx=-Math.cos(incoming);rz=Math.sin(incoming)}else{rx=-Math.cos(incoming)-Math.cos(outgoing);rz=Math.sin(incoming)+Math.sin(outgoing);const n=Math.hypot(rx,rz);if(n<.01){rx=-Math.cos(outgoing);rz=Math.sin(outgoing)}else{rx/=n;rz/=n;miter=Math.min(2,1/Math.max(.5,rx*-Math.cos(outgoing)+rz*Math.sin(outgoing)))}}
  if(i)d+=Math.hypot(p[0]-a[0],p[1]-a[1]);
  for(let side of [-1,1]){const off=offset+side*width/2;position.push(p[0]+rx*off*miter,y,p[1]+rz*off*miter);uv.push(side<0?0:width/7,d/7)}
  if(i){const n=i*2;index.push(n-2,n-1,n,n-1,n+1,n)}
 }
 return {position,uv,index};
}

export function viewConfig(width,height){const portrait=clamp((.9-width/height)/.45,0,1);return {back:12.5+7.5*portrait,eye:6.3+2.7*portrait,fov:61+9*portrait,softFocal:Math.min(height*.91,width*1.16),horizon:height*(portrait>.5?.42:.36)}}

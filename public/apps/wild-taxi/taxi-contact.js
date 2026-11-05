import {Vector3} from './three.module.js';
export const ROAD_SURFACE_Y=.04,TAXI_PIVOT_Y=.9,CONTACT_GAP=.012;
// Cache solid vertices once; exhaust, smoke and shadows are not contacts.
// The small gap also covers the sub-centimetre change from rotating 16-sided tires.
export function taxiContactPoints(model,excluded=[]){
 const points=[],seen=new Set(),skip=new Set(excluded),v=new Vector3();model.updateMatrixWorld(true);
 function visit(object){
  if(skip.has(object))return;
  if(object.isMesh&&!object.isInstancedMesh){const p=object.geometry.getAttribute('position');
   for(let i=0;i<p.count;i++){v.fromBufferAttribute(p,i).applyMatrix4(object.matrixWorld);const key=[v.x,v.y,v.z].map(n=>n.toFixed(5)).join(',');if(!seen.has(key)){seen.add(key);points.push(v.x,v.y-TAXI_PIVOT_Y,v.z)}}
  }
  for(const child of object.children)visit(child);
 }visit(model);return new Float32Array(points);
}
export function taxiContactHeight(points,q){
 // The world-Y row of the rotation matrix, without per-frame vectors or raycasts.
 const a=2*(q.x*q.y+q.w*q.z),b=1-2*(q.x*q.x+q.z*q.z),c=2*(q.y*q.z-q.w*q.x);let low=Infinity;
 for(let i=0;i<points.length;i+=3)low=Math.min(low,a*points[i]+b*points[i+1]+c*points[i+2]);
 return ROAD_SURFACE_Y+CONTACT_GAP-low;
}

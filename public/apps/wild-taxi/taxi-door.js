import * as T from './three.module.js';
export const DOOR_HINGE={x:-1.06,z:-.18};
// Partition the actual left rear body skin, so the opening has no duplicate faces.
export function splitDoorShell(source){
 const geometry=source.index?source.toNonIndexed():source,planes=[[0,-1,-.99],[2,1,1.16],[2,-1,-.18],[1,1,-.52]],fixed=[],door=[];
 const interpolate=(a,b,t)=>a.map((v,i)=>v+(b[i]-v)*t);
 function clip(poly,plane,inside){const [axis,sign,offset]=plane,result=[];for(let i=0;i<poly.length;i++){const a=poly[(i+poly.length-1)%poly.length],b=poly[i],da=sign*a[axis]+offset,db=sign*b[axis]+offset,ia=inside?da>=0:da<=0,ib=inside?db>=0:db<=0;if(ia!==ib)result.push(interpolate(a,b,da/(da-db)));if(ib)result.push(b)}return result}
 function emit(poly,out){for(let i=1;i<poly.length-1;i++){const v=[poly[0],poly[i],poly[i+1]],a=new T.Vector3(...v[0].slice(0,3)),b=new T.Vector3(...v[1].slice(0,3)),c=new T.Vector3(...v[2].slice(0,3));if(b.sub(a).cross(c.sub(a)).lengthSq()>1e-14)out.push(...v)}}
 const p=geometry.getAttribute('position'),n=geometry.getAttribute('normal'),uv=geometry.getAttribute('uv');
 for(let i=0;i<p.count;i+=3){let poly=[0,1,2].map(j=>[p.getX(i+j),p.getY(i+j),p.getZ(i+j),n.getX(i+j),n.getY(i+j),n.getZ(i+j),uv.getX(i+j),uv.getY(i+j)]);for(const plane of planes){emit(clip(poly,plane,false),fixed);poly=clip(poly,plane,true);if(!poly.length)break}emit(poly,door)}
 function build(vertices){const g=new T.BufferGeometry();for(const [name,start,size] of [['position',0,3],['normal',3,3],['uv',6,2]])g.setAttribute(name,new T.Float32BufferAttribute(vertices.flatMap(v=>v.slice(start,start+size)),size));g.normalizeNormals();return g}
 const result={body:build(fixed),door:build(door)};if(geometry!==source)geometry.dispose();source.dispose();return result;
}

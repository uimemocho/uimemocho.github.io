import C from './vendor/clipper.mjs';
import {ShapeUtils,Vector2} from './three.module.js';
import {roadOffset} from './track.js';
import {ROAD_SURFACE_Y} from './taxi-contact.js';
const S=10000,cache=new Map();
const integer=p=>({X:Math.round(p[0]*S),Y:Math.round(p[1]*S)});
export function combine(a,b=[],type='union'){
 const c=new C.Clipper();c.StrictlySimple=true;c.AddPaths(a,C.PolyType.ptSubject,true);if(b.length)c.AddPaths(b,C.PolyType.ptClip,true);const tree=new C.PolyTree();
 c.Execute({union:C.ClipType.ctUnion,difference:C.ClipType.ctDifference,intersection:C.ClipType.ctIntersection}[type],tree,C.PolyFillType.pftNonZero,C.PolyFillType.pftNonZero);
 return C.Clipper.PolyTreeToPaths(tree);
}
export function stroke(paths,radius){const co=new C.ClipperOffset(2,.018*S);co.AddPaths(paths,C.JoinType.jtRound,C.EndType.etOpenRound);const out=[];co.Execute(out,radius*S);return out}
export const surfaceArea=paths=>Math.abs(paths.reduce((area,p)=>area+C.Clipper.Area(p),0))/(S*S);
export function triangulate(paths,y=ROAD_SURFACE_Y){
 const clipper=new C.Clipper();clipper.StrictlySimple=true;clipper.AddPaths(paths,C.PolyType.ptSubject,true);const tree=new C.PolyTree();clipper.Execute(C.ClipType.ctUnion,tree,C.PolyFillType.pftNonZero,C.PolyFillType.pftNonZero);
 const position=[],normal=[],uv=[],index=[];
 for(const polygon of C.JS.PolyTreeToExPolygons(tree)){
  const contour=polygon.outer.map(p=>new Vector2(p.X/S,p.Y/S)),holes=polygon.holes.map(h=>h.map(p=>new Vector2(p.X/S,p.Y/S))),vertices=contour.concat(...holes),base=position.length/3;
  for(const p of vertices){position.push(p.x,y,p.y);normal.push(0,1,0);uv.push(p.x/7,p.y/7)}
  for(const t of ShapeUtils.triangulateShape(contour,holes)){const [a,b,c]=t.map(i=>vertices[i]),cross=(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);if(Math.abs(cross)<1e-9)continue;index.push(...(cross>0?[t[0],t[2],t[1]]:t).map(i=>base+i))}
 }
 return {position,normal,uv,index};
}
function pathFor(track){
 const first=track.sample(-45),last=track.sample(track.length+45),source=track.points||Array.from({length:Math.ceil(track.length/2)+1},(_,i)=>{const p=track.sample(Math.min(track.length,i*2));return [p.x,p.z]}),raw=[[first.x,first.z],...source,[last.x,last.z]],result=[];
 for(const p of raw){const q=integer(p);if(result.length&&q.X===result.at(-1).X&&q.Y===result.at(-1).Y)continue;
  while(result.length>1){const a=result.at(-2),b=result.at(-1),dx=q.X-a.X,dy=q.Y-a.Y,length=Math.hypot(dx,dy);if(!length||Math.abs(dx*(b.Y-a.Y)-dy*(b.X-a.X))/length>.012*S||(b.X-a.X)*(q.X-b.X)+(b.Y-a.Y)*(q.Y-b.Y)<0)break;result.pop()}
  result.push(q);
 }return result;
}
function entry(track){const line=pathFor(track);let hash=2166136261;for(const p of line)for(const n of [p.X,p.Y])hash=Math.imul(hash^(n|0),16777619);const key=hash+':'+line.length+':'+Math.round(track.length);if(cache.has(key))return cache.get(key);const road=stroke([line],6.1),e={line,road,roadMesh:triangulate(road)};cache.set(key,e);if(cache.size>4)cache.delete(cache.keys().next().value);return e}
export function roadFootprint(track){return entry(track)}
export function roadLayout(track){
 const e=entry(track);if(e.layout)return e.layout;
 const outer=stroke([e.line],11),curbOuter=stroke([e.line],6.45),edgeOuter=stroke([e.line],5.96),edgeInner=stroke([e.line],5.8),edges=combine(edgeOuter,edgeInner,'difference'),dashes=[],crossings=[];
 for(let d=-20;d<track.length+20;d+=7)for(const off of [-1.85,1.85]){
  const line=[];for(let t=0;t<=4;t++){const p=roadOffset(track.sample(d+t*3.5/4),off);const q=integer([p.x,p.z]);while(line.length>1){const a=line.at(-2),b=line.at(-1),dx=q.X-a.X,dy=q.Y-a.Y;if(Math.abs(dx*(b.Y-a.Y)-dy*(b.X-a.X))/Math.max(1,Math.hypot(dx,dy))>.005*S)break;line.pop()}line.push(q)}dashes.push(line);
 }
 const dashPaint=stroke(dashes,.085);
 for(let d=145;d<track.length;d+=180){const a=track.sample(d-8),b=track.sample(d+8),angle=Math.atan2(Math.sin(a.angle-b.angle),Math.cos(a.angle-b.angle));if(Math.abs(angle)>.15)continue;for(let n=-3;n<=3;n++){const p=track.sample(d+n*1.45),a=roadOffset(p,-5.2),b=roadOffset(p,5.2);crossings.push([integer([a.x,a.z]),integer([b.x,b.z])])}}
 const crossingPaint=crossings.length?stroke(crossings,.325):[],paint=combine(combine(edges,[...dashPaint,...crossingPaint]),e.road,'intersection');
 const metal=[],asphalt=combine(e.road,paint,'difference'),curb=combine(curbOuter,e.road,'difference'),walk=combine(outer,curbOuter,'difference');
 const paths={asphalt,paint,metal,curb,walk},meshes={};for(const key in paths)meshes[key]=triangulate(paths[key]);
 e.layout={paths,meshes,road:e.roadMesh,outer:triangulate(outer)};return e.layout;
}

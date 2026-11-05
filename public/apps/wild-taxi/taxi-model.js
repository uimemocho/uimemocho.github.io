import * as T from './three.module.js';
// One sedan silhouette for WebGL and the lightweight Canvas renderer.
export const TAXI_BODY=[{kind:'body',w:2.12,h:.7,d:4.55,x:0,y:.7,z:0},{w:1.62,h:.14,d:1.42,x:0,y:1.78,z:-.095}];
const LF=[-.94,1.08,1.05],RF=[.94,1.08,1.05],LB=[-.94,1.08,-1.16],RB=[.94,1.08,-1.16],TLF=[-.76,1.71,.55],TRF=[.76,1.71,.55],TLB=[-.76,1.71,-.74],TRB=[.76,1.71,-.74];
export const TAXI_WINDOWS=[{name:'front',points:[LF,RF,TRF,TLF]},{name:'rear',points:[RB,LB,TLB,TRB]},...[-1,1].flatMap(s=>[{name:'side-front',points:[[s*.94,1.08,1.05],[s*.94,1.08,-.12],[s*.76,1.71,-.15],[s*.76,1.71,.55]]},{name:'side-rear',points:[[s*.94,1.08,-.2],[s*.94,1.08,-1.16],[s*.76,1.71,-.74],[s*.76,1.71,-.22]]}])];
export const TAXI_PILLARS=[[LF,TLF],[RF,TRF],[LB,TLB],[RB,TRB],[LF,LB],[RF,RB],...[-1,1].map(s=>[[s*.94,1.08,-.16],[s*.76,1.71,-.185]])];
export function outwardPanel(points){const center=points.reduce((a,p)=>a.map((n,i)=>n+p[i]/points.length),[0,0,0]),a=points[0],b=points[1],c=points[2],u=b.map((n,i)=>n-a[i]),v=c.map((n,i)=>n-a[i]),normal=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];return normal[0]*center[0]+normal[1]*(center[1]-1.4)+normal[2]*center[2]<0?[...points].reverse():points}

export const TAXI_WHEEL_Z=[-1.44,1.42],TAXI_WHEEL_RADIUS=.37;
export function bodyProfile(){const points=[[-2.25,1.025],[2.25,1.025],[2.25,.375]];for(const z of [...TAXI_WHEEL_Z].reverse()){for(let i=0;i<=16;i++){const a=i*Math.PI/16;points.push([z+Math.cos(a)*.46,.375+Math.sin(a)*.46])}}points.push([-2.25,.375]);return points}
export function sedanBodyGeometry(){const shape=new T.Shape();bodyProfile().forEach(([z,y],i)=>i?shape.lineTo(z,y):shape.moveTo(z,y));shape.closePath();const geometry=new T.ExtrudeGeometry(shape,{depth:2.07,bevelEnabled:true,bevelSize:.025,bevelThickness:.025,bevelSegments:1,curveSegments:1,steps:1});geometry.translate(0,0,-1.035);geometry.rotateY(-Math.PI/2);return geometry}

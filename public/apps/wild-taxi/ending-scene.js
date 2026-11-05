import * as T from './three.module.js';
import {mergeGeometries} from './merge.js';
import {makeBoardingPassenger,passengerForStage,disposePassenger} from './passengers.js';
export const celebrationHeight=(time,phase,reduced=false)=>reduced?0:Math.pow(Math.max(0,Math.sin(time*4.5+phase)),1.4)*.42;
export function createEndingCrowd(seed,origin,angle){
 const parts=[],profiles=[];
 for(let i=0;i<30;i++){
  const profile=passengerForStage(i,seed),person=makeBoardingPassenger(profile),row=Math.floor(i/6),column=i%6,x=(column-2.5)*1.3+(row%2?.22:-.22),z=-3.7-row*2.2,phase=i*2.39996;
  profiles.push(profile.key);person.scale.set(profile.width,profile.height,profile.width);person.position.set(origin.x+x*Math.cos(angle)+z*Math.sin(angle),.052,origin.z-x*Math.sin(angle)+z*Math.cos(angle));person.rotation.y=angle+.27;person.userData.arms.forEach((arm,n)=>arm.rotation.z=(n?1:-1)*2.78);person.updateMatrixWorld(true);
  person.traverse(object=>{if(!object.isMesh)return;const raw=object.geometry,g=(raw.index?raw.toNonIndexed():raw.clone()).applyMatrix4(object.matrixWorld),n=g.getAttribute('position').count,color=object.material.color,colors=new Float32Array(n*3),phases=new Float32Array(n);g.deleteAttribute('uv');for(let k=0;k<n;k++){colors.set([color.r,color.g,color.b],k*3);phases[k]=phase}g.setAttribute('color',new T.BufferAttribute(colors,3));g.setAttribute('celebrationPhase',new T.BufferAttribute(phases,1));parts.push(g)});disposePassenger(person);
 }
 const geometry=mergeGeometries(parts);for(const g of parts)g.dispose();if(!geometry)throw Error('Ending crowd geometry could not be merged');
 const material=new T.MeshLambertMaterial({vertexColors:true}),time={value:0},motion={value:1};material.onBeforeCompile=shader=>{shader.uniforms.uCelebrationTime=time;shader.uniforms.uCelebrationMotion=motion;shader.vertexShader='attribute float celebrationPhase;uniform float uCelebrationTime;uniform float uCelebrationMotion;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\ntransformed.y+=pow(max(0.0,sin(uCelebrationTime*4.5+celebrationPhase)),1.4)*.42*uCelebrationMotion;')};material.customProgramCacheKey=()=> 'taxi-ending-crowd-v1';
 const mesh=new T.Mesh(geometry,material);mesh.frustumCulled=false;mesh.userData={endingCrowd:true,count:30,profiles,time,motion};return mesh;
}

export class DebugOptions{
 constructor(){this.reset()}
 reset(){this.enabled=false;this.course=0;this.position=0;this.phase='auto';this.kind='auto';this.lights='auto';this.camera='rear';this.damage=0;this.item=null}
 weather(live){if(!this.enabled)return live;const phase=this.phase==='auto'?live.phase:this.phase,kind=this.kind==='auto'?live.kind:this.kind,cloud=this.kind==='auto'?live.cloud:{clear:.12,cloud:.8,rain:.9,snow:.85,fog:1,storm:1}[kind],lights=this.lights==='auto'?phase!=='day'||['rain','snow','fog','storm'].includes(kind):this.lights==='on';return {...live,phase,kind,cloud,lights,source:'debug',temperature:null,intensity:['rain','snow','storm'].includes(kind)?.75:0}}
}
export const CAMERA_NAMES={rear:'後ろ',front:'前',left:'横',top:'上'};
export function courseCorners(track){const peaks=[];let cluster=null;for(let d=8;d<track.length-8;d+=3){const a=track.sample(d-6).angle,b=track.sample(d+6).angle,turn=Math.abs(Math.atan2(Math.sin(b-a),Math.cos(b-a)));if(turn>.3){if(!cluster||d-cluster.last>15){if(cluster)peaks.push(cluster.distance);cluster={distance:d,turn,last:d}}else{cluster.last=d;if(turn>cluster.turn){cluster.distance=d;cluster.turn=turn}}}}if(cluster)peaks.push(cluster.distance);return peaks}
export function adjacentCorner(track,distance,direction){const corners=courseCorners(track);return direction>0?corners.find(d=>d>distance+8)??Math.max(0,track.length-12):corners.filter(d=>d<distance-8).at(-1)??0}

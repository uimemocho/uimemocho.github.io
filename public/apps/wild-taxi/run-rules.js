export const MAX_ROLLOVERS=2;
export function courseTimeLimit(track){let turns=0;for(let d=10;d<track.length-10;d+=18){const a=track.sample(d-8).angle,b=track.sample(d+8).angle;if(Math.abs(Math.atan2(Math.sin(b-a),Math.cos(b-a)))>.6)turns++}return Math.max(25,Math.ceil(track.length/32+10+Math.min(10,turns*.6)))}

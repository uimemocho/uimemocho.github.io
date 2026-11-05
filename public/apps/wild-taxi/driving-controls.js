// Keep each contact's role independent; touch click synthesis is primary-only on some browsers.
export function bindDrivingControls({surface,accelerator,item,root,enabled,onAccelerate,onSteer,onItem,onUnlock=()=>{}}){
 const pedals=new Map(),captures=new Map(),listeners=[];let steering=null,keyboardGas=false;
 const listen=(el,type,handler)=>{el.addEventListener(type,handler,{passive:false});listeners.push(()=>el.removeEventListener(type,handler))};
 const primaryButton=e=>e.pointerType==='touch'||e.button===0;
 const capture=(el,id)=>{try{el.setPointerCapture(id);captures.set(id,el)}catch{}};
 const gas=()=>onAccelerate(keyboardGas||pedals.size>0);
 listen(accelerator,'pointerdown',e=>{if(!enabled()||!primaryButton(e))return;e.preventDefault();e.stopPropagation();pedals.set(e.pointerId,{x:e.clientX,start:e.clientX,dragging:false});capture(accelerator,e.pointerId);gas();onUnlock()});
 listen(surface,'pointerdown',e=>{if(!enabled()||!primaryButton(e)||steering)return;e.preventDefault();steering={id:e.pointerId,x:e.clientX};capture(surface,e.pointerId)});
 listen(item,'pointerdown',e=>{if(!enabled()||item.disabled||!primaryButton(e))return;e.preventDefault();e.stopPropagation();onItem();onUnlock()});
 // Pointer use happens on down, while keyboard/screen-reader activation still uses click.
 listen(item,'click',e=>{if(e.detail===0&&!e.pointerType&&enabled()&&!item.disabled){e.preventDefault();onItem()}});
 listen(root,'pointermove',e=>{if(!enabled())return;if(steering?.id===e.pointerId){onSteer(e.clientX-steering.x);steering.x=e.clientX;e.preventDefault();return}const pedal=pedals.get(e.pointerId);if(!pedal)return;e.preventDefault();if(steering||pedals.keys().next().value!==e.pointerId){pedal.x=pedal.start=e.clientX;pedal.dragging=false;return}if(!pedal.dragging&&Math.abs(e.clientX-pedal.start)>=6){pedal.dragging=true;onSteer(e.clientX-pedal.start)}else if(pedal.dragging)onSteer(e.clientX-pedal.x);pedal.x=e.clientX});
 const finish=e=>{const owner=captures.get(e.pointerId);captures.delete(e.pointerId);if(steering?.id===e.pointerId)steering=null;if(pedals.delete(e.pointerId))gas();try{if(owner?.hasPointerCapture(e.pointerId))owner.releasePointerCapture(e.pointerId)}catch{}};
 for(const type of ['pointerup','pointercancel','lostpointercapture'])listen(root,type,finish);
 const release=()=>{pedals.clear();steering=null;keyboardGas=false;gas();const old=[...captures];captures.clear();for(const [id,el] of old)try{if(el.hasPointerCapture(id))el.releasePointerCapture(id)}catch{}};
 return {get accelerating(){return keyboardGas||pedals.size>0},release,setKeyboardAccelerator(held){keyboardGas=!!held;gas()},dispose(){release();for(const remove of listeners)remove()}};
}

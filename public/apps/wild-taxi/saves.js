import {normalizeTourResults} from './tour-results.js';
export const SAVE_KEY='bakusoku-taxi-saves-v1';
export function validProgress(value){return !!value&&Number.isInteger(value.nextStage)&&value.nextStage>=0&&value.nextStage<=30&&Number.isInteger(value.seed)&&value.seed>=0&&value.seed<=0x7fffffff}
const resultFields=value=>Array.isArray(value.results)?{results:normalizeTourResults(value.results)}:{};
const record=value=>validProgress(value)&&Number.isFinite(value.updatedAt)&&value.updatedAt>0&&Number.isFinite(new Date(value.updatedAt).getTime())?{nextStage:value.nextStage,seed:value.seed,updatedAt:value.updatedAt,...resultFields(value)}:null;
export function nextCheckpoint(index,seed){if(!Number.isInteger(index)||index<0||index>29)throw new RangeError('Invalid mission');return {nextStage:index+1,seed}}
export function resumeCheckpoint(value){if(!validProgress(value))throw new TypeError('Invalid save');return value.nextStage===30?{nextStage:0,seed:(value.seed+97)%0x80000000}:{nextStage:value.nextStage,seed:value.seed,...resultFields(value)}}
export class SaveStore{
 constructor(storage,now=Date.now){this.storage=storage;this.now=now;this.data={version:1,auto:null,slots:[null,null,null]};this.error=null;try{const raw=storage.getItem(SAVE_KEY);if(raw){const saved=JSON.parse(raw);if(saved.version!==1)throw Error('version');this.data={version:1,auto:record(saved.auto),slots:[0,1,2].map(i=>record(saved.slots?.[i]))}}}catch{this.error='read'}}
 get hasAny(){return !!this.data.auto||this.data.slots.some(Boolean)}
 get(slot){return slot==='auto'?this.data.auto:Number.isInteger(slot)&&slot>=0&&slot<3?this.data.slots[slot]:null}
 write(slot,progress){if(slot!=='auto'&&(!Number.isInteger(slot)||slot<0||slot>2))throw new RangeError('Invalid slot');if(!validProgress(progress))throw new TypeError('Invalid progress');const value={nextStage:progress.nextStage,seed:progress.seed,updatedAt:this.now(),...resultFields(progress)},next={version:1,auto:this.data.auto,slots:[...this.data.slots]};if(slot==='auto')next.auto=value;else next.slots[slot]=value;try{this.storage.setItem(SAVE_KEY,JSON.stringify(next));this.data=next;this.error=null;return true}catch{this.error='write';return false}}
}

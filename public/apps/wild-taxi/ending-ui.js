import {tourTime,recordTourLeg} from './tour-results.js';
import {money} from './settlement.js';
export function populateEnding(summary,preview=false,doc=document){
 const $=id=>doc.getElementById(id);$('endingScreen').dataset.complete=String(summary.perfect);$('endingHeadingText').textContent=summary.perfect?'ALL COMPLETE':'ALL CLEAR';$('endingKicker').textContent=preview?'DEBUG PREVIEW · 30 STATIONS':'YAMANOTE · 30 STATIONS';$('endingRank').textContent=summary.grade;$('endingSSS').textContent=summary.sss+' / 30';$('endingTime').textContent=tourTime(summary.elapsed);$('endingReward').textContent=summary.net===null?'—':money(summary.net);$('endingReward').classList.toggle('negative',summary.net<0);$('endingRecordNote').textContent=summary.recorded<30?'集計 '+summary.recorded+' / 30 区間':'';$('endingReplay').textContent=preview?'デバッグに戻る':'もう一周';$('endingDetails').hidden=preview;$('endingPerfectBadge').hidden=!summary.perfect;
}
// Read-only debug previews never update a journey or a save slot.
export function previewTour(perfect,seed){let progress={nextStage:0,seed};for(let i=0;i<30;i++)progress=recordTourLeg(progress,i,{status:'delivered',length:1200,elapsed:perfect?24.2+i*.03:29+i%5*1.5,hits:perfect?0:i%6===0?1:0,crashes:0,damageCounts:{},smashes:0});return progress}

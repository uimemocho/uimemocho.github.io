import {endingShareText,makeEndingCard} from './ending-share.js';
import {settlement,money} from './settlement.js';
import {rankRun} from './tour.js';
export const GAME_URL='https://uimemocho.github.io/apps/wild-taxi/';
export function shareText(run,from,to,stage){
 const bill=settlement(run),rank=rankRun(run);
 return ['ワイルドタクシー'+(run.debug?' [DEBUG]':''),`${from} → ${to}｜${run.status==='delivered'?'お届け完了！':run.status==='wrecked'?'大破でゲームオーバー':'TIME UP'}`,`ランク ${rank.grade} ／ ${run.elapsed.toFixed(2)}秒`+(stage?` ／ ${stage}/30駅` :''),`区間運賃 ${money(bill.fare)} ／ 被害総額 ¥${bill.damage.toLocaleString('ja-JP')}`,`今回の報酬 ${money(bill.net)}`,'#ワイルドタクシー #個人開発 #ゲーム制作'].join('\n');
}
export function shareResult(run,from,to,stage){const url=new URL('https://x.com/intent/tweet');url.searchParams.set('text',shareText(run,from,to,stage));url.searchParams.set('url',GAME_URL);return url.href}
export function makeResultCard(run,from,to,stage,scene){
 if(!scene?.width||!scene?.height)throw new Error('A game scene is required for the share card');
 const canvas=document.createElement('canvas');canvas.width=1200;canvas.height=900;const c=canvas.getContext('2d'),bill=settlement(run),rank=rankRun(run),W=1200,H=900;
 c.imageSmoothingEnabled=true;c.imageSmoothingQuality='high';c.drawImage(scene,0,0,W,H);
 const left=c.createLinearGradient(0,0,1050,0);left.addColorStop(0,'#101d30f5');left.addColorStop(.48,'#101d30dc');left.addColorStop(.73,'#101d3060');left.addColorStop(1,'#101d3000');c.fillStyle=left;c.fillRect(0,0,W,H);
 const top=c.createLinearGradient(0,0,0,380);top.addColorStop(0,'#0e1b3080');top.addColorStop(1,'#0e1b3000');c.fillStyle=top;c.fillRect(0,0,W,380);
 const fit=(text,family,weight,max,min,width)=>{let size=max;while(size>min){c.font=`${weight} ${size}px ${family}`;if(c.measureText(text).width<=width)break;size--}return size};
 const rule=(x,y,width,color='#fff5e633')=>{c.fillStyle=color;c.fillRect(x,y,width,1)};
 c.textAlign='left';c.textBaseline='alphabetic';c.fillStyle='#ffd24b';c.fillRect(64,51,6,22);c.font='500 24px Oswald,sans-serif';c.fillStyle='#fff5e6';c.fillText(`${run.debug?'DEBUG / ':''}MISSION ${String(stage||1).padStart(2,'0')} / 30`,84,72);
 fit('ワイルドタクシー','"Dela Gothic One",sans-serif',400,76,50,610);c.fillStyle='#fff8ed';c.fillText('ワイルド',60,168);const titleWidth=c.measureText('ワイルド').width;c.fillStyle='#ffd24b';c.fillText('タクシー',60+titleWidth,168);
 c.font='700 23px "Zen Kaku Gothic New",sans-serif';c.fillStyle='#c7d6df';c.fillText('山手線タイムアタック',64,213);
 const route=from+' → '+to;fit(route,'"Cityline Noto JP",sans-serif',900,42,25,530);c.fillStyle='#fff8ed';c.fillText(route,64,286,530);
 c.font='700 22px "Zen Kaku Gothic New",sans-serif';c.fillStyle=run.status==='delivered'?'#8ee2cc':'#ffb394';c.fillText(run.status==='delivered'?'お届け完了！':run.status==='wrecked'?'大破・ゲームオーバー':'TIME UP',64,330);
 rule(64,359,420);c.font='500 19px Oswald,sans-serif';c.fillStyle='#a4bdcf';c.fillText('LEG RANK',67,398);
 c.save();c.translate(68,0);c.transform(1,0,-.1,1,51,0);c.font='600 174px Oswald,sans-serif';c.fillStyle=rank.grade==='F'?'#d5e0e8':'#ffe185';c.fillText(rank.grade,0,558);c.restore();
 c.font='400 62px Oswald,sans-serif';c.fillStyle='#fff8ed';const timing=run.elapsed.toFixed(2);c.fillText(timing,64,645);const tw=c.measureText(timing).width;c.font='700 21px "Zen Kaku Gothic New",sans-serif';c.fillText('秒',75+tw,642);c.font='700 20px "Zen Kaku Gothic New",sans-serif';c.fillStyle='#c7d6df';c.fillText(`安全 ${rank.safety}%  /  速さ ${rank.speed}%`,64,679);
 // A quiet baseline keeps accounting readable without covering the taxi silhouette.
 c.fillStyle='#101e30f5';c.fillRect(0,714,W,186);c.fillStyle='#ffd24b';c.fillRect(64,714,82,4);rule(146,714,990);
 const column=(label,value,x,width,size,color)=>{c.textAlign='left';c.font='700 22px "Zen Kaku Gothic New",sans-serif';c.fillStyle='#bdcedb';c.fillText(label,x,759);fit(value,'Oswald,sans-serif',600,size,29,width);c.fillStyle=color;c.fillText(value,x,828,width)};
 column('区間運賃',money(bill.fare),64,224,48,'#fff8ed');column('被害総額',money(-bill.damage),340,290,45,'#ffb394');column('今回の報酬',money(bill.net),697,439,66,bill.net<0?'#ffb394':'#ffe185');
 c.fillStyle='#fff5e626';c.fillRect(311,746,1,85);c.fillRect(664,746,1,85);
 c.font='500 16px "Zen Kaku Gothic New",sans-serif';c.fillStyle='#9fb4c5';c.fillText('運賃・被害額はゲーム内の設定です。',64,875);c.textAlign='right';c.font='400 18px Oswald,sans-serif';c.fillText('uimemocho.github.io/apps/wild-taxi',1136,875);c.textAlign='center';c.font='400 15px sans-serif';c.fillText('© OpenStreetMap contributors',620,875);
 return canvas;
}
export class ResultShare{
 constructor(){this.version=0;this.file=null;this.url=null}
 clear(){this.version++;this.file=null;this.filename=null;if(this.url)URL.revokeObjectURL(this.url);this.url=null}
 prepare(run,from,to,stage,scene){return this.prepareImage(shareText(run,from,to,stage),'wild-taxi-result.png',()=>makeResultCard(run,from,to,stage,scene),[['400 76px "Dela Gothic One"','ワイルドタクシー'],['900 42px "Cityline Noto JP"',from+' → '+to],['700 22px "Zen Kaku Gothic New"','山手線タイムアタック区間運賃被害総額今回の報酬安全速さお届け完了大破ゲームオーバー'],['600 66px Oswald','0123456789SSSFA¥−.,']])}
 prepareEnding(summary,preview,scene){return this.prepareImage(endingShareText(summary,preview),'wild-taxi-ending.png',()=>makeEndingCard(summary,preview,scene),[['400 60px "Dela Gothic One"','ワイルドタクシー'],['900 22px "Cityline Noto JP"','総合評価総走行タイム報酬区間集計'],['600 140px Oswald','ALL CLEAR! COMPLETE! THANK YOU SSS0123456789¥−.,']])}
 async prepareImage(text,filename,build,fonts){this.clear();const version=this.version,url=new URL('https://x.com/intent/tweet');url.searchParams.set('text',text);url.searchParams.set('url',GAME_URL);this.intent=url.href;this.text=text+'\n'+GAME_URL;
  try{if(document.fonts?.load)await Promise.all(fonts.map(args=>document.fonts.load(...args)));if(version!==this.version)return;const canvas=build(),blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));if(version!==this.version||!blob)return;if(typeof File==='function')this.file=new File([blob],filename,{type:'image/png'});this.filename=filename;this.url=URL.createObjectURL(blob);return this.url}catch{return null}
 }
 canShare(){try{return !!(this.file&&navigator.canShare?.({files:[this.file]})&&navigator.share)}catch{return false}}
 // Invoked directly from the tap handler: no await before native sharing.
 nativeShare(){return navigator.share({files:[this.file],title:'ワイルドタクシー',text:this.text})}
}

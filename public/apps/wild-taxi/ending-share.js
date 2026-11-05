import {tourTime} from './tour-results.js';
import {money} from './settlement.js';
export function endingShareText(summary,preview=false){return ['ワイルドタクシー'+(preview?' [DEBUG]':''),summary.perfect?'ALL COMPLETE! 全30区間SSS達成！':'ALL CLEAR! 山手線、一周達成！',`総合評価 ${summary.grade} ／ SSS ${summary.sss}/30区間`,`総走行タイム ${tourTime(summary.elapsed)}`,`総報酬 ${summary.net===null?'—':money(summary.net)}`,...(summary.recorded<30?[`集計 ${summary.recorded}/30区間`]:[]),'#ワイルドタクシー #個人開発 #ゲーム制作'].join('\n')}
export function makeEndingCard(summary,preview,scene){
 if(!scene?.width||!scene?.height)throw Error('An ending scene is required');
 const canvas=document.createElement('canvas');canvas.width=1200;canvas.height=900;const c=canvas.getContext('2d');c.fillStyle='#142132';c.fillRect(0,0,1200,900);c.imageSmoothingEnabled=true;c.imageSmoothingQuality='high';
 // Keep the complete car and all passengers inside a dedicated photograph area.
 c.drawImage(scene,400,212,800,510);const fade=c.createLinearGradient(400,0,520,0);fade.addColorStop(0,'#142132');fade.addColorStop(1,'#14213200');c.fillStyle=fade;c.fillRect(400,212,120,510);
 const bottom=c.createLinearGradient(0,654,0,722);bottom.addColorStop(0,'#14213200');bottom.addColorStop(1,'#142132');c.fillStyle=bottom;c.fillRect(400,654,800,68);
 const fit=(text,family,weight,size,min,width)=>{do{c.font=`${weight} ${size}px ${family}`;if(c.measureText(text).width<=width)break}while(--size>min)};
 c.textBaseline='alphabetic';c.textAlign='left';c.fillStyle='#ffd24b';c.fillRect(64,45,6,20);c.fillStyle='#c2cfdb';c.font='500 20px Oswald,sans-serif';c.fillText(preview?'DEBUG PREVIEW / YAMANOTE 30 STATIONS':'YAMANOTE / 30 STATIONS',84,63);
 c.font='400 60px "Dela Gothic One",sans-serif';c.fillStyle='#fff5e6';c.fillText('ワイルド',60,144);const brand=c.measureText('ワイルド').width;c.fillStyle='#ffd24b';c.fillText('タクシー',60+brand,144);
 c.save();c.translate(64,216);c.transform(1,0,-.08,1,0,0);c.font='600 47px Oswald,sans-serif';c.fillStyle=summary.perfect?'#ffe19a':'#fff5e6';const headline=summary.perfect?'ALL COMPLETE':'ALL CLEAR';c.fillText(headline,0,0);c.fillText('!',c.measureText(headline).width+6,0);c.restore();
 c.font='500 26px Oswald,sans-serif';c.fillStyle='#ffe19a';c.fillText('T H A N K  Y O U',64,263);
 // Confetti belongs to the image as well as the live ending.
 const colors=['#ffe38a','#fff5e6','#8ce1cd','#ffab89','#a6bdf4'];for(let i=0;i<90;i++){const x=450+(i*137.31)%720,y=278+(i*83.77)%370;c.save();c.translate(x,y);c.rotate(i*2.39996);c.globalAlpha=.65;c.fillStyle=colors[i%5];c.fillRect(-2,-5,4+i%3,9);c.restore()}
 c.font='900 22px "Cityline Noto JP",sans-serif';c.fillStyle='#c2cfdb';c.fillText('総合評価',64,361);c.save();c.translate(65,551);c.transform(1,0,-.08,1,0,0);c.font='600 140px Oswald,sans-serif';c.fillStyle='#ffe19a';c.fillText(summary.grade,0,0);c.restore();
 c.font='500 22px Oswald,sans-serif';c.fillStyle='#a9bfce';c.fillText(summary.perfect?'ALL 30 LEGS · SSS':'YAMANOTE COMPLETE',64,596);
 if(summary.recorded<30){c.font='900 17px "Cityline Noto JP",sans-serif';c.fillText('集計 '+summary.recorded+' / 30 区間',64,642)}
 c.fillStyle='#ffe19a66';c.fillRect(64,732,1072,1);c.fillStyle='#ffd24b';c.fillRect(64,731,80,3);
 const stat=(label,value,x,width,color)=>{c.font='900 20px "Cityline Noto JP",sans-serif';c.fillStyle='#a9bfce';c.fillText(label,x,775);fit(value,'Oswald,sans-serif',500,49,27,width);c.fillStyle=color;c.fillText(value,x,834)};
 stat('総走行タイム',tourTime(summary.elapsed),64,305,'#fff5e6');stat('SSS区間',summary.sss+' / 30',408,260,'#fff5e6');stat('総報酬',summary.net===null?'—':money(summary.net),742,394,summary.net<0?'#ffab89':'#ffe19a');
 c.font='400 16px Oswald,sans-serif';c.fillStyle='#a9bfce';c.fillText('© OpenStreetMap contributors',64,878);c.textAlign='right';c.fillText('uimemocho.github.io/apps/wild-taxi',1136,878);return canvas;
}

const LAT=35.6812,LON=139.7671,MINUTE=60000;
export const WEATHER_URL='https://api.open-meteo.com/v1/forecast?latitude='+LAT+'&longitude='+LON+'&current=temperature_2m,is_day,precipitation,rain,showers,snowfall,weather_code,cloud_cover,wind_speed_10m&daily=sunrise,sunset&timezone=Asia%2FTokyo&timeformat=unixtime&wind_speed_unit=ms&forecast_days=2';
export function weatherKind(code){if([71,73,75,77,85,86].includes(code))return 'snow';if([95,96,99].includes(code))return 'storm';if(code>=51&&code<=82)return 'rain';if([45,48].includes(code))return 'fog';return code>=1&&code<=3?'cloud':'clear'}
function tokyoDate(now){return new Date(now+9*3600000).toISOString().slice(0,10)}
export function solarTimes(now){
 const date=tokyoDate(now),day=Date.parse(date+'T00:00:00+09:00'),n=Math.floor((Date.parse(date)-Date.UTC(Number(date.slice(0,4)),0,0))/86400000);
 const b=2*Math.PI*(n-81)/364,eq=9.87*Math.sin(2*b)-7.53*Math.cos(b)-1.5*Math.sin(b),decl=23.44*Math.PI/180*Math.sin(2*Math.PI*(n-81)/365);
 const hours=Math.acos(-Math.tan(LAT*Math.PI/180)*Math.tan(decl))*12/Math.PI,noon=12+(135-LON)/15-eq/60;
 return {sunrise:day+(noon-hours-.07)*3600000,sunset:day+(noon+hours+.07)*3600000};
}
export function weatherState(payload,now=Date.now(),source='live'){
 let {sunrise,sunset}=solarTimes(now);
 const daily=payload?.daily,index=daily?.time?.findIndex(t=>tokyoDate(t*1000)===tokyoDate(now));
 if(index>=0&&Number.isFinite(daily.sunrise?.[index])&&Number.isFinite(daily.sunset?.[index])){sunrise=daily.sunrise[index]*1000;sunset=daily.sunset[index]*1000}
 const phase=now>=sunset-40*MINUTE&&now<sunset+40*MINUTE?'evening':now>=sunrise&&now<sunset?'day':'night';
 const current=payload?.current,hasWeather=Number.isFinite(current?.weather_code),kind=hasWeather?weatherKind(current.weather_code):'unknown';
 const precipitation=Math.max(0,Number(current?.precipitation)||0),intensity=['rain','storm','snow'].includes(kind)?Math.min(1,.3+precipitation*.15+(kind==='storm'?.3:0)):0;
 const lights=phase!=='day'||['rain','snow','storm','fog'].includes(kind);
 return {phase,kind,intensity,lights,cloud:hasWeather?Math.max(0,Math.min(1,(current.cloud_cover||0)/100)):.2,wind:Math.min(15,Math.max(0,Number(current?.wind_speed_10m)||0)),temperature:hasWeather&&Number.isFinite(current.temperature_2m)?Math.round(current.temperature_2m):null,updated:current?.time?current.time*1000:0,source:hasWeather?source:'unavailable'};
}
export function tokyoClock(now=Date.now()){return new Date(now+9*3600000).toISOString().slice(11,16)}
export function weatherLabel(state,now=Date.now()){const kind={clear:'晴れ',cloud:'くもり',rain:'雨',snow:'雪',storm:'雷雨',fog:'霧',unknown:'天気未取得'}[state.kind];return `東京 · ${tokyoClock(now)} · ${kind}`+(state.temperature===null?'':` ${state.temperature}°`)+(state.source==='cached'?'（前回）':'')}

export function appearance(w){
 const phase={
  day:{top:0x548fc7,mid:0xa2c9de,horizon:0xf5dfb8,fog:0xb9c8ce,ambient:0xd7e9ff,ground:0x7c7184,sun:0xffefd2,ambientPower:1.9,sunPower:2.25,fillPower:.7,exposure:1.08},
  evening:{top:0x756887,mid:0xce9bad,horizon:0xffcc94,fog:0xb9a3a8,ambient:0xc1b7e8,ground:0x716a82,sun:0xffbb7c,ambientPower:1.8,sunPower:2,fillPower:.9,exposure:1.17},
  night:{top:0x192c4c,mid:0x384c70,horizon:0x6c7997,fog:0x68748a,ambient:0xa2b7e9,ground:0x5b5b7b,sun:0xb4caff,ambientPower:1.65,sunPower:.75,fillPower:1.1,exposure:1.28}
 }[w.phase];
 const bad=['rain','storm','snow','fog'].includes(w.kind);
 const mix=(a,b,t)=>{let n=0;for(const shift of [16,8,0])n|=Math.round(((a>>shift)&255)*(1-t)+((b>>shift)&255)*t)<<shift;return n},overcast=bad?Math.max(.45,w.cloud*.65):w.cloud*.2;
 return {...phase,top:mix(phase.top,w.phase==='night'?0x35435d:0x8799af,overcast),mid:mix(phase.mid,0x9ba8b8,overcast*.6),horizon:mix(phase.horizon,0xb2bcc7,overcast*.6),fogNear:bad?95:170,fogFar:w.kind==='fog'?310:bad?460:650,wet:['rain','storm'].includes(w.kind),snow:w.kind==='snow',cloud:w.cloud,lights:w.lights,night:w.phase==='night',sunGlow:w.phase==='night'?.08:bad?.12:1};
}
export class TokyoWeather{
 constructor(onChange,{fetcher=globalThis.fetch?.bind(globalThis),storage,now=()=>Date.now()}={}){this.onChange=onChange;this.fetcher=fetcher;if(storage===undefined)try{storage=globalThis.localStorage}catch{}this.storage=storage;this.now=now;this.payload=null;this.source='unavailable';try{const old=JSON.parse(storage?.getItem('taxi-weather-v1')||'null');if(old&&now()-old.saved<2*3600000){this.payload=old.payload;this.source='cached'}}catch{}this.emit()}
 emit(){this.state=weatherState(this.payload,this.now(),this.source);this.onChange?.(this.state);return this.state}
 async refresh(){if(this.loading)return;this.loading=true;const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),6500);try{const response=await this.fetcher(WEATHER_URL,{signal:controller.signal,mode:'cors',credentials:'omit'});if(!response.ok)throw Error('Weather unavailable');const payload=await response.json();if(!Number.isFinite(payload?.current?.weather_code)||!Number.isFinite(payload?.current?.time))throw Error('Invalid weather');this.payload=payload;this.source='live';try{this.storage?.setItem('taxi-weather-v1',JSON.stringify({saved:this.now(),payload}))}catch{}}catch{this.source=this.payload?'cached':'unavailable'}finally{clearTimeout(timer);this.loading=false;return this.emit()}}
 start(){this.refresh();this.refreshTimer=setInterval(()=>this.refresh(),15*MINUTE);this.phaseTimer=setInterval(()=>this.emit(),MINUTE)}
 stop(){clearInterval(this.refreshTimer);clearInterval(this.phaseTimer)}
}

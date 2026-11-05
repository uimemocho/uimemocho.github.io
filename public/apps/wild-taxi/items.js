// A single vocabulary for pickup silhouettes, HUD icons and actual effects.
export const ITEM_KINDS=['boost','shield','clock','magnet','star'];
export const ITEMS={
 boost:{name:'ブースト',effect:'4秒間 超加速',color:'#ffae57',rgb:0xffae57,seconds:4},
 shield:{name:'バリア',effect:'8秒間 ガード',color:'#76e4ff',rgb:0x76e4ff,seconds:8},
 clock:{name:'時間延長',effect:'残り時間 +6秒',color:'#ffe078',rgb:0xffe078,seconds:6},
 magnet:{name:'マグネット',effect:'7秒間 自動回収',color:'#f48cc9',rgb:0xf48cc9,seconds:7},
 star:{name:'無敵',effect:'6秒間 なんでも弾き飛ばす',color:'#ffe23a',rgb:0xffe23a,seconds:6}
};
export const normalizeItem=kind=>kind==='turbo'?'boost':ITEMS[kind]?kind:null;
export const pickupKind=o=>o.type==='item'?normalizeItem(o.itemKind)||'boost':o.type==='magnet'?'magnet':o.type==='clock'?'clock':null;
const drawings={
 boost:[['M23 40L23 26Q24 12 32 5Q40 12 41 26L41 40Z','#e7faff'],['M23 29L14 40L14 49L23 44ZM41 29L50 40L50 49L41 44Z','#ffae57'],['M27 46Q22 54 32 61Q42 54 37 46Z','#ffae57'],['M30 47Q27 54 32 57Q37 54 34 47Z','#c0faff'],['M26 35H38V44H26Z','#6486a6'],['M28 19H36V27H28Z','#48b9da']],
 shield:[['M32 5L53 14V31Q53 48 32 60Q11 48 11 31V14Z','#76e4ff'],['M32 12L46 18V31Q46 43 32 52Q18 43 18 31V18Z','#203e61'],['M23 31L29 37L41 24','none','#d0faff',5]],
 clock:[['M27 2H37V8H27ZM44 9L49 5L55 11L50 16Z','#ffe078'],['M32 10A24 24 0 1 1 31.99 10Z','#ffe078'],['M32 16A18 18 0 1 1 31.99 16Z','#fff8da'],['M32 21V34L41 40','none','#2c4662',4],['M47 44H53V50H59V56H53V62H47V56H41V50H47Z','#69dfc2']],
 star:[['M32 3L40 22L61 24L45 38L50 59L32 48L14 59L19 38L3 24L24 22Z','#ffe23a','#fff6b0',2.5],['M32 14L37 26L50 27L40 35L43 48L32 41L21 48L24 35L14 27L27 26Z','#ffb000'],['M27 30H29V36H27ZM35 30H37V36H35Z','#5a3a00']],
 magnet:[['M9 10H24V35Q24 46 32 46Q40 46 40 35V10H55V36Q55 60 32 60Q9 60 9 36Z','#ee83ba'],['M9 10H24V23H9ZM40 10H55V23H40Z','#d5f6ff'],['M14 29V36Q14 52 27 54','none','#ffc0dd',3],['M28 14L32 7L36 14M29 19H35','none','#ffe078',3]]
};
export function itemIcon(kind){const paths=drawings[normalizeItem(kind)];if(!paths)return '<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M22 20H42V49H22ZM27 15H37" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>';return `<svg viewBox="0 0 64 64" aria-hidden="true">${paths.map(([d,fill,stroke,width])=>`<path d="${d}" fill="${fill}"${stroke?` stroke="${stroke}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"`:''}/>`).join('')}</svg>`}
export function drawItemIcon(ctx,kind,x,y,size){ctx.save();ctx.translate(x,y);ctx.scale(size/64,size/64);for(const [d,fill,stroke,width] of drawings[normalizeItem(kind)]||[]){const path=new Path2D(d);if(fill!=='none'){ctx.fillStyle=fill;ctx.fill(path)}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=width;ctx.lineJoin=ctx.lineCap='round';ctx.stroke(path)}}ctx.restore()}

// 3Dの世界：空・街・山・海・天候・紙飛行機
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { hash2, fbm } from './terrain.js';
import { wxKind } from './weather.js';

const TSIZE = 4200, TN = 150; // 地形グリッド
const MAXB = 2400, MAXT = 2600;

// 時間帯（JST）から空の色
export function skyPhase(wx, now = new Date()) {
  if (wx.phase) return wx.phase;
  const jst = new Date(now.getTime() + (now.getTimezoneOffset() + 540) * 60000);
  const h = jst.getHours() + jst.getMinutes() / 60;
  if (!wx.isDay) return (h > 16 && h < 19.3) || (h > 4 && h < 6) ? 'twilight' : 'night';
  if (h < 7.2 || h > 15.6) return 'golden';
  return 'day';
}
const PALETTE = {
  day: { top: '#3f7fd6', hor: '#bfd8ef', sun: '#fff4e0', sunI: 2.6, hemiS: '#cfe3ff', hemiG: '#6d6450', hemiI: 1.0, night: 0, exposure: 1.0 },
  golden: { top: '#3c5ea8', hor: '#ffc38a', sun: '#ffb36b', sunI: 2.4, hemiS: '#ffd9b5', hemiG: '#4b3b38', hemiI: 0.85, night: 0.15, exposure: 1.02 },
  twilight: { top: '#1b2550', hor: '#e07a5f', sun: '#ff9a6b', sunI: 0.9, hemiS: '#8a86c8', hemiG: '#2a2030', hemiI: 0.55, night: 0.75, exposure: 1.1 },
  night: { top: '#060b1d', hor: '#1b2747', sun: '#aab8ff', sunI: 0.5, hemiS: '#5d6aa8', hemiG: '#141020', hemiI: 0.42, night: 1, exposure: 1.18 },
};

export function createWorld(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: false });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog('#bfd8ef', 400, 4600);
  const camera = new THREE.PerspectiveCamera(58, 1, 0.05, 9000);
  scene.add(camera);

  const hemi = new THREE.HemisphereLight('#cfe3ff', '#6d6450', 1.0); scene.add(hemi);
  const sun = new THREE.DirectionalLight('#fff4e0', 2.6); scene.add(sun, sun.target);
  const fill = new THREE.DirectionalLight('#ffffff', 0.35); fill.position.set(0, 0.4, 1); camera.add(fill); fill.target.position.set(0, 0, -1); camera.add(fill.target);

  // 共有ユニフォーム・ディテールテクスチャ（タイル可能なノイズ）
  const night = { value: 0 }, snowU = { value: 0 }, skyColU = { value: new THREE.Color('#bfd8ef') };
  const detailTex = (() => {
    const N = 256, cv = document.createElement('canvas'); cv.width = cv.height = N; const c = cv.getContext('2d'), img = c.createImageData(N, N);
    const til = (f, x, y) => (f(x, y) * (N - x) * (N - y) + f(x - N, y) * x * (N - y) + f(x - N, y - N) * x * y + f(x, y - N) * (N - x) * y) / (N * N);
    const f1 = (x, y) => fbm(x / 40 + 50, y / 40 + 50, 4), f2 = (x, y) => fbm(x / 3 + 90, y / 3 + 20, 2), f3 = (x, y) => fbm(x / 12 + 10, y / 12 + 70, 3);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const i = (y * N + x) * 4; img.data[i] = til(f1, x, y) * 255; img.data[i + 1] = til(f2, x, y) * 255; img.data[i + 2] = til(f3, x, y) * 255; img.data[i + 3] = 255; }
    c.putImageData(img, 0, 0); const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; return t;
  })();
  const detailU = { value: detailTex };

  // 空
  const skyU = { top: { value: new THREE.Color() }, hor: { value: new THREE.Color() }, sunDir: { value: new THREE.Vector3(0, 1, 0) }, sunCol: { value: new THREE.Color() }, night: { value: 0 }, cloud: { value: 0 }, cover: { value: 0.3 }, time: { value: 0 }, cLit: { value: new THREE.Color('#ffffff') }, cDark: { value: new THREE.Color('#9fb0c8') } };
  const sky = new THREE.Mesh(new THREE.SphereGeometry(8000, 32, 16), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false, uniforms: skyU,
    vertexShader: 'varying vec3 v;void main(){v=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: `uniform vec3 top,hor,sunCol,sunDir,cLit,cDark;uniform float night,cloud,cover,time;varying vec3 v;
      float h(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}
      float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1.,0.)),f.x),mix(h(i+vec2(0.,1.)),h(i+vec2(1.,1.)),f.x),f.y);}
      float fb(vec2 p){float s=0.,a=.5;for(int i=0;i<5;i++){s+=a*n(p);p=p*2.03+7.3;a*=.5;}return s;}
      void main(){vec3 d=normalize(v);float y=max(d.y,0.);vec3 c=mix(hor,top,pow(y,.5));
      c=mix(c,hor*1.06,exp(-y*9.)*.6);c=mix(c,hor*.8,(1.-smoothstep(-.2,0.,d.y)));
      vec3 sd=normalize(sunDir);float s=max(dot(d,sd),0.);c+=sunCol*(pow(s,900.)*(1.-cloud)*3.+pow(s,60.)*.35*(1.-cloud)+pow(s,6.)*.22);
      vec2 g=floor(d.xz/(d.y+1.2)*1100.);float st=step(.9985,h(g))*smoothstep(.05,.35,d.y)*night*(1.-cloud*.9);c+=vec3(st)*(.5+.5*h(g+3.));
      if(d.y>.005){vec2 cp=d.xz/(d.y+.14)*1.5+vec2(time*.006,time*.002);float dn=fb(cp);float cov=mix(.6,.26,cover);
        float m=smoothstep(cov,cov+.3,dn);float sh=fb(cp+sd.xz*.22+1.7);
        vec3 cc=mix(cLit,cDark,smoothstep(.35,.75,sh)*.85+m*.15);cc+=sunCol*pow(s,5.)*.25*(1.-m);
        m*=smoothstep(.0,.1,d.y);c=mix(c,cc,m*.94);}
      gl_FragColor=vec4(c,1.);}`,
  }));
  sky.renderOrder = -10; scene.add(sky);
  // 月
  const moon = new THREE.Mesh(new THREE.CircleGeometry(70, 32), new THREE.MeshBasicMaterial({ color: '#fff3d6', fog: false }));
  scene.add(moon);

  // 地形
  const tGeo = new THREE.PlaneGeometry(TSIZE, TSIZE, TN, TN); tGeo.rotateX(-Math.PI / 2);
  tGeo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(tGeo.attributes.position.count * 3), 3));
  tGeo.setAttribute('aK', new THREE.BufferAttribute(new Float32Array(tGeo.attributes.position.count * 3), 3));
  const tMat = new THREE.MeshLambertMaterial({ vertexColors: true });
  tMat.onBeforeCompile = (sh) => {
    sh.uniforms.uDetail = detailU; sh.uniforms.uNight = night; sh.uniforms.uSnow = snowU;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec3 aK;varying vec3 vK;varying vec3 vTP;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvK=aK;vTP=position;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform sampler2D uDetail;uniform float uNight,uSnow;varying vec3 vK;varying vec3 vTP;float hh(vec2 p){return fract(sin(dot(p,vec2(41.3,289.1)))*43758.5453);}\nfloat gRoad;vec2 gP;')
      .replace('#include <color_fragment>', `#include <color_fragment>
        vec2 p=vTP.xz;gP=p;float near=1.-smoothstep(120.,900.,length(vTP-cameraPosition));
        float n1=texture2D(uDetail,p*.0035).r,n2=texture2D(uDetail,p*.028).b,n3=texture2D(uDetail,p*.19).g;
        vec3 c=diffuseColor.rgb*(.74+n1*.34+(n2-.5)*.4+(n3-.5)*.34*near);
        float can=smoothstep(.36,.62,texture2D(uDetail,p*.05).b);float can2=texture2D(uDetail,p*.33).g;
        c=mix(c,c*mix(.5,1.3,can)*(.85+can2*.3*near),vK.y);
        vec2 fs=vec2(46.,28.);vec2 fc=floor(p/fs),ff=fract(p/fs);float fh=hh(fc);
        vec3 fcol=fh<.35?vec3(.3,.42,.16):fh<.6?vec3(.5,.47,.22):fh<.82?vec3(.22,.34,.14):vec3(.4,.31,.2);
        float fw=fwidth(p.x)+fwidth(p.y);float rows=1.-.08*near*(.5+.5*sin(p.x*(fh>.5?2.2:0.)+p.y*(fh>.5?0.:2.2)));
        float fb2=min(1.,step(ff.x,.035)+step(ff.y,.055))*(1.-smoothstep(.6,2.5,fw));
        c=mix(c,fcol*(.75+n2*.5)*rows*(1.-fb2*.4),vK.z*.88);
        vec2 rf=abs(fract(p/30.)-.5);float rm=max(rf.x,rf.y);float ra=1.-smoothstep(1.2,5.,fw);float road=mix(.3,smoothstep(.385,.41,rm),ra);gRoad=road*vK.x;
        vec3 lot=vec3(.47,.46,.44)*mix(.92,.7+hh(floor(p/10.))*.45,1.-smoothstep(.8,3.,fw));
        float dash=step(.488,rm)*step(.5,fract((rf.x>rf.y?p.y:p.x)/7.))*(1.-smoothstep(.15,.6,fw));float walk=step(rm,.415)*road*ra;
        vec3 tc=mix(lot,vec3(.17,.18,.2)+dash*.4*near+walk*.16,road);
        c=mix(c,tc*(.82+n3*.36),smoothstep(.25,.6,vK.x));
        c=mix(c,vec3(.9,.93,.97)*(.82+n2*.25),uSnow*(1.-gRoad*.55)*step(1.,vTP.y));
        diffuseColor.rgb=c;`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        {vec2 q=fract(gP/30.+.5)-.5;float lamp=1.-smoothstep(0.,.16,length(q));
        float far=smoothstep(300.,1400.,length(vTP-cameraPosition));float fw2=fwidth(gP.x)+fwidth(gP.y);float hn=step(.86,hh(floor(gP/6.)))*(.5+hh(floor(gP/6.)+7.));float hl=mix(hn,smoothstep(.5,.72,texture2D(uDetail,gP*.045).g)*.45,smoothstep(.4,1.6,fw2))*(1.-gRoad);lamp*=1.-smoothstep(1.,4.,fw2)*.7;
        totalEmissiveRadiance+=uNight*smoothstep(.3,.7,vK.x)*(lamp*vec3(1.,.72,.38)*mix(1.1,.35,far)+gRoad*vec3(.05,.035,.02)+hl*mix(vec3(1.,.78,.5),vec3(.8,.88,1.),step(.8,hh(floor(gP/6.)+3.)))*mix(.25,1.1,far));}`);
  };
  const terrainMesh = new THREE.Mesh(tGeo, tMat); scene.add(terrainMesh);
  const baseXZ = Float32Array.from(tGeo.attributes.position.array);

  // 海
  const waterTex = (() => {
    const cv = document.createElement('canvas'); cv.width = cv.height = 128; const c = cv.getContext('2d'), img = c.createImageData(128, 128);
    for (let y = 0; y < 128; y++) for (let x = 0; x < 128; x++) { const n1 = fbm(x / 16, y / 16, 3), n2 = fbm(x / 16 + 5, y / 16 + 9, 3); const i = (y * 128 + x) * 4; img.data[i] = 128 + (n1 - 0.5) * 180; img.data[i + 1] = 128 + (n2 - 0.5) * 180; img.data[i + 2] = 255; img.data[i + 3] = 255; }
    c.putImageData(img, 0, 0); const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(160, 160); return t;
  })();
  const water = new THREE.Mesh(new THREE.PlaneGeometry(14000, 14000), new THREE.MeshPhongMaterial({ color: '#1d4766', specular: '#bcd4ff', shininess: 90, normalMap: waterTex, normalScale: new THREE.Vector2(0.35, 0.35) }));
  water.rotation.x = -Math.PI / 2; water.position.y = 0; scene.add(water);

  // 建物・家・木（世界座標ベースの質感シェーダー）
  const instMat = (body) => {
    const m = new THREE.MeshLambertMaterial({ color: '#ffffff' });
    m.onBeforeCompile = (sh) => {
      sh.uniforms.uNight = night; sh.uniforms.uDetail = detailU; sh.uniforms.uSky = skyColU; sh.uniforms.uSnow = snowU;
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWP;varying vec3 vWN;varying float vLY;')
        .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWP=(modelMatrix*instanceMatrix*vec4(transformed,1.)).xyz;vWN=normalize(mat3(modelMatrix*instanceMatrix)*objectNormal);vLY=position.y;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uNight,uSnow;uniform sampler2D uDetail;uniform vec3 uSky;varying vec3 vWP;varying vec3 vWN;varying float vLY;float wh(vec2 p){return fract(sin(dot(p,vec2(41.3,289.1)))*43758.5453);}')
        .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n' + body);
    };
    m.customProgramCacheKey = () => body;
    return m;
  };
  const bGeo = new THREE.BoxGeometry(1, 1, 1); bGeo.translate(0, 0.5, 0);
  const buildings = new THREE.InstancedMesh(bGeo, instMat(`
    if(abs(vWN.y)<.5){vec2 q=vec2(abs(vWN.x)>.5?vWP.z:vWP.x,vWP.y);vec2 g=q/vec2(3.,3.4);vec2 cell=floor(g),f=fract(g);
      float bid=wh(floor(vWP.xz/30.));float grime=texture2D(uDetail,q*.021).r,fine=texture2D(uDetail,q*.3).g;
      diffuseColor.rgb*=(.74+grime*.4)*(.92+fine*.16);
      float style=step(.5,bid);float wx0=mix(.12,.04,style),wy0=mix(.3,.22,style);
      float aa=1.-smoothstep(.25,.7,max(fwidth(g.x),fwidth(g.y)));
      float win=step(wx0,f.x)*step(f.x,1.-wx0)*step(wy0,f.y)*step(f.y,.84);
      diffuseColor.rgb*=1.-step(f.y,.07)*.28*aa;diffuseColor.rgb*=1.-(1.-step(.03,f.x))*style*.3*aa;
      float lit=step(.5,wh(cell+bid*91.));float rfl=.3+.45*wh(cell*.7+3.);
      vec3 glass=mix(vec3(.07,.1,.15),uSky*.9,rfl*(1.-uNight*.8));
      diffuseColor.rgb=mix(diffuseColor.rgb,mix(mix(vec3(.07,.1,.15),uSky*.9,.5*(1.-uNight*.8)),glass,aa),mix(.4,win*.92,aa));
      totalEmissiveRadiance+=uNight*mix(vec3(1.,.78,.5)*.28,win*lit*mix(vec3(1.,.76,.42),vec3(.72,.84,1.),step(.7,wh(cell*1.7+bid)))*(1.+wh(cell*3.1)*1.2),aa);
      totalEmissiveRadiance+=win*(1.-uNight)*uSky*rfl*.12;}
    else{float rn=texture2D(uDetail,vWP.xz*.06).b;float unit=step(.72,wh(floor(vWP.xz/3.5)));
      diffuseColor.rgb=mix(vec3(.36,.37,.39),vec3(.5,.5,.5),rn)*(1.-unit*.3);diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.92,.94,.97),uSnow*.85);
      totalEmissiveRadiance+=uNight*vec3(.015,.015,.025);}`), MAXB);
  buildings.count = 0; buildings.frustumCulled = false; scene.add(buildings);
  // 家（寄棟屋根）
  const hGeo = (() => {
    const a = new THREE.BoxGeometry(1, 0.6, 1).translate(0, 0.3, 0).toNonIndexed(), b = new THREE.ConeGeometry(0.78, 0.42, 4, 1).rotateY(Math.PI / 4).translate(0, 0.81, 0).toNonIndexed();
    const g = new THREE.BufferGeometry();
    for (const k of ['position', 'normal']) { const A = a.attributes[k].array, B = b.attributes[k].array, o = new Float32Array(A.length + B.length); o.set(A); o.set(B, A.length); g.setAttribute(k, new THREE.BufferAttribute(o, 3)); }
    return g;
  })();
  const MAXH = 7000;
  const houses = new THREE.InstancedMesh(hGeo, instMat(`
    float hid=wh(floor(vWP.xz/11.)+.5);
    if(vLY>.601){vec3 rc=hid<.4?vec3(.2,.22,.26):hid<.65?vec3(.16,.2,.3):hid<.85?vec3(.36,.2,.15):vec3(.24,.3,.24);
      float tile=1.-.18*(.5+.5*sin(vWP.y*9.))*(1.-smoothstep(.1,.4,fwidth(vWP.y)))+(texture2D(uDetail,vWP.xz*.2).g-.5)*.3;diffuseColor.rgb=mix(rc*tile,vec3(.92,.94,.97),uSnow*.85);}
    else{vec2 q=vec2(abs(vWN.x)>.5?vWP.z:vWP.x,vWP.y);vec2 g=q/vec2(2.4,2.9);vec2 cell=floor(g),f=fract(g);
      diffuseColor.rgb*=.8+texture2D(uDetail,q*.05).r*.35;
      float aa=1.-smoothstep(.25,.7,max(fwidth(g.x),fwidth(g.y)));
      float win=step(.28,f.x)*step(f.x,.72)*step(.34,f.y)*step(f.y,.74)*step(.35,wh(cell+hid))*aa;
      diffuseColor.rgb=mix(diffuseColor.rgb,mix(vec3(.1,.13,.18),uSky*.8,.35*(1.-uNight)),win);
      totalEmissiveRadiance+=(win*step(.45,wh(cell*2.3+hid*7.))*1.5+(1.-aa)*.07)*uNight*vec3(1.,.74,.4);}`), MAXH);
  houses.count = 0; houses.frustumCulled = false; scene.add(houses);
  // 木（丸い樹冠）
  const trGeo = (() => {
    const g = new THREE.IcosahedronGeometry(1, 2), p = g.attributes.position, nrm = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i), k = 1 + (hash2(Math.round(x * 50) * 0.71 + Math.round(z * 50) * 0.33, Math.round(y * 50) * 0.57) - 0.5) * 0.42;
      const l = Math.hypot(x, y, z); nrm[i * 3] = x / l; nrm[i * 3 + 1] = y / l; nrm[i * 3 + 2] = z / l;
      p.setXYZ(i, x * k, y * k * 1.2 + 1.15, z * k);
    }
    g.setAttribute('normal', new THREE.BufferAttribute(nrm, 3)); return g;
  })();
  const trees = new THREE.InstancedMesh(trGeo, instMat(`
    float tn=texture2D(uDetail,vWP.xz*.09+vWP.y*.07).g,tb=texture2D(uDetail,vWP.xz*.02).b;
    diffuseColor.rgb*=mix(.38,1.25,smoothstep(.2,2.3,vLY))*(.7+tn*.6)*(.85+tb*.3);
    diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.9,.93,.97),uSnow*smoothstep(1.,2.2,vLY)*.8);`), MAXT);
  trees.count = 0; trees.frustumCulled = false; scene.add(trees);

  // 展望台
  const deck = new THREE.Group(); scene.add(deck);
  const lampLights = [];
  {
    const paveTex = (() => { const cv = document.createElement('canvas'); cv.width = cv.height = 256; const c = cv.getContext('2d'); c.fillStyle = '#7b7873'; c.fillRect(0, 0, 256, 256);
      for (let y = 0; y < 8; y++) for (let x = -1; x < 4; x++) { const ox = (y % 2) * 32 + x * 64, v = 105 + Math.random() * 40; c.fillStyle = `rgb(${v},${v - 2},${v - 6})`; c.fillRect(ox + 1.5, y * 32 + 1.5, 61, 29); }
      for (let i = 0; i < 5000; i++) { c.fillStyle = `rgba(${Math.random() < 0.5 ? '0,0,0' : '255,255,255'},${Math.random() * 0.07})`; c.fillRect(Math.random() * 256, Math.random() * 256, 1.5, 1.5); }
      const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(6, 3); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; })();
    const stone = new THREE.MeshLambertMaterial({ color: '#ffffff', map: paveTex }), metal = new THREE.MeshLambertMaterial({ color: '#2b3442' });
    const floor = new THREE.Mesh(new THREE.BoxGeometry(18, 1, 9), stone); floor.position.set(0, -0.5, -0.4); deck.add(floor);
    const rail = new THREE.Mesh(new THREE.BoxGeometry(18, 0.06, 0.06), metal); rail.position.set(0, 1.05, -4.9); deck.add(rail);
    const rail2 = rail.clone(); rail2.position.y = 0.55; deck.add(rail2);
    for (let i = -9; i <= 9; i += 1.5) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.1, 0.06), metal); p.position.set(i, 0.55, -4.9); deck.add(p); }
    for (const x of [-7, 7]) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 3.4, 8), metal); pole.position.set(x, 1.7, -3.6); deck.add(pole);
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 8), new THREE.MeshBasicMaterial({ color: '#ffe2a8' })); bulb.position.set(x, 3.45, -3.6); deck.add(bulb);
      const pl = new THREE.PointLight('#ffcf8a', 0, 14, 1.6); pl.position.copy(bulb.position); deck.add(pl); lampLights.push([pl, bulb]);
    }
  }
  // 吹き流し（風向きと強さが見える）
  const flagGeo = new THREE.PlaneGeometry(1.6, 0.36, 16, 2); flagGeo.translate(0.8, 0, 0);
  const flagBase = Float32Array.from(flagGeo.attributes.position.array);
  const flag = new THREE.Mesh(flagGeo, new THREE.MeshLambertMaterial({ color: '#ff4d5e', side: THREE.DoubleSide, emissive: '#3a0a10' }));
  const flagPole = new THREE.Group(); flagPole.position.set(2.6, 0, -3.2); deck.add(flagPole);
  const fp = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 4.2, 6), new THREE.MeshLambertMaterial({ color: '#d6dfec' })); fp.position.y = 2.1; flagPole.add(fp);
  flag.position.y = 3.95; flagPole.add(flag);

  // 富士山（遠景）
  const fuji = (() => {
    const g = new THREE.ConeGeometry(5200, 2600, 48, 6, true); const col = [], p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const y = p.getY(i) / 2600 + 0.5; const c = y > 0.72 ? new THREE.Color('#f2f6ff') : new THREE.Color('#4f6690').lerp(new THREE.Color('#7f94b8'), y); col.push(c.r, c.g, c.b); }
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, fog: false, transparent: true, opacity: 0.92 })); m.visible = false; scene.add(m); return m;
  })();

  // 雲
  const puff = (() => { const cv = document.createElement('canvas'); cv.width = cv.height = 128; const c = cv.getContext('2d'); for (let i = 0; i < 14; i++) { const x = 30 + Math.random() * 68, y = 44 + Math.random() * 44, r = 18 + Math.random() * 26; const g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, 'rgba(255,255,255,.55)'); g.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g; c.fillRect(0, 0, 128, 128); } const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t; })();
  const clouds = [];
  for (let i = 0; i < 36; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: puff, transparent: true, depthWrite: false, fog: true, color: '#ffffff' })); scene.add(s); clouds.push(s); }

  // 雨・雪
  const RAIN = 1400;
  const rainGeo = new THREE.BufferGeometry(); rainGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(RAIN * 6), 3));
  const rain = new THREE.LineSegments(rainGeo, new THREE.LineBasicMaterial({ color: '#c9d6ea', transparent: true, opacity: 0.45, fog: false })); rain.frustumCulled = false; scene.add(rain);
  const rainP = new Float32Array(RAIN * 3).map(() => (Math.random() - 0.5) * 80);
  // 風の筋
  const WS = 140;
  const wsGeo = new THREE.BufferGeometry(); wsGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(WS * 6), 3));
  wsGeo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(WS * 6), 3));
  const streaks = new THREE.LineSegments(wsGeo, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })); streaks.frustumCulled = false; scene.add(streaks);
  const wsP = new Float32Array(WS * 4).map((_, i) => i % 4 === 3 ? Math.random() : (Math.random() - 0.5) * 40);
  // 上昇気流の目印（光の粒）
  const TH = 600;
  const thGeo = new THREE.BufferGeometry(); thGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(TH * 3), 3));
  const thermalPts = new THREE.Points(thGeo, new THREE.PointsMaterial({ color: '#ffe9a8', size: 3.2, sizeAttenuation: true, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false })); thermalPts.frustumCulled = false; scene.add(thermalPts);
  const thSeed = new Float32Array(TH * 3).map(() => Math.random());

  // 軌跡
  const TRAIL = 70;
  const trGeo2 = new THREE.BufferGeometry(); trGeo2.setAttribute('position', new THREE.BufferAttribute(new Float32Array(TRAIL * 3), 3));
  trGeo2.setAttribute('color', new THREE.BufferAttribute(new Float32Array(TRAIL * 3), 3));
  const trail = new THREE.Line(trGeo2, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false })); trail.frustumCulled = false; scene.add(trail);
  let trailN = 0;

  // ポストエフェクト
  let composer, bloom, grain, hq = true;
  function setupComposer() {
    composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples: 4 }));
    composer.addPass(new RenderPass(scene, camera));
    composer.addPass(new ShaderPass({
      uniforms: { tDiffuse: { value: null } },
      vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader: 'uniform sampler2D tDiffuse;varying vec2 vUv;void main(){vec4 c=texture2D(tDiffuse,vUv);if(!(c.r>=0.&&c.r<1e4&&c.g>=0.&&c.g<1e4&&c.b>=0.&&c.b<1e4))c=vec4(0.,0.,0.,1.);gl_FragColor=vec4(min(c.rgb,vec3(40.)),1.);}',
    }));
    bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.32, 0.6, 0.9); composer.addPass(bloom);
    grain = new ShaderPass({
      uniforms: { tDiffuse: { value: null }, t: { value: 0 }, amt: { value: 0.045 } },
      vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader: 'uniform sampler2D tDiffuse;uniform float t,amt;varying vec2 vUv;float h(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233))+t)*43758.5453);}void main(){vec4 c=texture2D(tDiffuse,vUv);vec2 d=vUv-.5;c.rgb*=1.-dot(d,d)*.5;gl_FragColor=c;}',
    });
    composer.addPass(grain);
    composer.addPass(new OutputPass());
  }
  setupComposer();

  let T = null, air = null, phase = 'day', kind = 'clear', center = { x: 1e9, z: 1e9 };
  const tmpM = new THREE.Matrix4(), tmpQ = new THREE.Quaternion(), tmpS = new THREE.Vector3(), tmpP = new THREE.Vector3(), tmpC = new THREE.Color();
  const KCOL = { 0: '#22343c', 1: '#7d7a72', 2: '#2c4528', 3: '#6b7a43', 4: '#2a3c44', 5: '#86837d' };

  function rebuild(cx, cz) {
    center = { x: cx, z: cz };
    const aK = tGeo.attributes.aK, pos = tGeo.attributes.position, col = tGeo.attributes.color, nightK = PALETTE[phase].night;
    const snow = kind === 'snow';
    for (let i = 0; i < pos.count; i++) {
      const x = baseXZ[i * 3] + cx, z = baseXZ[i * 3 + 2] + cz;
      const h = T.height(x, z); pos.setY(i, h); pos.setX(i, x); pos.setZ(i, z);
      const k = T.kind(x, z);
      tmpC.set(KCOL[k]);
      const n = fbm(x * 0.01, z * 0.01, 2);
      tmpC.multiplyScalar(0.82 + n * 0.36);
      if (k === 2 && h > 260) tmpC.lerp(new THREE.Color('#5b6b4a'), Math.min(1, (h - 260) / 500) * 0.5);
      if (k === 1) tmpC.lerp(new THREE.Color('#a39a8a'), n * 0.3);
      col.setXYZ(i, tmpC.r, tmpC.g, tmpC.b); aK.setXYZ(i, k === 1 ? 1 : 0, k === 2 ? 1 : 0, k === 3 ? 1 : 0);
    }
    pos.needsUpdate = true; col.needsUpdate = true; aK.needsUpdate = true; tGeo.computeVertexNormals(); tGeo.computeBoundingSphere();
    // 建物と家
    let nb = 0, nh = 0; const R = 1500, RH = 1150, C = 30;
    const gx0 = Math.floor((cx - R) / C), gx1 = Math.floor((cx + R) / C), gz0 = Math.floor((cz - R) / C), gz1 = Math.floor((cz + R) / C);
    for (let gx = gx0; gx <= gx1; gx++) for (let gz = gz0; gz <= gz1; gz++) {
      const x = (gx + 0.5) * C, z = (gz + 0.5) * C, d2 = (x - cx) ** 2 + (z - cz) ** 2;
      if (d2 > R * R) continue;
      const cs = T.structs(gx, gz); if (!cs) continue;
      if (cs.tall) {
        if (nb >= MAXB) continue; const b = cs.list[0];
        tmpP.set(b.x, b.y, b.z); tmpQ.identity(); tmpS.set(b.w, b.h, b.d);
        tmpM.compose(tmpP, tmpQ, tmpS); buildings.setMatrixAt(nb, tmpM);
        tmpC.setHSL(0.07 + hash2(gx, gz + 1) * 0.08, 0.04 + hash2(gz, gx + 1) * 0.1, 0.5 + hash2(gx + 2, gz) * 0.32); buildings.setColorAt(nb, tmpC);
        nb++;
      } else if (d2 < RH * RH) {
        for (const h of cs.list) {
          if (nh >= MAXH) break;
          tmpP.set(h.x, h.y, h.z); tmpQ.identity(); tmpS.set(h.w, h.h, h.d);
          tmpM.compose(tmpP, tmpQ, tmpS); houses.setMatrixAt(nh, tmpM);
          tmpC.setHSL(0.08 + h.hz * 0.06, 0.08 + h.hx * 0.14, 0.62 + hash2(h.hz, h.hx) * 0.26); houses.setColorAt(nh, tmpC);
          nh++;
        }
      }
    }
    buildings.count = nb; buildings.instanceMatrix.needsUpdate = true; if (buildings.instanceColor) buildings.instanceColor.needsUpdate = true;
    houses.count = nh; houses.instanceMatrix.needsUpdate = true; if (houses.instanceColor) houses.instanceColor.needsUpdate = true;
    // 木
    let nt = 0; const RT = 1000, CT = 20;
    for (let gx = Math.floor((cx - RT) / CT); gx <= Math.floor((cx + RT) / CT) && nt < MAXT; gx++) for (let gz = Math.floor((cz - RT) / CT); gz <= Math.floor((cz + RT) / CT) && nt < MAXT; gz++) {
      const x = (gx + hash2(gx, gz)) * CT, z = (gz + hash2(gz, gx)) * CT;
      if ((x - cx) ** 2 + (z - cz) ** 2 > RT * RT) continue;
      const k = T.kind(x, z); const park = k === 1 && hash2(Math.floor(x / 30) * 2.7 + 1, Math.floor(z / 30) * 1.9 + 4) < 0.09 && Math.abs((x / 30 % 1 + 1) % 1 - 0.5) < 0.3 && Math.abs((z / 30 % 1 + 1) % 1 - 0.5) < 0.3;
      if (k !== 2 && !park && !(k === 3 && hash2(gx + 5, gz) < 0.06)) continue;
      if (!park && hash2(gx * 0.7, gz * 1.9) > 0.6) continue;
      if (Math.hypot(x, z - 1) < 26) continue; // 展望台の周りは空ける
      const th = T.height(x, z); if (z < 0 && th > T.top - 32 && Math.abs(x) < -z * 1.4 + 40) continue; // 眺望を遮らない
      const s = park ? 3.5 + hash2(gx + 1, gz + 2) * 2 : 5 + hash2(gx + 1, gz + 2) * 4.5;
      tmpP.set(x, th - 1, z); tmpQ.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, hash2(gx, gz + 8) * 6.28); tmpS.set(s, s * (0.75 + hash2(gz, gx + 9) * 0.6), s);
      tmpM.compose(tmpP, tmpQ, tmpS); trees.setMatrixAt(nt, tmpM);
      tmpC.setHSL(0.24 + hash2(gx, gz + 3) * 0.1, 0.38 + hash2(gx + 9, gz) * 0.15, 0.2 + hash2(gx + 4, gz) * 0.12); trees.setColorAt(nt, tmpC);
      nt++;
    }
    trees.count = nt; trees.instanceMatrix.needsUpdate = true; if (trees.instanceColor) trees.instanceColor.needsUpdate = true;
  }

  function setSpot(spot, wx, terrain, airModel) {
    T = terrain; air = airModel; phase = skyPhase(wx); kind = wxKind(wx.code);
    const P = PALETTE[phase];
    const wet = kind === 'rain' || kind === 'thunder' || kind === 'snow';
    const cl = Math.min(1, (wx.cloud ?? 30) / 100);
    const top = new THREE.Color(P.top), hor = new THREE.Color(P.hor);
    if (wet || kind === 'fog' || cl > 0.7) { const grey = new THREE.Color(phase === 'night' ? '#151a26' : '#9aa4b2'); top.lerp(grey, 0.55 + (wet ? 0.2 : 0)); hor.lerp(grey, 0.5); }
    skyU.top.value.copy(top); skyU.hor.value.copy(hor); skyU.night.value = P.night; skyU.cloud.value = wet ? 1 : cl * 0.6;
    scene.fog.color.copy(hor);
    scene.fog.near = kind === 'fog' ? 60 : wet ? 200 : 500; scene.fog.far = kind === 'fog' ? 900 : wet ? 2600 : 4800;
    // 太陽／月の向き：時間帯で高さ、方角は投げる向きに対してやや斜め前
    const elev = phase === 'day' ? 0.9 : phase === 'golden' ? 0.22 : phase === 'twilight' ? 0.06 : 0.6;
    const az = (spot.heading > 90 && spot.heading < 270) ? 0.7 : -0.6;
    const sd = new THREE.Vector3(Math.sin(az) * Math.cos(elev), Math.sin(elev), -Math.cos(az) * Math.cos(elev)).normalize();
    skyU.sunDir.value.copy(sd); skyU.sunCol.value.set(phase === 'night' ? '#000000' : P.sun);
    sun.color.set(P.sun); sun.intensity = P.sunI * (wet ? 0.45 : 1 - cl * 0.35);
    hemi.color.set(P.hemiS); hemi.groundColor.set(P.hemiG); hemi.intensity = P.hemiI;
    renderer.toneMappingExposure = P.exposure;
    night.value = P.night; snowU.value = kind === 'snow' ? 1 : 0; skyColU.value.copy(hor);
    skyU.cover.value = wet ? 1 : cl;
    const CC = wet ? (P.night > 0.5 ? ['#2a3040', '#12161f'] : ['#aab2bd', '#687080']) : { day: ['#ffffff', '#9fb0c8'], golden: ['#ffe4c4', '#9c7f8c'], twilight: ['#f0a890', '#4a4468'], night: ['#3c4762', '#131a2c'] }[phase];
    skyU.cLit.value.set(CC[0]); skyU.cDark.value.set(CC[1]);
    moon.visible = phase === 'night' && !wet && cl < 0.85;
    moon.userData.dir = new THREE.Vector3(-Math.sin(az) * 0.6, 0.45, -0.75).normalize();
    lampLights.forEach(([pl, b]) => { pl.intensity = P.night > 0.5 ? 18 : 0; b.material.color.set(P.night > 0.5 ? '#ffe2a8' : '#c8c2b4'); });
    water.material.color.set(phase === 'night' ? '#0b1a2c' : phase === 'twilight' ? '#2a2f4a' : '#1d4766');
    deck.position.set(0, T.top, 0);
    fuji.visible = !!T.P.fuji && !wet && kind !== 'fog';
    // 雲の配置
    const n = wet ? 0 : Math.round(3 + cl * 7);
    clouds.forEach((s, i) => {
      s.visible = i < n;
      const a = hash2(i, 3) * Math.PI * 2, r = 600 + hash2(i, 9) * 3400;
      s.position.set(Math.cos(a) * r, T.top + 380 + hash2(i, 5) * 700, -Math.abs(Math.sin(a)) * r - 300);
      const sc = 500 + hash2(i, 7) * 900; s.scale.set(sc * 1.8, sc, 1);
      s.material.color.set(phase === 'night' ? '#39445e' : phase === 'twilight' ? '#e8a58f' : wet ? '#a3abb6' : '#ffffff');
      s.material.opacity = phase === 'night' ? 0.5 : 0.85;
    });
    rain.visible = wet; rain.material.color.set(kind === 'snow' ? '#ffffff' : '#c9d6ea');
    trailN = 0; trGeo2.setDrawRange(0, 0);
    rebuild(0, -TSIZE * 0.3);
  }

  // 紙飛行機の3Dモデル
  function makePlane(shape, tex) {
    const S = 0.32, pts = shape.pts;
    const contour = pts.map(p => new THREE.Vector2(p[0], p[1]));
    if (THREE.ShapeUtils.isClockWise(contour)) contour.reverse();
    let tris;
    try { tris = THREE.ShapeUtils.triangulateShape(contour, []); } catch { tris = []; }
    const area = (tri) => Math.abs((contour[tri[1]].x - contour[tri[0]].x) * (contour[tri[2]].y - contour[tri[0]].y) - (contour[tri[2]].x - contour[tri[0]].x) * (contour[tri[1]].y - contour[tri[0]].y)) / 2;
    const covered = tris.reduce((s, t) => s + area(t), 0);
    const pos = [], uv = [], idx = [];
    const dihedral = 0.22;
    const vtx = (x, y) => { pos.push(x * S, Math.abs(x) * dihedral * S, -y * S); uv.push((x + 1) / 2, (y + 1) / 2); return pos.length / 3 - 1; };
    if (tris.length && covered > shape.A * 0.6) {
      contour.forEach(p => vtx(p.x, p.y));
      tris.forEach(t => idx.push(t[0], t[1], t[2]));
    } else {
      // 自己交差などで分割できない時は重心からの扇
      const c = vtx(shape.cx, shape.cy); contour.forEach(p => vtx(p.x, p.y));
      for (let i = 0; i < contour.length; i++) idx.push(c, 1 + i, 1 + (i + 1) % contour.length);
    }
    // 竜骨（中央の折り目の下側）
    const yTop = Math.min(0.98, shape.cy + shape.len * 0.42), yTail = shape.cy - shape.len * 0.38;
    const k0 = vtx(0, yTop), k1 = vtx(0, yTail), k2 = pos.length / 3; pos.push(0, -0.1 * S, -(yTail + shape.len * 0.15) * S); uv.push(0.5, (yTail + 1) / 2);
    idx.push(k0, k1, k2);
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
    { const nn = g.attributes.normal; for (let i = 0; i < nn.count; i++) { const l = Math.hypot(nn.getX(i), nn.getY(i), nn.getZ(i)); if (!(l > 0.5)) nn.setXYZ(i, 0, 1, 0); } }
    const map = new THREE.CanvasTexture(tex.map); map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 8;
    const bump = new THREE.CanvasTexture(tex.bump); bump.anisotropy = 4;
    const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map, side: THREE.DoubleSide, roughness: 0.94, metalness: 0, emissive: '#ffffff', emissiveMap: map, emissiveIntensity: 0.05 + night.value * 0.1 }));
    const grp = new THREE.Group(); grp.add(m);
    // 重心が原点に来るように
    m.position.z = shape.cy * S;
    return grp;
  }

  function trailPush(p) {
    const a = trGeo2.attributes.position.array;
    if (trailN < TRAIL) trailN++;
    a.copyWithin(3, 0, (TRAIL - 1) * 3); a[0] = p.x; a[1] = p.y; a[2] = p.z;
    const c = trGeo2.attributes.color.array;
    for (let i = 0; i < trailN; i++) { const f = 1 - i / trailN; c[i * 3] = c[i * 3 + 1] = c[i * 3 + 2] = f * f * 0.45; }
    trGeo2.attributes.position.needsUpdate = true; trGeo2.attributes.color.needsUpdate = true; trGeo2.setDrawRange(0, trailN);
  }
  function trailClear() { trailN = 0; trGeo2.setDrawRange(0, 0); }

  const wv = { x: 0, y: 0, z: 0, g: 0 };
  function update(dt, t, focus, gust, sim) {
    // focus: 追従位置（飛行機）
    if (Math.hypot(focus.x - center.x, focus.z - center.z) > 650) rebuild(Math.round(focus.x / 40) * 40 + (focus.vx || 0) * 20, Math.round(focus.z / 40) * 40 + (focus.vz || 0) * 20);
    sky.position.copy(camera.position);
    if (moon.visible) { moon.position.copy(camera.position).addScaledVector(moon.userData.dir, 7000); moon.lookAt(camera.position); }
    if (fuji.visible) { const b = -0.32; fuji.position.set(camera.position.x + Math.sin(b) * 7600, -200, camera.position.z - Math.cos(b) * 7600); }
    water.position.x = Math.round(camera.position.x / 50) * 50; water.position.z = Math.round(camera.position.z / 50) * 50;
    waterTex.offset.x = t * 0.01; waterTex.offset.y = t * 0.006;
    sun.position.copy(camera.position).addScaledVector(skyU.sunDir.value, 500); sun.target.position.copy(camera.position);
    grain.uniforms.t.value = t % 10; skyU.time.value = t;
    for (const c of clouds) { if (!c.visible) continue; const dx = c.position.x - camera.position.x, dz = c.position.z - camera.position.z; if (Math.abs(dx) > 4200) c.position.x -= Math.sign(dx) * 8400; if (Math.abs(dz) > 4200) c.position.z -= Math.sign(dz) * 8400; }
    // 吹き流し
    if (air) {
      const s = air.base + 0.6 + (gust || 0) * 3;
      flagPole.rotation.y = Math.atan2(-air.wzv, air.wxv);
      const p = flagGeo.attributes.position, amp = Math.min(1, s / 8);
      for (let i = 0; i < p.count; i++) {
        const bx = flagBase[i * 3], by = flagBase[i * 3 + 1];
        const u = bx / 1.6, wave = Math.sin(t * (6 + s) - u * 7) * 0.12 * u * (0.4 + amp);
        const droop = (1 - amp) * u * 1.1;
        p.setXYZ(i, bx * (0.55 + amp * 0.45), by - droop * 0.9 + wave * 0.3, wave);
      }
      p.needsUpdate = true; flagGeo.computeVertexNormals();
      { const nn = flagGeo.attributes.normal; for (let i = 0; i < nn.count; i++) if (!(Math.abs(nn.getX(i)) + Math.abs(nn.getY(i)) + Math.abs(nn.getZ(i)) > 0.5)) nn.setXYZ(i, 0, 0, 1); }
    }
    // 風の筋（カメラの周り）
    if (air) {
      const a = wsGeo.attributes.position.array, ca = wsGeo.attributes.color.array, cam = camera.position;
      air.at(cam.x, cam.y, cam.z, sim, wv);
      const sp = Math.hypot(wv.x, wv.z) + 0.3, ux = wv.x / sp, uz = wv.z / sp;
      const vis = Math.min(1, 0.15 + sp / 10) * (0.35 + (gust || 0) * 0.65);
      for (let i = 0; i < WS; i++) {
        const o = i * 4;
        wsP[o] += wv.x * dt * 2; wsP[o + 1] += wv.y * dt * 2; wsP[o + 2] += wv.z * dt * 2; wsP[o + 3] += dt * 0.6;
        for (let k = 0; k < 3; k++) if (Math.abs(wsP[o + k]) > 22) wsP[o + k] = -Math.sign(wsP[o + k]) * 20;
        if (wsP[o + 3] > 1) wsP[o + 3] = 0;
        const x = cam.x + wsP[o], y = cam.y + wsP[o + 1] * 0.5, z = cam.z + wsP[o + 2], L = 0.8 + sp * 0.35;
        a[i * 6] = x; a[i * 6 + 1] = y; a[i * 6 + 2] = z; a[i * 6 + 3] = x - ux * L; a[i * 6 + 4] = y; a[i * 6 + 5] = z - uz * L;
        const f = Math.sin(wsP[o + 3] * Math.PI) * vis * 0.55;
        ca[i * 6] = ca[i * 6 + 1] = ca[i * 6 + 2] = f; ca[i * 6 + 3] = ca[i * 6 + 4] = ca[i * 6 + 5] = 0;
      }
      wsGeo.attributes.position.needsUpdate = true; wsGeo.attributes.color.needsUpdate = true;
    }
    // 雨・雪
    if (rain.visible) {
      const a = rainGeo.attributes.position.array, cam = camera.position, snow = kind === 'snow';
      const fall = snow ? 2.2 : 24, wx = air ? air.wxv * air.base : 0, wz = air ? air.wzv * air.base : 0;
      for (let i = 0; i < RAIN; i++) {
        rainP[i * 3] += wx * dt * 0.6; rainP[i * 3 + 1] -= fall * dt; rainP[i * 3 + 2] += wz * dt * 0.6;
        if (rainP[i * 3 + 1] < -40) rainP[i * 3 + 1] += 80; for (const k of [0, 2]) if (Math.abs(rainP[i * 3 + k]) > 40) rainP[i * 3 + k] *= -0.98;
        const x = cam.x + rainP[i * 3], y = cam.y + rainP[i * 3 + 1], z = cam.z + rainP[i * 3 + 2];
        const L = snow ? 0.08 : 0.9;
        a[i * 6] = x; a[i * 6 + 1] = y; a[i * 6 + 2] = z; a[i * 6 + 3] = x - wx * 0.02; a[i * 6 + 4] = y + L; a[i * 6 + 5] = z - wz * 0.02;
      }
      rainGeo.attributes.position.needsUpdate = true;
    }
    // 上昇気流の粒（近くの熱上昇の柱）
    if (air && air.thermal > 0) {
      thermalPts.visible = true;
      const a = thGeo.attributes.position.array, C = 520, f = focus;
      const gx = Math.floor(f.x / C), gz = Math.floor(f.z / C); let k = 0;
      for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
        const h = hash2(gx + i + 101, gz + j + 37); if (h < 0.5) continue;
        const ox = (gx + i + 0.5 + (hash2(gx + i, gz + j) - 0.5) * 0.5) * C, oz = (gz + j + 0.5 + (hash2(gz + j, gx + i) - 0.5) * 0.5) * C;
        const rad = 60 + h * 60;
        for (let q = 0; q < 66 && k < TH; q++, k++) {
          const s0 = thSeed[k * 3], s1 = thSeed[k * 3 + 1], s2 = thSeed[k * 3 + 2];
          const ang = s0 * 6.283 + t * 0.4, rr = Math.sqrt(s1) * rad;
          const base = Math.max(0, T.height(ox, oz));
          a[k * 3] = ox + Math.cos(ang) * rr; a[k * 3 + 2] = oz + Math.sin(ang) * rr; a[k * 3 + 1] = base + ((s2 * 900 + t * 40 * (0.6 + h)) % 900);
        }
      }
      for (; k < TH; k++) a[k * 3 + 1] = -9999;
      thGeo.attributes.position.needsUpdate = true;
    } else thermalPts.visible = false;
  }

  function resize(w, h, dpr) {
    renderer.setPixelRatio(dpr); renderer.setSize(w, h, false);
    composer.setPixelRatio(dpr); composer.setSize(w, h);
    camera.aspect = w / h; camera.updateProjectionMatrix();
  }
  function render() { if (hq) composer.render(); else renderer.render(scene, camera); }
  function setHQ(v) { hq = v; }
  return { fuji, trail, renderer, scene, camera, setSpot, update, render, resize, makePlane, trailPush, trailClear, setHQ, get T() { return T; }, deck };
}

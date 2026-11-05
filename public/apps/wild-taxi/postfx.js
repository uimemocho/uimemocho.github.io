// マンガ調ポストプロセス：色づくり（色付きの影・ヴァイブランス・Sカーブ）・セル調トーン・スクリーントーン・紙目・ブルーム。輪郭線なし。
// シーンをHDRのレンダーターゲットへ描き、最後の1パスでトーンマップ＋sRGB変換まで行う。
import * as T from './three.module.js';

const FULL_VERT = 'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}';

// 明部抽出＋1/4縮小（4タップの平均）
const BRIGHT_FRAG = `
uniform sampler2D tColor;uniform vec2 uTexel;uniform float uThreshold;varying vec2 vUv;
vec3 pick(vec2 o){vec3 c=texture2D(tColor,vUv+o*uTexel).rgb;if(any(isnan(c))||any(isinf(c)))c=vec3(0.);c=min(c,vec3(32.));float l=dot(c,vec3(.2126,.7152,.0722));return c*smoothstep(uThreshold,1.,l);}
void main(){vec3 c=pick(vec2(-1.,-1.))+pick(vec2(1.,-1.))+pick(vec2(-1.,1.))+pick(vec2(1.,1.));gl_FragColor=vec4(c*.25,1.);}`;

// 9タップ相当（線形補間を利用した5フェッチ）のガウシアン
const BLUR_FRAG = `
uniform sampler2D tInput;uniform vec2 uDir;varying vec2 vUv;
void main(){vec3 c=texture2D(tInput,vUv).rgb*.2270270;
c+=texture2D(tInput,vUv+uDir*1.3846154).rgb*.3162162;c+=texture2D(tInput,vUv-uDir*1.3846154).rgb*.3162162;
c+=texture2D(tInput,vUv+uDir*3.2307692).rgb*.0702703;c+=texture2D(tInput,vUv-uDir*3.2307692).rgb*.0702703;
gl_FragColor=vec4(c,1.);}`;

const FINAL_FRAG = `
uniform sampler2D tColor,tBloomA,tBloomB;
uniform vec2 uRes,uTexel;uniform vec4 uRect;
uniform float uNear,uFar,uExposure,uTime,uSpeed,uBoost,uPaper,uNight,uDpr,uBloom;
varying vec2 vUv;

float hash(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
float vnoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
 return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
float linZ(float d){float z=d*2.-1.;return 2.*uNear*uFar/(uFar+uNear-z*(uFar-uNear));}
float luma(vec3 c){return dot(c,vec3(.2126,.7152,.0722));}
vec3 RRTAndODTFit(vec3 v){vec3 a=v*(v+.0245786)-.000090537;vec3 b=v*(.983729*v+.4329510)+.238081;return a/b;}
vec3 aces(vec3 c){
 const mat3 i=mat3(vec3(.59719,.07600,.02840),vec3(.35458,.90834,.13383),vec3(.04823,.01566,.83777));
 const mat3 o=mat3(vec3(1.60475,-.10208,-.00327),vec3(-.53108,1.10813,-.07276),vec3(-.07367,-.00605,1.07602));
 c*=uExposure*1.08/.6;c=o*RRTAndODTFit(i*c);return clamp(c,0.,1.);}
vec3 toSRGB(vec3 c){return mix(pow(c,vec3(.41666))*1.055-.055,c*12.92,vec3(lessThanEqual(c,vec3(.0031308))));}

void main(){
 // 画面上の位置（終幕画面のビューポート描画にも対応）
 vec2 uv=uRect.xy+vUv*uRect.zw;
 vec2 frag=uv*uRes;
 vec2 fromCenter=vUv-.5;
 float r2=dot(fromCenter,fromCenter);

 // 速度に応じた色収差（画面端だけ）
 float ca=(uSpeed*.0035+uBoost*.004)*r2*4.;
 vec3 hdr;
 if(ca>.00002){
  hdr.r=texture2D(tColor,uv+fromCenter*ca*uRect.zw).r;
  hdr.g=texture2D(tColor,uv).g;
  hdr.b=texture2D(tColor,uv-fromCenter*ca*uRect.zw).b;
 }else hdr=texture2D(tColor,uv).rgb; // 低速時は1回だけ読む
 if(any(isnan(hdr))||any(isinf(hdr)))hdr=vec3(0.);
 hdr=clamp(hdr,0.,1.);

 // ブルーム（2段の広がり）
 vec3 bloom=texture2D(tBloomA,uv).rgb*.42+texture2D(tBloomB,uv).rgb*.38;
 if(any(isnan(bloom)))bloom=vec3(0.);
 // ブルームは色づくりの後でスクリーン合成する（1を超えた値がSカーブで黒く反転しないように）

 vec3 col=hdr; // すでにトーンマップ済み・表示用の値

 // 色づくり：影は黒で沈めず、色相をずらした色で持ち上げる（暗部＝青紫寄り、明部＝暖色寄り）
 float L=luma(col);
 vec3 shadowTint=mix(vec3(.16,.42,.72),vec3(.20,.30,.85),uNight);
 vec3 lightTint=mix(vec3(1.,.94,.80),vec3(.92,.96,1.),uNight);
 float sw=1.-smoothstep(.0,.5,L);
 float hw=smoothstep(.45,1.,L);
 // 暗部は黒く沈めず、同じ明るさのまま青緑へ色相をずらす
 col=mix(col,shadowTint*(L*2.4+.012),sw*sw*.42*uPaper);
 col=mix(col,col*lightTint,hw*.25*uPaper);
 // 中間調を明るく（黒つぶれを避ける）
 col=max(col,0.);
 // コントラスト（Sカーブ）
 col=clamp(col,0.,1.);
 col=mix(col,col*col*(3.-2.*col),.55*uPaper);
 // ヴァイブランス：くすんだ色ほど彩度を上げる
 float mx=max(col.r,max(col.g,col.b)),mn=min(col.r,min(col.g,col.b));
 float sat=mx-mn;
 L=luma(col);
 col=mix(vec3(L),col,1.+(.85-sat*.55)*uPaper);
 // セル調：輝度を柔らかく段階化（控えめ）
 float steps=5.;
 float q=(floor(L*steps)+smoothstep(.3,.7,fract(L*steps)))/steps;
 col=mix(col,col*(q/max(L,.001)),.16*uPaper);

 // スクリーントーン：暗くせず影色で網点を乗せる
 float cell=4.5*uDpr;
 vec2 g=mat2(.7071,-.7071,.7071,.7071)*frag/cell;
 float dotD=length(fract(g)-.5);
 float shade=smoothstep(.45,.1,L);
 float tone=1.-smoothstep(shade*.6-.06,shade*.6+.06,dotD);
 col=mix(col,col*.7+shadowTint*.3,tone*.18*uPaper);

 // 紙目（ごく薄く）と色つきの周辺減光
 float fiber=vnoise(frag*vec2(.9,.22)/uDpr);
 col*=1.-(.018*fiber+.012*hash(floor(frag/uDpr)))*uPaper;
 float vig=r2*(.14+uSpeed*.3);
 col=mix(col,col*shadowTint*1.4,vig);

 col=clamp(col,0.,1.);
 col=1.-(1.-col)*(1.-clamp(bloom*uBloom,0.,1.));
 gl_FragColor=vec4(col,1.);
}`;

export class PaperPost {
  constructor(renderer) {
    this.renderer = renderer;
    this.enabled = true;
    this.paper = 1;
    const gl = renderer.getContext();
    // 軽量化：HDR（HalfFloat）をやめ、8bitのレンダーターゲットへ「トーンマップ済み・sRGB」で描く。
    // isXRRenderTarget を立てると three.js がシーン描画時にトーンマップと色空間変換を行う（RGBA8に格納、バンディングなし）。
    // iPhoneのタイルGPUでは8bitのMSAAはほぼ無料なので4xにする。
    this.hdr = false;
    const type = T.UnsignedByteType;
    // 輪郭線をやめたので深度テクスチャは持たない（MSAA解決時の深度ブリットを省略）。MSAAは2x。
    this.scene = new T.WebGLRenderTarget(4, 4, { type, samples: Math.min(4, gl.getParameter(gl.MAX_SAMPLES)) });
    this.scene.texture.colorSpace = T.SRGBColorSpace;
    this.scene.texture.internalFormat = "RGBA8"; // MSAAバッファと解決先の形式を揃える（sRGBエンコード済みの値をそのまま格納）
    this.scene.isXRRenderTarget = true;
    const small = { type, depthBuffer: false, minFilter: T.LinearFilter, magFilter: T.LinearFilter };
    this.bloomA = new T.WebGLRenderTarget(4, 4, small);
    this.bloomB = new T.WebGLRenderTarget(4, 4, small);
    this.bloomC = new T.WebGLRenderTarget(4, 4, small);
    this.bloomD = new T.WebGLRenderTarget(4, 4, small);
    this.camera = new T.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.quad = new T.Mesh(new T.PlaneGeometry(2, 2));
    this.quad.frustumCulled = false;
    this.quadScene = new T.Scene();
    this.quadScene.add(this.quad);
    const mat = (fragmentShader, uniforms) =>
      new T.ShaderMaterial({ vertexShader: FULL_VERT, fragmentShader, uniforms, depthTest: false, depthWrite: false, toneMapped: false });
    this.brightMat = mat(BRIGHT_FRAG, { tColor: { value: null }, uTexel: { value: new T.Vector2() }, uThreshold: { value: 1 } });
    this.blurMat = mat(BLUR_FRAG, { tInput: { value: null }, uDir: { value: new T.Vector2() } });
    this.finalMat = mat(FINAL_FRAG, {
      tColor: { value: this.scene.texture },
      tBloomA: { value: this.bloomB.texture },
      tBloomB: { value: this.bloomD.texture },
      uRes: { value: new T.Vector2() },
      uTexel: { value: new T.Vector2() },
      uRect: { value: new T.Vector4(0, 0, 1, 1) },
      uNear: { value: 0.8 },
      uFar: { value: 850 },
      uExposure: { value: 1 },
      uTime: { value: 0 },
      uSpeed: { value: 0 },
      uBoost: { value: 0 },
      uPaper: { value: 1 },
      uNight: { value: 0 },
      uDpr: { value: 1 },
      uBloom: { value: 1 },
    });
    this.size = new T.Vector2();
  }
  setSize(w, h) {
    if (this.w === w && this.h === h) return;
    this.w = w;
    this.h = h;
    this.scene.setSize(w, h);
    const qw = Math.max(1, Math.round(w / 4)),
      qh = Math.max(1, Math.round(h / 4));
    this.bloomA.setSize(qw, qh);
    this.bloomB.setSize(qw, qh);
    const ew = Math.max(1, Math.round(w / 8)),
      eh = Math.max(1, Math.round(h / 8));
    this.bloomC.setSize(ew, eh);
    this.bloomD.setSize(ew, eh);
  }
  pass(material, target) {
    this.quad.material = material;
    this.renderer.setRenderTarget(target);
    this.renderer.render(this.quadScene, this.camera);
  }
  blur(input, temp, output) {
    const m = this.blurMat;
    m.uniforms.tInput.value = input.texture;
    m.uniforms.uDir.value.set(1 / input.width, 0);
    this.pass(m, temp);
    m.uniforms.tInput.value = temp.texture;
    m.uniforms.uDir.value.set(0, 1 / temp.height);
    this.pass(m, output);
  }
  // rect: {x,y,w,h} はCSSピクセル（左下原点）。省略時は全面。
  render(scene, camera, opts = {}) {
    const r = this.renderer;
    r.getDrawingBufferSize(this.size);
    const W = this.size.x,
      H = this.size.y,
      dpr = r.getPixelRatio();
    this.setSize(W, H);
    const rect = opts.rect;
    const autoClear = r.autoClear;
    // シーン本体（ビューポートはレンダーターゲット側で指定）
    if (rect) {
      this.scene.viewport.set(rect.x * dpr, rect.y * dpr, rect.w * dpr, rect.h * dpr);
      this.scene.scissor.copy(this.scene.viewport);
      this.scene.scissorTest = true;
    } else {
      this.scene.viewport.set(0, 0, W, H);
      this.scene.scissorTest = false;
    }
    r.setRenderTarget(this.scene);
    r.clear();
    r.render(scene, camera);
    // ブルーム
    this.brightMat.uniforms.tColor.value = this.scene.texture;
    this.brightMat.uniforms.uTexel.value.set(1 / W, 1 / H);
    this.brightMat.uniforms.uThreshold.value = opts.night ? 0.6 : 0.86;
    this.pass(this.brightMat, this.bloomA);
    this.blur(this.bloomA, this.bloomB, this.bloomA);
    this.blur(this.bloomA, this.bloomC, this.bloomD);
    this.finalMat.uniforms.tBloomA.value = this.bloomA.texture;
    // 最終合成
    const u = this.finalMat.uniforms;
    u.uRes.value.set(W, H);
    u.uTexel.value.set(1 / W, 1 / H);
    if (rect) u.uRect.value.set((rect.x * dpr) / W, (rect.y * dpr) / H, (rect.w * dpr) / W, (rect.h * dpr) / H);
    else u.uRect.value.set(0, 0, 1, 1);
    u.uNear.value = camera.near;
    u.uFar.value = camera.far;
    u.uExposure.value = r.toneMappingExposure;
    u.uTime.value = opts.time || 0;
    u.uSpeed.value = opts.speed || 0;
    u.uBoost.value = opts.boost ? 1 : 0;
    u.uPaper.value = this.paper;
    u.uNight.value = opts.night ? 1 : 0;
    u.uDpr.value = dpr;
    u.uBloom.value = opts.bloom ?? 1;
    this.quad.material = this.finalMat;
    r.setRenderTarget(null);
    if (rect) {
      r.setViewport(rect.x, rect.y, rect.w, rect.h);
      r.setScissor(rect.x, rect.y, rect.w, rect.h);
      r.setScissorTest(true);
    }
    r.autoClear = false;
    r.render(this.quadScene, this.camera);
    r.autoClear = autoClear;
  }
  dispose() {
    for (const t of [this.scene, this.bloomA, this.bloomB, this.bloomC, this.bloomD]) t.dispose();
    for (const m of [this.brightMat, this.blurMat, this.finalMat]) m.dispose();
    this.quad.geometry.dispose();
  }
}

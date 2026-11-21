// フォトリアルな海と「割れた海」のレイマーチ描画（WebGL2・外部ライブラリなし）
const VS = `#version 300 es
in vec2 a;void main(){gl_Position=vec4(a,0.,1.);}`;

const FS = `#version 300 es
precision highp float;
out vec4 o;
uniform vec2 uRes;uniform float uT;
uniform vec3 uCam,uTgt;uniform float uFov;
uniform float uL,uW,uClose,uBreath,uFront,uRoll;
uniform vec3 uSun;uniform int uSteps,uNrm;

const vec3 SUNC=vec3(1.0,.78,.55);
float hash(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);vec2 u=f*f*(3.-2.*f);
 return mix(mix(hash(i),hash(i+vec2(1,0)),u.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),u.x),u.y);}
float fbm(vec2 p){float a=0.,w=.5;for(int i=0;i<5;i++){a+=w*noise(p);p=mat2(1.6,1.2,-1.2,1.6)*p;w*=.5;}return a;}
float fbm3(vec2 p){float a=0.,w=.5;for(int i=0;i<3;i++){a+=w*noise(p);p=mat2(1.6,1.2,-1.2,1.6)*p;w*=.5;}return a;}

// 波：指数サイン波を方向を回しながら重ね、前の波で位置をずらしてうねりの尖りを出す
float waves(vec2 p,int it){
 p+=vec2(noise(p*.012),noise(p*.012+5.3))*36.;
 float ang=.4,fr=.16,sp=.85,w=1.,a=0.,ws=0.;
 for(int i=0;i<36;i++){if(i>=it)break;
  vec2 d=vec2(sin(ang),cos(ang));
  float x=dot(d,p)*fr+uT*sp;
  float wv=exp(sin(x)-1.);
  a+=wv*w;ws+=w;
  p-=d*wv*cos(x)*w*1.7;
  ang+=1232.4;w*=.8;fr*=1.19;sp*=1.075;}
 return a/ws;
}
// 海底の深さ（手前は砂浜、沖へ深くなる）
float baseFloor(float z){return z<0.?-z*.055:-(13.*(1.-exp(-z/80.))+25.*(1.-exp(-z/4000.)));}
float floorH(vec2 p,bool hi){
 float f=baseFloor(p.y);
 float k=smoothstep(-6.,25.,p.y);
 f+=sin(p.x*1.1+sin(p.y*.21)*2.3+noise(p*.25)*2.6)*.035*(.4+k);
 f+=(noise(p*.035)-.5)*1.6*k;
 if(hi)f+=(fbm3(p*.6)-.5)*.12;
 return f;
}
// 割れた道の半幅
float halfW(float z){
 if(uL<.5||z<-40.)return 0.;
 float tipLen=18.+uL*.3;
 float tip=clamp((uL-z)/tipLen,0.,1.);
 float w=uW*(1.+max(z,0.)/900.)*(1.+min(uL,16000.)/8000.)*sqrt(tip);
 w*=1.+(noise(vec2(z*.015,3.))-.5)*.22;
 float k=clamp(uClose*1.6-.6*(1.-clamp(z/uL,0.,1.)),0.,1.);
 return w*(1.-k*k*(3.-2.*k));
}
float seaAmp(vec2 p){
 float fr=uBreath*1.4*exp(-abs(p.y-uL)/(40.+uL*.05));
 return 1.+fr;
}
float seaH(vec2 p,int it){return (waves(p,it)-.48)*1.9*seaAmp(p);}

// 水面（割れ目の壁を含む）
float waterH(vec2 p,int it,out float s,out float fl,out float sea){
 fl=floorH(p,it>12);
 sea=seaH(p,it);
 float w=halfW(p.y);
 if(w<=.01){s=1.;return sea;}
 float d=abs(p.x)-w;
 float depth=max(-fl,1.);
 float th=.45+depth*.065;
 float wob=(noise(vec2(p.y*.06,uT*.6))-.5)*th*.7;
 s=smoothstep(0.,th,d+wob);
 s=max(s,1.-smoothstep(.5,4.,w));
 float pile=(1.+depth*.06)*exp(-max(d,0.)/(5.+w*.25))*smoothstep(1.,6.,w);
 return mix(fl-2.,sea*smoothstep(.75,1.,s)+pile,s);
}
float H(vec2 p,int it){float s,fl,sea;float wl=waterH(p,it,s,fl,sea);return max(wl,fl);}

vec3 sky(vec3 rd){
 float y=clamp(rd.y,0.,1.);
 vec3 zen=vec3(.015,.06,.22),mid=vec3(.12,.2,.42),hor=vec3(1.0,.52,.28);
 float h=pow(1.-y,9.);
 vec3 c=mix(mix(zen,mid,pow(1.-y,3.5)),hor,h);
 float sd=max(dot(rd,uSun),0.);
 c+=vec3(1.,.42,.16)*pow(sd,9.)*.35+vec3(1.,.66,.38)*pow(sd,60.)*1.2;
 c+=vec3(60.,42.,26.)*smoothstep(.99985,.99993,sd);
 if(rd.y>0.){
  vec2 uv=rd.xz/(rd.y+.06)*.9+vec2(uT*.006,uT*.002);
  float cl=fbm(uv*.7+fbm(uv*.3)*.8);
  float dn=smoothstep(.42,.82,cl)*smoothstep(0.,.12,rd.y);
  float edge=pow(sd,2.5)*1.6+.25*h;
  vec3 cc=mix(vec3(.09,.08,.13),vec3(1.2,.58,.32),clamp(edge,0.,1.))*(.55+.6*(1.-cl));
  c=mix(c,cc,dn*.85);
  // 雲の切れ間から差す光
  c+=vec3(1.,.6,.3)*pow(sd,12.)*(1.-dn)*.25;
 }
 return c;
}
vec3 fogC(vec3 rd){return sky(normalize(vec3(rd.x,.015,rd.z)));}

vec3 nrm(vec2 p,float e,int it){
 float h=H(p,it);
 return normalize(vec3(h-H(p+vec2(e,0),it),e,h-H(p+vec2(0,e),it)));
}

vec3 sandAlb(vec2 p,float wet){
 vec3 dry=vec3(.6,.5,.38),wt=vec3(.2,.16,.12);
 vec3 a=mix(dry,wt,wet)*(.82+.36*fbm3(p*.8));
 float weed=smoothstep(.6,.7,fbm3(p*.07+3.))*smoothstep(10.,40.,p.y);
 a=mix(a,vec3(.05,.07,.035),weed*.85);
 float peb=smoothstep(.82,.9,noise(p*3.1))*.5;
 a=mix(a,vec3(.42,.38,.33),peb);
 return a;
}

vec3 shadeFloor(vec3 p,vec3 rd,vec3 n,float t,float sea){
 float w=halfW(p.z);
 float inC=step(.5,w)*step(0.,p.z);
 float wet=max(inC,smoothstep(-14.,-1.,p.z));
 vec3 alb=sandAlb(p.xz,wet);
 float wallH=max(sea-p.y,0.);
 // 壁の影（太陽の向きから）
 float lit=1.;
 if(inC>0.){
  float side=uSun.x<0.?(p.x+w):(w-p.x);
  float reach=side*uSun.y/max(abs(uSun.x),.02);
  lit=smoothstep(wallH*.85,wallH*1.15,reach);
 }
 float dif=max(dot(n,uSun),0.)*lit;
 float vis=inC>0.?clamp(w/(w+wallH*.9),.08,1.):1.;
 vec3 amb=vec3(.32,.38,.52)*vis+vec3(.03,.12,.12)*(1.-vis);
 vec3 c=alb*(SUNC*dif*1.25+amb*.5);
 // 壁ごしの光のゆらぎ
 if(inC>0.){
  float nearW=exp(-max(w-abs(p.x),0.)/4.);
  float ca=pow(noise(p.xz*.9+uT*.6)*noise(p.xz*1.3-uT*.4),2.)*3.;
  c+=vec3(.08,.35,.3)*ca*nearW*.35*(1.-lit*.6);
 }
 // 濡れた砂と水たまりの照り返し
 float pud=smoothstep(.55,.62,noise(p.xz*.11+7.))*inC;
 vec3 nn=normalize(mix(n,vec3(0,1,0),pud));
 vec3 r=reflect(rd,nn);r.y=abs(r.y);
 float fr=.02+.98*pow(1.-max(dot(-rd,nn),0.),5.);
 float wetSpec=mix(.25,1.,pud)*wet;
 vec3 rc=sky(r);
 if(inC>0.)rc=mix(vec3(.02,.1,.1),rc,clamp(vis*1.6,0.,1.));
 c=mix(c,rc,fr*wetSpec);
 c+=SUNC*pow(max(dot(r,uSun),0.),80.)*wet*lit*2.;
 return c;
}

vec3 shadeWater(vec3 p,vec3 rd,vec3 n,float t,float s,float fl,float sea){
 float fpx=t*2./(uRes.y*uFov);
 n=normalize(mix(n,vec3(0,1,0),clamp(fpx/5.,0.,.6)*step(n.y,.95)*0.+clamp(fpx/5.,0.,.6)*step(.6,n.y)));
 float ndv=max(dot(-rd,n),0.);
 float fres=.02+.98*pow(1.-ndv,5.);
 vec3 r=reflect(rd,n);r.y=abs(r.y)+.002;
 vec3 refl=sky(r);
 float shp=mix(260.,40.,clamp(fpx/3.,0.,1.));
 refl+=SUNC*pow(max(dot(r,uSun),0.),shp)*6.*mix(1.,.3,clamp(fpx/3.,0.,1.));
 vec3 sunH=normalize(vec3(uSun.x,0.,uSun.z));
 float back=pow(max(dot(normalize(vec3(rd.x,0.,rd.z)),sunH),0.),3.);
 float crest=clamp(p.y*.6+.5,0.,1.6);
 vec3 deep=vec3(.002,.016,.03);
 vec3 scat=vec3(.03,.24,.22);
 vec3 body=deep+scat*SUNC*crest*(.18+.55*back)*(.4+.6*max(uSun.y*3.,.3));
 // 浅瀬は砂が透ける
 float dW=max(p.y-fl,0.);
 vec3 sand=sandAlb(p.xz,1.)*(SUNC*.9*max(uSun.y*4.,.4)+.2);
 body=mix(sand*vec3(.4,.5,.5),body,1.-exp(-dW*.7));
 // 割れ目の壁
 float w=halfW(p.z);
 float wall=smoothstep(.3,.75,1.-n.y)*step(.5,w);
 float hr=clamp((p.y-fl)/max(sea-fl,1.),0.,1.);
 if(wall>0.){
  vec2 nh=normalize(n.xz+1e-4);
  float bl=max(-dot(nh,normalize(uSun.xz)),0.);
  float fl2=noise(vec2(p.z*.12,p.y*.1+uT*1.2))*noise(vec2(p.z*.3+3.,p.y*.25+uT*1.8));
  vec3 wc=mix(vec3(.0,.012,.02),vec3(.02,.26,.25),pow(hr,1.8));
  wc*=.5+2.2*bl*pow(hr,2.5)+.5*back*hr;
  wc+=vec3(.05,.24,.22)*fl2*pow(hr,1.5)*.5;
  // 水の中の魚影
  float fish=smoothstep(.78,.8,noise(vec2(p.z*.18-uT*.8,p.y*.45)))*smoothstep(.2,.4,hr)*(1.-smoothstep(.7,.9,hr));
  wc*=1.-fish*.6;
  body=mix(body,wc,wall);
  fres=mix(fres,fres*.45+.03,wall);
 }
 vec3 c=mix(body,refl,fres);
 // 泡
 float foam=0.;
 float fz=fbm3(p.xz*vec2(.9,.6)+vec2(0.,uT*.5));
 foam+=smoothstep(.95,1.3,p.y)*smoothstep(.45,.75,fz)*.7*(1.-clamp(fpx,0.,1.));
 if(w>.5){
  float d=abs(p.x)-w;
  float lip=exp(-max(d,0.)/2.)*smoothstep(.8,.98,hr)*smoothstep(.35,.65,fbm3(p.xz*1.4+vec2(0.,-uT*1.5)));
  float base=smoothstep(.15,0.,hr)*smoothstep(.35,.6,fbm3(vec2(p.z*.8,p.y*2.+uT*3.)));
  float streak=wall*smoothstep(.74,.86,noise(vec2(p.z*1.6,p.y*.2+uT*2.2)))*hr*hr;
  foam+=lip*.9+base*.95+streak*.35;
 }
 float tipD=abs(p.z-uL);
 foam+=uFront*exp(-tipD/(10.+uL*.03))*exp(-abs(p.x)/(uW*2.+10.+uL*.02))*smoothstep(.3,.6,fz)*1.2;
 if(uClose>0.)foam+=uClose*(1.-uClose)*4.*exp(-abs(abs(p.x)-uW*(1.+p.z/900.)*(1.+min(uL,16000.)/8000.))/(uW+6.))*step(0.,p.z)*step(p.z,uL)*smoothstep(.25,.6,fz);
 foam+=smoothstep(.45,.0,dW)*smoothstep(.3,.6,fbm3(p.xz*1.2+uT*.4))*step(p.z,6.);
 foam=clamp(foam,0.,1.);
 vec3 fc=vec3(.92,.9,.88)*(SUNC*(.45+.6*max(dot(n,uSun),0.))+vec3(.25,.3,.4));
 c=mix(c,fc,foam);
 return c;
}

vec3 aces(vec3 x){return clamp((x*(2.51*x+.03))/(x*(2.43*x+.59)+.14),0.,1.);}

void main(){
 vec2 uv=(gl_FragCoord.xy*2.-uRes)/uRes.y;
 vec3 ro=uCam;
 vec3 fw=normalize(uTgt-ro);
 vec3 up=normalize(vec3(sin(uRoll),cos(uRoll),0.));
 vec3 rt=normalize(cross(fw,up));up=cross(rt,fw);
 vec3 rd=normalize(fw*uFov+uv.x*rt+uv.y*up);
 vec3 col;
 float yTop=5.5;
 float tHit=-1.;
 if(rd.y<0.){
  float t=ro.y>yTop?(ro.y-yTop)/(-rd.y):0.;
  float pt=t;
  float tEnd=t+clamp(ro.y*55.,900.,6000.);
  for(int i=0;i<220;i++){
   if(i>=uSteps)break;
   vec3 p=ro+rd*t;
   if(p.y<-42.){tHit=t;break;}
   float h=H(p.xz,7);
   float dd=p.y-h;
   if(dd<0.){
    float a=pt,b=t;
    for(int j=0;j<7;j++){float m=(a+b)*.5;vec3 q=ro+rd*m;if(q.y-H(q.xz,7)<0.)b=m;else a=m;}
    tHit=(a+b)*.5;break;
   }
   pt=t;
   float w=halfW(p.z);
   float near=step(abs(p.x),w+25.)*step(-5.,p.z)*step(p.z,uL+30.);
   t+=max(dd*.45,mix(.025,.005,near)*t+.02);
   if(t>tEnd)break;
  }
 }
 if(rd.y>=0.){
  col=sky(rd);
 }else if(tHit>0.){
  vec3 p=ro+rd*tHit;
  float e=.012+tHit*.0012;
  float fp=tHit*2./(uRes.y*uFov);
  int it=min(uNrm,int(clamp(log(39.3/(3.*fp))/.174,3.,40.)));
  vec3 n=nrm(p.xz,e,it);
  float s,fl,sea;float wl=waterH(p.xz,it,s,fl,sea);
  if(fl>=wl-.03)col=shadeFloor(p,rd,n,tHit,sea);
  else col=shadeWater(p,rd,n,tHit,s,fl,sea);
  col=mix(col,fogC(rd)*.8,1.-exp(-tHit*.00006));
 }else{
  // 遠景：平面で近似
  float tp=-ro.y/rd.y;
  vec3 p=ro+rd*tp;
  float fp=tp*2./(uRes.y*uFov);
  vec3 n=nrm(p.xz,.5+tp*.004,min(8,int(clamp(log(39.3/(3.*fp))/.174,1.,40.))));
  n=normalize(mix(n,vec3(0,1,0),clamp(tp/9000.,0.,.85)));
  float w=halfW(p.z);
  if(abs(p.x)<w&&p.z>0.){
   float k=abs(p.x)/w;
   col=mix(vec3(.22,.18,.13)*.55,vec3(.01,.06,.07),smoothstep(.35,.95,k));
   col=mix(col,vec3(.9,.88,.85)*.6,smoothstep(.9,1.,k)*.6);
  }else{
   float fres=.02+.98*pow(1.-max(dot(-rd,n),0.),5.);
   vec3 r=reflect(rd,n);r.y=abs(r.y)+.002;
   col=mix(vec3(.004,.03,.045)+vec3(.03,.12,.12)*.2,sky(r)+SUNC*pow(max(dot(r,uSun),0.),300.)*5.,fres);
  }
  col=mix(col,fogC(rd)*.8,1.-exp(-tp*.00006));
 }
 // 波しぶき・霧
 vec3 tipP=vec3(0.,4.,uL);
 vec3 toT=tipP-ro;float tc=max(dot(toT,rd),0.);
 float md=length(ro+rd*tc-tipP);
 float rad=8.+uL*.03;
 col+=vec3(1.,.86,.72)*exp(-md*md/(rad*rad))*uFront*.55;
 col+=vec3(.9,.8,.7)*uBreath*.04*(1.-abs(uv.y));
 col*=1.;
 col=aces(col*.62);
 col=pow(col,vec3(1./2.2));
 vec2 q=gl_FragCoord.xy/uRes;
 col*=.55+.45*pow(16.*q.x*q.y*(1.-q.x)*(1.-q.y),.18);
 col+=(hash(gl_FragCoord.xy+fract(uT)*91.)-.5)*.018;
 o=vec4(col,1.);
}`;

export class Ocean {
  constructor(canvas) {
    this.canvas = canvas;
    const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, depth: false, stencil: false, preserveDrawingBuffer: false, powerPreference: 'high-performance' });
    if (!gl) throw new Error('webgl2');
    this.gl = gl;
    const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
    const pr = gl.createProgram(); gl.attachShader(pr, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FS)); gl.bindAttribLocation(pr, 0, 'a'); gl.linkProgram(pr);
    if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(pr));
    this.pr = pr; gl.useProgram(pr);
    const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    this.u = {}; for (const n of ['uRes', 'uT', 'uCam', 'uTgt', 'uFov', 'uL', 'uW', 'uClose', 'uBreath', 'uFront', 'uRoll', 'uSun', 'uSteps', 'uNrm']) this.u[n] = gl.getUniformLocation(pr, n);
    const sun = [-0.16, 0.17, 1]; const l = Math.hypot(...sun); this.sun = sun.map(v => v / l);
    this.hq = true; this.scale = 0.6; this.ft = []; this.lastT = 0;
  }
  setQuality(hq) { this.hq = hq; this.scale = hq ? 0.62 : 0.42; this.resize(true); }
  resize(force) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    const w = Math.max(160, Math.round(innerWidth * dpr * this.scale)), h = Math.max(160, Math.round(innerHeight * dpr * this.scale));
    if (force || w !== this.canvas.width || h !== this.canvas.height) { this.canvas.width = w; this.canvas.height = h; }
  }
  // 重さに合わせて解像度を自動調整
  adapt(dtMs) {
    this.ft.push(dtMs); if (this.ft.length < 40) return;
    const avg = this.ft.reduce((a, b) => a + b, 0) / this.ft.length; this.ft = [];
    const lo = this.hq ? 0.36 : 0.28, hi = this.hq ? 0.75 : 0.5;
    if (avg > 26 && this.scale > lo) { this.scale = Math.max(lo, this.scale * 0.85); this.resize(true); }
    else if (avg < 15 && this.scale < hi) { this.scale = Math.min(hi, this.scale * 1.08); this.resize(true); }
  }
  render(s) {
    const gl = this.gl, u = this.u;
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.uniform2f(u.uRes, this.canvas.width, this.canvas.height);
    gl.uniform1f(u.uT, s.time); gl.uniform3fv(u.uCam, s.cam); gl.uniform3fv(u.uTgt, s.tgt); gl.uniform1f(u.uFov, s.fov || 1.9);
    gl.uniform1f(u.uL, s.L); gl.uniform1f(u.uW, s.W); gl.uniform1f(u.uClose, s.close); gl.uniform1f(u.uBreath, s.breath); gl.uniform1f(u.uFront, s.front); gl.uniform1f(u.uRoll, s.roll || 0);
    gl.uniform3fv(u.uSun, this.sun); gl.uniform1i(u.uSteps, this.hq ? 150 : 96); gl.uniform1i(u.uNrm, this.hq ? 26 : 16);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
}

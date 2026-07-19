const W = 720, H = 1280, TAU = Math.PI * 2;
const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const rnd = (a, b) => a + Math.random() * (b - a);

const COPY = {
  ja: { tagline:'荒波を越え、失われた名画を取り戻せ。', begin:'航海を始める', collection:'収蔵品', settings:'設定', galleryIntro:'海より拾い上げた、失われた色彩。', drag:'ドラッグして全方向へ移動', restore:'版木を復元する', choose:'版をひとつ選ぶ' },
  en: { tagline:'Cross the wild sea. Restore the lost masterpieces.', begin:'BEGIN THE VOYAGE', collection:'COLLECTION', settings:'SETTINGS', galleryIntro:'Lost colors, recovered from the sea.', drag:'DRAG IN ANY DIRECTION', restore:'RESTORE THE PRINT', choose:'Choose one impression' }
};

class SaveStore {
  constructor(){ this.key = 'hokusai-save-v1'; this.data = this.load(); }
  load(){
    const base = { highScore:0, coins:0, unlocked:['great-wave'], language:'ja', volume:.7, tutorialSeen:false, runs:0 };
    try { return { ...base, ...JSON.parse(localStorage.getItem(this.key) || '{}') }; } catch { return base; }
  }
  write(patch = {}){ Object.assign(this.data, patch); localStorage.setItem(this.key, JSON.stringify(this.data)); }
}

class InkAudio {
  constructor(store){
    this.store = store; this.ctx = null; this.master = null; this.bgmDuck = 1; this.duckTimer = null; this.fadeFrame = null;
    this.bgm = document.createElement('audio'); this.bgm.id='gameBgm'; this.bgm.src='assets/audio/fugaku.mp3'; this.bgm.loop=true; this.bgm.preload='auto'; this.bgm.hidden=true; this.bgm.setAttribute('playsinline',''); this.bgm.setAttribute('aria-hidden','true'); this.bgm.volume=this.bgmVolume(); document.body.append(this.bgm);
  }
  bgmVolume(){ return clamp(this.store.data.volume * .42 * this.bgmDuck, 0, 1); }
  fadeBgm(target, duration = 220){
    cancelAnimationFrame(this.fadeFrame); const from = this.bgm.volume, started = performance.now(); target = clamp(target, 0, 1);
    const step = now => { const t = clamp((now-started)/duration,0,1); this.bgm.volume = lerp(from,target,1-Math.pow(1-t,3)); if(t<1)this.fadeFrame=requestAnimationFrame(step); };
    this.fadeFrame=requestAnimationFrame(step);
  }
  setVolume(value = this.store.data.volume){ if(this.master)this.master.gain.value=value; this.fadeBgm(clamp(value*.42*this.bgmDuck,0,1),120); }
  playBgm(){ if(!this.bgm.paused)return; this.bgm.play().catch(()=>{}); }
  duck(duration = 1100, ratio = .24){
    clearTimeout(this.duckTimer); this.bgmDuck=ratio; this.fadeBgm(this.bgmVolume(),140);
    this.duckTimer=setTimeout(()=>{this.bgmDuck=1;this.fadeBgm(this.bgmVolume(),520)},duration);
  }
  wake(){
    if (!this.ctx) { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); this.master = this.ctx.createGain(); this.master.connect(this.ctx.destination); }
    this.setVolume(); this.playBgm();
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }
  tone(freq = 220, duration = .1, type = 'sine', gain = .12, slide = 1){
    if (!this.ctx) return;
    const now = this.ctx.currentTime, o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, now); o.frequency.exponentialRampToValueAtTime(Math.max(35, freq * slide), now + duration);
    g.gain.setValueAtTime(gain, now); g.gain.exponentialRampToValueAtTime(.001, now + duration);
    o.connect(g).connect(this.master); o.start(now); o.stop(now + duration);
  }
  noise(duration = .22, gain = .08, low = 900){
    if (!this.ctx) return;
    const len = this.ctx.sampleRate * duration, buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate), data = buf.getChannelData(0);
    for(let i=0;i<len;i++) data[i] = (Math.random()*2-1) * (1-i/len);
    const src=this.ctx.createBufferSource(), filter=this.ctx.createBiquadFilter(), g=this.ctx.createGain(); src.buffer=buf; filter.type='lowpass'; filter.frequency.value=low; g.gain.value=gain; src.connect(filter).connect(g).connect(this.master); src.start();
  }
  slash(){ this.noise(.13,.12,1800); this.tone(260,.12,'sawtooth',.04,.35); }
  hit(){ this.tone(100,.11,'square',.05,.45); }
  level(){ [260,390,520].forEach((f,i)=>setTimeout(()=>this.tone(f,.25,'sine',.07,1.15),i*90)); }
  wave(){ this.noise(1.4,.18,650); this.tone(70,1.2,'sawtooth',.05,.55); }
  perfect(){ [330,494,660].forEach((f,i)=>setTimeout(()=>this.tone(f,.55,'triangle',.07,1),i*85)); }
  special(){ this.noise(.9,.2,1200); this.tone(65,1.1,'sawtooth',.13,4); }
  button(){ this.tone(420,.05,'triangle',.04,1.4); }
}

class HokusaiGame {
  constructor(){
    this.canvas = $('#gameCanvas'); this.ctx = this.canvas.getContext('2d');
    this.store = new SaveStore(); this.audio = new InkAudio(this.store);
    this.artworks = []; this.images = {}; this.screen = 'titleScreen'; this.running = false; this.paused = false; this.last = 0;
    this.bind(); this.load(); this.applyLanguage(); this.loop = this.loop.bind(this); requestAnimationFrame(this.loop);
  }
  async load(){
    this.artworks = Array.isArray(window.HOKUSAI_ARTWORKS) ? window.HOKUSAI_ARTWORKS : await fetch('assets/artworks/artworks.json').then(r=>r.json()).catch(()=>[]);
    const sources = {
      title:'assets/backgrounds/title-wave.png', gameplay:'assets/backgrounds/arena-sea.png', nagi:'assets/player/nagi.png',
      iwashi:'assets/enemies/yokai-iwashi.png', fugu:'assets/enemies/jinmen-fugu.png', jelly:'assets/enemies/chochin-kurage.png',
      skull:'assets/enemies/skeleton-sailor.png', kappa:'assets/enemies/kappa-boatman.png', boss:'assets/bosses/raging-sea-dragon.png',
      wave:'assets/waves/great-wave-front.png', slash:'assets/effects/spirit-burst.png', crane:'assets/effects/origami-crane.png', lightning:'assets/effects/raijin-strike.png'
    };
    for (const [key, src] of Object.entries(sources)) { const image = new Image(); image.src = src; this.images[key] = image; }
    this.renderGallery(); this.updateTitleProgress();
  }
  bind(){
    document.addEventListener('click', e=>{ const action=e.target.closest('[data-action]')?.dataset.action; if(!action) return; this.audio.wake(); this.audio.button(); this.action(action, e.target.closest('[data-action]')); });
    $('#volumeSlider').addEventListener('input', e=>{ this.store.write({volume:+e.target.value}); this.audio.setVolume(+e.target.value); });
    let dragging=false,anchor={x:0,y:0};
    const point=e=>{const r=this.canvas.getBoundingClientRect();return{x:(e.clientX-r.left)/r.width*W,y:(e.clientY-r.top)/r.height*H}};
    const setStick=e=>{const q=point(e),dx=q.x-anchor.x,dy=q.y-anchor.y,len=Math.hypot(dx,dy)||1,power=Math.min(1,len/82);this.moveStick={x:dx/len*power,y:dy/len*power,active:true}};
    this.canvas.addEventListener('pointerdown',e=>{dragging=true;anchor=point(e);this.moveStick={x:0,y:0,active:true};this.canvas.setPointerCapture(e.pointerId)});
    this.canvas.addEventListener('pointermove',e=>{if(dragging)setStick(e)});
    const release=()=>{dragging=false;this.moveStick={x:0,y:0,active:false}};this.canvas.addEventListener('pointerup',release);this.canvas.addEventListener('pointercancel',release);
    addEventListener('keydown',e=>{if(!this.keys)return;if(['ArrowLeft','a','A'].includes(e.key))this.keys.left=true;if(['ArrowRight','d','D'].includes(e.key))this.keys.right=true;if(['ArrowUp','w','W'].includes(e.key))this.keys.up=true;if(['ArrowDown','s','S'].includes(e.key))this.keys.down=true;if(e.key===' '&&this.running)this.special()});
    addEventListener('keyup',e=>{if(!this.keys)return;if(['ArrowLeft','a','A'].includes(e.key))this.keys.left=false;if(['ArrowRight','d','D'].includes(e.key))this.keys.right=false;if(['ArrowUp','w','W'].includes(e.key))this.keys.up=false;if(['ArrowDown','s','S'].includes(e.key))this.keys.down=false});
    document.addEventListener('visibilitychange',()=>{if(document.hidden&&this.running&&!this.paused)this.pause()});
  }
  action(name, el){
    const actions={ play:()=>this.start(), gallery:()=>this.show('galleryScreen'), settings:()=>$('#settingsOverlay').classList.add('active'), closeSettings:()=>$('#settingsOverlay').classList.remove('active'), title:()=>this.toTitle(), language:()=>this.toggleLanguage(), pause:()=>this.pause(), resume:()=>this.resume(), quit:()=>this.toTitle(), special:()=>this.special(), restore:()=>{this.dismissReward();this.restore()}, dismissReward:()=>this.dismissReward() };
    if(name==='art') return this.showArt(+el.dataset.index); actions[name]?.();
  }
  show(id){ $$('.screen').forEach(s=>s.classList.toggle('active',s.id===id)); this.screen=id; if(id==='galleryScreen')this.renderGallery(); }
  toTitle(){ this.running=false; this.paused=false; clearTimeout(this.rewardTimer); this.dismissReward(); $$('.overlay').forEach(o=>o.classList.remove('active')); this.show('titleScreen'); this.updateTitleProgress(); }
  toggleLanguage(){ this.store.write({language:this.store.data.language==='ja'?'en':'ja'}); this.applyLanguage(); this.renderGallery(); }
  applyLanguage(){ const lang=this.store.data.language; document.documentElement.lang=lang; $$('[data-i18n]').forEach(el=>el.textContent=COPY[lang][el.dataset.i18n]); $('#langValue').textContent=lang==='ja'?'日本語':'ENGLISH'; }
  updateTitleProgress(){ $('#titleProgress').textContent=`${this.store.data.unlocked.length} / ${Math.max(3,this.artworks.length)} WORKS`; }

  resetRun(){
    this.runTime=0; this.duration=60; this.score=0; this.kills=0; this.perfect=0; this.level=1; this.xp=0; this.nextXp=4; this.specialCharge=0;
    this.player={x:W/2,y:H*.58,w:92,h:142,hp:125,maxHp:125,speed:320,fireRate:.52,fireTimer:0,power:1.25,shots:1,spread:0,magnet:320,armor:0,invuln:0};
    this.keys={left:false,right:false,up:false,down:false};this.moveStick={x:0,y:0,active:false};this.enemies=[];this.projectiles=[];this.pickups=[];this.particles=[];this.floaters=[];this.lightningFx=[];this.wave=null;this.waveCooldown=12;this.bossSpawned=false;this.boss=null;this.shake=0;this.flash=0;this.slow=1;this.levelPending=false;this.cameraZoom=1;this.specialFx=0;this.demoMilestones=new Set();this.specialReadyAnnounced=false;this.ending=false;this.bossDefeatFx=null;clearTimeout(this.rewardTimer);this.dismissReward();$('#bossDead').classList.remove('show');
    this.upgrades={power:0,twin:0,wide:0,rapid:0,drum:0,crane:0,shell:0,magnet:0,printer:0};
    this.nextSpawn=.35; this.drumTimer=1.2; this.dragHintShown=!this.store.data.tutorialSeen; $('#dragHint').style.display=this.dragHintShown?'block':'none';
    this.updateHud();
  }
  start(){ this.resetRun(); if(new URLSearchParams(location.search).get('showcase')==='1'){Object.assign(this.upgrades,{power:1,twin:1,wide:1,rapid:1,drum:2,crane:2,shell:1,magnet:1,printer:1});this.player.power*=1.35;this.player.shots=2;this.player.spread=.13;this.player.fireRate*=.82;this.player.armor=.14;this.player.magnet+=55;this.drumTimer=.25}this.show('gameScreen'); this.running=true; this.paused=false; this.last=performance.now(); this.store.write({tutorialSeen:true}); setTimeout(()=>this.announceChapter(new URLSearchParams(location.search).get('showcase')==='1'?'SHOWCASE IMPRESSION':'THE OPEN SEA',new URLSearchParams(location.search).get('showcase')==='1'?'ALL SKILLS AWAKENED':'SURVIVE THE IMPRESSION'),350); }
  pause(){ if(!this.running)return; this.paused=true; $('#pauseOverlay').classList.add('active'); }
  resume(){ this.paused=false; this.last=performance.now(); $('#pauseOverlay').classList.remove('active'); }

  loop(now){
    const dt=Math.min(.034,(now-this.last)/1000||0); this.last=now;
    if(this.screen==='gameScreen'){ if(this.running&&!this.paused)this.update(dt*this.slow); this.draw(); }
    requestAnimationFrame(this.loop);
  }
  update(dt){
    if(this.ending){this.updateEnding(dt);return}
    this.runTime=Math.min(this.duration,this.runTime+dt);if(this.runTime>=this.duration&&(!this.boss||this.boss.dead)){this.finish(true);return}if(this.runTime>=this.duration&&this.boss&&!this.boss.dead&&!this.demoMilestones.has('overtime')){this.demoMilestones.add('overtime');this.announceChapter('FINAL IMPRESSION','DEFEAT THE DRAGON')}
    const p=this.player;
    p.invuln=Math.max(0,p.invuln-dt);let mx=this.moveStick.x+(this.keys.right?1:0)-(this.keys.left?1:0),my=this.moveStick.y+(this.keys.down?1:0)-(this.keys.up?1:0),ml=Math.hypot(mx,my);if(ml>1){mx/=ml;my/=ml}p.x+=mx*p.speed*dt;p.y+=my*p.speed*dt;p.x=clamp(p.x,62,W-62);p.y=clamp(p.y,150,H-90);
    p.fireTimer-=dt;if(p.fireTimer<=0){this.fire();p.fireTimer=p.fireRate}
    this.specialCharge=clamp(this.specialCharge+dt*7.2,0,100);
    if(this.specialCharge>=100&&!this.specialReadyAnnounced){this.specialReadyAnnounced=true;this.announceChapter('FUGAKU READY','RELEASE THE STRIKE')}
    this.nextSpawn-=dt;if(this.nextSpawn<=0&&!this.wave&&!this.boss&&this.enemies.length<70){this.spawnEnemy();if(this.runTime>24&&Math.random()<.34)this.spawnEnemy();this.nextSpawn=Math.max(.22,.76-this.runTime*.0065)}
    this.waveCooldown-=dt;if(this.waveCooldown<=0&&!this.boss){this.startWave();this.waveCooldown=18+rnd(-2,2)}
    if(this.runTime>21&&!this.demoMilestones.has('yokai')){this.demoMilestones.add('yokai');this.announceChapter('YOKAI TIDE','THE SEA GROWS RESTLESS')}
    if(this.runTime>42&&!this.bossSpawned)this.spawnBoss();
    if(this.runTime>51&&!this.demoMilestones.has('final')){this.demoMilestones.add('final');this.announceChapter('LAST TEN SECONDS','THE SEA REMEMBERS')}
    this.updateProjectiles(dt);this.updateEnemies(dt);this.updatePickups(dt);this.updateDrum(dt);this.updateParticles(dt);this.updateWave(dt);this.updateBoss(dt);
    if(this.slow<1)this.slow=Math.min(1,this.slow+dt*1.5);
    this.cameraZoom=lerp(this.cameraZoom,clamp(1-Math.max(0,this.enemies.length-5)*.0095,.72,1),Math.min(1,dt*2.4));this.specialFx=Math.max(0,this.specialFx-dt);this.shake=Math.max(0,this.shake-dt*24);this.flash=Math.max(0,this.flash-dt*2.5);this.updateHud();
  }
  updateEnding(dt){const fx=this.bossDefeatFx;if(!fx){this.finish(true);return}fx.t+=dt;this.player.invuln=99;this.updateParticles(dt);this.cameraZoom=lerp(this.cameraZoom,.88,Math.min(1,dt*1.6));this.specialFx=Math.max(0,this.specialFx-dt);this.shake=Math.max(0,this.shake-dt*7);this.flash=Math.max(0,this.flash-dt*1.35);this.updateHud();if(fx.t>=fx.duration)this.finish(true)}
  spawnEnemy(){
    const types=[{name:'妖怪イワシ',hp:2,speed:105,r:26,color:'#bdd0c8',kind:'iwashi'},{name:'人面フグ',hp:4,speed:82,r:34,color:'#b59669',kind:'fugu'},{name:'提灯クラゲ',hp:3,speed:68,r:30,color:'#d98760',kind:'jelly'},{name:'骸骨水兵',hp:7,speed:55,r:37,color:'#d9d1b7',kind:'skull'},{name:'河童船頭',hp:10,speed:48,r:41,color:'#6c8375',kind:'kappa'}];
    const max=clamp(1+Math.floor(this.runTime/9),1,types.length),t=types[Math.floor(Math.random()*max)],edge=Math.floor(Math.random()*4);let x,y;
    if(edge===0){x=rnd(-30,W+30);y=-95}else if(edge===1){x=W+95;y=rnd(90,H+20)}else if(edge===2){x=rnd(-30,W+30);y=H+95}else{x=-95;y=rnd(90,H+20)}
    const scale=1+this.runTime/150;this.enemies.push({...t,x,y,hp:t.hp*scale,maxHp:t.hp*scale,phase:rnd(0,TAU),rot:rnd(-.12,.12),value:t.hp*15,hit:0});
  }
  fire(){
    const p=this.player,n=p.shots,target=this.boss&&!this.boss.dead?this.boss:this.enemies.filter(e=>!e.dead).sort((a,b)=>(a.x-p.x)**2+(a.y-p.y)**2-((b.x-p.x)**2+(b.y-p.y)**2))[0],base=target?Math.atan2(target.y-p.y,target.x-p.x):-Math.PI/2;
    for(let i=0;i<n;i++){const angle=base+(i-(n-1)/2)*(p.spread||.13);this.projectiles.push({x:p.x,y:p.y,vx:Math.cos(angle)*650,vy:Math.sin(angle)*650,r:18+this.upgrades.wide*7,power:p.power,life:1.35,angle,spin:rnd(-2,2)})}
    if(this.upgrades.crane&&Math.random()<Math.min(.72,.24*this.upgrades.crane)){const angle=base+rnd(-.42,.42);this.projectiles.push({x:p.x,y:p.y,vx:Math.cos(angle)*610,vy:Math.sin(angle)*610,r:20,power:p.power*(1.25+this.upgrades.crane*.18),life:1.7,crane:true,angle,spin:rnd(-1.4,1.4)})}
    this.audio.slash();
  }
  updateProjectiles(dt){
    for(const s of this.projectiles){s.x+=s.vx*dt;s.y+=s.vy*dt;s.angle+=s.spin*dt;s.life-=dt;for(const e of this.enemies){if(e.dead)continue;const dx=e.x-s.x,dy=e.y-s.y;if(dx*dx+dy*dy<(e.r+s.r)**2){e.hp-=s.power;e.hit=.14;s.life=0;this.glowBurst(s.x,s.y,7);if(e.hp<=0)this.kill(e);break}}
      if(this.boss&&!this.boss.dead&&s.life>0){const dx=this.boss.x-s.x,dy=this.boss.y-s.y;if(dx*dx+dy*dy<(this.boss.r+s.r)**2){this.boss.hp-=s.power;this.boss.hit=.14;s.life=0;this.inkBurst(s.x,s.y,5);this.glowBurst(s.x,s.y,5);if(this.boss.hp<=0)this.killBoss()}}
    }
    this.projectiles=this.projectiles.filter(s=>s.life>0&&s.y>-160&&s.y<H+160&&s.x>-160&&s.x<W+160);
  }
  updateEnemies(dt){
    const p=this.player;
    for(const e of this.enemies){e.phase+=dt*2;e.hit=Math.max(0,(e.hit||0)-dt);const dxp=p.x-e.x,dyp=p.y-e.y,len=Math.hypot(dxp,dyp)||1;e.x+=dxp/len*e.speed*dt+Math.sin(e.phase)*7*dt;e.y+=dyp/len*e.speed*dt+Math.cos(e.phase*.8)*7*dt;
      const dx=e.x-p.x,dy=e.y-p.y;if(!e.dead&&dx*dx+dy*dy<(e.r+38)**2){e.dead=true;this.damage(e.kind==='foam'?4.5:3.5+Math.min(4,e.hp*.15))}
    }
    this.enemies=this.enemies.filter(e=>!e.dead);
  }
  kill(e){e.dead=true;this.kills++;this.score+=Math.round(e.value);this.pickups.push({x:e.x,y:e.y,type:'xp',value:1.25+this.upgrades.printer*.25,life:28,phase:rnd(0,TAU)});if(Math.random()<.075)this.pickups.push({x:e.x+rnd(-18,18),y:e.y+rnd(-18,18),type:'coin',value:25,life:22,phase:0});if(Math.random()<.018)this.pickups.push({x:e.x,y:e.y,type:'heal',value:16,life:18,phase:0});this.specialCharge=clamp(this.specialCharge+3,0,100);this.inkBurst(e.x,e.y,12);this.glowBurst(e.x,e.y,9);this.audio.hit();}
  updatePickups(dt){
    const p=this.player;for(const q of this.pickups){q.life-=dt;q.phase+=dt*3;let dx=p.x-q.x,dy=p.y-q.y,d=Math.hypot(dx,dy)||1,range=q.type==='xp'?p.magnet:80;if(d<range){const pull=clamp((range-d)/range,0,1);q.x+=dx/d*(260+680*pull)*dt;q.y+=dy/d*(260+680*pull)*dt}if(d<28){q.dead=true;if(q.type==='xp'){this.xp+=q.value;this.floaters.push({x:q.x,y:q.y,text:'+ 経験',life:.7});if(this.xp>=this.nextXp)this.levelUp()}else if(q.type==='coin'){this.score+=q.value;this.floaters.push({x:q.x,y:q.y,text:'+ 朱印',life:.8})}else{p.hp=Math.min(p.maxHp,p.hp+q.value);this.floaters.push({x:q.x,y:q.y,text:'+ 回復',life:.8})}this.audio.tone(q.type==='xp'?620:440,.08,'triangle',.025,1.3)}}this.pickups=this.pickups.filter(q=>!q.dead&&q.life>0)
  }
  updateDrum(dt){
    if(!this.upgrades.drum)return;this.drumTimer-=dt;if(this.drumTimer>0)return;this.drumTimer=Math.max(.58,2.45-this.upgrades.drum*.34);
    const pool=this.enemies.filter(e=>!e.dead);if(this.boss&&!this.boss.dead)pool.push(this.boss);const targets=pool.sort((a,b)=>(a.x-this.player.x)**2+(a.y-this.player.y)**2-((b.x-this.player.x)**2+(b.y-this.player.y)**2)).slice(0,Math.min(4,1+this.upgrades.drum));
    for(const e of targets){const damage=2.8+this.upgrades.drum*2.1;e.hp-=damage;e.hit=.18;this.lightningFx.push({x:e.x,y:e.y,flip:e.y<250?-1:1,life:.76,max:.76,scale:1+this.upgrades.drum*.15,rot:rnd(-.045,.045)});this.glowBurst(e.x,e.y,8+this.upgrades.drum*2);if(e===this.boss){if(e.hp<=0)this.killBoss()}else if(e.hp<=0)this.kill(e)}if(targets.length){this.shake=Math.max(this.shake,5+this.upgrades.drum*2);this.flash=Math.max(this.flash,.08);this.audio.noise(.16,.07,2200);this.audio.tone(115,.22,'square',.06,3.2)}
  }
  damage(n){const p=this.player;if(p.invuln>0)return;p.invuln=.92;n*=1-p.armor;p.hp-=n;this.shake=9;this.flash=.18;this.audio.hit();if(p.hp<=0)this.finish(false)}
  levelUp(){if(this.levelPending)return;this.xp-=this.nextXp;this.level++;this.nextXp=Math.floor(this.nextXp*1.18+1);this.levelPending=true;this.paused=true;this.audio.level();this.showUpgrades()}
  showUpgrades(){
    const all=[['power','◢','Wave Slash Power','斬撃の威力 +35%'],['twin','二','Twin Slash','斬撃をもう一枚放つ'],['wide','〰','Wide Slash','斬撃の当たり判定を拡大'],['rapid','疾','Rapid Current','攻撃速度 +18%'],['drum','雷','Raijin Drum','近くの敵へ周期雷撃'],['crane','鶴','Origami Crane','折鶴が追加攻撃'],['shell','亀','Turtle Shell','受ける傷を軽減'],['magnet','引','Ukiyo Magnet','経験値の引力を強化'],['printer','刷','Master Printer','獲得経験値 +20%']];
    const picks=[...all].sort(()=>Math.random()-.5).slice(0,3);$('#upgradeChoices').innerHTML=picks.map(x=>{const art=x[0]==='crane'?'assets/effects/origami-crane.png':x[0]==='drum'?'assets/effects/raijin-strike.png':null;return `<button class="upgrade-card" data-upgrade="${x[0]}"><span class="upgrade-icon ${art?'art':''}">${art?`<img src="${art}" alt="">`:x[1]}</span><span><strong>${x[2]}</strong><small>${x[3]}</small></span><b>＋</b></button>`}).join('');
    $('#levelOverlay').classList.add('active');$$('[data-upgrade]').forEach(b=>b.onclick=()=>this.chooseUpgrade(b.dataset.upgrade));
  }
  chooseUpgrade(k){this.upgrades[k]++;const p=this.player,names={power:'WAVE SLASH POWER',twin:'TWIN SLASH',wide:'WIDE SLASH',rapid:'RAPID CURRENT',drum:'RAIJIN DRUM',crane:'ORIGAMI CRANE',shell:'TURTLE SHELL',magnet:'UKIYO MAGNET',printer:'MASTER PRINTER'};if(k==='power')p.power*=1.35;if(k==='twin'){p.shots=Math.min(4,p.shots+1);p.spread=.13}if(k==='wide'){}if(k==='rapid')p.fireRate*=.82;if(k==='shell')p.armor=Math.min(.55,p.armor+.14);if(k==='magnet')p.magnet+=55;this.glowBurst(p.x,p.y,24);for(let i=0;i<18;i++){const a=i/18*TAU;this.particles.push({x:p.x,y:p.y,vx:Math.cos(a)*rnd(110,250),vy:Math.sin(a)*rnd(110,250),r:rnd(2,6),life:.65,max:.65,color:i%5?'#a7f3ff':'#d85b40',glow:true})}this.flash=Math.max(this.flash,.16);$('#levelOverlay').classList.remove('active');this.levelPending=false;this.paused=false;this.last=performance.now();this.announceChapter('IMPRESSION ACQUIRED',names[k])}

  startWave(){const patterns=[[170,260],[460,550],[285,435],[120,220,500,600]],safe=patterns[Math.floor(Math.random()*patterns.length)];this.wave={t:0,safe,checked:false};$('#waveWarning').classList.add('show');this.audio.wave()}
  updateWave(dt){if(!this.wave)return;this.wave.t+=dt;if(this.wave.t>2.1)$('#waveWarning').classList.remove('show');if(this.wave.t>3.25&&!this.wave.checked){this.wave.checked=true;const safe=this.wave.safe.some((x,i,a)=>i%2===0&&this.player.x>x&&this.player.x<a[i+1]);if(safe){this.perfect++;this.score+=1000;$('#perfectWave').classList.remove('show');void $('#perfectWave').offsetWidth;$('#perfectWave').classList.add('show');this.audio.perfect()}else this.damage(24)}if(this.wave.t>4.25)this.wave=null}
  spawnBoss(){this.bossSpawned=true;for(const e of this.enemies)this.inkBurst(e.x,e.y,4);this.enemies=[];this.player.hp=Math.max(this.player.hp,90);this.player.invuln=2.2;this.boss={x:W/2,y:190,r:105,hp:90,maxHp:90,phase:0,shot:2.15,hit:0,dead:false};this.waveCooldown=999;this.announceChapter('FINAL IMPRESSION','RAGING SEA DRAGON');this.floaters.push({x:W/2,y:320,text:'荒海大龍 · RAGING SEA DRAGON',life:3,boss:true});this.shake=18;this.audio.wave()}
  updateBoss(dt){if(!this.boss||this.boss.dead)return;const b=this.boss;b.phase+=dt;b.hit=Math.max(0,(b.hit||0)-dt);b.x=W/2+Math.sin(b.phase*.75)*220;b.y=210+Math.sin(b.phase*1.4)*30;b.shot-=dt;if(b.shot<0){b.shot=2.25;for(let i=-1;i<=1;i++)this.enemies.push({name:'龍波',x:b.x+i*34,y:b.y+60,hp:999,maxHp:999,speed:185,r:18,color:'#dbe2d5',kind:'foam',phase:i,rot:0,value:0});}}
  killBoss(){if(!this.boss||this.boss.dead||this.ending)return;this.runTime=this.duration;this.boss.hp=0;this.boss.dead=true;this.ending=true;this.bossDefeatFx={t:0,duration:2.9,x:this.boss.x,y:this.boss.y};this.slow=1;this.projectiles=[];this.enemies=[];this.score+=5000;this.specialCharge=100;this.shake=30;this.flash=.88;this.inkBurst(this.boss.x,this.boss.y,72);this.glowBurst(this.boss.x,this.boss.y,42);const dead=$('#bossDead');dead.classList.remove('show');void dead.offsetWidth;dead.classList.add('show');this.audio.duck(2300,.09);this.audio.noise(1.25,.22,520);this.audio.tone(58,1.4,'sawtooth',.12,.3)}
  special(){if(!this.running||this.paused||this.specialCharge<100)return;this.specialCharge=0;this.slow=.18;this.specialFx=1.15;this.shake=24;this.flash=.3;this.audio.duck(1400,.14);this.audio.special();const cutin=$('#specialCutin');cutin.classList.remove('show');void cutin.offsetWidth;cutin.classList.add('show');for(const e of this.enemies){e.hp-=18*this.player.power;this.glowBurst(e.x,e.y,4);if(e.hp<=0)this.kill(e)}if(this.boss&&!this.boss.dead){this.boss.hp-=45*this.player.power;if(this.boss.hp<=0)this.killBoss()}for(let i=0;i<70;i++)this.particles.push({x:this.player.x+rnd(-220,220),y:this.player.y+rnd(-220,220),vx:rnd(-260,260),vy:rnd(-260,260),r:rnd(2,11),life:rnd(.4,1.2),max:1.2,color:i%5?'#9eeeff':'#d65a3d',glow:true});}
  announceChapter(kicker,title){const el=$('#chapterBanner');if(!el)return;$('#chapterKicker').textContent=kicker;$('#chapterTitle').textContent=title;el.classList.remove('show');void el.offsetWidth;el.classList.add('show')}
  inkBurst(x,y,n){for(let i=0;i<n;i++)this.particles.push({x,y,vx:rnd(-180,180),vy:rnd(-180,130),r:rnd(2,10),life:rnd(.25,.7),max:.7,color:Math.random()<.12?'#b6452e':'#071820'})}
  glowBurst(x,y,n=8){for(let i=0;i<n;i++){const a=rnd(0,TAU),v=rnd(90,330);this.particles.push({x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v,r:rnd(1.5,6),life:rnd(.18,.55),max:.55,color:Math.random()<.18?'#e15b3f':'#a7f3ff',glow:true})}}
  updateParticles(dt){for(const p of this.particles){p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=70*dt;p.life-=dt}this.particles=this.particles.filter(p=>p.life>0);for(const f of this.floaters){f.y-=22*dt;f.life-=dt}this.floaters=this.floaters.filter(f=>f.life>0);for(const fx of this.lightningFx)fx.life-=dt;this.lightningFx=this.lightningFx.filter(fx=>fx.life>0)}

  draw(){
    const c=this.ctx;c.save();const sx=this.shake?rnd(-this.shake,this.shake):0,sy=this.shake?rnd(-this.shake,this.shake):0;c.translate(sx,sy);this.drawBackground(c);c.save();c.translate(W/2,H/2);c.scale(this.cameraZoom,this.cameraZoom);c.translate(-W/2,-H/2);this.drawWave(c);this.drawPickups(c);this.drawSkillAuras(c);this.drawProjectiles(c);this.enemies.forEach(e=>this.drawEnemy(c,e));if(this.bossDefeatFx)this.drawBossDissolve(c,this.boss);else if(this.boss&&!this.boss.dead)this.drawBoss(c,this.boss);this.drawPlayer(c);this.drawLightningFx(c);this.drawParticles(c);if(this.specialFx>0)this.drawSpecialFx(c);c.restore();c.restore();
    if(this.flash>0){c.fillStyle=`rgba(244,239,219,${this.flash})`;c.fillRect(0,0,W,H)}
  }
  drawBackground(c){
    const bg=this.images.gameplay;c.fillStyle='#071d2a';c.fillRect(0,0,W,H);
    if(bg?.complete&&bg.naturalWidth){const ox=(W/2-this.player.x)*.045+Math.sin(this.runTime*.16)*6,oy=(H/2-this.player.y)*.035+Math.cos(this.runTime*.13)*6;c.drawImage(bg,-22+ox,-22+oy,W+44,H+44)}
    const vignette=c.createRadialGradient(W/2,H*.56,160,W/2,H*.56,720);vignette.addColorStop(.25,'rgba(4,18,26,0)');vignette.addColorStop(1,'rgba(1,9,14,.46)');c.fillStyle=vignette;c.fillRect(0,0,W,H);
  }
  drawPlayer(c){const p=this.player,bob=Math.sin(this.runTime*4)*4;c.save();c.translate(p.x,p.y+bob);c.rotate(Math.sin(this.runTime*2.2)*.035);c.shadowBlur=p.invuln?42:26;c.shadowColor=p.invuln?'rgba(255,240,205,.95)':'rgba(100,220,255,.42)';if(p.invuln&&Math.floor(p.invuln*18)%2)c.globalAlpha=.55;this.drawSprite(c,this.images.nagi,178);c.globalAlpha=1;c.globalCompositeOperation='lighter';const aura=c.createRadialGradient(0,5,3,0,5,72);aura.addColorStop(0,p.invuln?'rgba(255,225,170,.32)':'rgba(150,235,255,.2)');aura.addColorStop(1,'rgba(80,170,255,0)');c.fillStyle=aura;c.beginPath();c.arc(0,5,72,0,TAU);c.fill();c.restore()}
  drawSprite(c,image,height){if(!image?.complete||!image.naturalWidth)return;const width=height*(image.naturalWidth/image.naturalHeight);c.drawImage(image,-width/2,-height/2,width,height)}
  drawSkillAuras(c){const p=this.player,u=this.upgrades,t=this.runTime;if(u.magnet){c.save();c.translate(p.x,p.y);c.rotate(t*.28);c.globalAlpha=.16+u.magnet*.035;c.strokeStyle='#8cebf2';c.lineWidth=2;c.setLineDash([9,16]);c.shadowBlur=18;c.shadowColor='#74e9f2';c.beginPath();c.arc(0,0,105+u.magnet*15,0,TAU);c.stroke();c.restore()}if(u.shell){c.save();c.translate(p.x,p.y);c.rotate(-t*.35);c.globalAlpha=.32+u.shell*.08;c.strokeStyle='#dce8d1';c.lineWidth=3;c.shadowBlur=22;c.shadowColor='#8fe8df';for(let i=0;i<6;i++){c.beginPath();c.arc(0,0,62+u.shell*5,i*TAU/6+.08,i*TAU/6+.72);c.stroke()}c.restore()}if(u.printer){for(let i=0;i<Math.min(3,u.printer);i++){const a=t*(.8+i*.12)+i*TAU/3,x=p.x+Math.cos(a)*(68+i*8),y=p.y+Math.sin(a)*(42+i*5);c.save();c.translate(x,y);c.rotate(a);c.globalAlpha=.7;c.fillStyle='#bd4c38';c.shadowBlur=13;c.shadowColor='#ff8668';c.fillRect(-6,-6,12,12);c.strokeStyle='#f0d8b4';c.strokeRect(-3,-3,6,6);c.restore()}}if(u.crane){const count=Math.min(4,u.crane);for(let i=0;i<count;i++){const a=t*(1.15+i*.08)+i*TAU/count,radius=100+i*12,x=p.x+Math.cos(a)*radius,y=p.y+Math.sin(a)*radius*.58;c.save();c.translate(x,y);c.rotate(a+Math.PI*.5);c.globalAlpha=.94;c.shadowBlur=32;c.shadowColor='#74eaf2';this.drawSprite(c,this.images.crane,82+u.crane*7);c.restore()}}}
  drawProjectiles(c){for(const s of this.projectiles){c.save();c.translate(s.x,s.y);c.rotate(s.crane?s.angle+Math.PI:s.angle);c.globalCompositeOperation='lighter';c.shadowBlur=s.crane?28:30+this.upgrades.power*5;c.shadowColor=s.crane?'#9df4f6':'#7eeaff';if(s.crane){this.drawSprite(c,this.images.crane,90+this.upgrades.crane*7)}else{const height=86+this.upgrades.wide*10+this.upgrades.power*5;if(this.upgrades.rapid){for(let g=1;g<=Math.min(3,this.upgrades.rapid);g++){c.save();c.globalAlpha=.16/g;c.translate(-g*16,0);this.drawSprite(c,this.images.slash,height*(1-g*.06));c.restore()}}this.drawSprite(c,this.images.slash,height)}c.restore()}}
  drawLightningFx(c){for(const fx of this.lightningFx){const life=clamp(fx.life/fx.max,0,1),age=1-life,height=270*fx.scale,dir=fx.flip||1,alpha=clamp(life*1.55,0,1);c.save();c.globalAlpha=alpha;c.globalCompositeOperation='lighter';c.strokeStyle='#f7f1cf';c.lineWidth=5+fx.scale;c.lineJoin='miter';c.shadowBlur=28;c.shadowColor='#78efff';c.beginPath();c.moveTo(fx.x+rnd(-6,6),fx.y-dir*height*.72);c.lineTo(fx.x-18,fx.y-dir*height*.52);c.lineTo(fx.x+12,fx.y-dir*height*.36);c.lineTo(fx.x-8,fx.y-dir*height*.18);c.lineTo(fx.x,fx.y);c.stroke();c.strokeStyle='#62ddeb';c.lineWidth=2;c.stroke();c.restore();c.save();c.translate(fx.x,fx.y-dir*height*.29);c.rotate(fx.rot);c.scale(lerp(.78,1.12,age),lerp(.9,1.08,age)*dir);c.globalAlpha=alpha;c.globalCompositeOperation='source-over';c.shadowBlur=30;c.shadowColor='#8ff4ff';this.drawSprite(c,this.images.lightning,height);c.restore()}}
  drawEnemy(c,e){
    const key=e.kind==='foam'?'slash':e.kind, heights={iwashi:172,fugu:164,jelly:192,skull:218,kappa:230,foam:112};
    c.save();c.translate(e.x,e.y);c.rotate(e.rot+Math.sin(e.phase)*.08);c.shadowBlur=e.hit?34:14;c.shadowColor=e.hit?'#b8f5ff':'rgba(0,8,12,.5)';if(e.hit)c.globalAlpha=.82;this.drawSprite(c,this.images[key],heights[e.kind]||120);c.restore()
  }
  drawBoss(c,b){
    c.save();c.translate(b.x,b.y+55);c.rotate(Math.sin(b.phase)*.045);c.shadowBlur=b.hit?55:30;c.shadowColor=b.hit?'#a9f4ff':'rgba(0,7,12,.7)';c.filter=b.hit?'brightness(1.75) saturate(.35)':'none';this.drawSprite(c,this.images.boss,430);c.restore();
    c.fillStyle='rgba(4,17,23,.78)';c.fillRect(170,105,380,15);c.fillStyle='#b6452e';c.fillRect(170,105,380*b.hp/b.maxHp,15);c.strokeStyle='#eee5d0';c.strokeRect(170,105,380,15);c.fillStyle='#eee5d0';c.font='18px "Noto Serif JP"';c.textAlign='center';c.fillText('荒海大龍  RAGING SEA DRAGON',W/2,94)
  }
  drawBossDissolve(c,b){const fx=this.bossDefeatFx,img=this.images.boss;if(!fx||!img?.complete||!img.naturalWidth)return;const p=clamp(fx.t/fx.duration,0,1),height=430,width=height*img.naturalWidth/img.naturalHeight,cols=13,rows=19,sw=img.naturalWidth/cols,sh=img.naturalHeight/rows,dw=width/cols+1,dh=height/rows+1;c.save();c.translate(b.x,b.y+55);c.rotate(Math.sin((b.phase||0))*0.045-p*.035);for(let gy=0;gy<rows;gy++){for(let gx=0;gx<cols;gx++){const raw=Math.sin((gx+1)*91.7+(gy+1)*173.3)*43758.5453,seed=Math.abs(raw-Math.floor(raw)),vanish=clamp((p-seed*.7)*3.15,0,1);if(vanish>=.99)continue;const dir=gx<cols/2?-1:1,dx=dir*vanish*(24+seed*115),dy=-vanish*(22+seed*145)+Math.sin(seed*18)*13*vanish;c.globalAlpha=(1-vanish)*clamp(1.18-p*.12,0,1);c.drawImage(img,gx*sw,gy*sh,sw+1,sh+1,-width/2+gx*width/cols+dx,-height/2+gy*height/rows+dy,dw,dh);if(vanish>.08){c.globalCompositeOperation='lighter';c.fillStyle=seed>.82?'rgba(220,82,52,.8)':'rgba(157,238,245,.72)';c.shadowBlur=14;c.shadowColor=seed>.82?'#d95b40':'#8eefff';const size=2+seed*7;c.fillRect(-width/2+gx*width/cols+dx+dw*.5,-height/2+gy*height/rows+dy+dh*.5,size,size);c.globalCompositeOperation='source-over';c.shadowBlur=0}}}c.restore();c.save();c.globalCompositeOperation='lighter';c.globalAlpha=(1-p)*.5;c.strokeStyle='#a5eef4';c.lineWidth=3;c.shadowBlur=55;c.shadowColor='#77ddeb';c.beginPath();c.arc(b.x,b.y+45,lerp(115,185,p),0,TAU);c.stroke();c.restore()}
  drawWave(c){
    if(!this.wave)return;const progress=clamp((this.wave.t-.5)/3.1,0,1),y=lerp(-430,H+240,progress);c.save();c.translate(W/2,y);this.drawSprite(c,this.images.wave,680);
    c.globalCompositeOperation='screen';c.fillStyle='rgba(233,226,197,.32)';for(let i=0;i<this.wave.safe.length;i+=2){const a=this.wave.safe[i],b=this.wave.safe[i+1];c.fillRect(a-W/2,-230,b-a,500)}c.restore()
  }
  drawPickups(c){for(const q of this.pickups){const pulse=1+Math.sin(q.phase)*.13;c.save();c.translate(q.x,q.y);c.scale(pulse,pulse);c.globalCompositeOperation='lighter';if(q.type==='xp'){c.shadowBlur=20;c.shadowColor='#75eaff';c.fillStyle='#9bf4ff';c.rotate(Math.PI/4);c.fillRect(-7,-7,14,14);c.fillStyle='#fff';c.fillRect(-3,-3,6,6)}else if(q.type==='coin'){c.shadowBlur=18;c.shadowColor='#ff7650';c.fillStyle='#d85c3e';c.beginPath();c.arc(0,0,10,0,TAU);c.fill();c.strokeStyle='#ffd2a2';c.lineWidth=2;c.stroke()}else{c.shadowBlur=22;c.shadowColor='#a8ffcf';c.fillStyle='#c8f2d4';c.fillRect(-4,-13,8,26);c.fillRect(-13,-4,26,8)}c.restore()}}
  drawParticles(c){for(const p of this.particles){c.save();c.globalAlpha=clamp(p.life/p.max,0,1);if(p.glow){c.globalCompositeOperation='lighter';c.shadowBlur=18;c.shadowColor=p.color}c.fillStyle=p.color;c.beginPath();c.arc(p.x,p.y,p.r,0,TAU);c.fill();c.restore()}c.globalAlpha=1;for(const f of this.floaters){c.globalAlpha=clamp(f.life,0,1);c.fillStyle='#eee8d7';c.shadowBlur=12;c.shadowColor='#65dff4';c.textAlign='center';c.font=f.boss?'600 22px "Cormorant Garamond"':'13px "Noto Serif JP"';c.fillText(f.text,f.x,f.y)}c.shadowBlur=0;c.globalAlpha=1}
  drawSpecialFx(c){const t=this.specialFx/1.15;c.save();c.translate(this.player.x,this.player.y);c.globalCompositeOperation='lighter';c.globalAlpha=clamp(t*1.4,0,1);for(let i=0;i<3;i++){c.save();c.rotate(i*TAU/3+this.runTime*2);this.drawSprite(c,this.images.slash,260+i*85);c.restore()}c.restore()}
  updateHud(){if(!this.player)return;$('#timer').textContent=this.formatTime(Math.max(0,this.duration-this.runTime));$('#score').textContent=String(Math.round(this.score)).padStart(6,'0');$('#healthFill').style.width=`${clamp(this.player.hp/this.player.maxHp*100,0,100)}%`;$('#xpFill').style.width=`${this.xp/this.nextXp*100}%`;$('#levelLabel').textContent=`LV. ${String(this.level).padStart(2,'0')}`;$('#specialButton').style.setProperty('--charge',`${this.specialCharge*3.6}deg`);$('#specialButton').classList.toggle('ready',this.specialCharge>=100)}
  formatTime(sec){sec=Math.ceil(sec);return `${String(Math.floor(sec/60)).padStart(2,'0')}:${String(sec%60).padStart(2,'0')}`}
  finish(win){if(!this.running)return;this.running=false;this.paused=false;this.ending=false;const final=Math.round(this.score+this.runTime*10),unlocked=this.store.data.unlocked,next=this.artworks.find(a=>!unlocked.includes(a.id)),fallback=this.artworks.length?this.artworks[this.store.data.runs%this.artworks.length]:null,earned=win||this.runTime>=30;this.foundArtwork=earned?(next||fallback):null;this.isNewDiscovery=!!this.foundArtwork&&!unlocked.includes(this.foundArtwork.id);this.store.write({highScore:Math.max(final,this.store.data.highScore),coins:this.store.data.coins+Math.floor(final/250),runs:this.store.data.runs+1});$('#resultStatus').textContent=win?'VOYAGE COMPLETE':'LOST TO THE DEEP';$('#resultTime').textContent=this.formatTime(win?this.duration:this.runTime);$('#resultKills').textContent=String(this.kills).padStart(3,'0');$('#resultWaves').textContent=String(this.perfect).padStart(2,'0');$('#resultScore').textContent=String(final).padStart(6,'0');const card=$('#woodblockFound'),overlay=$('#rewardOverlay'),result=$('#resultScreen');card.classList.toggle('hidden',!this.foundArtwork);card.classList.remove('reveal');overlay.classList.remove('show');overlay.setAttribute('aria-hidden','true');$('[data-action="restore"]').classList.toggle('hidden',!this.foundArtwork);if(this.foundArtwork){$('#foundTitle').textContent=this.foundArtwork.titleJp;$('#foundRarity').textContent=this.foundArtwork.rarity||'MASTERPIECE DISCOVERY';$('#woodblockLabel').textContent=win?(this.isNewDiscovery?'NEW WOODBLOCK FOUND':'RARE IMPRESSION FOUND'):'WOODBLOCK FRAGMENT RECOVERED';$('#foundArtworkImage').src=this.foundArtwork.image}this.show('resultScreen');result.classList.remove('entering');void result.offsetWidth;result.classList.add('entering');clearTimeout(this.rewardTimer);if(this.foundArtwork)this.rewardTimer=setTimeout(()=>{card.classList.add('reveal');overlay.classList.add('show');overlay.setAttribute('aria-hidden','false');this.audio.perfect()},850)}
  dismissReward(){clearTimeout(this.rewardTimer);const overlay=$('#rewardOverlay');if(!overlay)return;overlay.classList.remove('show');overlay.setAttribute('aria-hidden','true')}

  renderGallery(){if(!this.artworks.length)return;const unlocked=this.store.data.unlocked;$('#galleryCount').textContent=`${String(unlocked.length).padStart(2,'0')} / ${String(this.artworks.length).padStart(2,'0')}`;$('#galleryGrid').innerHTML=this.artworks.map((a,i)=>{const open=unlocked.includes(a.id);return `<button class="art-card ${open?'':'locked'}" data-action="art" data-index="${i}"><div class="art-thumb"><img src="${a.image}" alt="${open?a.title:'Locked artwork'}" onerror="this.src='assets/backgrounds/title-wave.png'"></div><small>${open?a.rarity:'UNDISCOVERED'}</small><strong>${open?a.title:'Unknown Impression'}</strong><em>${open?a.titleJp:'— — —'}</em></button>`}).join('')}
  showArt(i){const a=this.artworks[i];if(!this.store.data.unlocked.includes(a.id))return;const ja=this.store.data.language==='ja';$('#artDetail').innerHTML=`<img class="detail-image" src="${a.image}" alt="${a.title}" onerror="this.src='assets/backgrounds/title-wave.png'"><span class="detail-rarity">${a.rarity}</span><h1>${a.title}</h1><h3>${a.titleJp}</h3><dl class="object-meta"><div><dt>ARTIST</dt><dd>Katsushika Hokusai · 葛飾北斎</dd></div><div><dt>DATE</dt><dd>${a.date}</dd></div><div><dt>MEDIUM</dt><dd>Woodblock print; ink and color on paper</dd></div><div><dt>COLLECTION</dt><dd>${a.museum}</dd></div></dl><p class="detail-description">${ja?a.descriptionJa:a.descriptionEn}</p><a class="museum-link" href="${a.museumUrl}" target="_blank" rel="noopener">VIEW MUSEUM OBJECT RECORD ↗</a><p class="rarity-note">Public Domain · Open Access image<br>Rarity represents in-game discovery difficulty, not artistic value.</p>`;this.show('detailScreen')}
  restore(){if(!this.foundArtwork)return;this.audio.duck(1350,.18);this.show('restoreScreen');const a=this.foundArtwork,img=$('#restoreImage'),cv=$('#restoreCanvas'),c=cv.getContext('2d');img.src=a.image;img.onerror=()=>img.src='assets/backgrounds/title-wave.png';$('#restoreTitle').textContent=a.title;$('#restoreTitleJp').textContent=a.titleJp;$('#collectionUpdated').classList.add('hidden');$('.restore-stage').classList.remove('complete');let step=0;const labels=['INK PLATE · 墨','INDIGO PLATE · 藍','VERMILION PLATE · 朱','FULL IMPRESSION · 摺'];const paint=()=>{c.clearRect(0,0,cv.width,cv.height);c.globalCompositeOperation='source-over';c.fillStyle=['#d7c9a7','#b8c5bd','#c9b29d','#e7dcc2'][step];c.fillRect(0,0,cv.width,cv.height);c.globalAlpha=.45;c.strokeStyle=['#14232a','#174b65','#a34531','#183d4c'][step];c.lineWidth=step===0?2:5;for(let i=0;i<110;i++){c.beginPath();c.moveTo(rnd(0,cv.width),rnd(0,cv.height));c.bezierCurveTo(rnd(0,cv.width),rnd(0,cv.height),rnd(0,cv.width),rnd(0,cv.height),rnd(0,cv.width),rnd(0,cv.height));c.stroke()}c.globalAlpha=1;$('#restoreStep').textContent=labels[step];if(step===3){img.style.opacity=1;cv.style.opacity=.12;$('.restore-stage').classList.add('complete');if(!this.store.data.unlocked.includes(a.id)){this.store.data.unlocked.push(a.id);this.store.write()}setTimeout(()=>{$('#collectionUpdated').classList.remove('hidden');this.updateTitleProgress()},900);return}step++;setTimeout(paint,950)};img.style.opacity=0;cv.style.opacity=1;paint()}
}

window.hokusaiGame = new HokusaiGame();

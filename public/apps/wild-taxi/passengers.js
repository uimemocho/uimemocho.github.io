import * as T from './three.module.js';
const TYPES=[
 {id:'young-man',age:'young',gender:'male',height:1.03,width:1,hair:'short',bag:'backpack'},
 {id:'older-woman',age:'older',gender:'female',height:.91,width:.98,hair:'bun',bag:'tote',glasses:true},
 {id:'boy',age:'child',gender:'male',height:.73,width:.82,hair:'short',bag:'backpack'},
 {id:'woman',age:'adult',gender:'female',height:.98,width:.93,hair:'bob',bag:'tote'},
 {id:'older-man',age:'older',gender:'male',height:.96,width:1.05,hair:'receding',bag:'briefcase',glasses:true},
 {id:'girl',age:'child',gender:'female',height:.71,width:.8,hair:'ponytail',bag:'backpack'},
 {id:'man',age:'adult',gender:'male',height:1.06,width:1.08,hair:'short',bag:'briefcase',tie:true},
 {id:'young-woman',age:'young',gender:'female',height:1,width:.94,hair:'ponytail',bag:'tote'}
];
const COATS=[0x45c6b3,0xf17675,0x6f9de8,0xf2be54,0xb58cda,0xe69cb9,0xe2dfcc,0x88ba78],BOTTOMS=[0x27384d,0x56657c,0x5d4d61,0x84776b],SKIN=[0xffd4b0,0xe9b78f,0xc99272],HAIR=[0x273448,0x554239,0x78513d];
export function passengerForStage(stage,seed=0){
 const i=Math.max(0,Math.trunc(stage)||0),s=seed>>>0,type=TYPES[(i+s%TYPES.length)%TYPES.length];
 return {...type,key:s+':'+i,coat:COATS[(i*3+Math.floor(i/8)+s)%COATS.length],bottom:BOTTOMS[(i+s)%BOTTOMS.length],skin:SKIN[(i+Math.floor(s/3))%SKIN.length],hairColor:type.age==='older'?0xc6c8ce:HAIR[(i+Math.floor(s/7))%HAIR.length],bagColor:[0xe9ac58,0x916d55,0xc6a5cb,0x477c91][(i+s)%4]};
}
export function makeBoardingPassenger(profile=passengerForStage(0)){
 const g=new T.Group(),coat=new T.MeshLambertMaterial({color:profile.coat}),skin=new T.MeshLambertMaterial({color:profile.skin}),hair=new T.MeshLambertMaterial({color:profile.hairColor}),bottom=new T.MeshLambertMaterial({color:profile.bottom}),bagMat=new T.MeshLambertMaterial({color:profile.bagColor}),trim=profile.glasses?new T.MeshLambertMaterial({color:0x27384d}):null;
 const mesh=(geo,mat,x,y,z,parent=g)=>{const m=new T.Mesh(geo,mat);m.position.set(x,y,z);parent.add(m);return m};
 g.userData.profile=profile;g.userData.legs=[];g.userData.arms=[];
 mesh(new T.BoxGeometry(.59,profile.hair==='bob'?.78:.65,.38),coat,0,profile.hair==='bob'?.96:1,0);mesh(new T.SphereGeometry(.24,8,6),skin,0,1.58,0);
 mesh(new T.SphereGeometry(.247,8,4,0,Math.PI*2,0,profile.hair==='receding'?Math.PI*.28:profile.hair==='bob'?Math.PI*.66:Math.PI*.48),hair,0,1.61,0);
 if(profile.hair==='bob')mesh(new T.BoxGeometry(.45,.31,.2),hair,0,1.43,-.15);
 if(profile.hair==='ponytail')mesh(new T.BoxGeometry(.16,.31,.21),hair,0,1.48,-.29);
 if(profile.hair==='bun')mesh(new T.SphereGeometry(.13,7,5),hair,0,1.81,-.12);
 if(profile.glasses){for(const x of [-.102,.102])mesh(new T.TorusGeometry(.075,.014,4,8),trim,x,1.6,.226);mesh(new T.BoxGeometry(.055,.024,.025),trim,0,1.6,.226)}
 if(profile.tie)mesh(new T.BoxGeometry(.075,.29,.022),bagMat,0,1.12,.207);
 for(const side of [-1,1]){const leg=new T.Group();leg.position.set(side*.16,.72,0);g.add(leg);mesh(new T.BoxGeometry(.2,.72,.22),bottom,0,-.36,0,leg);g.userData.legs.push(leg);const arm=new T.Group();arm.position.set(side*.38,1.26,0);g.add(arm);mesh(new T.BoxGeometry(.14,.58,.16),coat,0,-.27,0,arm);mesh(new T.BoxGeometry(.15,.16,.16),skin,0,-.61,0,arm);g.userData.arms.push(arm);
  if(side<0&&profile.bag!=='backpack')mesh(new T.BoxGeometry(profile.bag==='briefcase'?.4:.31,profile.bag==='briefcase'?.27:.38,.19),bagMat,0,-.78,0,arm);
 }
 if(profile.bag==='backpack')mesh(new T.BoxGeometry(.43,.47,.18),bagMat,0,1.02,-.29);
 g.visible=false;return g;
}
export function disposePassenger(model){const seen=new Set();model.traverse(o=>{if(!o.isMesh)return;for(const resource of [o.geometry,o.material])if(!seen.has(resource)){seen.add(resource);resource.dispose()}});model.removeFromParent()}

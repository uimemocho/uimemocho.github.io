// Perspective-correct per-pixel depth for the hero car. Painter sorting cannot
// correctly hide wheels, glazing and trim behind a large body triangle.
export function rasterCar(faces,bounds,scale=2,night=false){
 const width=Math.max(1,Math.ceil(bounds.width*scale)),height=Math.max(1,Math.ceil(bounds.height*scale)),pixels=new Uint8ClampedArray(width*height*4),depth=new Float32Array(width*height);
 for(const face of faces){const points=face.q.map(p=>({x:(p.x-bounds.x)*scale,y:(p.y-bounds.y)*scale,z:1/p.depth})),[a,b,c]=points,den=(b.y-c.y)*(a.x-c.x)+(c.x-b.x)*(a.y-c.y);if(Math.abs(den)<1e-8)continue;
  const minX=Math.max(0,Math.floor(Math.min(a.x,b.x,c.x))),maxX=Math.min(width-1,Math.ceil(Math.max(a.x,b.x,c.x))),minY=Math.max(0,Math.floor(Math.min(a.y,b.y,c.y))),maxY=Math.min(height-1,Math.ceil(Math.max(a.y,b.y,c.y))),hex=parseInt(face.color.slice(1),16),base=[hex>>16&255,hex>>8&255,hex&255];
  for(let y=minY;y<=maxY;y++)for(let x=minX;x<=maxX;x++){const xx=x+.5,yy=y+.5,u=((b.y-c.y)*(xx-c.x)+(c.x-b.x)*(yy-c.y))/den,v=((c.y-a.y)*(xx-c.x)+(a.x-c.x)*(yy-c.y))/den,t=1-u-v;if(u< -1e-6||v< -1e-6||t< -1e-6)continue;const inv=u*a.z+v*b.z+t*c.z,index=y*width+x;if(inv<=depth[index])continue;let r=base[0],g=base[1],bl=base[2];
   if(face.glass){const screenY=bounds.y+(y+.5)/scale,s=Math.max(0,Math.min(1,(screenY-face.glassTop)/face.glassHeight)),top=[24,61,89],mid=night?[73,101,130]:[129,167,189],bottom=[51,92,115],start=s<.62?top:mid,end=s<.62?mid:bottom,k=s<.62?s/.62:(s-.62)/.38;r=start[0]+(end[0]-start[0])*k;g=start[1]+(end[1]-start[1])*k;bl=start[2]+(end[2]-start[2])*k}
   if(face.texture&&face.uv){const uv=face.uv,tex=face.texture,tx=Math.max(0,Math.min(tex.width-1,Math.floor((u*uv[0][0]*a.z+v*uv[1][0]*b.z+t*uv[2][0]*c.z)/inv*tex.width))),ty=Math.max(0,Math.min(tex.height-1,Math.floor((1-(u*uv[0][1]*a.z+v*uv[1][1]*b.z+t*uv[2][1]*c.z)/inv)*tex.height))),pixel=(ty*tex.width+tx)*4;if(tex.data[pixel+3]<128)continue;r=tex.data[pixel];g=tex.data[pixel+1];bl=tex.data[pixel+2]}
   depth[index]=inv;const out=index*4;pixels[out]=r;pixels[out+1]=g;pixels[out+2]=bl;pixels[out+3]=255;
  }
 }
 return {width,height,pixels};
}
export function drawSoftwareCar(ctx,faces,w,h,night=false){
 if(!faces.length)return;const points=faces.flatMap(f=>f.q),x=Math.max(0,Math.floor(Math.min(...points.map(p=>p.x)))-2),y=Math.max(0,Math.floor(Math.min(...points.map(p=>p.y)))-2),right=Math.min(w,Math.ceil(Math.max(...points.map(p=>p.x)))+2),bottom=Math.min(h,Math.ceil(Math.max(...points.map(p=>p.y)))+2);if(right<=x||bottom<=y)return;
 const textures=new Map();for(const face of faces){face.glassTop=h*.35;face.glassHeight=h*.43;if(face.map){if(!textures.has(face.map))textures.set(face.map,face.map.getContext('2d').getImageData(0,0,face.map.width,face.map.height));face.texture=textures.get(face.map)}}
 const bounds={x,y,width:right-x,height:bottom-y},scale=bounds.width*bounds.height>240000?1:2,result=rasterCar(faces,bounds,scale,night),tile=document.createElement('canvas');tile.width=result.width;tile.height=result.height;tile.getContext('2d').putImageData(new ImageData(result.pixels,result.width,result.height),0,0);ctx.drawImage(tile,x,y,bounds.width,bounds.height);
}

// A lit sphere samples continuous three-dimensional noise, so clouds and relief follow its limb.
export function surveyGlobe(doc,planet,large=false){
  const side=large?240:100,canvas=doc.createElement('canvas');canvas.width=side;canvas.height=side;canvas.className='survey-globe'+(large?' large':'');canvas.setAttribute('role','img');canvas.setAttribute('aria-label',planet.name+' · '+(planet.planetType||'未分类行星'));
  const ctx=canvas.getContext('2d');if(!ctx)return canvas;
  const out=ctx.createImageData(side,side),kind=planet.planetType||'',seed=Array.from(planet.id).reduce((v,c)=>(v*33+c.charCodeAt(0))|0,753);
  const hash=(x,y,z)=>{let n=seed^Math.imul(x,374761393)^Math.imul(y,668265263)^Math.imul(z,974711);n=Math.imul(n^(n>>>13),1274126177);return ((n^(n>>>16))>>>0)/4294967296;};
  const lerp=(a,b,t)=>a+(b-a)*t,smooth=t=>t*t*(3-2*t);
  function noise(x,y,z){const i=Math.floor(x),j=Math.floor(y),k=Math.floor(z),a=smooth(x-i),b=smooth(y-j),c=smooth(z-k);const layer=h=>lerp(lerp(hash(i,j,h),hash(i+1,j,h),a),lerp(hash(i,j+1,h),hash(i+1,j+1,h),a),b);return lerp(layer(k),layer(k+1),c);}
  function terrain(x,y,z){return noise(x*3,y*3,z*3)*.53+noise(x*7,y*7,z*7)*.26+noise(x*17,y*17,z*17)*.15+noise(x*39,y*39,z*39)*.06;}
  for(let row=0;row<side;row++)for(let col=0;col<side;col++){
    const x=(col+.5)/side*2-1,y=(row+.5)/side*2-1,r=x*x+y*y;if(r>=1)continue;const z=Math.sqrt(1-r),n=terrain(x,y,z),illum=.15+.85*Math.max(0,(-x*.61-y*.48+z*.62)),air=Math.pow(1-z,3);
    let rgb;
    if(/气态/.test(kind)){const v=.5+.5*Math.sin(y*29+4*n);rgb=[139+72*v,104+46*v,98+27*v];}
    else if(/熔岩/.test(kind))rgb=n>.52&&n<.55?[255,105,23]:[84*n+27,42*n+13,48*n+15];
    else if(/冰封/.test(kind))rgb=[100+n*135,149+n*89,176+n*75];
    else if(/沙漠/.test(kind))rgb=[143+n*103,81+n*96,47+n*60];
    else if(/岩石|荒芜/.test(kind))rgb=[65+139*n,71+121*n,78+116*n];
    else{const sea=/海洋/.test(kind)?.62:.48;rgb=n<sea?[22+n*46,58+80*n,101+98*n]:[53+n*94,88+n*97,58+n*73];const cloud=terrain(x*2+3,y*3+1,z*2-2),v=Math.min(.85,Math.max(0,(cloud-.54)*5));rgb=rgb.map(c=>lerp(c,240,v));}
    const index=(row*side+col)*4;for(let k=0;k<3;k++)out.data[index+k]=rgb[k]*illum+[43,116,175][k]*air;out.data[index+3]=Math.min(255,z*side*130);
  }ctx.putImageData(out,0,0);return canvas;
}

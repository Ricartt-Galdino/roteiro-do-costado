export interface Pixels { data: Uint8Array | Uint8ClampedArray; width:number; height:number }
export interface Rect { left:number; top:number; width:number; height:number }
export function enhanceGray(pixels:Pixels, invert=false, denoise=false):Uint8ClampedArray{
 const {width:w,height:h,data}=pixels,n=w*h,gray=new Uint8Array(n),hist=new Uint32Array(256);
 for(let i=0;i<n;i++)gray[i]=Math.round(data[i*4]*.299+data[i*4+1]*.587+data[i*4+2]*.114);
 const filtered=gray.slice();
 if(denoise){const values=new Uint8Array(9);for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++){let j=0;for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)values[j++]=gray[(y+dy)*w+x+dx];values.sort();filtered[y*w+x]=values[4];}}
 for(const value of filtered)hist[value]++;
 let low=0,high=255,count=0;while(low<254&&(count+=hist[low])<n*.01)low++;
 count=0;while(high>low+1&&(count+=hist[high])<n*.01)high--;
 const result=new Uint8ClampedArray(n*4);
 for(let i=0;i<n;i++){let v=Math.max(0,Math.min(255,(filtered[i]-low)*255/Math.max(1,high-low)));if(invert)v=255-v;result[i*4]=result[i*4+1]=result[i*4+2]=v;result[i*4+3]=255;}
 return result;
}
// Cor localiza a etiqueta; o nome sempre vem da leitura dos caracteres, nunca da cor.
export function findLabels(image:Pixels):Rect[]{
 const {width:w,height:h,data}=image,limit=Math.ceil(w*.3),mask=new Uint8Array(limit*h),out:Rect[]=[];
 for(let y=0;y<h;y++)for(let x=0;x<limit;x++){
  const i=(y*w+x)*4,r=data[i],g=data[i+1],b=data[i+2],max=Math.max(r,g,b),min=Math.min(r,g,b);
  if(max-min>35&&((b>r*1.5&&b>g*1.5)||(r>130&&g>100&&b<Math.min(r,g)*.65)||(g<85&&r>g*1.5&&b>g*1.4&&r>40&&b>40)))mask[y*limit+x]=1;
 }
 const queue=new Int32Array(limit*h);
 for(let pos=0;pos<mask.length;pos++)if(mask[pos]){
  let head=0,tail=1;queue[0]=pos;mask[pos]=0;let minX=limit,maxX=0,minY=h,maxY=0;
  while(head<tail){const p=queue[head++],x=p%limit,y=Math.floor(p/limit);minX=Math.min(x,minX);maxX=Math.max(x,maxX);minY=Math.min(y,minY);maxY=Math.max(y,maxY);
   for(const q of [x>0?p-1:-1,x<limit-1?p+1:-1,y>0?p-limit:-1,y<h-1?p+limit:-1])if(q>=0&&mask[q]){mask[q]=0;queue[tail++]=q;}
  }
  const rw=maxX-minX+1,rh=maxY-minY+1;
  if(tail>w*h*.0006&&rw>w*.035&&rw<w*.26&&rh>h*.012&&rh<h*.13&&rw/rh>1.7&&rw/rh<9&&tail/(rw*rh)>.35)out.push({left:minX,top:minY,width:rw,height:rh});
 }
 return out.sort((a,b)=>a.top-b.top);
}

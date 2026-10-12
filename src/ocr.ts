import { createWorker, PSM, type ImageLike, type Worker, type Page } from 'tesseract.js';
import { findLabels, enhanceGray, type Rect, type Pixels } from './ocr-image';
import {isHeader,normalizeEquipment,parseWorkList,parseRow} from './import';
import {reconcileQuantities} from './ocr-consensus';
export interface OcrInput { pixels:Pixels; original:ImageLike; prepare:(rect:Rect|null,kind:'page'|'label'|'inverse'|'raw'|'row'|'rowRaw'|'rowInverse'|'labelFull'|'labelSmall')=>Promise<ImageLike> }
const lines=(p:Page)=>(p.blocks??[]).flatMap(b=>b.paragraphs.flatMap(p=>p.lines));
const middle=(values:number[])=>values.slice().sort((a,b)=>a-b)[Math.floor(values.length/2)];
const score=(text:string)=>{const r=parseWorkList(text);return r.plans.reduce((n,p)=>n+p.steps.length*10+p.steps.filter(s=>s.moves!==null).length*3+p.steps.filter(s=>!s.bay.includes('?')).length*4+(p.vessel?3:0)+(p.equipment?20:0),0)-r.warnings.filter(w=>w.includes('cabeçalho informa')).length*5;};
// Não completar uma quantidade pela diferença do total: total é somente uma verificação.
export async function readWithWorker(input:OcrInput,worker:Worker,progress:(text:string)=>void=()=>{}){
 progress('Lendo lista original…');await worker.setParameters({tessedit_pageseg_mode:PSM.SINGLE_BLOCK,tessedit_char_whitelist:''});
 const original=(await worker.recognize(input.original,{}, {text:true,blocks:true})).data;
 progress('Reduzindo interferência da foto e lendo novamente…');
 const prepared=await input.prepare(null,'page');
 const enhanced=(await worker.recognize(prepared,{}, {text:true,blocks:true})).data;
 const source=input.pixels,labels=findLabels(source),known: {y:number;id:string;confidence:number}[]=[];
 const headers=lines(original).filter(l=>isHeader(l.text));
 for(const [index,line] of headers.entries()){
  const anchors=line.words.filter(w=>/moves|mph|sph|planned|planmed/i.test(w.text));
  const y=anchors.length?middle(anchors.map(w=>(w.bbox.y0+w.bbox.y1)/2)):(line.bbox.y0+line.bbox.y1)/2;
  let box=labels.find(r=>Math.abs(r.top+r.height/2-y)<r.height*.8);
  if(!box&&labels.length)box={left:middle(labels.map(r=>r.left)),top:Math.max(0,Math.round(y-middle(labels.map(r=>r.height))*.6)),width:middle(labels.map(r=>r.width)),height:middle(labels.map(r=>r.height))};
  if(!box)continue;
  progress(`Lendo etiqueta do equipamento ${index+1} de ${headers.length}…`);
  const readings:{id:string;confidence:number}[]=[];
  for(const kind of ['raw','label','inverse','labelFull','labelSmall'] as const){
   await worker.setParameters({tessedit_pageseg_mode:PSM.SINGLE_LINE,tessedit_char_whitelist:'SM0123456789'});
   const r=(await worker.recognize(await input.prepare(box,kind))).data,id=normalizeEquipment(r.text.trim());
   if(id)readings.push({id,confidence:r.confidence});
  }
  if(!readings.length){
   await worker.setParameters({tessedit_pageseg_mode:PSM.SINGLE_WORD});
   for(const kind of ['label','inverse','labelFull','labelSmall'] as const){
    const r=(await worker.recognize(await input.prepare(box,kind))).data,id=normalizeEquipment(r.text.trim());
    if(id)readings.push({id,confidence:Math.min(60,r.confidence)});
   }
  }
  if(!readings.length){
   await worker.setParameters({tessedit_pageseg_mode:PSM.SINGLE_WORD,tessedit_char_whitelist:''});
   for(const kind of ['labelFull','labelSmall','inverse'] as const){
    const r=(await worker.recognize(await input.prepare(box,kind))).data;
    const id=normalizeEquipment(r.text.trim().replace(/^[^a-z0-9]+|[^a-z0-9]+$/gi,''));
    if(id)readings.push({id,confidence:Math.min(60,r.confidence)});
   }
  }
  if(!readings.length)continue;
  if(new Set(readings.map(r=>r.id)).size>1)continue;
  const best=readings.reduce((a,b)=>a.confidence>b.confidence?a:b);
  known.push({y,id:best.id,confidence:best.confidence});
 }
 const apply=(page:Page,scale:number)=>{
  const rows=lines(page);if(!rows.length)return page.text;
  return rows.map(line=>{
   if(!isHeader(line.text))return line.text.trim();
   const anchors=line.words.filter(w=>/moves|mph|sph/i.test(w.text));
   const y=(anchors.length?middle(anchors.map(w=>(w.bbox.y0+w.bbox.y1)/2)):(line.bbox.y0+line.bbox.y1)/2)/scale;
   const tag=known.find(k=>Math.abs(k.y-y)<source.height*.045);if(!tag)return line.text.trim();
   return `${tag.id} ${line.text.trim()}${tag.confidence<70?' [conferir etiqueta]':''}`;
  }).join('\n');
 };
 const scale=Math.min(2200/source.width,3200/source.height,3.6);
 const first=apply(original,1),second=apply(enhanced,scale);
 let text=score(second)>score(first)?second:first;
 const chosen=text===second?enhanced:original,other=text===second?first:second;
 const chosenScale=chosen===enhanced?scale:1;
 const rowLines=lines(chosen).filter(l=>parseRow(l.text));
 // Marcar discordâncias preserva rastreabilidade sem trocar silenciosamente números.
 const a=parseWorkList(text).plans,b=parseWorkList(other).plans;
 const checks=a.flatMap((p,pi)=>{
  const counterpart=p.equipment?b.find(q=>q.equipment===p.equipment):b[pi];
  return p.steps.map((s,si)=>{
   const occurrence=p.steps.slice(0,si).filter(t=>t.bay===s.bay&&t.operation===s.operation).length;
   const t=counterpart?.steps.filter(t=>t.bay===s.bay&&t.operation===s.operation)[occurrence];
   const fields=t?(['moves','reefers','empty'] as const).filter(k=>s[k]!==t[k]):[];
   return {label:`${p.equipment||'Bloco '+(pi+1)} · ${s.bay} ${s.operation}`,fields,s,t};
  });
 });
 const recovered=new Map<number,string>();
 await worker.setParameters({tessedit_pageseg_mode:PSM.SINGLE_LINE,tessedit_char_whitelist:''});
 for(const [i,check] of checks.entries()){
  if(!check.fields.length||!rowLines[i])continue;
  progress(`Conferindo linha ${i+1} de ${checks.length} em recorte ampliado…`);
  const line=rowLines[i],anchor=line.words.find(w=>/^(Load|Disch)/i.test(w.text))?.bbox??line.bbox;
  const top=Math.max(0,Math.floor(anchor.y0/chosenScale)-3);
  const bottom=Math.min(source.height,Math.ceil(anchor.y1/chosenScale)+3);
  const rect={left:0,top,width:Math.round(source.width*.82),height:bottom-top};
  let values={moves:check.s.moves,reefers:check.s.reefers,empty:check.s.empty},unresolved=check.fields;
  // Linhas em fotos de monitor podem ter fundo claro, escuro ou moiré. Aceita
  // somente uma leitura adicional que confirme uma das duas leituras principais.
  for(const kind of ['row','rowRaw','rowInverse'] as const){
   const result=(await worker.recognize(await input.prepare(rect,kind))).data;
   const third=parseRow(result.text.trim());
   const validThird=third?.bay===check.s.bay&&third?.operation===check.s.operation?third:null;
   const proposal=reconcileQuantities(check.s,check.t!,validThird);
   if(proposal.unresolved.length<unresolved.length){values=proposal.values;unresolved=proposal.unresolved;}
  }
  check.fields=unresolved;
  if(values.moves!==null)recovered.set(i,`${check.s.bay} ${check.s.operation==='embarque'?'Load':'Disch'} ${values.moves} movimentos${values.reefers!==null?` (${values.reefers}xRfr)`:''}${values.empty!==null?` (${values.empty}xMty)`:''}${/twin/i.test(check.s.notes)?' [twin: conferir]':''} [OCR: revisar linha]`);
 }
 let rowIndex=0;
 text=text.split('\n').map(line=>{
  if(!parseRow(line))return line;
  line=recovered.get(rowIndex)??line;
  const check=checks[rowIndex++];
  return check?.fields.length?`${line} [OCR: conferir ${check.fields.join(',')}]`:line;
 }).join('\n');
 const disagreements=checks.filter(c=>c.fields.length).map(c=>c.label);
 progress('Conferindo equipamentos e totais…');
 return {text,confidence:chosen.confidence,original:original.text,disagreements:[...new Set(disagreements)]};
}
export async function readImage(file:File,progress:(text:string)=>void){
 const image=await createImageBitmap(file),canvas=document.createElement('canvas');
 if(image.width*image.height>25_000_000){image.close();throw Error('Imagem muito grande; use uma captura de até 25 megapixels.');}
 canvas.width=image.width;canvas.height=image.height;
 const context=canvas.getContext('2d',{willReadFrequently:true})!;context.drawImage(image,0,0);image.close();
 const pixels=context.getImageData(0,0,canvas.width,canvas.height);
 const prepare:OcrInput['prepare']=async(rect,kind)=>{
  let r=rect??{left:0,top:0,width:canvas.width,height:canvas.height};
  if(rect&&kind!=='row'&&kind!=='labelFull'&&kind!=='labelSmall')r={left:r.left+Math.round(r.width*.08),top:r.top+Math.round(r.height*.15),width:Math.round(r.width*.84),height:Math.round(r.height*.7)};
  r={...r,width:Math.min(r.width,canvas.width-r.left),height:Math.min(r.height,canvas.height-r.top)};
  const scale=kind==='labelSmall'?200/r.width:['row','rowRaw','rowInverse'].includes(kind)?Math.min(4,2200/r.width):rect?500/r.width:Math.min(2200/canvas.width,3200/canvas.height,3.6);
  const resized=document.createElement('canvas');resized.width=Math.round(r.width*scale);resized.height=Math.round(r.height*scale);
  const ctx=resized.getContext('2d',{willReadFrequently:true})!;ctx.imageSmoothingQuality='high';ctx.drawImage(canvas,r.left,r.top,r.width,r.height,0,0,resized.width,resized.height);
  const data=ctx.getImageData(0,0,resized.width,resized.height),tone=enhanceGray(data,kind==='inverse'||kind==='rowInverse',(kind==='page'||kind==='row'||kind==='rowInverse'));if(kind!=='raw'&&kind!=='rowRaw'){data.data.set(tone);ctx.putImageData(data,0,0);}
  if(rect){const padded=document.createElement('canvas');padded.width=resized.width+40;padded.height=resized.height+40;const p=padded.getContext('2d')!;p.fillStyle='white';p.fillRect(0,0,padded.width,padded.height);p.drawImage(resized,20,20);return padded;}
  return resized;
 };
 const worker=await createWorker('eng',1,{workerPath:'/ocr/worker.min.js',corePath:'/ocr/tesseract-core-lstm.wasm.js',langPath:'/ocr',workerBlobURL:false});
 try{return await readWithWorker({original:file,pixels,prepare},worker,progress);}finally{await worker.terminate();}
}







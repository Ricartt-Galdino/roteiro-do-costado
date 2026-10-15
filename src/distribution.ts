const endpoint='https://firestore.googleapis.com/v1/projects/escala-do-patio/databases/(default)/documents/escala/';
type Operator={id:string;nome:string;ogmo?:boolean;horaExtra?:boolean};
type Front={id:string;nome:string;terno?:string};
export type Board={alocacoes?:Record<string,string>;extras?:Operator[];horasExtras?:Operator[];frentes?:Front[];locais?:Record<string,string>;intervalos?:Record<string,string>;fora?:Record<string,{motivo?:string}>};
type Loaded={board:Board|null;operators:Operator[];updated:string;readAt:number};
const escape=(value:unknown)=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const shifts=['01X07','07X13','13X19','19X01','07X19','19X07'];
function currentPeriod(){
 const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',hourCycle:'h23'}).formatToParts(new Date());
 const get=(key:string)=>parts.find(p=>p.type===key)!.value;
 let date=`${get('year')}-${get('month')}-${get('day')}`;const hour=Number(get('hour'));
 if(hour<1)date=new Date(Date.parse(date+'T12:00:00Z')-86400000).toISOString().slice(0,10);
 const weekend=[0,6].includes(new Date(date+'T12:00:00Z').getUTCDay());
 return {date,shift:weekend?(hour>=7&&hour<19?'07X19':'19X07'):hour>=1&&hour<7?'01X07':hour>=7&&hour<13?'07X13':hour>=13&&hour<19?'13X19':'19X01'};
}
let selected=currentPeriod(),automatic=true,loaded:Loaded|null=null,loading=false,error='',request=0;
const collapsedFronts=new Set<string>();
const frontEquipmentNames:Record<string,string>={STS1:'STS 01',STS2:'STS 02',MHCL:'MHC Liebherr',MHCK1:'MHC KONE 01',MHCK2:'MHC KONE 02'};
let equipmentOverrides:Record<string,string>={};
try{const saved=JSON.parse(localStorage.getItem('costado.front-equipment.v1')??'{}');if(saved&&typeof saved==='object'&&!Array.isArray(saved))equipmentOverrides=saved;}catch{/* Sem correções locais disponíveis. */}
const overrideKey=(id:string)=>`${selected.date}|${selected.shift}|${id}`;
let localBreaks:Record<string,boolean>={};
try{const saved=JSON.parse(localStorage.getItem('costado.cam-breaks.v1')??'{}');if(saved&&typeof saved==='object'&&!Array.isArray(saved))localBreaks=saved;}catch{/* Sem marcações locais. */}
const breakKey=(id:string,personId:string)=>`${selected.date}|${selected.shift}|${id}|${personId}`;
function isOnBreak(row:{id:string;personId:string}){return localBreaks[breakKey(row.id,row.personId)]===true;}
export function toggleCamBreak(id:string,personId:string){
 if(!/^CAM\d+$/i.test(id))return;
 const key=breakKey(id,personId),next={...localBreaks};
 if(next[key])delete next[key];else next[key]=true;
 localStorage.setItem('costado.cam-breaks.v1',JSON.stringify(next));localBreaks=next;
}
export function distributionEquipment(id:string){
 const local=equipmentOverrides[overrideKey(id)];
 const source=Object.entries(loaded?.board?.locais??{}).filter(([equipment,front])=>front===id&&frontEquipmentNames[equipment]&&!loaded?.board?.fora?.[equipment]).map(([equipment])=>frontEquipmentNames[equipment]).join(' · ');
 return {value:typeof local==='string'?local:source,local:typeof local==='string',source};
}
export function saveDistributionEquipment(id:string,value:string){
 const next={...equipmentOverrides},clean=value.trim();
 if(clean)next[overrideKey(id)]=clean;else delete next[overrideKey(id)];
 localStorage.setItem('costado.front-equipment.v1',JSON.stringify(next));equipmentOverrides=next;
}
export function toggleDistributionFront(id:string){
 if(collapsedFronts.has(id))collapsedFronts.delete(id);else collapsedFronts.add(id);
}
async function readDocument(key:string,signal:AbortSignal){
 // Os IDs na origem já contêm encodeURIComponent; a URL REST precisa codificá-los novamente.
 const response=await fetch(endpoint+encodeURIComponent(encodeURIComponent(key)),{method:'GET',cache:'no-store',signal});
 if(response.status===404)return null;
 if(!response.ok)throw Error('Não foi possível consultar a escala da sala.');
 const doc=await response.json();
 const value=doc.fields?.value?.stringValue;
 if(typeof value!=='string')throw Error('Formato da escala não reconhecido.');
 return {value:JSON.parse(value),updated:doc.updateTime as string};
}
export function distributionRows(board:Board,operators:Operator[],family:'CAM'|'RS'='CAM'){
 const people=new Map([...operators,...board.extras??[],...board.horasExtras??[]].map(person=>[person.id,person]));
 return Object.entries(board.alocacoes??{}).filter(([id])=>(family==='CAM'?/^CAM\d+$/i:/^RS\d+$/i).test(id)).map(([id,personId])=>{
  const person=people.get(personId),frontId=family==='CAM'?(board.locais?.[`op:${personId}`]??board.locais?.[id]):board.locais?.[id];
  return {id,personId,name:person?.nome??(family==='CAM'?'Motorista não identificado':'Operador não identificado'),type:person?(person.ogmo?'OGMO':'Vinculado'):'Vínculo não informado',extra:!!person?.horaExtra,frontId:frontId??'',interval:family==='CAM'?(board.intervalos?.[`op:${personId}`]??board.intervalos?.[id]):board.intervalos?.[id],unavailable:board.fora?.[id]?.motivo};
 }).sort((a,b)=>Number(a.id.slice(family.length))-Number(b.id.slice(family.length)));
}
export async function refreshDistribution(onChange:()=>void){
 if(loading)return;
 if(automatic){const next=currentPeriod();if(next.date!==selected.date||next.shift!==selected.shift)loaded=null;selected=next;}
 const token=++request;loading=true;error='';onChange();
 const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),15000);
 try{
  const [board,operators]=await Promise.all([readDocument(`q:${selected.date}:${selected.shift}`,controller.signal),readDocument('escala:operadores',controller.signal)]);
  if(token!==request)return;
  if(board&&(!board.value||typeof board.value!=='object'||!Array.isArray(board.value.frentes)))throw Error('Formato da distribuição não reconhecido.');
  if(!operators||!Array.isArray(operators.value))throw Error('Cadastro de motoristas indisponível.');
  loaded={board:board?.value??null,operators:operators.value,updated:board?.updated??'',readAt:Date.now()};
 }catch{if(token===request)error='Falha na consulta à sala. '+(loaded?'Exibindo a última leitura; os dados podem estar desatualizados.':'Tente atualizar novamente.');}
 finally{clearTimeout(timeout);if(token===request){loading=false;onChange();}}
}
export function selectDistribution(field:string,value:string,onChange:()=>void){
 if(field==='now'){automatic=true;}else{
  if(field==='date'&&!/^\d{4}-\d{2}-\d{2}$/.test(value))return;
  if(field==='shift'&&!shifts.includes(value))return;
  automatic=false;selected={...selected,...(field==='date'?{date:value}:{shift:value})};
 }
 request++;loading=false;loaded=null;void refreshDistribution(onChange);
}
const clock=(value:string|number)=>new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',hour:'2-digit',minute:'2-digit'}).format(new Date(value));
export function nextBreak(rows:{id:string;interval?:string;unavailable?:string}[],date:string,shift:string,now=Date.now()){
 const [start,end]=shift.split('X').map(Number),midnight=Date.parse(`${date}T00:00:00-03:00`);
 const candidates=rows.flatMap(row=>{
  if(row.unavailable||!row.interval||!/^([01]\d|2[0-3]):[0-5]\d$/.test(row.interval))return [];
  const [hour,minute]=row.interval.split(':').map(Number);
  const offset=end<=start&&hour<start?86400000:0;
  const at=midnight+offset+(hour*60+minute)*60000;
  const shiftEnd=midnight+(end<=start?86400000:0)+end*3600000;
  if(at<now||at<midnight+start*3600000||at>=shiftEnd)return [];
  return [{id:row.id,at,time:row.interval}];
 });
 const first=Math.min(...candidates.map(row=>row.at));
 return candidates.filter(row=>row.at===first).map(row=>({...row,minutes:Math.ceil((row.at-now)/60000)}));
}
export function renderDistribution(family:'CAM'|'RS'='CAM'){
 const title=family==='CAM'?'Distribuição de Cam.':'Op. Reach Stacker';
 const description=family==='CAM'?'Motoristas e caminhões por navio e terno, conforme a distribuição da sala.':'Operadores de Reach Stacker por navio, terno e pátio, conforme a distribuição da sala.';
 const rows=loaded?.board?distributionRows(loaded.board,loaded.operators,family):[];
 const reachStackers=family==='CAM'&&loaded?.board?distributionRows(loaded.board,loaded.operators,'RS'):[];
 const fronts=loaded?.board?.frentes??[];
 const unknown=[...new Set(rows.map(row=>row.frontId).filter(id=>!fronts.some(front=>front.id===id)))];
 const groups=[...fronts,...unknown.map(id=>({id,nome:id?'Frente não identificada':'Sem frente atribuída',terno:''}))];
 const cards=groups.map(front=>{
  const trucks=rows.filter(row=>row.frontId===front.id);
  const matchingRS=front.terno?reachStackers.filter(row=>row.frontId===front.id):[];
  const rsSummary=matchingRS.length?`<span class="cam-rs-summary">${matchingRS.map(row=>`<span class="cam-rs-item"><b>RS ${escape(row.id.slice(2).padStart(2,'0'))}</b><span><strong>${escape(row.name)}</strong><small>${escape(row.type)}${row.extra?' · Hora extra':''}</small>${row.unavailable?`<small class="error">Indisponível: ${escape(row.unavailable)}</small>`:''}</span></span>`).join('')}</span>`:'';
  const upcoming=family==='CAM'?nextBreak(trucks.filter(row=>!isOnBreak(row)),selected.date,selected.shift):[];
  const breakCount=family==='CAM'?trucks.filter(isOnBreak).length:0;
  const nextLabel=upcoming.length?`Próximo intervalo · ${upcoming.map(row=>`CAM ${row.id.slice(3).padStart(2,'0')}`).join(', ')} · ${upcoming[0].time} · ${upcoming[0].minutes===0?'agora':`em ${upcoming[0].minutes} min`}`:'';
  if(!trucks.length&&(!front.terno||front.id==='patio'))return '';
  const collapsed=collapsedFronts.has(`${family}:${front.id}`),contentId=`cam-front-${family}-${encodeURIComponent(front.id)}`;
  const equipment=distributionEquipment(front.id),showEquipment=!!front.terno&&front.id!=='patio';
  return `<article class="cam-front"><button type="button" class="cam-front-head" data-action="distribution-toggle" data-front="${family}:${escape(front.id)}" aria-expanded="${!collapsed}" aria-controls="${contentId}"><span class="cam-front-title"><span>${front.terno?`${escape(front.terno)}º TERNO`:'APOIO / PÁTIO'}</span><span class="cam-front-name">${escape(front.nome)}</span>${showEquipment?`<span class="cam-equipment-label">${escape(equipment.value||'Equipamento não informado')}</span>`:''}${nextLabel?`<span class="cam-next-summary">${escape(nextLabel)}</span>`:''}</span>${rsSummary}<strong>${trucks.length}<small> ${family}</small>${breakCount?`<small class="cam-break-count">${breakCount} em intervalo</small>`:''}</strong></button>${showEquipment?`<div class="cam-equipment-edit"><span>${equipment.local?'Ajustado no Costado':'Conforme a sala'}</span><button type="button" data-action="distribution-equipment" data-front="${escape(front.id)}">Editar equipamento</button></div>`:''}<div id="${contentId}" ${collapsed?'hidden':''}>${trucks.length?trucks.map(truck=>`<div class="cam-row ${family==='CAM'&&isOnBreak(truck)?'cam-on-break':''} ${upcoming.some(row=>row.id===truck.id)?'cam-next-break':''}">${family==='CAM'?`<button type="button" class="cam-break-toggle" data-action="cam-break" data-cam="${escape(truck.id)}" data-person="${escape(truck.personId)}" aria-pressed="${isOnBreak(truck)}" aria-label="${isOnBreak(truck)?'Marcar retorno do':'Marcar intervalo do'} ${escape(truck.id)}">CAM ${escape(truck.id.slice(3).padStart(2,'0'))}</button>`:`<b>RS ${escape(truck.id.slice(2).padStart(2,'0'))}</b>`}<div><strong>${escape(truck.name)}</strong>${family==='CAM'&&isOnBreak(truck)?'<span class="cam-break-badge">EM INTERVALO · marcação local</span>':''}${upcoming.some(row=>row.id===truck.id)?`<span class="cam-next-badge">PRÓXIMO A SAIR · ${escape(truck.interval)}</span>`:''}<span>${escape(truck.type)}${truck.extra?' · Hora extra':''}</span>${truck.interval?`<small>Intervalo programado: ${escape(truck.interval)}</small>`:''}${truck.unavailable?`<small class="error">Indisponível: ${escape(truck.unavailable)}</small>`:''}</div></div>`).join(''):`<p class="muted">Nenhum ${family} atribuído neste terno.</p>`}</div></article>`;
 }).join('');
 return `<section class="cam-heading"><div><div class="eyebrow">CONSULTA · ESCALA DA SALA</div><h1>${title}</h1><p>${description}</p></div><button data-action="distribution-refresh" ${loading?'disabled':''}>${loading?'Consultando…':'Atualizar agora'}</button></section><div class="cam-filters"><label>Data operacional<input type="date" data-cam-field="date" value="${selected.date}"></label><label>Turno<select data-cam-field="shift">${shifts.map(shift=>`<option value="${shift}" ${shift===selected.shift?'selected':''}>${shift.replace('X','h–')}h</option>`).join('')}</select></label><button data-action="distribution-now" ${automatic?'disabled':''}>Acompanhar turno atual</button><a href="https://brunosth-rgb.github.io/escala-ops/" target="_blank" rel="noopener noreferrer">Consultar fonte ↗</a></div><p class="cam-reading" role="status">${automatic?'Turno atual · ':''}${loaded?`Consultado às ${clock(loaded.readAt)}${loaded.updated?` · Sala alterou às ${clock(loaded.updated)}`:''}`:loading?'Consultando dados da sala…':'Aguardando consulta'} · Atualização automática a cada 30 s</p>${error?`<p class="warning" role="alert">${error}</p>`:''}${loaded?.board?`<p class="cam-total"><strong>${rows.length}</strong> ${family} atribuídos · <strong>${groups.filter(front=>front.terno&&rows.some(row=>row.frontId===front.id)).length}</strong> ternos com ${family}</p><section class="cam-grid">${cards||`<p class="muted">Nenhum ${family} atribuído neste turno.</p>`}</section>`:loaded?'<section class="panel"><h2>Sem distribuição para este período</h2><p class="muted">A sala ainda não publicou um quadro para a data e o turno selecionados.</p></section>':''}`;
}

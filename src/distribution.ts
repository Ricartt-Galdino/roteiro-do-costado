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
export function distributionRows(board:Board,operators:Operator[]){
 const people=new Map([...operators,...board.extras??[],...board.horasExtras??[]].map(person=>[person.id,person]));
 return Object.entries(board.alocacoes??{}).filter(([id])=>/^CAM\d+$/i.test(id)).map(([id,personId])=>{
  const person=people.get(personId),frontId=board.locais?.[`op:${personId}`]??board.locais?.[id];
  return {id,personId,name:person?.nome??'Motorista não identificado',type:person?(person.ogmo?'OGMO':'Vinculado'):'Vínculo não informado',extra:!!person?.horaExtra,frontId:frontId??'',interval:board.intervalos?.[`op:${personId}`]??board.intervalos?.[id],unavailable:board.fora?.[id]?.motivo};
 }).sort((a,b)=>Number(a.id.slice(3))-Number(b.id.slice(3)));
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
export function renderDistribution(){
 const rows=loaded?.board?distributionRows(loaded.board,loaded.operators):[];
 const fronts=loaded?.board?.frentes??[];
 const unknown=[...new Set(rows.map(row=>row.frontId).filter(id=>!fronts.some(front=>front.id===id)))];
 const groups=[...fronts,...unknown.map(id=>({id,nome:id?'Frente não identificada':'Sem frente atribuída',terno:''}))];
 const cards=groups.map(front=>{
  const trucks=rows.filter(row=>row.frontId===front.id);
  if(!trucks.length&&(!front.terno||front.id==='patio'))return '';
  return `<article class="cam-front"><div class="cam-front-head"><div><span>${front.terno?`${escape(front.terno)}º TERNO`:'APOIO / PÁTIO'}</span><h2>${escape(front.nome)}</h2></div><strong>${trucks.length}<small> CAM</small></strong></div>${trucks.length?trucks.map(truck=>`<div class="cam-row"><b>CAM ${escape(truck.id.slice(3).padStart(2,'0'))}</b><div><strong>${escape(truck.name)}</strong><span>${escape(truck.type)}${truck.extra?' · Hora extra':''}</span>${truck.interval?`<small>Intervalo programado: ${escape(truck.interval)}</small>`:''}${truck.unavailable?`<small class="error">Indisponível: ${escape(truck.unavailable)}</small>`:''}</div></div>`).join(''):'<p class="muted">Nenhum CAM atribuído neste terno.</p>'}</article>`;
 }).join('');
 return `<section class="cam-heading"><div><div class="eyebrow">CONSULTA · ESCALA DA SALA</div><h1>Distribuição de Cam.</h1><p>Motoristas e caminhões por navio e terno, conforme a distribuição da sala.</p></div><button data-action="distribution-refresh" ${loading?'disabled':''}>${loading?'Consultando…':'Atualizar agora'}</button></section><div class="cam-filters"><label>Data operacional<input type="date" data-cam-field="date" value="${selected.date}"></label><label>Turno<select data-cam-field="shift">${shifts.map(shift=>`<option value="${shift}" ${shift===selected.shift?'selected':''}>${shift.replace('X','h–')}h</option>`).join('')}</select></label><button data-action="distribution-now" ${automatic?'disabled':''}>Acompanhar turno atual</button><a href="https://brunosth-rgb.github.io/escala-ops/" target="_blank" rel="noopener noreferrer">Consultar fonte ↗</a></div><p class="cam-reading" role="status">${automatic?'Turno atual · ':''}${loaded?`Consultado às ${clock(loaded.readAt)}${loaded.updated?` · Sala alterou às ${clock(loaded.updated)}`:''}`:loading?'Consultando dados da sala…':'Aguardando consulta'} · Atualização automática a cada 30 s</p>${error?`<p class="warning" role="alert">${error}</p>`:''}${loaded?.board?`<p class="cam-total"><strong>${rows.length}</strong> CAM atribuídos · <strong>${groups.filter(front=>front.terno&&rows.some(row=>row.frontId===front.id)).length}</strong> ternos com CAM</p><section class="cam-grid">${cards||'<p class="muted">Nenhum CAM atribuído neste turno.</p>'}</section>`:loaded?'<section class="panel"><h2>Sem distribuição para este período</h2><p class="muted">A sala ainda não publicou um quadro para a data e o turno selecionados.</p></section>':''}`;
}

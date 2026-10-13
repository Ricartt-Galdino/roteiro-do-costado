import {importReview,reviewSummary} from './import-review';
import {loadFleet,saveFleet,type Fleet} from './fleet';
import './style.css';
import { applyMoves, below, continuous, dateTime, delay, demo, finish, forecast, freshRun, fromLocal, initial, load, localInput, remember, save, start, step, time, undo, updateRemaining, validate, type Plan, type State } from './core';
import { EQUIPMENT, parseWorkList } from './import';
import { equipmentMoves, loadMovesFeed, type MovesReading } from './moves-feed';
import { registerReadTool } from './webmcp';

const root=document.querySelector<HTMLDivElement>('#app')!;
const CHANGE_SOON_MOVES=3;
let state:State;let recovery='';
try{state=load();}catch{state=initial();recovery='Não foi possível ler os dados salvos. O plano de demonstração está aberto; os dados anteriores não serão substituídos até você salvar uma alteração.';}
let fleet:Fleet=loadFleet(state);if(fleet[state.plan.equipment as keyof Fleet])state=fleet[state.plan.equipment as keyof Fleet]!;
let view:'board'|'edit'|'import'='board', draft:Plan=structuredClone(state.plan), horizon=0, message=recovery, ocrText='', warnings:string[]=[], candidates:Plan[]=[], pictures:{url:string;name:string;kind:string}[]=[], busy=false;
let reviewSelected=0, reviewDirty=false, mobileMenu=false;
let mobileEquipment:EquipmentId|undefined;
type EquipmentId=typeof EQUIPMENT[number];
type MoveCursors=Partial<Record<EquipmentId,MovesReading>>;
let moveCursors:MoveCursors={};
const syncingMoves=new Set<EquipmentId>();
try{moveCursors=JSON.parse(localStorage.getItem('costado.moves-cursors.v1')??'{}') as MoveCursors;}catch{moveCursors={};}
function saveMoveCursors(){try{localStorage.setItem('costado.moves-cursors.v1',JSON.stringify(moveCursors));}catch{ /* O roteiro continua utilizável sem o cursor salvo. */ }}
type Activity={at:number;text:string};
type ActivityLog=Partial<Record<EquipmentId,Activity[]>>;
let activityLog:ActivityLog={};
let manualUndo:{equipment:EquipmentId;run:State['run'];activityCount:number}|null=null;
let manualUndoTimer:number|undefined;
try{activityLog=JSON.parse(localStorage.getItem('costado.activity-log.v1')??'{}') as ActivityLog;}catch{activityLog={};}
function saveActivity(){try{localStorage.setItem('costado.activity-log.v1',JSON.stringify(activityLog));}catch{ /* O acompanhamento segue mesmo sem o histórico persistido. */ }}
function recordActivity(equipment:EquipmentId,text:string,at=Date.now()){const entries=activityLog[equipment]??[];entries.unshift({at,text});activityLog[equipment]=entries.slice(0,8);saveActivity();}
const esc=(v:unknown)=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const shortMov=(value:string)=>value.replace(/\b[Mm]ov(?:imentos?|es)\b/g,'mov');
const field=(label:string,name:string,value:unknown,type='text',extra='')=>`<label>${label}<input name="${name}" type="${type}" value="${esc(value)}" ${extra}></label>`;
const opt=(value:string,label:string,selected:string)=>`<option value="${value}" ${selected===value?'selected':''}>${label}</option>`;
function persist(note='Alteração salva neste aparelho.'){try{if(EQUIPMENT.includes(state.plan.equipment as typeof EQUIPMENT[number]))fleet[state.plan.equipment as typeof EQUIPMENT[number]]=structuredClone(state);save(state);saveFleet(fleet);message=note;}catch{message='Não foi possível salvar: armazenamento indisponível ou cheio. Mantenha esta página aberta e exporte uma cópia.';}render();}
async function syncMoves(equipment:EquipmentId,baselineOnly=false,silent=false){
 const entry=fleet[equipment];if(!entry||entry.run.started===null||!entry.plan.vessel.trim())return;
 if(syncingMoves.has(equipment)){if(!silent){message=`${equipment}: atualização de Moves já está em andamento.`;render();}return;}
 syncingMoves.add(equipment);
 if(!silent){message=`${equipment}: consultando Moves na fonte…`;render();}
 try{
  const reading=equipmentMoves(await loadMovesFeed(),entry.plan.vessel,equipment);

  if(!reading){if(!silent){message=`${equipment}: o navio “${entry.plan.vessel}” não foi encontrado em operação na fonte de Moves. Confira o nome do navio no plano.`;render();}return;}
  const previous=moveCursors[equipment];
  if(baselineOnly||!previous||previous.visit!==reading.visit||reading.total<previous.total){
   moveCursors[equipment]=reading;saveMoveCursors();
   if(!silent){message=`${equipment}: base de ${reading.total} mov registrada. Os próximos Moves serão abatidos do roteiro.`;render();}
   return;
  }
  const delta=reading.total-previous.total;moveCursors[equipment]=reading;saveMoveCursors();
  if(delta===0){state=entry;const at=reading.reportedAt;if(state.run.remaining!==null&&at>(state.run.anchor??0)){state.run.anchor=at;state.run.delay=0;state.run.updated=at;fleet[equipment]=state;save(state);saveFleet(fleet);}if(!silent)message=`${equipment}: nenhum mov novo desde a última consulta.`;render();return;}
  state=entry;const at=reading.reportedAt,before=state.run.current,beforeBay=state.plan.steps[before]?.bay;const applied=applyMoves(state,delta,at);fleet[equipment]=state;save(state);saveFleet(fleet);recordActivity(equipment,`${applied} mov abatidos${state.run.current!==before?` · Bay ${beforeBay} concluída; agora ${state.plan.steps[state.run.current]?.bay??'roteiro concluído'}`:''}.`,at);
  if(!silent)message=applied===delta?`${equipment}: ${delta} mov abatidos do roteiro.`:`${equipment}: ${applied} mov aplicados; confira a próxima bay.`;render();
 }catch{if(!silent){message=`Não foi possível consultar os Moves de ${equipment}. O roteiro não foi alterado; tente novamente em alguns minutos.`;render();}}finally{syncingMoves.delete(equipment);}
}
const status=(index:number)=>state.run.completed[state.plan.steps[index].id]?'✓ Concluído':index===state.run.current&&state.run.started!==null?'▶ Em andamento':index<state.run.current?'— Anterior ao acompanhamento':'○ Planejado';
function hatchLabel(p:Plan,i:number){const s=p.steps[i];return below(s)?continuous(p.steps[i-1],s)?'↳ Continuidade do acesso':s.hatch==='open'?'✓ Tampa já aberta':s.hatch==='required'?'◇ Abertura necessária':'? Possível abertura — confirmar estado da tampa':s.closure?'◇ Fechamento previsto':p.steps[i-1]&&below(p.steps[i-1])?'? Verificar necessidade de fechamento':'Convés';}
function header(){const latest=Math.max(0,...EQUIPMENT.map(equipment=>moveCursors[equipment]?.reportedAt??0));return `<header><button class="mobile-menu" data-action="mobile-menu" aria-label="Abrir menu">☰</button><a class="brand" href="#" data-action="board"><img src="/icon.svg" alt="" width="42" height="42"><span>ROTEIRO <strong>DO COSTADO</strong></span></a><span class="mobile-header-update">${latest?time(latest,state.plan.zone):'—'}<button data-action="sync-all" aria-label="Atualizar Moves">↻</button></span><nav class="${mobileMenu?'open':''}" aria-label="Principal"><button class="${view==='board'?'selected':''}" data-action="board">Painel operacional</button><button class="${view==='edit'?'selected':''}" data-action="edit">Conferir plano</button><button class="import-nav ${view==='import'?'selected':''}" data-action="import">Importar</button></nav></header>`;}
function render(){root.innerHTML=header()+`<main>${message?`<div class="notice" role="status"><span>${esc(message)}</span>${manualUndo?'<button class="notice-undo" data-action="undo-manual">Desfazer</button>':''}<button data-action="dismiss" aria-label="Fechar aviso">×</button></div>`:''}${view==='board'?board():view==='edit'?editor():importer()}</main>${view==='board'?'':`<footer>Previsão de apoio ao costado. Confirmar alterações com a Sala de Planejamento.<span>Dados neste aparelho · ${esc(state.plan.zone)}</span></footer>`}`;}
function boardCard(equipment:EquipmentId,entry:State){
 const {plan:p,run:r}=entry,current=p.steps[r.current],next=p.steps[r.current+1],rows=forecast(p,r),nextRow=rows[1],cursor=moveCursors[equipment],active=r.started!==null,remaining=active?r.remaining:null,swapSoon=active&&remaining!==null&&remaining<=CHANGE_SOON_MOVES;
 const operationName=(step:typeof current)=>step?.operation==='descarga'?'Descarga':'Embarque';
 const operationPill=(step:typeof current)=>`<span class="operation-pill ${step?.operation==='descarga'?'unload':'load'}">${step?.operation==='descarga'?'↓ Descarga':'↑ Embarque'}</span>`;
 const activity=activityLog[equipment]??[],last=activity[0];
 const nowControls=active&&remaining!==0?`<div class="now-adjust"><button data-action="fleet-adjust" data-equipment="${equipment}" data-delta="-1">− 1</button><button class="plus-adjust" data-action="fleet-adjust" data-equipment="${equipment}" data-delta="1">+ 1</button></div>`:active?'<span class="ready-to-finish">Pronta para finalizar</span>':'';
 const nextStart=next&&nextRow?.start?time(nextRow.start,p.zone):'A definir';
 const totalCurrentMoves=current?.moves??0;
 const showBayProgress=active&&!!next&&!!nextRow?.start&&totalCurrentMoves>0&&remaining!==null;
 const nextProgress=showBayProgress?Math.max(0,Math.min(100,Math.round(((totalCurrentMoves-remaining)/totalCurrentMoves)*100))):0;
 const bayProgress=showBayProgress?`<div class="bay-progress" aria-label="${nextProgress}% da bay concluída"><span>${nextProgress}% da bay concluída</span><i style="--progress:${nextProgress}%" aria-hidden="true"></i></div>`:'';
 const handoff=swapSoon?next?`<div class="swap-strip"><span>Preparar troca para <small>${operationName(next)} · ${next.moves??0} mov.</small></span><strong>Bay ${esc(next.bay)}</strong></div>`:'<div class="swap-strip last-bay"><span>Última bay do equipamento</span></div>':`<div class="next-strip"><span>Próxima etapa · início previsto</span><strong>${nextStart}</strong></div>`;
 const nowText=`<section class="current-stage"><div class="current-stage-line"><span class="stage-label">AGORA</span><strong>Bay ${esc(current?.bay??'—')} ${operationPill(current)}</strong><span class="current-moves"><b>${active?remaining:(current?.moves??0)}</b> mov restantes</span></div>${bayProgress}${nowControls}${handoff}</section>`;
 const nextText=next?p.steps.slice(r.current+1).map((step,index)=>{const row=rows[index+1];return `<div class="stage-row ${index===0?'next-primary':''} ${index>0?'future-row':''} ${swapSoon&&index===0?'swap-next':''}"><span class="stage-label">${index===0?'PRÓXIMO':`DEPOIS ${index+1}`}</span><strong>Bay ${esc(step.bay)} ${operationPill(step)}</strong><span>${step.moves??0} mov.</span><time>Fim aprox. ${row?.end?time(row.end,p.zone):'A definir'}</time></div>`;}).join(''):`<div class="stage-row empty-next"><span class="stage-label">PRÓXIMO</span><strong>Sem próximo trabalho</strong></div>`;
 const history=activity.length>1?`<details class="card-history"><summary>Ver histórico completo</summary>${activity.map(item=>`<p><time>${time(item.at,p.zone)}</time>${esc(shortMov(item.text))}</p>`).join('')}</details>`:'';
 return `<article class="equipment-card ${active?'running':''} ${swapSoon?'change-soon':''} ${mobileEquipment===equipment?'mobile-selected':''}"><div class="equipment-card-head"><strong>${equipment}</strong><span class="tag">${swapSoon?'Troca em breve':active?'Em operação':'Aguardando início'}</span></div>${nowText}<div class="stage-list">${nextText}</div><div class="card-meta"><span><strong>${cursor?.total??0}</strong> mov acumulados · ${p.rate} mov/h</span>${last?`<p><time>${time(last.at,p.zone)}</time> · ${esc(shortMov(last.text))}</p>`:'<p>Sem alterações registradas</p>'}</div>${history}<footer><div class="card-actions">${active?`<button class="finish-bay" data-action="fleet-finish" data-equipment="${equipment}">Finalizar bay</button>`:`<button class="finish-bay" data-action="fleet-start" data-equipment="${equipment}">Iniciar acompanhamento</button>`}<button class="primary" data-action="fleet-detail" data-equipment="${equipment}" title="Conferir e ajustar o plano">Abrir plano</button></div></footer></article>`;
}function board(){
 const visible=EQUIPMENT.filter(id=>{const entry=fleet[id];return !!entry&&entry.run.current<entry.plan.steps.length&&entry.plan.steps.some(step=>(step.moves??0)>0);});
 const operating=visible.filter(id=>fleet[id]?.run.started!==null),first=visible[0];
 if(!mobileEquipment||!visible.includes(mobileEquipment))mobileEquipment=first;
 const vessel=visible.map(id=>fleet[id]?.plan.vessel.trim()).find(Boolean)||'Navio não informado';
 const accumulated=visible.reduce((sum,id)=>sum+(moveCursors[id]?.total??0),0),rate=operating.reduce((sum,id)=>sum+(fleet[id]?.plan.rate??0),0),lastRead=Math.max(0,...visible.map(id=>moveCursors[id]?.reportedAt??0)),stale=!lastRead||Date.now()-lastRead>3*60*1000;
 const updateText=lastRead?(stale?`Sem atualização desde ${time(lastRead,fleet[visible[0]]?.plan.zone??'America/Sao_Paulo')}`:`Atualizado às ${time(lastRead,fleet[visible[0]]?.plan.zone??'America/Sao_Paulo')} · leitura automática`):'Aguardando primeira leitura';
 return `<section class="operations-summary"><div class="vessel-summary"><span>Navio</span><strong>${esc(vessel)}</strong></div><div class="summary-kpis"><span><strong>${operating.length}</strong> em operação</span><span><strong>${accumulated}</strong> mov acumulados</span><span><strong>${rate}</strong> mov/h total</span></div><div class="summary-update ${stale?'stale':''}"><span><i></i>${updateText}</span><button data-action="sync-all">Atualizar agora</button></div></section>${visible.length?`<div class="mobile-fleet-selector" aria-label="Selecionar equipamento">${visible.map(id=>`<button data-action="mobile-equipment" data-equipment="${id}" aria-pressed="${mobileEquipment===id}">${id}</button>`).join('')}</div><section class="fleet-grid">${visible.map(id=>boardCard(id,fleet[id]!)).join('')}</section>`:`<section class="panel fleet-empty"><h2>Nenhum equipamento em operação</h2><p>Importe um Crane Work List para incluir equipamentos no painel.</p><button class="primary" data-action="import">Importar plano</button></section>`}`;
}function warningLink(warning:string){
 const match=warning.match(/^([SM]\d{3})(?:\s*·\s*(\d{2}[AB?]))?:/i),equipment=match?.[1]?.toUpperCase(),bay=match?.[2]?.toUpperCase();
 let index=equipment?candidates.findIndex(p=>p.equipment===equipment):-1,focus=/confira a etiqueta/i.test(warning)?'review-equipment-confirm':/produtividade/i.test(warning)?'review-rate-confirm':'review-total';
 if(index>=0&&bay){const row=candidates[index].steps.findIndex(s=>s.bay===bay);if(row>=0)focus=`review-${row}-moves`;}
 if(/^Navio\/viagem/i.test(warning)){index=candidates.findIndex(p=>p.steps.length>0);focus='review-meta-vessel';}
 if(index<0)return `<p>${esc(warning)}</p>`;
 return `<button class="warning-link" data-action="warning-jump" data-index="${index}" data-focus="${focus}">${esc(warning)}<span>→ Ajustar</span></button>`;
}
function resolveWarnings(plan:Plan,row?:Plan['steps'][number],meta?:string){
 const before=warnings.length,total=plan.steps.reduce((sum,step)=>sum+(step.moves??0),0);
 warnings=warnings.filter(warning=>{
  if(row&&warning.startsWith(`${plan.equipment} · ${row.bay}: leituras divergentes`))return false;
  if(meta==='equipment'&&warning.startsWith(`${plan.equipment}: confira a etiqueta`))return false;
  if(meta==='rate'&&warning.startsWith(`${plan.equipment}: OCR leu`)&&/produtividade/i.test(warning))return false;
  if((meta==='vessel'||meta==='voyage')&&plan.vessel.trim()&&/^Navio\/viagem não identificado/i.test(warning))return false;
  const header=warning.match(new RegExp(`^${plan.equipment}: cabeçalho informa (\\d+) movimentos`));
  return !header||Number(header[1])!==total;
 });
 return warnings.length!==before;
}
function focusReview(id:string){requestAnimationFrame(()=>{const target=document.getElementById(id);if(!target)return;target.scrollIntoView({block:'center',behavior:'smooth'});(target.matches('input,select,button')?target:target.querySelector<HTMLElement>('input,select,button'))?.focus();});}
function editor(){return `<div class="section-title"><div><div class="eyebrow">CONFERÊNCIA DO PLANEJAMENTO</div><h1>Confira antes de começar</h1><p>Preserve a sequência do Crane Work List. A/B não identifica uma tampa física.</p></div><button data-action="board">Voltar</button></div><form id="plan-form"><section class="panel"><div class="formgrid">${field('Navio','vessel',draft.vessel)}${field('Viagem','voyage',draft.voyage)}<label>Equipamento<select name="equipment" required><option value="">Selecione</option>${EQUIPMENT.map(id=>opt(id,id,draft.equipment)).join('')}</select></label>${field('Produtividade · mov/h','rate',draft.rate,'number','min="0.1" step="0.1" required')}${field('Fuso horário','zone',draft.zone,'text','list="zones"')}<datalist id="zones"><option>America/Sao_Paulo</option><option>America/Manaus</option><option>America/Belem</option><option>UTC</option></datalist></div><p class="muted">${esc(draft.source)}</p></section>
${pictures.length?`<details class="references"><summary>Ver Crane Work List de referência</summary><div class="image-grid">${pictures.map(p=>`<figure><figcaption>${esc(p.kind)}</figcaption><a href="${p.url}" target="_blank" rel="noopener"><img src="${p.url}" alt="Referência ${esc(p.kind)}"></a></figure>`).join('')}</div><p>Compare as bays com o bloco do equipamento escolhido.</p></details>`:''}<div class="edit-help">Acesso: use o mesmo nome nas bays que compartilham acesso ao porão. Reefers e vazios já fazem parte dos movimentos.</div>
${draft.steps.map((s,i)=>`<article class="panel edit-step"><div class="section-title"><h2><span class="muted">${String(i+1).padStart(2,'0')}</span> · Bay ${esc(s.bay)}</h2><div class="buttonrow"><button type="button" data-action="up" data-index="${i}" ${i===0?'disabled':''} aria-label="Mover etapa ${i+1} para cima">↑</button><button type="button" data-action="down" data-index="${i}" ${i===draft.steps.length-1?'disabled':''} aria-label="Mover etapa ${i+1} para baixo">↓</button><button type="button" data-action="remove" data-index="${i}">Remover</button></div></div>${s.doubt?`<p class="warning">? ${esc(s.doubt)}</p>`:''}<div class="formgrid">${field('Bay · A convés / B porão',`bay-${i}`,s.bay,'text','required pattern="[0-9]{2}[ABab]"')}<label>Operação<select name="operation-${i}">${opt('descarga','↓ Descarga',s.operation)}${opt('embarque','↑ Embarque',s.operation)}</select></label>${field('Movimentos',`moves-${i}`,s.moves,'number','min="0" step="1" required')}${field('Reefers',`reefers-${i}`,s.reefers,'number','min="0" step="1"')}${field('Vazios',`empty-${i}`,s.empty,'number','min="0" step="1"')}${field('Nome do acesso',`access-${i}`,s.access,'text','required')}<label>Estado da tampa<select name="hatch-${i}">${opt('unknown','A confirmar',s.hatch)}${opt('required','Abertura necessária',s.hatch)}${opt('open','Já está aberta',s.hatch)}</select></label>${field('Início planejado · opcional',`planned-${i}`,s.planned,'datetime-local')}<label class="check"><input type="checkbox" name="closure-${i}" ${s.closure?'checked':''}> Fechamento necessário antes desta etapa (confirmado)</label>${field('Observações',`notes-${i}`,s.notes)}</div></article>`).join('')}
<button type="button" data-action="add">＋ Adicionar etapa</button><div class="savebar"><p>Aplicar o plano reinicia o acompanhamento. Confira quantidades, ordem e dúvidas antes de salvar.</p><button type="submit" class="primary">Conferido · usar este plano</button></div></form>`;}
function importer(){return `<div class="section-title"><div><div class="eyebrow">IMPORTAÇÃO POR EQUIPAMENTO</div><h1>Confira a foto e ajuste o roteiro</h1><p>Edite bays e quantidades diretamente na tabela do equipamento.</p></div></div><section class="panel"><h2>1. Crane Work List</h2><label class="upload">＋ Selecionar imagem<input type="file" accept="image/*" id="work-file" ${busy?'disabled':''}></label><details class="ocr-advanced" ${!candidates.length?'open':''}><summary>Colar ou editar texto do OCR · avançado</summary><label>Texto reconhecido<textarea id="ocr-text" rows="8">${esc(ocrText)}</textarea></label><p class="muted">Reprocessar o texto refaz a tabela. Para pequenos ajustes, use as células abaixo.</p><button data-action="parse" ${busy?'disabled':''}>Reprocessar texto</button></details></section><p class="muted">Leitura no aparelho, sem envio da foto.</p>${busy?'<p role="status">Lendo imagem…</p>':''}${warnings.length?`<details class="review-alerts"><summary>${warnings.length} observações da leitura original · ver detalhes</summary><p>Clique em uma observação para ir direto ao campo de ajuste.</p>${warnings.map(w=>warningLink(w)).join('')}</details>`:''}${importReview(candidates,Math.min(reviewSelected,Math.max(0,candidates.length-1)),pictures)}<div class="bottom-actions"><button data-action="manual">Cadastrar manualmente</button><button data-action="demo">Conferir demonstração</button><label class="upload">Restaurar cópia JSON<input id="backup-file" type="file" accept="application/json"></label></div>`;}
root.addEventListener('input',e=>{
 const input=e.target as HTMLInputElement;if(input.id==='ocr-text'){ocrText=input.value;return;}const pi=Number(input.dataset.plan),p=candidates[pi];
 if(!p||input.dataset.plan===undefined)return;
 const key=input.dataset.reviewKey,meta=input.dataset.reviewMeta;
 if(meta==='vessel'||meta==='voyage')p[meta]=input.value;
 else if(meta==='rate')p.rate=Number(input.value);
 else if(meta==='equipment'){
  if(candidates.some((q,i)=>i!==pi&&q.equipment===input.value&&input.value!=='')){input.value=p.equipment;message='Esse equipamento já tem outro bloco. Confira os blocos antes de juntá-los.';render();return;}
  p.equipment=input.value;
 }
 else if(key){
  const s=p.steps[Number(input.dataset.reviewStep)];if(!s)return;
  if(key==='bay'){const old=s.bay;s.bay=input.value.toUpperCase();if(s.access===old.replace(/[AB]$/,''))s.access=s.bay.slice(0,2);input.classList.toggle('needs-value',!/^\d{2}[AB]$/.test(s.bay));}
  else if(key==='operation')s.operation=input.value as 'descarga'|'embarque';
  else if(key==='moves'||key==='reefers'||key==='empty'){s[key]=input.value===''?null:Number(input.value);input.classList.toggle('needs-value',key==='moves'&&(s[key]===null||!Number.isInteger(s[key])||s[key]!<0));}
  s.doubt='Alterado nesta conferência. Compare a linha com a foto.';
  const button=input.closest('tr')?.querySelector('button');if(button)button.textContent='Conferir';
 }
 reviewDirty=true;
 const total=document.querySelector('#review-total');if(total)total.textContent=reviewSummary(p);
 if(meta==='equipment')render();
});
function readDraft(){const form=document.querySelector<HTMLFormElement>('#plan-form');if(!form)return;const data=new FormData(form),val=(n:string)=>String(data.get(n)??''),num=(n:string)=>val(n)===''?null:Number(val(n));draft={...draft,vessel:val('vessel'),voyage:val('voyage'),equipment:val('equipment'),rate:Number(val('rate')),zone:val('zone'),steps:draft.steps.map((s,i)=>({...s,bay:val(`bay-${i}`).toUpperCase(),operation:val(`operation-${i}`) as 'descarga'|'embarque',moves:num(`moves-${i}`),reefers:num(`reefers-${i}`),empty:num(`empty-${i}`),access:val(`access-${i}`),hatch:val(`hatch-${i}`) as 'unknown'|'required'|'open',planned:val(`planned-${i}`),notes:val(`notes-${i}`),closure:data.has(`closure-${i}`)}))};}
function modal(title:string,body:string,submit:(data:FormData)=>void){const d=document.createElement('dialog');d.innerHTML=`<form method="dialog"><div class="section-title"><h2>${title}</h2><button type="button" class="close" aria-label="Fechar">×</button></div>${body}<p class="error" role="alert"></p><div class="buttonrow"><button type="button" class="cancel">Cancelar</button><button class="primary">Confirmar</button></div></form>`;document.body.append(d);d.querySelector('.close')!.addEventListener('click',()=>d.close());d.querySelector('.cancel')!.addEventListener('click',()=>d.close());d.addEventListener('close',()=>d.remove());d.querySelector('form')!.addEventListener('submit',e=>{e.preventDefault();try{submit(new FormData(d.querySelector('form')!));d.close();}catch(error){d.querySelector('.error')!.textContent=error instanceof Error?error.message:String(error);}});d.showModal();}
function choose(i:number){modal('Selecionar etapa atual',`<p>Começar na bay ${esc(state.plan.steps[i].bay)}? Etapas anteriores sem registro não serão marcadas como concluídas.</p>${field('Data e hora de início','at',localInput(Date.now(),state.plan.zone),'datetime-local','required')}`,data=>{start(state,i,fromLocal(String(data.get('at')),state.plan.zone));persist();});}
root.addEventListener('click',e=>{const b=(e.target as HTMLElement).closest<HTMLElement>('[data-action]');if(!b)return;e.preventDefault();const action=b.dataset.action,i=Number(b.dataset.index);if(view==='edit')readDraft();
switch(action){
case 'dismiss':message='';manualUndo=null;render();break;
case 'board':view='board';mobileMenu=false;render();break;
case 'edit':draft=structuredClone(state.plan);view='edit';render();break;
case 'import':view='import';render();break;
case 'mobile-menu':mobileMenu=!mobileMenu;render();break;
case 'mobile-equipment':mobileEquipment=b.dataset.equipment as EquipmentId;render();break;
case 'fleet-detail':{const equipment=b.dataset.equipment as typeof EQUIPMENT[number],entry=fleet[equipment];if(!entry)break;state=entry;draft=structuredClone(state.plan);view='edit';render();break;}
case 'fleet-import':view='import';message='Importe o Crane Work List e selecione o bloco de '+b.dataset.equipment+'.';render();break;
case 'fleet-start':{const equipment=b.dataset.equipment as EquipmentId,entry=fleet[equipment];if(!entry||entry.run.started!==null||!entry.plan.steps[entry.run.current])break;manualUndo=null;state=entry;const bay=state.plan.steps[state.run.current].bay;start(state,state.run.current,Date.now());recordActivity(equipment,`Bay ${bay} iniciada.`);persist(`Bay ${bay} iniciada.`);void syncMoves(equipment,true);break;}
case 'fleet-sync':void syncMoves(b.dataset.equipment as EquipmentId);break;
case 'sync-all':void syncAllMoves();break;
case 'fleet-adjust':{const equipment=b.dataset.equipment as EquipmentId,entry=fleet[equipment],delta=Number(b.dataset.delta),remaining=entry?.run.remaining;if(!entry||entry.run.started===null||!Number.isInteger(delta)||typeof remaining!=='number')break;manualUndo={equipment,run:structuredClone(entry.run),activityCount:(activityLog[equipment]??[]).length};state=entry;updateRemaining(state,Math.max(0,remaining+delta),Date.now());recordActivity(equipment,`Ajuste manual ${delta>0?'+':'−'}1 movimento.`);persist(`Quantidade ajustada. ${delta>0?'Um movimento acrescentado.':'Um movimento abatido.'}`);break;}
case 'fleet-finish':{const equipment=b.dataset.equipment as EquipmentId,entry=fleet[equipment];if(!entry||entry.run.started===null)break;state=entry;const bay=state.plan.steps[state.run.current].bay;modal(`Finalizar Bay ${bay}?`,'<p>Esta ação encerra a bay atual e prepara a próxima etapa.</p>',()=>{manualUndo={equipment,run:structuredClone(entry.run),activityCount:(activityLog[equipment]??[]).length};finish(state,Date.now());recordActivity(equipment,`Bay ${bay} finalizada manualmente.`);persist(`Bay ${bay} finalizada.`);if(manualUndoTimer)window.clearTimeout(manualUndoTimer);manualUndoTimer=window.setTimeout(()=>{manualUndo=null;render();},8000);});break;}
case 'undo-manual':{if(!manualUndo)break;const savedUndo=manualUndo,entry=fleet[savedUndo.equipment],entries=activityLog[savedUndo.equipment]??[];if(!entry)break;entry.run=structuredClone(savedUndo.run);activityLog[savedUndo.equipment]=entries.slice(Math.max(0,entries.length-savedUndo.activityCount));saveActivity();state=entry;manualUndo=null;persist('Ação manual desfeita.');break;}
case 'horizon':horizon=Number(b.dataset.value);render();break;
case 'start':choose(state.run.current);break;
case 'choose':choose(i);break;
case 'select':modal('Selecionar etapa atual',`<label>Etapa<select name="index">${state.plan.steps.map((s,i)=>opt(String(i),`${i+1} · ${s.bay} · ${s.operation}`,String(state.run.current))).join('')}</select></label>${field('Data e hora de início','at',localInput(Date.now(),state.plan.zone),'datetime-local','required')}<p>Etapas anteriores não serão concluídas automaticamente.</p>`,d=>{start(state,Number(d.get('index')),fromLocal(String(d.get('at')),state.plan.zone));persist();});break;
case 'finish':finish(state,Date.now());persist();break;
case 'remaining':modal('Atualizar movimentos restantes',`${field('Movimentos restantes','remaining',state.run.remaining,'number',`min="0" max="${state.plan.steps[state.run.current].moves}" step="1" required`)}<p>O cálculo recomeça no horário desta atualização.</p>`,d=>{updateRemaining(state,Number(d.get('remaining')),Date.now());persist();});break;
case 'delay':modal('Ajustar atraso',field('Minutos adicionais','minutes',10,'number','min="0" required'),d=>{delay(state,Number(d.get('minutes')),Date.now());persist();});break;
case 'start-time':modal('Corrigir início da etapa',`${field('Data e hora de início','at',localInput(state.run.started!,state.plan.zone),'datetime-local','required')}<p>Se houve atualização de restantes, ela continua sendo a referência da previsão.</p>`,d=>{remember(state);const at=fromLocal(String(d.get('at')),state.plan.zone);if(state.run.anchor===state.run.started)state.run.anchor=at;else if(at>state.run.anchor!)throw Error('O início não pode ser posterior à atualização de restantes.');state.run.started=at;state.run.updated=Date.now();persist();});break;
case 'undo':undo(state);persist();break;
case 'hatch':modal(`Acesso ${esc(state.plan.steps[i].access)}`,`<label>Estado da tampa<select name="hatch">${opt('unknown','A confirmar',state.plan.steps[i].hatch)}${opt('required','Abertura necessária',state.plan.steps[i].hatch)}${opt('open','Já está aberta',state.plan.steps[i].hatch)}</select></label><p>Válido para este acesso no roteiro. A continuidade na etapa seguinte não cria outra abertura.</p>`,d=>{state.plan.steps[i].hatch=String(d.get('hatch')) as 'unknown'|'open'|'required';persist();});break;
case 'settings':modal('Ajustar previsão',`${field('Produtividade · movimentos/hora','rate',state.plan.rate,'number','min="0.1" step="0.1" required')}${field('Deslocamento entre bays · min','travel',state.plan.travel,'number','min="0"')}${field('Abertura · min','opening',state.plan.opening,'number','min="0"')}${field('Fechamento confirmado · min','closing',state.plan.closing,'number','min="0"')}<p>Deixe vazio quando desconhecido. Zero significa tempo desprezível confirmado. A previsão da próxima tampa indica o início da abertura.</p>`,d=>{state.plan.rate=Number(d.get('rate'));for(const k of ['travel','opening','closing'] as const)state.plan[k]=d.get(k)===''?null:Number(d.get(k));persist();});break;
case 'add':draft.steps.push(step());render();break;
case 'remove':draft.steps.splice(i,1);render();break;
case 'up':case 'down':{const j=i+(action==='up'?-1:1);[draft.steps[i],draft.steps[j]]=[draft.steps[j],draft.steps[i]];render();break;}
case 'manual':draft={...demo(),vessel:'',voyage:'',equipment:'',steps:[step()],source:'Cadastro manual'};view='edit';render();break;
case 'demo':draft=demo();view='edit';render();break;
case 'review-tab':reviewSelected=i;render();break;
case 'review-equipment':{const p=candidates[i];if(!p?.equipment)break;resolveWarnings(p,undefined,'equipment');reviewDirty=true;render();break;}
case 'warning-jump':{const index=Number(b.dataset.index),focus=b.dataset.focus??'review-total';if(!candidates[index])break;reviewSelected=index;render();focusReview(focus);break;}
case 'review-rate':{const p=candidates[i];if(!p||!Number.isFinite(p.rate)||p.rate<=0)break;resolveWarnings(p,undefined,'rate');reviewDirty=true;render();break;}
case 'review-check':{const p=candidates[reviewSelected],s=p?.steps[i];if(!s)break;if(!/^\d{2}[AB]$/.test(s.bay)||s.moves===null||!Number.isInteger(s.moves)||s.moves<0){message='Preencha a bay (ex.: 22B) e os movimentos desta etapa.';render();break;}s.doubt='';resolveWarnings(p,s);reviewDirty=true;render();break;}
case 'parse':{const value=(document.querySelector('#ocr-text') as HTMLTextAreaElement).value;const apply=()=>{ocrText=value;const result=parseWorkList(ocrText);warnings=result.warnings;candidates=result.plans;reviewSelected=0;reviewDirty=false;render();};if(reviewDirty)modal('Refazer a tabela?', '<p>Os ajustes feitos nas células serão substituídos pela leitura deste texto.</p>',apply);else apply();break;}
case 'apply-import':{
 const imported=candidates.filter((plan):plan is Plan&{equipment:EquipmentId}=>EQUIPMENT.includes(plan.equipment as EquipmentId)&&plan.steps.length>0);
 const invalid=candidates.filter(plan=>!EQUIPMENT.includes(plan.equipment as EquipmentId)||!plan.steps.length);
 const errors=imported.flatMap(plan=>validate(plan).map(error=>`${plan.equipment}: ${error}`));
 if(invalid.length)errors.push('Identifique o equipamento e inclua pelo menos uma etapa em todos os blocos antes de aplicar.');
 if(!imported.length)errors.push('Nenhum equipamento identificado para aplicar.');
 if(errors.length){message=errors[0];render();break;}
 const labels=imported.map(plan=>plan.equipment).join(', ');
 modal('Aplicar planos importados',`<p>Aplicar o roteiro de ${imported.length} equipamento${imported.length===1?'':'s'}: ${esc(labels)}?</p><p>O acompanhamento desses equipamentos será reiniciado.</p>`,()=>{
  for(const plan of imported){const equipment=plan.equipment as EquipmentId;fleet[equipment]={version:1,plan:structuredClone(plan),run:freshRun(),history:[]};delete moveCursors[equipment];}
  saveMoveCursors();state=fleet[imported[0].equipment as EquipmentId]!;draft=structuredClone(state.plan);view='board';persist(`${imported.length} planos aplicados: ${labels}.`);
 });break;
}
case 'export':{const blob=new Blob([JSON.stringify({fleet,state},null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='roteiro-costado.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);break;}
}});
root.addEventListener('submit',e=>{if((e.target as HTMLElement).id!=='plan-form')return;e.preventDefault();readDraft();const errors=validate(draft);if(errors.length){message=errors.join(' ');render();return;}modal('Usar plano conferido',`<p>${draft.steps.length} etapas · ${draft.steps.reduce((n,s)=>n+(s.moves??0),0)} movimentos. O acompanhamento atual será reiniciado.</p>`,()=>{draft.steps.forEach(s=>s.doubt='');state={version:1,plan:structuredClone(draft),run:freshRun(),history:[]};view='board';persist();});});
root.addEventListener('change',async e=>{const input=e.target as HTMLInputElement;if(input.id.startsWith('assign-')){const index=Number(input.id.slice(7));if(candidates.some((p,i)=>i!==index&&p.equipment===input.value)){message='Esse equipamento já tem outro bloco. Confira os cabeçalhos no texto antes de juntá-los.';render();return;}candidates[index].equipment=input.value;resolveWarnings(candidates[index],undefined,'equipment');message='Bloco associado a '+input.value+'. Confira as bays antes de salvar.';render();return;}if(input.dataset.plan!==undefined&&(input.dataset.reviewKey||input.dataset.reviewMeta)){const plan=candidates[Number(input.dataset.plan)];if(plan){const row=input.dataset.reviewStep===undefined?undefined:plan.steps[Number(input.dataset.reviewStep)];if(resolveWarnings(plan,row,input.dataset.reviewMeta))render();}return;}if(!input.files?.[0])return;const file=input.files[0];if(input.id==='backup-file'){try{const text=await file.text(),backup=JSON.parse(text) as {fleet?:Fleet;state?:State},restored=load({getItem:()=>JSON.stringify(backup.state??backup)});modal('Restaurar cópia',`<p>Restaurar o painel e o plano de ${esc(restored.plan.equipment)}?</p>`,()=>{state=restored;fleet=backup.fleet??{[state.plan.equipment]:state};view='board';persist();});}catch{message='Cópia inválida. Nenhum dado foi substituído.';render();}return;}
if(input.id!=='work-file')return;const kind='Crane Work List';if(file.size>20*1024*1024){message='Escolha uma imagem de até 20 MB.';render();return;}
ocrText=(document.querySelector('#ocr-text') as HTMLTextAreaElement).value;pictures.forEach(p=>URL.revokeObjectURL(p.url));pictures=[{url:URL.createObjectURL(file),name:file.name,kind}];candidates=[];warnings=[];reviewSelected=0;reviewDirty=false;busy=true;message='Preparando leitura da imagem…';render();
try{const {readImage}=await import('./ocr');const result=await readImage(file,progress=>{message=progress;render();});ocrText=result.text;const extracted=parseWorkList(ocrText);candidates=extracted.plans;warnings=extracted.warnings;message='Leitura concluída com comparação de duas versões da imagem. Confira as etiquetas e os campos sinalizados antes de usar.';}catch{message='Não foi possível executar o OCR. Tente uma imagem menor e nítida, cole a transcrição ou cadastre manualmente.';}finally{busy=false;render();}});
render();
registerReadTool(()=>({plan:state.plan,run:state.run,forecast:forecast(state.plan,state.run)}));
setInterval(()=>{if(view==='board'&&!document.querySelector('dialog'))render();},30000);
async function syncAllMoves(){const operating=EQUIPMENT.filter(equipment=>fleet[equipment]?.run.started!==null);if(!operating.length){message='Não há equipamentos em operação para atualizar.';render();return;}message='Consultando Moves de todos os equipamentos…';render();await Promise.all(operating.map(equipment=>syncMoves(equipment,false,true)));message=`Moves consultados às ${time(Date.now(),fleet[operating[0]]!.plan.zone)}.`;render();}
let movesPollTimer:number|undefined;
function scheduleMovesPoll(){
 if(movesPollTimer)window.clearTimeout(movesPollTimer);
 const latest=Math.max(0,...EQUIPMENT.map(equipment=>moveCursors[equipment]?.reportedAt??0));
 const now=Date.now(),expected=latest+5*60*1000;
 // A fonte publica em ciclos de cinco minutos. Consultas perto do próximo
 // ciclo encontram o commit novo mais cedo sem ultrapassar a cota pública.
 const delay=!latest?60*1000:now<expected-20*1000?expected-20*1000-now:now<expected+60*1000?20*1000:60*1000;
 movesPollTimer=window.setTimeout(()=>void syncOperatingMoves(),Math.max(1000,delay));
}
async function syncOperatingMoves(){
 const operating=EQUIPMENT.filter(equipment=>fleet[equipment]?.run.started!==null);
 if(!operating.length)return;
 await Promise.all(operating.map(equipment=>syncMoves(equipment,false,true)));
 scheduleMovesPoll();
}
void syncOperatingMoves();
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')void syncOperatingMoves();});
window.addEventListener('online',()=>void syncOperatingMoves());
if('serviceWorker' in navigator && import.meta.env.PROD) navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).then(()=>navigator.serviceWorker.ready).then(()=>{message='App preparado para uso offline neste aparelho.';render();}).catch(()=>{message='O uso offline ainda não está disponível. Abra por HTTPS ou neste computador por localhost.';render();});





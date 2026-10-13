export const MOVES_FEED_URL='https://brunosth-rgb.github.io/vessel/data/latest.json';
const COMMIT_URL='https://api.github.com/repos/brunosth-rgb/vessel/commits?path=data/latest.json&per_page=1';
const RAW_URL=(sha:string)=>`https://raw.githubusercontent.com/brunosth-rgb/vessel/${sha}/data/latest.json`;
const allowed=new Set(['load','discharge','restow','rehandle','shift','removal']);
type Row=Record<string,unknown>;
export interface MovesReading { visit:string; total:number; reportedAt:number }
let feedPayload:unknown;
let feedSha='';
let feedRequest:Promise<unknown>|null=null;

const clean=(value:unknown)=>String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/gi,'').toUpperCase();
const working=(value:unknown)=>['W','WORKING'].includes(String(value??'').trim().toUpperCase());
export const latestCommitSha=(value:unknown)=>{
 if(!Array.isArray(value))return null;
 const sha=(value[0] as {sha?:unknown}|undefined)?.sha;
 return typeof sha==='string'&&/^[0-9a-f]{40}$/i.test(sha)?sha:null;
};

/**
 * Consulta o commit mais recente antes de ler os Moves. A API do GitHub fica
 * em cache por um minuto; o arquivo pelo SHA é imutável e evita o cache de
 * dez minutos do GitHub Pages. Se a API estiver indisponível, usa a fonte
 * original como contingência.
 */
export async function loadMovesFeed(){
 if(feedRequest)return feedRequest;
 feedRequest=(async()=>{
  try{
   const commit=await fetch(COMMIT_URL,{cache:'no-store'});
   if(!commit.ok)throw Error('Commit indisponível');
   const sha=latestCommitSha(await commit.json());
   if(!sha)throw Error('Commit sem SHA');
   if(sha===feedSha&&feedPayload!==undefined)return feedPayload;
   const response=await fetch(RAW_URL(sha),{cache:'no-store'});
   if(!response.ok)throw Error('Dados indisponíveis');
   feedPayload=await response.json();feedSha=sha;return feedPayload;
  }catch{
   const response=await fetch(MOVES_FEED_URL,{cache:'no-store'});
   if(!response.ok)throw Error('Fonte indisponível');
   feedPayload=await response.json();return feedPayload;
  }finally{feedRequest=null;}
 })();
 return feedRequest;
}

/** Lê o mesmo acumulado de eventos N4 exibido no painel operacional externo. */
export function equipmentMoves(payload:unknown,vessel:string,equipment:string):MovesReading|null {
 const data=payload as {moveRows?:Row[];vesselRows?:Row[];reportReferenceTime?:string;generatedAt?:string};
 if(!Array.isArray(data.moveRows)||!Array.isArray(data.vesselRows))return null;
 const target=clean(vessel),crane=clean(equipment);
 const visits=data.vesselRows.filter(row=>working(row['Phase'])&&clean(row['Vessel Name'])===target).map(row=>clean(row['Visit']));
 if(!visits.length)return null;
 const total=data.moveRows.filter(row=>visits.includes(clean(row['Carrier Visit']))&&clean(row['Crane CHE'])===crane&&allowed.has(String(row['Move Kind']??'').trim().toLowerCase())).length;
 const raw=data.reportReferenceTime??data.generatedAt;
 const reportedAt=raw&&Number.isFinite(new Date(raw).getTime())?new Date(raw).getTime():Date.now();
 return {visit:visits[0],total,reportedAt};
}

export const MOVES_FEED_URL='https://brunosth-rgb.github.io/vessel/data/latest.json';
const allowed=new Set(['load','discharge','restow','rehandle','shift','removal']);
type Row=Record<string,unknown>;
export interface MovesReading { visit:string; total:number; reportedAt:number }

const clean=(value:unknown)=>String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/gi,'').toUpperCase();
const working=(value:unknown)=>['W','WORKING'].includes(String(value??'').trim().toUpperCase());

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

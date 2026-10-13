import { Temporal } from '@js-temporal/polyfill';

export type Hatch = 'unknown' | 'required' | 'open';
export interface Step { id: string; bay: string; operation: 'descarga' | 'embarque'; moves: number | null; reefers: number | null; empty: number | null; notes: string; access: string; hatch: Hatch; closure: boolean; planned: string; doubt: string }
export interface Plan { vessel: string; voyage: string; equipment: string; rate: number; zone: string; travel: number | null; opening: number | null; closing: number | null; steps: Step[]; source: string }
export interface Run { current: number; started: number | null; anchor: number | null; remaining: number | null; delay: number; completed: Record<string, number>; updated: number | null }
export interface State { version: 1; plan: Plan; run: Run; history: Run[] }
export const freshRun = (): Run => ({ current: 0, started: null, anchor: null, remaining: null, delay: 0, completed: {}, updated: null });
export const step = (bay = '01A', moves: number | null = 0): Step => ({ id: crypto.randomUUID(), bay, operation: 'descarga', moves, reefers: null, empty: null, notes: '', access: bay.replace(/[AB]$/, ''), hatch: 'unknown', closure: false, planned: '', doubt: '' });
export function demo(): Plan {
  const rows: [string, Step['operation'], number, number | null, number | null, string][] = [
    ['46A','descarga',2,1,1,''],['42A','descarga',1,null,1,''],['42B','descarga',20,null,null,'Acesso ao porão'],['42A','embarque',2,2,null,'Verificar necessidade de fechamento'],['50B','embarque',19,18,null,'Acesso ao porão'],['46A','descarga',20,4,15,''],['46B','descarga',54,null,32,'Acesso ao porão'],['46B','embarque',54,40,null,'Continuidade do acesso'],['46A','embarque',33,24,1,'Verificar necessidade de fechamento'],['42A','embarque',3,3,null,'']
  ];
  return { vessel:'MAERSK LEON',voyage:'',equipment:'S001',rate:25,zone:'America/Sao_Paulo',travel:null,opening:null,closing:null,source:'Demonstração · transcrição fornecida. Estados de tampa não confirmados.',steps:rows.map(([bay,operation,moves,reefers,empty,notes])=>({...step(bay,moves),operation,reefers,empty,notes})) };
}
export const initial = (): State => ({version:1,plan:{vessel:'',voyage:'',equipment:'',rate:25,zone:'America/Sao_Paulo',travel:null,opening:null,closing:null,source:'Nenhum roteiro cadastrado',steps:[]},run:freshRun(),history:[]});
export const below = (s: Step) => s.bay.endsWith('B');
export function continuous(prev: Step | undefined, next: Step) { return !!prev && below(prev) && below(next) && prev.access === next.access; }
export interface Forecast { index: number; start: number | null; end: number | null; hatchAt: number | null; possible: boolean; continuity: boolean; closureWarning: boolean }
export function forecast(plan: Plan, run: Run): Forecast[] {
  if (!Number.isFinite(plan.rate) || plan.rate <= 0) return [];
  let cursor: number | null = run.anchor;
  const out: Forecast[] = [];
  for(let i=run.current;i<plan.steps.length;i++) {
    const s=plan.steps[i], prev=plan.steps[i-1];
    const same=continuous(prev,s), active=i===run.current && run.started!==null;
    let hatchAt: number | null=null;
    if(i===run.current) { if(cursor!==null) cursor += run.delay*60000; }
    if(cursor!==null && prev && !active && prev.bay.replace(/[AB]$/,'')!==s.bay.replace(/[AB]$/,'')) cursor+=(plan.travel??0)*60000;
    if(!active && cursor!==null) {
      if(s.closure) cursor+=(plan.closing??0)*60000;
      if(below(s) && !same && s.hatch!=='open') { hatchAt=cursor; cursor+=(plan.opening??0)*60000; }
    }
    const start=active ? run.started : cursor;
    const moves=active ? run.remaining : s.moves;
    const end=cursor===null || moves===null ? null : cursor + moves/plan.rate*3600000;
    out.push({index:i,start,end,hatchAt,possible:s.hatch==='unknown',continuity:same,closureWarning:!below(s) && !s.closure && !!prev && below(prev)});
    cursor=end;
  }
  return out;
}
export function remember(s: State) { s.history.push(structuredClone(s.run)); if(s.history.length>30) s.history.shift(); }
export function start(s: State, index: number, at: number) { remember(s); s.run={...s.run,current:index,started:at,anchor:at,remaining:s.plan.steps[index].moves,delay:0,updated:at}; delete s.run.completed[s.plan.steps[index].id]; }
export function updateRemaining(s: State, remaining: number, at: number) { remember(s); s.run.remaining=remaining;s.run.anchor=at;s.run.delay=0;s.run.updated=at; }
// Aplica apenas movimentos novos vindos de uma fonte externa. Se uma bay termina,
// o saldo continua na seguinte para oferecer uma visão operacional aproximada.
export function applyMoves(s: State, moves: number, at: number) {
 if(s.run.started===null||!Number.isInteger(moves)||moves<=0)return 0;
 remember(s);let pending=moves,applied=0;
 while(pending>0&&s.run.current<s.plan.steps.length){
  const current=s.plan.steps[s.run.current],remaining=s.run.remaining;
  if(remaining===null)break;
  if(pending<remaining){s.run.remaining=remaining-pending;s.run.anchor=at;s.run.delay=0;applied+=pending;pending=0;break;}
  pending-=remaining;applied+=remaining;s.run.completed[current.id]=at;s.run.current++;
  if(s.run.current>=s.plan.steps.length){s.run.started=null;s.run.anchor=at;s.run.remaining=null;s.run.delay=0;break;}
  s.run.started=at;s.run.anchor=at;s.run.remaining=s.plan.steps[s.run.current].moves;s.run.delay=0;
 }
 s.run.updated=at;return applied;
}
export function finish(s: State, at: number) { if(s.run.started===null || !s.plan.steps[s.run.current]) return; remember(s); s.run.completed[s.plan.steps[s.run.current].id]=at;s.run.current++;s.run.started=null;s.run.anchor=at;s.run.remaining=null;s.run.delay=0;s.run.updated=at; }
export function delay(s: State, minutes: number, at: number) { remember(s);s.run.delay+=minutes;s.run.updated=at; }
export function undo(s: State) { const r=s.history.pop();if(r) s.run=r; }
export function localInput(epoch: number, zone: string) { return Temporal.Instant.fromEpochMilliseconds(epoch).toZonedDateTimeISO(zone).toPlainDateTime().toString().slice(0,16); }
export function fromLocal(text: string, zone: string) { return Temporal.PlainDateTime.from(text).toZonedDateTime(zone,{disambiguation:'reject'}).epochMilliseconds; }
export function time(epoch: number | null, zone: string) { return epoch===null ? 'A definir' : new Intl.DateTimeFormat('pt-BR',{timeZone:zone,hour:'2-digit',minute:'2-digit'}).format(epoch); }
export function dateTime(epoch: number | null, zone: string) { return epoch===null ? 'A definir' : new Intl.DateTimeFormat('pt-BR',{timeZone:zone,day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}).format(epoch); }
export function validate(p: Plan): string[] {
  const errors: string[]=[];
  if(!p.vessel.trim() || !p.equipment.trim()) errors.push('Informe navio e equipamento.');
  if(!Number.isFinite(p.rate)||p.rate<=0) errors.push('Produtividade deve ser maior que zero.');
  try { new Intl.DateTimeFormat('pt-BR',{timeZone:p.zone}).format(); } catch {errors.push('Fuso horário inválido.');}
  if(!p.steps.length) errors.push('Adicione pelo menos uma etapa.');
  for(const [i,s] of p.steps.entries()) {
    if(!/^\d{2}[AB]$/.test(s.bay)) errors.push(`Etapa ${i+1}: use uma bay como 46A ou 46B.`);
    if(!s.access.trim()) errors.push(`Etapa ${i+1}: informe o acesso.`);
    if(s.moves===null || !Number.isInteger(s.moves)||s.moves<0) errors.push(`Etapa ${i+1}: confirme a quantidade de movimentos.`);
    for(const n of [s.reefers,s.empty]) if(n!==null && (!Number.isInteger(n)||n<0)) errors.push(`Etapa ${i+1}: quantidade inválida.`);
    if(s.moves!==null && (s.reefers??0)+(s.empty??0)>s.moves) errors.push(`Etapa ${i+1}: reefers e vazios ultrapassam o total.`);
    if(s.planned) try{fromLocal(s.planned,p.zone);}catch{errors.push(`Etapa ${i+1}: horário planejado inválido.`);}
  }
  for(const n of [p.travel,p.opening,p.closing]) if(n!==null && (!Number.isFinite(n)||n<0)) errors.push('Tempos auxiliares devem ser positivos ou zero.');
  return errors;
}
export function save(s: State, storage: Pick<Storage,'setItem'> = localStorage) { storage.setItem('costado.v1',JSON.stringify(s)); }
export function load(storage: Pick<Storage,'getItem'> = localStorage): State {
 const raw=storage.getItem('costado.v1');if(!raw)return initial();const s=JSON.parse(raw) as State;
 if(s.version!==1||!s.plan||!s.run||!Array.isArray(s.history)||validate(s.plan).length)throw Error('Dados locais inválidos.');
 for(const r of [s.run,...s.history]) {
  if(!Number.isInteger(r.current)||r.current<0||r.current>s.plan.steps.length||!Number.isFinite(r.delay)||r.delay<0||!r.completed||typeof r.completed!=='object')throw Error('Andamento inválido.');
  for(const t of [r.started,r.anchor,r.updated,...Object.values(r.completed)])if(t!==null&&!Number.isFinite(t))throw Error('Horário inválido.');
  if(r.remaining!==null&&(!Number.isInteger(r.remaining)||r.remaining<0))throw Error('Quantidade inválida.');
 }
 for(const row of s.plan.steps)if(!['descarga','embarque'].includes(row.operation)||!['unknown','open','required'].includes(row.hatch)||typeof row.id!=='string')throw Error('Etapa inválida.');
 return s;
}

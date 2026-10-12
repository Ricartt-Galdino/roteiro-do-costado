import { demo, step, type Plan } from './core';
export const EQUIPMENT = ['S001','S002','M003','M005','M006'] as const;
export interface Extraction { plans: Plan[]; warnings: string[] }
export function normalizeEquipment(value:string):string|null {
 const m=value.toUpperCase().replace(/\s/g,'').match(/^([SM])([0-9OIL]{1,3})$/);if(!m)return null;
 const id=m[1]+m[2].replace(/O/g,'0').replace(/[IL]/g,'1').padStart(3,'0');
 return EQUIPMENT.includes(id as typeof EQUIPMENT[number])?id:null;
}
const digits=(v:string)=>v.toUpperCase().replace(/O/g,'0').replace(/[IL|]/g,'1').replace(/S/g,'5').replace(/B/g,'8');
export const operationPattern=/\b(D(?:i|l|1)?r?sch(?:arge)?(?:[:;]?[ile1]?\d+)?|Load(?:[:;]?[ile1]?\d+)?|descarga|embarque)\b/i;
export function parseRow(raw:string){
 const operation=raw.match(operationPattern);if(!operation||operation.index===undefined)return null;
 const prefix=raw.slice(0,operation.index).trim();
 const bayMatch=prefix.match(/([0-9SOIl]{2})([AB8])?\s*$/i);if(!bayMatch)return null;
 const bayNumber=digits(bayMatch[1]),suffix=bayMatch[2]?.toUpperCase();
 const bay=bayNumber+(suffix==='8'?'B':suffix??'?');
 const detail=raw.slice(operation.index+operation[0].length);
 const quantities=[...detail.matchAll(/(?<![a-z0-9])([0-9SOIBl|]+)\s*[x×*:>]\s*([24d][05Oo])\b/gi)];
 const plain=detail.match(/^\s*([0-9SOIl|]+)\s*(?:movimentos|moves)\b/i);
 const ambiguous=quantities.some(m=>m[1].length>=3&&/[a-z|]/i.test(m[1]));
 const moves=ambiguous?null:quantities.length?quantities.reduce((n,m)=>n+Number(digits(m[1])),0):plain?Number(digits(plain[1])):null;
 const parts=(...patterns:RegExp[])=>{const found=patterns.flatMap(pattern=>[...detail.matchAll(pattern)]);return found.length&&!found.some(m=>m[1].length>1&&/[Il]/.test(m[1]))?found.reduce((n,m)=>n+Number(digits(m[1])),0):null;};
 const s={...step(bay,moves),operation:/^(load|embarque)/i.test(operation[0])?'embarque' as const:'descarga' as const,reefers:parts(/(?<![a-z0-9])([0-9SOIl|]+?)\s*[x×:s.]\s*(?:Rfr|reefer)\b/gi,/(?<![a-z0-9])([0-9SOIl|]{1,2})\s*Rfr\b/gi),empty:parts(/(?<![a-z0-9])([0-9SOIl|]+?)\s*[x×:s.d]\s*(?:Mty|vazio)\b/gi,/(?<![a-z0-9])([0-9SOIl|]{1,2})\s*Mty\b/gi),notes:raw.trim(),doubt:'Conferir linha e quantidades na imagem original.'};
 for(const field of ['reefers','empty'] as const)if(moves!==null&&s[field]!==null&&s[field]!>moves){s[field]=null;s.doubt+=' Parcela maior que os movimentos; confira na foto.';}
 if(suffix==='8')s.doubt+=' OCR leu 8 na posição de B; confirme porão.';
 if(bayMatch[1]!==bayNumber)s.doubt+=` Bay normalizada de ${bayMatch[1]}${suffix??''} para ${bay}; confirmar.`;
 if(!suffix)s.doubt+=' A/B não foi lido: complete a bay antes de salvar.';
 if(quantities.some(m=>!/^[0-9]+$/.test(m[1])||/[dOo]/i.test(m[2])))s.doubt+=' Caracteres numéricos corrigidos pelo contexto; confira a quantidade.';
 if(/twin/i.test(detail))s.doubt+=' Twin identificado: confirmar movimentos versus contêineres.';
 if(moves===null)s.doubt+=' Quantidade ilegível.';
 const uncertain=raw.match(/\[OCR: conferir ([a-z,]+)\]/)?.[1].split(',')??[];
 for(const field of ['moves','reefers','empty'] as const)if(uncertain.includes(field))s[field]=null;
 if(uncertain.length)s.doubt+=' As duas leituras da imagem discordaram. Preencha os valores em branco comparando com a foto.';
 if(raw.includes('[OCR: revisar'))s.doubt+=' Valor recuperado de leitura parcial; confira com a imagem.';
 if(/(?:[OIl]{2,})\s*(?:Rfr|reefer|Mty|vazio)/i.test(detail))s.doubt+=' Quantidade de reefers/vazios ilegível; confira na foto.';
 return s;
}
export function isHeader(raw:string){return !operationPattern.test(raw)&&(/\b(?:moves|mov[eoc]s|mph|sph|planned|planmed|plarred)\b/i.test(raw)||/^\s*[vV>»|]*\s*[SM][0-9OIl]{1,3}\s*$/i.test(raw));}
export function parseWorkList(text:string):Extraction{
 const plans:Plan[]=[],warnings:string[]=[],totals=new Map<Plan,number>();let plan:Plan|undefined;
 const title=text.match(/Crane Work List\s*[-–:]\s*(.*?)\s*[-–]\s*([^\n]+)/i);
 const vessel=title?.[2]?.replace(/\s+[=|].*$/,'').trim()??'',voyage=title?.[1]?.trim()??'';
 for(const raw of text.split(/\r?\n/)){
  if(isHeader(raw)){
   const token=raw.match(/(?:^|[|>\s])([SM]\s*[0-9OIl]{1,3})\b/i)?.[1],equipment=token?normalizeEquipment(token):null;
   plan=equipment?plans.find(p=>p.equipment===equipment):undefined;
   const rate=raw.match(/(\d+(?:[.,]\d+)?)\s*(?:mph|sph|m[o0]v(?:es)?\s*\/\s*h)/i);
   if(!plan){plan={...demo(),vessel,voyage,equipment:equipment??'',rate:rate?Number(rate[1].replace(',','.')):25,steps:[],source:'Crane Work List · '+(equipment??'equipamento a identificar')+' · conferência necessária'};plans.push(plan);}
   const label=equipment??`Bloco ${plans.indexOf(plan)+1}`;
   if(!equipment)warnings.push(`${label}: identifique o equipamento da etiqueta na imagem.`);
   if(!rate)warnings.push(`${label}: produtividade não lida; 25 mov/h é provisório.`);
   if(/sph/i.test(raw))warnings.push(`${label}: OCR leu “sph”; confirme a produtividade de ${plan.rate} mov/h.`);
   if(/conferir etiqueta/i.test(raw))warnings.push(`${label}: confira a etiqueta; leitura feita em recorte ampliado.`);
   const total=raw.match(/(\d+)\s+mov[eoc]s\b/i);if(total)totals.set(plan,Number(total[1]));continue;
  }
  const row=parseRow(raw);
  if(!row){if(operationPattern.test(raw))warnings.push(`Linha não interpretada: ${raw.trim()}`);continue;}
  if(!plan){plan={...demo(),vessel,voyage,equipment:'',steps:[],source:'Crane Work List · cabeçalho ausente'};plans.push(plan);warnings.push('Bays sem cabeçalho foram separadas em um bloco a identificar.');}
  plan.steps.push(row);
  if(raw.includes('[OCR: conferir'))warnings.push(`${plan.equipment||'Bloco '+(plans.indexOf(plan)+1)} · ${row.bay}: leituras divergentes; confira os campos em branco na imagem.`);
 }
 for(const [i,p] of plans.entries()){
  const expected=totals.get(p),actual=p.steps.reduce((n,s)=>n+(s.moves??0),0);
  if(expected!==undefined&&expected!==actual){const warning=`${p.equipment||'Bloco '+(i+1)}: cabeçalho informa ${expected} movimentos, mas foram lidos ${actual}. Confira linhas ausentes ou quantidades divergentes.`;warnings.push(warning);p.source+=' · '+warning;}
 }
 if(!plans.length)warnings.push('Nenhum equipamento reconhecido. Corrija os cabeçalhos ou cadastre manualmente.');
 if(!vessel)warnings.push('Navio/viagem não identificados com segurança. Preencha na conferência.');
 return{plans,warnings};
}


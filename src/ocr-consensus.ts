export const quantityFields=['moves','reefers','empty'] as const;
type Field=typeof quantityFields[number];
export type Quantities=Record<Field,number|null>;
export function reconcileQuantities(first:Quantities,second:Quantities,third:Quantities|null){
 const values={...first},unresolved:Field[]=[];
 for(const k of quantityFields){
  if(first[k]===second[k])continue;
  const v=third?.[k]??null;
  if(v!==null&&(v===first[k]||v===second[k]))values[k]=v;
  else if(v===null&&(first[k]===null)!==(second[k]===null))values[k]=first[k]??second[k];
  else unresolved.push(k);
 }
 return {values,unresolved};
}

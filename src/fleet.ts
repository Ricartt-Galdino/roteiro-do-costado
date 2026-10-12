import type { State } from './core';
import { EQUIPMENT } from './import';

export type Fleet = Partial<Record<(typeof EQUIPMENT)[number], State>>;
const key='costado.fleet.v1';

export function loadFleet(current:State):Fleet {
 try {
  const saved=JSON.parse(localStorage.getItem(key)??'{}') as Fleet;
  if(saved[current.plan.equipment as keyof Fleet]) return saved;
  if(EQUIPMENT.includes(current.plan.equipment as typeof EQUIPMENT[number])) saved[current.plan.equipment as typeof EQUIPMENT[number]]=current;
  return saved;
 } catch { return EQUIPMENT.includes(current.plan.equipment as typeof EQUIPMENT[number])?{[current.plan.equipment]:current}:{}; }
}

export function saveFleet(fleet:Fleet){localStorage.setItem(key,JSON.stringify(fleet));}

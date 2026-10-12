import test from 'node:test';
import assert from 'node:assert/strict';
import {EQUIPMENT,normalizeEquipment,parseWorkList} from './import';
export const wisdom=`Crane Work List - IRWIS2639E.1 - IRENES WISDOM
S02 +M01900 69 moves 26,0 mph (planned)
14B Load 20x40' (12xRfr)
14A Load 8x40' (8xRfr)
03B Load 18x20'
03A Load 3x20'
02B Load 4x40'
18B Disch 10x20' (2x5 twins) 3x40' (1xRfr)
18B Load 3x40'
S01 +M01900 77 moves 26,0 mph (planned)
22B Load 20x40'
22A Load 12x40' (8xRfr)
26B Load 20x40' (20xRfr)
26A Load 2x40' (2xRfr)
30B Load 20x40'
30A Load 3x40' (1xRfr)`;
test('foto IRENES WISDOM separa bays de S001 e S002 mantendo ordem',()=>{
 const result=parseWorkList(wisdom);assert.equal(result.plans.length,2);
 const s1=result.plans.find(p=>p.equipment==='S001')!,s2=result.plans.find(p=>p.equipment==='S002')!;
 assert.deepEqual(s1.steps.map(s=>s.bay),['22B','22A','26B','26A','30B','30A']);
 assert.deepEqual(s2.steps.map(s=>s.bay),['14B','14A','03B','03A','02B','18B','18B']);
 assert.equal(s1.steps.reduce((n,s)=>n+s.moves!,0),77);assert.equal(s2.steps.reduce((n,s)=>n+s.moves!,0),69);
 assert.equal(s1.rate,26);assert.equal(s2.rate,26);assert.equal(s1.vessel,'IRENES WISDOM');
 assert.ok(!result.warnings.some(w=>w.includes('cabeçalho informa')));
});
test('cinco equipamentos canônicos e formas curtas são reconhecidos',()=>{for(const id of EQUIPMENT)assert.equal(normalizeEquipment(id),id);assert.equal(normalizeEquipment('S01'),'S001');assert.equal(normalizeEquipment('S02'),'S002');assert.equal(normalizeEquipment('M06'),'M006');assert.equal(normalizeEquipment('M004'),null);assert.equal(normalizeEquipment('M01900'),null);});
test('cabeçalho ilegível fica isolado sem contaminar equipamento anterior',()=>{const x=parseWorkList('S001 20 moves 25 mph\n22B Load 20x40\n??? 10 moves 25 mph\n14B Load 10x40\nM006 2 moves 12 mph\n66B Load 2x40');assert.deepEqual(x.plans.map(p=>p.steps.map(s=>s.bay)),[['22B'],['14B'],['66B']]);assert.deepEqual(x.plans.map(p=>p.equipment),['S001','','M006']);});
test('bloco repetido junta apenas bays do mesmo equipamento',()=>{const x=parseWorkList('S001 25 mph\n22B Load 2x40\nM003 12 mph\n10B Load 3x40\nS001 25 mph\n22A Load 4x40');assert.deepEqual(x.plans[0].steps.map(s=>s.bay),['22B','22A']);assert.equal(x.plans[1].equipment,'M003');});
test('erros de OCR em B ficam sinalizados e A/B ausente não é inventado',()=>{const x=parseWorkList('v | sol | +M01900 77 moves 26 mph\n228 Load 20x40\n22 Load 12x40');assert.equal(x.plans[0].equipment,'S001');assert.equal(x.plans[0].steps[0].bay,'22B');assert.match(x.plans[0].steps[0].doubt,/OCR leu 8/);assert.equal(x.plans[0].steps[1].bay,'22?');});

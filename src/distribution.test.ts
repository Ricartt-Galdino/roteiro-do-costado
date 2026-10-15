import {test} from 'node:test';
import assert from 'node:assert/strict';
import {distributionRows,nextBreak} from './distribution';
test('destaca próximos intervalos empatados sem incluir horários passados',()=>{
 const rows=nextBreak([{id:'CAM1',interval:'15:00'},{id:'CAM2',interval:'16:00'},{id:'CAM3',interval:'16:00'}],'2026-10-15','13X19',Date.parse('2026-10-15T15:45:00-03:00'));
 assert.deepEqual(rows.map(row=>row.id),['CAM2','CAM3']);assert.equal(rows[0].minutes,15);
});
test('intervalo após meia-noite pertence ao turno noturno anterior',()=>{
 const rows=nextBreak([{id:'CAM1',interval:'00:30'}],'2026-10-15','19X01',Date.parse('2026-10-15T23:50:00-03:00'));
 assert.equal(rows[0].minutes,40);
 assert.equal(nextBreak([{id:'CAM1',interval:'15:00'}],'2026-10-14','13X19',Date.parse('2026-10-15T14:00:00-03:00')).length,0);
});
test('RS usa frente e intervalo do equipamento sem misturar com CAM',()=>{
 const rows=distributionRows({alocacoes:{RS10:'p1',RS2:'p2',CAM1:'p3'},locais:{RS10:'terno2','op:p1':'outro',RS2:'patio'},intervalos:{RS10:'16:00','op:p1':'15:00'},extras:[{id:'p2',nome:'Operador 2',ogmo:true}]},[{id:'p1',nome:'Operador 1'}],'RS');
 assert.deepEqual(rows.map(row=>row.id),['RS2','RS10']);
 assert.equal(rows[1].frontId,'terno2');assert.equal(rows[1].interval,'16:00');assert.equal(rows[0].type,'OGMO');
});
test('distribuição prioriza frente do motorista e inclui OGMO e hora extra sem inferir situação',()=>{
 const rows=distributionRows({alocacoes:{CAM2:'p1',CAM10:'p2',RS1:'p3'},locais:{CAM2:'patio','op:p1':'terno1'},extras:[{id:'p2',nome:'Pessoa 2',ogmo:true}],intervalos:{'op:p1':'15:30'}},[{id:'p1',nome:'Pessoa 1'}]);
 assert.equal(rows.length,2);assert.equal(rows[0].frontId,'terno1');assert.equal(rows[0].interval,'15:30');assert.equal(rows[1].type,'OGMO');
});
test('motorista ausente do cadastro não recebe vínculo presumido',()=>{
 const rows=distributionRows({alocacoes:{CAM1:'ausente'}},[]);
 assert.equal(rows[0].type,'Vínculo não informado');assert.equal(rows[0].frontId,'');
});

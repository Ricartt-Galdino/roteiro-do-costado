import {test} from 'node:test';
import assert from 'node:assert/strict';
import {distributionRows} from './distribution';
test('distribuição prioriza frente do motorista e inclui OGMO e hora extra sem inferir situação',()=>{
 const rows=distributionRows({alocacoes:{CAM2:'p1',CAM10:'p2',RS1:'p3'},locais:{CAM2:'patio','op:p1':'terno1'},extras:[{id:'p2',nome:'Pessoa 2',ogmo:true}],intervalos:{'op:p1':'15:30'}},[{id:'p1',nome:'Pessoa 1'}]);
 assert.equal(rows.length,2);assert.equal(rows[0].frontId,'terno1');assert.equal(rows[0].interval,'15:30');assert.equal(rows[1].type,'OGMO');
});
test('motorista ausente do cadastro não recebe vínculo presumido',()=>{
 const rows=distributionRows({alocacoes:{CAM1:'ausente'}},[]);
 assert.equal(rows[0].type,'Vínculo não informado');assert.equal(rows[0].frontId,'');
});

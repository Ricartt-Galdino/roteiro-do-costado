import test from 'node:test';
import assert from 'node:assert/strict';
import {isHeader,parseRow,parseWorkList} from './import';
import {enhanceGray,findLabels} from './ocr-image';
import {reconcileQuantities} from './ocr-consensus';

test('leitura ausente não apaga quantidade, mas conflito real exige conferência',()=>{
 const a={moves:55,reefers:40,empty:null},b={moves:null,reefers:4,empty:null};
 assert.deepEqual(reconcileQuantities(a,b,null),{values:a,unresolved:['reefers']});
 assert.deepEqual(reconcileQuantities(a,b,a),{values:a,unresolved:[]});
 assert.deepEqual(reconcileQuantities(a,b,{...a,moves:5}).unresolved,['moves']);
});
test('ruídos em reefers e quantidades longas não viram valores plausíveis por truncamento',()=>{
 assert.equal(parseRow('66A Load 13x40 (13sRfr)')?.reefers,13);
 assert.equal(parseRow('10B Load 16x40 (1ORFr)')?.reefers,10);
 assert.equal(parseRow('50B Load 19x40 (QA8RFr)')?.reefers,null);
 assert.equal(parseRow('50A Load 20x40 (200RFr)')?.reefers,null);
 assert.equal(parseRow('46B Load S5Sx40')?.moves,null);
});

test('transcrição defeituosa preserva três blocos e não trata S08 como equipamento',()=>{
 const result=parseWorkList(`v | 006 | MOO700 12 moves 12,0 mph (planmed)
06A Disch Ix20' 3Ixd0'
61A Disch 6x20' DESCARGA COM MHC.
oO T8002 NOO700 104 moves 28,0 sph (planed)
308 Disch 2x40
228 Dischi2 24x20' 7Bx40'
v EDN MOO 700 96 moves 28,0 mph (plarred)
S0A Disch Sx40
S08 Disch 60x20' 17x40'
46A Load 14x40`);
 assert.equal(result.plans.length,3);
 assert.deepEqual(result.plans.map(p=>p.steps.map(s=>s.bay)),[['06A','61A'],['30B','22B'],['50A','50B','46A']]);
 assert.deepEqual(result.plans.map(p=>p.rate),[12,28,28]);
 assert.equal(result.plans[1].steps[1].moves,102);
 assert.equal(result.plans[2].steps.reduce((n,s)=>n+s.moves!,0),96);
 assert.ok(result.warnings.every(w=>!w.includes('null')));
 assert.ok(result.plans.every(p=>p.equipment===''));
 assert.equal(isHeader('S08 Disch 60x20 17x40'),false);
});
test('variantes do sufixo de descarga não apagam a linha',()=>{
 for(const op of ['Disch:2','Dischi2','Dische2','Disch2'])assert.equal(parseRow(`228 ${op} 24x20 7Bx40`)?.moves,102);
});
test('lista CMA preserva parcelas, Load:1 e ignora reefer de observação',()=>{
 const result=parseWorkList(`Crane Work List - CMSYRSE3030E19.1 - CMA CGM SYRACUSE
M005 SA0700 86 moves 12,0 mph (planned)
02A Disch 5x20 7x40
02A Load 20x40 (20xMty)
02A Load:1 23x40 (23xMty)
03A Load 2x20
14A Load 10x20 (2x5 twins) 19x40 (15xRfr)
M006 SA0100 0 moves 12,0 mph (planned)
S002 SA0700 160 moves 26,0 mph (planned)
22B Disch 32x40
14B Disch 40x40
14B Load 36x20 (2x18 twins) 22x40
34A Load:1 8x40 (2xRfr, 4xMty) 1 reefer para reparo
50A Load:1 22x40 (1xRfr, 21xMty)
S001 SA0700 167 moves 26,0 mph (planned)
30A Load 47x40 (47xMty)
22B Load 14x40 (14xMty)
22B Load:1 60x40 (60xMty)
22A Load 46x40 (46xMty)`);
 const m005=result.plans.find(p=>p.equipment==='M005')!,s002=result.plans.find(p=>p.equipment==='S002')!,s001=result.plans.find(p=>p.equipment==='S001')!;
 assert.deepEqual(m005.steps.map(s=>s.moves),[12,20,23,2,29]);assert.equal(m005.steps[4].reefers,15);
 assert.deepEqual(s002.steps.map(s=>s.moves),[32,40,58,8,22]);assert.equal(s002.steps[3].reefers,2);assert.equal(s002.steps[3].empty,4);
 assert.equal(s001.steps.reduce((total,s)=>total+s.moves!,0),167);assert.ok(!result.warnings.some(w=>w.includes('cabeçalho informa')));
});
test('observações não exibem aviso genérico sobre tampas',()=>{
 const result=parseWorkList('S002 1 moves 25 mph\n22B Load 1x40');
 assert.ok(!result.warnings.some(w=>w.includes('não confirma tampas')));
});
test('leituras discordantes deixam somente os campos divergentes em branco',()=>{
 const row=parseRow('06A Disch 1x20 31x40 (2xRfr) [OCR: conferir moves]')!;
 assert.equal(row.moves,null);assert.equal(row.reefers,2);assert.match(row.doubt,/discordaram/);
 assert.equal(parseRow('30A Load 3x40 (3xRfr) [OCR: conferir reefers]')?.reefers,null);
 assert.equal(parseRow('18B Disch 3x40 (LiRfr)')?.reefers,null);
});
test('normalização da imagem mantém RGBA e inversão sem alterar o original',()=>{
 const data=new Uint8Array([0,0,0,255,255,255,255,255]);
 const out=enhanceGray({data,width:2,height:1},true);
 assert.deepEqual([...out],[255,255,255,255,0,0,0,255]);
 assert.equal(data[0],0);
});
test('detecção localiza etiquetas sem atribuir identidade por cor',()=>{
 const width=200,height=100,data=new Uint8Array(width*height*4).fill(200);
 for(let y=20;y<30;y++)for(let x=15;x<45;x++)data.set([0,0,180,255],(y*width+x)*4);
 assert.deepEqual(findLabels({data,width,height}),[{left:15,top:20,width:30,height:10}]);
});

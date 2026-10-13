import test from 'node:test';
import assert from 'node:assert/strict';
import {equipmentMoves,latestCommitSha,operatingVessels} from './moves-feed';

const data={reportReferenceTime:'2026-10-11T20:00:00-03:00',vesselRows:[{'Visit':'V1','Vessel Name':'JAZAN','Phase':'Working'},{'Visit':'OLD','Vessel Name':'JAZAN','Phase':'Complete'}],moveRows:[{'Carrier Visit':'V1','Crane CHE':'S002','Move Kind':'Load'},{'Carrier Visit':'V1','Crane CHE':'S002','Move Kind':'Discharge'},{'Carrier Visit':'V1','Crane CHE':'S002','Move Kind':'Unknown'},{'Carrier Visit':'V1','Crane CHE':'M005','Move Kind':'Restow'}]};
test('conta somente os movimentos N4 permitidos do navio e equipamento ativos',()=>{assert.deepEqual(equipmentMoves(data,'JAZAN','S002'),{visit:'V1',total:2,reportedAt:new Date(data.reportReferenceTime).getTime()});assert.equal(equipmentMoves(data,'OUTRO','S002'),null);});

test('aceita somente SHA completo do commit mais recente',()=>{assert.equal(latestCommitSha([{sha:'a'.repeat(40)}]),'a'.repeat(40));assert.equal(latestCommitSha([{sha:'curto'}]),null);assert.equal(latestCommitSha({sha:'a'.repeat(40)}),null);});
test('lista somente navios ativos com Moves e produtividade calculados',()=>{const rows=operatingVessels({...data,vesselRows:[{'Visit':'V1','Vessel Name':'JAZAN','Phase':'W','Service Name':'LUX','I/B Vyg':'123N','Berth':'BERCO2','Time Start Work':'11/10/2026 18:00'},{'Visit':'OLD','Vessel Name':'ANTIGO','Phase':'T'}]});assert.equal(rows.length,1);assert.equal(rows[0].moves,3);assert.equal(rows[0].vessel,'JAZAN');assert.equal(rows[0].berth,'BERCO2');assert.equal(rows[0].startedLabel,'18:00');assert.ok(rows[0].mph!==null&&rows[0].mph>1);});

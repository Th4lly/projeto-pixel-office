import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
async function load(file) {
 const source = (await readFile(new URL(file, import.meta.url), 'utf8')).replace(/^import .*;$/gm, '');
 return import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
}
const { Media } = await load('../docs/js/media/rtc.js');
const { Calls } = await load('../docs/js/media/calls.js');
test('ICE received before offer is retained with a bounded queue', async () => {
 const media = Object.create(Media.prototype);
 Object.assign(media, { app:{me:{id:'me'},players:new Map([['other',{}]])}, peers:new Map(), earlyCandidates:new Map() });
 for(let i=0;i<100;i++) await media.handleSignal({to:'me',from:'other',data:{type:'candidate',candidate:{candidate:String(i)}}});
 assert.equal(media.earlyCandidates.get('other').items.length,64);
});
test('signaling from one peer is processed sequentially', async () => {
 const media = Object.create(Media.prototype);
 media.signalQueues = new Map();
 const order=[];
 media.handleSignal = async (m) => { order.push(`start${m.n}`); await new Promise(r=>setTimeout(r,5)); order.push(`end${m.n}`); };
 await Promise.all([media.onSignal({from:'a',n:1}),media.onSignal({from:'a',n:2})]);
 assert.deepEqual(order,['start1','end1','start2','end2']);
});
test('unanswered calls release busy state only after final invitation', () => {
 const calls = Object.create(Calls.prototype);
 calls.call={members:new Set()}; calls.outgoing=new Map([['a',1]]);
 let ended=0; calls.end=()=>ended++;
 calls.finishUnanswered(); assert.equal(ended,0);
 calls.outgoing.clear(); calls.finishUnanswered(); assert.equal(ended,1);
});
test('targeted call messages cannot modify another participant state', () => {
 const calls = Object.create(Calls.prototype); calls.app={me:{id:'me'}};
 calls.incoming=()=>assert.fail('wrong recipient');
 calls.onSignal({type:'ring',to:'elsewhere',from:'other'});
});
const worldSource = (await readFile(new URL('../docs/js/game/world.js', import.meta.url), 'utf8')).replace(/^import .*;$/gm, '');
const { World } = await import(`data:text/javascript;base64,${Buffer.from(`const OBJECTS={door:{door:true,w:1,h:1}}; const FLOORS={floor:{}}; const dims=()=>({w:1,h:1});\n${worldSource}`).toString('base64')}`);
test('automatic door opens gradually and holds while occupied', () => {
 const w = new World({map:{width:4,height:4,floor:Array(16).fill('floor')},objects:[{id:'d',type:'door',x:1,y:1,data:{},state:{}}]});
 const players=new Map([['p',{rx:1,ry:1}]]);
 w.updateDoors(players,.11); assert.equal(w.doors.get('d').progress,.5);
 w.updateDoors(players,.11); assert.equal(w.doors.get('d').progress,1);
 w.updateDoors(new Map(),.2); assert.equal(w.doors.get('d').progress,1);
 w.updateDoors(new Map(),1); assert.equal(w.doors.get('d').progress,0);
 assert.equal(w.walkable(1,1),true);
});
test('manual door remains blocked until its shared state opens', () => {
 const door={id:'d',type:'door',x:1,y:1,data:{auto:false},state:{}};
 const w = new World({map:{width:4,height:4,floor:Array(16).fill('floor')},objects:[door]});
 assert.equal(w.walkable(1,1),false);
 door.state.open=true; w.reindex(); assert.equal(w.walkable(1,1),true);
});

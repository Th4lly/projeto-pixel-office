import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { loadCatalog } from '../docs/js/art/assets.js';
import { buildTiles } from '../docs/js/art/tiles.js';
import { buildObjects } from '../docs/js/art/objects.js';
import { buildDefaultMap, MAP_VERSION } from '../docs/js/game/defaultMap.js';
import { World as DefaultWorld } from '../docs/js/game/world.js';

const catalogText = await readFile(new URL('../docs/assets/catalog.json', import.meta.url), 'utf8');
const originalFetch = globalThis.fetch;
globalThis.fetch = async () => new Response(catalogText, { status: 200 });
try {
 await loadCatalog('catalog.json');
} finally {
 globalThis.fetch = originalFetch;
}
buildTiles();
buildObjects();

async function load(file) {
 const lines = (await readFile(new URL(file, import.meta.url), 'utf8')).split('\n');
 let skippingImport = false;
 const source = lines.filter((line) => {
  const isImport = /^\s*import\b/.test(line);
  if (!skippingImport && !isImport) return true;
  if (isImport) skippingImport = !/\sfrom\s+['"][^'"]+['"];?\s*$/.test(line);
  else if (skippingImport && /\sfrom\s+['"][^'"]+['"];?\s*$/.test(line)) skippingImport = false;
  return false;
 }).join('\n').replace(/^export \{ OBJECTS \};$/gm, '');
 return import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
}
const { Media } = await load('../docs/js/media/rtc.js');
const { Calls } = await load('../docs/js/media/calls.js');
const { Combat } = await load('../docs/js/features/combat.js');
const { SupabaseBackend } = await load('../docs/js/backend/supabase.js');
const { Renderer } = await load('../docs/js/game/renderer.js');
class TestEmitter {
 constructor() { this.listeners = new Map(); }
 on(event, fn) { this.listeners.set(event, fn); return () => this.listeners.delete(event); }
 emit(event, value) { this.listeners.get(event)?.(value); }
}
globalThis.Emitter = TestEmitter;
globalThis.TILE = 32;
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
test('combat HUD collapses to a tab and stays hidden outside arenas', () => {
 const combat = Object.create(Combat.prototype);
 const tabAttrs = {};
 combat.hudCollapsed = false;
 combat.hudEl = { hidden: true };
 combat.hudToggle = {
  hidden: true,
  setAttribute: (name, value) => { tabAttrs[name] = value; },
 };
 combat.inArena = () => true;
 combat.toggleHud();
 assert.equal(combat.hudEl.hidden, true);
 assert.equal(combat.hudToggle.hidden, false);
 assert.equal(tabAttrs['aria-expanded'], 'false');
 combat.toggleHud();
 assert.equal(combat.hudEl.hidden, false);
 assert.equal(combat.hudToggle.hidden, true);
 assert.equal(tabAttrs['aria-expanded'], 'true');
 combat.inArena = () => false;
 combat.syncHudVisibility();
 assert.equal(combat.hudEl.hidden, true);
 assert.equal(combat.hudToggle.hidden, true);
});
test('outgoing calls do not request media while realtime is disconnected', async () => {
 const oldToast = globalThis.toast;
 let requestedMedia = false;
 globalThis.toast = () => {};
 const calls = Object.create(Calls.prototype);
 calls.app = {
  room: { connected: false },
  media: { on: false, enable: async () => { requestedMedia = true; return true; } },
 };
 try {
  await calls.start(['other']);
  assert.equal(requestedMedia, false);
 } finally {
  if (oldToast === undefined) delete globalThis.toast;
  else globalThis.toast = oldToast;
 }
});
test('zone labels hide current, distant, and colliding room names', () => {
 const zones = [
  { name:'Sala', kind:'area', x:0, y:0, w:10, h:10 },
  { name:'Sala', kind:'area', x:0, y:0, w:10, h:10 },
 ];
 const render = (zoom, me, playerBounds) => {
  const labels = [];
  const ctx = {
   measureText: (text) => ({ width:String(text).length * 5 }),
   beginPath() {}, moveTo() {}, arcTo() {}, closePath() {}, fill() {},
   fillText: (text) => labels.push(text),
  };
  const renderer = Object.create(Renderer.prototype);
  renderer.ctx = ctx;
  Object.defineProperty(renderer, 'dpr', { value:1 });
  renderer.app = {
   me,
   players: new Map([['me', me], ...(playerBounds ? [['other', { _labelBounds:playerBounds }]] : [])]),
   world: { zones },
  };
  renderer.drawZoneLabels(0, 0, 32 * zoom);
  return labels;
 };
 assert.deepEqual(render(1, { x:1, y:1 }, null), []);
 assert.deepEqual(render(0.75, { x:20, y:20 }, null), []);
 assert.deepEqual(render(1, { x:20, y:20 }, { x:128, y:4, w:64, h:26 }), []);
 assert.deepEqual(render(1, { x:20, y:20 }, null), ['Sala']);
});
test('Supabase room exposes connection state and refuses disconnected broadcasts', async () => {
 const oldDocument = globalThis.document;
 const oldWindow = globalThis.window;
 let statusHandler;
 let sent = 0;
 const channel = {
  state: 'closed',
  on() { return this; },
  presenceState() { return {}; },
  subscribe(fn) { statusHandler = fn; this.state = 'joined'; setTimeout(() => fn('SUBSCRIBED'), 0); return this; },
  track() { return Promise.resolve('ok'); },
  send() { sent++; return Promise.resolve('ok'); },
 };
 const backend = Object.create(SupabaseBackend.prototype);
 backend.sb = { channel: () => channel, removeChannel: async () => { channel.state = 'closed'; return 'ok'; } };
 globalThis.document = { hidden: false, addEventListener() {}, removeEventListener() {} };
 globalThis.window = { addEventListener() {}, removeEventListener() {} };
 try {
  const room = backend.joinRoom('test-player', { x: 1, y: 1 });
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(room.connected, true);
  assert.equal(room.send('call', { type: 'ring' }), true);
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(sent, 1);
  channel.state = 'closed';
  assert.equal(room.send('call', { type: 'ring' }), false);
  assert.equal(room.connected, false);
  assert.equal(sent, 1);
  await room.leave();
 } finally {
  if (oldDocument === undefined) delete globalThis.document;
  else globalThis.document = oldDocument;
  if (oldWindow === undefined) delete globalThis.window;
  else globalThis.window = oldWindow;
 }
});
test('Supabase retries presence after the server rejects tracking', async () => {
 const oldDocument = globalThis.document;
 const oldWindow = globalThis.window;
 let attempts = 0;
 const backend = Object.create(SupabaseBackend.prototype);
 backend.sb = {
  channel() {
   const attempt = ++attempts;
   return {
    state: 'closed',
    on() { return this; },
    presenceState() { return {}; },
    subscribe(fn) { this.state = 'joined'; setTimeout(() => fn('SUBSCRIBED'), 0); return this; },
    track() { return Promise.resolve(attempt === 1 ? 'error' : 'ok'); },
    send() { return Promise.resolve('ok'); },
   };
  },
  removeChannel: async (channel) => { channel.state = 'closed'; return 'ok'; },
 };
 globalThis.document = { hidden: false, addEventListener() {}, removeEventListener() {} };
 globalThis.window = { addEventListener() {}, removeEventListener() {} };
 try {
  const room = backend.joinRoom('retry-player', { x: 1, y: 1 });
  await new Promise((resolve) => setTimeout(resolve, 1250));
  assert.equal(attempts, 2);
  assert.equal(room.connected, true);
  await room.leave();
 } finally {
  if (oldDocument === undefined) delete globalThis.document;
  else globalThis.document = oldDocument;
  if (oldWindow === undefined) delete globalThis.window;
  else globalThis.window = oldWindow;
 }
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
test('default map v7 keeps the team offices, balanced cafe, and connected dungeon exit', () => {
 const data = buildDefaultMap();
 const world = new DefaultWorld(data);
 const design = world.zones.find((z) => z.id === 'z-reuniao-a');
 const seo = world.zones.find((z) => z.id === 'z-reuniao-b');
 assert.equal(MAP_VERSION, 7);
 assert.equal(data.map.version, 7);
 assert.equal(design.name, 'Equipe de Design');
 assert.equal(seo.name, 'Equipe de SEO');
 assert.equal(design.meeting, true);
 assert.equal(seo.meeting, true);
 for (const zone of [design, seo]) {
  const furniture = data.objects.filter((o) => o.x >= zone.x && o.x < zone.x + zone.w && o.y >= zone.y && o.y < zone.y + zone.h);
  assert.equal(furniture.filter((o) => o.type === 'meeting_table').length, 1);
  assert.equal(furniture.filter((o) => ['desk', 'desk_pc', 'desk_magic'].includes(o.type)).length, 0);
  assert.equal(furniture.filter((o) => o.type === 'chair').length, 8);
 }
 const library = data.objects.filter((o) => o.x >= 37 && o.x < 51 && o.y >= 39 && o.y < 49);
 assert.equal(library.filter((o) => o.type === 'lpc-sofa-vermelho').length, 2);
 assert.equal(library.some((o) => o.type === 'lpc-poltrona-vermelho'), false);
 assert.equal(library.some((o) => o.type === 'lpc-mesa-de-centro'), true);
 assert.equal(library.some((o) => o.type === 'lpc-mesinha-media'), false);
 const fireplace = library.find((o) => o.type === 'lpc-lareira-tijolo');
 assert.deepEqual({ x: fireplace.x, y: fireplace.y, rot: fireplace.rot }, { x: 49, y: 43, rot: 90 });
 assert.equal(world.floorAt(23, 41), world.floorAt(35, 48));
 assert.equal(data.objects.some((o) => o.type === 'extra-mana-caverna'), false);
 assert.equal(data.objects.some((o) => o.type === 'portal' && o.x === 30 && o.y === 71), false);
 assert.equal(data.map.fx['22,80'], 'o:9,49');
 assert.equal(world.walkable(9, 49), true);
 assert.equal(world.floorAt(31, 56), world.floorAt(32, 57));
});
test('boss office, terrace stairs, and dungeon entrance remain reachable through doors', () => {
 const world = new DefaultWorld(buildDefaultMap());
 const reachable = (start, target) => {
  const queue = [start];
  const seen = new Set([`${start.x},${start.y}`]);
  for (let i = 0; i < queue.length; i++) {
   const point = queue[i];
   if (point.x === target.x && point.y === target.y) return true;
   for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
    const next = { x: point.x + dx, y: point.y + dy };
    const id = `${next.x},${next.y}`;
    if (!seen.has(id) && world.walkable(next.x, next.y)) {
     seen.add(id);
     queue.push(next);
    }
   }
  }
  return false;
 };
 assert.equal(reachable({ x: 9, y: 27 }, { x: 3, y: 28 }), true);
 assert.equal(reachable({ x: 29, y: 48 }, { x: 31, y: 56 }), true);
 assert.equal(reachable({ x: 10, y: 48 }, { x: 10, y: 52 }), true);
});

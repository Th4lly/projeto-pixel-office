// NPCs com função. Não existe NPC "decorativo": todo NPC no mapa é um objeto do tipo "npc"
// com um papel (role), um nome e um sprite do catálogo; tecla X abre o diálogo dele.
import { h, fill, toast } from '../ui/dom.js';
import { openModal } from '../ui/modal.js';
import { CAT, frameCanvas } from '../art/assets.js';
import { npcFrames, OBJECTS } from '../art/objects.js';
import { blip } from '../audio.js';
import { BUFFS } from './interactions.js';

export const ROLES = {
  guide: { name: 'Recepcionista', title: 'Guia do escritório', hello: 'Olá! Posso te mostrar o escritório, te levar a algum lugar ou te ajudar a achar uma mesa.' },
  kafra: { name: 'Kafra', title: 'Serviço de teletransporte Kafra', hello: 'Bem-vindo ao Serviço Kafra! Para onde deseja ir?' },
  arena: { name: 'Mestre da Arena', title: 'Mestre da Arena', hello: 'Guerreiro! Aqui eu curo suas feridas, explico as regras d20 e solto monstros na arena.' },
  merchant: { name: 'Mercador', title: 'Mercador', hello: 'Itens para decorar e construir! Pague com zeny que você ganha na arena.' },
  barista: { name: 'Barista', title: 'Barista da copa', hello: 'O que vai ser hoje?' },
  quests: { name: 'Mestre das Quests', title: 'Mestre das Quests', hello: 'As tarefas do time viram missões. Quer ver o quadro?' },
  notion: { name: 'Assistente', title: 'Assistente de projetos', hello: 'Posso abrir o board do Notion da empresa ou o seu.' },
};

const DRINKS = [['coffee', 'Café'], ['tea', 'Chá'], ['drink', 'Suco'], ['snack', 'Lanche'], ['soup', 'Sopa mágica'], ['water_drink', 'Água']];

export class NpcRoles {
  constructor(app) {
    this.app = app;
  }

  roleOf(o) {
    return ROLES[(o.data && o.data.role) || 'guide'] || ROLES.guide;
  }

  nameOf(o) {
    return (o.data && o.data.name) || this.roleOf(o).name;
  }

  portrait(o) {
    const a = npcFrames(o);
    return a ? frameCanvas(a.s, a.frames[0], 72) : h('span', {});
  }

  open(o) {
    const app = this.app;
    const role = (o.data && o.data.role) || 'guide';
    const R = this.roleOf(o);
    const body = h('div', { class: 'npc-dialog' });
    const m = openModal({ title: `${this.nameOf(o)} — ${R.title}`, content: body, className: 'modal-wide' });
    blip(740, 0.05, 0.04);
    const opt = (label, fn) => h('button', { type: 'button', class: 'npc-opt', onclick: () => fn() }, label);
    let options = [];
    switch (role) {
      case 'kafra':
        options = [opt('🌀 Teletransporte', () => this.teleportMenu(body, m)), opt('🎒 Ver meu inventário', () => { m.close(); app.inventory.open(); })];
        break;
      case 'arena':
        options = [
          opt('💖 Curar HP e SP', () => {
            const me = app.me;
            if (app.combat.inArena() && app.combat.nearestTarget(6)) return toast('Saia do combate primeiro!', 'warn');
            me.hp = me.maxHp; me.sp = me.maxSp; app.combat.statuses = {};
            app.combat.publish();
            app.combat.broadcastFx({ fx: 'heal', x: me.x + 0.5, y: me.y + 1 });
            toast('Você foi curado!', 'ok', 1500);
          }),
          opt('📜 Minha ficha e regras d20', () => { m.close(); app.combat.openSheet(); }),
          opt('🐉 Soltar uma onda de monstros', () => {
            const z = app.world.zones.find((zz) => zz.kind === 'arena' && !/chefe|mvp|covil/i.test(zz.name));
            if (!z) return toast('Não há arena de monstros no mapa.', 'warn');
            for (let i = 0; i < 3; i++) app.room.send('cbt', { type: 'summon', zone: z.id });
            if (app.combat.isAuthority(z)) for (let i = 0; i < 3; i++) app.combat.spawn(z);
            toast('Três monstros entraram na arena!', 'ok', 2000);
          }),
          opt('⚔️ Ranking PvP', () => this.ranking(body)),
          opt('🌀 Ir para a arena', () => { m.close(); this.goZone(/arena dos monstros/i); }),
        ];
        break;
      case 'merchant':
        options = [opt('🛒 Comprar e vender', () => { m.close(); app.inventory.openShop(this.nameOf(o)); }), opt('🎒 Meu inventário', () => { m.close(); app.inventory.open(); })];
        break;
      case 'barista':
        options = DRINKS.map(([k, label]) => opt(`${BUFFS[k][0]} ${label}`, () => {
          const [e, buff, min, msg] = BUFFS[k];
          app.addBuff(e, buff, min);
          app.emote(e);
          toast(`${msg} (${buff} por ${min} min)`, 'ok', 2200);
          m.close();
        }));
        break;
      case 'quests':
        options = [opt('📜 Quadro de quests', () => { m.close(); app.quests.open(); }), opt('🏆 Ranking de heróis', () => { m.close(); app.quests.openRanking(); }),
          opt('🗂️ Minhas quests', () => { m.close(); app.sidebar.toggle('myquests'); })];
        break;
      case 'notion':
        options = [opt('📋 Boards do Notion', () => { m.close(); app.notion.open(); }), opt('📎 Anexos da reunião desta sala', () => {
          const z = app.world.zonesAt(o.x, o.y).find((zz) => zz.kind === 'private' || zz.meeting);
          m.close();
          app.meetings.open(z ? z.id : o.id, z ? z.name : 'Reunião');
        })];
        break;
      default: // guia
        options = [
          opt('🗺️ Me leve até…', () => this.teleportMenu(body, m, true)),
          opt('🪑 Achar uma mesa para mim', () => { m.close(); this.findDesk(); }),
          opt('📞 Ligar para alguém', () => { m.close(); app.calls.openDialer({ place: 'recepção' }); }),
          opt('❓ Como funciona o escritório', () => { m.close(); document.getElementById('btn-help').click(); }),
        ];
    }
    fill(body,
      h('div', { class: 'npc-head' }, this.portrait(o), h('p', { class: 'npc-hello' }, (o.data && o.data.hello) || R.hello)),
      h('div', { class: 'npc-opts' }, options));
  }

  teleportMenu(body, m, walk = false) {
    const app = this.app;
    const zones = app.world.zones.filter((z) => z.name && z.kind !== 'desk').sort((a, b) => a.name.localeCompare(b.name));
    fill(body, h('p', {}, walk ? 'Para onde? Eu te levo andando.' : 'Escolha o destino:'),
      h('div', { class: 'npc-opts' }, zones.map((z) => h('button', { type: 'button', class: 'npc-opt', onclick: () => {
        m.close();
        const spot = this.spotIn(z);
        if (!spot) return toast('Não achei um lugar livre lá.', 'warn');
        if (walk) app.goTo(spot.x, spot.y);
        else { app.teleport(spot.x, spot.y); app.combat.broadcastFx({ fx: 'cast', x: spot.x + 0.5, y: spot.y + 1 }); blip(520, 0.25, 0.06); }
      } }, `📍 ${z.name}`))));
  }

  spotIn(z) {
    const w = this.app.world;
    const cx = z.x + Math.floor(z.w / 2);
    const cy = z.y + Math.floor(z.h / 2);
    for (let r = 0; r < Math.max(z.w, z.h); r++) {
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        const x = cx + dx;
        const y = cy + dy;
        if (x >= z.x && y >= z.y && x < z.x + z.w && y < z.y + z.h && w.walkable(x, y) && !w.seatAt(x, y)) return { x, y };
      }
    }
    return null;
  }

  goZone(re) {
    const z = this.app.world.zones.find((zz) => re.test(zz.name || ''));
    const s = z && this.spotIn(z);
    if (s) this.app.teleport(s.x, s.y);
  }

  findDesk() {
    const app = this.app;
    const mine = app.world.deskOf(app.user.id);
    const target = mine || app.world.objects.find((o) => OBJECTS[o.type] && OBJECTS[o.type].desk && !(o.data && o.data.owner) && app.world.deskZoneOf(o));
    if (!target) return toast('Todas as mesas estão ocupadas.', 'warn');
    app.goTo(target.x, target.y + 1);
    toast(mine ? 'Indo para a sua mesa.' : 'Achei uma mesa livre! Chegue perto e aperte X para reivindicar.', 'info', 3000);
  }

  async ranking(body) {
    const list = (this.app.profiles || []).map((p) => ({ name: p.name, k: (p.combat && p.combat.pvpKills) || 0 })).sort((a, b) => b.k - a.k).slice(0, 10);
    fill(body, h('p', {}, '⚔️ Ranking PvP'), list.length ? h('ol', {}, list.map((r) => h('li', {}, `${r.name} — ${r.k} vitórias`))) : h('p', { class: 'muted' }, 'Ninguém lutou ainda.'));
  }

  /** Editor do NPC (modo Construir → Editar). */
  edit(o) {
    const app = this.app;
    const d = o.data || {};
    const role = h('select', {}, Object.entries(ROLES).map(([k, r]) => h('option', { value: k, selected: (d.role || 'guide') === k }, `${r.name} — ${r.title}`)));
    const name = h('input', { type: 'text', maxlength: 30, value: d.name || '', placeholder: 'Nome (opcional)' });
    const hello = h('textarea', { rows: 2, maxlength: 300, placeholder: 'Fala de boas-vindas (opcional)' }, d.hello || '');
    let sprite = d.sprite || '';
    const grid = h('div', { class: 'palette npc-sprites' });
    const paintGrid = () => fill(grid, CAT.npcs.slice(0, 160).map((n) => {
      const a = npcFrames({ data: { sprite: n.id } });
      return h('button', { type: 'button', class: `pal-item ${sprite === n.id ? 'on' : ''}`, title: n.name, onclick: () => { sprite = n.id; paintGrid(); } }, a ? frameCanvas(a.s, a.frames[0], 40) : null);
    }));
    paintGrid();
    const m = openModal({
      title: 'Editar NPC', className: 'modal-wide',
      content: h('div', { class: 'form-stack' }, h('label', {}, 'Função', role), h('label', {}, 'Nome', name), h('label', {}, 'Fala', hello), h('div', { class: 'opt-label' }, 'Aparência'), grid),
      footer: [h('button', { class: 'btn-primary', onclick: () => {
        app.edit([{ t: 'data', id: o.id, data: { ...d, role: role.value, name: name.value.trim(), hello: hello.value.trim(), sprite } }]);
        m.close();
      } }, 'Salvar')],
    });
  }
}
